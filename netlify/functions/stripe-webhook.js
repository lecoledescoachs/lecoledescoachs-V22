// Fonction serverless Netlify : recoit les webhooks Stripe (Payment Links)
// et ajoute/met a jour la ligne du candidat correspondant dans un Google Sheet.
// Envoie egalement une convocation par email (via Resend) quand le paiement
// correspond a une reservation de TEP (client_reference_id = "TEP_AAAA-MM-JJ").
//
// Methode utilisee : cette fonction envoie les donnees a un petit script
// Google Apps Script (colle directement dans le Google Sheet cible), qui se
// charge lui-meme d'ecrire la ligne. Pas d'identifiants Google complexes a
// gerer cote Netlify (pas de service account, pas de cle JSON) : seule une
// URL de "Web App" Apps Script est necessaire, generee en 2 minutes.
//
// ======================================================================
// A FAIRE CÔTÉ GOOGLE SHEETS (une seule fois) :
// ======================================================================
// 1. Ouvrir le Google Sheet qui doit recevoir les candidats.
// 2. Menu Extensions -> Apps Script.
// 3. Remplacer tout le contenu par le code fourni dans le fichier
//    APPS_SCRIPT_A_COLLER.js (livre a cote de cette fonction).
// 4. En haut a droite : Deployer -> Nouveau deploiement.
//    - Type : Application Web
//    - Exécuter en tant que : Moi
//    - Qui a accès : Tout le monde
// 5. Copier l'URL "Web App" generee (se termine par /exec).
// 6. Sur Netlify (Site settings -> Environment variables), creer :
//    GOOGLE_SHEET_WEBHOOK_URL = cette URL
//
// ======================================================================
// A FAIRE CÔTÉ STRIPE (une seule fois) :
// ======================================================================
//   Dashboard -> Developers -> Webhooks -> Add endpoint
//   URL a ecouter : https://lecoledescoachs.fr/.netlify/functions/stripe-webhook
//   Evenement a cocher : checkout.session.completed
//   Copier le "Signing secret" (whsec_...) dans Netlify sous STRIPE_WEBHOOK_SECRET
//
// ======================================================================
// A FAIRE CÔTÉ RESEND, POUR LA CONVOCATION AUTOMATIQUE (une seule fois) :
// ======================================================================
// 1. Creer un compte sur https://resend.com (gratuit jusqu'a 3000 emails/mois).
// 2. Ajouter et verifier le domaine lecoledescoachs.fr (Resend donne des
//    enregistrements DNS SPF/DKIM a ajouter chez l'hebergeur du domaine).
//    Sans domaine verifie, Resend refuse d'envoyer depuis une adresse
//    @lecoledescoachs.fr (mais fonctionne en mode test vers une seule
//    adresse pour valider la configuration avant la verification complete).
// 3. Creer une cle API (Resend -> API Keys -> Create API Key).
// 4. Sur Netlify (Site settings -> Environment variables), creer :
//    RESEND_API_KEY = cette cle (commence par re_...)
//    RESEND_FROM_EMAIL = ex. "L'École des Coachs <convocation@lecoledescoachs.fr>"
//    RESEND_BCC_EMAIL = ton adresse (optionnel), pour recevoir une copie de
//    chaque convocation envoyee et pouvoir verifier que tout part bien.
//
// Sans ces 3 variables Resend, la fonction continue de fonctionner
// normalement pour le Google Sheet ; l'envoi de convocation est simplement
// ignore (aucune erreur, juste une ligne de log).
//
// Securite : la signature du webhook Stripe est verifiee manuellement
// (HMAC SHA256), sans dependance npm, pour rester coherent avec les autres
// functions du site qui n'ont pas de package.json / etape de build.
//
// Comportement en cas d'erreur : Stripe reessaie automatiquement un webhook
// si la reponse n'est pas 2xx, donc toute erreur cote Google Sheet renvoie
// un code d'erreur explicite pour que Stripe relance plus tard plutot que
// de perdre silencieusement l'evenement. L'envoi de la convocation, lui,
// n'entraine jamais de retry Stripe : un email de convocation manque, mais
// le candidat reste bien enregistre dans le Google Sheet (source de verite),
// et les logs Netlify Functions permettent de reperer et renvoyer a la main
// une convocation qui aurait echoue.

const crypto = require("crypto");

// --- Sessions TEP connues : mêmes données que celles utilisées sur
// merci-tep.html (bloc TEP_SESSIONS) et reservation-tep.html (TEP_PROMOS).
// Tenues manuellement synchronisées : à chaque changement de date ou de
// lieu de TEP sur le site, mettre à jour cette liste également.
const TEP_SESSIONS = {
  "2026-09-05": {
    label: "samedi 5 septembre 2026",
    heureDebut: "13h",
    lieu: "CrossFit Cenabum, 537 rue de la Juine, 45160 Olivet",
    rentree: "17 octobre 2026",
  },
  "2026-10-03": {
    label: "samedi 3 octobre 2026",
    heureDebut: "13h",
    lieu: "CrossFit Cenabum, 537 rue de la Juine, 45160 Olivet",
    rentree: "17 octobre 2026",
  },
  "2026-12-19": {
    label: "samedi 19 décembre 2026",
    heureDebut: "13h",
    lieu: "Top Fitness, 32 avenue Gay Lussac, 45800 Saint-Jean-de-Braye",
    rentree: "16 janvier 2027",
  },
  "2027-03-13": {
    label: "samedi 13 mars 2027",
    heureDebut: "13h",
    lieu: "CrossFit Cenabum, 537 rue de la Juine, 45160 Olivet",
    rentree: "27 mars 2027",
  },
};

function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch (e) {
    return false; // longueurs differentes, etc.
  }
}

// Extrait la date de session TEP (AAAA-MM-JJ) depuis client_reference_id,
// au format "TEP_2026-12-19" tel que construit par reservation-tep.html.
function extractTepDate(clientReferenceId) {
  if (!clientReferenceId || typeof clientReferenceId !== "string") return null;
  const match = clientReferenceId.match(/^TEP_(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}

function buildConvocationEmailText(prenom, tep) {
  const nomAffiche = prenom || "";
  const salutation = nomAffiche ? `Bonjour ${nomAffiche},` : "Bonjour,";
  return [
    salutation,
    "",
    "Ta place aux TEP (Tests d'Exigences Préalables) du CQP Instructeur Fitness est confirmée. Voici ta convocation.",
    "",
    `Date : ${tep.label}`,
    `Heure de convocation : ${tep.heureDebut}`,
    `Lieu : ${tep.lieu}`,
    `Rentrée prévisionnelle du CQP IF (sous réserve de réussite) : ${tep.rentree}`,
    "",
    "À prévoir le jour J :",
    "– une pièce d'identité",
    "– une tenue de sport adaptée",
    "– des chaussures propres adaptées aux épreuves",
    "– une bouteille d'eau",
    "– ton certificat médical de non contre-indication à la pratique sportive (ou en cours d'obtention)",
    "",
    "Merci d'arriver un peu en avance pour l'accueil.",
    "",
    "Toutes les infos pratiques et conseils de préparation : https://lecoledescoachs.fr/prepa-tep",
    "",
    "Une question avant le jour J ? Réponds directement à cet email, ou écris-nous à contact@lecoledescoachs.fr.",
    "",
    "À bientôt,",
    "L'équipe de L'École des Coachs",
  ].join("\n");
}

async function sendConvocationEmail({ email, prenom, tepDate }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
  const RESEND_BCC_EMAIL = process.env.RESEND_BCC_EMAIL; // optionnel

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.log("[stripe-webhook] Resend non configuré (RESEND_API_KEY / RESEND_FROM_EMAIL manquants) : convocation non envoyée pour", email);
    return { sent: false, reason: "resend_not_configured" };
  }

  const tep = TEP_SESSIONS[tepDate];
  if (!tep) {
    console.error("[stripe-webhook] Session TEP inconnue pour la date", tepDate, "— convocation non envoyée pour", email);
    return { sent: false, reason: "unknown_tep_date" };
  }

  const body = {
    from: RESEND_FROM_EMAIL,
    to: [email],
    subject: `Ta convocation aux TEP du ${tep.label}`,
    text: buildConvocationEmailText(prenom, tep),
  };
  if (RESEND_BCC_EMAIL) body.bcc = [RESEND_BCC_EMAIL];

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[stripe-webhook] Erreur envoi Resend", resp.status, errText);
      return { sent: false, reason: "resend_error", status: resp.status };
    }

    return { sent: true };
  } catch (networkErr) {
    console.error("[stripe-webhook] Erreur réseau vers Resend", networkErr.message);
    return { sent: false, reason: "network_error" };
  }
}

exports.handler = async function (event, context) {
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  const textResponse = (statusCode, message) => ({
    statusCode,
    body: message,
  });

  if (event.httpMethod !== "POST") {
    return textResponse(405, "Method Not Allowed");
  }

  if (!STRIPE_WEBHOOK_SECRET || !GOOGLE_SHEET_WEBHOOK_URL) {
    console.error("[stripe-webhook] Variables d'environnement manquantes", {
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
      hasSheetUrl: !!GOOGLE_SHEET_WEBHOOK_URL,
    });
    return textResponse(503, "not_configured");
  }

  const sigHeader = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const rawBody = event.body || "";

  if (!verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)) {
    console.error("[stripe-webhook] Signature invalide");
    return textResponse(400, "invalid_signature");
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (err) {
    console.error("[stripe-webhook] Corps JSON illisible", err.message);
    return textResponse(400, "invalid_json");
  }

  // On ne traite que l'evenement qui nous interesse ; tout le reste est
  // accepte (200) pour eviter des reessais inutiles cote Stripe.
  if (stripeEvent.type !== "checkout.session.completed") {
    return textResponse(200, "ignored_event_type");
  }

  const session = stripeEvent.data && stripeEvent.data.object;
  if (!session) {
    console.error("[stripe-webhook] Session absente de l'evenement");
    return textResponse(400, "missing_session");
  }

  const email = (session.customer_details && session.customer_details.email) || session.customer_email || "";
  const nom = (session.customer_details && session.customer_details.name) || "";
  const montant = typeof session.amount_total === "number" ? session.amount_total / 100 : null;
  const devise = session.currency ? session.currency.toUpperCase() : "";
  const sessionId = session.id || "";
  const statutPaiement = session.payment_status === "paid" ? "Payé" : session.payment_status || "Inconnu";
  const tepDate = extractTepDate(session.client_reference_id);
  const prenom = nom ? nom.trim().split(/\s+/)[0] : "";

  // Ville du candidat : deux sources possibles selon la config du Payment Link.
  // 1. Adresse de facturation collectee automatiquement par Stripe (Payment Link -> Billing address collection).
  // 2. Champ personnalise "Ville" ajoute manuellement sur le Payment Link (Payment Link -> Custom fields),
  //    reconnu ici via son "key" (ex: "ville") ou son libelle affiche a l'acheteur.
  let ville = (session.customer_details && session.customer_details.address && session.customer_details.address.city) || "";
  if (!ville && Array.isArray(session.custom_fields)) {
    const champVille = session.custom_fields.find((f) => {
      const key = (f.key || "").toLowerCase();
      const label = (f.label && f.label.custom_text) ? f.label.custom_text.toLowerCase() : "";
      return key.includes("ville") || label.includes("ville");
    });
    if (champVille && champVille.text && champVille.text.value) {
      ville = champVille.text.value;
    }
  }

  if (!email) {
    console.error("[stripe-webhook] Aucun email dans la session Stripe, impossible de rattacher un candidat", sessionId);
    return textResponse(200, "no_email_skipped");
  }

  const payload = {
    email,
    nom,
    ville,
    montant,
    devise,
    sessionId,
    statutPaiement,
    datePaiement: new Date().toISOString(),
  };

  try {
    const sheetResp = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Apps Script suit les redirections lors du premier appel apres deploiement ;
      // "redirect: follow" (comportement par defaut de fetch) gere ca correctement.
      body: JSON.stringify(payload),
    });

    if (!sheetResp.ok) {
      const bodyText = await sheetResp.text().catch(() => "");
      console.error("[stripe-webhook] Erreur ecriture Google Sheet", sheetResp.status, bodyText);
      return textResponse(502, "sheet_write_error");
    }

    const result = await sheetResp.json().catch(() => null);
    if (result && result.status !== "ok") {
      console.error("[stripe-webhook] Le script Google a renvoye une erreur", result);
      return textResponse(502, "sheet_script_error");
    }
  } catch (networkErr) {
    console.error("[stripe-webhook] Erreur reseau vers Google Sheet", networkErr.message);
    return textResponse(502, "network_error");
  }

  // Convocation automatique par email, uniquement pour un paiement de TEP
  // (client_reference_id au format "TEP_AAAA-MM-JJ"). Un paiement d'un autre
  // type (formation Pilates, Coach Référence, etc.) n'a pas ce format et ne
  // déclenche donc aucun envoi ici.
  if (tepDate) {
    const emailResult = await sendConvocationEmail({ email, prenom, tepDate });
    if (!emailResult.sent) {
      // On ne fait pas échouer le webhook pour autant : le candidat est déjà
      // bien enregistré dans le Google Sheet, qui reste la source de vérité.
      console.error("[stripe-webhook] Convocation non envoyée", { email, tepDate, reason: emailResult.reason });
    }
  }

  return textResponse(200, "ok");
};

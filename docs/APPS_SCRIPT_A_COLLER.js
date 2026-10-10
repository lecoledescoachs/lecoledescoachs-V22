// ============================================================================
// CE FICHIER NE FAIT PAS PARTIE DU SITE. Il ne s'execute pas sur Netlify.
// C'est le code a copier-coller dans Google Sheets (Extensions -> Apps Script).
// ============================================================================
//
// INSTALLATION (5 minutes, une seule fois) :
//
// 1. Ouvre le Google Sheet qui doit recevoir les candidats.
// 2. Renomme la première feuille (en bas) "Candidats" si elle ne l'est pas deja,
//    ou adapte NOM_FEUILLE ci-dessous.
// 3. Menu en haut : Extensions -> Apps Script.
// 4. Supprime tout le contenu par defaut (le "function myFunction(){}") et
//    colle l'INTEGRALITE du code ci-dessous a la place.
// 5. Clique sur l'icone disquette (Enregistrer le projet).
// 6. En haut a droite, bouton bleu "Déployer" -> "Nouveau déploiement".
//    - Clique sur la roue dentée a cote de "Sélectionner le type" -> "Application Web".
//    - Description : "Webhook Stripe" (libre).
//    - Exécuter en tant que : Moi (ton compte Google).
//    - Qui a accès : Tout le monde.
//    - Clique "Déployer".
// 7. Google va probablement demander une autorisation la premiere fois
//    (ecran "Cette application n'est pas verifiee") -> clique sur
//    "Parametres avances" puis "Acceder a [nom du projet] (non securise)".
//    C'est normal, c'est TON propre script, sur TON propre compte.
// 8. Une URL apparait, du type :
//    https://script.google.com/macros/s/AKfycb.../exec
//    Copie cette URL en entier.
// 9. Sur Netlify (Site settings -> Environment variables), cree la variable :
//    GOOGLE_SHEET_WEBHOOK_URL = (colle l'URL copiee a l'etape 8)
//
// Si tu modifies ce script plus tard, il faut refaire "Déployer -> Gérer les
// déploiements -> icone crayon -> Nouvelle version" pour que les changements
// prennent effet (la simple sauvegarde ne suffit pas a mettre a jour l'URL /exec).
//
// ============================================================================

var NOM_FEUILLE = "Candidats"; // adapte si ta feuille a un autre nom

var ENTETES = [
  "Date paiement",
  "Email",
  "Nom",
  "Ville",
  "Montant",
  "Devise",
  "Statut paiement",
  "Session Stripe",
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(NOM_FEUILLE);
    if (!sheet) {
      sheet = ss.insertSheet(NOM_FEUILLE);
    }

    // Ajoute les en-tetes si la feuille est vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(ENTETES);
      sheet.getRange(1, 1, 1, ENTETES.length).setFontWeight("bold");
    }

    // Recherche si une ligne existe deja pour cet email (colonne "Email", 2e colonne)
    var email = data.email || "";
    var ligneExistante = -1;
    if (email) {
      var valeurs = sheet.getDataRange().getValues();
      for (var i = 1; i < valeurs.length; i++) {
        if (valeurs[i][1] === email) {
          ligneExistante = i + 1; // +1 car les lignes de sheet commencent a 1
          break;
        }
      }
    }

    var ligne = [
      data.datePaiement || new Date().toISOString(),
      data.email || "",
      data.nom || "",
      data.ville || "",
      data.montant != null ? data.montant : "",
      data.devise || "",
      data.statutPaiement || "",
      data.sessionId || "",
    ];

    if (ligneExistante > 0) {
      sheet.getRange(ligneExistante, 1, 1, ligne.length).setValues([ligne]);
    } else {
      sheet.appendRow(ligne);

      // Notification email a chaque NOUVEAU paiement (pas a une simple mise a jour).
      // Envoyee automatiquement au proprietaire du script (toi), sans configuration
      // supplementaire : pas de cle API, pas d'adresse a renseigner.
      try {
        var destinataire = Session.getEffectiveUser().getEmail();
        var sujet = "Nouveau paiement : " + (data.nom || data.email || "candidat");
        var corps =
          "Un nouveau paiement vient d'etre enregistre.\n\n" +
          "Nom : " + (data.nom || "-") + "\n" +
          "Email : " + (data.email || "-") + "\n" +
          "Ville : " + (data.ville || "-") + "\n" +
          "Montant : " + (data.montant != null ? data.montant : "-") + " " + (data.devise || "") + "\n" +
          "Statut : " + (data.statutPaiement || "-") + "\n" +
          "Session Stripe : " + (data.sessionId || "-") + "\n\n" +
          "Voir le Google Sheet : " + ss.getUrl();
        MailApp.sendEmail(destinataire, sujet, corps);
      } catch (mailErr) {
        // Une erreur d'envoi d'email ne doit jamais faire echouer l'enregistrement
        // de la ligne dans le Sheet (deja fait a ce stade). On logge simplement.
        Logger.log("Erreur envoi email de notification : " + mailErr);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// LECTURE DES PLACES TEP (utilisee par le bandeau du site et la page Prepa TEP)
// ============================================================================
// Onglet cible : "Places TEP", avec en 1ere ligne les en-tetes suivants :
//   Identifiant session | Places max | Places restantes
// Une ligne par session (ex: "TEP-2026-09-05" | 50 | 32).
//
// Appel : GET vers la meme URL /exec, avec en parametre optionnel
//   ?session=TEP-2026-09-05
// Si le parametre "session" est omis, la fonction prend la 1ere ligne de donnees.

var NOM_FEUILLE_PLACES = "Places TEP";

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(NOM_FEUILLE_PLACES);
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Onglet 'Places TEP' introuvable" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var valeurs = sheet.getDataRange().getValues();
    if (valeurs.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Aucune ligne de donnees dans 'Places TEP'" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sessionDemandee = (e.parameter && e.parameter.session) || null;
    var ligneChoisie = null;

    if (sessionDemandee) {
      for (var i = 1; i < valeurs.length; i++) {
        if (String(valeurs[i][0]) === sessionDemandee) {
          ligneChoisie = valeurs[i];
          break;
        }
      }
    }
    if (!ligneChoisie) {
      ligneChoisie = valeurs[1]; // a defaut : premiere ligne de donnees
    }

    var total = typeof ligneChoisie[1] === "number" ? ligneChoisie[1] : 50;
    var remaining = Math.max(0, typeof ligneChoisie[2] === "number" ? ligneChoisie[2] : 0);
    var full = remaining <= 0;
    var inscrits = Math.max(0, total - remaining);

    return ContentService
      .createTextOutput(JSON.stringify({ remaining: remaining, total: total, full: full, inscrits: inscrits }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

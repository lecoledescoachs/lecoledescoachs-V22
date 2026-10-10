// Fonction serverless Netlify : lit le nombre de places restantes depuis Google Sheets.
//
// Methode utilisee : appel GET vers le meme Google Apps Script deja utilise pour
// enregistrer les paiements Stripe (fonction doGet, distincte de doPost). Meme
// principe que le reste du site : aucun identifiant complexe cote Netlify, juste
// une URL de Web App.
//
// Variable attendue (Site settings -> Environment variables sur Netlify) :
//   GOOGLE_SHEET_WEBHOOK_URL - meme URL que celle utilisee par stripe-webhook.js
//
// Cote Google Sheets, onglet "Places TEP" avec les colonnes :
//   Identifiant session | Places max | Places restantes
//
// Comportement en cas d'erreur : ne jamais faire planter le site. Toute erreur est
// journalisee (console.error, visible dans les logs Netlify Functions) et une
// reponse structuree est renvoyee ; le front-end (prepa-tep.html, bandeau TEP)
// retombe alors sur l'affichage generique honnete plutot que d'afficher un
// chiffre errone ou de casser la page.

exports.handler = async function (event, context) {
  const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  const jsonResponse = (statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
    body: JSON.stringify(body),
  });

  // Cas 1 : automatisation pas encore configuree (variable manquante)
  if (!GOOGLE_SHEET_WEBHOOK_URL) {
    console.error("[tep-seats] Variable d'environnement GOOGLE_SHEET_WEBHOOK_URL manquante");
    return jsonResponse(503, { error: "not_configured" });
  }

  const sessionId = (event.queryStringParameters && event.queryStringParameters.session) || "";
  const url = sessionId
    ? `${GOOGLE_SHEET_WEBHOOK_URL}?session=${encodeURIComponent(sessionId)}`
    : GOOGLE_SHEET_WEBHOOK_URL;

  let resp;
  try {
    // Delai de securite : n'attend jamais indefiniment une reponse de Google Apps Script
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
  } catch (networkErr) {
    // Cas 2 : probleme reseau (Apps Script injoignable, timeout)
    console.error("[tep-seats] Erreur reseau vers Google Sheets", networkErr.message);
    return jsonResponse(502, { error: "network_error" });
  }

  if (!resp.ok) {
    // Cas 3 : Apps Script repond mais en erreur
    const bodyText = await resp.text().catch(() => "");
    console.error("[tep-seats] Erreur Google Sheets", resp.status, bodyText);
    return jsonResponse(502, { error: "sheet_error", status: resp.status });
  }

  let data;
  try {
    data = await resp.json();
  } catch (parseErr) {
    console.error("[tep-seats] Reponse Google Sheets illisible", parseErr.message);
    return jsonResponse(502, { error: "invalid_response" });
  }

  if (data.status === "error") {
    // Cas 4 : le script a renvoye une erreur explicite (onglet introuvable, etc.)
    console.error("[tep-seats] Le script Google a renvoye une erreur", data.message);
    return jsonResponse(502, { error: "sheet_script_error", message: data.message });
  }

  const total = typeof data.total === "number" ? data.total : 50;
  // Securite supplementaire cote fonction : jamais de nombre negatif, meme si la
  // feuille venait a etre modifiee par erreur un jour (defense en profondeur).
  const remaining = Math.max(0, typeof data.remaining === "number" ? data.remaining : 0);
  const full = remaining <= 0;
  const inscrits = Math.max(0, total - remaining);

  return jsonResponse(200, { remaining, total, full, inscrits });
};

// Fonction serverless Netlify : recupere les episodes de la playlist YouTube
// "L'Heure des Coachs" et leurs durees, cote serveur.
// La cle API YouTube ne transite jamais vers le navigateur.
//
// Variable attendue (Site settings -> Environment variables sur Netlify) :
//   YOUTUBE_API_KEY - cle API YouTube Data v3 (secret)
//
// L'identifiant de playlist n'est pas un secret : il reste passe en parametre
// depuis le front-end (podcast-medias.html), pour ne pas dupliquer une valeur
// qui doit rester identique des deux cotes.
//
// Comportement en cas d'erreur : ne jamais faire planter le site. Toute erreur
// est journalisee (console.error, visible dans les logs Netlify Functions) et
// une reponse structuree est renvoyee ; le front-end retombe alors sur le
// contenu statique existant plutot que d'afficher une page cassee.

exports.handler = async function (event, context) {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const playlistId = event.queryStringParameters && event.queryStringParameters.playlistId;

  const jsonResponse = (statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // Cache court cote CDN : les episodes ne changent pas a chaque seconde,
      // mais on veut qu'un nouvel episode publie apparaisse assez vite.
      "Cache-Control": "public, max-age=900",
    },
    body: JSON.stringify(body),
  });

  if (!YOUTUBE_API_KEY) {
    console.error("[youtube-episodes] Variable d'environnement YOUTUBE_API_KEY manquante");
    return jsonResponse(503, { error: "not_configured" });
  }

  if (!playlistId) {
    console.error("[youtube-episodes] Parametre playlistId manquant dans la requete");
    return jsonResponse(400, { error: "missing_playlist_id" });
  }

  async function fetchAllPlaylistItems(id) {
    let items = [];
    let pageToken = "";
    for (let i = 0; i < 5; i++) {
      // 5 pages max = 250 episodes, largement suffisant
      const url =
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(id)}&key=${YOUTUBE_API_KEY}` +
        (pageToken ? `&pageToken=${pageToken}` : "");
      const res = await fetch(url);
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`playlistItems ${res.status}: ${bodyText}`);
      }
      const data = await res.json();
      items = items.concat(data.items || []);
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return items;
  }

  async function fetchDurations(videoIds) {
    const durations = {};
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50).join(",");
      const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      (data.items || []).forEach((v) => {
        durations[v.id] = v.contentDetails.duration; // format ISO 8601, ex: PT12M34S
      });
    }
    return durations;
  }

  let items;
  try {
    items = await fetchAllPlaylistItems(playlistId);
  } catch (err) {
    console.error("[youtube-episodes] Erreur playlistItems", err.message);
    return jsonResponse(502, { error: "youtube_playlist_error" });
  }

  const episodes = items
    .filter(
      (it) =>
        it.snippet &&
        it.snippet.resourceId &&
        it.snippet.resourceId.videoId &&
        it.snippet.title !== "Private video" &&
        it.snippet.title !== "Deleted video"
    )
    .map((it) => ({
      id: it.snippet.resourceId.videoId,
      title: it.snippet.title,
      thumb:
        (it.snippet.thumbnails &&
          (it.snippet.thumbnails.maxres ||
            it.snippet.thumbnails.high ||
            it.snippet.thumbnails.medium ||
            it.snippet.thumbnails.default) ||
          {}
        ).url || `https://i.ytimg.com/vi/${it.snippet.resourceId.videoId}/hqdefault.jpg`,
      publishedAt: it.snippet.publishedAt,
    }));

  episodes.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  let durations = {};
  try {
    durations = await fetchDurations(episodes.map((e) => e.id));
  } catch (err) {
    // Les durees sont accessoires : on renvoie quand meme les episodes sans elles.
    console.error("[youtube-episodes] Erreur durations (non bloquant)", err.message);
  }

  return jsonResponse(200, { episodes, durations });
};

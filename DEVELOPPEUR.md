# Documentation technique — lecoledescoachs.fr

**À lire en premier si vous reprenez ce site sans contexte préalable.**

Ce document existe parce qu'une grande partie du site a été construite et maintenue
avec l'aide d'un assistant IA (Claude, Anthropic) sur plusieurs sessions de travail.
Il documente l'architecture réelle, les conventions utilisées, et surtout les pièges
déjà rencontrés — pour qu'un développeur humain reprenant ce projet ne perde pas de
temps à redécouvrir ce qui est déjà connu.

Dernière mise à jour : 12 août 2026.

---

## 1. Vue d'ensemble

- **Type de site** : site statique HTML/CSS/JS, ~307 pages, aucun framework
  (pas de React/Vue/Next — chaque page est un fichier `.html` autonome).
- **Hébergement** : Netlify, déployé via GitHub (push sur la branche déployée = mise
  en ligne automatique).
- **Pas de base de données.** Les seules données dynamiques viennent de Google Sheets
  (via Apps Script, voir section 6) et de l'API Stripe.
- **Contact business/produit** : Garry Babaud (fondateur). Contact déploiement/repo :
  Samuel.

### Pourquoi autant de pages HTML statiques ?

Stratégie SEO volontaire : de nombreuses pages ciblent une ville précise
(`cqp-if-tours.html`, `ou-passer-cqp-if-nevers-nievre.html`, etc.) ou un profil de
candidat précis (`profil-sportif-devenir-coach-cqp-if.html`). Ce n'est pas un
générateur de contenu automatique — chaque page a été vérifiée pour être
suffisamment différenciée (voir audit SEO en section 8).

---

## 2. Structure des fichiers

```
/
├── *.html                    ← 307 pages, à plat à la racine (pas de sous-dossiers)
├── assets/
│   ├── css/shared-base.css   ← CSS partagé, cache navigateur 1 an (voir section 3)
│   ├── logo/, photos/, orleans/, partners/, press/, video/, og/, ...
│   └── bamboo/                ← icônes du chatbot (voir section 5)
├── documents/                ← PDF téléchargeables (CGV, plaquette, calendriers...)
├── netlify/functions/        ← 3 fonctions serverless (voir section 6)
├── docs/APPS_SCRIPT_A_COLLER.js  ← code à coller dans Google Sheets (PAS exécuté par Netlify)
├── _dev-tools/                ← scripts de génération réutilisables (voir section 7)
├── _headers                  ← en-têtes HTTP Netlify (cache, sécurité)
├── _redirects                ← redirections Netlify
├── sitemap.xml, robots.txt, llms.txt, manifest.json
└── DEVELOPPEUR.md             ← ce fichier
```

**Il n'y a pas de dossier `src/` ni de build step.** Ce que vous voyez dans le repo
est exactement ce qui est servi en production.

---

## 3. Le système CSS partagé

### Comment ça marche

`assets/css/shared-base.css` contient ~178 règles CSS identiques présentes sur au
moins 90% des pages (nav, footer, boutons, typographie de base). Chaque page HTML
inclut :

```html
<link rel="stylesheet" href="/assets/css/shared-base.css">
```

Le reste du CSS (spécifique à chaque page) reste inline dans un `<style>` en tête
de fichier. Le fichier partagé est mis en cache 1 an par le navigateur (`_headers`),
donc il n'est téléchargé qu'une fois par visiteur — chaque page suivante consultée
est plus légère.

### Comment régénérer ce fichier si besoin

Le script qui a servi à l'extraire n'est **pas dans le repo** (il vivait dans un
environnement de travail temporaire). Si vous devez refaire une extraction CSS
similaire (par exemple après avoir ajouté beaucoup de nouvelles pages), voici la
méthode qui a fonctionné, à réécrire en Python :

1. Parser le CSS de chaque page avec `tinycss2` (bibliothèque Python), en
   **excluant tout ce qui est à l'intérieur des balises `<script>`** avant de
   chercher des `<style>` par regex.
2. Compter, pour chaque règle CSS (sélecteur + déclaration), sur combien de pages
   elle apparaît à l'identique (texte normalisé).
3. Garder les règles présentes sur ≥ 90% des pages → fichier partagé.
4. Sur chaque page, retirer uniquement les règles qui matchent exactement une
   règle commune (pas de suppression approximative).

### ⚠️ Piège déjà rencontré : ne jamais utiliser une regex naïve sur `<style>`

Une regex du type `<style>(.*?)</style>` peut accidentellement matcher à
l'intérieur d'un `<script>` si ce script contient la chaîne littérale `'<style>'`
dans une chaîne de caractères JavaScript (c'est le cas du widget Bamboo, voir
section 5, qui construit du HTML dynamiquement). Ça a réellement corrompu le
widget sur `index.html` et `a-propos.html` lors d'une extraction CSS en masse.
**Toujours exclure les plages `<script>...</script>` avant de chercher des
`<style>`.**

### Convention : float plutôt que flexbox/grid dans certains contextes

Sur certains composants récents (grilles de calendrier, cartes), le CSS utilise
`float:left` plutôt que `display:flex` ou `display:grid`, même si flexbox/grid sont
utilisés ailleurs sur le site sans problème réel en production. C'est une
précaution prise après des soucis de rendu dans un **outil de test interne**
(ancien moteur WebKit sans support fiable des variables CSS et de flexbox) —
pas une limite des vrais navigateurs modernes. Si vous ajoutez un nouveau
composant, flexbox/grid fonctionnent très bien en production ; le choix du float
sur les composants existants est un héritage de prudence, pas une règle absolue.

---

## 4. Design System — deux univers distincts

### 4.1 Le site web (thème sombre, variables CSS)

Toutes les couleurs passent par des variables CSS définies une fois et réutilisées
partout (`var(--black)`, `var(--white)`, `var(--border)`, etc.), avec une bascule
`data-theme="dark"` / `data-theme="light"` sur `<html>`. Ne jamais coder une couleur
en dur (`#0a0a0a`) sur une page web sans bonne raison — ça casse le mode clair.

Polices : `Inter` (texte courant), `DM Serif Display` en italique (titres).

Couleurs sémantiques déjà établies, à réutiliser plutôt qu'en inventer de
nouvelles sans réfléchir :
- Rouge (`#f87171`) = alerte / évaluation / pas de cours
- Vert (`#4ade80`) = valide / cours / présentiel
- Ambre/or (`#b8860b` à `#fcd34d`) = TEP / spécial
- Indigo (`#818cf8`) = rattrapages

### 4.2 Les documents PDF (noir sur blanc, système séparé)

Les PDF (CGV, plaquette, calendriers imprimables...) sont générés avec
**wkhtmltopdf** (binaire patché, voir section 7), dans un style noir/blanc distinct
du site web : logo rond en en-tête, bande noire pour les titres de section, rouge
`#b91c1c` / vert `#15803d` pour les statuts. Ce système ne partage pas son CSS avec
le site web — ce sont deux design systems différents et c'est voulu (le site web
est en thème sombre, un PDF imprimé doit rester lisible sur papier).

**wkhtmltopdf ne persiste pas dans l'environnement de travail** — si vous devez
régénérer un PDF, il faut retélécharger le binaire :
```bash
curl -sL -o wkhtmltox.deb "https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_0.12.6.1-2.jammy_amd64.deb"
dpkg -x wkhtmltox.deb /tmp/wkhtmltox_extracted
# binaire : /tmp/wkhtmltox_extracted/usr/local/bin/wkhtmltopdf
```

Commande de génération type (gabarits dans `_dev-tools/pdf-templates/`, testée et
confirmée fonctionnelle le 12/08/2026 — logo, en-tête, pied de page et pagination
automatique "Page X / Y" s'affichent correctement) :
```bash
wkhtmltopdf --page-size A4 --dpi 96 --enable-local-file-access \
  --margin-top 42 --margin-bottom 24 --margin-left 0 --margin-right 0 \
  --header-html header.html --header-spacing 8 \
  --footer-html footer.html --footer-spacing 6 \
  body.html sortie.pdf
```

⚠️ Dans `footer.html`, la pagination automatique utilise `unescape()` seul —
**pas** `decodeURIComponent(unescape())`, qui casse silencieusement la
substitution (bug rencontré et corrigé en écrivant cette documentation).

Contraintes CSS spécifiques à ce moteur (WebKit ancien) :
- `display:flex` peu fiable avec mélange bloc/texte → toujours `float:left` + `margin-left`
- CSS Grid, `column-count`, `gap` : non supportés → float + margin/padding
- Unités viewport (`vh`, `%` pleine largeur) instables → valeurs en pixels

---

## 5. Le widget de chat Bamboo

**Composant le plus fragile du site — à modifier avec précaution.**

- Présent sur 10 pages seulement (`index.html`, `a-propos.html`,
  `cqp-instructeur-fitness.html`, `prepa-tep.html`, et 6 autres pages à fort
  potentiel de conversion) — absent volontairement des articles de blog et pages
  villes.
- Chargement différé (`<script defer>`) pour ne pas impacter les performances
  (LCP/CLS).
- Construit en JavaScript pur : le script génère lui-même le HTML/CSS du widget et
  l'injecte dans le DOM au chargement (pas de balises HTML statiques dans la page
  pour ce composant — tout est dans le `<script>`).
- **Personnalisé différemment selon la page** : `cqp-instructeur-fitness.html` et
  `prepa-tep.html` ont une version enrichie (liens Calendly, référence au
  simulateur TEP) par rapport aux 8 autres pages qui partagent un script identique
  (~39 100 caractères). C'est volontaire, pas une divergence à corriger.
- Repère dans le code : commentaire `<!-- BAMBOO V1 (chargement differe, zero
  impact LCP/CLS) -->`.

**Avant toute modification en masse du site (recherche-remplace sur plusieurs
pages, extraction CSS, etc.), toujours vérifier que le bloc `<script defer>` de
Bamboo n'a pas été touché.** Méthode de vérification fiable : comparer le script
extrait avant/après avec `diff`, il doit être strictement identique à l'octet près
(sauf sur les 2 pages volontairement personnalisées).

---

## 6. Fonctions serverless Netlify

Trois fonctions dans `netlify/functions/`, toutes documentées en commentaires en
tête de fichier :

| Fichier | Rôle | Variable d'env. requise |
|---|---|---|
| `stripe-webhook.js` | Reçoit les webhooks Stripe (Payment Links) et transmet à un Google Apps Script qui écrit dans un Google Sheet | `GOOGLE_SHEET_WEBHOOK_URL` |
| `tep-seats.js` | Lit le nombre de places TEP restantes depuis le même Google Sheet | `GOOGLE_SHEET_WEBHOOK_URL` (même valeur) |
| `youtube-episodes.js` | Récupère les épisodes de la playlist YouTube "L'Heure des Coachs" côté serveur (la clé API ne transite jamais côté navigateur) | `YOUTUBE_API_KEY` |

Ces variables d'environnement se configurent dans **Netlify → Site settings →
Environment variables**, pas dans un fichier du repo (pas de `netlify.toml` ni de
`.env` présent — la config Netlify a été faite directement dans le dashboard).

`docs/APPS_SCRIPT_A_COLLER.js` **ne fait pas partie du site** et ne s'exécute pas
sur Netlify — c'est le code à coller manuellement dans l'éditeur Apps Script du
Google Sheet cible (Extensions → Apps Script). Toutes les fonctions serverless sont
conçues pour ne jamais faire planter le site en cas d'erreur (erreur journalisée,
le front-end retombe sur du contenu statique).

---

## 7. Génération de contenu — scripts réutilisables

Le dossier `_dev-tools/` contient les scripts Python qui ont servi à générer les
calendriers de formation (web et PDF) et les grilles de dates. Si vous devez
régénérer un calendrier avec de nouvelles dates, ces scripts servent de point de
départ — mais **vérifiez toujours les données une par une** avant de publier
(voir section 9, plusieurs erreurs de date ont déjà été corrigées après coup).

- `calendar-generators/` : génération des grilles calendrier HTML (tables, pas
  flexbox/grid — voir section 3).
- `pdf-templates/` : gabarits header/footer/style pour la génération PDF via
  wkhtmltopdf.

**Règle générale pour toute nouvelle extraction/génération en masse :**
1. Toujours faire un backup complet (`cp *.html /tmp/backup/`) avant modification.
2. Toujours vérifier après coup avec un diff automatisé, pas à l'œil :
   CSS sémantiquement équivalent, JS strictement identique à l'octet près,
   contenu HTML hors script/style strictement identique.
3. Ne jamais faire confiance à un rendu visuel obtenu via un outil de test
   automatisé sans variables CSS/flexbox fiables (voir section 3) — en cas de
   doute sur le rendu réel, il faut une vérification en navigateur par un humain.

---

## 8. SEO / structure de contenu

- **Sitemap** (`sitemap.xml`) et **robots.txt** à jour, aucun bot IA exclu.
- **`llms.txt`** présent à la racine — fichier optionnel qui résume le site pour
  les moteurs génératifs (ChatGPT, Perplexity...).
- **Schema JSON-LD** sur la quasi-totalité des pages : `BreadcrumbList`,
  `BlogPosting`, `FAQPage`, `Course`, `EducationalOrganization`. Pour tout nouvel
  article de blog, le `headline`/`description` du JSON-LD doivent correspondre au
  vrai sujet de la page — un bug de copier-coller a un jour affecté 68 pages avec
  un JSON-LD identique et incorrect. Toujours vérifier après une création en masse.
- **Règle standing pour tout nouvel article** : un encart "En bref" doit être
  ajouté juste après `<div class="article-body">` :
  ```html
  <div class="snippet-box"><div class="snippet-label">En bref</div><p>[résumé factuel 2-3 phrases]</p></div>
  ```
  (la classe CSS existe déjà dans `shared-base.css`, pas besoin de la recréer).

---

## 9. Pièges déjà rencontrés (pour ne pas les refaire)

1. **Regex CSS qui matche dans du JS** → a corrompu Bamboo (voir section 3 et 5).
2. **Classes CSS mal nommées lors d'un renommage en masse** (`rc-promo2` généré
   mais `.rc-p2` défini dans le CSS) → contenu invisible sans erreur visible,
   repéré uniquement par vérification systématique.
3. **`.replace()` de texte non positionnel sur du contenu dupliqué** → si deux
   blocs HTML sont identiques, un remplacement par correspondance de texte peut
   cibler le mauvais bloc. Préférer un remplacement par position (regex avec
   `.start()`/`.end()`) quand le contenu peut être dupliqué.
4. **Balise fermante en trop lors d'une fusion de blocs** (`</div></div>` au lieu
   d'un seul) → toujours vérifier `count('<div') == count('</div>')` après
   modification.
5. **Nouvelle page créée sans copier le bloc media-query mobile du `.container`**
   → la page gardait 40px de marge sur mobile au lieu de 24px comme le reste du
   site, et une classe `nav-hide-mobile` utilisée en HTML sans règle CSS pour la
   masquer sur mobile. Toujours partir d'une page existante complète (nav +
   footer + media queries) plutôt que de reconstruire le head/nav à la main.
6. **Dates de calendrier lues depuis une capture d'écran/image compressée** →
   plusieurs corrections ont été nécessaires après coup (rentrée mal datée, TEP
   sur 2 jours au lieu d'1). Privilégier toujours un fichier source exploitable
   (Excel, CSV) à une image quand des dates réelles sont en jeu — et faire
   confirmer les dates par Garry avant publication.

---

## 10. Informations légales et business clés

- **Raison sociale** : L'École des Coachs SAS
- **Adresse (siège social)** : 537 rue de la Juine, 45160 Olivet, France
  (⚠️ une box postale à Paris est prévue à terme — si l'adresse change à nouveau,
  il faut la propager sur les ~10 pages légales/documents qui la mentionnent)
- **SIRET** : 988 234 605 00018 — **RCS Orléans** : 988 234 605 (ne pas confondre
  les deux : SIRET = SIREN + 5 chiffres, RCS = SIREN seul)
- **N° de déclaration d'activité (organisme de formation)** : 24450456345
- **Contact** : contact@lecoledescoachs.fr / 07 81 28 26 04
- **⚠️ Point juridique en attente** : les CGV mentionnent le droit à un médiateur
  de la consommation mais ne nomment aucun médiateur précis (obligation légale,
  art. L.616-1 du Code de la consommation). Il manque : nom, adresse, site du
  médiateur auprès duquel l'entreprise doit être inscrite.
- **Schoolmaker** : plateforme utilisée uniquement pour l'accès au contenu payant
  "Lance ton activité" — **jamais** pour le dépôt des documents obligatoires du
  CQP IF (CNI, PSC1, certificat médical), qui se fait uniquement par email à
  contact@lecoledescoachs.fr. Un bug Schoolmaker (erreur 500 sur la config prix)
  bloquait au moment de la rédaction de ce document le lien de paiement natif sur
  `recap-lance-ton-activite.html`, qui utilise en attendant un lien Stripe externe.

---

## 11. Contacts et accès

| Rôle | Qui | Notes |
|---|---|---|
| Décisions produit/contenu | Garry Babaud | contact@lecoledescoachs.fr |
| Déploiement / accès repo GitHub / Netlify | Samuel | — |
| Paiement | Stripe | Liens de paiement directs + webhook (section 6) |
| Financement CPF | GoCardless | — |
| Visioconférence commerciale | Calendly (`calendly.com/ga-coachs/...`) | 2 liens actifs selon le contexte |
| Formulaires | Tally | 3 formulaires distincts selon l'offre |

---

*Ce document a été généré avec l'aide de Claude (Anthropic) sur la base des
sessions de travail effectuées sur ce site. Il doit être mis à jour à chaque
changement d'architecture significatif.*

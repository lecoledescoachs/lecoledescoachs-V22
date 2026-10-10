# PASSATION — Session du 13/08/2026 (soir)

## ⚠️ À faire en tout premier dans la nouvelle conversation
Le container ne persiste pas entre les sessions. Il faut re-uploader :
1. Le zip du site le plus récent (`site-lecoledescoachs-updated.zip`)
2. Le dézipper dans `/home/claude/site-v11`

## Contexte général
L'École des Coachs SAS — 537 rue de la Juine, 45160 Olivet — SIRET 988 234 605 00018.
Site statique HTML/CSS/JS, ~308 pages, déployé sur Netlify via GitHub par Samuel.
Fondateur : Garry Babaud.

## Ce qui a été fait sur cette session (très longue, ~2h30)

### Calendriers de formation
- Page `/calendrier-formation` refaite en grilles calendrier (4 promos, TEP + Cours uniquement, simplifié et harmonisé)
- Rentrée Promo 1 corrigée : 12 septembre 2026 (pas le 3)
- TEP Promo 1 corrigé : 5 septembre uniquement (pas 5-6)
- Toutes dates vérifiées identiques entre le site web et `planning-cqp-if.pdf`
- FAQ ajoutée sur cette page + encart "En bref" (règle standing du site)

### Défilement automatique généralisé
- Tous les carrousels vidéo/photo du site passés en défilement automatique continu (au lieu de swipe manuel), avec pause à l'interaction : galerie "Acquisition Clients", carrousels "Ils m'ont invité" (podcast-medias.html)

### Corrections de contenu factuel
- "Coach sportif depuis 2018" → "pendant 8 ans (2018-2026)" (Garry ne coache plus bientôt)
- CPF retiré de "Lance ton activité" (formation non éligible) — 3 endroits corrigés
- "300€/mois" → "400€/mois" (erreur de calcul, 1200€/3x)
- Développement direct clarifié : PAS une franchise, dans `carrieres.html`
- Drapeaux 🇬🇵🇲🇶🇷🇪 ajoutés pour Guadeloupe/Martinique/Réunion (texte normal, pas dans les SVG)
- Nouvelle section "Ton stage, un vrai stage de coaching" sur `/cqp-instructeur-fitness` (différenciateur GA Coachs)
- 2 parcours distincts après le diplôme bien séparés visuellement sur `cqp-if-qui-lance-ta-carriere.html` (Parcours A : GA Coachs / Parcours B : indépendant)

### Corrections visuelles répétées (motif récurrent toute la session)
Beaucoup de titres qui se coupaient mal sur mobile (mot ou "?" isolé sur sa ligne). Méthode systématique utilisée : tester le rendu à 390px de large avec wkhtmltoimage avant de livrer, pas deviner. Pages concernées : coach-reference.html, cqp-instructeur-fitness.html, deviens-coach-sportif-a-succes.html, lance-ton-activite-de-coach-sportif.html, pilates-reformer.html, vie-de-lecole.html, a-propos.html, et d'autres.

Un balayage complet du site (1451 corrections sur 262 pages) a déjà lié les mots/points d'interrogation orphelins des titres h1/h2/h3 et des questions FAQ avec des espaces insécables (`&nbsp;`).

### Bug résolu : Bamboo cachait le bouton CTA sur mobile
Sur 7 pages ayant à la fois le widget Bamboo et la barre CTA collante, Bamboo remonte maintenant à 92px du bas au lieu de 22px pour ne plus chevaucher.

### Logos recadrés (marge interne excessive)
Logos de certifications (formasat, staps-orleans, iedm, etc.) et logos partenaires ("Nos partenaires recrutent", 81 fichiers) recadrés à leur contenu réel + marge fine cohérente.

### Audit juridique fait
- Lien mort vers plateforme ODR européenne retiré (fermée le 20/07/2025)
- ⚠️ **Point non résolu, à la charge de Garry** : le médiateur de la consommation n'est toujours pas nommé dans les CGV (juste le principe général). Obligation légale (art. L.616-1). Il doit s'inscrire auprès d'un médiateur et me donner ses coordonnées.

## Reste en attente / non résolu
1. **Médiateur de la consommation** — action Garry (voir ci-dessus)
2. **Bug Schoolmaker** — toujours en attente de leur support (erreur 500 config prix "Lance ton activité")
3. **Déploiement** — rien de tout ça n'est encore vérifié en production réelle par Garry après déploiement Samuel
4. **Podcast Bamboo "CPF si éligible"** — mentionné au conditionnel par le chatbot sur la page "Lance ton activité", pas encore tranché si à retirer

## Notes techniques importantes
- `DEVELOPPEUR.md` et `_dev-tools/` existent à la racine du repo (doc technique complète + scripts réutilisables), faits lors d'une session précédente — toujours à jour normalement
- Widget Bamboo : présent sur 10 pages, très fragile aux extractions CSS en masse (regex mal faite peut le corrompre — toujours exclure `<script>` avant de chercher des `<style>`)
- Outil de rendu de test (wkhtmltoimage) a des limites connues : CSS Grid, flexbox complexe, et parfois `vw`/`clamp()` ne rendent pas fidèlement — toujours vérifier avec des valeurs fixes en px si un rendu semble incohérent

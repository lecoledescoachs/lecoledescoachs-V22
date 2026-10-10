/*! Carte-itinéraire des pages villes · L'École des Coachs
    Données : /assets/data/ville-carte.json (contour, Loire, villes) · Style : /assets/css/ville-route.css */
(function () {
  'use strict';
  var doc = document;

  /* 1) Pas de rangée de cases vides tant qu'aucune photo n'a été ajoutée */
  var bars = doc.querySelectorAll('.ville-photos-bar');
  for (var b = 0; b < bars.length; b++) { if (!bars[b].querySelector('img')) bars[b].hidden = true; }

  var card = doc.getElementById('vr-card');
  if (!card) return;
  var mapEl = card.querySelector('.vr-map');
  var slug = card.getAttribute('data-slug');
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var NS = 'http://www.w3.org/2000/svg';
  var MODES = null;

  function fmt(min) {
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? (m < 10 ? '0' + m : '' + m) : '');
  }
  function tierColor(d) { return d < 15 ? '#4ade80' : d < 40 ? '#fbbf24' : d < 90 ? '#fb923c' : '#f87171'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function num(v) { return (Math.round(v * 100) / 100).toString(); }

  /* 2) Temps de trajet qui se compte jusqu'à sa valeur */
  function countUp() {
    var el = card.querySelector('.vr-time-num[data-min]');
    if (!el || reduce) return;
    var target = parseInt(el.getAttribute('data-min'), 10), finalTxt = el.textContent;
    if (!target) return;
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / 1300, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(Math.round(target * e)) : finalTxt;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* 3) Déclenchement à l'arrivée de la carte à l'écran */
  var revealed = false;
  function reveal() { if (revealed) return; revealed = true; card.classList.add('is-in'); countUp(); }
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) { if (entries[i].isIntersecting) { reveal(); io.disconnect(); break; } }
    }, { threshold: 0.25 });
    io.observe(card);
  } else { reveal(); }

  if (!mapEl || !slug) return;


  /* ───────── Séquences animées du hero : trajet simple, puis toutes nos différences (base : page d'accueil) ───────── */
  /* Critères repris du tableau comparatif de la page d'accueil. [libellé, nous, autres organismes] ; aucun critère de prix. */
  var CMP = [
    { k: 'Un cursus complet', d: 5000, rows: [
        ['Accompagnement individuel', '✓', '✗'], ['Formation entrepreneuriat incluse', '✓', '✗'], ['Module intelligence artificielle', '✓', '✗'],
        ['Initiation Pilates et boxe appliquée', '✓', '✗'], ['Coaching en extérieur (parcs, espaces urbains)', '✓', '✗']], f: 'all' },
    { k: 'Un parcours sans attendre', d: 5000, rows: [
        ['Formation en 14 semaines', '✓', 'de 4 à 6 mois'], ['3 rentrées par an', '✓', 'souvent 1 seule'], ['Prépa TEP intégrée', '✓', 'selon les organismes'],
        ['Garantie de réussite Prépa TEP', '✓', '✗'], ['Barème officiel des TEP publié', '✓', '✗']], f: 'wait' },
    { k: 'Transparence et réseau', d: 5600, rows: [
        ['Équipe pédagogique visible', '✓', '✗'], ['Indicateurs de résultats publiés', '✓', 'oui (obligatoire)'], ['Réseau d\u2019employeurs (GA Coachs, Basic-Fit…)', '✓', 'variable'],
        ['Place offerte au FITEX à chaque promo', '✓', '✗'], ['Podcast, série documentaire et blog gratuits', '✓', 'rare'], ['Note Google', '5,0/5', 'variable']], f: null }
  ];
  var LIEUX = [['cenabum', 'CrossFit Cenabum', 'Olivet'], ['topfitness', 'Top Fitness', 'Saint-Jean-de-Braye'], ['omypilates', 'OMY Pilates', 'Orléans'], ['charlemagne', 'Île Charlemagne', 'Orléans'], ['poutyl', 'Parc du Poutyl', 'Orléans']];

  function story(inf, me, col) {
    card.style.setProperty('--vr-accent', col);
    var name = me.name, approx = inf.st !== 'v', local = inf.k === 'o', far = inf.cm >= 75;
    var pre = approx ? '≈\u00a0' : '';
    var sc = [];

    /* 1. Le trajet, simplement */
    var big = '';
    if (local) big = '<div class="vr-big"><span class="vr-num vr-num-t">Sur place</span></div><p class="vr-sc-s">Le centre de formation est tout près de chez toi.</p>';
    else {
      big += '<div class="vr-big">' + (inf.km ? '<span class="vr-num" data-km="' + inf.km + '">0\u00a0km</span>' : '') +
        '<span class="vr-num vr-num-t" data-min="' + inf.cm + '" data-pre="' + pre + '">0 min</span></div>';
      big += '<p class="vr-sc-s">' + (inf.rd ? 'en voiture, par ' + esc(inf.rd) : 'en voiture') + (approx && inf.km ? ' · distance estimée' : '') + '</p>';
    }
    sc.push({ k: 'dist', d: 3600, h: '<p class="vr-sc-k">' + esc(name) + ' <span aria-hidden="true">→</span> Olivet</p>' + big });

    /* 2. Comment venir */
    if (!local) {
      var maxm = Math.max(inf.cm || 0, (inf.tr && inf.tr.m) || 0, 1), rh = '';
      var rows = [{ ic: '🚗', w: Math.max(8, 100 * inf.cm / maxm), v: pre + (inf.car || hm(inf.cm)), s: inf.rd ? 'par ' + inf.rd : '' }];
      if (inf.tr) rows.push({ ic: '🚂', w: inf.tr.m ? Math.max(8, 100 * inf.tr.m / maxm) : 0, v: inf.tr.m ? hm(inf.tr.m) : 'TER', s: inf.tr.l, corr: inf.tr.d === 0 });
      for (var r = 0; r < rows.length; r++) {
        var R = rows[r];
        rh += '<div class="vr-row' + (R.corr ? ' is-corr' : '') + '" style="--i:' + r + '"><span class="vr-ic" aria-hidden="true">' + R.ic + '</span>' +
          (R.w ? '<span class="vr-track"><i class="vr-bar" style="--w:' + R.w.toFixed(0) + '%"></i></span>' : '<span class="vr-track vr-track-0"></span>') +
          '<span class="vr-val">' + esc(R.v) + '</span></div><p class="vr-rs" style="--i:' + r + '">' + esc(R.s) + '</p>';
      }
      var chips = '<span class="vr-chip">👥 Groupe WhatsApp de covoiturage dès l\u2019inscription</span>' + (inf.bus ? '<span class="vr-chip">🚌 ' + esc(inf.bus) + '</span>' : '');
      sc.push({ k: 'modes', d: 4400, h: '<p class="vr-sc-k">Comment venir</p>' + rh + '<div class="vr-chips">' + chips + '</div>' + (approx ? '<p class="vr-note">Temps indicatifs, hors trafic.</p>' : '') });
    }

    /* 3. Ton rythme */
    var wk = '';
    for (var w = 0; w < 14; w++) wk += '<i class="vr-wk' + ((w <= 1 || (w >= 5 && w <= 6) || w >= 12) ? ' is-on' : '') + '" style="--i:' + w + '"></i>';
    sc.push({ k: 'rythme', d: 3800, h: '<p class="vr-sc-k">Ton rythme</p><div class="vr-weeks" aria-hidden="true">' + wk + '</div>' +
      '<div class="vr-big"><span class="vr-num" data-n="25">0</span><span class="vr-sc-u">jours sur place<br>en 14 semaines</span></div>' +
      '<p class="vr-sc-s">70\u00a0% en présentiel, 30\u00a0% en ligne, à ton rythme. Le reste du temps, tu restes' + (local ? ' chez toi' : ' ' + at(name)) + '.</p>' });

    /* 4 à 6. Toutes nos différences (tableau comparatif de la page d'accueil) */
    var foot = { all: 'Tout est inclus' + (local ? '.' : ', que tu viennes de ' + esc(name) + ' ou d\u2019ailleurs.'), wait: local ? 'Pas besoin d\u2019attendre un an pour te lancer.' : 'Depuis ' + esc(name) + ', tu n\u2019attends pas un an pour te lancer.' };
    for (var m = 0; m < CMP.length; m++) {
      var G = CMP[m], ch = '<div class="vr-cmp"><div class="vr-cmp-h"><span></span><span>Nous</span><span>Autres*</span></div>';
      for (var q = 0; q < G.rows.length; q++)
        ch += '<div class="vr-cr" style="--i:' + q + '"><span class="vr-cl">' + esc(G.rows[q][0]) + '</span><span class="vr-co"><b>' + esc(G.rows[q][1]) + '</b></span><span class="vr-cx">' + esc(G.rows[q][2]) + '</span></div>';
      ch += '</div>' + (G.f ? '<p class="vr-sc-s vr-fl">' + foot[G.f] + '</p>' : '') + '<p class="vr-note">*Les prestations varient selon les organismes.</p>';
      sc.push({ k: 'cmp', d: G.d, h: '<p class="vr-sc-k">' + esc(G.k) + '</p>' + ch });
    }

    /* 7. De vrais lieux */
    var lh = '';
    for (var l = 0; l < LIEUX.length; l++)
      lh += '<figure class="vr-ph" style="--i:' + l + '"><img src="/assets/lieux/' + LIEUX[l][0] + '-1-480.webp" alt="" loading="lazy" decoding="async" width="160" height="120"><figcaption>' + LIEUX[l][1] + '</figcaption></figure>';
    sc.push({ k: 'lieux', d: 4400, h: '<p class="vr-sc-k">De vrais lieux</p><div class="vr-photos">' + lh + '</div><p class="vr-sc-s vr-fl">Box de CrossFit, salle de sport, studio Pilates, espaces extérieurs : pas une salle de classe.</p>' });

    /* 8. Les avantages de venir chez nous, personnalisés */
    var adv = [];
    if (local) adv = ['Le centre de formation est tout près de chez toi', 'Groupes de 25 élèves maximum, accompagnement personnalisé', 'Ton stage de 210\u00a0h près de chez toi', 'Gare SNCF au centre d\u2019Orléans, tram, parkings gratuits à proximité', 'Réponse sous 24\u00a0h à ta demande de dossier'];
    else adv = ['Tu restes ' + at(name) + ' : 8 jours de cours par mois', 'Ton stage de 210\u00a0h près de chez toi',
                'Un groupe de covoiturage avec les élèves de ta région',
                far ? 'Logement : appart-hôtels, Airbnb, colocations, on t\u2019aide à trouver' : 'Aller-retour à la journée possible depuis ' + esc(name),
                'Orléans : gare SNCF au centre, tram, parkings gratuits à proximité', 'Réponse sous 24\u00a0h à ta demande de dossier'];
    var ah = '';
    for (var a2 = 0; a2 < adv.length; a2++) ah += '<li style="--i:' + a2 + '"><span class="vr-ck" aria-hidden="true"></span>' + adv[a2] + '</li>';
    sc.push({ k: 'why', d: 5800, h: '<p class="vr-sc-k">Les avantages de venir chez nous</p><ul class="vr-why">' + ah + '</ul>' });

    /* DOM */
    var panel = doc.createElement('div'); panel.className = 'vr-panel';
    var prog = '<div class="vr-prog" role="tablist" aria-label="Séquences">', scenes = '<div class="vr-scenes">';
    for (var s = 0; s < sc.length; s++) {
      prog += '<button class="vr-seg" role="tab" aria-label="Séquence ' + (s + 1) + ' sur ' + sc.length + '"><i></i></button>';
      scenes += '<section class="vr-sc" data-k="' + sc[s].k + '" aria-hidden="true">' + sc[s].h + '</section>';
    }
    panel.innerHTML = prog + '</div>' + scenes + '</div>';
    card.insertBefore(panel, card.querySelector('.vr-body'));
    var segs = panel.querySelectorAll('.vr-seg'), els = panel.querySelectorAll('.vr-sc');
    var cur = -1, timer = null, started = 0, remain = 0, running = false, inView = false, hold = false;
    var scenesEl = panel.querySelector('.vr-scenes');

    /* Hauteur du cadre = séquence la plus haute (mesurée sur la mise en page, donc sans effet des animations) */
    function fit() {
      var mx = 0;
      for (var a = 0; a < els.length; a++) {
        var kids = els[a].children;
        for (var k = 0; k < kids.length; k++) { var bt = kids[k].offsetTop + kids[k].offsetHeight; if (bt > mx) mx = bt; }
      }
      if (mx) scenesEl.style.minHeight = (mx + 8) + 'px';
    }
    fit();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
    var rz = null; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(fit, 150); });

    function counters(el) {
      var list = el.querySelectorAll('[data-km],[data-min],[data-n]');
      for (var i = 0; i < list.length; i++) (function (n) {
        var to = parseFloat(n.getAttribute('data-km') || n.getAttribute('data-min') || n.getAttribute('data-n')), isKm = n.hasAttribute('data-km'), isMin = n.hasAttribute('data-min'), pr = n.getAttribute('data-pre') || '';
        function put(v) { n.textContent = isKm ? v + '\u00a0km' : isMin ? pr + hm(v) : v; }
        if (reduce) { put(Math.round(to)); return; }
        var t0 = null;
        function step(t) { if (t0 === null) t0 = t; var p = Math.min((t - t0) / 1100, 1), e = 1 - Math.pow(1 - p, 3); put(Math.round(to * e)); if (p < 1) requestAnimationFrame(step); }
        requestAnimationFrame(step);
      })(list[i]);
    }
    function show(i) {
      cur = (i + sc.length) % sc.length;
      for (var k = 0; k < els.length; k++) {
        els[k].classList.toggle('is-on', k === cur); els[k].setAttribute('aria-hidden', k === cur ? 'false' : 'true');
        segs[k].classList.remove('is-on'); segs[k].classList.toggle('is-done', k < cur); segs[k].setAttribute('aria-selected', k === cur ? 'true' : 'false');
      }
      void segs[cur].offsetWidth; segs[cur].style.setProperty('--d', sc[cur].d + 'ms'); segs[cur].classList.add('is-on');
      counters(els[cur]);
      remain = sc[cur].d; arm();
    }
    function arm() { clearTimeout(timer); if (reduce || !running) return; started = Date.now(); timer = setTimeout(function () { show(cur + 1); }, remain); }
    function setRun(on) {
      if (on === running) return; running = on;
      card.classList.toggle('is-paused', !on);
      if (on) arm(); else { clearTimeout(timer); remain = Math.max(250, remain - (Date.now() - started)); }
    }
    function update() { setRun(inView && !hold && !doc.hidden && !reduce); }
    for (var g = 0; g < segs.length; g++) (function (n) { segs[n].addEventListener('click', function () { show(n); }); })(g);
    card.addEventListener('mouseenter', function () { hold = true; update(); }); card.addEventListener('mouseleave', function () { hold = false; update(); });
    card.addEventListener('focusin', function () { hold = true; update(); }); card.addEventListener('focusout', function () { hold = false; update(); });
    card.addEventListener('touchstart', function () { hold = true; update(); }, { passive: true });
    card.addEventListener('touchend', function () { setTimeout(function () { hold = false; update(); }, 1200); }, { passive: true });
    doc.addEventListener('visibilitychange', update);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; update(); }, { threshold: 0.35 }).observe(card);
    } else { inView = true; }
    running = false; show(0); update();
    card.classList.add('is-story-ready');
  }
  function at(n) { n = esc(n); if (/^Le /.test(n)) return 'au ' + n.slice(3); if (/^Les /.test(n)) return 'aux ' + n.slice(4); return 'à ' + n; }
  function hm(m) { return fmt(m); }
  function r50(n) { return Math.round(n / 50) * 50; }

  /* 4) Construction de la carte */
  function build(D) {
    var O = D.olivet, me = null, i;
    for (i = 0; i < D.villes.length; i++) { if (D.villes[i][0] === slug) { me = { name: D.villes[i][1], x: D.villes[i][2], y: D.villes[i][3] }; break; } }
    if (!me) return;

    var info = MODES && MODES[slug];
    var storyOK = !!(info && !card.closest('.vr-inline'));
    if (storyOK) card.classList.add('vr-story');
    var W = mapEl.clientWidth || 340, H = mapEl.clientHeight || 270;
    var d = Math.hypot(me.x - O[0], me.y - O[1]);
    var local = d < 5;                                   /* Olivet, Orléans : aucun trajet */
    var vw, cx, cy;
    if (local) { vw = 30; cx = O[0]; cy = O[1]; }
    else {
      var dx = Math.abs(me.x - O[0]), dy = Math.abs(me.y - O[1]);
      vw = Math.max(dx * 1.8, dy * 1.8 * W / H, 40);
      cx = (me.x + O[0]) / 2; cy = (me.y + O[1]) / 2;
    }
    var vh = vw * H / W, x0 = cx - vw / 2, y0 = cy - vh / 2, s = W / vw;
    function px(v) { return v / s; }
    var col = local ? '#4ade80' : tierColor(d);

    var svg = '<svg xmlns="' + NS + '" viewBox="' + num(x0) + ' ' + num(y0) + ' ' + num(vw) + ' ' + num(vh) + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">';

    /* repères discrets (grille) */
    var step = vw > 80 ? 20 : 10, gx, gy;
    svg += '<g class="vr-grid">';
    for (gx = Math.ceil(x0 / step) * step; gx < x0 + vw; gx += step) svg += '<line x1="' + gx + '" y1="' + num(y0) + '" x2="' + gx + '" y2="' + num(y0 + vh) + '"/>';
    for (gy = Math.ceil(y0 / step) * step; gy < y0 + vh; gy += step) svg += '<line x1="' + num(x0) + '" y1="' + gy + '" x2="' + num(x0 + vw) + '" y2="' + gy + '"/>';
    svg += '</g>';

    /* terre + côte */
    var land = 'M' + D.france.map(function (p) { return p[0] + ',' + p[1]; }).join('L') + 'Z';
    svg += '<path class="vr-land" fill-rule="evenodd" d="' + land + '"/><path class="vr-coast" d="' + land + '"/>';

    /* Loire */
    var loire = 'M' + D.loire.map(function (p) { return p[0] + ',' + p[1]; }).join('L');
    svg += '<path class="vr-loire-glow" d="' + loire + '"/><path class="vr-loire" d="' + loire + '"/><path class="vr-loire-flow" d="' + loire + '"/>';

    /* villes voisines (cliquables) */
    var pad = vw * 0.02;
    for (i = 0; i < D.villes.length; i++) {
      var v = D.villes[i];
      if (v[0] === slug || v[0] === 'olivet') continue;
      if (v[2] < x0 + pad || v[2] > x0 + vw - pad || v[3] < y0 + pad || v[3] > y0 + vh - pad) continue;
      var delay = (0.35 + Math.hypot(v[2] - O[0], v[3] - O[1]) / 160 * 1.4).toFixed(2);
      var anchor = (v[2] - x0) > vw * 0.62 ? 'end' : 'start', tdx = anchor === 'end' ? -px(8) : px(8);
      svg += '<a class="vr-na" href="/cqp-if-' + esc(v[0]) + '" tabindex="-1"><title>' + esc(v[1]) + '</title>' +
        '<circle class="vr-n" style="animation-delay:' + delay + 's" cx="' + v[2] + '" cy="' + v[3] + '" r="' + num(px(2.8)) + '"/>' +
        '<circle class="vr-hit" cx="' + v[2] + '" cy="' + v[3] + '" r="' + num(px(10)) + '"/>' +
        '<text class="vr-tip" x="' + num(v[2] + tdx) + '" y="' + num(v[3] + px(4)) + '" text-anchor="' + anchor + '" font-size="' + num(px(11.5)) + '" stroke-width="' + num(px(3.2)) + '">' + esc(v[1]) + '</text></a>';
    }

    if (!local) {
      /* itinéraire courbe de la ville vers Olivet */
      var mx = (me.x + O[0]) / 2, my = (me.y + O[1]) / 2, nx = -(O[1] - me.y), ny = (O[0] - me.x), L = Math.hypot(nx, ny) || 1;
      var c1 = [mx + nx / L * d * 0.16, my + ny / L * d * 0.16], c2 = [mx - nx / L * d * 0.16, my - ny / L * d * 0.16];
      var c = c1[1] < c2[1] ? c1 : c2;
      var path = 'M' + me.x + ',' + me.y + ' Q' + num(c[0]) + ',' + num(c[1]) + ' ' + O[0] + ',' + O[1];
      svg += '<path class="vr-route-glow" stroke="' + col + '" d="' + path + '"/>';
      svg += '<path id="vr-route" class="vr-route" pathLength="1" stroke="' + col + '" d="' + path + '"/>';
      if (!reduce) {
        svg += '<circle class="vr-travel" r="' + num(px(4)) + '" fill="' + col + '"><animateMotion dur="3.2s" begin="2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#vr-route"/></animateMotion></circle>';
      }
      /* ville de départ */
      svg += '<g class="vr-me"><circle class="vr-pulse" cx="' + me.x + '" cy="' + me.y + '" r="' + num(px(5)) + '" stroke="' + col + '"/>' +
        '<circle class="vr-pulse p2" cx="' + me.x + '" cy="' + me.y + '" r="' + num(px(5)) + '" stroke="' + col + '"/>' +
        '<circle cx="' + me.x + '" cy="' + me.y + '" r="' + num(px(6.5)) + '" fill="' + col + '" stroke="var(--black-2)" stroke-width="' + num(px(2)) + '"/></g>';
      var topPos = (me.y - y0) > vh * 0.2;
      svg += '<text class="vr-label" x="' + me.x + '" y="' + num(me.y + (topPos ? -px(13) : px(22))) + '" text-anchor="middle" font-size="' + num(px(13.5)) + '" stroke-width="' + num(px(3.6)) + '">' + esc(me.name) + '</text>';
    }

    /* Olivet : le centre de formation */
    svg += '<g class="vr-o"><circle class="vr-pulse" cx="' + O[0] + '" cy="' + O[1] + '" r="' + num(px(6)) + '" stroke="var(--white)"/>' +
      '<circle class="vr-pulse p2" cx="' + O[0] + '" cy="' + O[1] + '" r="' + num(px(6)) + '" stroke="var(--white)"/>' +
      '<circle cx="' + O[0] + '" cy="' + O[1] + '" r="' + num(px(7.5)) + '" stroke="var(--black-2)" stroke-width="' + num(px(2)) + '"/></g>';
    var olabelBelow = local ? true : (O[1] - y0) < vh * 0.82;
    svg += '<text class="vr-label" x="' + O[0] + '" y="' + num(O[1] + (olabelBelow ? px(24) : -px(14))) + '" text-anchor="middle" font-size="' + num(px(13.5)) + '" stroke-width="' + num(px(3.6)) + '">' + (local ? 'Olivet · centre de formation' : 'Olivet') + '</text>';

    svg += '</svg>';
    mapEl.innerHTML = svg;
    if (storyOK) story(info, me, col);
  }

  function getJSON(u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  Promise.all([getJSON('/assets/data/ville-carte.json'), getJSON('/assets/data/ville-modes.json').catch(function () { return null; })])
    .then(function (res) { MODES = res[1]; build(res[0]); })
    .catch(function () { /* la carte est un plus : le texte de la fiche reste affiché */ });
})();

/* Frise "Exemple de parcours" : animation à l'entrée dans l'écran (le contenu reste visible sans JS). */
(function () {
  var w = document.querySelector('.pc-wrap');
  if (!w) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  w.classList.add('pc-anim');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { w.classList.add('pc-in'); io.disconnect(); } });
  }, { threshold: 0.25 });
  io.observe(w);
  setTimeout(function () { w.classList.add('pc-in'); }, 4000);
})();

/* Effets de page : barre de progression et apparition des sections au défilement (contenu visible sans JS). */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Barre de progression de lecture */
  var bar = document.createElement('div');
  bar.className = 'sx-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var tick = false;
  function prog() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
    tick = false;
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(prog); } }, { passive: true });
  prog();
  if (reduce || !('IntersectionObserver' in window)) return;
  var secs = document.querySelectorAll('.v10-ess,.diff-wrap,.v10-local,.local-map-wrap,.need-wrap,.trust-wrap,.faq-section,.vr-band,.v10-explore,.chiffres-section');
  if (!secs.length) return;
  document.documentElement.classList.add('sx-js');
  secs.forEach(function (s) {
    s.classList.add('sx-sec');
    var cards = s.querySelectorAll('.le-card,.trust-card,.faq-item,.need-stat,.v10-chip');
    for (var i = 0; i < cards.length; i++) cards[i].style.setProperty('--i', i % 8);
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('sx-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  secs.forEach(function (s) { io.observe(s); });
  setTimeout(function () { secs.forEach(function (s) { s.classList.add('sx-in'); }); }, 6000);
})();

/* Mots soulignés : trait qui se dessine quand l'élément entre à l'écran. */
(function () {
  function wrap(el, re) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n, done = false;
    while ((n = w.nextNode()) && !done) {
      var m = re ? re.exec(n.nodeValue) : { index: 0, 0: n.nodeValue };
      if (!m || !m[0].trim()) continue;
      var r = document.createRange();
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      var s = document.createElement('span'); s.className = 'u-draw';
      r.surroundContents(s); done = true;
    }
    return done;
  }
  var targets = [];
  document.querySelectorAll('.v10-num').forEach(function (e) { if (wrap(e, null)) targets.push(e); });
  var cta = document.querySelector('.cta-final h2, .cta-section h2'); if (cta && wrap(cta, /nouveau métier|coach sportif/)) targets.push(cta);
  var end = document.querySelector('.pc-step.is-end .pc-what'); if (end && wrap(end, null)) targets.push(end);
  if (!('IntersectionObserver' in window) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    document.querySelectorAll('.u-draw').forEach(function (u) { u.classList.add('u-in'); }); return;
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.querySelectorAll('.u-draw').forEach(function (u, i) { setTimeout(function () { u.classList.add('u-in'); }, 350 + i * 120); });
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  targets.forEach(function (t) { io.observe(t); });
  setTimeout(function () { document.querySelectorAll('.u-draw').forEach(function (u) { u.classList.add('u-in'); }); }, 7000);
})();

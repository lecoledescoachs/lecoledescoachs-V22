/* Compteurs du bandeau « La France a besoin de coachs » : sans effet pour les visiteurs qui ont réduit les animations. */
(function () {
  'use strict';
  var wraps = [].slice.call(document.querySelectorAll('.need-wrap')); if (!wraps.length) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(v, dec, sep) { var s = dec ? v.toFixed(dec).replace('.', ',') : String(Math.round(v)); return sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') : s; }
  function run(w) {
    w.classList.add('need-in'); if (reduced) return;
    [].forEach.call(w.querySelectorAll('[data-to]'), function (el) {
      var to = parseFloat(el.getAttribute('data-to')), dec = parseInt(el.getAttribute('data-dec') || '0', 10), sep = el.getAttribute('data-sep') === '1', t0 = null, dur = 1700;
      function step(ts) { if (t0 === null) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e, dec, sep); if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to, dec, sep); }
      el.textContent = fmt(0, dec, sep); requestAnimationFrame(step);
    });
  }
  if (!('IntersectionObserver' in window)) { wraps.forEach(function (w) { w.classList.add('need-in'); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }); }, { threshold: .25 });
  wraps.forEach(function (w) { io.observe(w); });
})();

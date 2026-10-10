/* Effets des sections des pages villes : apparition en cascade au défilement, séparateurs animés.
   Sans JavaScript ou avec « réduire les animations », tout reste visible et statique. */
(function () {
  'use strict';
  var secs = [].slice.call(document.querySelectorAll('.trust-wrap,.diff-wrap,.local-enrich,.local-map-wrap,.v10-ess,.v10-local,.v10-explore'));
  if (!secs.length) return;
  var items = [].slice.call(document.querySelectorAll('.trust-wrap h2,.diff-wrap h2,.local-enrich h2,.local-map-wrap h2,.sx-eyebrow,.trust-intro,.le-sub,.trust-card,.le-card,.compare-table tbody tr,.lm-fig,.lm-legend,.compare-note,.diff-links,.trust-by,.v10-ess h2,.v10-local h2,.v10-explore h2,.v10-lead,.v10-tile,.v10-chip-h,.v10-chip,.v10-more,.v10-ess .geo-links'));
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) { secs.concat(items).forEach(function (e) { e.classList.add('fx-in', 'fx-done'); }); return; }
  function done(e) { e.addEventListener('transitionend', function h(ev) { if (ev.propertyName !== 'transform' && ev.propertyName !== 'opacity') return; e.classList.add('fx-done'); e.style.transitionDelay = ''; e.removeEventListener('transitionend', h); }); }
  var io = new IntersectionObserver(function (entries) {
    var k = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var e = en.target; io.unobserve(e);
      if (e.classList.contains('trust-wrap') || e.classList.contains('diff-wrap') || e.classList.contains('local-enrich') || e.classList.contains('local-map-wrap') || e.classList.contains('v10-ess') || e.classList.contains('v10-local') || e.classList.contains('v10-explore')) { e.classList.add('fx-in'); return; }
      e.style.transitionDelay = Math.min(k, 7) * 70 + 'ms'; k++; done(e); e.classList.add('fx-in');
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  secs.concat(items).forEach(function (e) { io.observe(e); });
})();

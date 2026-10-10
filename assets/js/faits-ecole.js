/* Chiffres qui changent (résultats aux TEP, prochain TEP) : un seul fichier à modifier, /assets/data/faits-ecole.json.
   Les pages affichent d'abord leur texte de repli, puis le remplacent par la valeur du fichier. */
(function () {
  'use strict';
  var els = document.querySelectorAll('[data-fait]');
  if (!els.length || !window.fetch) return;
  fetch('/assets/data/faits-ecole.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return;
    [].forEach.call(els, function (e) {
      var v = e.getAttribute('data-fait').split('.').reduce(function (o, k) { return o && o[k]; }, d);
      if (v !== null && v !== undefined && typeof v !== 'object') e.textContent = v;
    });
  }).catch(function () {});
})();

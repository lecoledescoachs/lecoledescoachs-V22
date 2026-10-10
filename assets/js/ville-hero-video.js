/* Hero vidéo des pages villes : ouverture « trajet » propre à la ville (7 s), puis boucle motion design de la home.
   La dernière image de l'ouverture est identique à la première image de la boucle : l'enchaînement est invisible.
   Ne joue que lorsque le hero est visible ; image fixe si « réduire les animations » ou « économie de données ». */
(function () {
  'use strict';
  var box = document.querySelector('.vh');
  if (!box) return;
  var intro = box.querySelector('.vh-intro'), loop = box.querySelector('.vh-loop'), pp = box.querySelector('.vh-pp');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;

  function still() {                                   // repli : l'affiche reste visible
    box.classList.remove('vh-anim', 'is-playing', 'is-loop'); box.classList.add('is-still');
    if (pp) pp.hidden = true;
    var s = box.querySelector('.vh-snd'); if (s) s.hidden = true;
  }
  if (reduce || saveData || !intro || !loop || typeof intro.play !== 'function') { still(); return; }

  intro.muted = true; loop.muted = true;
  var started = false, phase = 'intro', paused = false, inView = false, soundOn = false, unlockArmed = false;
  var wantSound = true; try { wantSound = localStorage.getItem('leco-son') !== 'off'; } catch (e) {}
  function savePref(on) { try { localStorage.setItem('leco-son', on ? 'on' : 'off'); } catch (e) {} }

  /* Son : les navigateurs interdisent la lecture automatique avec le son, la vidéo démarre donc muette
     et le visiteur active la musique d'un clic. */
  var SPK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
  var ICON_OFF = SPK + '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
  var ICON_ON = SPK + '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
  var snd = document.createElement('button');
  snd.type = 'button'; snd.className = 'vh-snd'; snd.setAttribute('aria-pressed', 'false'); snd.setAttribute('aria-label', 'Activer le son');
  snd.innerHTML = '<span class="vh-snd-ic">' + ICON_OFF + '</span><span class="vh-snd-t">Activer le son</span>';
  box.appendChild(snd);
  function setSound(on) {
    soundOn = on; intro.muted = loop.muted = !on; intro.volume = loop.volume = 0.9;
    snd.setAttribute('aria-pressed', on ? 'true' : 'false'); snd.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
    snd.querySelector('.vh-snd-ic').innerHTML = on ? ICON_ON : ICON_OFF;
    snd.querySelector('.vh-snd-t').textContent = on ? 'Son activé' : 'Activer le son';
    box.classList.toggle('is-sound', on);
  }
  snd.addEventListener('click', function () {
    setSound(!soundOn); wantSound = soundOn; savePref(soundOn);
    if (soundOn && paused) { paused = false; box.classList.remove('is-paused'); if (pp) { pp.setAttribute('aria-pressed', 'false'); pp.setAttribute('aria-label', 'Mettre la vidéo en pause'); } }
    if (!started) start();
    apply();
  });

  function current() { return phase === 'intro' ? intro : loop; }
  function armUnlock() {
    if (unlockArmed) return; unlockArmed = true;
    function unlock(e) {
      if (e && e.target && e.target.closest && e.target.closest('.vh-snd, .vh-pp')) return;   // le bouton son gère lui-même
      ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.removeEventListener(t, unlock, true); });
      if (wantSound && !soundOn) { setSound(true); if (started) play(current()); }
    }
    ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.addEventListener(t, unlock, true); });
  }
  function play(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function (err) {
      var n = err && err.name;
      if (n === 'AbortError') return;                                     // lecture interrompue par une autre : sans gravité
      if (n === 'NotAllowedError') {                                      // son refusé avant toute interaction : on lit sans le son
        if (!v.muted) { setSound(false); armUnlock(); }
        var p2 = v.play();
        if (p2 && p2.catch) p2.catch(function (e2) { if (e2 && e2.name === 'AbortError') return; if (!started || phase === 'intro') still(); });
        return;
      }
      if (!started || phase === 'intro') still();
    });
  }
  function apply() {
    if (!started) return;
    var v = current();
    if (paused || !inView || document.hidden) v.pause(); else play(v);
  }
  function start() {
    if (started) return; started = true;
    if (wantSound) setSound(true);
    intro.src = box.getAttribute('data-intro'); intro.load(); play(intro);
  }

  intro.addEventListener('playing', function () {
    box.classList.add('is-playing');
    if (!loop.getAttribute('src')) { loop.preload = 'auto'; loop.src = box.getAttribute('data-loop'); loop.load(); }
  });
  intro.addEventListener('ended', function () {
    phase = 'loop';
    function go() { loop.currentTime = 0; box.classList.add('is-loop'); apply(); }
    if (loop.readyState >= 2) go(); else loop.addEventListener('loadeddata', go, { once: true });
  });
  intro.addEventListener('error', still);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) start(); apply(); }, { threshold: 0.2 }).observe(box);
  } else { inView = true; start(); }
  document.addEventListener('visibilitychange', apply);

  if (pp) pp.addEventListener('click', function () {
    paused = !paused;
    pp.setAttribute('aria-pressed', paused ? 'true' : 'false');
    pp.setAttribute('aria-label', paused ? 'Lire la vidéo' : 'Mettre la vidéo en pause');
    box.classList.toggle('is-paused', paused);
    if (!started && !paused) start();
    apply();
  });
})();

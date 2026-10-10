/* Hero de la home : film motion design en boucle (16:9 sur ordinateur, 4:5 sur mobile).
   Démarre muet (règle des navigateurs), bouton « Activer le son », bouton pause, lecture seulement quand visible.
   Image fixe si « réduire les animations » ou « économie de données ». */
(function () {
  'use strict';
  var box = document.querySelector('.hf-media');
  if (!box) return;
  var v = box.querySelector('.hf-video');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  function still() { box.classList.remove('hf-anim', 'is-playing'); box.classList.add('is-still'); }
  if (reduce || saveData || !v || typeof v.play !== 'function') { still(); return; }

  var mob = window.matchMedia('(max-width: 760px)').matches;
  var src = mob ? box.getAttribute('data-mob') : box.getAttribute('data-desk');
  v.muted = true;
  var started = false, inView = false, paused = false, soundOn = false, unlockArmed = false;
  var wantSound = true; try { wantSound = localStorage.getItem('leco-son') !== 'off'; } catch (e) {}
  function savePref(on) { try { localStorage.setItem('leco-son', on ? 'on' : 'off'); } catch (e) {} }

  var SPK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
  var ICON_OFF = SPK + '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
  var ICON_ON = SPK + '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
  var snd = document.createElement('button');
  snd.type = 'button'; snd.className = 'hf-snd'; snd.setAttribute('aria-pressed', 'false'); snd.setAttribute('aria-label', 'Activer le son');
  snd.innerHTML = '<span class="hf-ic">' + ICON_OFF + '</span><span class="hf-t">Activer le son</span>';
  var pp = document.createElement('button');
  pp.type = 'button'; pp.className = 'hf-pp'; pp.setAttribute('aria-pressed', 'false'); pp.setAttribute('aria-label', 'Mettre la vidéo en pause');
  pp.innerHTML = '<span class="hf-ic-pause" aria-hidden="true"></span><span class="hf-ic-play" aria-hidden="true"></span>';
  box.appendChild(snd); box.appendChild(pp);

  function setSound(on) {
    soundOn = on; v.muted = !on; v.volume = 0.9;
    snd.setAttribute('aria-pressed', on ? 'true' : 'false'); snd.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
    snd.querySelector('.hf-ic').innerHTML = on ? ICON_ON : ICON_OFF; snd.querySelector('.hf-t').textContent = on ? 'Son activé' : 'Activer le son';
  }
  function armUnlock() {
    if (unlockArmed) return; unlockArmed = true;
    function unlock(e) {
      if (e && e.target && e.target.closest && e.target.closest('.hf-snd, .hf-pp')) return;
      ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.removeEventListener(t, unlock, true); });
      if (wantSound && !soundOn) { setSound(true); if (started && !paused) play(); }
    }
    ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.addEventListener(t, unlock, true); });
  }
  function play() {
    var p = v.play();
    if (p && p.catch) p.catch(function (err) {
      var n = err && err.name;
      if (n === 'AbortError') return;
      if (n === 'NotAllowedError') {
        if (!v.muted) { setSound(false); armUnlock(); }
        var p2 = v.play();
        if (p2 && p2.catch) p2.catch(function (e2) { if (e2 && e2.name === 'AbortError') return; if (!box.classList.contains('is-playing')) still(); });
        return;
      }
      if (!box.classList.contains('is-playing')) still();
    });
  }
  function apply() { if (!started) return; if (paused || !inView || document.hidden) v.pause(); else play(); }
  function start() { if (started) return; started = true; if (wantSound) setSound(true); v.src = src; v.load(); play(); }

  v.addEventListener('playing', function () { box.classList.add('is-playing'); });
  v.addEventListener('error', still);

  snd.addEventListener('click', function () {
    setSound(!soundOn); wantSound = soundOn; savePref(soundOn);
    if (soundOn && paused) { paused = false; box.classList.remove('is-paused'); pp.setAttribute('aria-pressed', 'false'); pp.setAttribute('aria-label', 'Mettre la vidéo en pause'); }
    if (!started) start();
    apply();
  });
  pp.addEventListener('click', function () {
    paused = !paused; box.classList.toggle('is-paused', paused);
    pp.setAttribute('aria-pressed', paused ? 'true' : 'false'); pp.setAttribute('aria-label', paused ? 'Lire la vidéo' : 'Mettre la vidéo en pause');
    if (!started && !paused) start();
    apply();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) start(); apply(); }, { threshold: 0.15 }).observe(box);
  } else { inView = true; start(); }
  document.addEventListener('visibilitychange', apply);
})();

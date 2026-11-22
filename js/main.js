/* ============================================================
   main.js — 启动、缩放与主循环
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;

  window.addEventListener('error', (e) => {
    if (PB && PB.showError) PB.showError(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (PB && PB.showError) PB.showError(e.reason || 'Unhandled promise rejection');
  });

  function boot() {
    try {
      const canvas = document.getElementById('game');
      if (canvas) canvas.focus();
      PB.Game.init();
      let last = performance.now();
      function loop(now) {
        const dt = (now - last) / 1000;
        last = now;
        try {
          PB.Game.frame(dt);
        } catch (err) {
          PB.showError(err);
          return;
        }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    } catch (err) {
      PB.showError(err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

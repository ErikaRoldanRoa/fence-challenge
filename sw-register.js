// Registers the site's service worker (sw.js at the site root) for the whole site, and looks for a new version on open,
// when the tab comes back and every 30 minutes. A new version takes over quietly; nothing to tap.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var s = document.currentScript, root = new URL('./', s && s.src ? s.src : location.href).href;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(root + 'sw.js', { scope: root }).then(function (reg) {
      var check = function () { reg.update().catch(function () {}); };
      document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(function () {});
  });
})();

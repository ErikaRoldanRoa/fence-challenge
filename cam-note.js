/* Camera controls: disabled for now, shown as a mixed-reality outreach teaser. */
(function () {
  "use strict";
  function apply() {
    var tip = (window.i18n ? i18n.t("cam.disabledTip") : "");
    var els = document.querySelectorAll(".board-camera-chip");
    for (var i = 0; i < els.length; i++) {
      els[i].setAttribute("title", tip);
      els[i].setAttribute("aria-disabled", "true");
    }
  }
  // Capture-phase blocker: stop the camera from opening, keep hover/title working.
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".board-camera-chip");
    if (t) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  if (document.readyState !== "loading") apply();
  else document.addEventListener("DOMContentLoaded", apply);
  document.addEventListener("fc-langchange", apply);
})();

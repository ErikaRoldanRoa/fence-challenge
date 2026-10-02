/* Fence Challenge · shared play controls.
 * An erase control ([data-arm]) acts on its second tap only: the first tap
 * arms it (it turns rose and its accessible name asks for the second tap),
 * and it disarms by itself, or on any other tap or Escape. The guard runs in
 * the capture phase, before the page's own click handlers. */
(function () {
  "use strict";
  var ARM_MS = 2600;
  var armed = null;
  var timer = 0;

  function name(el, on) {
    var key = on ? el.getAttribute("data-arm") : el.getAttribute("data-i18n-aria-label");
    if (key && window.i18n) el.setAttribute("aria-label", window.i18n.t(key));
  }
  function disarm() {
    if (!armed) return;
    armed.classList.remove("is-armed");
    name(armed, false);
    armed = null;
    window.clearTimeout(timer);
  }
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-arm]") : null;
    if (!el) { disarm(); return; }
    if (armed === el) { disarm(); return; } // second tap: the page acts
    disarm();
    e.preventDefault();
    e.stopImmediatePropagation();
    armed = el;
    el.classList.add("is-armed");
    name(el, true);
    timer = window.setTimeout(disarm, ARM_MS);
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") disarm(); });
  document.addEventListener("fc-langchange", disarm);
})();

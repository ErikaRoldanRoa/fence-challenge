/* math-chip: every [data-math="KEY"] chip opens one shared panel with the
 * strings of window.i18n named by data-math-title, data-math-body and
 * data-math-src (by default KEY.title, KEY.body and "m.sec"), the body split
 * into paragraphs on "\n", all filled with the {placeholders} of the chip's
 * data-math-vars (JSON).
 * A tap elsewhere, Escape or a second tap closes it. The panel
 * sits under the chip, or above it when there is no room. */
(function () {
  "use strict";
  var pop = null, open = null;
  function t(k, v) { return window.i18n ? window.i18n.t(k, v) : k; }
  function close() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (open) { open.setAttribute("aria-expanded", "false"); open.focus({ preventScroll: true }); }
    open = null;
  }
  function show(chip) {
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "math-pop";
      pop.setAttribute("role", "dialog");
      pop.hidden = true;
      document.body.appendChild(pop);
    }
    var k = chip.getAttribute("data-math"), vars = null;
    try { vars = JSON.parse(chip.getAttribute("data-math-vars") || "null"); } catch (e) { vars = null; }
    pop.innerHTML = "";
    var h = document.createElement("h2");
    h.textContent = t(chip.getAttribute("data-math-title") || k + ".title", vars);
    pop.appendChild(h);
    t(chip.getAttribute("data-math-body") || k + ".body", vars).split("\n").forEach(function (line) {
      var p = document.createElement("p");
      p.textContent = line;
      pop.appendChild(p);
    });
    var s = document.createElement("p");
    s.className = "math-src";
    s.textContent = t(chip.getAttribute("data-math-src") || "m.sec", vars);
    pop.appendChild(s);
    pop.setAttribute("aria-label", h.textContent);
    pop.hidden = false;
    var r = chip.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    var left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 10;
    if (top + hgt > window.innerHeight - 12) top = Math.max(12, r.top - hgt - 10);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    if (open) open.setAttribute("aria-expanded", "false");
    open = chip;
    chip.setAttribute("aria-expanded", "true");
  }
  document.addEventListener("click", function (e) {
    var chip = e.target.closest && e.target.closest(".math-chip");
    if (chip) {
      e.stopPropagation();
      if (open === chip) close(); else show(chip);
      return;
    }
    if (pop && !pop.hidden && !pop.contains(e.target)) close();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  document.addEventListener("fc-langchange", function () { if (open) show(open); });
  window.addEventListener("resize", close);
  window.mathChip = { close: close };
})();

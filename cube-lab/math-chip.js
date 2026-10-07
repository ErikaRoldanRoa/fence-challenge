/* math-chip: every [data-math="KEY"] chip opens one shared card, used by all
 * the 2026 labs.
 * Content: a lab may set window.mathChip.provide = function (chip) {...}
 * returning { title, lead, body, live, src, data } (strings; lead, body and
 * live may hold inline markup), or null to fall back to the strings of
 * window.i18n named by data-math-title, data-math-body and data-math-src
 * (by default KEY.title, KEY.body and "m.sec"), the body split into
 * paragraphs on "\n", all filled with the {placeholders} of the chip's
 * data-math-vars (JSON).
 * The card is modal: a light scrim covers the lab while it is open. On wide
 * screens it sits next to its chip; on narrow ones it is a sheet at the
 * bottom. The close button, Escape, a tap on the scrim or a second tap on
 * the chip closes it. Events "math-chip-open" / "math-chip-close" (detail:
 * the chip) let a lab follow. */
(function () {
  "use strict";
  var pop = null, scrim = null, open = null;
  var CLOSE = { fr: "Fermer", de: "Schließen", en: "Close" };
  function lang() { var l = (document.documentElement.lang || "en").slice(0, 2); return CLOSE[l] ? l : "en"; }
  function t(k, v) { return window.i18n ? window.i18n.t(k, v) : k; }
  function build() {
    scrim = document.createElement("div");
    scrim.className = "math-scrim";
    scrim.hidden = true;
    document.body.appendChild(scrim);
    pop = document.createElement("div");
    pop.className = "math-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.tabIndex = -1;
    pop.hidden = true;
    document.body.appendChild(pop);
  }
  function close(returnFocus) {
    if (!pop || pop.hidden) return;
    pop.hidden = true; scrim.hidden = true;
    var was = open; open = null;
    if (was) {
      was.setAttribute("aria-expanded", "false");
      if (returnFocus !== false && !was.hidden && was.offsetParent) was.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent("math-chip-close", { detail: was }));
    }
  }
  function place(chip) {
    var vw = window.innerWidth, vh = window.innerHeight;
    pop.classList.toggle("sheet", vw < 700);
    pop.style.left = pop.style.top = pop.style.bottom = "";
    if (vw < 700) return;
    var r = chip.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 12;
    if (top + h > vh - 12) top = r.top - h - 12;
    if (top < 12) top = Math.max(12, (vh - h) / 2);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function para(cls, html, isHtml) {
    var p = document.createElement(cls === "math-body" ? "div" : "p");
    p.className = cls;
    if (isHtml) p.innerHTML = html; else p.textContent = html;
    return p;
  }
  function render(chip) {
    var c = window.mathChip.provide ? window.mathChip.provide(chip) : null;
    pop.innerHTML = "";
    Object.keys(pop.dataset).forEach(function (k) { delete pop.dataset[k]; });
    var x = document.createElement("button");
    x.type = "button"; x.className = "math-close";
    x.setAttribute("aria-label", CLOSE[lang()]);
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    x.addEventListener("click", function () { close(); });
    pop.appendChild(x);
    var h = document.createElement("h2");
    if (c) {
      h.textContent = c.title || "";
      pop.appendChild(h);
      if (c.lead) pop.appendChild(para("math-lead", c.lead, true));
      if (c.body) pop.appendChild(para("math-body", c.body, true));
      if (c.live) pop.appendChild(para("math-live", c.live, true));
      if (c.src) pop.appendChild(para("math-src", c.src, false));
      if (c.data) Object.keys(c.data).forEach(function (k) { pop.dataset[k] = c.data[k]; });
    } else {
      var k = chip.getAttribute("data-math"), vars = null;
      try { vars = JSON.parse(chip.getAttribute("data-math-vars") || "null"); } catch (e) { vars = null; }
      h.textContent = t(chip.getAttribute("data-math-title") || k + ".title", vars);
      pop.appendChild(h);
      t(chip.getAttribute("data-math-body") || k + ".body", vars).split("\n").forEach(function (line) {
        pop.appendChild(para("math-p", line, false));
      });
      pop.appendChild(para("math-src", t(chip.getAttribute("data-math-src") || "m.sec", vars), false));
    }
    pop.setAttribute("aria-label", h.textContent);
  }
  function show(chip) {
    if (!pop) build();
    var was = open;
    if (was && was !== chip) { was.setAttribute("aria-expanded", "false"); document.dispatchEvent(new CustomEvent("math-chip-close", { detail: was })); }
    open = chip;
    render(chip);
    scrim.hidden = false; pop.hidden = false;
    place(chip);
    chip.setAttribute("aria-expanded", "true");
    pop.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("math-chip-open", { detail: chip }));
  }
  function refresh() { if (open && !pop.hidden) { render(open); place(open); } }
  document.addEventListener("click", function (e) {
    var chip = e.target.closest && e.target.closest(".math-chip");
    if (chip) {
      e.stopPropagation();
      e.preventDefault();
      if (open === chip) close(); else show(chip);
      return;
    }
    if (pop && !pop.hidden && e.target === scrim) { e.stopPropagation(); close(); }
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) { e.stopPropagation(); close(); } }, true);
  document.addEventListener("fc-langchange", function () { setTimeout(refresh, 0); });
  window.addEventListener("resize", function () { if (open) place(open); });
  window.mathChip = window.mathChip || {};
  window.mathChip.show = show;
  window.mathChip.close = close;
  window.mathChip.refresh = refresh;
  window.mathChip.isOpen = function () { return !!open; };
  window.mathChip.current = function () { return open; };
})();

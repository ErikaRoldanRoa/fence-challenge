/* math-chip: every [data-math="KEY"] chip opens one shared card, used by all
 * the 2026 labs.
 * Content: a lab may set window.mathChip.provide = function (chip) {...}
 * returning { title, lead, body, live, src, data } (strings; lead, body and
 * live may hold inline markup; srcHtml, kicker, where, math, excerpt, note and
 * action are optional too: a reference page uses them, see paper-ref.js), or null to fall back to the strings of
 * window.i18n named by data-math-title, data-math-body and data-math-src
 * (by default KEY.title, KEY.body and "m.sec"), the body split into
 * paragraphs on "\n", all filled with the {placeholders} of the chip's
 * data-math-vars (JSON).
 * The card is modal: a light scrim covers the lab while it is open, and Tab
 * goes round the card (and the language switch, which stays usable over the
 * scrim) without ever reaching the lab behind. On wide screens it sits next to
 * its chip; on narrow ones it is a sheet at the bottom. The close button (and
 * Back, on a page) stay in view while a long card scrolls. The close button,
 * Escape, a tap on the scrim or a second tap on the chip closes it. Events
 * "math-chip-open" / "math-chip-close" (detail: the chip) let a lab follow.
 * Pages: a reference opened from a pill is a page of this same card:
 * mathChip.push(fn) shows fn() (a content object like provide's) above the
 * card with a Back button (which gives the focus back to the control that opened the page), mathChip.back() returns, and mathChip.show(el, fn)
 * opens a card whose first page is fn(), anchored to el.
 * mathChip.refresh() says the content may have changed (a live line, a new size,
 * a new language): it rebuilds the page on show but replaces only the parts that
 * read differently, so that the focus, a hover bubble and a table scrolled
 * sideways stay where they are. */
(function () {
  "use strict";
  var pop = null, scrim = null, open = null;
  var pages = [], backTo = [], base = true, wantCol = "";   // pages above the card: their functions and the control that opened each; whether a card stands under them
  var CLOSE = { fr: "Fermer", de: "Schließen", en: "Close" };
  var BACK = { fr: "Retour", de: "Zurück", en: "Back" };
  var FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
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
    pages = []; backTo = []; base = true;
    if (was) {
      if (was !== document.body) was.setAttribute("aria-expanded", "false");
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
    if (!chip.getClientRects().length) { left = Math.max(12, (vw - w) / 2); top = Math.max(12, (vh - h) / 2); }   // its control is gone: the middle
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function para(cls, html, isHtml) {
    var p = document.createElement(cls === "math-body" ? "div" : "p");
    p.className = cls;
    if (isHtml) p.innerHTML = html; else p.textContent = html;
    return p;
  }
  // The title of the page that Back returns to, read now: in the language on show.
  function backTitle() {
    var n = pages.length, c = null;
    if (n > 1) c = pages[n - 2]();
    else if (base && window.mathChip.provide) c = window.mathChip.provide(open);
    if (c) return c.title || "";
    if (n > 1 || !base || !open) return "";
    var vars = null;
    try { vars = JSON.parse(open.getAttribute("data-math-vars") || "null"); } catch (e) { vars = null; }
    return t(open.getAttribute("data-math-title") || open.getAttribute("data-math") + ".title", vars);
  }
  // soft: build the card aside and replace only what reads differently (see merge); returns whether the data of the page was replaced.
  function render(chip, soft) {
    var host = soft ? document.createElement("div") : pop;
    if (!soft) pop.innerHTML = "";
    var c = pages.length ? pages[pages.length - 1]() : (window.mathChip.provide ? window.mathChip.provide(chip) : null);
    pop.classList.toggle("ref", pages.length > 0);
    Object.keys(pop.dataset).forEach(function (k) { delete pop.dataset[k]; });
    var hasBack = pages.length > 0 && (base || pages.length > 1);
    var top = document.createElement("div");
    top.className = "math-top" + (hasBack ? " with-back" : "");
    var x = document.createElement("button");
    x.type = "button"; x.className = "math-close";
    x.setAttribute("aria-label", CLOSE[lang()]);
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    x.addEventListener("click", function () { close(); });
    top.appendChild(x);
    if (hasBack) {
      var below = backTitle();
      var bk = document.createElement("button");
      bk.type = "button"; bk.className = "math-back";
      bk.setAttribute("aria-label", BACK[lang()] + (below ? ": " + below : ""));
      bk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var bt = document.createElement("span");
      bt.textContent = below || BACK[lang()];
      bk.appendChild(bt);
      bk.addEventListener("click", function () { back(); });
      top.appendChild(bk);
    }
    host.appendChild(top);
    var h = document.createElement("h2");
    if (c) {
      h.textContent = c.title || "";
      if (c.kicker) host.appendChild(para("math-kicker", c.kicker, false));
      host.appendChild(h);
      if (c.where) host.appendChild(para("math-where", c.where, true));
      if (c.lead) host.appendChild(para("math-lead", c.lead, true));
      if (c.math) host.appendChild(para("math-formula", c.math, true));
      if (c.excerpt) {
        var ex = document.createElement("div");
        ex.className = "math-excerpt";
        if (typeof c.excerpt === "string") ex.innerHTML = c.excerpt; else ex.appendChild(c.excerpt);
        host.appendChild(ex);
      }
      if (c.body) host.appendChild(para("math-body", c.body, true));
      if (c.live) host.appendChild(para("math-live", c.live, true));
      if (c.srcHtml) host.appendChild(para("math-src", c.srcHtml, true));
      else if (c.src) host.appendChild(para("math-src", c.src, false));
      if (c.note) host.appendChild(para("math-note", c.note, false));
      if (c.action) {
        var a = document.createElement("a");
        a.className = "math-open"; a.href = c.action.href; a.target = "_blank"; a.rel = "noopener";
        a.textContent = c.action.label;
        host.appendChild(a);
      }
      if (c.data) Object.keys(c.data).forEach(function (k) { pop.dataset[k] = c.data[k]; });
    } else {
      var k = chip.getAttribute("data-math"), vars = null;
      try { vars = JSON.parse(chip.getAttribute("data-math-vars") || "null"); } catch (e) { vars = null; }
      h.textContent = t(chip.getAttribute("data-math-title") || k + ".title", vars);
      host.appendChild(h);
      t(chip.getAttribute("data-math-body") || k + ".body", vars).split("\n").forEach(function (line) {
        host.appendChild(para("math-p", line, false));
      });
      // A chip may name the places in the paper it comes from (data-paper-label, the paper's labels): the footer is then
      // their pills, unless the chip says its own (data-math-src: "our argument, not in the paper").
      var where = window.PaperRef && chip.getAttribute("data-paper-label") && !chip.getAttribute("data-math-src") ? window.PaperRef.footer(chip.getAttribute("data-paper-label").split(/\s+/)) : "";
      if (where) host.appendChild(para("math-src", where, true));
      else host.appendChild(para("math-src", t(chip.getAttribute("data-math-src") || "m.sec", vars), false));
    }
    pop.setAttribute("aria-label", h.textContent);
    wantCol = c && c.focus ? c.focus : "";
    return soft ? merge(host) : true;
  }
  // What a part of the card reads, without what the page adds to it by itself: lab-tip.js moves a title to data-lab-tip and
  // points aria-describedby at its bubble while one shows.
  function sig(el) { return el.outerHTML.replace(/ (?:aria-describedby|title)="[^"]*"/g, ""); }
  // A soft refresh keeps every part of the card that reads the same, so that the focus, a hover bubble and a table scrolled
  // sideways stay where they are while a live line changes. Returns whether the data of the page (its excerpt) was replaced.
  function merge(host) {
    var old = Array.prototype.slice.call(pop.children), now = Array.prototype.slice.call(host.children), data = false;
    var fi = Array.prototype.indexOf.call(pop.querySelectorAll(FOCUSABLE), document.activeElement);
    if (old.length !== now.length) {
      pop.innerHTML = "";
      now.forEach(function (n) { pop.appendChild(n); });
      data = true;
    } else {
      now.forEach(function (n, i) {
        if (sig(old[i]) === sig(n)) return;
        var isData = old[i].classList.contains("math-excerpt"), was = isData ? old[i].querySelector(".ref-scroll") : null, sl = was ? was.scrollLeft : 0;
        if (isData) data = true;
        pop.replaceChild(n, old[i]);
        var box = isData ? n.querySelector(".ref-scroll") : null;
        if (box && sl > 0) box.scrollLeft = sl;
      });
    }
    if (fi >= 0 && !pop.contains(document.activeElement)) {
      var again = pop.querySelectorAll(FOCUSABLE)[fi];
      (again || pop).focus({ preventScroll: true });
    }
    return data;
  }
  // What the control that opened a page is about comes into view: its column of a table (a phone shows a table sideways),
  // and the row of the size on show (a phone on its side shows a short sheet).
  function reveal() {
    var ex = pop.querySelector(".math-excerpt");
    if (!ex) return;
    var el = wantCol ? ex.querySelector('[data-col="' + wantCol + '"]') : null, sc = ex.querySelector(".ref-scroll");
    if (el && sc) {
      // the column stands right beside the fixed first one, whole
      var first = ex.querySelector("th:first-child, td:first-child");
      sc.scrollLeft = Math.max(0, el.offsetLeft - (first && first !== el ? first.offsetWidth : 0));
    }
    var row = ex.querySelector("tr.on");
    if (row) {
      var r = row.getBoundingClientRect(), p = pop.getBoundingClientRect();
      if (r.bottom > p.bottom - 8) pop.scrollTop += r.bottom - p.bottom + 8;
      else if (r.top < p.top + 48) pop.scrollTop -= p.top + 48 - r.top;
    }
  }
  // Data wider than the card scrolls sideways: the card says so (.scrolls), for the hint a lab put in the excerpt.
  function flag() {
    var sc = pop.querySelector(".math-excerpt .ref-scroll");
    pop.classList.toggle("scrolls", !!sc && sc.scrollWidth > sc.clientWidth + 2);
  }
  // A page above the card, and back to the one under it.
  // from: the control of the page below that opened this one (a selector and its rank among those that match), where Back puts the focus.
  function push(fn, from) {
    if (!open || !pop || pop.hidden) return;
    backTo.push(from || null);
    pages.push(fn);
    render(open);
    pop.scrollTop = 0;
    place(open);
    flag();
    reveal();
    pop.focus({ preventScroll: true });
  }
  function back() {
    // Nothing to go back to from the first page of a card that opened on a page.
    if (!open || !pages.length || (!base && pages.length === 1)) return;
    pages.pop();
    var from = backTo.pop();
    render(open);
    pop.scrollTop = 0;
    place(open);
    var target = from ? pop.querySelectorAll(from.sel)[from.i] : null;
    flag();
    reveal();
    if (target) { target.focus({ preventScroll: true }); if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" }); }
    else pop.focus({ preventScroll: true });
  }
  function show(chip, pageFn) {
    if (!pop) build();
    var was = open;
    if (was && was !== chip) { if (was !== document.body) was.setAttribute("aria-expanded", "false"); document.dispatchEvent(new CustomEvent("math-chip-close", { detail: was })); }
    open = chip;
    pages = pageFn ? [pageFn] : []; backTo = []; base = !pageFn;
    render(chip);
    scrim.hidden = false; pop.hidden = false;
    place(chip);
    flag();
    reveal();
    if (chip !== document.body) chip.setAttribute("aria-expanded", "true");
    pop.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("math-chip-open", { detail: chip }));
  }
  function refresh() {
    if (!open || !pop || pop.hidden) return;
    // A card that opened from a chip stays with its chip; a page that opened from a token or a pill goes when that control has gone.
    if (open !== document.body && !open.classList.contains("math-chip") && !open.getClientRects().length) { close(false); return; }
    var data = render(open, true);
    place(open);
    flag();
    if (data) reveal();
  }
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

  // The card is modal: Tab and Shift+Tab go round the card and the language switch (which works over the scrim), never into the lab behind.
  function ring() {
    var inCard = Array.prototype.slice.call(pop.querySelectorAll(FOCUSABLE));
    var langs = Array.prototype.slice.call(document.querySelectorAll(".langSel button, .langSel [tabindex]:not([tabindex='-1'])"));
    return inCard.concat(langs).filter(function (el) { return !el.hidden && el.getClientRects().length > 0; });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !open || !pop || pop.hidden) return;
    var r = ring();
    e.preventDefault();
    if (!r.length) { pop.focus({ preventScroll: true }); return; }
    var i = r.indexOf(document.activeElement);
    r[i < 0 ? (e.shiftKey ? r.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + r.length) % r.length].focus();
  }, true);
  // Whatever else moves the focus out of the card (a script, a click through) brings it back.
  document.addEventListener("focusin", function (e) {
    if (!open || !pop || pop.hidden || pop.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".langSel")) return;
    pop.focus({ preventScroll: true });
  });
  document.addEventListener("fc-langchange", function () { setTimeout(refresh, 0); });
  window.addEventListener("resize", function () { if (open) { place(open); flag(); } });
  window.mathChip = window.mathChip || {};
  window.mathChip.show = show;
  window.mathChip.push = push;
  window.mathChip.back = back;
  window.mathChip.close = close;
  window.mathChip.refresh = refresh;
  window.mathChip.isOpen = function () { return !!open; };
  window.mathChip.current = function () { return open; };
})();

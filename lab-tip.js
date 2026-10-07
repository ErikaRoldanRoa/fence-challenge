/* Fence Challenge · lab-tip: one tooltip bubble for the labs.
 *
 * Every control that carries a title (or, failing that, an aria-label)
 * explains itself in a styled bubble: on hover after a short delay, on
 * keyboard focus, and on touch after a long press. The native title is
 * moved to data-lab-tip as soon as it appears (also when ../i18n.js writes
 * it again on a language change), so the browser's own tooltip never shows;
 * aria-label stays for screen readers. Controls marked aria-disabled="true"
 * still explain themselves, and their clicks are stopped here (unless the
 * control answers a refused click itself: data-disabled-click).
 * The bubble is one fixed element outside the layout: it never moves
 * anything and never takes a pointer event. */
(function () {
  "use strict";
  var HOVER_MS = 250, PRESS_MS = 450, AFTER_PRESS_MS = 1600, GAP = 10, EDGE = 8;
  var CONTROLS = "button, a[href], [role='link'], [role='button'], input, select, label[title], label[data-lab-tip], .chip, [data-lab-tip-on]";

  var tip = null, arrow = null, text = null, owner = null, timer = 0, hideTimer = 0, pressed = null, swallowClick = false;

  function build() {
    tip = document.createElement("div");
    tip.className = "lab-tip";
    tip.setAttribute("role", "tooltip");
    tip.id = "lab-tip";
    text = document.createElement("span");
    arrow = document.createElement("i");
    arrow.className = "lab-tip-arrow";
    tip.appendChild(text);
    tip.appendChild(arrow);
    document.body.appendChild(tip);
  }

  // Titles become data-lab-tip, wherever and whenever they appear.
  function adopt(el) {
    if (!el || el.nodeType !== 1 || !el.hasAttribute("title") || el.tagName === "TITLE") return;
    var t = el.getAttribute("title");
    if (t) el.setAttribute("data-lab-tip", t);
    el.removeAttribute("title");
  }
  function adoptAll(root) {
    if (root.nodeType === 1) adopt(root);
    var all = (root.querySelectorAll ? root.querySelectorAll("[title]") : []);
    for (var i = 0; i < all.length; i++) adopt(all[i]);
  }

  function tipText(el) {
    return el.getAttribute("data-lab-tip") || el.getAttribute("aria-label") || "";
  }

  function controlOf(node) {
    var el = node && node.closest ? node.closest(CONTROLS) : null;
    if (!el || el.closest(".lab-tip")) return null;
    if (el.tagName === "CANVAS") return null;
    // A slider explains itself through its label.
    if (el.tagName === "INPUT" && el.closest("label") && tipText(el.closest("label"))) el = el.closest("label");
    return tipText(el) ? el : null;
  }

  function place() {
    if (!owner) return;
    var r = owner.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    var cx = r.left + r.width / 2;
    var left = Math.max(EDGE, Math.min(vw - w - EDGE, cx - w / 2));
    var top = r.top - h - GAP, below = false;
    if (top < EDGE) { top = r.bottom + GAP; below = true; }
    if (top + h > vh - EDGE) top = Math.max(EDGE, vh - h - EDGE);
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
    tip.classList.toggle("below", below);
    arrow.style.left = Math.round(Math.max(12, Math.min(w - 12, cx - left))) + "px";
  }

  function show(el) {
    if (!tip) build();
    var t = tipText(el);
    if (!t) return;
    window.clearTimeout(hideTimer);
    owner = el;
    text.textContent = t;
    tip.classList.add("on");
    el.setAttribute("aria-describedby", (el.getAttribute("aria-describedby") || "").replace(/\blab-tip\b/, "").trim() + " lab-tip");
    place();
  }

  function hide() {
    window.clearTimeout(timer);
    if (!tip || !owner) return;
    var d = (owner.getAttribute("aria-describedby") || "").replace(/\blab-tip\b/, "").trim();
    if (d) owner.setAttribute("aria-describedby", d); else owner.removeAttribute("aria-describedby");
    owner = null;
    tip.classList.remove("on");
  }

  function later(el, ms) {
    window.clearTimeout(timer);
    timer = window.setTimeout(function () { show(el); }, ms);
  }

  // Mouse and pen: hover.
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType === "touch") return;
    var el = controlOf(e.target);
    if (el === owner) return;
    if (!el) { hide(); return; }
    hide();
    later(el, HOVER_MS);
  });
  document.addEventListener("pointerout", function (e) {
    if (e.pointerType === "touch") return;
    var el = controlOf(e.target), to = controlOf(e.relatedTarget);
    if (el && el !== to) { window.clearTimeout(timer); if (owner === el) hide(); }
  });

  // Touch: a long press explains; a tap stays a tap.
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") { hide(); return; }
    var el = controlOf(e.target);
    if (!el) { hide(); return; }
    pressed = { el: el, x: e.clientX, y: e.clientY, shown: false };
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      if (!pressed || pressed.el !== el) return;
      pressed.shown = true;
      show(el);
    }, PRESS_MS);
  }, true);
  document.addEventListener("pointermove", function (e) {
    if (pressed && Math.abs(e.clientX - pressed.x) + Math.abs(e.clientY - pressed.y) > 12) { window.clearTimeout(timer); pressed = null; }
  }, true);
  function release() {
    window.clearTimeout(timer);
    if (pressed && pressed.shown) {
      // The press was for the explanation: no click follows it.
      swallowClick = true;
      window.setTimeout(function () { swallowClick = false; }, 400);
      hideTimer = window.setTimeout(hide, AFTER_PRESS_MS);
    }
    pressed = null;
  }
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
  // No callout menu on a long press.
  document.addEventListener("contextmenu", function (e) { if (controlOf(e.target)) e.preventDefault(); }, true);

  // Keyboard: focus explains at once.
  document.addEventListener("focusin", function (e) {
    var el = controlOf(e.target);
    if (!el) { hide(); return; }
    var kb = true;
    try { kb = e.target.matches(":focus-visible"); } catch (err) { kb = true; }
    if (kb) show(el);
  });
  document.addEventListener("focusout", function () { hide(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });

  // Clicks: none after a long press, none on a control marked disabled.
  document.addEventListener("click", function (e) {
    if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
    var off = e.target && e.target.closest ? e.target.closest("[aria-disabled='true']:not([data-disabled-click])") : null;
    if (off) { e.preventDefault(); e.stopImmediatePropagation(); }
    hide();
  }, true);
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.closest && e.target.closest("[aria-disabled='true']:not([data-disabled-click])")) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);

  // A new language: the titles come back from ../i18n.js and are adopted
  // again; the bubble on screen says the same thing in the new language.
  document.addEventListener("fc-langchange", function () {
    adoptAll(document.body);
    if (owner) { text.textContent = tipText(owner); place(); }
  });

  function start() {
    adoptAll(document.body);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "attributes") adopt(m.target);
        else m.addedNodes.forEach(function (n) { if (n.nodeType === 1) adoptAll(n); });
      });
      if (owner && !document.body.contains(owner)) hide();
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.labTip = { show: show, hide: hide };
})();

/* Fence Challenge · shared play controls.
 * Arrow keys (window.FencePlay): the cells a piece's reference cell may move
 * to for one arrow, nearest first; a cell counts when its direction from the
 * current one is within 60 degrees of the arrow's. trayDrag follows a
 * press on a piece chip: once it has moved and is over the board, over(e)
 * runs on each move; done() runs on release after such a drag. placeBar
 * lays the board group under the drawn board on wide screens.
 * An erase control ([data-arm]) acts on its second tap only: the first tap
 * arms it (it turns rose and its accessible name asks for the second tap),
 * and it disarms by itself, or on any other tap or Escape. The guard runs in
 * the capture phase, before the page's own click handlers.
 * The area pill (.measure) reaches into the free room under its strip:
 * --area-reach is the room left down to 8 px above the nearest control,
 * piece or board below the strip, at most REACH_MAX; its number grows with
 * it (--area-num), with room for three digits, keeping
 * 8 px from the controls beside the pill and 10 px from the screen's edge. */
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

(function () {
  "use strict";
  var ARROWS = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  };
  // The arrow of a key event meant for the board, or null: no modifier, and
  // focus on the page itself, the board or one of its piece chips.
  function arrowOf(e, board) {
    var dir = ARROWS[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey) return null;
    var a = document.activeElement;
    if (a && a !== document.body && a !== board && !(a.closest && a.closest(".piece-chip, .piece-btn"))) return null;
    return dir;
  }
  // entries: [{centroid:{x,y}, ...}], origin {x,y} in the same (y down) frame
  function towards(entries, origin, dir, accept) {
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var vx = e.centroid.x - origin.x, vy = e.centroid.y - origin.y;
      var len = Math.sqrt(vx * vx + vy * vy);
      if (len < 1e-6) continue;
      var along = (vx * dir.x + vy * dir.y) / len;
      if (along < 0.5 - 1e-6) continue;
      if (accept && !accept(e)) continue;
      out.push({ entry: e, len: len, along: along });
    }
    // nearest first; at the same distance (up to rounding), the straightest
    out.sort(function (a, b) { return Math.abs(a.len - b.len) > 1e-6 ? a.len - b.len : b.along - a.along; });
    return out.map(function (c) { return c.entry; });
  }
  function trayDrag(event, board, over, done) {
    if (event.button > 0) return;
    var d = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false, slop2: event.pointerType === "mouse" ? 36 : 100 };
    function move(e) {
      if (e.pointerId !== d.id) return;
      if (!d.active) {
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (dx * dx + dy * dy <= d.slop2) return;
        d.active = true;
      }
      var r = board.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      over(e);
    }
    function end(e) {
      if (e.pointerId !== d.id) return;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      if (d.active) {
        trayDrag.until = Date.now() + 500; // the click that may follow is not a tap
        done(e);
      }
    }
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  }
  trayDrag.until = 0;
  // true while the click after a tray drag arrives
  function afterTrayDrag() { return Date.now() < trayDrag.until; }
  // The outline of a piece: the edges of its cells (polygons, as lists of
  // {x, y}) that no other cell of the piece shares.
  function outerEdges(polys) {
    var seen = new Map();
    function key(p) { return Math.round(p.x * 1e4) + "," + Math.round(p.y * 1e4); }
    for (var c = 0; c < polys.length; c++) {
      var v = polys[c];
      for (var i = 0; i < v.length; i++) {
        var a = v[i], b = v[(i + 1) % v.length];
        var ka = key(a), kb = key(b);
        var k = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        if (seen.has(k)) seen.set(k, null);
        else seen.set(k, [a, b]);
      }
    }
    var out = [];
    seen.forEach(function (seg) { if (seg) out.push(seg); });
    return out;
  }
  // Wide screens: the board group (erase, the camera) laid right under the
  // drawn board and as wide as it, so the camera's right edge is the board's
  // (as in the square lab); the credit sits between erase and the camera,
  // never closer than 16 px to either: on one line when it fits, else on two
  // centred lines as wide as that room.
  // drawn: the board's drawing in viewport pixels {left, right, bottom}, or
  // null to leave both to the stylesheet (phones).
  var BAR_GAP = 8;
  var BRAND_CLEAR = 16;
  function placeBar(bar, brand, drawn) {
    if (!bar) return;
    bar.style.width = "";
    bar.style.transform = "";
    if (brand) {
      brand.style.transform = "";
      brand.style.maxWidth = "";
      brand.style.whiteSpace = "";
      brand.style.textAlign = "";
    }
    if (!drawn) return;
    bar.style.width = Math.round(drawn.right - drawn.left) + "px";
    var r = bar.getBoundingClientRect();
    var top = drawn.bottom + BAR_GAP;
    bar.style.transform = "translate(" + (drawn.left - r.left).toFixed(1) + "px, " + (top - r.top).toFixed(1) + "px)";
    if (brand) {
      var cx = (drawn.left + drawn.right) / 2;
      var half = Infinity;
      bar.querySelectorAll("button").forEach(function (el) {
        var c = el.getBoundingClientRect();
        if (c.width === 0) return;
        half = Math.min(half, c.left >= cx ? c.left - cx : cx - c.right);
      });
      var room = 2 * (half - BRAND_CLEAR);
      if (isFinite(room) && brand.getBoundingClientRect().width > room) {
        brand.style.whiteSpace = "normal";
        brand.style.textAlign = "center";
        brand.style.maxWidth = Math.max(44, Math.floor(room)) + "px";
      }
      var b = brand.getBoundingClientRect();
      var dx = cx - (b.left + b.right) / 2;
      var dy = top + r.height / 2 - (b.top + b.bottom) / 2;
      brand.style.transform = "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px)";
    }
  }
  window.FencePlay = { ARROWS: ARROWS, arrowOf: arrowOf, towards: towards, trayDrag: trayDrag, afterTrayDrag: afterTrayDrag, outerEdges: outerEdges, placeBar: placeBar };
})();

(function () {
  "use strict";
  var REACH_MAX = 14;
  var GAP = 8;
  var SIDE = 10;
  var NUM_BASE = 36;
  var NUM_GROW = 0.6;
  var NUM_MIN = 16;
  var OTHERS = "button, a[href], canvas, .piece-chip-ring, .piece-btn, .langSel";
  function fit() {
    var pill = document.querySelector(".measure");
    if (!pill || !pill.parentElement) return;
    var strip = pill.parentElement.getBoundingClientRect();
    var cs = window.getComputedStyle(pill.parentElement);
    var left = strip.left + parseFloat(cs.paddingLeft || "0") - GAP;
    var right = strip.right - parseFloat(cs.paddingRight || "0") + GAP;
    var room = REACH_MAX;
    var els = document.querySelectorAll(OTHERS);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (pill.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= left || r.left >= right || r.bottom <= strip.top) continue;
      room = Math.min(room, r.top - GAP - strip.bottom);
    }
    room = Math.max(0, Math.floor(room));
    pill.style.setProperty("--area-reach", room + "px");
    sizeNumber(pill, els, NUM_BASE + NUM_GROW * room);
  }
  function sizeNumber(pill, els, want) {
    var num = pill.querySelector(".area-num");
    if (!num) return;
    pill.style.setProperty("--area-num", want + "px");
    var pr = pill.getBoundingClientRect();
    var nr = num.getBoundingClientRect();
    var digit = nr.width / Math.max(1, num.textContent.length) / want;
    if (!(digit > 0)) return;
    var cx = (pr.left + pr.right) / 2;
    var lo = SIDE, hi = window.innerWidth - SIDE;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (pill.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom <= pr.top || r.top >= pr.bottom) continue;
      if ((r.left + r.right) / 2 < cx) lo = Math.max(lo, r.right + GAP);
      else hi = Math.min(hi, r.left - GAP);
    }
    var centred = window.getComputedStyle(pill.parentElement).justifyContent === "center";
    var width = centred ? 2 * Math.min(cx - lo, hi - cx) : hi - pr.left;
    var fits = (width - (pr.width - nr.width)) / (3 * digit);
    pill.style.setProperty("--area-num", Math.max(NUM_MIN, Math.min(want, Math.floor(fits))) + "px");
  }
  var queued = 0;
  function later() {
    if (queued) return;
    queued = window.requestAnimationFrame(function () { queued = 0; fit(); });
  }
  window.addEventListener("resize", later);
  window.addEventListener("orientationchange", later);
  window.addEventListener("load", later);
  document.addEventListener("fc-langchange", later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", later);
  else later();
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(later);
    ro.observe(document.documentElement);
    var watch = function () {
      var b = document.querySelector("#game-board, #board-canvas, #piece-tray");
      if (b) ro.observe(b);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
    else watch();
  }
})();

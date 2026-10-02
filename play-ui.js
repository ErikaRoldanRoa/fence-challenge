/* Fence Challenge · shared play controls.
 * Arrow keys (window.FencePlay): the cells a piece's reference cell may move
 * to for one arrow, nearest first; a cell counts when its direction from the
 * current one is within 60 degrees of the arrow's. trayDrag follows a
 * press on a piece chip: once it has moved and is over the board, over(e)
 * runs on each move; done() runs on release after such a drag.
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
  window.FencePlay = { ARROWS: ARROWS, arrowOf: arrowOf, towards: towards, trayDrag: trayDrag, afterTrayDrag: afterTrayDrag, outerEdges: outerEdges };
})();

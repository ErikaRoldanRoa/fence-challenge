/* Pentomino fence dynamic programming.
 * Coordinates are doubled: cell centres are even, grid vertices odd.
 * A "possibility" is one way a pentomino carries part of the inner boundary:
 * an incoming attachment edge, the boundary edges after it, and an outgoing
 * attachment edge. Shoelace sums are kept in doubled units (area = sum / 8). */
(function (root) {
  "use strict";

  var PENTOS = [
    ["F", [[0, 1], [1, 1], [1, 0], [1, 2], [2, 0]]],
    ["I", [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]],
    ["L", [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]]],
    ["N", [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]]],
    ["P", [[0, 0], [0, 1], [1, 0], [1, 1], [0, 2]]],
    ["T", [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]]],
    ["U", [[0, 0], [0, 1], [1, 0], [2, 0], [2, 1]]],
    ["V", [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]],
    ["W", [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]]],
    ["X", [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]],
    ["Y", [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]]],
    ["Z", [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]]]
  ];
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function normalize(P) {
    var mx = Infinity, my = Infinity;
    P.forEach(function (t) { mx = Math.min(mx, t[0]); my = Math.min(my, t[1]); });
    return P.map(function (t) { return [t[0] - mx, t[1] - my]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  }
  function rot(P) { return P.map(function (t) { return [-t[1], t[0]]; }); }
  function flip(P) { return P.map(function (t) { return [t[1], t[0]]; }); }
  function orientations(P) {
    var out = [], seen = {}, cur = P;
    for (var f = 0; f < 2; f++) {
      cur = f ? flip(P) : P;
      for (var r = 0; r < 4; r++) {
        var n = normalize(cur), k = JSON.stringify(n);
        if (!seen[k]) { seen[k] = 1; out.push(n); }
        cur = rot(cur);
      }
    }
    return out;
  }

  /* Clockwise boundary of a piece as a closed list of doubled vertices. */
  function boundary(tiles) {
    var inP = {}, succ = {};
    tiles.forEach(function (t) { inP[t[0] + "," + t[1]] = 1; });
    tiles.forEach(function (t) {
      DIRS.forEach(function (d) {
        if (inP[(t[0] + d[0]) + "," + (t[1] + d[1])]) return;
        var mx = 2 * t[0] + d[0], my = 2 * t[1] + d[1];
        var s = [mx - d[1], my + d[0]], e = [mx + d[1], my - d[0]];
        succ[s[0] + "," + s[1]] = e;
      });
    });
    var keys = Object.keys(succ).sort();
    var start = keys[0].split(",").map(Number), path = [start], cur = succ[keys[0]];
    while (cur[0] !== start[0] || cur[1] !== start[1]) { path.push(cur); cur = succ[cur[0] + "," + cur[1]]; }
    return path;
  }

  function dirIndex(dx, dy) { return dx === 0 ? (dy < 0 ? 0 : 2) : (dx > 0 ? 1 : 3); }

  /* POSS[piece][inOrient] = list of {o, a, dx, dy, piece, tiles, path} */
  function buildPossibilities() {
    var POSS = PENTOS.map(function () { return [[], [], [], []]; });
    PENTOS.forEach(function (pc, pi) {
      orientations(pc[1]).forEach(function (tiles) {
        var path = boundary(tiles), L = path.length, dbl = path.concat(path);
        for (var s = 0; s < L; s++) {
          for (var e = s + 1; e < s + L; e++) {
            var p1 = dbl[s], p2 = dbl[s + 1], p3 = dbl[e], p4 = dbl[e + 1];
            var inO = dirIndex(p2[0] - p1[0], p2[1] - p1[1]);
            var outO = dirIndex(p3[0] - p4[0], p3[1] - p4[1]);
            var inner = dbl.slice(s + 1, e + 1).map(function (q) { return [q[0] - p2[0], q[1] - p2[1]]; });
            var a = 0;
            for (var k = 0; k + 1 < inner.length; k++) a += inner[k][0] * inner[k + 1][1] - inner[k + 1][0] * inner[k][1];
            var last = inner[inner.length - 1];
            POSS[pi][inO].push({
              o: outO, a: a, dx: last[0], dy: last[1], piece: pi,
              tiles: tiles.map(function (t) { return [2 * t[0] - p2[0], 2 * t[1] - p2[1]]; }),
              path: inner
            });
          }
        }
      });
    });
    return POSS;
  }

  var POSS = buildPossibilities();
  var START = { x: 1, y: 1, o: 2 };
  var OFF = 1024, W = 2048;
  function key(x, y, o) { return ((x + OFF) * W + (y + OFF)) * 4 + o; }
  function unkey(k) { var o = k % 4, r = (k - o) / 4, y = r % W - OFF, x = (r - (y + OFF)) / W - OFF; return { x: x, y: y, o: o }; }

  /* Dynamic programming for a fixed order of the pieces.
   * layers[i]: Map key -> {v, preds: [{from, p}]}; every predecessor reaching
   * the best value v is kept, so the trace can avoid an overlapping one.
   * tried[i]: placements tried at step i. */
  function fixedOrder(order) {
    var s0 = key(START.x, START.y, START.o);
    var layers = [new Map([[s0, { v: 0, preds: [] }]])], tried = [0];
    for (var i = 0; i < order.length; i++) {
      var prev = layers[i], next = new Map(), lastStep = i === order.length - 1, n = 0;
      prev.forEach(function (st, k) {
        var s = unkey(k), list = POSS[order[i]][s.o];
        n += list.length;
        for (var j = 0; j < list.length; j++) {
          var q = list[j], nk = key(s.x + q.dx, s.y + q.dy, q.o);
          if (lastStep && nk !== s0) continue;
          var v = st.v + q.a + s.x * q.dy - s.y * q.dx;
          var cur = next.get(nk);
          if (!cur || v > cur.v) next.set(nk, { v: v, preds: [{ from: k, p: q }] });
          else if (v === cur.v) cur.preds.push({ from: k, p: q });
        }
      });
      layers.push(next);
      tried.push(n);
    }
    var end = layers[order.length].get(s0);
    return { layers: layers, tried: tried, best: end ? end.v / 8 : null, startKey: s0 };
  }

  function placement(st, pred) {
    var prev = unkey(pred.from);
    return { piece: pred.p.piece, at: prev, p: pred.p,
      cells: pred.p.tiles.map(function (t) { return [(t[0] + prev.x) / 2, (t[1] + prev.y) / 2]; }),
      path: pred.p.path.map(function (q) { return [q[0] + prev.x, q[1] + prev.y]; }) };
  }

  /* Back-pointer trace. Among the kept predecessors, search backwards for a
   * placement with no two pieces on the same cell whose enclosed area (flood
   * fill) equals the DP value. Returns {pieces, valid}; when no such trace is
   * found within the search budget, valid is false and pieces is the first
   * trace (then half of T_n is only an upper bound). */
  function trace(res, budget) {
    var n = res.layers.length - 1;
    if (res.best == null) return null;
    budget = budget || 200000;
    var steps = 0, first = null, found = null, occ = {}, stack = [];
    function walk(i, k) {
      if (found || steps > budget) return;
      steps++;
      if (i === 0) {
        var pieces = stack.slice().reverse();
        if (!first) first = pieces;
        var cells = [].concat.apply([], pieces.map(function (pc) { return pc.cells; }));
        if (enclosed(cells).area === res.best) found = pieces;
        return;
      }
      var st = res.layers[i].get(k);
      for (var j = 0; j < st.preds.length && !found; j++) {
        var pc = placement(st, st.preds[j]), clash = false;
        for (var c = 0; c < pc.cells.length; c++) if (occ[pc.cells[c][0] + "," + pc.cells[c][1]]) { clash = true; break; }
        if (clash) { if (!first) { stack.push(pc); firstOnly(i - 1, st.preds[j].from); stack.pop(); } continue; }
        pc.cells.forEach(function (q) { occ[q[0] + "," + q[1]] = 1; });
        stack.push(pc);
        walk(i - 1, st.preds[j].from);
        stack.pop();
        pc.cells.forEach(function (q) { delete occ[q[0] + "," + q[1]]; });
      }
    }
    // The first trace, overlaps allowed: kept for the honest fallback.
    function firstOnly(i, k) {
      if (i === 0) { first = stack.slice().reverse(); return; }
      var st = res.layers[i].get(k), pc = placement(st, st.preds[0]);
      stack.push(pc); firstOnly(i - 1, st.preds[0].from); stack.pop();
    }
    walk(n, res.startKey);
    if (!first) { stack.length = 0; firstOnly(n, res.startKey); }
    return found ? { pieces: found, valid: true } : { pieces: first, valid: false };
  }

  /* Area by flood fill: outside leaks through corners (8-connected free cells);
   * the area is the largest 4-connected... region of enclosed cells counted as cells. */
  function enclosed(cellsList) {
    var occ = {}, minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, overlap = false;
    cellsList.forEach(function (c) {
      var k = c[0] + "," + c[1];
      if (occ[k]) overlap = true;
      occ[k] = 1;
      minx = Math.min(minx, c[0]); maxx = Math.max(maxx, c[0]); miny = Math.min(miny, c[1]); maxy = Math.max(maxy, c[1]);
    });
    minx--; miny--; maxx++; maxy++;
    var seen = {}, stack = [[minx, miny]]; seen[minx + "," + miny] = 1;
    while (stack.length) {
      var c = stack.pop();
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        var x = c[0] + dx, y = c[1] + dy, k = x + "," + y;
        if (x < minx || x > maxx || y < miny || y > maxy || seen[k] || occ[k]) continue;
        seen[k] = 1; stack.push([x, y]);
      }
    }
    var inside = [], rem = {};
    for (var x = minx; x <= maxx; x++) for (var y = miny; y <= maxy; y++) {
      var k2 = x + "," + y; if (!seen[k2] && !occ[k2]) { rem[k2] = 1; }
    }
    var best = [];
    Object.keys(rem).forEach(function (k0) {
      if (!rem[k0]) return;
      var comp = [], st = [k0]; rem[k0] = 0;
      while (st.length) {
        var kk = st.pop(), xy = kk.split(",").map(Number); comp.push(xy);
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          var k3 = (xy[0] + dx) + "," + (xy[1] + dy);
          if (rem[k3]) { rem[k3] = 0; st.push(k3); }
        }
      }
      if (comp.length > best.length) best = comp;
    });
    return { area: best.length, cells: best, overlap: overlap };
  }

  var api = { PENTOS: PENTOS, POSS: POSS, START: START, key: key, unkey: unkey,
    fixedOrder: fixedOrder, trace: trace, enclosed: enclosed, orientations: orientations };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PentoDP = api;
})(typeof window !== "undefined" ? window : globalThis);

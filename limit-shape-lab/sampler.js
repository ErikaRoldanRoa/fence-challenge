/* Fence Challenge · limit-shape lab: random n-ominoes and their diameter vectors.
 *
 * Markov chain on fixed n-ominoes: remove a random cell, add a random cell of
 * the perimeter (the free cells next to the remaining ones), keep the move if
 * the cells stay edge-connected, stay put otherwise. Removing x and adding y
 * leave the same intermediate set as removing y and adding x, so the proposal
 * is symmetric and the chain, counted in proposals (a refused move is a step
 * that stays put), samples fixed n-ominoes uniformly. Counting accepted moves
 * only would weight each n-omino by how often its moves are accepted.
 * Burn-in: 16 n^2 proposals; then one sample every 8 n proposals (about 4 n^2
 * and 2 n accepted moves).
 *
 * Diameter vector: the longest vector between the midpoints of two boundary
 * edges. Midpoints are kept in doubled coordinates, so all arithmetic is in
 * integers; the vector itself always comes out integral.
 * Works in the browser (window.LimitSampler), in a worker (importScripts) and
 * in node (module.exports). */
(function (root) {
  "use strict";

  var OFF = 1 << 20, K = 1 << 21;
  function key(x, y) { return (x + OFF) * K + (y + OFF); }
  function kx(k) { return Math.floor(k / K) - OFF; }
  function ky(k) { return (k % K) - OFF; }
  var NB = [[1, 0], [0, -1], [-1, 0], [0, 1]];

  // A set with O(1) random choice.
  function Bag() { this.arr = []; this.pos = new Map(); }
  Bag.prototype.has = function (k) { return this.pos.has(k); };
  Bag.prototype.add = function (k) { if (!this.pos.has(k)) { this.pos.set(k, this.arr.length); this.arr.push(k); } };
  Bag.prototype.del = function (k) {
    var i = this.pos.get(k);
    if (i === undefined) return;
    var last = this.arr.pop();
    if (last !== k) { this.arr[i] = last; this.pos.set(last, i); }
    this.pos.delete(k);
  };
  Bag.prototype.pick = function (rand) { return this.arr[Math.floor(rand() * this.arr.length)]; };
  Object.defineProperty(Bag.prototype, "size", { get: function () { return this.arr.length; } });

  // Small, seedable generator (mulberry32).
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A straight bar of n cells and its perimeter.
  function Chain(n, seed) {
    this.n = n;
    this.rand = rng(seed == null ? 1 : seed);
    this.tiles = new Bag();
    this.perim = new Bag();
    this.accepted = 0;
    for (var i = 0; i < n; i++) this.tiles.add(key(i, 0));
    for (var j = 0; j < n; j++) {
      for (var d = 0; d < 4; d++) {
        var t = key(j + NB[d][0], NB[d][1]);
        if (!this.tiles.has(t)) this.perim.add(t);
      }
    }
  }

  // Are a and b joined by a path of tiles?
  Chain.prototype.joined = function (a, b) {
    if (a === b) return true;
    var tiles = this.tiles, seen = new Set([a]), q = [a], h = 0;
    while (h < q.length) {
      var c = q[h++], x = kx(c), y = ky(c);
      for (var d = 0; d < 4; d++) {
        var t = key(x + NB[d][0], y + NB[d][1]);
        if (t === b) return true;
        if (tiles.has(t) && !seen.has(t)) { seen.add(t); q.push(t); }
      }
    }
    return false;
  };

  // Restart from a given cell set (a sample from an earlier run).
  Chain.prototype.load = function (cells) {
    this.tiles = new Bag();
    this.perim = new Bag();
    for (var i = 0; i < cells.length; i++) this.tiles.add(key(cells[i][0], cells[i][1]));
    for (var j = 0; j < cells.length; j++) {
      for (var d = 0; d < 4; d++) {
        var t = key(cells[j][0] + NB[d][0], cells[j][1] + NB[d][1]);
        if (!this.tiles.has(t)) this.perim.add(t);
      }
    }
    this.n = cells.length;
  };

  // The 8 cells around (x, y), in order round the ring.
  var RING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  // Shortcut for the connectivity test: the tiles among the 8 cells around
  // the removed cell form one run round the ring (each step of the ring is an
  // edge contact), so the edge neighbours of the removed cell stay joined.
  // When it fails, the full search decides.
  Chain.prototype.locallyJoined = function (x, y) {
    var tiles = this.tiles, occ = [], i;
    for (i = 0; i < 8; i++) occ.push(tiles.has(key(x + RING[i][0], y + RING[i][1])));
    var runs = 0;
    for (i = 0; i < 8; i++) if (occ[i] && !occ[(i + 7) % 8]) runs++;
    if (runs === 0) return true;
    if (runs > 1) return false;
    // One run of consecutive ring cells joins every edge neighbour in it.
    return true;
  };

  function hasTileNeighbour(tiles, t) {
    var x = kx(t), y = ky(t);
    for (var d = 0; d < 4; d++) if (tiles.has(key(x + NB[d][0], y + NB[d][1]))) return true;
    return false;
  }

  // One proposal; returns true if it was accepted.
  Chain.prototype.step = function () {
    var tiles = this.tiles, perim = this.perim, rand = this.rand, d, t;
    var x = tiles.pick(rand), xx = kx(x), xy = ky(x);
    tiles.del(x);
    perim.add(x);
    var delPeri = [];
    for (d = 0; d < 4; d++) {
      t = key(xx + NB[d][0], xy + NB[d][1]);
      if (perim.has(t) && !hasTileNeighbour(tiles, t)) delPeri.push(t);
    }
    for (d = 0; d < delPeri.length; d++) perim.del(delPeri[d]);

    var y = perim.pick(rand), yx = kx(y), yy = ky(y);
    perim.del(y);
    tiles.add(y);
    var addPeri = [];
    for (d = 0; d < 4; d++) {
      t = key(yx + NB[d][0], yy + NB[d][1]);
      if (!tiles.has(t) && !perim.has(t)) addPeri.push(t);
    }
    for (d = 0; d < addPeri.length; d++) perim.add(addPeri[d]);

    var xn = [];
    for (d = 0; d < 4; d++) {
      t = key(xx + NB[d][0], xy + NB[d][1]);
      if (tiles.has(t)) xn.push(t);
    }
    var ok = true;
    if (xn.length > 1 && !this.locallyJoined(xx, xy)) {
      for (d = 0; d < xn.length; d++) {
        if (!this.joined(xn[d], xn[(d + 1) % xn.length])) { ok = false; break; }
      }
    }
    if (ok) { this.accepted++; return true; }

    tiles.del(y);
    for (d = 0; d < addPeri.length; d++) perim.del(addPeri[d]);
    perim.add(y);
    tiles.add(x);
    for (d = 0; d < delPeri.length; d++) perim.add(delPeri[d]);
    perim.del(x);
    return false;
  };

  // Advance by `count` proposals.
  Chain.prototype.advance = function (count) {
    for (var i = 0; i < count; i++) this.step();
  };

  Chain.prototype.cells = function () {
    return this.tiles.arr.map(function (k) { return [kx(k), ky(k)]; });
  };

  // ---------- geometry ----------

  // Boundary-edge midpoints of a cell set, in doubled coordinates.
  function midpoints2(cells) {
    var s = new Set(), out = [];
    for (var i = 0; i < cells.length; i++) s.add(key(cells[i][0], cells[i][1]));
    for (var j = 0; j < cells.length; j++) {
      var x = cells[j][0], y = cells[j][1];
      for (var d = 0; d < 4; d++) {
        if (!s.has(key(x + NB[d][0], y + NB[d][1]))) out.push([2 * x + NB[d][0], 2 * y + NB[d][1]]);
      }
    }
    return out;
  }

  // Convex hull (monotone chain); points on hull edges are dropped.
  function hull(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (p.length < 3) return p;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], hi = [], i;
    for (i = 0; i < p.length; i++) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop();
      lo.push(p[i]);
    }
    for (i = p.length - 1; i >= 0; i--) {
      while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p[i]) <= 0) hi.pop();
      hi.push(p[i]);
    }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }

  // Every pair of boundary-edge midpoints at maximal distance.
  // Returns { d2, pairs: [[p, q], ...] } in doubled coordinates, d2 doubled too.
  function diameters(cells) {
    var h = hull(midpoints2(cells)), best = -1, pairs = [];
    for (var i = 0; i < h.length; i++) {
      for (var j = i + 1; j < h.length; j++) {
        var dx = h[j][0] - h[i][0], dy = h[j][1] - h[i][1], d2 = dx * dx + dy * dy;
        if (d2 > best) { best = d2; pairs = [[h[i], h[j]]]; }
        else if (d2 === best) pairs.push([h[i], h[j]]);
      }
    }
    return { d2: best, pairs: pairs };
  }

  // Up to the 8 symmetries of the grid: x >= y >= 0.
  function normalize(v) {
    var a = Math.abs(v[0]), b = Math.abs(v[1]);
    return a >= b ? [a, b] : [b, a];
  }

  // The diameter vectors of one polyomino, normalized, each with weight 1/k
  // when k pairs tie for the longest distance.
  function sampleVectors(cells) {
    var dm = diameters(cells), w = 1 / dm.pairs.length;
    return dm.pairs.map(function (pq) {
      var v = normalize([(pq[1][0] - pq[0][0]) / 2, (pq[1][1] - pq[0][1]) / 2]);
      return [v[0], v[1], w];
    });
  }

  // Angle in degrees of a normalized vector, 0..45.
  function angle(v) { return Math.atan2(v[1], v[0]) * 180 / Math.PI; }

  // Sort weighted vectors by slope and chain them from (0, 0). Returns the
  // chain's vertices and, for each, the angle phi seen from C = (0, R),
  // R = X + Y, measured from the downward direction, and the relative
  // deviation (|P - C| - R) / R from the circle of radius R around C.
  function chainDeviation(vecs) {
    var v = vecs.slice().sort(function (a, b) { return a[1] * b[0] - b[1] * a[0]; });
    var x = 0, y = 0, pts = [[0, 0]];
    for (var i = 0; i < v.length; i++) { x += v[i][0] * v[i][2]; y += v[i][1] * v[i][2]; pts.push([x, y]); }
    var R = x + y, out = [];
    if (!(R > 0)) return { X: 0, Y: 0, R: 0, pts: [] };
    for (var j = 0; j < pts.length; j++) {
      var px = pts[j][0], py = pts[j][1];
      out.push([Math.atan2(px, R - py) * 180 / Math.PI, (Math.hypot(px, py - R) - R) / R]);
    }
    return { X: x, Y: y, R: R, pts: out };
  }

  // ---------- all free n-ominoes ----------

  // Canonical form under the 8 symmetries: sorted cells, shifted to (0, 0).
  function canonical(cells) {
    var best = null, bestCells = null;
    for (var r = 0; r < 8; r++) {
      var p = cells.map(function (c) {
        var a = c[0], b = c[1], t;
        for (var i = 0; i < r % 4; i++) { t = a; a = -b; b = t; }
        if (r >= 4) a = -a;
        return [a, b];
      });
      var mx = Infinity, my = Infinity;
      for (var j = 0; j < p.length; j++) { if (p[j][0] < mx) mx = p[j][0]; if (p[j][1] < my) my = p[j][1]; }
      p = p.map(function (c) { return [c[0] - mx, c[1] - my]; }).sort(function (u, v) { return u[0] - v[0] || u[1] - v[1]; });
      var k = p.map(function (c) { return c[0] + "," + c[1]; }).join(";");
      if (best === null || k < best) { best = k; bestCells = p; }
    }
    return { key: best, cells: bestCells };
  }

  // Grow from the monomino one cell at a time, keeping one copy of each shape.
  function enumerateFree(n) {
    var cur = new Map(), c0 = canonical([[0, 0]]);
    cur.set(c0.key, c0.cells);
    for (var k = 2; k <= n; k++) {
      var next = new Map();
      cur.forEach(function (cells) {
        var occ = new Set(cells.map(function (c) { return c[0] + "," + c[1]; }));
        for (var i = 0; i < cells.length; i++) {
          for (var d = 0; d < 4; d++) {
            var q = [cells[i][0] + NB[d][0], cells[i][1] + NB[d][1]];
            if (occ.has(q[0] + "," + q[1])) continue;
            var c = canonical(cells.concat([q]));
            if (!next.has(c.key)) next.set(c.key, c.cells);
          }
        }
      });
      cur = next;
    }
    return Array.from(cur.values());
  }

  var API = {
    canonical: canonical, enumerateFree: enumerateFree,
    Chain: Chain, rng: rng, midpoints2: midpoints2, hull: hull, diameters: diameters,
    normalize: normalize, sampleVectors: sampleVectors, angle: angle, chainDeviation: chainDeviation,
    burnIn: function (n) { return 16 * n * n; }, gap: function (n) { return 8 * n; },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.LimitSampler = API;
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);

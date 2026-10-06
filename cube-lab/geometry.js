/* Cube lab geometry: the pentacubes and the enclosed volume.
 * Pure functions, no DOM: loaded by the page and by test/geometry.test.js.
 *
 * Cells are integer triples [x, y, z] (y up). A wall encloses the empty
 * cells the outside cannot reach, and the outside slips through corners:
 * two empty cells are neighbours as soon as they share a vertex (the 26
 * neighbours of a cube). The volume is the size of the largest enclosed
 * region, regions also joined corner to corner. */
(function (root) {
  "use strict";

  function key(c) { return c[0] + "," + c[1] + "," + c[2]; }

  // Shift a cell list so its smallest x, y, z are 0, then sort it: the
  // canonical spelling of one placement-free orientation.
  function normalize(cells) {
    var m = [Infinity, Infinity, Infinity];
    cells.forEach(function (c) { for (var a = 0; a < 3; a++) if (c[a] < m[a]) m[a] = c[a]; });
    return cells
      .map(function (c) { return [c[0] - m[0], c[1] - m[1], c[2] - m[2]]; })
      .sort(function (p, q) { return p[0] - q[0] || p[1] - q[1] || p[2] - q[2]; });
  }

  function sig(cells) { return normalize(cells).map(key).join(";"); }

  // The 24 turns of space (rotations only, no mirror): every signed
  // permutation matrix of determinant +1.
  var ROTATIONS = (function () {
    var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    var parity = [1, -1, -1, 1, 1, -1];
    var out = [];
    perms.forEach(function (p, i) {
      for (var s = 0; s < 8; s++) {
        var sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
        if (sg[0] * sg[1] * sg[2] * parity[i] === 1) out.push({ p: p, s: sg });
      }
    });
    return out;
  })();

  function rotate(cells, r) {
    return cells.map(function (c) { return [r.s[0] * c[r.p[0]], r.s[1] * c[r.p[1]], r.s[2] * c[r.p[2]]]; });
  }

  function orientations(cells) {
    var seen = {}, out = [];
    ROTATIONS.forEach(function (r) {
      var n = normalize(rotate(cells, r)), s = n.map(key).join(";");
      if (!seen[s]) { seen[s] = true; out.push(n); }
    });
    return out;
  }

  // Canonical name of a solid up to turning it in space (not mirroring).
  function canon(cells) {
    return orientations(cells).map(function (o) { return o.map(key).join(";"); }).sort()[0];
  }

  var FACE = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  // Every n-cube up to turning in space, grown face to face from one cube.
  function polycubes(n) {
    var level = [[[0, 0, 0]]];
    for (var size = 2; size <= n; size++) {
      var seen = {}, next = [];
      level.forEach(function (cells) {
        var have = {};
        cells.forEach(function (c) { have[key(c)] = true; });
        cells.forEach(function (c) {
          FACE.forEach(function (d) {
            var q = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
            if (have[key(q)]) return;
            var grown = cells.concat([q]), k = canon(grown);
            if (!seen[k]) { seen[k] = true; next.push(normalize(grown)); }
          });
        });
      });
      level = next;
    }
    return level;
  }

  // The mirror image of a solid, as a solid of its own.
  function mirror(cells) { return normalize(cells.map(function (c) { return [-c[0], c[1], c[2]]; })); }

  /* The enclosed volume of a wall.
   * Returns { volume, regions, enclosed: [cells of the largest region],
   * total, all: [every enclosed cell] }. The search runs in the wall's
   * box grown by one cell on every side, so the outside surrounds it. */
  var N26 = (function () {
    var out = [];
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++)
      if (dx || dy || dz) out.push([dx, dy, dz]);
    return out;
  })();

  // conn = 26 (default: emptiness flows through corners
  // and edges too) or 6 (it flows through faces only).
  function enclosed(wall, conn) {
    var NB = conn === 6 ? FACE : N26;
    if (!wall.length) return { volume: 0, regions: 0, enclosed: [], total: 0, all: [] };
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    wall.forEach(function (c) { for (var a = 0; a < 3; a++) { if (c[a] < lo[a]) lo[a] = c[a]; if (c[a] > hi[a]) hi[a] = c[a]; } });
    for (var a = 0; a < 3; a++) { lo[a] -= 1; hi[a] += 1; }
    var X = hi[0] - lo[0] + 1, Y = hi[1] - lo[1] + 1, Z = hi[2] - lo[2] + 1;
    var idx = function (x, y, z) { return ((x - lo[0]) * Y + (y - lo[1])) * Z + (z - lo[2]); };
    var state = new Uint8Array(X * Y * Z); // 0 empty, 1 wall, 2 outside, 3 counted
    wall.forEach(function (c) { state[idx(c[0], c[1], c[2])] = 1; });

    function flood(start, mark) {
      var stack = [start], cells = [];
      state[idx(start[0], start[1], start[2])] = mark;
      while (stack.length) {
        var c = stack.pop();
        cells.push(c);
        for (var i = 0; i < NB.length; i++) {
          var x = c[0] + NB[i][0], y = c[1] + NB[i][1], z = c[2] + NB[i][2];
          if (x < lo[0] || y < lo[1] || z < lo[2] || x > hi[0] || y > hi[1] || z > hi[2]) continue;
          var j = idx(x, y, z);
          if (state[j] !== 0) continue;
          state[j] = mark;
          stack.push([x, y, z]);
        }
      }
      return cells;
    }

    flood([lo[0], lo[1], lo[2]], 2);
    var best = [], regions = 0, total = 0, all = [];
    for (var x = lo[0]; x <= hi[0]; x++) for (var y = lo[1]; y <= hi[1]; y++) for (var z = lo[2]; z <= hi[2]; z++) {
      if (state[idx(x, y, z)] !== 0) continue;
      var reg = flood([x, y, z], 3);
      regions++;
      total += reg.length;
      all = all.concat(reg);
      if (reg.length > best.length) best = reg;
    }
    return { volume: best.length, regions: regions, enclosed: best, total: total, all: all };
  }

  // Whether cells hold together face to face (true of every piece).
  function isFaceConnected(cells) {
    if (!cells.length) return true;
    var have = {}, seen = {}, stack = [cells[0]], n = 0;
    cells.forEach(function (c) { have[key(c)] = true; });
    seen[key(cells[0])] = true;
    while (stack.length) {
      var c = stack.pop(); n++;
      FACE.forEach(function (d) {
        var q = [c[0] + d[0], c[1] + d[1], c[2] + d[2]], k = key(q);
        if (have[k] && !seen[k]) { seen[k] = true; stack.push(q); }
      });
    }
    return n === cells.length;
  }

  var api = {
    key: key, normalize: normalize, sig: sig, ROTATIONS: ROTATIONS, rotate: rotate,
    orientations: orientations, canon: canon, polycubes: polycubes, mirror: mirror,
    enclosed: enclosed, isFaceConnected: isFaceConnected
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CubeGeometry = api;
})(this);

/* Fence Challenge · limit-shape lab: the reference polygons of the paper's fences as exact polygons.
 *
 * data/greedy.js lists, for each n = 7..15, the distinct arrows of the greedy fence's reference polygon with their
 * multiplicities, in doubled coordinates (four corner arrows are half-integral); data/optimal.js lists, for n = 4, 5, 6,
 * the pieces of an optimal fence, each with the midpoints of its two attachment edges, which fromPieces() turns into
 * the same arrows, one per piece. The polygon is those arrows laid end to end in the order given (sorted by direction,
 * from the south, counterclockwise): its corners are where the direction changes, its sides are runs of parallel
 * arrows. All coordinates here are in cell units and multiples of 1/2, so every sum below is exact in a double.
 *
 * The circle is the paper's (Figure of the deviation): centre K = the middle of the bounding box,
 * radius R = half its height; the gap at a direction is rho / R - 1, where rho is the distance from K
 * to the polygon. Directions are measured as in the paper, from the downward direction (south)
 * towards the east, in degrees; the sector S to SE is theta in [0, 45].
 * Works in the browser (window.LimitPolygon) and in node (module.exports). */
(function (root) {
  "use strict";
  var DEG = 180 / Math.PI;

  function theta(vx, vy) {          // direction of (vx, vy) from the south, towards the east, 0 .. 360
    var t = Math.atan2(vx, -vy) * DEG;
    return t < 0 ? t + 360 : t;
  }

  // Arrows [dx2, dy2, m] -> polygon. `arrows` must be sorted by direction, as in data/greedy.js.
  // seg[k] is where the k-th arrow (a run of m equal arrows) lies on the polygon: [[x0, y0], [x1, y1]].
  function build(g) {
    var A = g.arrows, corners = [], edges = [], seg = [], x = 0, y = 0, prev = null, e = null, i, j;
    for (i = 0; i < A.length; i++) {
      var a = A[i];
      if (!prev || prev[0] * a[1] - prev[1] * a[0] !== 0 || prev[0] * a[0] + prev[1] * a[1] < 0) {
        corners.push([x, y]);
        e = { i: corners.length - 1, groups: [], count: 0 };
        edges.push(e);
      }
      e.groups.push(a);
      e.count += a[2];
      var x0 = x, y0 = y;
      x += a[0] / 2 * a[2]; y += a[1] / 2 * a[2];
      seg.push([[x0, y0], [x, y]]);
      prev = a;
    }
    var N = corners.length, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, s2 = 0, per = 0;
    for (i = 0; i < N; i++) {
      var c = corners[i];
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    }
    for (i = 0; i < A.length; i++) per += Math.hypot(A[i][0], A[i][1]) / 2 * A[i][2];
    var P = {
      n: g.n, count: g.count, L: g.L, U: g.U, corners: corners, edges: edges,
      closed: x === 0 && y === 0,
      kx: (minX + maxX) / 2, ky: (minY + maxY) / 2,
      R: (maxY - minY) / 2, halfWidth: (maxX - minX) / 2,
      perimeter: per, arrows: A, seg: seg,
    };
    for (i = 0; i < N; i++) {
      var p = corners[i], q = corners[(i + 1) % N];
      s2 += p[0] * q[1] - q[0] * p[1];
      var ed = edges[i], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      ed.dx = dx; ed.dy = dy; ed.len = len;
      ed.nx = dy / len; ed.ny = -dx / len;                       // outward normal (counterclockwise polygon)
      ed.h = ed.nx * (p[0] - P.kx) + ed.ny * (p[1] - P.ky);      // distance from K to the side's line
      ed.t0 = theta(p[0] - P.kx, p[1] - P.ky);
      ed.t1 = theta(q[0] - P.kx, q[1] - P.ky);
      if (ed.t1 < ed.t0) ed.t1 += 360;                            // each side spans less than 180 degrees
    }
    P.area = s2 / 2;                                             // exact: the corners are multiples of 1/2
    P.gap = extremes(P);
    return P;
  }

  // The side that the ray at direction t (degrees) leaves through.
  function sideAt(P, t) {
    var E = P.edges, j;
    for (j = 0; j < E.length; j++) {
      var a = E[j].t0, b = E[j].t1;
      if ((t >= a && t <= b) || (t + 360 >= a && t + 360 <= b)) return j;
    }
    return 0;
  }

  // Distance from K to the polygon along direction t, in units of R, minus 1.
  function gapAt(P, t) {
    var ed = P.edges[sideAt(P, t)], r = t / DEG;
    return ed.h / (ed.nx * Math.sin(r) - ed.ny * Math.cos(r)) / P.R - 1;
  }

  // Largest gap (outwards) at a corner, deepest dip (inwards) possibly inside a side: both exact.
  function extremes(P) {
    var hi = -Infinity, lo = Infinity, thi = 0, tlo = 0, j;
    for (j = 0; j < P.edges.length; j++) {
      var ed = P.edges[j], c = P.corners[j];
      var g = Math.hypot(c[0] - P.kx, c[1] - P.ky) / P.R - 1;
      if (g > hi) { hi = g; thi = ed.t0; }
      if (g < lo) { lo = g; tlo = ed.t0; }
      // the foot of the perpendicular from K, if it lies on this side
      var tn = theta(ed.nx, ed.ny);
      if (tn < ed.t0) tn += 360;
      if (tn <= ed.t1 && ed.h / P.R - 1 < lo) { lo = ed.h / P.R - 1; tlo = tn % 360; }
    }
    return { max: hi, atMax: thi, min: lo, atMin: tlo, signed: Math.abs(lo) > Math.abs(hi) ? lo : hi };
  }

  // The polygon as (theta, gap) pairs from 0 to 360: a regular grid plus every corner, so the curve is exact.
  function samples(P, step) {
    var ts = [], j;
    for (j = 0; j * step < 360; j++) ts.push(j * step);
    ts.push(360);
    for (j = 0; j < P.edges.length; j++) { ts.push(P.edges[j].t0 % 360); }
    ts.sort(function (a, b) { return a - b; });
    var out = [];
    for (j = 0; j < ts.length; j++) {
      if (j && ts[j] - ts[j - 1] < 1e-9) continue;
      out.push([ts[j], gapAt(P, ts[j] % 360)]);
    }
    if (out[out.length - 1][0] < 360) out.push([360, out[0][1]]);
    return out;
  }

  // Smallest and largest gap over the directions t0..t1 (degrees, 0 <= t0 <= t1 <= 360): the two ends, the
  // corners inside, and the foot of each side's perpendicular from K, which is where a side dips lowest.
  function range(P, t0, t1) {
    var hi = -Infinity, lo = Infinity, j;
    function take(g) { if (g > hi) hi = g; if (g < lo) lo = g; }
    take(gapAt(P, t0 % 360)); take(gapAt(P, t1 % 360));
    for (j = 0; j < P.edges.length; j++) {
      var ed = P.edges[j], c = P.corners[j], tc = ed.t0;
      if (tc >= t0 && tc <= t1) take(Math.hypot(c[0] - P.kx, c[1] - P.ky) / P.R - 1);
      var tn = theta(ed.nx, ed.ny);
      if (tn < ed.t0) tn += 360;
      var tf = tn % 360;
      if (tn <= ed.t1 && tf >= t0 && tf <= t1) take(ed.h / P.R - 1);
    }
    return { min: lo, max: hi };
  }

  // The corners inside the sector S to SE of the paper's deviation figure, as (theta, gap).
  function sectorCorners(P) {
    var out = [];
    for (var j = 0; j < P.corners.length; j++) {
      var c = P.corners[j], t = theta(c[0] - P.kx, c[1] - P.ky);
      if (t > 0 && t < 45) out.push([t, Math.hypot(c[0] - P.kx, c[1] - P.ky) / P.R - 1]);
    }
    return out.sort(function (a, b) { return a[0] - b[0]; });
  }

  // A corner piece's arrow is half-integral: its two attachment edges are one horizontal and one vertical.
  function isCorner(a) { return a[0] % 2 !== 0 || a[1] % 2 !== 0; }

  // The distinct arrows folded by the grid's symmetries to x >= y >= 0: [x, y, pieces, isCorner],
  // sorted by direction. The four half-integral arrows are the corner pieces.
  function folded(P) {
    var map = Object.create(null), out = [];
    P.arrows.forEach(function (a) {
      var u = Math.abs(a[0]) / 2, v = Math.abs(a[1]) / 2, x = Math.max(u, v), y = Math.min(u, v), k = x + "," + y;
      if (!map[k]) { map[k] = [x, y, 0, isCorner(a)]; out.push(map[k]); }
      map[k][2] += a[2];
    });
    // by direction, and along one direction by length: the arrow keys then walk along the floor, not back and forth
    return out.sort(function (a, b) { return a[1] * b[0] - b[1] * a[0] || a[0] - b[0]; });
  }

  // Where the arrows of one folded kind lie on the polygon: segments [[x1, y1], [x2, y2]] in its coordinates.
  function placesOf(P, fx, fy) {
    var out = [];
    P.edges.forEach(function (ed) {
      var c = P.corners[ed.i], px = c[0], py = c[1];
      ed.groups.forEach(function (a) {
        var dx = a[0] / 2 * a[2], dy = a[1] / 2 * a[2], u = Math.abs(a[0]) / 2, v = Math.abs(a[1]) / 2;
        if (Math.max(u, v) === fx && Math.min(u, v) === fy) out.push([[px, py], [px + dx, py + dy]]);
        px += dx; py += dy;
      });
    });
    return out;
  }

  // A point of the polygon's plane as (theta, gap) from K.
  function polar(P, x, y) {
    var vx = x - P.kx, vy = y - P.ky;
    return [theta(vx, vy), Math.hypot(vx, vy) / P.R - 1];
  }

  // ---- the optimal fences (data/optimal.js): n = 4, 5, 6 ----

  // The data of one optimal fence -> what build() takes. A piece's arrow joins the midpoints of its two attachment
  // edges (doubled grid coordinates, rows counted downwards), so the arrow of the polygon, whose y points up, is
  // (o - i) with its y turned over. One piece per arrow, in the order of the data (sorted by direction).
  function fromPieces(e) {
    return {
      n: e.n, count: e.pieces.length, L: e.area, U: e.area,
      arrows: e.pieces.map(function (p) { return [p.o[0] - p.i[0], p.i[1] - p.o[1], 1]; }),
    };
  }

  // The cells of an optimal fence in the polygon's own plane, per piece: the lower-left corner [x, y] of each unit square, y
  // upwards. The polygon starts at the middle of the first piece's incoming attachment edge, so the grid is shifted by half of
  // that edge's doubled coordinates; rows count downwards in the data.
  function cellsOf(e) {
    var ox = e.pieces[0].i[0] / 2, oy = e.pieces[0].i[1] / 2;
    return e.pieces.map(function (p) {
      return p.c.map(function (c) { return [c[0] - ox, oy - c[1] - 1]; });
    });
  }

  // The outline of a set of unit squares (lower-left corners): the sides that no square of the set shares, as [x1, y1, x2, y2].
  function outlineOf(squares) {
    var have = new Set(squares.map(function (q) { return q[0] + "," + q[1]; })), out = [];
    squares.forEach(function (q) {
      var x = q[0], y = q[1];
      if (!have.has(x + "," + (y - 1))) out.push([x, y, x + 1, y]);
      if (!have.has(x + "," + (y + 1))) out.push([x, y + 1, x + 1, y + 1]);
      if (!have.has((x - 1) + "," + y)) out.push([x, y, x, y + 1]);
      if (!have.has((x + 1) + "," + y)) out.push([x + 1, y, x + 1, y + 1]);
    });
    return out;
  }

  // How far the fence's cells reach from the circle's centre K, in parts of the circle's radius R (1 or more).
  function reach(P, cells) {
    var far = 0;
    cells.forEach(function (piece) {
      piece.forEach(function (q) {
        for (var dx = 0; dx <= 1; dx++) for (var dy = 0; dy <= 1; dy++) far = Math.max(far, Math.hypot(q[0] + dx - P.kx, q[1] + dy - P.ky));
      });
    });
    return Math.max(1, far / P.R);
  }

  // The area of the largest region that the pieces enclose, as in the paper's definition of a fence: free cells
  // count as connected when they touch at a corner (8 neighbours), the outside is the free component that reaches
  // the border, and the regions are the 8-connected components of the free cells that are not outside.
  function regionArea(pieces) {
    var occ = new Set(), minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, i, j;
    pieces.forEach(function (p) {
      p.c.forEach(function (c) {
        occ.add(c[0] + "," + c[1]);
        minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
      });
    });
    var x0 = minX - 1, x1 = maxX + 1, y0 = minY - 1, y1 = maxY + 1, W = x1 - x0 + 1, H = y1 - y0 + 1;
    var seen = new Uint8Array(W * H);          // 0 free, not reached; 1 piece or reached
    var at = function (x, y) { return (y - y0) * W + (x - x0); };
    occ.forEach(function (k) { var s = k.split(","); seen[at(+s[0], +s[1])] = 1; });
    function flood(sx, sy) {
      var stack = [[sx, sy]], n = 0;
      seen[at(sx, sy)] = 1;
      while (stack.length) {
        var c = stack.pop(); n++;
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          var x = c[0] + dx, y = c[1] + dy;
          if (x < x0 || x > x1 || y < y0 || y > y1 || seen[at(x, y)]) continue;
          seen[at(x, y)] = 1; stack.push([x, y]);
        }
      }
      return n;
    }
    flood(x0, y0);                              // the outside
    var best = 0;
    for (j = y0; j <= y1; j++) for (i = x0; i <= x1; i++) if (!seen[at(i, j)]) best = Math.max(best, flood(i, j));
    return best;
  }

  var API = {
    build: build, gapAt: gapAt, sideAt: sideAt, samples: samples, range: range, sectorCorners: sectorCorners,
    folded: folded, placesOf: placesOf, polar: polar, theta: theta, isCorner: isCorner,
    fromPieces: fromPieces, regionArea: regionArea, cellsOf: cellsOf, outlineOf: outlineOf, reach: reach,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.LimitPolygon = API;
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);

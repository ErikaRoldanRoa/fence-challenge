/* Hexomino lab · fence geometry.
 *
 * Pure functions, no DOM: the page and the node tests share them.
 * Cells are integer pairs [x, y]; the cell [x, y] is the unit square
 * [x, x+1] x [y, y+1], y pointing up. A piece is { id, cells }.
 *
 *   analyzeFence(pieces)      the fence area: free cells
 *                             are 8-connected, the outside is the infinite
 *                             8-component, the area is a largest 8-connected
 *                             region of enclosed cells.
 *   referenceData(pieces, R)  for a fence and its largest region R, the
 *                             reference vector v, correction Delta and
 *                             rotation D of every piece
 *                             in the cyclic order around R, or a failure
 *                             reason when the pieces around R do not form
 *                             one cycle of attachment edges.
 *   convexArrangement(vs)     the vectors sorted by direction: the convex
 *                             polygon of largest area, its area F, and the
 *                             chain (NE / NW / SW / SE) of every vector.
 */
(function (root) {
  "use strict";

  const key = (x, y) => x + "," + y;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const N4 = N8.slice(0, 4);

  function det(a, b) { return a[0] * b[1] - a[1] * b[0]; }

  /* Signed area of a closed polygon (counterclockwise positive). */
  function shoelace(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += det(pts[i], pts[(i + 1) % pts.length]);
    return s / 2;
  }

  /* Pieces from a text grid: one character per cell, two columns per cell,
   * blank = free. */
  function parseGrid(text) {
    const rows = text.replace(/\s+$/, "").split("\n");
    const by = new Map();
    rows.forEach((line, r) => {
      for (let i = 0; i < line.length; i += 2) {
        const ch = line[i];
        if (!ch || ch === " ") continue;
        if (!by.has(ch)) by.set(ch, []);
        by.get(ch).push([i / 2, rows.length - 1 - r]);
      }
    });
    return [...by.entries()].map(([id, cells]) => ({ id, cells }));
  }

  function fenceCellMap(pieces) {
    const m = new Map();
    for (const p of pieces) for (const c of p.cells) {
      const k = key(c[0], c[1]);
      if (m.has(k)) return { overlap: k };
      m.set(k, p.id);
    }
    return { map: m };
  }

  function isConnected(cells, nbs) {
    if (!cells.length) return true;
    const set = new Set(cells.map((c) => key(c[0], c[1])));
    const seen = new Set([key(cells[0][0], cells[0][1])]);
    const stack = [cells[0]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of nbs) {
        const k = key(x + dx, y + dy);
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
      }
    }
    return seen.size === set.size;
  }

  /* Area of a placement: pieces disjoint and 4-connected; free cells
   * 8-connected; largest bounded region. */
  function analyzeFence(pieces) {
    const fm = fenceCellMap(pieces);
    if (fm.overlap) return { valid: false, reason: "overlap", area: 0, regions: [] };
    const occ = fm.map;
    const all = [];
    for (const p of pieces) for (const c of p.cells) all.push(c);
    const connected = isConnected(all, N4);
    if (!all.length) return { valid: false, reason: "empty", area: 0, regions: [] };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of all) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0--; y0--; x1++; y1++;
    // The outside: everything 8-reachable from the padded frame.
    const out = new Set();
    const stack = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if ((x === x0 || x === x1 || y === y0 || y === y1)) { const k = key(x, y); out.add(k); stack.push([x, y]); }
    }
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const k = key(nx, ny);
        if (occ.has(k) || out.has(k)) continue;
        out.add(k); stack.push([nx, ny]);
      }
    }
    const enclosed = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = key(x, y);
      if (!occ.has(k) && !out.has(k)) enclosed.push([x, y]);
    }
    // Regions: 8-connected components of the enclosed cells.
    const enc = new Set(enclosed.map((c) => key(c[0], c[1])));
    const seen = new Set();
    const regions = [];
    for (const c of enclosed) {
      const k0 = key(c[0], c[1]);
      if (seen.has(k0)) continue;
      const reg = [c]; seen.add(k0);
      for (let i = 0; i < reg.length; i++) {
        const [x, y] = reg[i];
        for (const [dx, dy] of N8) {
          const k = key(x + dx, y + dy);
          if (enc.has(k) && !seen.has(k)) { seen.add(k); reg.push([x + dx, y + dy]); }
        }
      }
      regions.push(reg);
    }
    regions.sort((a, b) => b.length - a.length);
    return {
      valid: connected,
      reason: connected ? null : "disconnected",
      area: connected && regions.length ? regions[0].length : 0,
      largest: regions[0] || [],
      regions,
      enclosedCount: enclosed.length,
    };
  }

  /* The boundary of a polyomino as a clockwise vertex cycle w_1..w_m.
   * Throws when the boundary is not a simple cycle. */
  function clockwiseBoundary(cells) {
    const set = new Set(cells.map((c) => key(c[0], c[1])));
    const next = new Map();
    for (const [x, y] of cells) {
      // Clockwise around the cell [x,x+1]x[y,y+1]: up the left side, along
      // the top to the right, down the right side, back along the bottom.
      const sides = [
        [[x, y], [x, y + 1], key(x - 1, y)],
        [[x, y + 1], [x + 1, y + 1], key(x, y + 1)],
        [[x + 1, y + 1], [x + 1, y], key(x + 1, y)],
        [[x + 1, y], [x, y], key(x, y - 1)],
      ];
      for (const [a, b, nb] of sides) {
        if (set.has(nb)) continue;
        const ka = key(a[0], a[1]);
        if (next.has(ka)) throw new Error("boundary is not a simple cycle at " + ka);
        next.set(ka, b);
      }
    }
    const start = next.keys().next().value;
    const cyc = [];
    let k = start;
    do {
      const [x, y] = k.split(",").map(Number);
      cyc.push([x, y]);
      const b = next.get(k);
      k = key(b[0], b[1]);
    } while (k !== start && cyc.length <= next.size);
    if (cyc.length !== next.size) throw new Error("boundary has several cycles");
    return cyc;
  }

  /* The cell on the left of the directed unit edge a -> b. */
  function leftCell(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const mx = (a[0] + b[0]) / 2 - dy / 2, my = (a[1] + b[1]) / 2 + dx / 2;
    return [Math.floor(mx), Math.floor(my)];
  }

  function turn(a, b) {
    const d = det(a, b);
    return d > 0 ? 90 : d < 0 ? -90 : 0;
  }

  /* Reference vector, correction and rotation of every piece, for the
   * attachment edges the fence actually uses. */
  function referenceData(pieces, region) {
    const R = new Set(region.map((c) => key(c[0], c[1])));
    const owner = fenceCellMap(pieces).map;
    const items = [];
    for (const p of pieces) {
      const w = clockwiseBoundary(p.cells);
      const m = w.length;
      const onR = w.map((a, i) => {
        const c = leftCell(a, w[(i + 1) % m]);
        return R.has(key(c[0], c[1]));
      });
      const count = onR.filter(Boolean).length;
      if (count === 0) {
        if (touchesOnlyAtVertex(p, R)) return { ok: false, reason: "vertex-only", piece: p.id };
        continue; // not around the region
      }
      // f_p..f_q must be one cyclic interval.
      let starts = 0, p0 = -1;
      for (let i = 0; i < m; i++) if (onR[i] && !onR[(i - 1 + m) % m]) { starts++; p0 = i; }
      if (starts !== 1) return { ok: false, reason: "not-an-interval", piece: p.id };
      const q0 = (p0 + count - 1) % m;
      const s = (p0 - 1 + m) % m;      // incoming attachment edge (w_s, w_s+1)
      const e = (q0 + 1) % m;          // outgoing attachment edge (w_e, w_e+1)
      const W = (i) => w[((i % m) + m) % m];
      const mIn = [(W(s)[0] + W(s + 1)[0]) / 2, (W(s)[1] + W(s + 1)[1]) / 2];
      const mOut = [(W(e)[0] + W(e + 1)[0]) / 2, (W(e)[1] + W(e + 1)[1]) / 2];
      const path = [mIn];
      const span = ((e - s) % m + m) % m;
      for (let k = 1; k <= span; k++) path.push(W(s + k));
      path.push(mOut);
      const delta = shoelace(path);
      let D = 180;
      for (let k = 0; k < span; k++) {
        const a = W(s + k), b = W(s + k + 1), c = W(s + k + 2);
        D += turn([b[0] - a[0], b[1] - a[1]], [c[0] - b[0], c[1] - b[1]]);
      }
      const prevCell = leftCell(W(s), W(s + 1));
      const nextCell = leftCell(W(e), W(e + 1));
      items.push({
        id: p.id, mIn, mOut,
        v: [mOut[0] - mIn[0], mOut[1] - mIn[1]],
        delta, D,
        boundary: path.slice(1, -1),
        attachIn: [W(s), W(s + 1)], attachOut: [W(e), W(e + 1)],
        prev: owner.get(key(prevCell[0], prevCell[1])) || null,
        next: owner.get(key(nextCell[0], nextCell[1])) || null,
      });
    }
    // Cyclic order: the outgoing midpoint of a piece is the incoming
    // midpoint of the next one.
    const byIn = new Map(items.map((it) => [key(it.mIn[0], it.mIn[1]), it]));
    if (byIn.size !== items.length) return { ok: false, reason: "shared-midpoint" };
    const order = [items[0]];
    while (order.length < items.length) {
      const nx = byIn.get(key(order[order.length - 1].mOut[0], order[order.length - 1].mOut[1]));
      if (!nx || nx === order[0]) return { ok: false, reason: "open-chain" };
      order.push(nx);
    }
    const last = order[order.length - 1];
    if (key(last.mOut[0], last.mOut[1]) !== key(order[0].mIn[0], order[0].mIn[1])) return { ok: false, reason: "open-chain" };
    const polygon = order.map((it) => it.mIn);
    const aRef = shoelace(polygon);
    const sumDelta = order.reduce((s, it) => s + it.delta, 0);
    const sumD = order.reduce((s, it) => s + it.D, 0);
    return { ok: true, order, polygon, aRef, sumDelta, sumD, area: aRef + sumDelta };
  }

  function touchesOnlyAtVertex(p, R) {
    for (const [x, y] of p.cells) for (const [dx, dy] of N8) if (R.has(key(x + dx, y + dy))) return true;
    return false;
  }

  /* Chain of a vector: NE takes the directions in [0, 90),
   * NW [90, 180), SW [180, 270), SE [270, 360). */
  function chainOf(v) {
    const [x, y] = v;
    if (x > 0 && y >= 0) return "NE";
    if (x <= 0 && y > 0) return "NW";
    if (x < 0 && y <= 0) return "SW";
    return "SE";
  }

  /* Fixed variants: the convex polygon of the vectors
   * sorted by direction, which has the largest signed area among all
   * polygons with these edge vectors. */
  function convexArrangement(vectors) {
    const idx = vectors.map((v, i) => i);
    const ang = (v) => { let a = Math.atan2(v[1], v[0]); if (a < 0) a += 2 * Math.PI; return a; };
    idx.sort((i, j) => ang(vectors[i]) - ang(vectors[j]) || i - j);
    const pts = [[0, 0]];
    for (const i of idx.slice(0, -1)) {
      const p = pts[pts.length - 1];
      pts.push([p[0] + vectors[i][0], p[1] + vectors[i][1]]);
    }
    return { order: idx, polygon: pts, area: shoelace(pts), chains: idx.map((i) => chainOf(vectors[i])) };
  }

  /* Area of the Minkowski average of the 8 symmetric copies: an upper bound
   * for the largest polygon from these vector classes. */
  function minkowskiBound(vectors) {
    const w = vectors.map(([x, y]) => [Math.max(Math.abs(x), Math.abs(y)), Math.min(Math.abs(x), Math.abs(y))])
      .sort((p, q) => p[1] / p[0] - q[1] / q[0]);
    let s = 0;
    for (let i = 0; i < w.length; i++) {
      for (let j = i + 1; j < w.length; j++) s += w[i][0] * (w[j][0] + w[j][1]);
      s += 0.5 * w[i][0] * (w[i][0] + w[i][1]);
    }
    return s / 8;
  }

  /* Free polyomino canonical form (8 symmetries), for checking a set. */
  function canonical(cells) {
    const forms = [];
    for (let r = 0; r < 8; r++) {
      const t = cells.map(([x, y]) => {
        let a = x, b = y;
        for (let k = 0; k < (r & 3); k++) [a, b] = [-b, a];
        if (r & 4) a = -a;
        return [a, b];
      });
      const mx = Math.min(...t.map((c) => c[0])), my = Math.min(...t.map((c) => c[1]));
      forms.push(t.map(([a, b]) => [a - mx, b - my]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map((c) => c.join(",")).join(";"));
    }
    return forms.sort()[0];
  }

  const api = { minkowskiBound, parseGrid, analyzeFence, clockwiseBoundary, referenceData, convexArrangement, chainOf, canonical, shoelace, isConnected, N4, N8 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FenceMath = api;
})(typeof window !== "undefined" ? window : globalThis);

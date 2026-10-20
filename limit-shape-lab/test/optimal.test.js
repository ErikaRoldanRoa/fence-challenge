/* Limit-shape lab · the optimal fences of n = 4, 5, 6 (data/optimal.js). Run: node limit-shape-lab/test/optimal.test.js
 * Everything is rebuilt from the cells of the pieces alone, with the paper's own definitions, and compared with what the
 * data and the lab say: the fence (disjoint pieces, 4-connected, each free n-omino once), its largest region (free cells
 * 8-connected, as the paper's Definition of a fence), the boundary of that region and the pieces along it, the attachment
 * edges, the reference vectors, the corrections, the rotations and the parity bits (the paper's two equations), and the
 * Lemma on the area decomposition, A = polygon + corrections, exactly. The multisets of arrows are the ones the paper prints
 * for the optimal pentomino and hexomino fences. GAP below is a regression constant of this pipeline, not the paper's. */
"use strict";
const assert = require("assert");
const S = require("../sampler.js");
const P = require("../polygon.js");
const OPT = require("../data/optimal.js");
const GREEDY = require("../data/greedy.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

const NS = [4, 5, 6];
const FREE = { 4: 5, 5: 12, 6: 35 };        // A000105
const AREA = { 4: 9, 5: 128, 6: 1597 };     // the optimal areas: the paper (Theorem on 1597, Section on pentomino fences, Figure of fences)
const key = (x, y) => x + "," + y;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = N4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);

// ---- 1. the data, as shipped ----
eq(Object.keys(OPT).sort(), ["4", "5", "6"], "data for n = 4, 5, 6 and no other");

function components(cells, dirs) {                 // cells: array of [x, y]; returns arrays of cells
  const set = new Set(cells.map((c) => key(c[0], c[1]))), seen = new Set(), out = [];
  for (const c0 of cells) {
    if (seen.has(key(c0[0], c0[1]))) continue;
    const comp = [], st = [c0];
    seen.add(key(c0[0], c0[1]));
    while (st.length) {
      const c = st.pop(); comp.push(c);
      for (const d of dirs) {
        const q = [c[0] + d[0], c[1] + d[1]], k = key(q[0], q[1]);
        if (set.has(k) && !seen.has(k)) { seen.add(k); st.push(q); }
      }
    }
    out.push(comp);
  }
  return out;
}

for (const n of NS) {
  const e = OPT[n];
  ok(e.n === n && e.area === AREA[n], `n = ${n}: the data's area is ${AREA[n]}`);
  ok(e.pieces.length === FREE[n], `n = ${n}: ${FREE[n]} pieces`);

  // ---- 2. the pieces: n cells each, 4-connected, disjoint, every free n-omino once ----
  const owner = new Map();                          // "col,row" -> piece index
  e.pieces.forEach((p, i) => {
    ok(p.c.length === n, `n = ${n}: piece ${i} has ${n} cells`);
    ok(components(p.c, N4).length === 1, `n = ${n}: piece ${i} is connected`);
    for (const [c, r] of p.c) {
      ok(Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0, `n = ${n}: piece ${i}: cell coordinates are whole numbers`);
      ok(!owner.has(key(c, r)), `n = ${n}: cell ${key(c, r)} lies in one piece only`);
      owner.set(key(c, r), i);
    }
  });
  const keys = e.pieces.map((p) => S.canonical(p.c).key).sort();
  eq(keys, S.enumerateFree(n).map((c) => S.canonical(c).key).sort(), `n = ${n}: the pieces are the free ${n}-ominoes, each once`);
  const all = e.pieces.flatMap((p) => p.c);
  ok(components(all, N4).length === 1, `n = ${n}: the fence is 4-connected`);

  // ---- 3. the largest region, as the paper's Definition: free cells touching at a corner are connected ----
  const xs = all.map((c) => c[0]), ys = all.map((c) => c[1]);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const free = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!owner.has(key(x, y))) free.push([x, y]);
  const comps = components(free, N8);
  const outside = comps.find((c) => c.some((q) => q[0] === x0 && q[1] === y0));
  const inOutside = new Set(outside.map((q) => key(q[0], q[1])));
  const enclosed = free.filter((q) => !inOutside.has(key(q[0], q[1])));
  const regions = components(enclosed, N8).sort((a, b) => b.length - a.length);
  ok(regions.length >= 1 && regions[0].length === AREA[n], `n = ${n}: the largest region has ${AREA[n]} cells (regions: ${regions.map((r) => r.length)})`);
  ok(P.regionArea(e.pieces) === AREA[n], `n = ${n}: the lab counts ${AREA[n]} cells on the pieces`);
  const region = new Set(regions[0].map((q) => key(q[0], q[1])));
  ok(components(regions[0], N4).length === 1, `n = ${n}: the region is 4-connected too`);

  // ---- 4. its boundary, counterclockwise as drawn (north up): y-up coordinates Y = -row; the region on the left ----
  // A cell (c, r) is the square [c, c+1] x [-r-1, -r]; the edge midpoints below are in doubled y-up coordinates.
  const R = new Set(regions[0].map((q) => key(q[0], q[1])));
  const edgeOf = new Map(), outgoing = new Map();
  for (const [c, r] of regions[0]) {
    const cell = (dc, dr) => [c + dc, r + dr];
    // y-up vertex (x, y) with y = -row: the cell's corners are (c, -r-1), (c+1, -r-1), (c+1, -r), (c, -r)
    const sides = [
      { a: [c, -r - 1], b: [c + 1, -r - 1], nb: cell(0, 1) },      // bottom: the neighbour below is row r + 1
      { a: [c + 1, -r - 1], b: [c + 1, -r], nb: cell(1, 0) },      // right
      { a: [c + 1, -r], b: [c, -r], nb: cell(0, -1) },             // top: the neighbour above is row r - 1
      { a: [c, -r], b: [c, -r - 1], nb: cell(-1, 0) },             // left
    ];
    for (const s of sides) {
      if (R.has(key(s.nb[0], s.nb[1]))) continue;
      ok(owner.has(key(s.nb[0], s.nb[1])), `n = ${n}: a cell next to the region is a fence cell`);
      const ek = key(s.a[0], s.a[1]) + ">" + key(s.b[0], s.b[1]);
      edgeOf.set(ek, { a: s.a, b: s.b, piece: owner.get(key(s.nb[0], s.nb[1])) });
      const from = key(s.a[0], s.a[1]);
      ok(!outgoing.has(from), `n = ${n}: the region's boundary does not touch itself at ${from}`);
      outgoing.set(from, ek);
    }
  }
  const first = edgeOf.keys().next().value, cycle = [first];
  for (;;) {
    const e2 = edgeOf.get(cycle[cycle.length - 1]), nk = outgoing.get(key(e2.b[0], e2.b[1]));
    if (nk === first) break;
    cycle.push(nk);
  }
  ok(cycle.length === edgeOf.size, `n = ${n}: the boundary of the region is one closed curve of ${cycle.length} edges`);
  // the Shoelace area of that curve is the region's cell count
  let sh = 0;
  for (const k of cycle) { const ed = edgeOf.get(k); sh += ed.a[0] * ed.b[1] - ed.b[0] * ed.a[1]; }
  ok(sh / 2 === AREA[n], `n = ${n}: the boundary encloses ${AREA[n]} (Shoelace ${sh / 2})`);

  // ---- 5. every piece is one interval of it; the attachment edge at each junction ----
  const runs = [];
  for (const k of cycle) {
    const ed = edgeOf.get(k);
    if (runs.length && runs[runs.length - 1].piece === ed.piece) runs[runs.length - 1].edges.push(ed);
    else runs.push({ piece: ed.piece, edges: [ed] });
  }
  if (runs.length > 1 && runs[0].piece === runs[runs.length - 1].piece) { runs[0].edges = runs.pop().edges.concat(runs[0].edges); }
  const K = runs.length;
  ok(K === FREE[n] && new Set(runs.map((r) => r.piece)).size === K, `n = ${n}: each of the ${FREE[n]} pieces is one interval of the boundary`);
  const att = [];   // att[i]: between run i and run i + 1: inner endpoint, outer endpoint, doubled midpoint (y-up)
  for (let i = 0; i < K; i++) {
    const a = runs[i].piece, b = runs[(i + 1) % K].piece, p = runs[i].edges[runs[i].edges.length - 1].b;
    ok(key(p[0], p[1]) === key(runs[(i + 1) % K].edges[0].a[0], runs[(i + 1) % K].edges[0].a[1]), `n = ${n}: junction ${i} is one vertex`);
    // the four unit edges at p, with the two cells (rows downwards: the cell above a vertex (x, y) has row -y - 1)
    const cellAt = (cx, cyRow) => owner.get(key(cx, cyRow));
    const px = p[0], py = p[1], rowBelow = -py, rowAbove = -py - 1;   // the row of the cells just below / above the vertex
    const cands = [
      { off: [0, 1], pair: [cellAt(px - 1, rowAbove), cellAt(px, rowAbove)] },   // up
      { off: [0, -1], pair: [cellAt(px - 1, rowBelow), cellAt(px, rowBelow)] },  // down
      { off: [1, 0], pair: [cellAt(px, rowAbove), cellAt(px, rowBelow)] },       // right
      { off: [-1, 0], pair: [cellAt(px - 1, rowAbove), cellAt(px - 1, rowBelow)] }, // left
    ].filter((c) => (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a));
    ok(cands.length === 1, `n = ${n}: one attachment edge between pieces ${a} and ${b}`);
    const q = [px + cands[0].off[0], py + cands[0].off[1]];
    att.push({ inner: p, outer: q, mid2: [px + q[0], py + q[1]] });
  }
  // ---- 6. vectors, corrections, rotations, parity bits ----
  const turn = (u, v) => { const c = u[0] * v[1] - u[1] * v[0]; return c > 0 ? 90 : c < 0 ? -90 : 0; };
  const info = runs.map((run, i) => {
    const ain = att[(i - 1 + K) % K], aout = att[i];
    const v2 = [aout.mid2[0] - ain.mid2[0], aout.mid2[1] - ain.mid2[1]];                  // the arrow, doubled
    const path = [ain.mid2, [2 * ain.inner[0], 2 * ain.inner[1]]].concat(run.edges.map((ed) => [2 * ed.b[0], 2 * ed.b[1]]), [aout.mid2]);
    let s2 = 0;                                                                             // doubled coordinates: area = sum / 8
    for (let j = 0; j < path.length; j++) { const u = path[j], w = path[(j + 1) % path.length]; s2 += u[0] * w[1] - w[0] * u[1]; }
    const dirIn = [ain.inner[0] - ain.outer[0], ain.inner[1] - ain.outer[1]], dirOut = [aout.outer[0] - aout.inner[0], aout.outer[1] - aout.inner[1]];
    const seq = [dirIn].concat(run.edges.map((ed) => [ed.b[0] - ed.a[0], ed.b[1] - ed.a[1]]), [dirOut]);
    let D = 180;
    for (let j = 0; j + 1 < seq.length; j++) D += turn(seq[j], seq[j + 1]);
    const B = (Math.abs(aout.inner[0] - ain.inner[0]) + Math.abs(aout.inner[1] - ain.inner[1])) % 2;
    return { piece: run.piece, v2, delta: s2 / 8, D, B, ain, aout };
  });
  // The polygon of the arrows, its area, and the Lemma on the area decomposition.
  let ax = 0, ay = 0, A2 = 0;
  const verts = [];
  for (const f of info) { verts.push([ax, ay]); ax += f.v2[0]; ay += f.v2[1]; }
  ok(ax === 0 && ay === 0, `n = ${n}: the arrows close`);
  for (let j = 0; j < verts.length; j++) { const u = verts[j], w = verts[(j + 1) % verts.length]; A2 += u[0] * w[1] - w[0] * u[1]; }
  const Aref = A2 / 8;                                                                      // doubled coordinates: area = sum / 8
  const sumDelta = info.reduce((s, f) => s + f.delta, 0);
  eq(Aref + sumDelta, AREA[n], `n = ${n}: A = A_ref + the corrections (${Aref} + ${sumDelta})`);
  ok(info.every((f) => (f.delta * 8) % 1 === 0), `n = ${n}: the corrections are multiples of 1/8`);
  eq(info.reduce((s, f) => s + f.D, 0), 360, `n = ${n}: the rotations add up to 360 degrees`);
  eq(info.reduce((s, f) => s + f.B, 0) % 2, 0, `n = ${n}: the parity bits add up to an even number`);
  // the four corner pieces: rotation 90, half-integral arrow; the others: rotation 0, whole-number arrow
  const corner = info.filter((f) => f.D === 90), straight = info.filter((f) => f.D === 0);
  ok(corner.length === 4 && straight.length === K - 4, `n = ${n}: exactly four corner pieces (rotation 90), the rest straight (rotation 0)`);
  ok(corner.every((f) => f.v2[0] % 2 !== 0 && f.v2[1] % 2 !== 0) && straight.every((f) => f.v2[0] % 2 === 0 && f.v2[1] % 2 === 0),
    `n = ${n}: the corner pieces' arrows are half-integral, the others' are whole`);

  // ---- 7. the data against all of that: the order, the two attachment midpoints, the arrow ----
  const dataArrow = (p) => [p.o[0] - p.i[0], p.i[1] - p.o[1]];            // y turned up
  const runOfPiece = new Map(runs.map((r, i) => [r.piece, i]));
  e.pieces.forEach((p, j) => {
    const piece = owner.get(key(p.c[0][0], p.c[0][1])), r = runOfPiece.get(piece), f = info[r];
    ok(piece === j, `n = ${n}: piece ${j}'s cells are listed with piece ${j}`);
    const toGrid = (m2) => [m2[0], 0 - m2[1]];                             // doubled y-up -> doubled grid (rows downwards)
    eq(p.i, toGrid(f.ain.mid2), `n = ${n}: piece ${j}: the incoming attachment midpoint`);
    eq(p.o, toGrid(f.aout.mid2), `n = ${n}: piece ${j}: the outgoing attachment midpoint`);
    eq(dataArrow(p), f.v2, `n = ${n}: piece ${j}: the arrow`);
    // both midpoints are midpoints of unit edges of the piece shared with another piece
    for (const m of [p.i, p.o]) {
      const horizontal = m[0] % 2 !== 0;                                   // an odd doubled x: a horizontal edge
      ok(horizontal ? m[1] % 2 === 0 : m[1] % 2 !== 0 && m[0] % 2 === 0, `n = ${n}: piece ${j}: an attachment midpoint is the midpoint of a unit edge`);
    }
    // the next piece starts where this one ends, going once round
    const nx = e.pieces[(j + 1) % K];
    eq(nx.i, p.o, `n = ${n}: piece ${j} ends where piece ${(j + 1) % K} begins`);
    ok(runOfPiece.get(owner.get(key(nx.c[0][0], nx.c[0][1]))) === (r + 1) % K, `n = ${n}: piece ${(j + 1) % K} follows piece ${j} round the region`);
  });

  // ---- 8. the polygon: sorted by direction from the south, convex, in the lab's own build ----
  const g = P.build(P.fromPieces(e));
  ok(g.closed && g.count === K && g.L === AREA[n] && g.U === AREA[n], `n = ${n}: the lab's polygon closes, ${K} arrows, the optimum ${AREA[n]}`);
  eq(g.area, Aref, `n = ${n}: the lab's polygon area is the arrows' Shoelace area (${g.area})`);
  const dirs = e.pieces.map(dataArrow);
  const half = (v) => (v[0] > 0 || (v[0] === 0 && v[1] < 0)) ? 0 : 1;      // theta from the south: [0, 180) or [180, 360)
  ok(half(dirs[0]) === 0 && dirs.slice(0, -1).every((v, j) => {
    const w = dirs[j + 1], cross = v[0] * w[1] - v[1] * w[0];
    return half(v) < half(w) || (half(v) === half(w) && cross >= 0);
  }), `n = ${n}: the arrows are sorted by direction, from the south, counterclockwise`);
  let turned = 0;
  for (let j = 0; j < dirs.length; j++) {
    const v = dirs[j], w = dirs[(j + 1) % dirs.length], cr = v[0] * w[1] - v[1] * w[0];
    ok(cr >= 0, `n = ${n}: a left turn or straight on after arrow ${j}`);
    turned += Math.atan2(cr, v[0] * w[0] + v[1] * w[1]);
  }
  near(turned, 2 * Math.PI, 1e-9, `n = ${n}: the directions turn once round`);
  // the seg of each arrow is where the arrow lies on the polygon
  g.seg.forEach((sg, j) => {
    eq([sg[1][0] - sg[0][0], sg[1][1] - sg[0][1]], [dirs[j][0] / 2, dirs[j][1] / 2], `n = ${n}: segment ${j} is arrow ${j}`);
    if (j) eq(sg[0], g.seg[j - 1][1], `n = ${n}: segment ${j} starts where ${j - 1} ends`);
  });

  // ---- 9. which pieces take their longest arrow (the card writes the count), by brute force over boundary-edge midpoints ----
  let longest = 0;
  e.pieces.forEach((p) => {
    const set = new Set(p.c.map((c) => key(c[0], c[1]))), mids = [];
    for (const [c, r] of p.c) for (const [dx, dy] of N4) if (!set.has(key(c + dx, r + dy))) mids.push([2 * c + 1 + dx, 2 * r + 1 + dy]);
    let best = 0;
    for (const a of mids) for (const b of mids) best = Math.max(best, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    const d = p.o[0] - p.i[0], d2 = p.o[1] - p.i[1];
    ok(d * d + d2 * d2 <= best, `n = ${n}: an arrow is never longer than the piece's longest`);
    eq(S.diameters(p.c).d2, best, `n = ${n}: the lab's longest arrow is the brute-force one`);
    if (d * d + d2 * d2 === best) longest++;
  });
  eq(longest, { 4: 0, 5: 7, 6: 30 }[n], `n = ${n}: ${longest} of ${K} pieces take their longest arrow`);
  // what the arrow card says: the four corner pieces never take their longest arrow (half-integral arrows are never the
  // longest), and one straight piece in each fence gives its longest up too
  const gaveUp = e.pieces.filter((p) => {
    const set = new Set(p.c.map((c) => key(c[0], c[1]))), mids = [];
    for (const [c, r] of p.c) for (const [dx, dy] of N4) if (!set.has(key(c + dx, r + dy))) mids.push([2 * c + 1 + dx, 2 * r + 1 + dy]);
    let best = 0;
    for (const a of mids) for (const b of mids) best = Math.max(best, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    return (p.o[0] - p.i[0]) ** 2 + (p.o[1] - p.i[1]) ** 2 < best;
  });
  const isCorner = (p) => (p.o[0] - p.i[0]) % 2 !== 0;
  ok(e.pieces.filter(isCorner).length === 4 && e.pieces.filter(isCorner).every((p) => gaveUp.includes(p)), `n = ${n}: the four corner pieces give up their longest arrow`);
  eq(gaveUp.filter((p) => !isCorner(p)).length, 1, `n = ${n}: one straight piece gives up its longest arrow`);
}

// ---- 9b. the data as generated from the three fences: an edit of data/optimal.js is deliberate or it fails here ----
const crypto = require("crypto");
const digest = crypto.createHash("sha256").update(JSON.stringify(OPT)).digest("hex");
eq(digest, "f5171c2cc889582e2a4d96a758f0e63ddb0d1c2c220bc44459873f83f1118edc", "the shipped fences are the ones this test was written for");

// ---- 10. what the paper prints about these fences ----
function kinds(e) {
  const m = {};
  e.pieces.forEach((p) => {
    const u = Math.abs(p.o[0] - p.i[0]) / 2, v = Math.abs(p.o[1] - p.i[1]) / 2, k = Math.max(u, v) + "," + Math.min(u, v);
    m[k] = (m[k] || 0) + 1;
  });
  return m;
}
// Pentominoes: ten reference polygons, of two types; type 2: one arrow (1, 4), three (1, 3), the fourth corner (1.5, 3.5); the other three corners (2.5, 2.5).
const k5 = kinds(OPT[5]);
eq([k5["4,1"], k5["3,1"], k5["3.5,1.5"], k5["2.5,2.5"]], [1, 3, 1, 3], "n = 5: the polygon is of the paper's second type (Figure of the two optimal reference polygons)");
// Hexominoes: all 244 optimal polygons have the same multiset of arrow classes (Section on all optimal solutions).
eq(kinds(OPT[6]), { "6,0": 1, "5,0": 2, "4,0": 3, "5,1": 3, "4,1": 11, "3,1": 4, "4,2": 6, "3,2": 1, "2.5,2.5": 4 }, "n = 6: the paper's multiset of reference vector classes");

// ---- 11. the gaps (regression constants), and the polygon gets rounder as n grows, 4 to 15 ----
const GAP = { 4: -0.2711310, 5: 0.1435437, 6: 0.1003380 };
for (const n of NS) near(P.build(P.fromPieces(OPT[n])).gap.signed, GAP[n], 1e-7, `n = ${n}: the largest gap`);
let prev = Infinity;
for (let n = 4; n <= 15; n++) {
  const g = n <= 6 ? P.build(P.fromPieces(OPT[n])) : P.build(GREEDY[n]), a = Math.abs(g.gap.signed);
  ok(a < prev, `n = ${n}: the largest gap ${a} is below the one for n - 1 (${prev})`);
  prev = a;
}
// The greedy data agree with the polygon engine's new fields: seg runs end to end and closes.
for (let n = 7; n <= 15; n++) {
  const g = P.build(GREEDY[n]);
  eq(g.seg.length, GREEDY[n].arrows.length, `n = ${n}: one segment per run of arrows`);
  eq(g.seg[g.seg.length - 1][1], [0, 0], `n = ${n}: the last segment ends at the start`);
}

console.log(`optimal: all ${checks} assertions passed`);

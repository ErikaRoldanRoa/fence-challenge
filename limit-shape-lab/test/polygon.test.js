/* Limit-shape lab · the greedy polygons of Section 6.2. Run: node limit-shape-lab/test/polygon.test.js
 * Checked against what the paper prints (the data of its deviation figure, the counts in the comments of chain.tex,
 * A000105) and against the pieces themselves: the lab's own enumeration of all free n-ominoes gives back the
 * polygon's arrows, direction by direction. AREA and WHOLE below are regression constants of this pipeline
 * (computed from the vertex files), not the paper's numbers. */
"use strict";
const assert = require("assert");
const S = require("../sampler.js");
const P = require("../polygon.js");
const GREEDY = require("../data/greedy.js");
const DATA = require("../data/paper.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const NS = [7, 8, 9, 10, 11, 12, 13, 14, 15];
// A000105: free n-ominoes.
const FREE = { 7: 108, 8: 369, 9: 1285, 10: 4655, 11: 17073, 12: 63600, 13: 238591, 14: 901971, 15: 3426576 };

const poly = {};
for (const n of NS) {
  const g = GREEDY[n];
  ok(g && g.n === n, `data for n = ${n}`);
  poly[n] = P.build(g);
}

// One arrow per piece; the arrows close; the polygon is convex and turns once round.
for (const n of NS) {
  const g = GREEDY[n], p = poly[n];
  ok(g.count === FREE[n], `n = ${n}: ${g.count} arrows = ${FREE[n]} free ${n}-ominoes`);
  ok(g.arrows.reduce((s, a) => s + a[2], 0) === g.count, `n = ${n}: multiplicities add up to the count`);
  ok(g.arrows.reduce((s, a) => s + a[0] * a[2], 0) === 0 && g.arrows.reduce((s, a) => s + a[1] * a[2], 0) === 0, `n = ${n}: the arrows close`);
  ok(p.closed, `n = ${n}: the polygon closes`);
  let turn = 0;
  const E = p.edges;
  for (let i = 0; i < E.length; i++) {
    const a = E[i], b = E[(i + 1) % E.length], cr = a.dx * b.dy - a.dy * b.dx;
    ok(cr > 0, `n = ${n}: a left turn at corner ${i}`);
    turn += Math.atan2(cr, a.dx * b.dx + a.dy * b.dy);
  }
  near(turn, 2 * Math.PI, 1e-9, `n = ${n}: the directions turn once round`);
  const odd = g.arrows.filter((a) => a[0] % 2 !== 0 || a[1] % 2 !== 0);
  const k = Math.ceil(n / 2) - 0.5;
  ok(odd.length === 4 && odd.every((a) => a[2] === 1 && Math.abs(a[0]) / 2 === k && Math.abs(a[1]) / 2 === k), `n = ${n}: four corner arrows (${k}, ${k})`);
  // each side is a run of parallel arrows
  E.forEach((e, i) => {
    const ex = e.groups.reduce((s, a) => s + a[0] / 2 * a[2], 0), ey = e.groups.reduce((s, a) => s + a[1] / 2 * a[2], 0);
    ok(ex === e.dx && ey === e.dy, `n = ${n}: side ${i} is the sum of its arrows`);
  });
}

// The reference polygon's area against the paper's Table 4: the fence is A = A_ref + the corrections (Lemma on
// the area decomposition); most corrections are negative and their sum is, about -0.46 to -0.48 times the
// perimeter (a guard against damaged data, not a theorem). AREA: the Shoelace area of the vertex files.
const AREA = { 7: 19949, 8: 280003, 9: 4007124.5, 10: 60845874, 11: 934251684.5, 12: 14625434329.5, 13: 229831098437.5, 14: 3635792798798.5, 15: 57656594181670.5 };
for (const n of NS) {
  const p = poly[n];
  near(p.area, AREA[n], 0, `n = ${n}: reference polygon area`);
  const corr = p.L - p.area;
  ok(corr < 0 && p.U > p.L, `n = ${n}: the corrections add up to ${corr}, negative, and the bound lies above the fence`);
  const r = -corr / p.perimeter;
  ok(r > 0.45 && r < 0.48, `n = ${n}: corrections / perimeter = ${r.toFixed(4)}`);
}

// The paper's own figure data: the sector S to SE of the polygons for n = 9, 11, 13, 15.
for (const n of [9, 11, 13, 15]) {
  const mine = P.sectorCorners(poly[n]), paper = DATA.fences[n].corners;
  ok(mine.length === paper.length, `n = ${n}: ${mine.length} true corners in the sector (paper: ${paper.length})`);
  mine.forEach((c, i) => {
    near(c[0], paper[i][0], 5.01e-5, `n = ${n}: corner ${i} angle`);
    near(c[1], paper[i][1], 2e-8, `n = ${n}: corner ${i} gap`);
  });
  // the whole printed curve, which the paper evaluates on rays through the vertices and on equal rays
  let worst = 0;
  for (const [phi, dev] of DATA.fences[n].dev) worst = Math.max(worst, Math.abs(P.gapAt(poly[n], phi) - dev));
  ok(worst < 5e-7, `n = ${n}: the paper's ${DATA.fences[n].dev.length} curve points reproduced to ${worst.toExponential(2)}`);
  const top = Math.max(...DATA.fences[n].dev.map((d) => d[1])), bottom = Math.min(...DATA.fences[n].dev.map((d) => d[1]));
  const sec = [];
  for (let t = 0; t <= 45 + 1e-9; t += 0.01) sec.push(P.gapAt(poly[n], t));
  near(Math.max(...sec), top, 2e-6, `n = ${n}: largest gap in the sector`);
  near(Math.min(...sec), bottom, 2e-6, `n = ${n}: smallest gap in the sector`);
}
// the exact range over the sector, from the corners and the feet of the perpendiculars (no sampling)
for (const n of [9, 11, 13, 15]) {
  const paper = DATA.fences[n].dev.concat(DATA.fences[n].corners).map((d) => d[1]);
  const r = P.range(poly[n], 0, 45), top = Math.max(...paper), bottom = Math.min(...paper);
  near(r.max, top, 1e-8, `n = ${n}: exact largest gap in the sector`);
  ok(r.min <= bottom + 1e-9 && r.min > bottom - 2e-6, `n = ${n}: exact smallest gap in the sector ${r.min} (paper's rays: ${bottom})`);
}
// as printed in the comment of chain.tex (relative deviation 0 .. 0.069, -0.00135 .. 0.0602, -0.00188 .. 0.0512,
// -0.00206 .. 0.0449), each within half a unit of its last printed digit
[[9, 0, 1e-9, 0.069, 5e-4], [11, -0.00135, 5e-6, 0.0602, 5e-5], [13, -0.00188, 5e-6, 0.0512, 5e-5], [15, -0.00206, 5e-6, 0.0449, 5e-5]].forEach(([n, lo, tlo, hi, thi]) => {
  const r = P.range(poly[n], 0, 45);
  near(r.max, hi, thi, `n = ${n}: printed largest gap`);
  near(r.min, lo, tlo, `n = ${n}: printed smallest gap`);
});

// The vertices strictly inside the sector S to SE, counted along the arrows, vertex by vertex: the comment of chain.tex
// prints 159, 2117, 29630 and 426119 « in the section ». (Inside: vx > 0 and vx < -vy, from the centre K, exact.)
const IN_SECTION = { 9: 159, 11: 2117, 13: 29630, 15: 426119 };
for (const n of [9, 11, 13, 15]) {
  const p = poly[n];
  let x = 0, y = 0, inside = 0, all = 0;
  for (const a of GREEDY[n].arrows) {
    for (let m = 0; m < a[2]; m++) {
      const vx = x - p.kx, vy = y - p.ky;
      all++;
      if (vx > 0 && vx < -vy) inside++;
      x += a[0] / 2; y += a[1] / 2;
    }
  }
  ok(all === GREEDY[n].count, `n = ${n}: one vertex per arrow`);
  ok(inside === IN_SECTION[n], `n = ${n}: ${inside} vertices strictly inside the sector (the paper's comment: ${IN_SECTION[n]})`);
}

// The whole polygon is not eight copies of its sector: the largest gap over all directions.
const WHOLE = { 7: 0.08671, 8: 0.08144, 9: 0.06962, 10: 0.0664, 11: 0.06027, 12: 0.05566, 13: 0.0512, 14: 0.04772, 15: 0.04485 };
for (const n of NS) near(poly[n].gap.max, WHOLE[n], 1.5e-5, `n = ${n}: largest gap over the whole polygon`);
ok(poly[9].gap.max > P.gapAt(poly[9], 44.9) + 0.0005, "n = 9: the whole polygon bulges further than the sector of the figure");
// the gap function is continuous and agrees with the corners
for (const n of NS) {
  const p = poly[n];
  p.corners.forEach((c, i) => {
    const t = P.theta(c[0] - p.kx, c[1] - p.ky);
    near(P.gapAt(p, t), Math.hypot(c[0] - p.kx, c[1] - p.ky) / p.R - 1, 1e-9, `n = ${n}: gap at corner ${i}`);
  });
  const s = P.samples(p, 0.25);
  ok(s[0][0] === 0 && s[s.length - 1][0] === 360 && s.every((q, i) => !i || q[0] > s[i - 1][0]), `n = ${n}: samples run from 0 to 360 in order`);
  ok(s.length >= 1441 && s.length <= 1441 + p.corners.length, `n = ${n}: ${s.length} samples`);
}

// The pieces themselves: all free n-ominoes, their longest arrows, against the polygon's arrows.
// The greedy keeps every piece's longest arrow except the four corner pieces (they take the diagonal arrow
// (ceil(n/2) - 1/2) * (1, 1)) and, when the parity asks for it, one piece whose arrow (n - 1, 1) is used as (n - 1, 0).
for (const n of [7, 8, 9, 10, 11]) {
  const pieces = S.enumerateFree(n);
  ok(pieces.length === FREE[n], `n = ${n}: ${pieces.length} free ${n}-ominoes`);
  const d2 = new Map();
  for (const cells of pieces) { const k = S.diameters(cells).d2; d2.set(k, (d2.get(k) || 0) + 1); }
  const arr = new Map();
  for (const a of GREEDY[n].arrows) { const k = a[0] * a[0] + a[1] * a[1]; arr.set(k, (arr.get(k) || 0) + a[2]); }
  const onlyPieces = [], onlyArrows = [];
  for (const k of new Set([...d2.keys(), ...arr.keys()])) {
    const d = (d2.get(k) || 0) - (arr.get(k) || 0);
    for (let i = 0; i < Math.abs(d); i++) (d > 0 ? onlyPieces : onlyArrows).push(k);
  }
  const k2 = 2 * Math.ceil(n / 2) - 1, corner = 2 * k2 * k2, stick = 4 * (n - 1) * (n - 1);
  const wantPieces = [corner + 2, corner + 2, corner + 2, corner + 2], wantArrows = [corner, corner, corner, corner];
  if (n !== 11) { wantPieces.push(stick + 4); wantArrows.push(stick); }
  assert.deepStrictEqual(onlyPieces.sort((a, b) => a - b), wantPieces.sort((a, b) => a - b), `n = ${n}: pieces without an arrow`); checks++;
  assert.deepStrictEqual(onlyArrows.sort((a, b) => a - b), wantArrows.sort((a, b) => a - b), `n = ${n}: arrows without a piece`); checks++;
}

// Direction by direction. Every piece's longest arrow, folded to 0..45 degrees, is an arrow of the polygon, except:
// the four corner pieces (the polygon takes the diagonal arrow for them; their own longest arrow is (k, k - 1),
// k = ceil(n / 2)) and, when the parity asks, one piece whose arrow (n - 1, 1) is used as (n - 1, 0). A piece whose
// longest arrows fold to several kinds (a tie) may give any of them, so it can account for one arrow of another kind.
for (const n of [7, 8, 9, 10, 11]) {
  const U = new Map(), D = new Map();
  let ties = 0;
  for (const cells of S.enumerateFree(n)) {
    const kinds = new Set(S.diameters(cells).pairs.map(([p, q]) => S.normalize([(q[0] - p[0]) / 2, (q[1] - p[1]) / 2]).join(",")));
    if (kinds.size === 1) { const k = [...kinds][0]; U.set(k, (U.get(k) || 0) + 1); } else ties++;
  }
  P.folded(poly[n]).forEach((a) => D.set(a[0] + "," + a[1], a[2]));
  const missing = new Map();
  let extra = 0;
  for (const k of new Set([...U.keys(), ...D.keys()])) {
    const d = (D.get(k) || 0) - (U.get(k) || 0);
    if (d < 0) missing.set(k, -d); else extra += d;
  }
  const k = Math.ceil(n / 2), corner = `${k},${k - 1}`, parity = `${n - 1},1`, hasParity = n !== 11;
  const allowed = new Map([[corner, 4]]);
  if (hasParity) allowed.set(parity, 1);
  for (const [key, m] of missing) ok(allowed.has(key) && m <= allowed.get(key), `n = ${n}: the arrow (${key}) of ${m} pieces is not in the polygon`);
  const gone = (key) => missing.get(key) || 0;
  ok(4 - gone(corner) <= ties, `n = ${n}: the corner pieces whose arrow is still there are ties`);
  if (hasParity) ok(1 - gone(parity) <= ties, `n = ${n}: the L piece's arrow is not in the polygon, or it is a tie`);
  ok(extra <= ties + 4 + (hasParity ? 1 : 0), `n = ${n}: ${extra} arrows of the polygon that no single-arrow piece gives, for ${ties} ties and the exceptions`);
}

// The folded arrows and where they lie on the polygon.
for (const n of NS) {
  const p = poly[n], f = P.folded(p);
  ok(f.reduce((s, a) => s + a[2], 0) === p.count, `n = ${n}: folded multiplicities add up`);
  ok(f.every((a) => a[0] >= a[1] && a[1] >= 0), `n = ${n}: folded into 0..45 degrees`);
  ok(f.filter((a) => a[3]).length === 1, `n = ${n}: one folded corner arrow`);
  let len = 0;
  for (const a of f) for (const [u, v] of P.placesOf(p, a[0], a[1])) len += Math.hypot(v[0] - u[0], v[1] - u[1]);
  near(len, p.perimeter, 1e-6 * p.perimeter, `n = ${n}: the places of all kinds cover the perimeter`);
}

// polar(): a point of the plane as (theta, gap) from K, on the corners and on the middle of every side, and
// gapAt agrees with it.
for (const n of NS) {
  const p = poly[n], N = p.corners.length;
  p.corners.forEach((c, i) => {
    const [t, g] = P.polar(p, c[0], c[1]);
    near(t, P.theta(c[0] - p.kx, c[1] - p.ky), 1e-12, `n = ${n}: polar angle of corner ${i}`);
    near(g, Math.hypot(c[0] - p.kx, c[1] - p.ky) / p.R - 1, 1e-12, `n = ${n}: polar gap of corner ${i}`);
    const d = p.corners[(i + 1) % N];
    const [tm, gm] = P.polar(p, (c[0] + d[0]) / 2, (c[1] + d[1]) / 2);
    near(P.gapAt(p, tm), gm, 1e-9, `n = ${n}: gapAt agrees with polar in the middle of side ${i}`);
  });
}

// The deepest dip and the highest bulge are the true extremes over all directions (brute force, 0.01 degree), and the
// exact range over the whole circle says the same.
for (const n of NS) {
  const p = poly[n];
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 360; t += 0.01) { const g = P.gapAt(p, t); lo = Math.min(lo, g); hi = Math.max(hi, g); }
  ok(p.gap.min <= lo + 1e-12 && p.gap.min >= lo - 2e-6, `n = ${n}: smallest gap ${p.gap.min} against ${lo} by brute force`);
  // the bulge is a corner, a sharp peak: a 0.01 degree grid can miss its top by a few millionths
  ok(p.gap.max >= hi - 1e-12 && p.gap.max <= hi + 5e-5, `n = ${n}: largest gap ${p.gap.max} against ${hi} by brute force`);
  const r = P.range(p, 0, 360);
  near(r.min, p.gap.min, 1e-12, `n = ${n}: range(0, 360).min = gap.min`);
  near(r.max, p.gap.max, 1e-12, `n = ${n}: range(0, 360).max = gap.max`);
}

// samples(): every corner is a sample, so the drawn curve is exact.
for (const n of NS) {
  const p = poly[n], sm = P.samples(p, 0.25);
  p.edges.forEach((e, i) => ok(sm.some((q) => Math.abs(q[0] - e.t0 % 360) < 1e-9), `n = ${n}: corner ${i} is a sample`));
}

// Inside a side the arrows keep the order of the vertex file, which the data's generator checks vertex by vertex:
// pinned on n = 7's east side and n = 9's bottom and left sides, and on where n = 9's (6, 0) arrows lie.
{
  const side = (n, f) => poly[n].edges.find((e) => f(e.groups[0]) && e.groups.length > 1);
  assert.deepStrictEqual(side(7, (a) => a[0] > 0 && a[1] === 0).groups, [[8, 0, 1], [10, 0, 3]]); checks++;
  const bottom = side(9, (a) => a[0] > 0 && a[1] === 0);
  assert.deepStrictEqual(bottom.groups, [[10, 0, 12], [12, 0, 12], [14, 0, 4], [18, 0, 1]]); checks++;
  assert.deepStrictEqual(side(9, (a) => a[0] === 0 && a[1] < 0).groups, [[0, -16, 1], [0, -14, 7], [0, -12, 10], [0, -10, 13]]); checks++;
  const c = poly[9].corners[bottom.i], seg = P.placesOf(poly[9], 6, 0).find(([a]) => a[1] === c[1] && a[0] >= c[0]);
  ok(seg && seg[0][0] === c[0] + 60 && seg[1][0] === c[0] + 132, "n = 9: the six twelve arrows (6, 0) lie 60 to 132 along the bottom side");
}

console.log(`polygon: all ${checks} assertions passed`);

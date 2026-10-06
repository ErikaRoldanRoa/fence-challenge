/* node hexomino-lab/test/fence-math.test.js
 * Geometry checks on the bundled fences. */
"use strict";
const assert = require("assert");
const M = require("../fence-math.js");
const FENCES = require("../data/fences.js");
const PIECES = require("../pieces.js");

// The 35 free hexominoes.
assert.strictEqual(PIECES.length, 35, "35 free hexominoes");
assert.strictEqual(new Set(PIECES.map((p) => M.canonical(p.cells))).size, 35, "all distinct");
for (const p of PIECES) {
  assert.strictEqual(p.cells.length, 6);
  assert.ok(M.isConnected(p.cells, M.N4), "edge-connected");
  M.clockwiseBoundary(p.cells); // boundary is a simple cycle
}

function check(name, expected) {
  const pieces = M.parseGrid(FENCES[name]);
  assert.strictEqual(pieces.length, 35, name + ": 35 pieces");
  const canon = pieces.map((p) => M.canonical(p.cells));
  assert.strictEqual(new Set(canon).size, 35, name + ": each hexomino once");
  const all = new Set(PIECES.map((p) => M.canonical(p.cells)));
  for (const c of canon) assert.ok(all.has(c), name + ": a free hexomino");
  const a = M.analyzeFence(pieces);
  assert.ok(a.valid, name + ": disjoint, union 4-connected ");
  assert.strictEqual(a.area, expected.area, name + ": area");
  const r = M.referenceData(pieces, a.largest);
  assert.ok(r.ok, name + ": reference data");
  assert.strictEqual(r.order.length, 35, name + ": every piece around the region once");
  assert.strictEqual(r.aRef + r.sumDelta, a.area, name + ": A = A_ref + sum Delta");
  assert.strictEqual(r.sumD, 360, name + ": sum of rotations 360");
  assert.deepStrictEqual(r.order.map((o) => o.D).filter((d) => d !== 0), [90, 90, 90, 90], name + ": four corner pieces");
  for (const o of r.order) assert.ok(Number.isInteger(o.delta * 8), "corrections are multiples of 1/8");
  if (expected.aRef !== undefined) assert.strictEqual(r.aRef, expected.aRef, name + ": A_ref");
  const cv = M.convexArrangement(r.order.map((o) => o.v));
  assert.ok(cv.area >= r.aRef - 1e-9, name + ": convex arrangement is at least A_ref");
  return { pieces, a, r, cv };
}

// The 1597 fence: reference polygon area 1663.
const f1597 = check("1597", { area: 1597, aRef: 1663 });
assert.strictEqual(f1597.r.sumDelta, -66);
// Its multiset of reference vector classes.
const multiset = {};
for (const o of f1597.r.order) {
  const [x, y] = o.v.map(Math.abs).sort((p, q) => p - q);
  const k = x + "," + y;
  multiset[k] = (multiset[k] || 0) + 1;
}
assert.deepStrictEqual(multiset, {
  "0,5": 2, "0,6": 1, "1,5": 3, "0,4": 3, "1,3": 4, "1,4": 11, "2,3": 1, "2,4": 6, "2.5,2.5": 4,
});

// Minkowski bound for the 1597 fence.
assert.strictEqual(M.minkowskiBound(f1597.r.order.map((o) => o.v)), 1666.5625);

// The 1586 fence.
const f1586 = check("1586", { area: 1586 });
assert.strictEqual(M.minkowskiBound(f1586.r.order.map((o) => o.v)), 1663.84375);

// Shuffling the vectors never beats the sorted (convex) order.
const vs = f1597.r.order.map((o) => o.v);
for (let t = 0; t < 200; t++) {
  const s = vs.slice().sort(() => Math.random() - 0.5);
  const pts = [[0, 0]];
  for (const v of s.slice(0, -1)) pts.push([pts[pts.length - 1][0] + v[0], pts[pts.length - 1][1] + v[1]]);
  assert.ok(M.shoelace(pts) <= f1597.cv.area + 1e-9);
}

// A tiny fence: the 2x2 hole of four dominoes... built from unit checks.
const ring = M.analyzeFence([{ id: "a", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]] }]);
assert.strictEqual(ring.area, 4);
// A corner gap leaks (8-connected free cells).
const leak = M.analyzeFence([{ id: "a", cells: [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]] }]);
assert.strictEqual(leak.valid, false, "not 4-connected");

console.log("fence-math: all assertions passed");

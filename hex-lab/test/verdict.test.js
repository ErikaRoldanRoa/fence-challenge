/* node hex-lab/test/verdict.test.js
 * The verdict on a configuration: the order of the pieces around the inside, and what the data says of it. */
"use strict";
const assert = require("assert");
const LatticeHex = require("../../lattice-hex.js");
const FenceAnalysis = require("../../fence-analysis.js");
const DATA = require("../data/orders.js");
const V = require("../verdict.js");

const board = LatticeHex.buildBoard({ radius: 6 });
const PIECES = DATA.pieces;

function permutations(list) {
  if (list.length <= 1) return [list];
  const out = [];
  list.forEach((x, i) => {
    for (const rest of permutations(list.slice(0, i).concat(list.slice(i + 1)))) out.push([x].concat(rest));
  });
  return out;
}

/* ---- the data: every cyclic order of the seven pieces, once, with one of three areas ---- */
assert.deepStrictEqual(PIECES, ["arc", "bar", "bee", "pistol", "propeller", "wave", "worm"]);
const keys = Object.keys(DATA.areaByOrder);
assert.strictEqual(keys.length, 360, "(7 - 1)! / 2 orders");
const everyOrder = new Set(permutations(PIECES).map((p) => V.canonicalKey(p)));
assert.strictEqual(everyOrder.size, 360);
assert.deepStrictEqual(new Set(keys), everyOrder, "the data holds each cyclic order exactly once");
for (const k of keys) assert.strictEqual(V.canonicalKey(k.split(",")), k, "keys are in canonical spelling: " + k);
const areas = new Set(Object.values(DATA.areaByOrder));
assert.deepStrictEqual([...areas].sort(), [33, 34, 35]);
assert.strictEqual(DATA.best, 35);
assert.deepStrictEqual(V.counts(), { orders: 360, atBest: 60 });

/* ---- the key does not depend on where the order starts or which way it is read ---- */
const sample = keys[17].split(",");
for (const seq of [sample, sample.slice().reverse()]) {
  for (let k = 0; k < 7; k += 1) assert.strictEqual(V.canonicalKey(seq.slice(k).concat(seq.slice(0, k))), keys[17]);
}

/* ---- closed fences: area from the lab's own rule, order from the walk, verdict from the data ---- */
function fenceOf(pieces) {
  const occupied = new Set(), owner = new Map();
  for (const [name, cells] of Object.entries(pieces)) {
    for (const [q, r] of cells) {
      const k = q + "," + r;
      assert.ok(board.map.has(k), name + " " + k + " is on the board");
      assert.ok(!occupied.has(k), "pieces do not overlap");
      occupied.add(k); owner.set(k, name);
    }
  }
  const res = FenceAnalysis.analyze({ board, lattice: LatticeHex, occupied });
  return { res, owner };
}

// One of the two fences the paper draws (its Figure 8, top), named by shape.
const published = [[[6, 3], [7, 1], [7, 2], [8, 2]], [[2, -1], [3, -1], [4, -2], [5, -2]], [[-2, 4], [-2, 5], [-1, 3], [-1, 5]],
  [[-1, 6], [0, 6], [1, 6], [2, 6]], [[6, -2], [7, -2], [7, -1], [7, 0]], [[3, 5], [4, 4], [4, 5], [5, 4]], [[-1, 2], [0, 0], [0, 1], [1, 0]]];
const named = LatticeHex.TETRAHEX_FULL_SET.build(published.map((cells) => cells.map(([q, r]) => ({ q, r }))));
const shift = [-3, -2];                                   // puts it in the middle of the board
const figure8 = {};
named.forEach((p, i) => { figure8[p.id] = published[i].map(([q, r]) => [q + shift[0], r + shift[1]]); });

const FIXTURES = [
  { name: "the paper's fence at the top area", area: 35, verdict: "best", pieces: figure8 },
  { name: "better at 34", area: 34, verdict: "better", pieces: {"arc":[[-2,4],[-1,4],[0,2],[0,3]],"bar":[[-6,2],[-6,3],[-6,4],[-6,5]],"bee":[[-6,0],[-6,1],[-5,-1],[-5,0]],"pistol":[[1,-1],[1,0],[1,1],[2,-1]],"propeller":[[0,-3],[1,-3],[1,-2],[2,-4]],"wave":[[-6,6],[-5,6],[-4,5],[-3,5]],"worm":[[-4,-2],[-3,-3],[-2,-3],[-1,-3]]} },
  { name: "notYet at 34", area: 34, verdict: "notYet", pieces: {"arc":[[-5,5],[-5,6],[-4,6],[-3,5]],"bar":[[-5,1],[-5,2],[-5,3],[-5,4]],"bee":[[-2,5],[-1,4],[-1,5],[0,4]],"pistol":[[-2,-3],[-1,-4],[-1,-3],[0,-3]],"propeller":[[-5,-1],[-4,-1],[-4,0],[-3,-2]],"wave":[[1,2],[1,3],[2,0],[2,1]],"worm":[[1,-3],[2,-3],[2,-2],[2,-1]]} },
  { name: "notYet at 33", area: 33, verdict: "notYet", pieces: {"arc":[[-1,4],[0,4],[1,2],[1,3]],"bar":[[-5,2],[-5,3],[-5,4],[-5,5]],"bee":[[1,0],[1,1],[2,-1],[2,0]],"pistol":[[-3,-2],[-2,-3],[-1,-4],[-1,-3]],"propeller":[[-6,0],[-5,0],[-5,1],[-4,-1]],"wave":[[-5,6],[-4,6],[-3,5],[-2,5]],"worm":[[0,-3],[1,-3],[2,-3],[2,-2]]} },
  { name: "better at 31", area: 31, verdict: "better", pieces: {"arc":[[-1,4],[0,4],[1,2],[1,3]],"bar":[[-6,2],[-6,3],[-6,4],[-6,5]],"bee":[[0,1],[1,0],[1,1],[2,0]],"pistol":[[-6,0],[-6,1],[-5,0],[-4,-1]],"propeller":[[-3,-2],[-2,-4],[-2,-3],[-1,-3]],"wave":[[-5,5],[-4,5],[-3,4],[-2,4]],"worm":[[0,-3],[1,-3],[1,-2],[1,-1]]} },
];

for (const f of FIXTURES) {
  const { res, owner } = fenceOf(f.pieces);
  assert.strictEqual(res.regionCount, 1, f.name + ": one inside");
  assert.strictEqual(res.area, f.area, f.name + ": area");
  const order = V.configuration(owner, res.enclosedSet);
  assert.ok(order, f.name + ": the seven pieces stand around the inside");
  assert.strictEqual(new Set(order).size, 7);
  assert.strictEqual(V.verdict(order, res.area), f.verdict, f.name + ": verdict");
  // the same fence read from any start of the walk gives the same order: the verdict does not depend on which cell it starts from
  const flipped = V.configuration(owner, new Set([...res.enclosedSet].reverse()));
  assert.strictEqual(V.canonicalKey(flipped), V.canonicalKey(order), f.name + ": same order whichever cell the walk starts at");
}

/* ---- nothing to say when the fence is not a closed ring of all seven ---- */
{
  const { res, owner } = fenceOf(FIXTURES[0].pieces);
  const order = V.configuration(owner, res.enclosedSet);
  const without = new Map([...owner].filter(([, name]) => name !== "bee"));
  assert.strictEqual(V.configuration(without, res.enclosedSet), null, "a piece missing: the edge has nothing behind it");
  assert.strictEqual(V.configuration(owner, new Set()), null, "no inside");
  assert.strictEqual(V.verdict(order, 36), null, "an area above what the data allows says nothing");
  assert.strictEqual(V.verdict(["arc", "bar", "bee"], 3), null, "an unknown order says nothing");
}

/* ---- an inside with a hole has no single walk round it: a piece stands inside it, so there are two boundaries ---- */
{
  const { res, owner } = fenceOf(FIXTURES[0].pieces);
  const STEP = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const near = (k) => { const [q, r] = k.split(",").map(Number); return STEP.map(([dq, dr]) => (q + dq) + "," + (r + dr)); };
  const deep = [...res.enclosedSet].find((k) => near(k).every((n) => res.enclosedSet.has(n) && near(n).every((m) => res.enclosedSet.has(m))));
  assert.ok(deep, "a hexagon well inside the inside");
  const holed = new Set(res.enclosedSet);
  holed.delete(deep);
  const island = new Map(owner);
  island.set(deep, "arc");
  assert.strictEqual(V.configuration(island, holed), null);
}

/* ---- the tiers: how far a configuration's best falls short of the best of all ---- */
for (const [area, tier] of [[35, "gold"], [34, "silver"], [33, "bronze"]]) {
  const key = keys.find((k) => DATA.areaByOrder[k] === area);
  assert.strictEqual(V.tier(key.split(",")), tier, "the tier of a configuration whose best is " + area);
}
assert.strictEqual(V.tier(["arc", "bar"]), null, "an unknown order has no tier");

console.log("verdict.test.js: ok (" + keys.length + " orders, " + FIXTURES.length + " fences)");

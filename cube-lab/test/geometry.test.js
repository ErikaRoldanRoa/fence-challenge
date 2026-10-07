// node cube-lab/test/geometry.test.js
"use strict";
const assert = require("assert");
const G = require("../geometry.js");
const S = require("../solutions.js");
const WALLS = require("../walls.js");

// Polycubes up to turning in space (mirror twins counted apart).
assert.deepStrictEqual([1, 2, 3, 4, 5].map((n) => G.polycubes(n).length), [1, 1, 2, 8, 29]);
assert.strictEqual(G.ROTATIONS.length, 24);
const chiralPairs = (n) => G.polycubes(n).filter((p) => G.canon(p) !== G.canon(G.mirror(p))).length / 2;
assert.strictEqual(chiralPairs(4), 1, "one mirror pair of tetracubes");
assert.strictEqual(chiralPairs(5), 6, "six mirror pairs of pentacubes");

const shell = (a, b, c) => {
  const out = [];
  for (let x = 0; x < a + 2; x++) for (let y = 0; y < b + 2; y++) for (let z = 0; z < c + 2; z++)
    if (x === 0 || y === 0 || z === 0 || x === a + 1 || y === b + 1 || z === c + 1) out.push([x, y, z]);
  return out;
};
const without = (cells, k) => cells.filter((c) => G.key(c) !== k);

// One empty cube: 26 around it under the 26-neighbour rule, 6 if only faces leak.
assert.strictEqual(G.enclosed(shell(1, 1, 1)).volume, 1);
assert.strictEqual(G.enclosed(without(shell(1, 1, 1), "0,0,0")).volume, 0, "a corner leaks (26)");
assert.strictEqual(G.enclosed(without(shell(1, 1, 1), "0,0,1")).volume, 0, "an edge leaks (26)");
assert.strictEqual(G.enclosed(without(shell(1, 1, 1), "0,0,0"), 6).volume, 1, "a corner holds (6)");
const plus = [[1, 1, 0], [1, 1, 2], [0, 1, 1], [2, 1, 1], [1, 0, 1], [1, 2, 1]];
assert.strictEqual(G.enclosed(plus, 6).volume, 1);
assert.strictEqual(G.enclosed(plus, 26).volume, 0);
// Boxes.
assert.strictEqual(G.enclosed(shell(3, 4, 4)).volume, 48);
assert.strictEqual(shell(3, 3, 6).length, 146);
assert.strictEqual(G.enclosed(shell(3, 3, 6)).volume, 54);
// Two empty cells touching along an edge: one region under 26, two under 6.
const diag = shell(2, 2, 1).concat([[2, 1, 1], [1, 2, 1]]);
assert.deepStrictEqual([G.enclosed(diag).volume, G.enclosed(diag).regions], [2, 1]);
assert.deepStrictEqual([G.enclosed(diag, 6).volume, G.enclosed(diag, 6).regions], [1, 2]);

// The reader takes both file shapes.
assert.deepStrictEqual(S.parse([[3, 3, 3], [0, 0, 0, "#AA0000"], [1, 0, 0, "#aa0000"], [2, 2, 2, "#AA0000"]]).pieces.length, 2);
assert.deepStrictEqual(S.parse([[3, 3, 3], [7, 0, 0, 0], [7, 0, 1, 0], [9, 2, 2, 2]]).pieces, [[[0, 0, 0], [0, 1, 0]], [[2, 2, 2]]]);

// The three walls of walls.js: right pieces, no overlap, and the
// announced volume under both rules.
const expect = { penta_v52: [5, 29, 52], hexa_v1331: [6, 166, 1331], hepta_v25544: [7, 1020, 25544] };
assert.deepStrictEqual(WALLS.map((w) => w.id), Object.keys(expect));
for (const w of WALLS) {
  const [n, count, vol] = expect[w.id];
  assert.strictEqual(w.pieces.length, count, w.id);
  w.pieces.forEach((p) => { assert.strictEqual(p.length, n); assert.ok(G.isFaceConnected(p)); });
  const cells = w.pieces.flat();
  assert.strictEqual(new Set(cells.map(G.key)).size, cells.length, w.id + " overlap");
  if (n === 5) assert.strictEqual(new Set(w.pieces.map((p) => G.canon(p))).size, count, w.id + " pieces distinct");
  for (const conn of [26, 6]) {
    const r = G.enclosed(cells, conn);
    assert.strictEqual(r.volume, vol, w.id + " conn " + conn);
    assert.strictEqual(r.regions, 1);
  }
}
console.log("geometry: all assertions passed");

// Tetracubes: the 8 pieces, 32 cubes. Two walls found by search
// (test/tetracube-witnesses.json), one per rule.
{
  const wit = require("./tetracube-witnesses.json");
  const tetra = new Set(G.polycubes(4).map((p) => G.canon(p)));
  for (const [rule, conn, vol] of [["rule26", 26, 1], ["rule6", 6, 7]]) {
    const wall = wit[rule].wall;
    assert.ok(wall.length <= 8);
    const names = wall.map((p) => G.canon(p));
    assert.strictEqual(new Set(names).size, wall.length, rule + " pieces distinct");
    names.forEach((n) => assert.ok(tetra.has(n)));
    const cells = wall.flat();
    assert.strictEqual(new Set(cells.map(G.key)).size, cells.length, rule + " overlap");
    assert.strictEqual(G.enclosed(cells, conn).volume, vol, rule);
  }
  // Under the 26-neighbour rule two empty cells need 34 cubes around them: two
  // 3 x 3 x 3 blocks overlap in at most 18 cells, so N(S) has at least 36.
  // 32 cubes can therefore never shut in more than one cell.
  let most = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    if (!dx && !dy && !dz) continue;
    const o = Math.max(0, 3 - Math.abs(dx)) * Math.max(0, 3 - Math.abs(dy)) * Math.max(0, 3 - Math.abs(dz));
    most = Math.max(most, o);
  }
  assert.strictEqual(most, 18);
  assert.ok(54 - most - 2 > 32);
}
console.log("tetracubes: witnesses checked");

// Wrap the room: every room offered has a wall of distinct pieces of its
// step that shuts it in, under both rules, never covering the room.
{
  const ROOMS = require("../rooms.js");
  const steps = { tetra: G.polycubes(4), penta: G.polycubes(5) };
  const N26 = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) N26.push([x, y, z]);
  assert.ok(ROOMS.length >= 2);
  for (const r of ROOMS) {
    const names = new Set(steps[r.step].map((p) => G.canon(p)));
    const used = r.witness.map((p) => G.canon(p));
    assert.strictEqual(new Set(used).size, used.length, r.id + " pieces distinct");
    used.forEach((u) => assert.ok(names.has(u), r.id + " piece of its step"));
    const cells = r.witness.flat(), room = new Set(r.room.map(G.key));
    assert.strictEqual(new Set(cells.map(G.key)).size, cells.length, r.id + " overlap");
    assert.ok(cells.every((c) => !room.has(G.key(c))), r.id + " wall in the room");
    assert.strictEqual(cells.length, r.witness.length * steps[r.step][0].length);
    // the smallest wall N(S) \ S, as stored
    const h = new Set();
    r.room.forEach((c) => N26.forEach((d) => { const q = G.key([c[0] + d[0], c[1] + d[1], c[2] + d[2]]); if (!room.has(q)) h.add(q); }));
    assert.strictEqual(h.size, r.wall26, r.id + " wall26");
    for (const conn of [26, 6]) {
      const inside = new Set(G.enclosed(cells, conn).all.map(G.key));
      assert.ok(r.room.every((c) => inside.has(G.key(c))), r.id + " shut in, rule " + conn);
    }
  }
  console.log("rooms: " + ROOMS.map((r) => r.id).join(" ") + " wrapped");
}

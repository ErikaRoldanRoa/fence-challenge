/* node square-lab/test/verdict.test.js
 * What a closed fence of all twelve pentominoes says about its configuration: the pieces round the inside, read from the board,
 * and the verdict for its area. The two fences are boards the tables built, each the best fence of its configuration; the
 * small board at the end has a piece that touches the inside only at a corner. */
"use strict";
const assert = require("assert");
const V = require("../verdict.js");
const B = require("../best-fence.js");
const fences = require("./fences.fixture.json");

assert.ok(fences.length >= 2);
for (const f of fences) {
  const owner = new Map(Object.entries(f.cells));
  const inside = new Set(f.inside);
  assert.strictEqual(inside.size, f.area);

  /* ---- the configuration read off the board is the one the fence was built for ---- */
  const order = V.configuration(owner, inside);
  assert.ok(order, "a configuration");
  assert.strictEqual(order.length, 12);
  assert.strictEqual(V.canonicalKey(order), V.canonicalKey(f.order));

  /* ---- the verdict: below its best a configuration can still do better; at its best it is done ---- */
  assert.strictEqual(B.bestArea(order), f.area);
  assert.strictEqual(V.verdict(order, f.area), "notYet");
  assert.strictEqual(V.verdict(order, f.area - 1), "better");
  assert.strictEqual(V.verdict(order, f.area + 1), null, "above what the data allow there is nothing to say");
  assert.strictEqual(V.tier(order), "bronze");

  /* ---- an open fence has no configuration: a cell behind the inside has no piece ---- */
  const some = [...inside].find((k) => {
    const [x, y] = k.split(",").map(Number);
    return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].some((c) => !inside.has(c.join(",")));
  });
  const [x, y] = some.split(",").map(Number);
  const open = new Map(owner);
  for (const c of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) if (!inside.has(c.join(","))) open.delete(c.join(","));
  assert.strictEqual(V.configuration(open, inside), null);

  /* ---- an inside with a hole has no single walk round it: a piece stands inside it, so there are two boundaries ---- */
  const deep = [...inside].find((k) => {
    const [x, y] = k.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (!inside.has((x + dx) + "," + (y + dy))) return false;
    return true;
  });
  assert.ok(deep, "a cell well inside the inside");
  const holed = new Set(inside);
  holed.delete(deep);
  const island = new Map(owner);
  island.set(deep, order[0]);
  assert.strictEqual(V.orderAround(island, holed), null);
  assert.strictEqual(V.configuration(island, holed), null);

  /* ---- fewer than twelve pieces, or nothing inside: no configuration ---- */
  const fewer = new Map(owner);
  for (const [k, p] of owner) if (p === order[0]) fewer.set(k, order[1]);
  assert.strictEqual(V.configuration(fewer, inside), null);
  assert.strictEqual(V.configuration(owner, new Set()), null);
  assert.strictEqual(V.configuration(owner, null), null);
}

/* ---- a piece that touches the inside only at a corner stands between the two pieces whose edges meet there ----
 *   y=2   B B B C
 *   y=1   A . . C        . : the inside, the four cells (0,0) (1,0) (0,1) (1,1)
 *   y=0   A . . C
 *   y=-1  X D D C        X touches the inside only at the corner (0,0) */
const small = new Map();
const put = (x, y, p) => small.set(x + "," + y, p);
for (const [x, y] of [[-1, 0], [-1, 1]]) put(x, y, "A");
for (const [x, y] of [[-1, 2], [0, 2], [1, 2]]) put(x, y, "B");
for (const [x, y] of [[2, -1], [2, 0], [2, 1], [2, 2]]) put(x, y, "C");
for (const [x, y] of [[0, -1], [1, -1]]) put(x, y, "D");
put(-1, -1, "X");
const room = new Set(["0,0", "1,0", "0,1", "1,1"]);
const around = V.orderAround(small, room);
assert.strictEqual(around.length, 5);
assert.strictEqual(V.canonicalKey(around), V.canonicalKey(["A", "X", "D", "C", "B"]));
// without the cell of X the corner is open
const gap = new Map(small);
gap.delete("-1,-1");
assert.strictEqual(V.orderAround(gap, room), null);
// an inside that touches itself at a corner has no single walk
assert.strictEqual(V.orderAround(small, new Set(["0,0", "1,1"])), null);

console.log("verdict.test.js: ok");

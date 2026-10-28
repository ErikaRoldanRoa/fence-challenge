/* node triangle-lab/test/verdict.test.js
 * What a closed fence of all twelve hexiamonds says about its configuration: the pieces round the inside, read from the board,
 * and the verdict for its area. The three fences are boards the tables built (one has a piece that touches the inside only at a
 * corner); each is the best fence of its configuration. */
"use strict";
const assert = require("assert");
const V = require("../verdict.js");
const B = require("../best-fence.js");
const fences = require("./fences.fixture.json");

assert.strictEqual(fences.length, 3);
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

  /* ---- an open fence has no configuration: a triangle behind the inside has no piece ---- */
  const hole = new Map(owner);
  hole.delete([...owner.keys()][0]);
  const some = [...inside].find((k) => {
    const [i, j, o] = k.split(",").map(Number);
    const across = o === 0 ? [[i, j, 1], [i, j - 1, 1], [i - 1, j, 1]] : [[i, j, 0], [i, j + 1, 0], [i + 1, j, 0]];
    return across.some((c) => !inside.has(c.join(",")));
  });
  const [i, j, o] = some.split(",").map(Number);
  const open = new Map(owner);
  for (const c of o === 0 ? [[i, j, 1], [i, j - 1, 1], [i - 1, j, 1]] : [[i, j, 0], [i, j + 1, 0], [i + 1, j, 0]]) {
    if (!inside.has(c.join(","))) open.delete(c.join(","));
  }
  assert.strictEqual(V.configuration(open, inside), null);

  /* ---- an inside with a hole has no single walk round it: a piece stands inside it, so there are two boundaries ---- */
  const next = (k) => {
    const [i, j, o] = k.split(",").map(Number);
    return (o === 0 ? [[i, j, 1], [i, j - 1, 1], [i - 1, j, 1]] : [[i, j, 0], [i, j + 1, 0], [i + 1, j, 0]]).map((c) => c.join(","));
  };
  const deep = [...inside].find((k) => next(k).every((n) => inside.has(n) && next(n).every((m) => inside.has(m))));
  assert.ok(deep, "a triangle well inside the inside");
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

console.log("verdict.test.js: ok");

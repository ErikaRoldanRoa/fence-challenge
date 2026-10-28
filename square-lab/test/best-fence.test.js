/* node square-lab/test/best-fence.test.js
 * The best fence of a configuration, worked out in the page: the configurations are the same however they are read, the
 * numbers are those of the tables, and the few configurations whose best boundary does not make a fence are corrected. */
"use strict";
const assert = require("assert");
const B = require("../best-fence.js");
const MOVES = require("../data/pentomino-moves.js");
const EXC = require("../data/pentomino-exceptions.js");

const best = ["I", "L", "P", "U", "T", "V", "Y", "F", "Z", "X", "N", "W"];
const silver = ["I", "L", "P", "U", "T", "V", "F", "X", "Z", "N", "Y", "W"];
const plain = ["I", "P", "N", "U", "V", "L", "Y", "F", "W", "Z", "X", "T"];
const oneBelow = ["I", "T", "X", "P", "Z", "L", "F", "W", "Y", "V", "U", "N"];

/* ---- the twelve pieces and the number of configurations ---- */
assert.strictEqual(B.NAMES.length, 12);
assert.deepStrictEqual(B.NAMES.slice().sort(), best.slice().sort());
assert.deepStrictEqual(B.counts(), { orders: 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2 / 2, best: MOVES.best });

/* ---- a configuration is the same read from another piece or the other way round ---- */
const turned = best.slice(5).concat(best.slice(0, 5)).reverse();
assert.strictEqual(B.canonicalKey(turned), B.canonicalKey(best));
assert.strictEqual(B.rank(turned), B.rank(best));
assert.notStrictEqual(B.rank(plain), B.rank(best));
assert.strictEqual(B.canonicalKey(B.unrank(B.rank(plain))), B.canonicalKey(plain));
assert.strictEqual(B.rank(B.unrank(0)), 0);
for (const order of [best, silver, plain]) assert.strictEqual(B.rank(B.unrank(B.rank(order))), B.rank(order), "a rank gives its configuration back");
assert.ok(B.rank(best) >= 0 && B.rank(best) < 39916800);
assert.strictEqual(B.rank(best.slice(1)), null, "eleven pieces are not a configuration");
assert.strictEqual(B.rank(best.slice(0, 11).concat(["crook"])), null, "a piece twice is not one");
assert.strictEqual(B.rank(best.slice(0, 11).concat(["nonsense"])), null);
assert.strictEqual(B.bestArea(best.slice(1)), null);

/* ---- the numbers of the tables ---- */
assert.strictEqual(B.bestArea(best), MOVES.best);
assert.strictEqual(B.bestArea(turned), MOVES.best, "the same configuration, the same best");
assert.strictEqual(B.bestArea(silver), MOVES.best - 1);
assert.strictEqual(B.bestArea(plain), 118);
assert.strictEqual(B.tier(best), "gold");
assert.strictEqual(B.tier(silver), "silver");
assert.strictEqual(B.tier(plain), "bronze");

/* ---- the configurations whose best boundary does not make a fence ---- */
assert.strictEqual(B.relaxed(oneBelow), 119);
assert.strictEqual(B.bestArea(oneBelow), 118, "one below the boundary of the tables");
assert.strictEqual(B.relaxed(plain), 118);

/* ---- the data hold what they say ---- */
assert.deepStrictEqual(MOVES.tiers, { gold: 1440, silver: 19416 });
assert.strictEqual(MOVES.scale, 2);
assert.strictEqual(EXC.counts.below1 * 4, Buffer.from(EXC.below1, "base64").length);
assert.strictEqual(EXC.counts.below2 * 4, Buffer.from(EXC.below2, "base64").length);

console.log("best-fence.test.js: ok");

/* node square-lab/test/trophies.test.js
 * The trophies: what wins one, what the player keeps, and what survives a storage that fails. */
"use strict";
const assert = require("assert");
const B = require("../best-fence.js");
const T = require("../trophies.js");
const MOVES = require("../data/pentomino-moves.js");

const BEST = MOVES.best;
const best = ["I", "L", "P", "U", "T", "V", "Y", "F", "Z", "X", "N", "W"];
const silver = ["I", "L", "P", "U", "T", "V", "F", "X", "Z", "N", "Y", "W"];
const plain = ["I", "P", "N", "U", "V", "L", "Y", "F", "W", "Z", "X", "T"];
const other = plain.slice().reverse();   // the same configuration read the other way round
const different = ["I", "T", "X", "P", "Z", "L", "F", "W", "Y", "V", "U", "N"];

function storage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

/* ---- one entry on the device for this lab's puzzle (the square lab kept the best of all under the same name before) ---- */
assert.strictEqual(T.KEY, "fc-trophies-sq12");

/* ---- a new player has nothing ---- */
let state = T.empty();
assert.deepStrictEqual(state, { g: false, c: [] });
assert.deepStrictEqual(T.lit(state, silver), { config: false, global: false, tier: null });
assert.deepStrictEqual(T.counts(state), { won: 0, total: 19958400, global: false });

/* ---- a fence below its configuration's best wins nothing ---- */
let r = T.record(state, silver, BEST - 2);
assert.strictEqual(r.kind, "better");
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [false, false]);
assert.deepStrictEqual(r.state, state, "nothing changed");
assert.notStrictEqual(r.state, state, "the state it returns is a copy");

/* ---- the best of a configuration wins its trophy, once ---- */
r = T.record(state, silver, BEST - 1);
assert.strictEqual(r.kind, "notYet");
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [true, false]);
state = r.state;
r = T.record(state, silver, BEST - 1);
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [false, false], "the same trophy is not won twice");
assert.strictEqual(r.state.c.length, 1);
assert.deepStrictEqual(T.lit(state, silver), { config: true, global: false, tier: "silver" });
assert.deepStrictEqual(T.lit(state, plain), { config: false, global: false, tier: null }, "another configuration is not won");
assert.deepStrictEqual(T.lit(state, null), { config: false, global: false, tier: null }, "no configuration on the board");

/* ---- the same configuration read from another start or the other way round is the same trophy ---- */
const turned = silver.slice(2).concat(silver.slice(0, 2)).reverse();
assert.deepStrictEqual(T.lit(state, turned), { config: true, global: false, tier: "silver" });

/* ---- a board with a corner open is no fence: it wins nothing, whatever its area ---- */
let open = T.record(state, best, BEST, false);
assert.deepStrictEqual([open.wonConfig, open.wonGlobal], [false, false]);
assert.deepStrictEqual(open.state, state, "nothing changed");
open = T.record(state, silver, BEST - 1, false);
assert.deepStrictEqual([open.wonConfig, open.wonGlobal], [false, false], "not even the trophy of a configuration");
assert.deepStrictEqual(T.record(state, best, BEST).state.g, true, "no flag means closed");

/* ---- the best of all wins the global trophy and that configuration's, and the global one stays ---- */
r = T.record(state, best, BEST);
assert.strictEqual(r.kind, "best");
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [true, true]);
state = r.state;
assert.deepStrictEqual(T.lit(state, best), { config: true, global: true, tier: "gold" });
assert.deepStrictEqual(T.lit(state, plain), { config: false, global: true, tier: null }, "the global trophy shows in every configuration");
assert.deepStrictEqual(T.lit(state, null), { config: false, global: true, tier: null });
r = T.record(state, plain, 118);
assert.deepStrictEqual([r.kind, r.wonConfig, r.wonGlobal], ["notYet", true, false]);
assert.strictEqual(B.tier(plain), "bronze");
assert.deepStrictEqual(T.counts(r.state), { won: 3, total: 19958400, global: true });
assert.deepStrictEqual(T.lit(r.state, other), { config: true, global: true, tier: "bronze" });
state = r.state;

/* ---- what is above the data says nothing, and wins nothing ---- */
r = T.record(T.empty(), silver, BEST + 1);
assert.strictEqual(r.kind, null);
assert.deepStrictEqual(r.state, T.empty());
r = T.record(T.empty(), silver.slice(1), BEST - 1);
assert.strictEqual(r.kind, null, "eleven pieces are not a configuration");

/* ---- a configuration whose best boundary is not a fence: its best is the lower number ---- */
r = T.record(T.empty(), different, 119);
assert.strictEqual(r.kind, null, "119 is what the boundary of the tables gives, one more than a fence can");
r = T.record(T.empty(), different, 117);
assert.strictEqual(r.kind, "better");
r = T.record(T.empty(), different, 118);
assert.deepStrictEqual([r.kind, r.wonConfig], ["notYet", true]);

/* ---- kept on the device ---- */
const store = storage();
assert.deepStrictEqual(T.load(store), T.empty(), "nothing stored yet");
assert.strictEqual(T.save(store, state), true);
assert.deepStrictEqual(T.load(store), state, "what was saved comes back");
store.setItem(T.KEY, "not json");
assert.deepStrictEqual(T.load(store), T.empty(), "a damaged entry is an empty one");
store.setItem(T.KEY, JSON.stringify({ g: "yes", c: ["nonsense", [5, 0], [5, 1], [-3, 0], [7, -1], [9, 99]] }));
assert.deepStrictEqual(T.load(store), { g: false, c: [[5, 0], [9, 2]] }, "only well-formed entries, each once; a shortfall never above 2; the global one only if it is true");
const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
assert.deepStrictEqual(T.load(broken), T.empty(), "a storage that throws is an empty one");
assert.strictEqual(T.save(broken, state), false, "and saving to it fails quietly");

/* ---- the case: the configurations won, the global trophies derived from what is won ---- */
assert.deepStrictEqual(T.entries(T.empty()), []);
const won = T.entries(state);
assert.strictEqual(won.length, 3);
assert.deepStrictEqual(won.map((e) => e.key), won.map((e) => e.key).slice().sort((a, b) => a - b), "sorted by rank");
assert.ok(won.every((e) => e.won && e.order.length === 12 && B.rank(e.order) === e.key));
assert.deepStrictEqual(won.map((e) => e.tier).sort(), ["bronze", "gold", "silver"]);
let g = T.globals(T.empty());
assert.deepStrictEqual(g.map((x) => x.id), ["best", "m10", "m50", "m100", "m1000", "tier-gold", "tier-silver"]);
assert.ok(g.every((x) => x.won === false));
assert.deepStrictEqual(g.filter((x) => x.kind === "milestone").map((x) => x.n), [10, 50, 100, 1000]);
assert.deepStrictEqual(g.filter((x) => /^tier/.test(x.id)).map((x) => x.n), [MOVES.tiers.gold, MOVES.tiers.silver]);
g = T.globals(state);
assert.deepStrictEqual(Object.fromEntries(g.map((x) => [x.id, x.won])), { best: true, m10: false, m50: false, m100: false, m1000: false, "tier-gold": false, "tier-silver": false });
// ten configurations and the best of all
const many = { g: true, c: Array.from({ length: 12 }, (_, i) => [i * 1000, i % 3]) };
assert.deepStrictEqual(Object.fromEntries(T.globals(many).map((x) => [x.id, x.won])), { best: true, m10: true, m50: false, m100: false, m1000: false, "tier-gold": false, "tier-silver": false });
// the whole gold tier
const gold = { g: true, c: Array.from({ length: MOVES.tiers.gold }, (_, i) => [i, 0]) };
assert.strictEqual(T.globals(gold).find((x) => x.id === "tier-gold").won, true);

console.log("trophies.test.js: ok");

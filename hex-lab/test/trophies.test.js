/* node hex-lab/test/trophies.test.js
 * The trophies: what wins one, what the player keeps, and what survives a storage that fails. */
"use strict";
const assert = require("assert");
const V = require("../verdict.js");
const T = require("../trophies.js");
const DATA = require("../data/orders.js");

const orders = {};                                    // one order for each best area: 35, 34, 33
for (const key of Object.keys(DATA.areaByOrder)) {
  const top = DATA.areaByOrder[key];
  if (!orders[top]) orders[top] = key.split(",");
}
const other34 = Object.keys(DATA.areaByOrder).filter((k) => DATA.areaByOrder[k] === 34 && k !== V.canonicalKey(orders[34]))[0].split(",");

function storage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

/* ---- a new player has nothing ---- */
let state = T.empty();
assert.deepStrictEqual(state, { g: false, c: [] });
assert.deepStrictEqual(T.lit(state, orders[34]), { config: false, global: false, tier: null });
assert.deepStrictEqual(T.counts(state), { won: 0, total: 360, global: false });

/* ---- a fence below its configuration's best wins nothing ---- */
let r = T.record(state, orders[34], 33);
assert.strictEqual(r.kind, "better");
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [false, false]);
assert.deepStrictEqual(r.state, state, "nothing changed");
assert.notStrictEqual(r.state, state, "the state it returns is a copy");

/* ---- the best of a configuration wins its trophy, once ---- */
r = T.record(state, orders[34], 34);
assert.strictEqual(r.kind, "notYet");
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [true, false]);
state = r.state;
r = T.record(state, orders[34], 34);
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [false, false], "the same trophy is not won twice");
assert.strictEqual(r.state.c.length, 1);
assert.deepStrictEqual(T.lit(state, orders[34]), { config: true, global: false, tier: "silver" });
assert.deepStrictEqual(T.lit(state, other34), { config: false, global: false, tier: null }, "another configuration is not won");
assert.deepStrictEqual(T.lit(state, null), { config: false, global: false, tier: null }, "no configuration on the board");

/* ---- the same configuration read from another start or the other way round is the same trophy ---- */
const turned = orders[34].slice(2).concat(orders[34].slice(0, 2)).reverse();
assert.deepStrictEqual(T.lit(state, turned), { config: true, global: false, tier: "silver" });

/* ---- the best of all wins the global trophy and that configuration's, and the global one stays ---- */
r = T.record(state, orders[35], 35);
assert.strictEqual(r.kind, "best");
assert.deepStrictEqual([r.wonConfig, r.wonGlobal], [true, true]);
state = r.state;
assert.deepStrictEqual(T.lit(state, orders[35]), { config: true, global: true, tier: "gold" });
assert.deepStrictEqual(T.lit(state, orders[33]), { config: false, global: true, tier: null }, "the global trophy shows in every configuration");
assert.deepStrictEqual(T.lit(state, null), { config: false, global: true, tier: null });
r = T.record(state, orders[33], 33);
assert.deepStrictEqual([r.kind, r.wonConfig, r.wonGlobal], ["notYet", true, false]);
assert.strictEqual(V.tier(orders[33]), "bronze");
assert.deepStrictEqual(T.counts(r.state), { won: 3, total: 360, global: true });

/* ---- what is above the data says nothing, and wins nothing ---- */
r = T.record(T.empty(), orders[34], 36);
assert.strictEqual(r.kind, null);
assert.deepStrictEqual(r.state, T.empty());

/* ---- kept on the device ---- */
const store = storage();
assert.deepStrictEqual(T.load(store), T.empty(), "nothing stored yet");
assert.strictEqual(T.save(store, state), true);
assert.deepStrictEqual(T.load(store), state, "what was saved comes back");
store.setItem(T.KEY, "not json");
assert.deepStrictEqual(T.load(store), T.empty(), "a damaged entry is an empty one");
store.setItem(T.KEY, JSON.stringify({ g: "yes", c: ["nonsense", V.canonicalKey(orders[34]), V.canonicalKey(orders[34])] }));
assert.deepStrictEqual(T.load(store), { g: false, c: [V.canonicalKey(orders[34])] }, "only known configurations, each once; the global one only if it is true");
const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
assert.deepStrictEqual(T.load(broken), T.empty(), "a storage that throws is an empty one");
assert.strictEqual(T.save(broken, state), false, "and saving to it fails quietly");

console.log("trophies.test.js: ok");

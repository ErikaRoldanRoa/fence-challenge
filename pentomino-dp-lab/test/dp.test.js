/* Checks of the pentomino DP against the numbers of the fixed-order and
 * min-max sections: node pentomino-dp-lab/test/dp.test.js */
"use strict";
const assert = require("assert");
const path = require("path");
const D = require(path.join(__dirname, "..", "dp.js"));
global.window = {};
require(path.join(__dirname, "..", "data", "orders.js"));
const ORDERS = global.window.DP_ORDERS;
const N = D.PENTOS.map((p) => p[0]);
const ix = (s) => [...s].map((c) => N.indexOf(c));
function flood(r) {
  const tr = D.trace(r);
  const e = D.enclosed([].concat(...tr.pieces.map((p) => p.cells)));
  return Object.assign(e, { valid: tr.valid });
}

assert.strictEqual(D.PENTOS.length, 12, "12 pentominoes");
assert.deepStrictEqual(D.PENTOS.map((p) => D.orientations(p[1]).length), [8, 2, 8, 8, 8, 4, 4, 4, 4, 1, 8, 4], "orientations");

function check(order, area) {
  const r = D.fixedOrder(ix(order));
  assert.strictEqual(r.best, area, order + " best");
  const f = flood(r);
  assert.strictEqual(f.valid, true, order + " valid trace");
  assert.strictEqual(f.overlap, false, order + " no overlap");
  assert.strictEqual(f.area, area, order + " flood fill agrees");
}
check("FIV", 6);
check("LNVW", 11);
check("LVNW", 13);
check(ORDERS.worst, 111);
check(ORDERS.best, 128);

// Largest area with 2 and 3 pieces (tab:max-subset): 1 and 6.
let best2 = 0, best3 = 0;
for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
  if (a === b) continue;
  const v = D.fixedOrder([a, b]).best || 0; if (v > best2) best2 = v;
  for (let c = b + 1; c < 12; c++) {
    if (c === a) continue;
    const w = D.fixedOrder([a, b, c]).best || 0; if (w > best3) best3 = w;
  }
}
assert.strictEqual(best2, 1, "best with 2 pieces");
assert.strictEqual(best3, 6, "best with 3 pieces");

// Random orders of the 12 stay within the distribution's range 111..128.
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let k = 0; k < 12; k++) {
  const o = [...Array(12).keys()];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  const r = D.fixedOrder(o);
  assert.ok(r.best >= 111 && r.best <= 128, "order in range: " + r.best);
  assert.strictEqual(flood(r).area, r.best, "flood agrees for a random order");
}
// Every order of 2, 3 and 4 pieces: when a fence closes (area > 0), the trace
// is valid (no overlap) and its flood-fill area equals the DP value.
let swept = 0;
(function perms(cur, used) {
  if (cur.length >= 2) {
    const r = D.fixedOrder(cur);
    if (r.best > 0) {
      const f = flood(r);
      assert.ok(f.valid && !f.overlap && f.area === r.best, "order " + cur.map((i) => N[i]).join("") + ": DP " + r.best + ", flood " + f.area);
    }
    swept++;
  }
  if (cur.length === 4) return;
  for (let i = 0; i < 12; i++) if (!(used & (1 << i))) { cur.push(i); perms(cur, used | (1 << i)); cur.pop(); }
})([], 0);
assert.strictEqual(swept, 132 + 1320 + 11880, "orders of 2 to 4 pieces");
console.log("dp: all assertions passed (" + swept + " short orders swept)");

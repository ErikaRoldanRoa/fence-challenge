/* Fence Challenge · hex lab: what a closed fence of all seven tetrahexes says about its configuration, the
 * order of the pieces around the inside. Pure logic, no DOM: the lab calls it once the area is measured.
 *
 *   configuration(owner, inside)  the pieces met around the inside, as a cyclic list, or null unless every
 *                                 one of the seven stands in it exactly once
 *   canonicalKey(order)           the smallest comma-joined spelling over rotations and reversal
 *   verdict(order, area)          "better"  this order can still enclose more
 *                                 "notYet"  this order is at its best, another does better
 *                                 "best"    no order does better
 *                                 null      nothing to say (unknown order, or an area above what the data allows)
 *   counts()                      { orders, atBest } from the data
 *
 * owner: Map "q,r" -> piece id for every occupied cell; inside: Set "q,r" of the one enclosed region. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data/orders.js"));
  else root.HexVerdict = factory(root.HexOrderData);
})(typeof self !== "undefined" ? self : this, function (DATA) {
  "use strict";

  // The six neighbours, in turn around a cell (lattice-hex.js lists them the same way).
  const STEP = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const key = (q, r) => q + "," + r;

  function stepIndex(dq, dr) {
    for (let d = 0; d < 6; d += 1) if (STEP[d][0] === dq && STEP[d][1] === dr) return d;
    return -1;
  }

  // Equal pieces next to each other are one piece met along several edges.
  function mergeCyclic(seq) {
    const out = [];
    for (const p of seq) if (out.length === 0 || out[out.length - 1] !== p) out.push(p);
    if (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    return out;
  }

  // Walks along the edge of the inside, keeping it on one side, and writes down the piece on the other side
  // of every edge it passes. Null when an edge has no piece behind it (the fence is open).
  function orderAround(owner, inside) {
    if (!inside || inside.size === 0) return null;
    let q = 0, r = 0, d = -1;
    for (const k of inside) {
      const [cq, cr] = k.split(",").map(Number);
      for (let s = 0; s < 6; s += 1) {
        if (!inside.has(key(cq + STEP[s][0], cr + STEP[s][1]))) { q = cq; r = cr; d = s; break; }
      }
      if (d >= 0) break;
    }
    if (d < 0) return null;
    const start = { q, r, d };
    const seq = [];
    for (let guard = 0; guard < 4000; guard += 1) {
      const yq = q + STEP[d][0], yr = r + STEP[d][1];
      const piece = owner.get(key(yq, yr));
      if (piece === undefined) return null;
      seq.push(piece);
      const next = (d + 1) % 6;
      const zq = q + STEP[next][0], zr = r + STEP[next][1];
      if (inside.has(key(zq, zr))) {
        const back = stepIndex(yq - zq, yr - zr);
        if (back < 0) return null;
        q = zq; r = zr; d = back;
      } else {
        d = next;
      }
      if (q === start.q && r === start.r && d === start.d) return mergeCyclic(seq);
    }
    return null;
  }

  function configuration(owner, inside) {
    const order = orderAround(owner, inside);
    if (!order || order.length !== DATA.pieces.length) return null;
    if (new Set(order).size !== order.length) return null;
    return order.every((p) => DATA.pieces.indexOf(p) >= 0) ? order : null;
  }

  function canonicalKey(order) {
    const n = order.length;
    let best = null;
    for (const seq of [order, order.slice().reverse()]) {
      for (let k = 0; k < n; k += 1) {
        const spelling = seq.slice(k).concat(seq.slice(0, k)).join(",");
        if (best === null || spelling < best) best = spelling;
      }
    }
    return best;
  }

  function verdict(order, area) {
    const top = DATA.areaByOrder[canonicalKey(order)];
    if (top === undefined || area > top) return null;
    if (area < top) return "better";
    return top === DATA.best ? "best" : "notYet";
  }

  function counts() {
    const all = Object.keys(DATA.areaByOrder);
    return { orders: all.length, atBest: all.filter((k) => DATA.areaByOrder[k] === DATA.best).length };
  }

  return { configuration, orderAround, canonicalKey, verdict, counts };
});

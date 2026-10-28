/* Fence Challenge · square lab: what a closed fence of all twelve pentominoes says about its configuration, the order of
 * the pieces around the inside. Pure logic, no DOM: the lab calls it once the area is measured.
 *
 *   configuration(owner, inside)  the pieces met around the inside, as a cyclic list, or null unless every one of the twelve
 *                                 stands in it exactly once
 *   canonicalKey(order)           the smallest comma-joined spelling over rotations and reversal
 *   verdict(order, area)          "better"  this configuration can still enclose more
 *                                 "notYet"  this configuration is at its best, another does better
 *                                 "best"    no configuration does better
 *                                 null      nothing to say (not twelve pieces, or an area above what the data allows)
 *   tier(order)                   "gold" | "silver" | "bronze": how far this configuration's best falls short of the best of all
 *                                 (0, 1, 2 or more cells), or null
 *   counts()                      { orders } and { best } from the data
 *
 * owner: Map "x,y" -> piece name for every occupied cell; inside: Set "x,y" of the one enclosed region.
 *
 * The pieces round the inside are found by walking along its edge, keeping it on the left. On every edge the piece on the
 * other side is written down, and at every corner the pieces of the cells in between: a piece that touches the inside
 * only at a corner stands there, between the two pieces whose edges meet at that corner, as in the walk of the programme. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./best-fence.js"));
  else root.SqVerdict = factory(root.PentominoBest);
})(typeof self !== "undefined" ? self : this, function (BEST) {
  "use strict";

  const key = (x, y) => x + "," + y;
  const vkey = (v) => v[0] + "," + v[1];

  // the four corners of a cell, counterclockwise
  function corners(x, y) {
    return [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  }

  // the cell on the other side of the edge from corner k to corner k + 1
  function across(x, y, k) {
    return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]][k];
  }

  // the four cells round a corner, counterclockwise
  function around(a, b) {
    return [[a, b], [a - 1, b], [a - 1, b - 1], [a, b - 1]];
  }

  // A piece met along several edges, or at several corners in a row, is one piece met once.
  function mergeCyclic(seq) {
    const out = [];
    for (const p of seq) if (out.length === 0 || out[out.length - 1] !== p) out.push(p);
    while (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    return out;
  }

  // The pieces along the edge of the inside, in turn, or null when the edge is not one closed walk or a cell behind it has no
  // piece (the fence is open).
  function orderAround(owner, inside) {
    if (!inside || inside.size === 0) return null;
    const edges = new Map();   // start corner -> { to, right: the cell on the right, [x, y] }
    for (const k of inside) {
      const [x, y] = k.split(",").map(Number);
      const c = corners(x, y);
      for (let e = 0; e < 4; e += 1) {
        const other = across(x, y, e);
        if (inside.has(key(other[0], other[1]))) continue;
        const from = vkey(c[e]);
        if (edges.has(from)) return null;                       // two edges leave one corner: the inside touches itself
        edges.set(from, { to: vkey(c[(e + 1) % 4]), toCorner: c[(e + 1) % 4], right: other });
      }
    }
    if (edges.size === 0) return null;
    const startKey = edges.keys().next().value;
    const seq = [];
    let at = startKey, count = 0;
    do {
      const edge = edges.get(at);
      if (!edge) return null;
      const next = edges.get(edge.to);
      if (!next) return null;
      const first = key(edge.right[0], edge.right[1]);
      const piece = owner.get(first);
      if (piece === undefined) return null;
      seq.push(piece);
      // the cells round the corner from the one on the right of this edge to the one on the right of the next
      const ring = around(edge.toCorner[0], edge.toCorner[1]).map((t) => key(t[0], t[1]));
      const a = ring.indexOf(first);
      const b = ring.indexOf(key(next.right[0], next.right[1]));
      if (a < 0 || b < 0) return null;
      if (a !== b) {
        for (let s = (a + 1) % 4; s !== b; s = (s + 1) % 4) {
          if (inside.has(ring[s])) return null;
          const between = owner.get(ring[s]);
          if (between === undefined) return null;
          seq.push(between);
        }
      }
      at = edge.to;
      count += 1;
      if (count > 4000) return null;
    } while (at !== startKey);
    return mergeCyclic(seq);
  }

  function configuration(owner, inside) {
    const order = orderAround(owner, inside);
    if (!order || order.length !== BEST.NAMES.length) return null;
    if (new Set(order).size !== order.length) return null;
    return order.every((p) => BEST.NAMES.indexOf(p) >= 0) ? order : null;
  }

  function verdict(order, area) {
    const top = BEST.bestArea(order);
    if (top === null || area > top) return null;
    if (area < top) return "better";
    return top === BEST.counts().best ? "best" : "notYet";
  }

  return { configuration, orderAround, canonicalKey: BEST.canonicalKey, verdict, tier: BEST.tier, counts: BEST.counts };
});

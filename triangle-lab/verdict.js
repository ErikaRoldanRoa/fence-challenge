/* Fence Challenge · triangle lab: what a closed fence of all twelve hexiamonds says about its configuration, the order of
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
 *                                 (0, 1, 2 or more triangles), or null
 *   counts()                      { orders } and { best } from the data
 *
 * owner: Map "i,j,o" -> piece name for every occupied triangle; inside: Set "i,j,o" of the one enclosed region.
 *
 * The pieces round the inside are found by walking along its edge, keeping it on the left. On every edge the piece on the
 * other side is written down, and at every corner the pieces of the triangles in between: a piece that touches the inside
 * only at a corner stands there, between the two pieces whose edges meet at that corner, as in the walk of the programme. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./best-fence.js"));
  else root.TriVerdict = factory(root.HexiamondBest);
})(typeof self !== "undefined" ? self : this, function (BEST) {
  "use strict";

  const key = (i, j, o) => i + "," + j + "," + o;
  const vkey = (v) => v[0] + "," + v[1];

  // the three corners of a triangle, counterclockwise; o = 0 points up (corners (i,j), (i+1,j), (i,j+1)), o = 1 points down
  function corners(i, j, o) {
    return o === 0 ? [[i, j], [i + 1, j], [i, j + 1]] : [[i + 1, j], [i + 1, j + 1], [i, j + 1]];
  }

  // the triangle on the other side of the edge from corner k to corner k + 1
  function across(i, j, o, k) {
    if (o === 0) return [[i, j - 1, 1], [i, j, 1], [i - 1, j, 1]][k];
    return [[i + 1, j, 0], [i, j + 1, 0], [i, j, 0]][k];
  }

  // the six triangles round a corner, counterclockwise
  function around(a, b) {
    return [[a, b, 0], [a - 1, b, 1], [a - 1, b, 0], [a - 1, b - 1, 1], [a, b - 1, 0], [a, b - 1, 1]];
  }

  // A piece met along several edges, or at several corners in a row, is one piece met once.
  function mergeCyclic(seq) {
    const out = [];
    for (const p of seq) if (out.length === 0 || out[out.length - 1] !== p) out.push(p);
    while (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    return out;
  }

  // The pieces along the edge of the inside, in turn, or null when the edge is not one closed walk or a triangle behind it has
  // no piece (the fence is open).
  function orderAround(owner, inside) {
    if (!inside || inside.size === 0) return null;
    const edges = new Map();   // start corner -> { to, right: the triangle on the right, [i, j, o] }
    for (const k of inside) {
      const [i, j, o] = k.split(",").map(Number);
      const c = corners(i, j, o);
      for (let e = 0; e < 3; e += 1) {
        const other = across(i, j, o, e);
        if (inside.has(key(other[0], other[1], other[2]))) continue;
        const from = vkey(c[e]);
        if (edges.has(from)) return null;                       // two edges leave one corner: the inside touches itself
        edges.set(from, { to: vkey(c[(e + 1) % 3]), toCorner: c[(e + 1) % 3], right: other });
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
      const first = key(edge.right[0], edge.right[1], edge.right[2]);
      const piece = owner.get(first);
      if (piece === undefined) return null;
      seq.push(piece);
      // the triangles round the corner from the one on the right of this edge to the one on the right of the next
      const ring = around(edge.toCorner[0], edge.toCorner[1]).map((t) => key(t[0], t[1], t[2]));
      const a = ring.indexOf(first);
      const b = ring.indexOf(key(next.right[0], next.right[1], next.right[2]));
      if (a < 0 || b < 0) return null;
      if (a !== b) {
        for (let s = (a + 1) % 6; s !== b; s = (s + 1) % 6) {
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
    if (count !== edges.size) return null;                  // another loop is left: the inside has a hole (a piece or pieces of its own)
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

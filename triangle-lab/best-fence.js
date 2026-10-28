/* Fence Challenge · triangle lab: the best fence a configuration allows, worked out in the page.
 * A configuration is the cyclic order of the twelve hexiamonds around the inside of a fence (up to rotation and reversal).
 * There are 11!/2 = 19,958,400 of them, too many for a table, so the lab runs the dynamic programme of the paper for the one
 * on its board: the pieces are taken in that order, each along a run of its boundary (data/hexiamond-moves.js), and the table
 * keeps, for every end point and direction, the largest shoelace sum. The best closed boundary is the value; for the few
 * configurations whose best boundary overlaps itself, or leaves the inside in several parts, it is 1 or 2 too high, and
 * data/hexiamond-exceptions.js lists them. Pure logic, no DOM.
 *
 *   canonicalKey(order)   the smallest comma-joined spelling over rotations and reversal (the key of a configuration)
 *   rank(order)           the number of the configuration, below 11!: its canonical form starts with the first piece, reads in
 *                         the direction in which the second piece is smaller than the last, and the other eleven are counted
 *                         off as a permutation
 *   unrank(n)             the configuration of a rank, as piece names
 *   bestArea(order)       the best area of a fence with this configuration, in triangles; null unless it is twelve pieces
 *   tier(order)           "gold" | "silver" | "bronze": 0, 1, 2 or more triangles short of the best of all
 *   counts()              { orders } (11!/2) and { best }
 *
 * order: the piece names (data/hexiamond-moves.js lists the twelve). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data/hexiamond-moves.js"), require("./data/hexiamond-exceptions.js"));
  else root.HexiamondBest = factory(root.HexiamondMoves, root.HexiamondExceptions);
})(typeof self !== "undefined" ? self : this, function (DATA, EXC) {
  "use strict";

  const NAMES = DATA.pieces;
  const N = NAMES.length;                 // 12
  const D = 6;                            // directions
  const NEG = -32000;
  const INDEX = new Map(NAMES.map((name, i) => [name, i]));

  // hexagonal distance in the lattice basis
  const nrm = (x, y) => Math.max(Math.abs(x), Math.abs(y), Math.abs(x + y));

  // moves[piece][incoming direction]: the arrays tout, dx, dy, dA
  const MOVES = DATA.moves.map((flat) => {
    const by = [];
    for (let d = 0; d < D; d += 1) by.push({ tout: [], dx: [], dy: [], dA: [] });
    for (let k = 0; k < flat.length; k += 5) {
      const m = by[flat[k]];
      m.tout.push(flat[k + 1]); m.dx.push(flat[k + 2]); m.dy.push(flat[k + 3]); m.dA.push(flat[k + 4]);
    }
    return by;
  });
  // the farthest one move of a piece goes
  const REACH = DATA.moves.map((flat) => {
    let r = 0;
    for (let k = 0; k < flat.length; k += 5) r = Math.max(r, nrm(flat[k + 2], flat[k + 3]));
    return r;
  });
  const REACH_ALL = REACH.reduce((a, b) => a + b, 0);
  // a box that holds every table: the largest radius at which a point is both reachable and able to return
  const R = (function () {
    const top = REACH.slice().sort((a, b) => b - a);
    const sum = (k) => top.slice(0, k).reduce((a, b) => a + b, 0);
    let r = 1;
    for (let k = 0; k <= N; k += 1) r = Math.max(r, Math.min(sum(k), sum(N - k)));
    return r;
  })();
  const W = 2 * R + 1;
  const SIZE = D * W * W;
  const at = (tau, x, y) => (tau * W + (y + R)) * W + (x + R);

  function radius(mask) {
    let used = 0;
    for (let u = 0; u < N; u += 1) if (mask & (1 << u)) used += REACH[u];
    return Math.min(used, REACH_ALL - used);
  }

  // The best closed boundary for the pieces (indices) in this order, from the first piece's start back to it.
  function relaxed(order) {
    let a = new Int16Array(SIZE).fill(NEG);
    let b = new Int16Array(SIZE);
    a[at(0, 0, 0)] = 0;
    let mask = 0, rprev = 0;
    for (let k = 0; k < N; k += 1) {
      const u = order[k];
      mask |= 1 << u;
      const rn = radius(mask);
      b.fill(NEG);
      for (let tau = 0; tau < D; tau += 1) {
        const m = MOVES[u][tau], count = m.tout.length;
        if (count === 0) continue;
        for (let y = -rprev; y <= rprev; y += 1) {
          for (let x = -rprev; x <= rprev; x += 1) {
            const v = a[at(tau, x, y)];
            if (v <= NEG) continue;
            for (let i = 0; i < count; i += 1) {
              const nx = x + m.dx[i], ny = y + m.dy[i];
              if (nrm(nx, ny) > rn) continue;
              const nv = v + m.dA[i] + x * m.dy[i] - y * m.dx[i];
              const j = at(m.tout[i], nx, ny);
              if (nv > b[j]) b[j] = nv;
            }
          }
        }
      }
      const swap = a; a = b; b = swap;
      rprev = rn;
    }
    const v = a[at(0, 0, 0)];
    return v <= NEG ? null : v;
  }

  const FACT = [1];
  for (let i = 1; i <= N; i += 1) FACT.push(FACT[i - 1] * i);

  function canonicalIndices(order) {
    const k = order.indexOf(0);
    const fwd = order.slice(k).concat(order.slice(0, k));
    const bwd = [fwd[0]].concat(fwd.slice(1).reverse());
    return fwd[1] < fwd[N - 1] ? fwd : bwd;
  }

  function indices(order) {
    if (!Array.isArray(order) || order.length !== N) return null;
    const out = order.map((name) => (INDEX.has(name) ? INDEX.get(name) : -1));
    if (out.some((i) => i < 0) || new Set(out).size !== N) return null;
    return out;
  }

  function rankOfIndices(order) {
    const seq = canonicalIndices(order).slice(1);
    let r = 0;
    for (let i = 0; i < seq.length; i += 1) {
      let smaller = 0;
      for (let j = i + 1; j < seq.length; j += 1) if (seq[j] < seq[i]) smaller += 1;
      r += smaller * FACT[seq.length - 1 - i];
    }
    return r;
  }

  function rank(order) {
    const idx = indices(order);
    return idx ? rankOfIndices(idx) : null;
  }

  function unrank(n) {
    const pool = [];
    for (let i = 1; i < N; i += 1) pool.push(i);
    const out = [0];
    let rest = n;
    for (let i = 0; i < N - 1; i += 1) {
      const f = FACT[N - 2 - i];
      const q = Math.floor(rest / f);
      rest -= q * f;
      out.push(pool.splice(q, 1)[0]);
    }
    return out.map((i) => NAMES[i]);
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

  function decode(b64) {
    const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    const out = new Uint32Array(bin.length >> 2);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = (bin.charCodeAt(4 * i) | (bin.charCodeAt(4 * i + 1) << 8) | (bin.charCodeAt(4 * i + 2) << 16) | (bin.charCodeAt(4 * i + 3) << 24)) >>> 0;
    }
    return out;
  }
  let below1 = null, below2 = null;

  function listed(list, n) {
    let lo = 0, hi = list.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid] === n) return true;
      if (list[mid] < n) lo = mid + 1; else hi = mid - 1;
    }
    return false;
  }

  const memo = new Map();

  function bestArea(order) {
    const idx = indices(order);
    if (!idx) return null;
    const n = rankOfIndices(idx);
    if (memo.has(n)) return memo.get(n);
    if (below1 === null) { below1 = decode(EXC.below1); below2 = decode(EXC.below2); }
    const canon = canonicalIndices(idx);
    const value = relaxed(canon);
    const area = value === null ? null : value - (listed(below2, n) ? 2 : listed(below1, n) ? 1 : 0);
    memo.set(n, area);
    return area;
  }

  const TIERS = ["gold", "silver", "bronze"];
  function tier(order) {
    const area = bestArea(order);
    return area === null ? null : TIERS[Math.min(DATA.best - area, 2)];
  }

  function counts() {
    return { orders: FACT[N - 1] / 2, best: DATA.best };
  }

  return { NAMES, canonicalKey, rank, unrank, bestArea, tier, counts, relaxed: (names) => { const i = indices(names); return i ? relaxed(canonicalIndices(i)) : null; } };
});

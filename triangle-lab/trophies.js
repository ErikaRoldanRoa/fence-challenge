/* Fence Challenge · triangle lab: the trophies a player has won, kept on the device.
 * Pure logic, no DOM. Two kinds: one trophy for each configuration (the order of the twelve pieces around the fence), won when
 * a closed fence reaches the best area that configuration allows; and one global trophy, won when a closed fence reaches the
 * best area of all. The global trophy, once won, stays won in every configuration. A configuration is stored by its rank
 * (best-fence.js), with how far its best falls short of the best of all (0, 1 or 2 triangles or more), so the case needs no
 * calculation to draw it.
 *
 *   empty()                      what a new player has: { g: false, c: [] }   (c: [rank, shortfall] of the configurations won)
 *   load(storage) / save(storage, state)   the same, through a Storage (never throws; an unreadable one gives empty())
 *   record(state, order, area, closed)   { state, kind, wonConfig, wonGlobal } for a fence of all twelve pieces with one inside; the best of all
 *                                needs closed (no corner open; omitted = closed)
 *   lit(state, order)            { config, global, tier } what the two trophies show for the configuration now on the board
 *   counts(state)                { won, total, global }
 *   entries(state)               the configurations won, by rank: [{ key, order, tier, won: true }]  (the case's grid)
 *   globals(state)               the global trophies, derived from what is won: [{ id, kind, won, n }]
 *                                 best (the best of all), milestones (10, 50, 100, 1000 configurations won), and one for each
 *                                 of the gold and silver tiers once every configuration of that tier is won */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./verdict.js"), require("./best-fence.js"), require("./data/hexiamond-moves.js"));
  else root.TriTrophies = factory(root.TriVerdict, root.HexiamondBest, root.HexiamondMoves);
})(typeof self !== "undefined" ? self : this, function (V, BEST, DATA) {
  "use strict";

  const KEY = "fc-trophies-tri12";   // one entry for each puzzle: the twelve hexiamonds
  const TIERS = ["gold", "silver", "bronze"];
  const MILESTONES = [10, 50, 100, 1000];

  function empty() {
    return { g: false, c: [] };
  }

  function clean(raw) {
    if (!raw || typeof raw !== "object") return empty();
    const seen = new Set();
    const known = [];
    const total = BEST.counts().orders;
    for (const e of Array.isArray(raw.c) ? raw.c : []) {
      if (!Array.isArray(e) || !Number.isInteger(e[0]) || e[0] < 0 || e[0] >= total * 2 || !Number.isInteger(e[1]) || e[1] < 0) continue;
      if (seen.has(e[0])) continue;
      seen.add(e[0]);
      known.push([e[0], Math.min(e[1], 2)]);
    }
    return { g: raw.g === true, c: known };
  }

  function load(storage) {
    try {
      return clean(JSON.parse(storage.getItem(KEY) || "null"));
    } catch (e) {
      return empty();
    }
  }

  function save(storage, state) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  const has = (state, rank) => state.c.some((e) => e[0] === rank);

  // closed: the board has no corner the outside slips through. The best of all is won only by a closed fence, the paper's definition;
  // a configuration's trophy counts the paper's best area of that configuration (a few configurations reach it only with a corner open).
  function record(state, order, area, closed) {
    const kind = V.verdict(order, area);          // "better" | "notYet" | "best" | null
    const next = { g: state.g, c: state.c.slice() };
    let wonConfig = false, wonGlobal = false;
    if (kind === "notYet" || kind === "best") {
      const rank = BEST.rank(order);
      if (!has(next, rank)) {
        next.c.push([rank, Math.min(BEST.counts().best - BEST.bestArea(order), 2)]);
        wonConfig = true;
      }
    }
    if (kind === "best" && closed !== false && !next.g) { next.g = true; wonGlobal = true; }
    return { state: next, kind, wonConfig, wonGlobal };
  }

  function lit(state, order) {
    const rank = order ? BEST.rank(order) : null;
    const config = rank !== null && has(state, rank);
    return { config, global: state.g, tier: config ? V.tier(order) : null };
  }

  function counts(state) {
    return { won: state.c.length, total: BEST.counts().orders, global: state.g };
  }

  function entries(state) {
    return state.c.slice().sort((a, b) => a[0] - b[0]).map((e) => ({ key: e[0], order: BEST.unrank(e[0]), tier: TIERS[e[1]], won: true }));
  }

  function globals(state) {
    const got = { gold: 0, silver: 0 };
    for (const e of state.c) if (e[1] === 0) got.gold += 1; else if (e[1] === 1) got.silver += 1;
    const out = [{ id: "best", kind: "best", won: state.g, n: 0 }];
    for (const n of MILESTONES) out.push({ id: "m" + n, kind: "milestone", won: state.c.length >= n, n });
    for (const tier of ["gold", "silver"]) out.push({ id: "tier-" + tier, kind: tier, won: got[tier] === DATA.tiers[tier], n: DATA.tiers[tier] });
    return out;
  }

  return { KEY, empty, load, save, record, lit, counts, entries, globals };
});

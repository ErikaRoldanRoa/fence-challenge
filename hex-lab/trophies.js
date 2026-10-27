/* Fence Challenge · hex lab: the trophies a player has won, kept on the device.
 * Pure logic, no DOM. Two kinds: one trophy for each configuration (the order of the seven pieces around the fence),
 * won when a closed fence reaches the best area that configuration allows; and one global trophy, won when a closed
 * fence reaches the best area of all. The global trophy, once won, stays won in every configuration.
 *
 *   empty()                      what a new player has: { g: false, c: [] }   (c: the configurations won)
 *   load(storage) / save(storage, state)   the same, through a Storage (never throws; an unreadable one gives empty())
 *   record(state, order, area)   { state, kind, wonConfig, wonGlobal } for a closed fence of all seven pieces
 *   lit(state, order)            { config, global, tier } what the two trophies show for the configuration now on the board
 *   counts(state)                { won, total, global }
 *   entries(state)               every configuration, sorted by key: [{ key, order, tier, won }]  (the case's grid)
 *   globals(state)              the global trophies, derived from what is won: [{ id, kind, won, n }]  (the case's row)
 *                                 best (the best of all), milestones (10, 50, 100, all configurations won), and one for each
 *                                 tier once every configuration of that tier is won */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./verdict.js"), require("./data/orders.js"));
  else root.HexTrophies = factory(root.HexVerdict, root.HexOrderData);
})(typeof self !== "undefined" ? self : this, function (V, DATA) {
  "use strict";

  const KEY = "fc-trophies-hex7";   // one entry for each puzzle: the seven tetrahexes

  function empty() {
    return { g: false, c: [] };
  }

  function clean(raw) {
    if (!raw || typeof raw !== "object") return empty();
    const known = Array.isArray(raw.c) ? raw.c.filter((k) => Object.prototype.hasOwnProperty.call(DATA.areaByOrder, k)) : [];
    return { g: raw.g === true, c: Array.from(new Set(known)) };
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

  function record(state, order, area) {
    const kind = V.verdict(order, area);          // "better" | "notYet" | "best" | null
    const next = { g: state.g, c: state.c.slice() };
    let wonConfig = false, wonGlobal = false;
    if (kind === "notYet" || kind === "best") {
      const key = V.canonicalKey(order);
      if (next.c.indexOf(key) < 0) { next.c.push(key); wonConfig = true; }
    }
    if (kind === "best" && !next.g) { next.g = true; wonGlobal = true; }
    return { state: next, kind, wonConfig, wonGlobal };
  }

  function lit(state, order) {
    const key = order ? V.canonicalKey(order) : null;
    const config = key !== null && state.c.indexOf(key) >= 0;
    return { config, global: state.g, tier: config ? V.tier(order) : null };
  }

  function counts(state) {
    return { won: state.c.length, total: V.counts().orders, global: state.g };
  }

  const MILESTONES = [10, 50, 100, V.counts().orders];
  const TIERS = ["gold", "silver", "bronze"];

  function tierOfKey(key) {
    return TIERS[DATA.best - DATA.areaByOrder[key]];
  }

  function entries(state) {
    const won = new Set(state.c);
    return Object.keys(DATA.areaByOrder).sort().map((key) => ({ key, order: key.split(","), tier: tierOfKey(key), won: won.has(key) }));
  }

  function globals(state) {
    const total = { gold: 0, silver: 0, bronze: 0 }, got = { gold: 0, silver: 0, bronze: 0 };
    const won = new Set(state.c);
    for (const key of Object.keys(DATA.areaByOrder)) {
      total[tierOfKey(key)] += 1;
      if (won.has(key)) got[tierOfKey(key)] += 1;
    }
    const out = [{ id: "best", kind: "best", won: state.g, n: 0 }];
    for (const n of MILESTONES) out.push({ id: "m" + n, kind: "milestone", won: state.c.length >= n, n });
    for (const tier of TIERS) out.push({ id: "tier-" + tier, kind: tier, won: got[tier] === total[tier], n: total[tier] });
    return out;
  }

  return { KEY, empty, load, save, record, lit, counts, entries, globals };
});

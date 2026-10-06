// node cube-lab/tools/make-rooms.js
// The ladder of rooms for "wrap the room": for each room S, a wall made of
// distinct pieces of its step (tetracubes or pentacubes) that holds every
// cube of N(S) \ S, so that S is shut in under the 26-neighbour rule (26
// neighbours) and therefore also when only faces leak. The search covers
// the cells of N(S) \ S, most constrained cell first; pieces may stick out
// of N(S) \ S but never into S. A room without a wall found is left out.
// Writes cube-lab/rooms.js.
"use strict";
const fs = require("fs"), path = require("path");
const G = require("../geometry.js");
const WALLS = require("../walls.js");

const box = (a, b, c) => { const o = []; for (let x = 0; x < a; x++) for (let y = 0; y < b; y++) for (let z = 0; z < c; z++) o.push([x, y, z]); return o; };
const N26 = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) N26.push([x, y, z]);
const F6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function hull(S, nb) {
  const s = new Set(S.map(G.key)), h = new Map();
  S.forEach((c) => nb.forEach((d) => { const q = [c[0] + d[0], c[1] + d[1], c[2] + d[2]], k = G.key(q); if (!s.has(k)) h.set(k, q); }));
  return [...h.values()];
}

// The rooms the pentacube walls of walls.js shut in, read from those walls.
const paperRoom = (id) => { const w = WALLS.find((x) => x.id === id); return { cells: G.enclosed(w.pieces.flat()).enclosed, witness: w.pieces }; };
const w48 = paperRoom("penta_v48"), w49 = paperRoom("penta_v49"), w52 = paperRoom("penta_v52");

const LADDER = [
  { id: "t1", step: "tetra", cells: box(1, 1, 1) },
  { id: "p1", step: "penta", cells: box(1, 1, 1) },
  { id: "p2", step: "penta", cells: box(2, 1, 1) },
  { id: "p3", step: "penta", cells: [[0, 0, 0], [1, 0, 0], [0, 0, 1]] },
  { id: "p4", step: "penta", cells: box(2, 1, 2) },
  { id: "p4t", step: "penta", cells: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 0, 1]] },
  { id: "p8", step: "penta", cells: box(2, 2, 2) },
  { id: "p12", step: "penta", cells: box(2, 3, 2) },
  { id: "p18", step: "penta", cells: box(3, 2, 3) },
  { id: "p27", step: "penta", cells: box(3, 3, 3) },
  { id: "p36", step: "penta", cells: box(3, 4, 3) },
  { id: "p48", step: "penta", cells: w48.cells, witness: w48.witness, from: "penta_v48" },
  { id: "p49", step: "penta", cells: w49.cells, witness: w49.witness, from: "penta_v49" },
  { id: "p52", step: "penta", cells: w52.cells, witness: w52.witness, from: "penta_v52" }
];

function search(S, pieces, cap, seed) {
  const sSet = new Set(S.map(G.key));
  const H = hull(S, N26), hKeys = H.map(G.key), hIndex = new Map(hKeys.map((k, i) => [k, i]));
  let rnd = seed || 1;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // placements touching the hull, as lists of cell keys
  const opts = [], seen = new Set();
  pieces.forEach((orients, pi) => {
    H.forEach((h) => orients.forEach((o) => o.forEach((a) => {
      const cells = o.map((q) => [q[0] - a[0] + h[0], q[1] - a[1] + h[1], q[2] - a[2] + h[2]]);
      const ks = cells.map(G.key);
      if (ks.some((k) => sSet.has(k))) return;
      const id = pi + "|" + ks.slice().sort().join(";");
      if (seen.has(id)) return;
      seen.add(id);
      opts.push({ pi, ks, cells, hits: ks.filter((k) => hIndex.has(k)).map((k) => hIndex.get(k)) });
    })));
  });
  // shuffle for restarts
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const byCell = H.map(() => []);
  opts.forEach((o, i) => o.hits.forEach((h) => byCell[h].push(i)));
  const covered = new Uint8Array(H.length), used = new Uint8Array(pieces.length), taken = new Set(), chosen = [];
  const n = pieces[0][0].length;
  let left = H.length, nodes = 0, found = null;
  function ok(o) { return !used[o.pi] && o.ks.every((k) => !taken.has(k)); }
  function rec() {
    if (found || ++nodes > cap) return;
    if (!left) { found = chosen.map((o) => o.cells); return; }
    let free = 0; for (let i = 0; i < used.length; i++) if (!used[i]) free++;
    if (free * n < left) return;
    let best = -1, bestList = null;
    for (let c = 0; c < H.length; c++) {
      if (covered[c]) continue;
      const l = byCell[c].filter((i) => ok(opts[i]));
      if (!l.length) return;
      if (!bestList || l.length < bestList.length) { best = c; bestList = l; if (l.length === 1) break; }
    }
    // prefer placements that cover more hull cells
    bestList.sort((a, b) => opts[b].hits.filter((h) => !covered[h]).length - opts[a].hits.filter((h) => !covered[h]).length);
    for (const i of bestList) {
      const o = opts[i], newly = o.hits.filter((h) => !covered[h]);
      used[o.pi] = 1; o.ks.forEach((k) => taken.add(k)); newly.forEach((h) => (covered[h] = 1)); left -= newly.length; chosen.push(o);
      rec();
      chosen.pop(); left += newly.length; newly.forEach((h) => (covered[h] = 0)); o.ks.forEach((k) => taken.delete(k)); used[o.pi] = 0;
      if (found || nodes > cap) return;
    }
  }
  rec();
  return { found, nodes };
}

const steps = { tetra: G.polycubes(4).map(G.orientations), penta: G.polycubes(5).map(G.orientations) };
const out = [];
for (const r of LADDER) {
  const S = G.normalize(r.cells);
  const pieces = steps[r.step], cubes = pieces.length * pieces[0][0].length;
  const h26 = hull(S, N26).length, h6 = hull(S, F6).length;
  let wall = null, how = "";
  if (r.witness) {
    // shift the stored wall onto the normalised room
    const lo = [0, 1, 2].map((a) => Math.min(...r.cells.map((c) => c[a])));
    wall = r.witness.map((p) => p.map((c) => [c[0] - lo[0], c[1] - lo[1], c[2] - lo[2]]));
    how = "stored wall " + r.from;
  } else {
    for (let t = 0; t < 40 && !wall; t++) {
      const res = search(S, pieces, 2e5, 7 + t * 9973);
      if (res.found) { wall = res.found; how = `search, restart ${t + 1}`; }
    }
  }
  const line = `${r.id}: room ${S.length}, wall N26 ${h26} (N6 ${h6}), cubes ${cubes}, slack ${cubes - h26}: ${wall ? "wall found (" + how + ", " + wall.length + " pieces)" : "NO WALL FOUND, left out"}`;
  console.log(line);
  if (wall) out.push({ id: r.id, step: r.step, room: S, wall26: h26, wall6: h6, cubes, witness: wall });
}
fs.writeFileSync(path.join(__dirname, "..", "rooms.js"),
  `/* Cube lab: the rooms of "wrap the room", smallest first, written by
 * tools/make-rooms.js. Each room is a set of cells [x, y, z]; wall26 and
 * wall6 are the sizes of its smallest walls N(S) \\ S (corners and edges
 * leak / only faces leak); witness is one wall of distinct pieces of its
 * step that shuts it in, checked by test/geometry.test.js. */
var CUBE_ROOMS = ${JSON.stringify(out)};
if (typeof module !== "undefined" && module.exports) module.exports = CUBE_ROOMS;
`);

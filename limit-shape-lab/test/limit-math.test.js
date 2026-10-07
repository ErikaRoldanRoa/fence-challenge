/* Limit-shape lab · math checks. Run: node limit-shape-lab/test/limit-math.test.js */
"use strict";
const assert = require("assert");
const S = require("../sampler.js");
const DATA = require("../data/paper.js");
const START = require("../data/start500.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

// The counts of free n-ominoes: 5 tetrominoes, and 12, 35, 108, 369, 1285, 4655 as in the paper.
const counts = { 4: 5, 5: 12, 6: 35, 7: 108, 8: 369, 9: 1285, 10: 4655 };
const free = {};
for (const n of Object.keys(counts)) {
  free[n] = S.enumerateFree(+n);
  ok(free[n].length === counts[n], `free ${n}-ominoes: ${free[n].length}`);
}

function connected(cells) {
  const s = new Set(cells.map((c) => c + "")), q = [cells[0]], seen = new Set([cells[0] + ""]);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = [x + dx, y + dy] + "";
      if (s.has(k) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  return seen.size === cells.length;
}

// The longest midpoint-to-midpoint arrow is integral (Lemma), the brute force agrees, ties weigh 1/k.
function bruteLongest(cells) {
  const m = S.midpoints2(cells);
  let best = -1;
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
    const d = (m[i][0] - m[j][0]) ** 2 + (m[i][1] - m[j][1]) ** 2;
    if (d > best) best = d;
  }
  return best;
}
for (const n of [4, 5, 6, 7, 8, 9]) {
  for (const cells of free[n]) {
    const dm = S.diameters(cells);
    ok(dm.d2 === bruteLongest(cells), `hull diameter = brute force (n=${n})`);
    for (const [p, q] of dm.pairs) ok((q[0] - p[0]) % 2 === 0 && (q[1] - p[1]) % 2 === 0, `integral arrow (n=${n})`);
    const v = S.sampleVectors(cells);
    near(v.reduce((a, w) => a + w[2], 0), 1, 1e-12, "tie weights sum to 1");
    for (const w of v) ok(w[0] >= w[1] && w[1] >= 0, "folded into 0..45 degrees");
  }
}

// The five tetrominoes of the hub's card #1 and their arrows.
const tet = (cells) => S.sampleVectors(cells).map((w) => [w[0], w[1], +w[2].toFixed(4)] + "").sort().join(" ");
assert.strictEqual(tet([[0, 0], [1, 0], [2, 0], [3, 0]]), "4,0,1"); checks++;
assert.strictEqual(tet([[0, 0], [0, 1], [0, 2], [1, 2]]), "3,1,1"); checks++;
assert.strictEqual(tet([[0, 0], [0, 1], [1, 1], [1, 2]]), "3,1,1"); checks++;
assert.strictEqual(tet([[0, 0], [1, 0], [0, 1], [1, 1]]), "2,1,0.25 2,1,0.25 2,1,0.25 2,1,0.25"); checks++;
assert.strictEqual(tet([[0, 0], [1, 0], [2, 0], [1, 1]]), "3,0,1"); checks++;

// The chain keeps n cells, edge-connected, with a consistent perimeter.
{
  const c = new S.Chain(30, 3);
  for (let i = 0; i < 4000; i++) {
    c.step();
    if (i % 200 === 0) {
      const cells = c.cells();
      ok(cells.length === 30 && connected(cells), "chain: 30 connected cells");
      const tiles = new Set(cells.map((p) => p + ""));
      const per = new Set();
      for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = [x + dx, y + dy] + "";
        if (!tiles.has(k)) per.add(k);
      }
      const mine = new Set(c.perim.arr.map((k) => [Math.floor(k / (1 << 21)) - (1 << 20), (k % (1 << 21)) - (1 << 20)] + ""));
      ok(per.size === mine.size && [...per].every((k) => mine.has(k)), "chain: perimeter is exactly the free edge neighbours");
    }
  }
}

// Uniform over fixed 10-ominoes: the chain's mean diameter matches the exact mean
// over all 36446 of them. (Counting accepted moves only gives about 5.86, the
// value in data/fit-data.csv.)
{
  let num = 0, den = 0;
  for (const cells of free[10]) {
    const fixed = new Set();
    for (let r = 0; r < 8; r++) {
      let p = cells.map(([a, b]) => { for (let i = 0; i < r % 4; i++) [a, b] = [-b, a]; return [r >= 4 ? -a : a, b]; });
      const mx = Math.min(...p.map((q) => q[0])), my = Math.min(...p.map((q) => q[1]));
      fixed.add(p.map(([a, b]) => [a - mx, b - my]).sort((u, v) => u[0] - v[0] || u[1] - v[1]) + "");
    }
    const d = Math.sqrt(S.diameters(cells).d2) / 2;
    num += d * fixed.size; den += fixed.size;
  }
  const exact = num / den;
  ok(den === 36446, `fixed 10-ominoes: ${den}`);
  near(exact, 5.97003, 0.0001, "exact mean diameter of fixed 10-ominoes");
  const c = new S.Chain(10, 11);
  c.advance(S.burnIn(10));
  let sum = 0, k = 0;
  for (; k < 8000; k++) { c.advance(S.gap(10)); sum += Math.sqrt(S.diameters(c.cells()).d2) / 2; }
  near(sum / k, exact, 0.04, "chain mean diameter vs exact");
}

// The lab's folded loop for all 1285 9-ominoes against the paper's 9-omino fence curve.
{
  const v = [];
  free[9].forEach((cells) => S.sampleVectors(cells).forEach((w) => v.push(w)));
  const end = S.chainDeviation(v).pts.slice(-1)[0];
  const paperEnd = DATA.fences["9"].dev.slice(-1)[0];
  near(end[0], 45, 1e-9, "the folded chain ends on the 45-degree ray");
  near(end[1], paperEnd[1], 0.001, "deviation at 45 degrees, n = 9: lab vs paper fence");
}


// The loop's area, shrunk by 8 (each piece once), next to the paper's fences;
// and the 500-cell estimate from the paper's run.
{
  const loopOver64 = (v) => {
    const ch = S.chainDeviation(v), p = ch.pts;
    let s = 0;
    for (let i = 0; i + 1 < p.length; i++) s += 0.5 * (1 + p[i][1]) * (1 + p[i + 1][1]) * Math.sin((p[i + 1][0] - p[i][0]) * Math.PI / 180);
    return (8 * s * ch.R * ch.R) / 64;
  };
  const vecs = (n) => { const v = []; free[n].forEach((c) => S.sampleVectors(c).forEach((w) => v.push(w))); return v; };
  near(loopOver64(vecs(9)), 4006335.5, 1, "n = 9: loop / 64");
  ok(loopOver64(vecs(9)) > 4003811 && loopOver64(vecs(9)) < 4052974, "n = 9: between the best fence and the bound");
  near(loopOver64(vecs(10)), 60847610.6, 1, "n = 10: loop / 64");
  ok(loopOver64(vecs(10)) > 60832848 && loopOver64(vecs(10)) < 61484424, "n = 10: between the best fence and the bound");
  const p = DATA.dev500;
  let s = 0;
  for (let i = 0; i + 1 < p.length; i++) s += 0.5 * (1 + p[i][1]) * (1 + p[i + 1][1]) * Math.sin((p[i + 1][0] - p[i][0]) * Math.PI / 180);
  const ratio = (8 * s) / Math.PI;
  near(ratio, 1.000869, 0.000002, "500: loop area over circle area, as in the paper's run");
  const logA = Math.log10(ratio * Math.PI) + 2 * (Math.log10(4.46826e8 / 4.5e6) + Math.log10(1.9994e300) - Math.log10(8));
  near(logA, 603.29, 0.01, "500: largest fence estimate about 1.9e603 (each piece once)");
}

// The paper's curves as drawn in the lab.
{
  const h = DATA.hist500;
  ok(h.length === 225, "225 buckets of 0.2 degrees");
  ok(h[1][2] === 0 && h[224][2] === 0, "buckets 0.2-0.4 and 44.8-45 are empty");
  const b = h.find((r) => Math.abs(r[0] - 26.7) < 1e-6);
  near(b[1], 114.07, 0.01, "bucket 26.6-26.8: atypically long vectors");
  ok(b[2] < 0.01, "bucket 26.6-26.8: very few vectors");
  const d = DATA.dev500.map((p) => p[1]);
  near(Math.min(...d), -0.00109, 0.00001, "500: smallest deviation");
  near(Math.max(...d), 0.00399, 0.00001, "500: largest deviation");
  ok(DATA.dev500[0][0] === 0 && DATA.dev500[DATA.dev500.length - 1][0] === 45, "500: phi from 0 to 45 degrees");
}

// The 500-omino the lab starts from.
ok(START.length === 500 && connected(START), "start: one connected 500-omino");
{
  const c = new S.Chain(1, 5);
  c.load(START);
  for (let i = 0; i < 2000; i++) c.step();
  ok(connected(c.cells()) && c.cells().length === 500, "chain from the start stays a 500-omino");
}

console.log(`limit-math: all ${checks} assertions passed`);

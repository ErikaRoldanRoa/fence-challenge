/* Hexomino lab · the 35 free hexominoes, generated (not typed in):
 * grow every free pentomino by one cell, keep one shape per class under the
 * 8 symmetries of the square. Each piece gets a stable index, its cells
 * anchored at (0, 0) and a colour. */
(function (root) {
  "use strict";
  const M = typeof module !== "undefined" && module.exports ? require("./fence-math.js") : root.FenceMath;

  function grow(shapes) {
    const out = new Map();
    for (const cells of shapes) {
      const set = new Set(cells.map((c) => c.join(",")));
      for (const [x, y] of cells) for (const [dx, dy] of M.N4) {
        const k = (x + dx) + "," + (y + dy);
        if (set.has(k)) continue;
        const next = cells.concat([[x + dx, y + dy]]);
        const can = M.canonical(next);
        if (!out.has(can)) out.set(can, can.split(";").map((s) => s.split(",").map(Number)));
      }
    }
    return [...out.values()];
  }

  let shapes = [[[0, 0]]];
  for (let n = 1; n < 6; n++) shapes = grow(shapes);
  shapes.sort((a, b) => {
    // Long pieces first, compact ones last: a calm tray.
    const w = (s) => Math.max(...s.map((c) => c[0])) + Math.max(...s.map((c) => c[1]));
    return w(b) - w(a) || M.canonical(a).localeCompare(M.canonical(b));
  });
  const PIECES = shapes.map((cells, i) => ({
    index: i,
    cells,
    canon: M.canonical(cells),
    hue: Math.round((i * 360) / 35 + 190) % 360,
  }));

  if (typeof module !== "undefined" && module.exports) module.exports = PIECES;
  else root.HEXOMINOES = PIECES;
})(typeof window !== "undefined" ? window : globalThis);

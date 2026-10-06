/* Cube lab: one reader for wall files. They come in two shapes after a
 * first [X, Y, Z] size row:
 *   [x, y, z, "#colour"]  (piece = cubes of one colour), and
 *   [id, x, y, z]         (piece = cubes of one id).
 * parse() returns { size, pieces: [[[x, y, z], ...], ...] } either way. A
 * colour shared by two pieces is split back into face-connected parts. */
(function (root) {
  "use strict";
  var FACE = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  function key(c) { return c[0] + "," + c[1] + "," + c[2]; }

  function parts(cells) {
    var have = {}, seen = {}, out = [];
    cells.forEach(function (c) { have[key(c)] = c; });
    cells.forEach(function (c0) {
      if (seen[key(c0)]) return;
      var part = [], stack = [c0];
      seen[key(c0)] = true;
      while (stack.length) {
        var c = stack.pop();
        part.push(c);
        FACE.forEach(function (d) {
          var q = [c[0] + d[0], c[1] + d[1], c[2] + d[2]], k = key(q);
          if (have[k] && !seen[k]) { seen[k] = true; stack.push(have[k]); }
        });
      }
      out.push(part);
    });
    return out;
  }

  function parse(rows) {
    if (!Array.isArray(rows) || rows.length < 2) throw new Error("not a wall file");
    var size = rows[0].slice(0, 3).map(Number), groups = {}, order = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], g, cell;
      if (r.length !== 4) throw new Error("row " + i + ": expected 4 entries");
      if (typeof r[3] === "string") { g = "c" + r[3].toLowerCase(); cell = [r[0], r[1], r[2]]; }
      else { g = "i" + r[0]; cell = [r[1], r[2], r[3]]; }
      cell = cell.map(Number);
      if (cell.some(function (v) { return !Number.isInteger(v); })) throw new Error("row " + i + ": not integer");
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(cell);
    }
    var pieces = [];
    order.forEach(function (g) { parts(groups[g]).forEach(function (p) { pieces.push(p); }); });
    return { size: size, pieces: pieces };
  }

  var api = { parse: parse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CubeSolutions = api;
})(this);

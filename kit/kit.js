/* Fence Challenge · printable kit.
 *
 * Draws, for each printed board, the sheets a player prints at home:
 *   the board   cells from FenceBoards.geometry(id) with its four corner marks
 *   the pieces  every piece of the board's set once, same scale as the board
 *   the backs   the same pieces mirrored, so a double-sided print (flip on the
 *               long edge) gives every piece a coloured back
 *
 * The board sheet also carries a QR code (bottom centre) that opens the camera
 * page for that board, and its title: the name of the board's pieces.
 *
 * Sheets are SVG in millimetres: one world unit (cell side) is `scale` mm on
 * the board and on the pieces alike. Corner marks are standard ArUco 4x4
 * markers (ARUCO_4X4_1000, id k = entry k): a dark frame one module wide
 * around 4 x 4 bits, bit 1 = white, bits read row by row from the marker's
 * top-left, drawn upright so each mark's reading order matches the corner
 * order stored in the board registry.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const AR = require("../vendor/js-aruco2/aruco.js").AR;
    require("../vendor/js-aruco2/dictionaries/aruco_4x4_1000.js");
    const qrcode = require("../vendor/qrcode-generator/qrcode.js");
    module.exports = factory(require("../camera/boards.js"), AR, qrcode, null);
  } else {
    root.FenceKit = factory(root.FenceBoards, root.AR, root.qrcode, root);
  }
})(typeof self !== "undefined" ? self : this, function (FenceBoards, AR, qrcode, win) {
  "use strict";

  const BOARD_IDS = ["sq9", "hex5", "tri4", "sq20", "hex6", "tri10"];
  // Big boards whose cells get small on A4: the page suggests A3 for them.
  const A3_BOARDS = ["sq20", "hex6", "tri10"];
  // No prototype: a paper name read from the URL or from storage ("constructor",
  // "__proto__", ...) can only match a real entry.
  const PAPERS = Object.freeze(Object.assign(Object.create(null), { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 } }));
  const isPaper = (name) => typeof name === "string" && Object.prototype.hasOwnProperty.call(PAPERS, name);
  const MARGIN = 10; // mm, same as the @page margin
  const SLACK = 1; // mm kept free at the bottom so a sheet never spills onto a second page
  const HEADER = 9; // mm reserved at the top of every sheet for the title line
  const QR_SIZE = 16; // mm, side of the QR code on an A4 board sheet (at most; in proportion on A3, less where the band between the marks is low)
  const CLEAR_MODULES = 2; // white margin kept around the marks, in marker modules
  const SCALE_STEP = 0.5; // the scale is a whole number of half millimetres per unit
  const PIECE_GAP = 6; // mm between pieces (at least)
  const PIECE_ROOM = 1; // mm kept between the pieces and the page margin
  const FALLBACK_BASE = "erikaroldanroa.github.io/fence-challenge/";
  const FONT = "Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  // The hub's small tracked capitals are monospace: the sheets embed IBM Plex Mono (fonts/plex-mono.css).
  const MONO = "'IBM Plex Mono', Manrope, monospace";
  const RING_TOP = 16; // mm: on the pieces sheets the pieces start below this line (the header sits above it)

  const INK = "#111111"; // marks, text and cut lines
  const GRID = "#2563eb"; // strong blue: printed from the colour cartridge alone
  const OUTLINE = "#1e3a8a";
  const MUTED = "#5b5763"; // the hub's muted grey, on paper (6.9:1 on white)

  /* The hub's neon accent of each tiling, for white paper: `neon` is the
   * hub's colour, used only for the light halo (the printed glow); `ink` is
   * the same hue deepened to 4.5:1 on white, so the title still reads on a
   * black-and-white print or a photocopy (a mid grey). */
  // `glow`: share of the neon in the halo's innermost tint, the most that
  // keeps the ink at 3:1 or more against it (pink 3.1, lime 3.9, cyan 3.7).
  const ACCENT = Object.freeze({
    square: { neon: "#ff3bd4", ink: "#dc00ac", glow: 0.3 },
    hexagonal: { neon: "#70ff7a", ink: "#008a0a", glow: 0.5 },
    triangular: { neon: "#2ff3ff", ink: "#00838c", glow: 0.5 },
  });

  // The sheet's kicker: the hub card's mission, or the lab's own title.
  const MISSION = Object.freeze({
    sq9: "hub.sqTitle",
    hex5: "hub.hexTitle",
    tri4: "hub.triTitle",
    sq20: "kit.mission.sq20",
    hex6: "kit.mission.hex6",
    tri10: "kit.mission.tri10",
  });

  // The neon mixed with white paper: share p of the colour.
  function tint(hex, p) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.round(255 - p * (255 - v)).toString(16).padStart(2, "0");
    return "#" + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
  }

  function fmt(v) {
    return String(Math.round(v * 1000) / 1000);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  /* ---------- ArUco marks ---------- */

  // Same decoding as the js-aruco2 dictionary loader: bytes, most significant bit first.
  function markerBits(id) {
    const dict = AR && AR.DICTIONARIES && AR.DICTIONARIES.ARUCO_4X4_1000;
    if (!dict) throw new Error("ArUco dictionary not loaded");
    const entry = dict.codeList[id];
    if (!entry) throw new Error("No ArUco code for id " + id);
    let bits = "";
    for (const byte of entry) bits += byte.toString(2).padStart(8, "0");
    bits = bits.slice(0, dict.nBits);
    const n = Math.round(Math.sqrt(dict.nBits));
    const rows = [];
    for (let y = 0; y < n; y += 1) rows.push(bits.slice(y * n, y * n + n).split("").map(Number));
    return rows;
  }

  // One path holding every dark module, so adjacent modules merge without seams.
  function markerPath(id, x, y, size) {
    const bits = markerBits(id);
    const n = bits.length + 2;
    const u = size / n;
    let d = "";
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const frame = r === 0 || c === 0 || r === n - 1 || c === n - 1;
        const black = frame || bits[r - 1][c - 1] === 0;
        if (!black) continue;
        const x0 = x + c * u;
        const y0 = y + r * u;
        d += "M" + fmt(x0) + " " + fmt(y0) + "H" + fmt(x0 + u) + "V" + fmt(y0 + u) + "H" + fmt(x0) + "Z";
      }
    }
    return d;
  }

  /* ---------- QR code ---------- */

  // Dark modules of a QR code (error correction M, smallest version that fits),
  // one path, each row's dark runs merged into rectangles.
  function qrPath(text, x, y, size) {
    if (!qrcode) return null;
    const qr = qrcode(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const u = size / n;
    let d = "";
    for (let r = 0; r < n; r += 1) {
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) {
          c += 1;
          continue;
        }
        const start = c;
        while (c < n && qr.isDark(r, c)) c += 1;
        const x0 = x + start * u;
        const y0 = y + r * u;
        d += "M" + fmt(x0) + " " + fmt(y0) + "H" + fmt(x + c * u) + "V" + fmt(y0 + u) + "H" + fmt(x0) + "Z";
      }
    }
    return { d, modules: n, module: u };
  }

  /* ---------- polygon edges ---------- */

  function vkey(p) {
    return Math.round(p.x * 1e4) + "," + Math.round(p.y * 1e4);
  }

  // Unique edges of a set of cell polygons: count 1 = outline, count 2 = inner line.
  function edgesOf(polys) {
    const edges = new Map();
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const ka = vkey(a);
        const kb = vkey(b);
        const k = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        const e = edges.get(k);
        if (e) e.count += 1;
        else edges.set(k, { a, b, ka, kb, count: 1 });
      }
    }
    return [...edges.values()];
  }

  // Chain outline edges into closed loops.
  function loopsOf(edges) {
    const byVertex = new Map();
    for (const e of edges) {
      for (const k of [e.ka, e.kb]) {
        if (!byVertex.has(k)) byVertex.set(k, []);
        byVertex.get(k).push(e);
      }
    }
    const used = new Set();
    const loops = [];
    for (const start of edges) {
      if (used.has(start)) continue;
      used.add(start);
      const loop = [start.a];
      let cur = start.kb;
      let curPt = start.b;
      while (cur !== start.ka) {
        loop.push(curPt);
        const next = byVertex.get(cur).find((e) => !used.has(e));
        if (!next) break;
        used.add(next);
        if (next.ka === cur) {
          cur = next.kb;
          curPt = next.b;
        } else {
          cur = next.ka;
          curPt = next.a;
        }
      }
      loops.push(loop);
    }
    return loops;
  }

  function loopsPath(loops, tx) {
    let d = "";
    for (const loop of loops) {
      loop.forEach((p, i) => {
        const q = tx(p);
        d += (i ? "L" : "M") + fmt(q.x) + " " + fmt(q.y);
      });
      d += "Z";
    }
    return d;
  }

  function segmentsPath(edges, tx) {
    let d = "";
    for (const e of edges) {
      const a = tx(e.a);
      const b = tx(e.b);
      d += "M" + fmt(a.x) + " " + fmt(a.y) + "L" + fmt(b.x) + " " + fmt(b.y);
    }
    return d;
  }

  function bboxOf(points) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  /* ---------- piece colours ---------- */

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255).toString(16).padStart(2, "0");
    };
    return "#" + f(0) + f(8) + f(4);
  }

  // CIE L* (0 black .. 100 white) of an sRGB colour.
  function lightness(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const y = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  }

  // Strong, mid-dark ink for white paper: every hue at the same perceived lightness,
  // dark enough to stand out from the paper, saturated enough to tell apart.
  const INK_LIGHTNESS = 47;
  function inkForHue(h) {
    let lo = 0.05;
    let hi = 0.6;
    for (let i = 0; i < 30; i += 1) {
      const mid = (lo + hi) / 2;
      if (lightness(hslToHex(h, 0.85, mid)) < INK_LIGHTNESS) lo = mid;
      else hi = mid;
    }
    return hslToHex(h, 0.85, (lo + hi) / 2);
  }

  // Hues spread for the eye rather than evenly around the wheel (greens take less room).
  const HUES = [0, 24, 45, 80, 135, 170, 195, 215, 245, 275, 300, 330];

  function pieceColors(types) {
    const n = types.length;
    return types.map((t, i) => {
      if (t.color) return inkForHue(hexToHsl(t.color).h);
      return inkForHue(HUES[Math.floor((i * HUES.length) / n) % HUES.length]);
    });
  }

  /* ---------- layout ---------- */

  function pieceShapes(boardId) {
    const g = FenceBoards.geometry(boardId);
    const lattice = g.lattice;
    const types = FenceBoards.printTypes(boardId);
    const colors = pieceColors(types);
    return types.map((type, i) => {
      // The orientation with the smallest bounding box, lying flat if possible;
      // and the smallest one standing upright, for the sides of the pieces sheet.
      let chosen = null;
      let upright = null;
      for (const v of lattice.buildVariants(type.cells).variants) {
        const polys = v.cells.map((c) => lattice.cellWorldVertices(c));
        const bb = bboxOf(polys.flat());
        const area = bb.w * bb.h;
        const flat = bb.w >= bb.h - 1e-9 ? 0 : 1;
        if (!chosen || area < chosen.area - 1e-6 || (Math.abs(area - chosen.area) <= 1e-6 && flat < chosen.flat)) {
          chosen = { polys, bb, area, flat };
        }
        if (bb.h >= bb.w - 1e-9 && (!upright || area < upright.area - 1e-6)) upright = { polys, bb, area };
      }
      const shapeOf = (o) => {
        const edges = edgesOf(o.polys);
        return {
          id: type.id,
          cellCount: type.cells.length,
          color: colors[i],
          polys: o.polys,
          bb: o.bb,
          loops: loopsOf(edges.filter((e) => e.count === 1)),
          inner: edges.filter((e) => e.count === 2),
        };
      };
      const shape = shapeOf(chosen);
      shape.upright = upright ? shapeOf(upright) : shape;
      return shape;
    });
  }

  /* The pieces around the sheet, like the tray around the board on the hub:
   * a top row and a bottom row across the whole width, a column down each
   * side between them, the centre left open. The pieces go round in the
   * order of their colours (clockwise from the top left, a colour wheel);
   * pieces in the rows lie flat, pieces in the columns stand upright, each
   * aligned on the sheet's outer edge. Of every way to cut the sequence into
   * four sides, the one whose spaces between pieces are the most even wins.
   * Returns { shapes, place } (shapes in the orientation drawn) or null when
   * no ring fits at this scale. */
  function ringPieces(shapes, scale, x0, width, top, bottom) {
    const gap = Math.max(PIECE_GAP, 0.45 * scale);
    const n = shapes.length;
    if (n < 4) return null;
    const flatW = (sh) => sh.bb.w * scale;
    const flatH = (sh) => sh.bb.h * scale;
    const tallW = (sh) => sh.upright.bb.w * scale;
    const tallH = (sh) => sh.upright.bb.h * scale;
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    let best = null;
    for (let start = 0; start < n; start += 1) {
      const seq = [];
      for (let k = 0; k < n; k += 1) seq.push((start + k) % n);
      for (let a = 1; a <= n - 3; a += 1) {
        for (let b = 1; a + b <= n - 2; b += 1) {
          for (let c = 1; a + b + c <= n - 1; c += 1) {
            const topIds = seq.slice(0, a);
            const rightIds = seq.slice(a, a + b);
            const botIds = seq.slice(a + b, a + b + c).reverse();
            const leftIds = seq.slice(a + b + c).reverse();
            // rows: the ends at the corners, the others evenly between
            const rowGap = (ids) => {
              const free = width - sum(ids.map((i) => flatW(shapes[i])));
              return ids.length === 1 ? free / 2 : free / (ids.length - 1);
            };
            const gT = rowGap(topIds);
            const gB = rowGap(botIds);
            if (gT < gap - 1e-9 || gB < gap - 1e-9) continue;
            const tT = Math.max(...topIds.map((i) => flatH(shapes[i])));
            const tB = Math.max(...botIds.map((i) => flatH(shapes[i])));
            const y0 = top + tT + gap;
            const y1 = bottom - tB - gap;
            // columns: evenly spaced, as much room above the first as below the last
            const colGap = (ids) => (y1 - y0 - sum(ids.map((i) => tallH(shapes[i])))) / (ids.length + 1);
            const gL = colGap(leftIds);
            const gR = colGap(rightIds);
            if (gL < (leftIds.length > 1 ? gap : 0) - 1e-9 || gR < (rightIds.length > 1 ? gap : 0) - 1e-9) continue;
            const thick = (ids) => Math.max(...ids.map((i) => tallW(shapes[i])));
            if (thick(leftIds) + thick(rightIds) + gap > width) continue;
            // the spaces seen along the ring: between the pieces of a side, and
            // from the corners into the columns
            const gaps = [gT, gB, gL + gap, gR + gap];
            const score = Math.max(...gaps) / Math.min(...gaps) + (a === c ? 0 : 0.05) + (b === leftIds.length ? 0 : 0.05) + start * 1e-4;
            if (!best || score < best.score - 1e-9) best = { score, topIds, rightIds, botIds, leftIds, y0, y1, gT, gB, gL, gR, widest: Math.max(...gaps) };
          }
        }
      }
    }
    if (!best) return null;
    if (x0 === undefined) return best;
    const outShapes = shapes.slice();
    const place = new Array(n);
    const row = (ids, g, atBottom) => {
      let x = x0 + (ids.length === 1 ? g : 0);
      for (const i of ids) {
        place[i] = { x, y: atBottom ? bottom - flatH(shapes[i]) : top };
        x += flatW(shapes[i]) + g;
      }
    };
    const col = (ids, g, right) => {
      let y = best.y0 + g;
      for (const i of ids) {
        outShapes[i] = shapes[i].upright;
        place[i] = { x: x0 + (right ? width - tallW(shapes[i]) : 0), y };
        y += tallH(shapes[i]) + g;
      }
    };
    row(best.topIds, best.gT, false);
    row(best.botIds, best.gB, true);
    col(best.leftIds, best.gL, false);
    col(best.rightIds, best.gR, true);
    return { shapes: outShapes, place };
  }

  // The pieces of one sheet: in a ring when they fit so, else in rows.
  // Small pieces on a large sheet would stand far apart along its edges: the
  // ring then draws in, around the centre of the sheet, until the widest
  // space along it is at most RING_SPACE gaps.
  const RING_SPACE = 5;
  const RING_LEAST = 0.7; // and keeps at least this share of the sheet, a frame rather than a cluster
  // Every piece keeps PIECE_ROOM of the printable area beyond its sides, so
  // the page margin never touches it. (The scale is chosen before, on the
  // whole width; at worst, when the pieces only fit without that room, they
  // are laid as before.)
  function arrangePieces(shapes, scale, width, bottom) {
    const inner = arrangeWithin(shapes, scale, width - 2 * PIECE_ROOM, bottom);
    if (!inner) return arrangeWithin(shapes, scale, width, bottom);
    inner.place = inner.place.map((p) => ({ x: p.x + PIECE_ROOM, y: p.y }));
    return inner;
  }
  function arrangeWithin(shapes, scale, width, bottom) {
    const gap = Math.max(PIECE_GAP, 0.45 * scale);
    const H = bottom - RING_TOP;
    let f = 1;
    for (let t = 1; t >= RING_LEAST - 1e-9; t -= 0.02) {
      const w = width * t;
      const h = H * t;
      const best = ringPieces(shapes, scale, undefined, w, 0, h);
      if (!best) break;
      f = t;
      if (best.widest <= RING_SPACE * gap) break;
    }
    const w = width * f;
    const h = H * f;
    const ring = ringPieces(shapes, scale, (width - w) / 2, w, RING_TOP + (H - h) / 2, RING_TOP + (H + h) / 2);
    if (ring) return ring;
    const place = packPieces(shapes, scale, width, RING_TOP, bottom) || packPieces(shapes, scale, width, HEADER + 3, bottom);
    return place ? { shapes: shapes.slice(), place } : null;
  }

  // Shelf packing of the pieces at `scale`; returns placements or null if they overflow.
  function packPieces(shapes, scale, width, top, bottom) {
    const gap = Math.max(PIECE_GAP, 0.45 * scale);
    const order = shapes.map((s, i) => i).sort((a, b) => shapes[b].bb.h - shapes[a].bb.h || a - b);
    const rows = [];
    let row = null;
    for (const i of order) {
      const w = shapes[i].bb.w * scale;
      const h = shapes[i].bb.h * scale;
      if (w > width) return null;
      if (!row || row.w + gap + w > width) {
        row = { items: [], w: 0, h: 0 };
        rows.push(row);
      }
      row.items.push({ i, w, h });
      row.w += (row.items.length > 1 ? gap : 0) + w;
      row.h = Math.max(row.h, h);
    }
    const total = rows.reduce((acc, r) => acc + r.h, 0) + gap * (rows.length - 1);
    if (top + total > bottom) return null;
    const place = new Array(shapes.length);
    let y = top;
    for (const r of rows) {
      let x = (width - r.w) / 2;
      for (const it of r.items) {
        place[it.i] = { x, y: y + (r.h - it.h) / 2 };
        x += it.w + gap;
      }
      y += r.h + gap;
    }
    return place;
  }

  const layoutCache = new Map();

  /* Everything about one board printed on one paper size, in millimetres.
   * Sheet coordinates start at the top-left corner of the printable area. */
  function layout(boardId, paperName) {
    const key = boardId + "|" + paperName;
    if (layoutCache.has(key)) return layoutCache.get(key);
    if (!isPaper(paperName)) throw new Error("Unknown paper: " + paperName);
    const paper = PAPERS[paperName];
    const g = FenceBoards.geometry(boardId);
    if (!g.markers) throw new Error("Board has no printed marks: " + boardId);
    const cw = paper.w - 2 * MARGIN;
    const ch = paper.h - 2 * MARGIN - SLACK;
    const ext = g.extent;
    const module = g.markerSize / 6;
    const pad = CLEAR_MODULES * module;
    const W = ext.maxX - ext.minX + 2 * pad;
    const H = ext.maxY - ext.minY + 2 * pad;
    // The board sheet keeps no strip for text: the title, the credit and the
    // QR code sit between the corner marks, so the board takes the whole page.
    const areaTop = 0;
    const areaH = ch;
    let scale = Math.floor(Math.min(cw / W, areaH / H) / SCALE_STEP) * SCALE_STEP;
    const shapes = pieceShapes(boardId);
    let place = null;
    while (scale > SCALE_STEP) {
      place = packPieces(shapes, scale, cw, HEADER + 3, ch);
      if (place) break;
      scale -= SCALE_STEP;
    }
    // (The scale is set by the rows of packPieces, as always; the sheet then
    // lays the pieces around the page at that scale.)
    const arranged = arrangePieces(shapes, scale, cw, ch);
    if (arranged) place = arranged.place;
    const ox = (cw - (ext.maxX - ext.minX) * scale) / 2 - ext.minX * scale;
    const oy = areaTop + (areaH - (ext.maxY - ext.minY) * scale) / 2 - ext.minY * scale;
    const out = {
      boardId,
      paper: paperName,
      pageW: paper.w,
      pageH: paper.h,
      margin: MARGIN,
      cw,
      ch,
      scale,
      module,
      ox,
      oy,
      geometry: g,
      shapes: arranged ? arranged.shapes : shapes,
      flatShapes: shapes,
      place,
      toSheet: (p) => ({ x: ox + p.x * scale, y: oy + p.y * scale }),
    };
    layoutCache.set(key, out);
    return out;
  }

  /* ---------- labels ---------- */

  function fallbackT(key, vars) {
    let s = key;
    if (vars) s += " " + JSON.stringify(vars);
    return s;
  }

  function formatCount(n, lang) {
    try {
      return new Intl.NumberFormat(lang || "en").format(n);
    } catch (e) {
      return String(n);
    }
  }

  function boardName(boardId, t, lang) {
    const g = FenceBoards.geometry(boardId);
    const def = g.def;
    if (def.lattice === "square") return t("kit.board.square", { w: def.spec.size, h: def.spec.size });
    // side: hexagons along one edge (radius + 1), triangle edges along one side
    const side = def.lattice === "hexagonal" ? def.spec.radius + 1 : def.spec.hexSide;
    return t("kit.board.side", { lattice: t("kit.lattice." + def.lattice), n: formatCount(side, lang) });
  }

  function piecesName(boardId, t) {
    const def = FenceBoards.get(boardId);
    const types = FenceBoards.printTypes(boardId);
    const order = types[0].cells.length;
    return t("kit.pc." + def.lattice + order, { n: types.length });
  }

  // The name of the pieces of a board, as a title: "Pentominoes", "Hexiamonds".
  function polyformName(boardId, t) {
    const def = FenceBoards.get(boardId);
    const types = FenceBoards.printTypes(boardId);
    return t("kit.title." + def.lattice + types[0].cells.length);
  }

  function cameraAddress(boardId) {
    let base = FALLBACK_BASE;
    try {
      const loc = win && win.location;
      if (loc && loc.protocol === "https:" && loc.host) {
        base = loc.host + loc.pathname.replace(/kit\/[^/]*$/, "");
      }
    } catch (e) {
      base = FALLBACK_BASE;
    }
    return base + "camera/?board=" + boardId;
  }

  // The full link the QR code opens (the printed address, with its scheme).
  function cameraUrl(boardId, address) {
    return "https://" + (address || cameraAddress(boardId));
  }

  /* ---------- sheets ---------- */

  function svgOpen(L, label, cls) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" class="' + cls + '" width="' + fmt(L.cw) + 'mm" height="' + fmt(L.ch) +
      'mm" viewBox="0 0 ' + fmt(L.cw) + " " + fmt(L.ch) + '" role="img" aria-label="' + esc(label) + '">'
    );
  }

  /* ---------- type (the hub's: Manrope, heavy titles, tracked capitals) ---------- */

  // A run of text: { text, size (mm), weight, track (em), caps, fill }.
  // Its width is estimated from Manrope's proportions (nothing can be
  // measured while the sheet is built, in node or before the font loads);
  // the estimate leans wide, so a line fitted with it never overflows.
  function runWidth(r) {
    let em = r.gap || 0;
    const text = r.caps ? r.text.toUpperCase() : r.text;
    if (r.mono) return (em + [...text].length * (0.6 + (r.track || 0))) * r.size;
    for (const ch of text) {
      if (ch === " ") em += 0.27;
      else if (/[.,·:;'’]/.test(ch)) em += 0.3;
      else if (/[A-ZÀ-ÖØ-Þ]/.test(ch)) em += /[MW]/.test(ch) ? 0.92 : 0.72;
      else if (/[0-9]/.test(ch)) em += 0.6;
      else em += /[mw]/.test(ch) ? 0.88 : /[ilj]/.test(ch) ? 0.3 : 0.6;
      em += r.track || 0;
    }
    return em * r.size * ((r.weight || 400) >= 700 ? 1.06 : 1);
  }

  function runsWidth(runs) {
    return runs.reduce((acc, r) => acc + runWidth(r), 0);
  }

  // Runs scaled down together until they fit `room` (never up).
  function fitRuns(runs, room) {
    const k = Math.min(1, room / Math.max(1e-6, runsWidth(runs)));
    return runs.map((r) => Object.assign({}, r, { size: r.size * k }));
  }

  // One line of runs at (x, y), anchored start, middle or end.
  // `paint` (optional) paints every run alike: { fill, stroke, width } (a halo layer).
  function textLine(cls, x, y, anchor, runs, paint) {
    let out = '<text class="' + cls + '" x="' + fmt(x) + '" y="' + fmt(y) + '" text-anchor="' + anchor + '" font-family="' + FONT + '" fill="' + (paint ? paint.fill : INK) + '"' +
      (paint && paint.stroke ? ' stroke="' + paint.stroke + '" stroke-width="' + fmt(paint.width) + '" stroke-linejoin="round" aria-hidden="true"' : "") + ">";
    for (const r0 of runs) {
      const r = paint ? Object.assign({}, r0, { fill: null }) : r0;
      out += '<tspan font-size="' + fmt(r.size) + '" font-weight="' + (r.weight || 400) + '"' +
        (r.mono ? ' font-family="' + MONO + '"' : "") +
        (r.gap ? ' dx="' + fmt(r.gap * r.size) + '"' : "") +
        (r.track ? ' letter-spacing="' + fmt(r.track * r.size) + '"' : "") +
        (r.fill && r.fill !== INK ? ' fill="' + r.fill + '"' : "") + ">" + esc(r.caps ? r.text.toUpperCase() : r.text) + "</tspan>";
    }
    return out + "</text>";
  }

  /* A line lit like the hub's neon titles (text-shadow 0 0 8px / 22px of the
   * accent), printed: under the ink, the same letters stroked ever wider in
   * ever paler tints of the neon, a soft halo that stays light in grey. `w` is
   * the widest stroke, in mm. */
  function glowLine(cls, x, y, anchor, runs, accent, w) {
    const layers = [
      { p: 0.28 * accent.glow, k: 1 },
      { p: 0.6 * accent.glow, k: 0.62 },
      { p: accent.glow, k: 0.32 },
    ];
    let out = '<g class="' + cls + '-glow" aria-hidden="true">';
    for (const l of layers) {
      const c = tint(accent.neon, l.p);
      out += textLine(cls + "-halo", x, y, anchor, runs, { fill: c, stroke: c, width: w * l.k });
    }
    out += "</g>";
    return out + textLine(cls, x, y, anchor, runs.map((r) => Object.assign({}, r, { fill: accent.ink })));
  }

  // The hub's camera icon (24 x 24, stroked), at (x, y) with side `size`.
  function cameraIcon(x, y, size, color) {
    const k = size / 24;
    return '<g transform="translate(' + fmt(x) + " " + fmt(y) + ") scale(" + fmt(k) + ')" fill="none" stroke="' + color +
      '" stroke-width="1.9" stroke-linejoin="round"><path d="M3.5 8.2h3.6l1.7-2.6h6.4l1.7 2.6h3.6v10.6H3.5z"/><circle cx="12" cy="13.3" r="3.3"/></g>';
  }

  // The credit, as on the hub: by THE LEARNING MACHINE · CEO Dr. Erika Roldán.
  function creditRuns(by, size) {
    return [
      { text: by, size, weight: 500 },
      { text: "THE LEARNING MACHINE", size, weight: 800, track: 0.1, gap: 0.3 },
      { text: "·", size, weight: 500, gap: 0.35 },
      { text: "CEO", size: size * 0.86, weight: 600, track: 0.08, gap: 0.52 },
      { text: "Dr. Erika Roldán", size, weight: 800, gap: 0.3 },
    ];
  }

  // The room between two corner marks (sheet frame): a and b are the boxes of
  // the left and the right mark, `pad` their light margin.
  function bandBetween(a, b, pad) {
    return { x0: a.x1 + pad, x1: b.x0 - pad, y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) };
  }

  // Between the top marks, centred as a hub card's head: the brand in small
  // tracked capitals, the name of the pieces large and heavy in the tiling's
  // neon (deepened for paper, with its printed glow), and under it, as the
  // hub's mono kicker, the mission this board is played in, between two
  // short accent rules.
  function titleBlock(band, opts, k) {
    const acc = opts.accent;
    const glow = 1.8 * k; // widest halo stroke, mm
    const w = band.x1 - band.x0;
    const cx = (band.x0 + band.x1) / 2;
    const brand = fitRuns([{ text: "Fence Challenge", size: 2.5 * k, weight: 600, track: 0.3, caps: true, mono: true, fill: MUTED }], w);
    const head = fitRuns([{ text: opts.polyform, size: 13.5 * k, weight: 800, track: -0.02 }], w - glow - 4 * k);
    const rule = 7 * k; // each accent rule
    const rgap = 2.4 * k;
    const kick = fitRuns([{ text: opts.mission, size: 2.9 * k, weight: 600, track: 0.14, caps: true, mono: true, fill: MUTED }], w - 2 * (rule + rgap));
    const cap = 0.72; // Manrope cap height, in em
    const capM = 0.7; // Plex Mono cap height, in em
    const hB = capM * brand[0].size;
    const hH = cap * head[0].size;
    const hK = capM * kick[0].size;
    const g1 = 3.2 * k;
    const g2 = 3.9 * k;
    const total = hB + g1 + hH + g2 + hK;
    const yB = (band.y0 + band.y1) / 2 - total / 2 + hB;
    const yH = yB + g1 + hH;
    const yK = yH + g2 + hK;
    // letter-spacing adds room after the last letter: shift tracked lines by half of it to stay centred
    const half = (r) => (r.track * r.size) / 2;
    const kw = runsWidth(kick) - 2 * half(kick[0]);
    const ry = yK - hK / 2;
    const rw = 0.42 * k;
    let out = textLine("kit-brand", cx + half(brand[0]), yB, "middle", brand);
    out += glowLine("kit-title", cx, yH, "middle", head, acc, glow);
    out += '<path class="kit-rule" d="M' + fmt(cx - kw / 2 - rgap - rule) + " " + fmt(ry) + "h" + fmt(rule) + "M" + fmt(cx + kw / 2 + rgap) + " " + fmt(ry) + "h" + fmt(rule) +
      '" stroke="' + acc.ink + '" stroke-width="' + fmt(rw) + '" stroke-linecap="round"/>';
    out += textLine("kit-kicker", cx + half(kick[0]), yK, "middle", kick);
    return out;
  }

  /* Between the bottom marks, like a lit control of the hub: the QR code in a
   * rounded frame of the tiling's accent (a hub pill, with its glow), centred,
   * as tall as the marks; at its left the hub's camera icon and "Open the
   * camera", pointing at it; at its right the credit. The QR keeps 3
   * modules of white inside the frame, and stays farther than 0.3 of a mark's
   * side from every mark. */
  const QR_QUIET = 3; // modules of white between the code and its frame
  function footBlock(band, opts, k, markSide) {
    const acc = opts.accent;
    const w = band.x1 - band.x0;
    const cx = (band.x0 + band.x1) / 2;
    const bandH = band.y1 - band.y0;
    const qr0 = qrPath(opts.url, 0, 0, 1);
    const n = qr0 ? qr0.modules : 37;
    const sw = 0.55 * k; // frame stroke
    const glowW = 2.2 * k; // its halo, outside
    // frame: as tall as the marks (its pale glow reaches past them, between
    // them, away from their light margin), or less where the band is narrow
    const F = Math.min(bandH, w + 2 * (CLEAR_MODULES / 6 - 0.3) * markSide - glowW, 0.34 * w);
    const q = (F - 2 * sw) / (1 + (2 * QR_QUIET) / n);
    const fx = cx - F / 2;
    const fy = band.y0 + (bandH - F) / 2;
    const r = 0.17 * F;
    const rect = (x, y, s, rr) => "M" + fmt(x + rr) + " " + fmt(y) + "H" + fmt(x + s - rr) + "A" + fmt(rr) + " " + fmt(rr) + " 0 0 1 " + fmt(x + s) + " " + fmt(y + rr) +
      "V" + fmt(y + s - rr) + "A" + fmt(rr) + " " + fmt(rr) + " 0 0 1 " + fmt(x + s - rr) + " " + fmt(y + s) + "H" + fmt(x + rr) +
      "A" + fmt(rr) + " " + fmt(rr) + " 0 0 1 " + fmt(x) + " " + fmt(y + s - rr) + "V" + fmt(y + rr) + "A" + fmt(rr) + " " + fmt(rr) + " 0 0 1 " + fmt(x + rr) + " " + fmt(y) + "Z";
    let out = '<g class="kit-qr-frame" aria-hidden="true">';
    out += '<path d="' + rect(fx, fy, F, r) + '" fill="#fff" stroke="' + tint(acc.neon, 0.22) + '" stroke-width="' + fmt(sw + glowW) + '"/>';
    out += '<path d="' + rect(fx, fy, F, r) + '" fill="#fff" stroke="' + tint(acc.neon, 0.45) + '" stroke-width="' + fmt(sw + 0.9 * k) + '"/>';
    out += '<path d="' + rect(fx, fy, F, r) + '" fill="#fff" stroke="' + acc.ink + '" stroke-width="' + fmt(sw) + '"/>';
    out += "</g>";
    const qx = cx - q / 2;
    const qy = fy + (F - q) / 2;
    const qr = qrPath(opts.url, qx, qy, q);
    if (qr) {
      out += '<path class="kit-qr" data-url="' + esc(opts.url) + '" data-modules="' + qr.modules + '" fill="' + INK +
        '" shape-rendering="crispEdges" d="' + qr.d + '"/>';
    }
    // the two sides, between the frame's glow and the band's ends
    const gapSide = 2.6 * k;
    const sideW = w / 2 - F / 2 - glowW / 2 - gapSide;
    const midY = fy + F / 2;
    // left: the hub's camera icon, "OPEN THE CAMERA" on two lines (cut at
    // its last space) and an arrow at the code, ending at the frame
    const arrowW = 4.4 * k; // a drawn arrow (no font carries it the same everywhere)
    const iconS0 = 6.4 * k;
    const cut = opts.cameraLabel.lastIndexOf(" ");
    const words = cut > 0 ? [opts.cameraLabel.slice(0, cut), opts.cameraLabel.slice(cut + 1)] : [opts.cameraLabel];
    const lab0 = 4 * k;
    const labRuns = (text, size) => [{ text, size, weight: 600, track: 0.12, caps: true, mono: true, fill: acc.ink }];
    const widest = Math.max(...words.map((t) => runsWidth(labRuns(t, lab0))));
    const f0 = Math.min(1, (sideW - arrowW - iconS0 - 3 * k) / widest);
    const lsz = lab0 * f0;
    const hL = 0.7 * lsz;
    const gL = 0.75 * lsz; // between the two lines
    const aw = arrowW * f0;
    const iconS = iconS0 * f0;
    const lx = cx - F / 2 - glowW / 2 - gapSide;
    const ah = 1.3 * k * f0;
    out += '<path class="kit-cam-arrow" d="M' + fmt(lx - aw + 0.8 * k) + " " + fmt(midY) + "H" + fmt(lx) + "M" + fmt(lx - ah) + " " + fmt(midY - ah) + "L" + fmt(lx) + " " + fmt(midY) + "L" + fmt(lx - ah) + " " + fmt(midY + ah) +
      '" fill="none" stroke="' + acc.ink + '" stroke-width="' + fmt(0.5 * k) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    // (Chromium drops the trailing letter-spacing of an end-anchored line: the label ends here, a gap before the arrow)
    const lend = lx - aw - 0.9 * k;
    const ly0 = midY - (words.length * hL + (words.length - 1) * gL) / 2 + hL;
    words.forEach((t, i) => {
      out += textLine("kit-cam-label", lend, ly0 + i * (hL + gL), "end", labRuns(t, lsz));
    });
    const lstart = lend - (widest * f0 - 0.12 * lsz); // mono advances are exact
    out += '<g class="kit-cam" aria-hidden="true">' + cameraIcon(lstart - 1.6 * k - iconS, midY - iconS * 0.55, iconS, acc.ink) + "</g>";
    // right: the credit on three lines, as large as the side allows, keeping
    // one more module of white from its mark than the band does:
    // "by" / THE LEARNING MACHINE / CEO Dr. Erika Roldán. The brand line is
    // the same in every language: it is fitted on its measured width (13.06 em
    // in Manrope 800 tracked 0.06 em, read from a printed sheet; 0.6 em less
    // at 0.03 em), the other two on runWidth's estimate.
    const TLM_EM = 12.46;
    const sz = 3.4 * k;
    const lines = [
      [{ text: opts.by, size: sz * 0.9, weight: 500, fill: MUTED }],
      [{ text: "THE LEARNING MACHINE", size: sz, weight: 800, track: 0.03, fill: acc.ink }],
      [{ text: "CEO", size: sz * 0.86, weight: 600, track: 0.08, fill: MUTED }, { text: "Dr. Erika Roldán", size: sz, weight: 700, gap: 0.3 }],
    ];
    const f = Math.min(1, (sideW - markSide / 6) / Math.max(runsWidth(lines[0]), TLM_EM * sz, runsWidth(lines[2])));
    const hC = 0.72 * sz * f;
    const gC = 1.9 * k * f;
    const rx = cx + F / 2 + glowW / 2 + gapSide;
    const y1 = midY - (3 * hC + 2 * gC) / 2 + hC;
    lines.forEach((ln, i) => {
      out += textLine("kit-credit", rx, y1 + i * (gC + hC), "start", ln.map((x) => Object.assign({}, x, { size: x.size * f })));
    });
    return out;
  }

  // The head of a pieces sheet, one line at the top: the name of the pieces in
  // the tiling's neon (deepened, with its glow), what the sheet is in the
  // hub's mono capitals, and the credit at the right.
  function piecesHead(L, opts, tag) {
    const k = L.cw / 190;
    const left = [{ text: opts.polyform, size: 6.6 * k, weight: 800, track: -0.015 }];
    const mid = [{ text: tag, size: 2.5 * k, weight: 600, track: 0.16, caps: true, mono: true, fill: MUTED }];
    const right = creditRuns(opts.by, 2.6 * k).map((r) => (r.text === "THE LEARNING MACHINE" ? Object.assign({}, r, { fill: opts.accent.ink }) : r.text === opts.by || r.text === "CEO" || r.text === "·" ? Object.assign({}, r, { fill: MUTED }) : r));
    const glow = 1.1 * k;
    const g = 3.2 * k;
    const room = L.cw - 8 - glow - g;
    const wl = runsWidth(left) + runsWidth(mid);
    const wr = runsWidth(right);
    const f = Math.min(1, room / (wl + wr));
    const fit = (runs) => runs.map((r) => Object.assign({}, r, { size: r.size * f }));
    // The baseline: 8.2 mm, or lower when the title is large (A3), so its
    // accents (0.8 em above the baseline in Manrope 800) and their glow stay on
    // the sheet, 0.4 mm below its top.
    const y = Math.max(8.2, 0.82 * left[0].size * f + glow / 2 + 0.4);
    const x0 = glow / 2;
    return glowLine("kit-title", x0, y, "start", fit(left), opts.accent, glow) +
      textLine("kit-tag", x0 + runsWidth(fit(left)) + g, y, "start", fit(mid)) +
      textLine("kit-credit", L.cw, y, "end", fit(right));
  }

  // Every line of the board is centred on the cell boundary. A piece is cut
  // exactly on its cells' edge (the outer edge of its blue border), so it covers
  // half of the grid line under each of its edges, and its neighbour the other half.
  function gridLineWidth(s) {
    return Math.min(1.2, Math.max(0.5, 0.045 * s));
  }

  function boardSheet(L, opts) {
    const g = L.geometry;
    const tx = L.toSheet;
    const s = L.scale;
    const edges = edgesOf(g.board.cells.map((c) => c.vertices));
    const inner = edges.filter((e) => e.count === 2);
    const outer = edges.filter((e) => e.count === 1);
    const lineW = gridLineWidth(s);
    let svg = svgOpen(L, opts.title, "kit-sheet kit-board");
    svg += '<g class="kit-cells" data-cells="' + g.board.cells.length + '" fill="none" stroke-linecap="round">';
    svg += '<path d="' + segmentsPath(inner, tx) + '" stroke="' + GRID + '" stroke-width="' + fmt(lineW) + '"/>';
    svg += '<path d="' + loopsPath(loopsOf(outer), tx) + '" stroke="' + OUTLINE + '" stroke-width="' + fmt(lineW * 1.6) + '" stroke-linejoin="round"/>';
    svg += "</g>";
    const box = {};
    for (const corner of FenceBoards.CORNERS) {
      const m = g.markers[corner];
      const tl = tx(m.corners[0]);
      const br = tx(m.corners[2]);
      box[corner] = { x0: tl.x, y0: tl.y, x1: br.x, y1: br.y };
      svg += '<path class="kit-mark" data-corner="' + corner + '" data-id="' + m.id + '" fill="' + INK + '" d="' +
        markerPath(m.id, tl.x, tl.y, br.x - tl.x) + '"/>';
    }
    // Between the top marks the title; between the bottom marks the QR code
    // that opens the camera for this board, and the credit. (The camera
    // measures the board from its corner marks, so the printed size does not
    // matter; the board and its pieces only need to be printed at the same size.)
    const pad = CLEAR_MODULES * L.module * s;
    const k = L.cw / 190;
    svg += titleBlock(bandBetween(box.tl, box.tr, pad), opts, k);
    svg += footBlock(bandBetween(box.bl, box.br, pad), opts, k, box.bl.x1 - box.bl.x0);
    svg += "</svg>";
    return svg;
  }

  // Depth of the blue border inside a piece, in mm at scale s: 1.1 grid
  // lines, never more than BORDER_IN of a cell side (the camera reads a
  // piece's colour only farther than that from its edges).
  const BORDER_IN = 0.05;
  function borderIn(s) {
    return Math.min(1.1 * gridLineWidth(s), BORDER_IN * s);
  }

  let clipSeq = 0;

  /* A sheet of pieces, or of their backs. Every piece is exactly its cells:
   * its colour, its inner lines (the edges between its cells, at 45 % white)
   * and its border are all clipped to the outline of its cells. The border,
   * in the board border's blue, is a band inside the piece at most BORDER_IN
   * deep, so the camera, which reads a piece's colour away from its edges,
   * never takes it for the piece; its outer edge is the cells' own edge: cut
   * along it, a piece is exactly its cells, and pieces side by side on the
   * board meet on the middle of the grid line between them. The backs are the
   * fronts seen through the paper: mirrored left to right about the page
   * centre, each back exactly over its front. */
  function piecesSheet(L, opts, back) {
    const s = L.scale;
    const innerW = Math.min(0.3, Math.max(0.18, 0.02 * s));
    let svg = svgOpen(L, opts.polyform + " · " + (back ? opts.backsTag : opts.piecesTag), "kit-sheet " + (back ? "kit-backs" : "kit-pieces"));
    svg += piecesHead(L, opts, back ? opts.backsTag : opts.piecesTag);
    svg += back ? '<g transform="translate(' + fmt(L.cw) + ' 0) scale(-1 1)">' : "<g>";
    L.shapes.forEach((shape, i) => {
      const at = L.place[i];
      const tx = (p) => ({ x: at.x + (p.x - shape.bb.minX) * s, y: at.y + (p.y - shape.bb.minY) * s });
      const outline = loopsPath(shape.loops, tx);
      const clip = "kitclip" + (clipSeq += 1);
      svg += '<g class="kit-piece" data-piece="' + esc(shape.id) + '" data-cells="' + shape.cellCount + '">';
      svg += '<clipPath id="' + clip + '"><path d="' + outline + '" clip-rule="evenodd"/></clipPath>';
      svg += '<path d="' + outline + '" fill="' + shape.color + '" fill-rule="evenodd"/>';
      svg += '<g clip-path="url(#' + clip + ')">';
      if (shape.inner.length) {
        svg += '<path d="' + segmentsPath(shape.inner, tx) + '" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="' + fmt(innerW) + '" stroke-linecap="round"/>';
      }
      svg += '<path class="kit-border" d="' + outline + '" fill="none" stroke="' + OUTLINE + '" stroke-width="' + fmt(Math.floor(2000 * borderIn(s)) / 1000) +
        '" stroke-linejoin="round"/>';
      svg += "</g></g>";
    });
    svg += "</g></svg>";
    return svg;
  }

  function blankSheet(L) {
    return svgOpen(L, "", "kit-sheet kit-blank") + "</svg>";
  }

  /* The pieces of a board laid out at the board's own scale on another paper
   * (the pieces of an A3 board on A4 sheets, for instance), on as many pages
   * as they need. Each page is a layout of its own, drawn by piecesSheet. */
  function piecesLayouts(L, paperName) {
    if (!isPaper(paperName)) throw new Error("Unknown paper: " + paperName);
    const paper = PAPERS[paperName];
    const cw = paper.w - 2 * MARGIN;
    const ch = paper.h - 2 * MARGIN - SLACK;
    const pages = [];
    const base = L.flatShapes || L.shapes;
    let rest = base.map((s, i) => i);
    while (rest.length) {
      // as many of the remaining pieces as fit on one page, largest first
      let take = rest.slice();
      let place = null;
      while (take.length && !(place = packPieces(take.map((i) => base[i]), L.scale, cw, HEADER + 3, ch))) take = take.slice(0, -1);
      if (!take.length) throw new Error("A piece does not fit on " + paperName + " at this scale");
      const arranged = arrangePieces(take.map((i) => base[i]), L.scale, cw, ch);
      pages.push(Object.assign({}, L, {
        paper: paperName,
        pageW: paper.w,
        pageH: paper.h,
        cw,
        ch,
        shapes: arranged ? arranged.shapes : take.map((i) => base[i]),
        place: arranged ? arranged.place : place,
      }));
      rest = rest.filter((i) => take.indexOf(i) < 0);
    }
    return pages;
  }

  /* The pages to print, in order. With coloured backs, a blank page follows the
   * board so the pieces and their backs share one sheet of paper. With
   * `piecesPaper` (another paper size), only the pieces are printed, at the
   * board's scale on that paper, each page followed by its backs. */
  function sheets(boardId, paperName, options) {
    const o = options || {};
    const t = o.t || fallbackT;
    const L = layout(boardId, paperName);
    const title = boardName(boardId, t, o.lang) + " · " + piecesName(boardId, t);
    const opts = {
      title,
      polyform: polyformName(boardId, t),
      mission: t(MISSION[boardId] || "kit.title." + FenceBoards.get(boardId).lattice),
      accent: ACCENT[FenceBoards.get(boardId).lattice] || ACCENT.square,
      cameraLabel: t("kit.cameraLink"),
      piecesTag: t("kit.sheet.pieces"),
      backsTag: t("kit.sheet.backs"),
      by: t("kit.sheet.by"),
      address: o.address || cameraAddress(boardId),
    };
    opts.url = cameraUrl(boardId, opts.address);
    if (o.piecesPaper && o.piecesPaper !== paperName) {
      const pages = [];
      const parts = piecesLayouts(L, o.piecesPaper);
      for (const P of parts) {
        pages.push({ kind: "pieces", svg: piecesSheet(P, opts, false) });
        if (o.backs) pages.push({ kind: "backs", svg: piecesSheet(P, opts, true) });
      }
      return { layout: parts[0], boardLayout: L, pages };
    }
    const pages = [{ kind: "board", svg: boardSheet(L, opts) }];
    if (o.backs) pages.push({ kind: "blank", svg: blankSheet(L) });
    pages.push({ kind: "pieces", svg: piecesSheet(L, opts, false) });
    if (o.backs) pages.push({ kind: "backs", svg: piecesSheet(L, opts, true) });
    return { layout: L, pages };
  }

  // A small picture of a board and its marks for the board picker.
  function thumbnail(boardId) {
    const g = FenceBoards.geometry(boardId);
    const ext = g.extent;
    const pad = g.markerSize * 0.35;
    const vb = [ext.minX - pad, ext.minY - pad, ext.maxX - ext.minX + 2 * pad, ext.maxY - ext.minY + 2 * pad];
    const id = (p) => p;
    const edges = edgesOf(g.board.cells.map((c) => c.vertices));
    const w = Math.max(vb[2], vb[3]) / 90;
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.map(fmt).join(" ") + '" aria-hidden="true" focusable="false">';
    svg += '<rect x="' + fmt(vb[0]) + '" y="' + fmt(vb[1]) + '" width="' + fmt(vb[2]) + '" height="' + fmt(vb[3]) + '" fill="#fff"/>';
    svg += '<path d="' + segmentsPath(edges.filter((e) => e.count === 2), id) + '" fill="none" stroke="' + GRID + '" stroke-width="' + fmt(w) + '"/>';
    svg += '<path d="' + loopsPath(loopsOf(edges.filter((e) => e.count === 1)), id) + '" fill="none" stroke="' + OUTLINE + '" stroke-width="' + fmt(w * 2) + '"/>';
    for (const corner of FenceBoards.CORNERS) {
      const m = g.markers[corner];
      svg += '<path fill="' + INK + '" d="' + markerPath(m.id, m.corners[0].x, m.corners[0].y, g.markerSize) + '"/>';
    }
    return svg + "</svg>";
  }

  const api = {
    BOARD_IDS,
    A3_BOARDS,
    PAPERS,
    QR_SIZE,
    MARGIN,
    markerBits,
    layout,
    sheets,
    thumbnail,
    boardName,
    piecesName,
    polyformName,
    cameraAddress,
    cameraUrl,
  };

  /* ---------- page ---------- */

  function startPage(doc) {
    const i18n = win.i18n;
    const t = (k, v) => i18n.t(k, v);
    const store = {
      get(k) {
        try {
          return win.localStorage.getItem(k);
        } catch (e) {
          return null;
        }
      },
      set(k, v) {
        try {
          win.localStorage.setItem(k, v);
        } catch (e) {
          /* private mode: the choice just is not remembered */
        }
      },
    };

    const params = new URLSearchParams(win.location.search);
    // A sheet printed before names its own id (old links, old QR codes):
    // its kit is the one of the board it is played on today.
    const asked = FenceBoards.current(params.get("board"));
    const state = {
      board: asked !== null && BOARD_IDS.indexOf(asked) >= 0 ? asked : "sq9",
      paper: null,
      backs: store.get("fc-kit-backs") !== "0",
      // the pieces of an A3 board printed alone on A4, at the board's scale
      piecesA4: params.get("pieces") === "A4" || store.get("fc-kit-pieces-a4") === "1",
    };
    const qp = (params.get("paper") || "").toUpperCase();
    const savedPaper = store.get("fc-kit-paper");
    state.paper = isPaper(qp) ? qp : isPaper(savedPaper) ? savedPaper : "A4";

    const $ = (sel) => doc.querySelector(sel);
    const pageRule = $("#kitPageRule");
    const sheetsEl = $("#sheets");
    const cameraLink = $("#cameraLink");
    const backsInput = $("#backs");
    const piecesA4Input = $("#piecesA4");
    const piecesA4Wrap = $("#piecesA4Wrap");
    const paperNote = $("#paperNote");
    const metaDescription = $('meta[name="description"]');
    const boardButtons = new Map();

    function buildPicker() {
      const groups = { start: $("#boardsStart"), big: $("#boardsBig") };
      for (const id of BOARD_IDS) {
        const def = FenceBoards.get(id);
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "boardBtn " + def.lattice;
        btn.dataset.board = id;
        btn.innerHTML = '<span class="thumb">' + thumbnail(id) + '</span><span class="bName"></span><span class="bPieces"></span>';
        btn.addEventListener("click", () => {
          state.board = id;
          update(true);
        });
        (def.home.page === "hub" ? groups.start : groups.big).appendChild(btn);
        boardButtons.set(id, btn);
      }
    }

    function labelPicker() {
      const lang = i18n.get();
      for (const [id, btn] of boardButtons) {
        btn.querySelector(".bName").textContent = boardName(id, t, lang);
        btn.querySelector(".bPieces").textContent = piecesName(id, t);
      }
    }

    function syncUrl() {
      const url = new URL(win.location.href);
      url.searchParams.set("board", state.board);
      if (state.paper === "A4") url.searchParams.delete("paper");
      else url.searchParams.set("paper", state.paper.toLowerCase());
      try {
        win.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (e) {
        /* file:// pages may refuse; the page still works */
      }
    }

    function renderSheets() {
      const lang = i18n.get();
      const piecesPaper = state.paper === "A3" && state.piecesA4 ? "A4" : null;
      const out = sheets(state.board, state.paper, { t, lang, backs: state.backs, piecesPaper });
      const L = out.layout;
      const root = doc.documentElement;
      root.style.setProperty("--sheet-w", L.cw + "mm");
      root.style.setProperty("--sheet-h", L.ch + "mm");
      root.style.setProperty("--page-ratio", L.pageW + " / " + L.pageH);
      root.style.setProperty("--margin-pct", ((100 * MARGIN) / L.pageW).toFixed(4) + "%");
      pageRule.textContent = "@page { size: " + L.paper + " portrait; margin: " + MARGIN + "mm; }";
      const caps = {
        board: t("kit.capBoard"),
        blank: t("kit.capBlank"),
        pieces: t("kit.capPieces"),
      };
      sheetsEl.dataset.board = state.board;
      sheetsEl.dataset.paper = L.paper;
      sheetsEl.dataset.mmPerUnit = String(L.scale);
      sheetsEl.innerHTML = out.pages
        .map(
          (p, i) =>
            '<figure class="sheetBox ' + p.kind + '"><div class="paper">' + p.svg + "</div>" +
            '<figcaption><b>' + esc(t("kit.pageN", { n: i + 1 })) + "</b> · " +
            esc(p.kind === "backs" ? t("kit.capBacks", { n: i }) : caps[p.kind]) + "</figcaption></figure>"
        )
        .join("");
    }

    function update(fromUser) {
      for (const [id, btn] of boardButtons) btn.setAttribute("aria-pressed", id === state.board ? "true" : "false");
      doc.querySelectorAll("[data-paper]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.paper === state.paper ? "true" : "false"));
      backsInput.checked = state.backs;
      piecesA4Input.checked = state.piecesA4;
      piecesA4Wrap.hidden = state.paper !== "A3";
      cameraLink.href = "../camera/?board=" + state.board;
      paperNote.hidden = !(state.paper === "A4" && A3_BOARDS.indexOf(state.board) >= 0);
      renderSheets();
      if (fromUser) {
        store.set("fc-kit-paper", state.paper);
        store.set("fc-kit-backs", state.backs ? "1" : "0");
        store.set("fc-kit-pieces-a4", state.piecesA4 ? "1" : "0");
        syncUrl();
      }
    }

    buildPicker();
    labelPicker();
    doc.querySelectorAll("[data-paper]").forEach((b) =>
      b.addEventListener("click", () => {
        if (isPaper(b.dataset.paper)) state.paper = b.dataset.paper;
        update(true);
      })
    );
    backsInput.addEventListener("change", () => {
      state.backs = backsInput.checked;
      update(true);
    });
    piecesA4Input.addEventListener("change", () => {
      state.piecesA4 = piecesA4Input.checked;
      update(true);
    });
    $("#useA3").addEventListener("click", () => {
      state.paper = "A3";
      update(true);
      const pressed = doc.querySelector('[data-paper="A3"]');
      if (pressed) pressed.focus();
    });
    $("#printBtn").addEventListener("click", () => win.print());
    doc.querySelectorAll("[data-lang-btn]").forEach((b) => b.addEventListener("click", () => i18n.setLang(b.dataset.langBtn)));
    const translateMeta = () => {
      if (metaDescription) metaDescription.setAttribute("content", t("kit.metaDescription"));
    };
    doc.addEventListener("fc-langchange", () => {
      translateMeta();
      labelPicker();
      renderSheets();
    });
    translateMeta();
    update(false);
    // Ready once the sheets' two webfonts are in (a print made before would
    // fall back to another face); never later than 5 s.
    const ready = () => doc.documentElement.classList.add("kit-ready");
    try {
      const f = doc.fonts;
      Promise.race([
        Promise.all(["800 10px Manrope", "500 10px Manrope", "600 10px 'IBM Plex Mono'"].map((x) => f.load(x))).then(() => f.ready),
        new Promise((res) => win.setTimeout(res, 5000)),
      ]).then(ready, ready);
    } catch (e) {
      ready();
    }
  }

  if (win && win.document) {
    const doc = win.document;
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => startPage(doc));
    else startPage(doc);
  }

  return api;
});

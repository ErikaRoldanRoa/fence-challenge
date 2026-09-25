/* Fence Challenge · printable kit.
 *
 * Draws, for each printed board, the sheets a player prints at home:
 *   the board   cells from FenceBoards.geometry(id) with its four corner marks
 *   the pieces  every piece of the board's set once, same scale as the board
 *   the backs   the same pieces mirrored, so a double-sided print (flip on the
 *               long edge) gives every piece a coloured back
 *
 * The board sheet also carries a QR code (bottom right) that opens the camera
 * page for that board.
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

  const BOARD_IDS = ["sq9", "hex4", "tri4", "sq20", "hex6", "tri13"];
  // Big boards whose cells get small on A4: the page suggests A3 for them.
  const A3_BOARDS = ["hex6", "tri13"];
  // No prototype: a paper name read from the URL or from storage ("constructor",
  // "__proto__", ...) can only match a real entry.
  const PAPERS = Object.freeze(Object.assign(Object.create(null), { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 } }));
  const isPaper = (name) => typeof name === "string" && Object.prototype.hasOwnProperty.call(PAPERS, name);
  const MARGIN = 10; // mm, same as the @page margin
  const SLACK = 1; // mm kept free at the bottom so a sheet never spills onto a second page
  const HEADER = 9; // mm reserved at the top of every sheet for the title line
  const QR_SIZE = 16; // mm, side of the QR code on the board sheet (about 0.43 mm per module)
  const FOOTER = QR_SIZE + 3; // mm reserved at the bottom of the board sheet (credit, QR code)
  const CLEAR_MODULES = 2; // white margin kept around the marks, in marker modules
  const SCALE_STEP = 0.5; // the scale is a whole number of half millimetres per unit
  const PIECE_GAP = 6; // mm between pieces (at least)
  const BLEED = 1; // mm the coloured backs reach past the cut line
  const FALLBACK_BASE = "erikaroldanroa.github.io/fence-challenge/";
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const INK = "#0000ff"; // pure blue: marks, text and cut lines print from the colour cartridge alone
  const GRID = "#2563eb"; // strong blue: printed from the colour cartridge alone
  const OUTLINE = "#1e3a8a";

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
    const types = FenceBoards.pieceTypes(boardId);
    const colors = pieceColors(types);
    return types.map((type, i) => {
      // The orientation with the smallest bounding box, lying flat if possible.
      let chosen = null;
      for (const v of lattice.buildVariants(type.cells).variants) {
        const polys = v.cells.map((c) => lattice.cellWorldVertices(c));
        const bb = bboxOf(polys.flat());
        const area = bb.w * bb.h;
        const flat = bb.w >= bb.h - 1e-9 ? 0 : 1;
        if (!chosen || area < chosen.area - 1e-6 || (Math.abs(area - chosen.area) <= 1e-6 && flat < chosen.flat)) {
          chosen = { polys, bb, area, flat };
        }
      }
      const edges = edgesOf(chosen.polys);
      return {
        id: type.id,
        cellCount: type.cells.length,
        color: colors[i],
        polys: chosen.polys,
        bb: chosen.bb,
        loops: loopsOf(edges.filter((e) => e.count === 1)),
        inner: edges.filter((e) => e.count === 2),
      };
    });
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
    const areaTop = HEADER;
    const areaH = ch - HEADER - FOOTER;
    let scale = Math.floor(Math.min(cw / W, areaH / H) / SCALE_STEP) * SCALE_STEP;
    const shapes = pieceShapes(boardId);
    let place = null;
    while (scale > SCALE_STEP) {
      place = packPieces(shapes, scale, cw, HEADER + 3, ch);
      if (place) break;
      scale -= SCALE_STEP;
    }
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
      shapes,
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
    return t("kit.board.cells", {
      lattice: t("kit.lattice." + def.lattice),
      n: formatCount(g.board.cells.length, lang),
    });
  }

  function piecesName(boardId, t) {
    const def = FenceBoards.get(boardId);
    const types = FenceBoards.pieceTypes(boardId);
    const order = types[0].cells.length;
    return t("kit.pc." + def.lattice + order, { n: types.length });
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

  function titleLine(title, tag) {
    return (
      '<text class="kit-title" x="0" y="5.6" font-family="' + FONT + '" font-size="3.9" fill="' + INK + '">' +
      '<tspan font-weight="800">Fence Challenge</tspan>' +
      '<tspan fill="' + GRID + '"> · ' + esc(title) + (tag ? " · " + esc(tag) : "") + "</tspan></text>"
    );
  }

  // The credit, as on the site: by The Learning Machine, CEO Dr. Erika Roldán.
  function creditLine(x, y, by) {
    return (
      '<text class="kit-credit" x="' + fmt(x) + '" y="' + fmt(y) + '" font-family="' + FONT + '" font-size="2.6" fill="' + INK + '">' +
      esc(by) + ' <tspan font-weight="800">THE LEARNING MACHINE</tspan> · CEO <tspan font-weight="700">Dr. Erika Roldán</tspan></text>'
    );
  }

  // Grid lines and cut lines share one width. Every line is centred on the cell
  // boundary, so a piece cut along the middle of its cut line covers exactly half
  // of the grid line under each of its edges, and its neighbour covers the other half.
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
    svg += titleLine(opts.title);
    svg += '<g class="kit-cells" data-cells="' + g.board.cells.length + '" fill="none" stroke-linecap="round">';
    svg += '<path d="' + segmentsPath(inner, tx) + '" stroke="' + GRID + '" stroke-width="' + fmt(lineW) + '"/>';
    svg += '<path d="' + loopsPath(loopsOf(outer), tx) + '" stroke="' + OUTLINE + '" stroke-width="' + fmt(lineW * 1.6) + '" stroke-linejoin="round"/>';
    svg += "</g>";
    for (const corner of FenceBoards.CORNERS) {
      const m = g.markers[corner];
      const tl = tx(m.corners[0]);
      const br = tx(m.corners[2]);
      svg += '<path class="kit-mark" data-corner="' + corner + '" data-id="' + m.id + '" fill="' + INK + '" d="' +
        markerPath(m.id, tl.x, tl.y, br.x - tl.x) + '"/>';
    }
    // Footer: the credit and, in the bottom right corner, a QR code that
    // opens the camera for this board. (The camera measures the board from
    // its corner marks, so the printed size does not matter; the board and
    // its pieces only need to be printed together, at the same size.)
    svg += creditLine(0, L.ch - 2, opts.by);
    const qr = qrPath(opts.url, L.cw - QR_SIZE, L.ch - QR_SIZE, QR_SIZE);
    if (qr) {
      svg += '<path class="kit-qr" data-url="' + esc(opts.url) + '" data-modules="' + qr.modules + '" fill="' + INK +
        '" shape-rendering="crispEdges" d="' + qr.d + '"/>';
    }
    svg += "</svg>";
    return svg;
  }

  function piecesSheet(L, opts, back) {
    const s = L.scale;
    const innerW = Math.min(0.3, Math.max(0.18, 0.02 * s));
    let svg = svgOpen(L, opts.title, "kit-sheet " + (back ? "kit-backs" : "kit-pieces"));
    svg += titleLine(opts.title, back ? opts.backsTag : opts.piecesTag);
    svg += creditLine(0, HEADER + 1.1, opts.by);
    // The backs are the fronts seen through the paper: mirrored left to right about the page centre.
    svg += back ? '<g transform="translate(' + fmt(L.cw) + ' 0) scale(-1 1)">' : "<g>";
    L.shapes.forEach((shape, i) => {
      const at = L.place[i];
      const tx = (p) => ({ x: at.x + (p.x - shape.bb.minX) * s, y: at.y + (p.y - shape.bb.minY) * s });
      const outline = loopsPath(shape.loops, tx);
      svg += '<g class="kit-piece" data-piece="' + esc(shape.id) + '" data-cells="' + shape.cellCount + '">';
      if (back) {
        svg += '<path d="' + outline + '" fill="' + shape.color + '" fill-rule="evenodd" stroke="' + shape.color +
          '" stroke-width="' + fmt(2 * BLEED) + '" stroke-linejoin="round"/>';
      } else {
        svg += '<path d="' + outline + '" fill="' + shape.color + '" fill-rule="evenodd"/>';
      }
      if (shape.inner.length) {
        svg += '<path d="' + segmentsPath(shape.inner, tx) + '" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="' +
          fmt(innerW) + '" stroke-linecap="round"/>';
      }
      if (!back) {
        svg += '<path d="' + outline + '" fill="none" stroke="' + INK + '" stroke-width="' + fmt(gridLineWidth(s)) + '" stroke-linejoin="round"/>';
      }
      svg += "</g>";
    });
    svg += "</g></svg>";
    return svg;
  }

  function blankSheet(L) {
    return svgOpen(L, "", "kit-sheet kit-blank") + "</svg>";
  }

  /* The pages to print, in order. With coloured backs, a blank page follows the
   * board so the pieces and their backs share one sheet of paper. */
  function sheets(boardId, paperName, options) {
    const o = options || {};
    const t = o.t || fallbackT;
    const L = layout(boardId, paperName);
    const title = boardName(boardId, t, o.lang) + " · " + piecesName(boardId, t);
    const opts = {
      title,
      piecesTag: t("kit.sheet.pieces"),
      backsTag: t("kit.sheet.backs"),
      by: t("kit.sheet.by"),
      address: o.address || cameraAddress(boardId),
    };
    opts.url = cameraUrl(boardId, opts.address);
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
    const state = {
      board: BOARD_IDS.indexOf(params.get("board")) >= 0 ? params.get("board") : "sq9",
      paper: null,
      backs: store.get("fc-kit-backs") !== "0",
    };
    const qp = (params.get("paper") || "").toUpperCase();
    const savedPaper = store.get("fc-kit-paper");
    state.paper = isPaper(qp) ? qp : isPaper(savedPaper) ? savedPaper : "A4";

    const $ = (sel) => doc.querySelector(sel);
    const pageRule = $("#kitPageRule");
    const sheetsEl = $("#sheets");
    const cameraLink = $("#cameraLink");
    const backsInput = $("#backs");
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
      const out = sheets(state.board, state.paper, { t, lang, backs: state.backs });
      const L = out.layout;
      const root = doc.documentElement;
      root.style.setProperty("--sheet-w", L.cw + "mm");
      root.style.setProperty("--sheet-h", L.ch + "mm");
      root.style.setProperty("--page-ratio", L.pageW + " / " + L.pageH);
      root.style.setProperty("--margin-pct", ((100 * MARGIN) / L.pageW).toFixed(4) + "%");
      pageRule.textContent = "@page { size: " + state.paper + " portrait; margin: " + MARGIN + "mm; }";
      const piecesPage = out.pages.findIndex((p) => p.kind === "pieces") + 1;
      const caps = {
        board: t("kit.capBoard"),
        blank: t("kit.capBlank"),
        pieces: t("kit.capPieces"),
        backs: t("kit.capBacks", { n: piecesPage }),
      };
      sheetsEl.dataset.board = state.board;
      sheetsEl.dataset.paper = state.paper;
      sheetsEl.dataset.mmPerUnit = String(L.scale);
      sheetsEl.innerHTML = out.pages
        .map(
          (p, i) =>
            '<figure class="sheetBox ' + p.kind + '"><div class="paper">' + p.svg + "</div>" +
            '<figcaption><b>' + esc(t("kit.pageN", { n: i + 1 })) + "</b> · " + esc(caps[p.kind]) + "</figcaption></figure>"
        )
        .join("");
    }

    function update(fromUser) {
      for (const [id, btn] of boardButtons) btn.setAttribute("aria-pressed", id === state.board ? "true" : "false");
      doc.querySelectorAll("[data-paper]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.paper === state.paper ? "true" : "false"));
      backsInput.checked = state.backs;
      cameraLink.href = "../camera/?board=" + state.board;
      paperNote.hidden = !(state.paper === "A4" && A3_BOARDS.indexOf(state.board) >= 0);
      renderSheets();
      if (fromUser) {
        store.set("fc-kit-paper", state.paper);
        store.set("fc-kit-backs", state.backs ? "1" : "0");
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
    doc.documentElement.classList.add("kit-ready");
  }

  if (win && win.document) {
    const doc = win.document;
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => startPage(doc));
    else startPage(doc);
  }

  return api;
});

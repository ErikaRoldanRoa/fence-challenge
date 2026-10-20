/* Fence Challenge · limit-shape lab.
 * The reference polygon of a fence of n-ominoes against a circle, with a loupe
 * that magnifies the gap. For n = 4..6 it is the polygon of the paper's optimal
 * fence (data/optimal.js): each piece once, in the place the fence gives it,
 * with the arrow between its two attachment edges; the pieces are the tiles on
 * the left and each side of the polygon wears its piece's colour. For
 * n = 7..15 it is the paper's greedy fence (Section 6.2): each piece once,
 * drawn exactly from the distinct arrows of data/greedy.js, the left box
 * showing the kinds of arrows. Both against the circle of the polygon's
 * bounding box. At 500 cells the loop is the paper's curve, from its 13.5
 * million random 500-ominoes, shown at ×1 on arrival, and the lab's own chain
 * keeps drawing 500-ominoes in the pieces box. */
(function () {
  "use strict";
  const S = window.LimitSampler, G = window.LimitPolygon, DATA = window.LIMIT_DATA, CHIPS = window.LIMIT_CHIPS, GREEDY = window.LIMIT_GREEDY || {}, OPT = window.LIMIT_OPTIMAL || {};
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => window.i18n.t(k, v);
  const lang = () => window.i18n.get();
  const MINUS = "−";
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The hub's palette, and its tetromino colours for card #1.
  const COLORS = ["#ff5b7f", "#ff9d1e", "#ffd84a", "#93e03b", "#2de2d5", "#1bc7ff",
    "#5ea8ff", "#7f83ff", "#ad73ff", "#d866ff", "#ff5fb3", "#ff9f8e"];
  const TETRO = [
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: "#ff5b7f" },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], color: "#ff9d1e" },
    { cells: [[0, 0], [0, 1], [1, 1], [1, 2]], color: "#2de2d5" },
    { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: "#7f83ff" },
    { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#ffd84a" },
  ];
  const STEPS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 500];
  const GIANT = 500;
  const LAST_OPT = 6;                      // the optimal fences, n = 4..6
  const FIRST_FENCE = 7, LAST_FENCE = 15;   // the greedy fences of Section 6.2
  // The paper's fences for n = 7, 8: the best fence found and the upper bound (dynamic programming). From 9 on,
  // the greedy fence and the upper bound of Table 4 come with the polygon; up to 6 the optimum comes with the fence.
  const FENCES = {
    7: { best: 19733, bound: 19830 }, 8: { best: 279134, bound: 280389 },
  };
  const SIDE_STEP = 0.1;    // degrees between two points drawn on a side of the polygon
  const PICK_RADIUS = 16;   // css pixels: how near a tap must be to an arrow's dot
  const SCRUB_RADIUS = 28;  // css pixels: how near a sliding finger must come to a dot to choose it
  // The paper's area estimate for the 500-omino fence, each piece once, as printed (log10 of 2.0e603).
  const AREA500_LOG10 = 603 + Math.log10(2.0);
  // The random 500-ominoes behind the paper's loop.
  const PAPER500 = 13.5e6;
  const LOUPE_GAP = 0.6;   // the loupe never stretches the largest gap past this
  const LOOP_FILL = 0.42;  // the loop's farthest point from the stage's centre, in parts of its shorter side
  const CELLS_FILL = 0.46; // the same for the farthest cell of the fence drawn behind an optimal polygon
  const CELLS_FADE = 0.6;  // the fence fades out as the loupe grows past ×1 and is gone at ×1.6: the loupe bends the polygon

  let n = 4, pieces = [], chain = null, loupeV = 0, loupe = 1, sel = -1;
  let fence = null, selKind = -1, kindSpots = [];   // n = 4..15: the fence's polygon, the chosen kind of arrow, its dots
  let giant = null, giantSamples = 0, giantDrawn = 0, openChip = null;
  let shown = null, anim = null, tiles = false;
  // The fence itself behind an optimal polygon (n = 4..6): its cells in the polygon's plane, per piece, and their outlines. rhoNow is
  // how far they reach beyond the circle (1 where there are none): the stage shrinks the circle by it, so that the cells stay on the
  // stage, and the change eases with the morph, as cellsFade lets the cells come in when the morph ends. hov: the tile under a mouse.
  let fenceCells = null, rhoNow = 1, rhoTo = 1, cellsFade = 1, hov = -1;
  // An optimal fence (n = 4..6): its pieces are the tiles of the left box when each fits, else that box shows the kinds.
  const optimal = () => !!fence && n !== GIANT && n <= LAST_OPT;

  // ---------- the 500-omino chain: a worker when possible, the page otherwise ----------
  let worker = null;
  try { worker = new Worker("worker.js?v=20261020c"); } catch (e) { worker = null; }
  if (worker) {
    worker.onmessage = (e) => { if (e.data.type === "giant") onGiant(e.data); };
    worker.onerror = () => { worker = null; };
  }
  let localChain = null, localTimer = 0, localLeft = 0;
  function runGiant(on) {
    // Under reduced motion the 500-omino stays still.
    if (on && REDUCED) {
      if (!giant) { const c = window.LIMIT_START500; onGiant({ cells: c, pairs: S.diameters(c).pairs, samples: 0 }); }
      return;
    }
    if (worker) { worker.postMessage({ cmd: "giant", run: on, seed: 7 }); return; }
    clearTimeout(localTimer);
    if (!on) return;
    if (!localChain) {
      localChain = new S.Chain(1, 7);
      localChain.load(window.LIMIT_START500);
      const c = localChain.cells();
      onGiant({ cells: c, pairs: S.diameters(c).pairs, samples: 0 });
    }
    const slice = () => {
      const t0 = performance.now();
      if (localLeft <= 0) localLeft = S.gap(GIANT);
      while (localLeft > 0 && performance.now() - t0 < 12) { localChain.step(); localLeft--; }
      if (localLeft <= 0) {
        const c = localChain.cells();
        onGiant({ cells: c, pairs: S.diameters(c).pairs, samples: giantSamples + 1 });
      }
      localTimer = setTimeout(slice, 16);
    };
    slice();
  }
  // New samples arrive faster than the eye wants them: redraw about twice a second.
  function onGiant(m) {
    if (n !== GIANT) return;
    giant = m; giantSamples = m.samples;
    const now = performance.now();
    if (now - giantDrawn < 500 && m.samples > 0) return;
    giantDrawn = now;
    drawPieces();
    caption();
    if (openChip === "sample") window.mathChip.refresh();
  }

  // ---------- choosing n ----------
  function setN(k) {
    if (!STEPS.includes(k) || (k !== GIANT && !(k >= FIRST_FENCE ? GREEDY[k] : OPT[k]))) return;
    const from = n;
    n = k;
    sel = -1; selKind = -1;
    $("lab").dataset.n = String(k);
    $("n-value").textContent = String(k);
    const pill = $("n-pill");
    pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump");
    fenceCells = null; rhoTo = 1; hov = -1;
    if (k === GIANT) {
      pieces = []; fence = null;
      chain = { R: 1, pts: DATA.dev500, edges: null };
      giantDrawn = 0;
      // Arriving at 500 cells: the loupe back at ×1, where the loop lies on its circle.
      if (from !== GIANT) loupeV = 0;
      runGiant(true);
    } else {
      // A fence of the paper: one exact polygon, each piece once; nothing to compute here.
      runGiant(false);
      if (k >= FIRST_FENCE) {
        pieces = [];
        fence = G.build(GREEDY[k]);
      } else {
        fence = G.build(G.fromPieces(OPT[k]));
        pieces = tilesOf(OPT[k]);
        const sq = G.cellsOf(OPT[k]);
        fenceCells = { sq, edges: sq.map(G.outlineOf) };
        rhoTo = G.reach(fence, sq);
      }
      chain = { R: fence.R, pts: null, edges: null, vecs: G.folded(fence) };
    }
    // The stage's canvas says what it shows: a loop of sorted arrows, or a fence's polygon.
    loopCanvas.dataset.i18nAriaLabel = k === GIANT ? "ls.loop" : optimal() ? "ls.fenceOpt" : "ls.fence";
    loopCanvas.setAttribute("aria-label", t(loopCanvas.dataset.i18nAriaLabel));
    syncControls();
    syncLoupe();
    drawPieces();      // before the stage: whether the left box shows tiles decides the colour of the polygon's sides
    morphTo(loopPolar());
    caption();
    syncChips();
    syncSource();
    if (openChip) window.mathChip.refresh();
    statusN();
    // The pill and the gap change width with n: centre them again.
    centreReadout();
  }
  // What the status says about the size on show, and what it says now (a choice, or the size).
  function statusN() {
    status(n === GIANT ? t("ls.s.giant") : t(optimal() ? "ls.s.opt" : "ls.s.fence", { n, count: fmtNum(pieceCount(), 0), g: fmtPct(maxGap()), a: fmtNum(fence.L, 0) }));
  }
  function sayState() {
    if (!chain) return;
    if (sel >= 0) sayPiece(); else if (selKind >= 0) sayKind(); else statusN();
  }
  // The tiles of an optimal fence: its pieces in the order of the polygon, each as the fence places it, with the arrow
  // between its two attachment edges (and those edges), in the doubled coordinates from the centre of a cell that
  // drawShape wants. The tetrominoes keep the hub's colours; the others take the palette five by five round the polygon,
  // so that two neighbouring sides never wear neighbouring hues.
  const TETRO_COLOR = new Map(TETRO.map((h) => [S.canonical(h.cells).key, h.color]));
  let tileExt = 0;   // the longest side of the biggest piece of the tiles on show: all the pieces are drawn at one cell size
  function tilesOf(e) {
    tileExt = Math.max(...e.pieces.map((p) => { const x = extentOf(p.c); return Math.max(x.w, x.h); }));
    return e.pieces.map((p, i) => ({
      cells: p.c,
      pairs: [[[p.i[0] - 1, p.i[1] - 1], [p.o[0] - 1, p.o[1] - 1]]],
      color: e.n === 4 ? TETRO_COLOR.get(S.canonical(p.c).key) : COLORS[(i * 5) % COLORS.length],
      corner: G.isCorner(fence.arrows[i]),
    }));
  }
  function maxGap() {
    if (fence) return fence.gap.signed;
    if (!chain) return 0;
    let m = 0;
    for (const p of chain.pts) if (Math.abs(p[1]) > Math.abs(m)) m = p[1];
    return m;
  }
  // Area of the loop over the area of its circle (the eight octants alike).
  function areaRatio(pts) {
    let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], d = (b[0] - a[0]) * Math.PI / 180;
      s += 0.5 * (1 + a[1]) * (1 + b[1]) * Math.sin(d);
    }
    return (8 * s) / Math.PI;
  }

  // ---------- the loupe ----------
  function maxLoupe() { const g = Math.abs(maxGap()); return g > 0 ? Math.max(1, Math.min(200, LOUPE_GAP / g)) : 1; }
  function loupeAt(v) { return Math.max(1, Math.pow(maxLoupe(), v / 100)); }
  // The loupe as shown: one decimal below ×10.
  function loupeShown() {
    const k = loupe < 10 ? Math.round(loupe * 10) / 10 : Math.round(loupe);
    return fmtNum(k, k < 10 && k % 1 ? 1 : 0);
  }
  function syncLoupe() {
    loupe = loupeAt(loupeV);
    $("loupe-x").textContent = "×" + loupeShown();
    $("loupe").value = String(Math.round(loupeV));
    $("loupe").setAttribute("aria-valuetext", t("ls.loupeAria", { k: loupeShown() }));
  }
  function setLoupe(v) {
    loupeV = v;
    syncLoupe();
    redraw();
  }
  $("loupe").addEventListener("input", (e) => setLoupe(+e.target.value));
  $("loupe").addEventListener("change", () => status(t("ls.s.loupe", { k: loupeShown() })));

  // ---------- the loop ----------
  const loopCanvas = $("loop"), lctx = loopCanvas.getContext("2d");
  // One octant of the loop as (phi, deviation); eight copies, mirrored on odd ones.
  function octants(pts) {
    const out = [];
    for (let k = 0; k < 8; k++) {
      const seq = k % 2 === 0 ? pts : pts.slice().reverse();
      for (const p of seq) out.push([k * 45 + (k % 2 === 0 ? p[0] : 45 - p[0]), p[1]]);
    }
    return out;
  }
  // A choice made during a morph is drawn by its last frame: an exact drawing now would flash the final polygon for one frame.
  const redraw = () => drawLoop(anim === null);
  function loopPolar() { return fence ? G.samples(fence, 0.25) : chain ? octants(chain.pts) : []; }
  // Samples of the loop on 720 directions, for the morph between two n.
  function resample(poly) {
    const out = new Float64Array(720);
    if (!poly.length) return out;
    let j = 0;
    for (let i = 0; i < 720; i++) {
      const th = i / 2;
      while (j < poly.length - 2 && poly[j + 1][0] < th) j++;
      const a = poly[j], b = poly[Math.min(j + 1, poly.length - 1)];
      const f = b[0] > a[0] ? Math.min(1, Math.max(0, (th - a[0]) / (b[0] - a[0]))) : 0;
      out[i] = a[1] + (b[1] - a[1]) * f;
    }
    return out;
  }
  function morphTo(poly) {
    const to = resample(poly);
    const from = shown || to, rhoFrom = rhoNow;
    const t0 = performance.now(), dur = REDUCED ? 0 : 420;
    cancelAnimationFrame(anim);
    const tick = (now) => {
      const f = dur ? Math.min(1, (now - t0) / dur) : 1, e = f * f * (3 - 2 * f);
      const mid = new Float64Array(720);
      for (let i = 0; i < 720; i++) mid[i] = from[i] + (to[i] - from[i]) * e;
      shown = mid;
      rhoNow = rhoFrom + (rhoTo - rhoFrom) * e;
      cellsFade = f >= 1 ? 1 : Math.max(0, (f - 0.55) / 0.45);
      anim = f < 1 ? requestAnimationFrame(tick) : null;
      drawLoop(f >= 1);
    };
    anim = requestAnimationFrame(tick);
  }
  function fitCanvas(c) {
    const dpr = Math.max(1, window.devicePixelRatio || 1), r = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    return { w, h, dpr };
  }
  // The whole stage holds the loop; the math card is a modal over the lab.
  function loopBox(w, h) { return { x: 0, y: 0, w, h }; }
  // Where a direction and a gap fall on the stage: its centre, the circle's radius, and the map (theta, gap) -> point.
  function stageMap(w, h) {
    const box = loopBox(w, h);
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    let peak = 0;
    for (let i = 0; i < 720; i++) peak = Math.max(peak, loupe * shown[i]);
    if (fence) peak = Math.max(peak, loupe * fence.gap.max);   // the corners are sharper than 720 directions
    const R = (Math.min(box.w, box.h) * Math.min(LOOP_FILL, CELLS_FILL / rhoNow)) / (1 + Math.max(0, peak));
    const at = (th, d) => {
      const r = R * (1 + loupe * d), a = th * Math.PI / 180;
      return [cx + r * Math.sin(a), cy + r * Math.cos(a)];
    };
    return { cx, cy, R, at };
  }
  function drawLoop(exact) {
    const { w, h, dpr } = fitCanvas(loopCanvas);
    const ctx = lctx;
    ctx.clearRect(0, 0, w, h);
    if (!shown) return;
    const { cx, cy, R, at } = stageMap(w, h);
    // The circle, and, for a loop, its four points on the axes, where the gap is 0 by construction.
    ctx.save();
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.strokeStyle = "rgba(216, 246, 255, 0.42)";
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (!fence) {
      ctx.fillStyle = "rgba(216, 246, 255, 0.75)";
      for (let k = 0; k < 4; k++) {
        const p = at(k * 90, 0);
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 * dpr, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // The loop's inside, faintly.
    ctx.beginPath();
    for (let i = 0; i < 720; i++) { const p = at(i / 2, shown[i]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
    ctx.fillStyle = "rgba(47, 243, 255, 0.07)";
    ctx.fill();
    if (fenceCells) drawCells(ctx, at, dpr);
    if (exact && fence) drawFence(ctx, at, dpr);
    else {
      ctx.save();
      ctx.shadowColor = "rgba(47, 243, 255, 0.7)"; ctx.shadowBlur = 10 * dpr;
      ctx.strokeStyle = "#2ff3ff"; ctx.lineWidth = 2.4 * dpr; ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }
  }
  // The fence itself, behind the polygon: every cell in its piece's colour, the pieces outlined. The polygon runs through the middle
  // of the edges where neighbouring pieces meet (the paper's two pictures of the optimal fence in one). The loupe bends the polygon
  // radially about the circle; the cells are mapped by the same map, so they stay with it, and they fade out as it grows. A chosen
  // piece is full, the others step back; the piece under the mouse is a little fuller.
  function drawCells(ctx, at, dpr) {
    const k = (loupe <= 1.0001 ? 1 : Math.max(0, 1 - (loupe - 1) / CELLS_FADE)) * cellsFade;
    if (k < 0.01) return;
    const sub = loupe > 1.0001 ? 4 : 1;   // a side is a curve under the loupe
    const pt = (x, y) => { const q = G.polar(fence, x, y); return at(q[0], q[1]); };
    const trace = (x1, y1, x2, y2, first) => {
      for (let i = first ? 0 : 1; i <= sub; i++) {
        const p = pt(x1 + (x2 - x1) * i / sub, y1 + (y2 - y1) * i / sub);
        if (first && i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
    };
    ctx.save();
    ctx.lineJoin = "round";
    fenceCells.sq.forEach((piece, i) => {
      const lit = tiles && i === sel, back = tiles && sel >= 0 && !lit, near = tiles && i === hov && !lit;
      ctx.globalAlpha = k * (lit ? 0.9 : back ? 0.12 : near ? 0.55 : 0.3);
      ctx.fillStyle = pieces[i] ? pieces[i].color : "#7f83ff";
      ctx.beginPath();
      for (const [x, y] of piece) {
        trace(x, y, x + 1, y, true); trace(x + 1, y, x + 1, y + 1); trace(x + 1, y + 1, x, y + 1); trace(x, y + 1, x, y);
        ctx.closePath();
      }
      ctx.fill();
    });
    ctx.lineWidth = Math.max(1, 1.3 * dpr);
    fenceCells.edges.forEach((edges, i) => {
      const lit = tiles && i === sel;
      ctx.globalAlpha = k * (lit ? 0.95 : tiles && sel >= 0 ? 0.25 : 0.55);
      ctx.strokeStyle = lit ? "#ffffff" : "rgba(4, 10, 20, 0.9)";
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of edges) trace(x1, y1, x2, y2, true);
      ctx.stroke();
    });
    ctx.restore();
  }
  // A fence of the paper, exactly: each side is traced from the polygon's own corners, point by point in the
  // plane, so that the corners stay sharp under the loupe and a straight side bends only as the loupe says.
  // The true corners are dots, the four corner pieces wear a ring. With the pieces as tiles (an optimal fence)
  // each arrow of the polygon is drawn in the colour of its piece and the chosen piece is lit in white; with the
  // kinds of arrows (the greedy fences) the polygon is one line and the places of the chosen arrow are lit.
  function sideTrace(a, b, at, out, skipFirst) {
    const pa = G.polar(fence, a[0], a[1]), pb = G.polar(fence, b[0], b[1]);
    let dt = pb[0] - pa[0];
    if (dt < -180) dt += 360; else if (dt > 180) dt -= 360;
    const m = Math.max(1, Math.min(4000, Math.ceil(Math.abs(dt) / SIDE_STEP)));
    for (let i = skipFirst ? 1 : 0; i <= m; i++) {
      const f = i / m, q = G.polar(fence, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      out.push(at(q[0], q[1]));
    }
  }
  function strokeSide(ctx, a, b, at) {
    const pts = [];
    sideTrace(a, b, at, pts, false);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
  function drawFence(ctx, at, dpr) {
    const C = fence.corners, N = C.length;
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (tiles) {
      ctx.lineWidth = 3 * dpr;
      fence.seg.forEach((sg, i) => {
        ctx.strokeStyle = pieces[i].color;
        ctx.globalAlpha = sel >= 0 && i !== sel ? 0.5 : 1;
        strokeSide(ctx, sg[0], sg[1], at);
      });
    } else {
      ctx.shadowColor = "rgba(47, 243, 255, 0.7)"; ctx.shadowBlur = 10 * dpr;
      ctx.strokeStyle = "#2ff3ff"; ctx.lineWidth = 2.4 * dpr;
      ctx.globalAlpha = selKind >= 0 ? 0.5 : 1;
      ctx.beginPath();
      for (let j = 0; j < N; j++) {
        const pts = [];
        sideTrace(C[j], C[(j + 1) % N], at, pts, j > 0);
        pts.forEach((p, i) => (j === 0 && i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    // The true corners as dots, thinned where they crowd: the loupe pulls them apart.
    ctx.save();
    ctx.fillStyle = "rgba(255, 212, 59, 0.85)";
    let last = null;
    for (let j = 0; j < N; j++) {
      const q = G.polar(fence, C[j][0], C[j][1]), p = at(q[0], q[1]);
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 7 * dpr) continue;
      last = p;
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // The corner pieces: a ring at each place of a half-integral arrow.
    const ring = (a, b) => {
      const q = G.polar(fence, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), p = at(q[0], q[1]);
      ctx.beginPath(); ctx.arc(p[0], p[1], 6 * dpr, 0, Math.PI * 2); ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = "#ff5fb3"; ctx.lineWidth = 1.6 * dpr;
    if (tiles) fence.seg.forEach((sg, i) => { if (pieces[i].corner) ring(sg[0], sg[1]); });
    else for (const kc of chain.vecs) if (kc[3]) for (const [a, b] of G.placesOf(fence, kc[0], kc[1])) ring(a, b);
    ctx.restore();
    // The piece under the mouse, a little less than the chosen one.
    if (tiles && hov >= 0 && hov !== sel && fence.seg[hov]) {
      ctx.save();
      ctx.lineCap = "round"; ctx.globalAlpha = 0.7; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3.4 * dpr;
      strokeSide(ctx, fence.seg[hov][0], fence.seg[hov][1], at);
      ctx.restore();
    }
    // The chosen piece, or the places of the chosen kind of arrow, in white.
    const lit = tiles ? (sel >= 0 ? [fence.seg[sel]] : []) : (selKind >= 0 ? G.placesOf(fence, chain.vecs[selKind][0], chain.vecs[selKind][1]) : []);
    if (lit.length) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)"; ctx.shadowBlur = 12 * dpr;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4.5 * dpr;
      for (const [a, b] of lit) strokeSide(ctx, a, b, at);
      ctx.restore();
    }
  }

  // ---------- the left box: the 500-omino, the pieces of an optimal fence, or the kinds of arrows ----------
  const pc = $("pieces"), pctx = pc.getContext("2d");
  let slots = [];
  function pieceCount() { return fence ? fence.count : pieces.length; }
  // The grid of square slots, as large as the box allows, for the pieces of an optimal fence; none when a slot
  // would be smaller than a finger: then the box shows the kinds of arrows, as it does for the greedy fences.
  function tileGrid(w, h, dpr) {
    const N = pieces.length;
    let cols = 1, s = 0;
    for (let c = 1; c <= N; c++) {
      const size = Math.min(w / c, h / Math.ceil(N / c));
      if (size > s) { s = size; cols = c; }
    }
    return optimal() && s >= 24 * dpr ? { cols, s } : null;
  }
  function drawPieces() {
    const { w, h, dpr } = fitCanvas(pc);
    pctx.clearRect(0, 0, w, h);
    slots = []; kindSpots = [];
    const grid = n === GIANT ? null : tileGrid(w, h, dpr);
    if (!!grid !== tiles) {
      // the box changed the way it shows the pieces: what was chosen is let go, and the caption and the status say so
      const had = sel >= 0 || selKind >= 0;
      sel = -1; selKind = -1; hov = -1;
      tiles = !!grid;
      if (had) { caption(); status(t(tiles ? "ls.s.noPiece" : "ls.s.noKind")); }
    }
    if (n === GIANT) {
      if (giant) drawShape(giant.cells, giant.pairs, "#7f83ff", 0, 0, w, h, 0.94, dpr, false, false, false, false);
    } else if (grid) {
      const N = pieces.length, rows = Math.ceil(N / grid.cols), s = grid.s;
      const ox = (w - grid.cols * s) / 2, oy = (h - rows * s) / 2;
      pieces.forEach((p, i) => {
        const x = ox + (i % grid.cols) * s, y = oy + Math.floor(i / grid.cols) * s;
        slots.push([x, y, s]);
        drawShape(p.cells, p.pairs, p.color, x, y, s, s, tileFill(s, dpr), dpr, i === sel, true, true, p.corner, tileExt, i === hov && i !== sel);
      });
    } else if (fence) drawKinds(w, h, dpr);
    syncPieceAccess();
  }
  // The kinds of arrows of a fence, folded to 0..45 degrees and drawn from one point: a dot at each tip,
  // bigger and brighter the more pieces share the arrow, the corner pieces' arrow apart. The polygon is
  // exactly these arrows, end to end. The dots themselves set the scale (not the empty reach of the 45°
  // guide), so that they stand as far apart as the box allows, on its floor next to the caption; the
  // chosen arrow's pair and number of pieces are written beside its dot.
  function drawKinds(w, h, dpr) {
    const ctx = pctx, K = chain.vecs, pl = 10 * dpr, pr = 12 * dpr, pt = 12 * dpr, pb = 12 * dpr;
    let X = 0, Y = 0, top = 1;
    for (const v of K) { X = Math.max(X, v[0]); Y = Math.max(Y, v[1]); top = Math.max(top, v[2]); }
    const u = Math.min((w - pl - pr) / X, (h - pt - pb) / Y), ox = pl + (w - pl - pr - X * u) / 2, oy = h - pb;
    const rad = (v) => (1.8 + 3.6 * Math.sqrt(v[2] / top)) * dpr, g = Math.min(oy - 2 * dpr, (Y + 0.8) * u);
    ctx.save();
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeStyle = "rgba(216, 246, 255, 0.28)"; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(Math.min(w - 2 * dpr, ox + (X + 0.8) * u), oy);
    ctx.moveTo(ox, oy); ctx.lineTo(ox + g, oy - g); ctx.stroke();
    ctx.setLineDash([]);
    const lit = (m) => Math.log(1 + m) / Math.log(1 + top);
    ctx.lineWidth = 1 * dpr;
    K.forEach((v, i) => {
      ctx.strokeStyle = "rgba(216, 246, 255, " + (i === selKind ? 0.5 : 0.07) + ")";
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + v[0] * u, oy - v[1] * u); ctx.stroke();
    });
    K.forEach((v, i) => {
      const x = ox + v[0] * u, y = oy - v[1] * u, r = rad(v);
      kindSpots.push([x, y, i]);
      // The corner pieces' arrow at full strength, in the pink ring the polygon gives those pieces.
      ctx.globalAlpha = i === selKind || v[3] ? 1 : 0.35 + 0.65 * lit(v[2]);
      ctx.fillStyle = i === selKind ? "#ffffff" : v[3] ? "#ff5fb3" : "#2de2d5";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (i === selKind || v[3]) {
        ctx.strokeStyle = i === selKind ? "#ffffff" : "#ff5fb3"; ctx.lineWidth = (i === selKind ? 1.5 : 1.6) * dpr;
        ctx.beginPath(); ctx.arc(x, y, r + 4 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
    });
    if (selKind >= 0) {
      // Above the chosen dot (a finger on it hides what lies below), else to its left, its right, below it.
      const v = K[selKind], x = ox + v[0] * u, y = oy - v[1] * u, r = rad(v) + 7 * dpr, e = 2 * dpr, s = kindText(v);
      ctx.globalAlpha = 1;
      ctx.font = "700 " + 11.5 * dpr + "px ui-monospace, SFMono-Regular, Menlo, monospace";
      const tw = ctx.measureText(s).width + 12 * dpr, th = 20 * dpr;
      const fitX = (a) => Math.max(e, Math.min(w - tw - e, a)), fitY = (b) => Math.max(e, Math.min(h - th - e, b));
      let lx, ly;
      if (y - r - th >= e) { lx = fitX(x - tw / 2); ly = y - r - th; }
      else if (x - r - tw >= e) { lx = x - r - tw; ly = fitY(y - th / 2); }
      else if (x + r + tw <= w - e) { lx = x + r; ly = fitY(y - th / 2); }
      else { lx = fitX(x - tw / 2); ly = fitY(y + r); }
      roundRect(ctx, lx, ly, tw, th, 6 * dpr);
      ctx.fillStyle = "rgba(10, 13, 19, 0.9)"; ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 1 * dpr; ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s, lx + tw / 2, ly + th / 2 + 0.5 * dpr);
    }
    ctx.restore();
  }
  // A kind of arrow as the caption and the label write it: its pair, then its number of pieces.
  function kindText(k) { return t("ls.pair", { x: fmtHalf(k[0]), y: fmtHalf(k[1]) }) + " · " + fmtNum(k[2], 0); }
  function nearestKind(x, y, radius) {
    let best = -1, d = radius;
    for (const [sx, sy, i] of kindSpots) {
      const e = Math.hypot(sx - x, sy - y);
      if (e <= d) { d = e; best = i; }
    }
    return best;
  }
  // A tap or a key toggles a kind; a finger sliding over the dots chooses quietly, and is heard on release.
  function pickKind(i) {
    if (!fence || n === GIANT || tiles || !chain.vecs[i]) return;
    setKind(selKind === i ? -1 : i);
  }
  function setKind(i, quiet) {
    selKind = i;
    drawPieces();
    redraw();
    caption();
    if (!quiet) sayKind();
  }
  function sayKind() {
    if (selKind < 0) { status(t("ls.s.noKind")); return; }
    const k = chain.vecs[selKind];
    // « one piece for each of the four corners » is only true of an arrow the four corner pieces share
    status(t(k[3] && k[2] === 4 ? "ls.s.cornerArrow" : "ls.s.kind", { pair: t("ls.pair", { x: fmtHalf(k[0]), y: fmtHalf(k[1]) }), m: fmtNum(k[2], 0), k: G.placesOf(fence, k[0], k[1]).length }));
  }
  function syncPieceAccess() {
    const kinds = !!fence && n !== GIANT && !tiles;
    pc.classList.toggle("scrub", tiles || kinds);
    pc.style.cursor = tiles || kinds ? "pointer" : "default";
    if (tiles || kinds) pc.setAttribute("tabindex", "0"); else pc.removeAttribute("tabindex");
    const label = n === GIANT ? t("ls.giantAria") : kinds ? t("ls.kinds", { kinds: fmtNum(chain.vecs.length, 0), count: fmtNum(fence.count, 0), n })
      : t("ls.pieces", { count: fmtNum(pieces.length, 0), n });
    pc.setAttribute("aria-label", label);
    // The canvas explains itself through its box (the bubbles skip canvases).
    pc.parentElement.setAttribute("data-lab-tip", n === GIANT ? t(REDUCED ? "ls.tipGiantStill" : "ls.tipGiant") : kinds ? t("ls.tipKinds") : t("ls.tipTiles"));
  }
  // A piece's cells fitted into a box: the cell size and the maps from grid coordinates to the canvas. Rows grow
  // downwards, as on the hub's boards.
  function extentOf(cells) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [cx, cy] of cells) { minX = Math.min(minX, cx); maxX = Math.max(maxX, cx + 1); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy + 1); }
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }
  // With `ext` (the longest side of the biggest piece of the set) every piece has the same cell size, the biggest one filling
  // its box; without it the piece is fitted to its box alone.
  function fitShape(cells, x, y, bw, bh, fill, ext) {
    const { minX, maxX, minY, maxY, w, h } = extentOf(cells);
    const u = (ext ? Math.min(bw, bh) / ext : Math.min(bw / w, bh / h)) * fill;
    const X0 = x + bw / 2 - ((minX + maxX) / 2) * u, Y0 = y + bh / 2 - ((minY + maxY) / 2) * u;
    return { u, sx: (gx) => X0 + gx * u, sy: (gy) => Y0 + gy * u };
  }
  // The biggest piece of the set fills this part of its tile (smaller tiles give it more room).
  const tileFill = (s, dpr) => (s < 44 * dpr ? 0.9 : 0.8);
  // One piece, fitted into a box, with its arrows (the 500-omino's longest ones; an optimal fence's piece has its
  // one arrow, and `marks` draws the two unit edges whose midpoints the arrow joins: its attachment edges). On a tile,
  // `corner` gives a corner piece its pink border, as its ring on the polygon.
  function drawShape(cells, pairs, color, x, y, bw, bh, fill, dpr, chosen, tile, marks, corner, ext, hover) {
    const { u, sx, sy } = fitShape(cells, x, y, bw, bh, fill, ext);
    const ctx = pctx;
    // Each piece on its own tile, as in the labs' trays.
    if (tile) {
      const g = Math.max(1.5 * dpr, Math.min(3 * dpr, bw * 0.05)), rr = Math.min(10 * dpr, bw * 0.2);
      ctx.save();
      roundRect(ctx, x + g, y + g, bw - 2 * g, bh - 2 * g, rr);
      ctx.fillStyle = chosen ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.035)";
      ctx.fill();
      if (chosen) { ctx.shadowColor = "rgba(255, 255, 255, 0.25)"; ctx.shadowBlur = 14 * dpr; }
      ctx.strokeStyle = chosen ? "#ffffff" : hover ? "rgba(255, 255, 255, 0.6)" : corner ? "rgba(255, 95, 179, 0.9)" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = (chosen || hover || corner ? 1.5 : 1) * dpr;
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(10, 22, 34, 0.36)";
    ctx.lineWidth = Math.max(0.6, u * 0.04);
    for (const [cx, cy] of cells) {
      ctx.beginPath(); ctx.rect(sx(cx), sy(cy), u, u); ctx.fill();
      if (u > 3) ctx.stroke();
    }
    // The piece's own outline, as on the hub's cards.
    const set = new Set(cells.map((c) => c[0] + "," + c[1]));
    ctx.beginPath();
    for (const [cx, cy] of cells) {
      if (!set.has(cx + "," + (cy - 1))) { ctx.moveTo(sx(cx), sy(cy)); ctx.lineTo(sx(cx + 1), sy(cy)); }
      if (!set.has(cx + "," + (cy + 1))) { ctx.moveTo(sx(cx), sy(cy + 1)); ctx.lineTo(sx(cx + 1), sy(cy + 1)); }
      if (!set.has((cx - 1) + "," + cy)) { ctx.moveTo(sx(cx), sy(cy)); ctx.lineTo(sx(cx), sy(cy + 1)); }
      if (!set.has((cx + 1) + "," + cy)) { ctx.moveTo(sx(cx + 1), sy(cy)); ctx.lineTo(sx(cx + 1), sy(cy + 1)); }
    }
    ctx.lineWidth = Math.max(1, Math.min(2.4 * dpr, u * 0.08));
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(4, 10, 20, 0.88)";
    ctx.stroke();
    const HALO = "rgba(4, 10, 20, 0.82)";
    if (marks) {
      // An arrow's end is the midpoint of a unit edge; an odd doubled x says the edge is vertical. White on a dark
      // halo: no tile wears either, whatever its colour.
      const mw = Math.max(1.8 * dpr, Math.min(3.4 * dpr, u * 0.16));
      for (const [col, w] of [[HALO, mw + 2.2 * dpr], ["#ffffff", mw]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        for (const pq of pairs) for (const m of pq) {
          const gx = m[0] / 2 + 0.5, gy = m[1] / 2 + 0.5, v = Math.abs(m[0]) % 2 === 1;
          ctx.beginPath();
          if (v) { ctx.moveTo(sx(gx), sy(gy - 0.5)); ctx.lineTo(sx(gx), sy(gy + 0.5)); }
          else { ctx.moveTo(sx(gx - 0.5), sy(gy)); ctx.lineTo(sx(gx + 0.5), sy(gy)); }
          ctx.stroke();
        }
      }
    }
    // The arrows, from midpoint to midpoint (doubled coordinates), on a dark halo that keeps them readable on any tile.
    const lw = Math.max(1.2 * dpr, Math.min(2.6 * dpr, u * 0.1));
    for (const [p, q] of pairs) {
      const ax = sx(p[0] / 2 + 0.5), ay = sy(p[1] / 2 + 0.5), bx = sx(q[0] / 2 + 0.5), by = sy(q[1] / 2 + 0.5);
      const ang = Math.atan2(by - ay, bx - ax), head = Math.max(4 * dpr, lw * 3.2);
      const ex = bx - Math.cos(ang) * head * 0.6, ey = by - Math.sin(ang) * head * 0.6;
      const tip = () => {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(ang - 0.45) * head, by - Math.sin(ang - 0.45) * head);
        ctx.lineTo(bx - Math.cos(ang + 0.45) * head, by - Math.sin(ang + 0.45) * head);
        ctx.closePath();
      };
      ctx.save();
      ctx.lineJoin = "round";
      ctx.strokeStyle = HALO; ctx.lineWidth = lw + 2.2 * dpr;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      tip(); ctx.stroke();
      ctx.shadowColor = "rgba(47, 243, 255, 0.85)"; ctx.shadowBlur = Math.min(6 * dpr, lw * 2.5);
      ctx.strokeStyle = "#2ff3ff"; ctx.fillStyle = "#2ff3ff"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      tip(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // A tile's piece: chosen, drawn lit on the polygon, written in the caption, said in the status. Choosing the chosen one lets go.
  function setPiece(i, quiet) {
    sel = i;
    drawPieces();
    redraw();
    caption();
    if (!quiet) sayPiece();
  }
  function pick(i) {
    if (!tiles || i < 0 || i >= pieces.length) return;
    setPiece(sel === i ? -1 : i);
  }
  function sayPiece() {
    status(sel >= 0 ? t("ls.s.pick", { i: sel + 1, count: fmtNum(pieces.length, 0), pair: pieceArrow(sel) }) : t("ls.s.noPiece"));
  }
  // A piece's arrow as the fence places it: x to the right, y upwards (the polygon's own axes), signed.
  function pieceArrow(i) {
    const a = fence.arrows[i], sg = (v) => (v < 0 ? MINUS : "") + fmtHalf(Math.abs(v));
    return t("ls.pair", { x: sg(a[0] / 2), y: sg(a[1] / 2) });
  }
  // The pieces (tiles) and the kinds of arrows (dots) answer the pointer the same way: down chooses the one under it
  // (for dots, the nearest), a finger sliding over them chooses the one under it (it shows while the finger is down,
  // so a miss is mended by sliding), release keeps it; a tap on the chosen one, or away from every one, lets go.
  let scrub = null;
  function canvasXY(e) {
    const r = pc.getBoundingClientRect(), dpr = pc.width / r.width;
    return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, dpr];
  }
  const chosen = () => (tiles ? sel : selKind);
  const choose = (i, quiet) => (tiles ? setPiece(i, quiet) : setKind(i, quiet));
  const sayChoice = () => (tiles ? sayPiece() : sayKind());
  function hit(x, y, dpr, radius) {
    if (!tiles) return nearestKind(x, y, radius * dpr);
    return slots.findIndex(([sx, sy, s]) => x >= sx && x < sx + s && y >= sy && y < sy + s);
  }
  pc.addEventListener("pointerdown", (e) => {
    if (!fence || n === GIANT || e.button !== 0) return;
    // The dock's bubble stays for the mouse's hover: here a long press is a slide, not a question.
    if (window.labTip) window.labTip.hide();
    const [x, y, dpr] = canvasXY(e), i = hit(x, y, dpr, PICK_RADIUS);
    scrub = { id: e.pointerId, was: chosen(), first: i, moved: false };
    hov = -1;
    try { pc.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    if (i >= 0 && i !== chosen()) choose(i, true);
  });
  pc.addEventListener("pointermove", (e) => {
    if (!scrub || e.pointerId !== scrub.id) {
      // A mouse over the tiles previews the piece's side of the polygon.
      if (!tiles || e.pointerType !== "mouse" || scrub) return;
      const [x, y, dpr] = canvasXY(e), i = hit(x, y, dpr, 0);
      if (i !== hov) { hov = i; drawPieces(); redraw(); }
      return;
    }
    const [x, y, dpr] = canvasXY(e), i = hit(x, y, dpr, SCRUB_RADIUS);
    if (i >= 0 && i !== chosen()) { scrub.moved = true; choose(i, true); }
  });
  pc.addEventListener("pointerleave", () => { if (hov >= 0) { hov = -1; drawPieces(); redraw(); } });
  function endScrub(e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    const s = scrub;
    scrub = null;
    if (e.type === "pointerup" && !s.moved && s.was >= 0 && (s.first < 0 || s.first === s.was)) choose(-1);
    else if (chosen() !== s.was || s.moved) sayChoice();
  }
  pc.addEventListener("pointerup", endScrub);
  pc.addEventListener("pointercancel", endScrub);
  pc.addEventListener("keydown", (e) => {
    if (!fence || n === GIANT) return;
    if (window.labTip && (e.key.startsWith("Arrow") || e.key === "Escape")) window.labTip.hide();
    const K = tiles ? pieces.length : chain.vecs.length, cur = chosen(), go = tiles ? pick : pickKind;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(cur < 0 ? 0 : (cur + 1) % K); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(cur < 0 ? K - 1 : (cur - 1 + K) % K); }
    else if (e.key === "Escape" && cur >= 0) go(cur);
  });

  // ---------- readouts and controls ----------
  const locale = () => (lang() === "en" ? "en-US" : lang() === "fr" ? "fr-FR" : "de-DE");
  function fmtNum(x, digits) {
    return x.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  // An arrow's coordinate: whole, or a half for the corner pieces' arrow.
  function fmtHalf(x) { return fmtNum(x, x % 1 ? 1 : 0); }
  function fmtPct(d, digits) {
    const s = fmtNum(Math.abs(d) * 100, digits || (n === GIANT ? 2 : 1));
    const sep = lang() === "fr" ? "\u202f" : lang() === "de" ? "\u00a0" : "";
    return (d < 0 ? MINUS : "+") + s + sep + "%";
  }
  function fmtSci(log10) {
    const e = Math.floor(log10), m = Math.pow(10, log10 - e);
    return `${fmtNum(m, 1)}·10<sup>${e}</sup>`;
  }
  const DICE = '<svg class="dice" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>';
  // « 1 piece », « 12 pieces »
  const countText = (c) => c === 1 ? t("ls.count1") : t("ls.count", { count: fmtNum(c, 0) });
  function caption() {
    const c = $("caption");
    if (n === GIANT) {
      c.innerHTML = DICE + `<span>${fmtNum(giantSamples, 0)}</span><span class="visually-hidden">${t("ls.samples", { s: fmtNum(giantSamples, 0) })}</span>`;
    } else if (fence && selKind >= 0) {
      // The chosen arrow and the number of pieces that share it.
      const k = chain.vecs[selKind];
      c.textContent = t("ls.pair", { x: fmtHalf(k[0]), y: fmtHalf(k[1]) }) + " · " + countText(k[2]);
    } else if (tiles && sel >= 0) c.textContent = (sel + 1) + "/" + pieces.length + " · " + pieceArrow(sel);
    else c.textContent = countText(pieceCount()) + (optimal() && $("fence-tag").classList.contains("short") ? " · " + t("ls.optName") : "");
    if (n === GIANT) c.setAttribute("data-lab-tip", t(REDUCED ? "ls.tipSamplesStill" : "ls.tipSamples")); else c.removeAttribute("data-lab-tip");
    $("gap-value").textContent = fmtPct(maxGap());
    // « loop » only where there is a loop
    const poly = !!fence && n !== GIANT;
    $("gap-tok").dataset.i18nTitle = poly ? "ls.gapPoly" : "ls.gap";
    $("gap-tok").setAttribute("data-lab-tip", t(poly ? "ls.gapPoly" : "ls.gap"));
    $("gap-label").dataset.i18n = poly ? "ls.gapPoly" : "ls.gapLabel";
    $("gap-label").textContent = t(poly ? "ls.gapPoly" : "ls.gapLabel");
  }
  // At 500 cells, the paper's sample behind the loop, in the corner of the stage; from 4 to 6, the optimal fence,
  // from 7 to 15, the greedy fence.
  function syncSource() {
    $("src-tag").hidden = n !== GIANT;
    $("fence-tag").hidden = !fence || n === GIANT;
    const nameKey = optimal() ? "ls.optName" : "ls.fenceName", tipKey = optimal() ? "ls.optTip" : "ls.fenceTip";
    $("fence-name").dataset.i18n = nameKey; $("fence-name").textContent = t(nameKey);
    $("fence-tag").dataset.i18nTitle = tipKey; $("fence-tag").title = t(tipKey);
    $("src-tag").title = t(REDUCED ? "ls.srcStill" : "ls.src");
    $("src-count").textContent = t("ls.srcCount", { m: fmtNum(PAPER500 / 1e6, 1) });
    fitTag();
  }
  // The fence's tag keeps its words where the polygon leaves them room; on a small stage, where a polygon
  // would run under them, only its icon shows, and its name stays in the bubble and the accessible name.
  // The test takes every fence's polygon at ×1 (the loupe only pulls a polygon away from the corner), so that
  // the tag keeps one form from 4 to 15.
  let fencePts = null;
  function fitTag() {
    const tag = $("fence-tag"), was = tag.classList.contains("short");
    tag.classList.remove("short");
    if (tag.hidden) { if (was) caption(); return; }
    if (!fencePts) {
      fencePts = [];
      for (let k = 4; k <= LAST_FENCE; k++) {
        const g = k >= FIRST_FENCE ? GREEDY[k] : OPT[k] && G.fromPieces(OPT[k]);
        if (!g) continue;
        const P = G.build(g), pts = G.samples(P, 0.5);
        let rho = 1;
        if (k < FIRST_FENCE) {   // the fence's cells too: every corner of every cell, in the polygon's polar terms
          const sq = G.cellsOf(OPT[k]);
          rho = G.reach(P, sq);
          sq.forEach((piece) => piece.forEach((q) => { for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) pts.push(G.polar(P, q[0] + dx, q[1] + dy)); }));
        }
        fencePts.push({ max: P.gap.max, rho, pts });
      }
    }
    const st = loopCanvas.getBoundingClientRect(), r = tag.getBoundingClientRect(), m = 4;
    const cx = st.left + st.width / 2, cy = st.top + st.height / 2;
    tag.classList.toggle("short", fencePts.some((f) => {
      const R = Math.min(st.width, st.height) * Math.min(LOOP_FILL, CELLS_FILL / f.rho) / (1 + f.max);
      return f.pts.some(([th, g]) => {
        const a = th * Math.PI / 180, x = cx + R * (1 + g) * Math.sin(a), y = cy + R * (1 + g) * Math.cos(a);
        return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
      });
    }));
    if (tag.classList.contains("short") !== was) caption();   // the caption names the optimal fence where the tag cannot
  }
  function syncControls() {
    const i = STEPS.indexOf(n);
    const fewer = $("fewer"), more = $("more");
    fewer.setAttribute("aria-disabled", i <= 0 ? "true" : "false");
    more.setAttribute("aria-disabled", i >= STEPS.length - 1 ? "true" : "false");
    fewer.classList.toggle("skip", n === GIANT);
    more.classList.toggle("skip", n === LAST_FENCE);
    // At the ends, the greyed step says where the lab stops instead of what it cannot do.
    const fk = n === GIANT ? "ls.fromGiant" : i <= 0 ? "ls.fewest" : "ls.fewer";
    const mk = n === LAST_FENCE ? "ls.toGiant" : i >= STEPS.length - 1 ? "ls.most" : "ls.more";
    for (const [b, k] of [[fewer, fk], [more, mk]]) {
      b.dataset.i18nTitle = k; b.dataset.i18nAriaLabel = k;
      b.setAttribute("aria-label", t(k)); b.setAttribute("data-lab-tip", t(k));
    }
    $("n-pill").setAttribute("aria-label", t("ls.nAria", { n }));
  }
  function step(d) {
    const i = STEPS.indexOf(n) + d;
    if (i < 0 || i >= STEPS.length) return;
    setN(STEPS[i]);
  }
  $("fewer").addEventListener("click", () => step(-1));
  $("more").addEventListener("click", () => step(1));
  document.addEventListener("keydown", (e) => {
    // Browser shortcuts keep their keys (Ctrl or Cmd with + and − zoom); the loupe's slider has no use for + − [ ].
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input:not([type=range]), textarea")) return;
    if (e.key === "+" || e.key === "=") step(1);
    else if (e.key === "-" || e.key === "_") step(-1);
    else if (e.key === "[" || e.key === "]") {
      setLoupe(Math.max(0, Math.min(100, loupeV + (e.key === "]" ? 10 : -10))));
      status(t("ls.s.loupe", { k: loupeShown() }));
    }
  });
  function status(s) { $("status").textContent = s; }

  // Desktop: the readout sits over the middle of the loop's stage.
  function centreReadout() {
    const r = $("topmid");
    r.style.transform = "";
    if (window.innerWidth <= 860 || window.innerHeight <= 520) return;
    const st = $("stage").getBoundingClientRect(), box = r.getBoundingClientRect();
    const kids = [$("readout"), document.querySelector(".gapBox")].map((k) => k.getBoundingClientRect());
    const left = kids[0].left, right = kids[1].right, mid = (left + right) / 2, want = (st.left + st.right) / 2;
    const nav = document.querySelector(".topnav").getBoundingClientRect().left;
    let dx = want - mid;
    dx = Math.min(dx, nav - 16 - right);
    dx = Math.max(dx, box.left - left);
    r.style.transform = `translateX(${Math.round(dx)}px)`;
  }

  // ---------- math chips and their cards ----------
  function syncChips() {
    const want = new Set(["gap"]);
    if (n === GIANT) { want.add("sample"); want.add("giant"); }
    else { want.add("count"); want.add("arrow"); want.add("polygon"); }
    document.querySelectorAll(".math-chip").forEach((b) => {
      b.hidden = !want.has(b.dataset.chip);
    });
    if (openChip && !want.has(openChip)) closeCard();
  }
  function live(id) {
    const tag = (s, k) => `<span class="live">${s} · ${t(k || "ls.live.computed")}</span>`;
    const N0 = (x) => fmtNum(Math.round(x), 0), colon = lang() === "fr" ? "\u202f: " : ": ";
    if (id === "count" && n !== GIANT) return tag(`<i>n</i> = ${n}${colon}${N0(pieceCount())}`, fence ? "ls.live.paper" : null);
    if (id === "polygon" && fence) {
      // A = A_ref + the corrections (Lemma on the area decomposition): the polygon's area is computed
      // here from its arrows, the greedy fence and the bounds are the paper's, the corrections follow.
      // Only « = value » stays on one line: the label wraps on a narrow card.
      const f1 = (x) => fmtNum(x, x % 1 ? 1 : 0), fz = FENCES[n];
      let s = `${t("ls.live.ref")} <span class="f">= ${f1(fence.area)}</span> · ${t("ls.live.computed")}`;
      if (optimal()) {
        // The cells the pieces enclose are counted here, on the pieces; the optimum is the paper's.
        const cells = G.regionArea(OPT[n].pieces);
        s += `<br>${t("ls.live.enclosed")} <span class="f">= ${N0(cells)}</span> · ${t("ls.live.counted")}`;
        s += `<br>${t("ls.live.corr")} <span class="f">= ${MINUS}${f1(fence.area - cells)}</span> · ${t("ls.live.computed")}`;
        s += `<br>${t("ls.live.fence", { f: t("ls.live.opt", { o: N0(fence.L) }) })}`;
        return `<span class="live">${s}</span>`;
      }
      s += `<br>${t("ls.live.greedy")} <span class="f">= ${N0(fence.L)}</span> · ${t("ls.live.paper")}`;
      s += `<br>${t("ls.live.corr")} <span class="f">= ${MINUS}${f1(fence.area - fence.L)}</span> · ${t("ls.live.computed")}`;
      if (fz && fz.best) s += `<br>${t("ls.live.fence", { f: t("ls.live.best", { b: N0(fz.best), u: N0(fz.bound) }) })}`;
      else s += `<br>${t("ls.live.upper", { u: N0(fence.U), g: fmtNum(100 * (fence.U - fence.L) / fence.L, 3) })}`;
      return `<span class="live">${s}</span>`;
    }
    if (id === "arrow" && optimal()) {
      // How many pieces of this fence take their longest arrow (the longest between the midpoints of two boundary edges).
      let k = 0;
      OPT[n].pieces.forEach((p) => {
        const dx = p.o[0] - p.i[0], dy = p.o[1] - p.i[1];
        if (dx * dx + dy * dy === S.diameters(p.c).d2) k++;
      });
      return `<span class="live">${t("ls.live.longest")} <span class="f">= ${k} / ${fence.count}</span> · ${t("ls.live.computed")}</span>`;
    }
    if (id === "gap" && fence) {
      // The whole polygon, and for the greedy fences the sector of the paper's deviation figure (the south to the south-east).
      const whole = `<span class="live"><span class="f"><i>n</i> = ${n}${colon}${fmtPct(maxGap(), 2)}</span> · ${t("ls.live.whole")} · ${t("ls.live.computed")}`;
      if (optimal()) return whole + "</span>";
      const r = G.range(fence, 0, 45);
      return whole + `<br><span class="f">${fmtPct(r.min, 2)} … ${fmtPct(r.max, 2)}</span> · ${t("ls.live.sector")} · ${t("ls.live.computed")}</span>`;
    }
    if (id === "gap") return tag(`<i>n</i> = ${n}${colon}${fmtPct(maxGap())}`, n === GIANT ? "ls.live.paper" : null);
    if (id === "sample") return tag(t("ls.samples", { s: N0(giantSamples) }));
    if (id === "giant") return tag(`≈ ${fmtSci(AREA500_LOG10)}`, "ls.live.paper");
    return "";
  }
  // The card itself is the shared math-chip card; this lab provides its texts.
  window.mathChip = window.mathChip || {};
  window.mathChip.provide = (chip) => {
    const id = chip.dataset.chip;
    const fenceCard = !!fence && n !== GIANT && (id === "gap" || id === "arrow" || id === "polygon");
    const c = CHIPS[fenceCard ? id + (optimal() ? "Opt" : "Fence") : id];
    if (!c) return null;
    const l = lang();
    const note = (tiles ? c.tiles : c.kinds) ? " " + (tiles ? c.tiles : c.kinds)[l] : "";
    return { title: t("ls.chip." + id), lead: c.lead[l], body: c.detail[l] + note + live(id), src: c.section[l],
      data: { label: c.label, lines: c.lines, chip: id } };
  };
  function closeCard() { if (window.mathChip.close) window.mathChip.close(false); }
  document.addEventListener("math-chip-open", (e) => { openChip = e.detail.dataset.chip || null; });
  document.addEventListener("math-chip-close", () => { openChip = null; });

  // ---------- language and size ----------
  document.querySelectorAll("[data-lang-btn]").forEach((b) => b.addEventListener("click", () => window.i18n.setLang(b.dataset.langBtn)));
  document.addEventListener("fc-langchange", () => {
    syncControls(); caption(); syncChips(); syncSource(); syncLoupe(); drawPieces();
    sayState();
    centreReadout();
  });
  new ResizeObserver(() => { drawPieces(); drawLoop(true); centreReadout(); fitTag(); }).observe(loopCanvas);
  new ResizeObserver(() => { const was = tiles; drawPieces(); if (tiles !== was) drawLoop(true); }).observe(pc);
  window.addEventListener("resize", centreReadout);

  syncLoupe();
  // A link may open the lab on a size of its own: .../limit-shape-lab/?n=11
  const asked = +new URLSearchParams(location.search).get("n");
  setN(STEPS.includes(asked) ? asked : 4);
  // The readout and the fence's tag are measured again once the fonts have come.
  if (document.fonts) document.fonts.ready.then(() => { centreReadout(); fitTag(); });

  // For tests and figure export.
  window.limitLab = {
    state: () => ({ n, pieces: pieceCount(), loupe, loupeV, maxLoupe: maxLoupe(), sel, tiles, gap: maxGap(), R: chain && chain.R, samples: giantSamples, source: !$("src-tag").hidden, chips: [...document.querySelectorAll(".math-chip")].filter((b) => !b.hidden).map((b) => b.dataset.chip),
      fence: !!fence && n !== GIANT, optimal: optimal(), cells: fenceCells ? fenceCells.sq.reduce((a, q) => a + q.length, 0) : 0, hover: hov, rho: rhoNow, kinds: fence && n !== GIANT ? chain.vecs.length : 0, corners: fence && n !== GIANT ? fence.corners.length : 0, selKind, area: fence && n !== GIANT ? fence.area : 0 }),
    setN, setLoupe, pick, pickKind,
    kindAt: (i) => chain && chain.vecs ? chain.vecs[i] : null,
    // where a kind's dot sits on the screen, for the browser tests
    spot: (i) => { const r = pc.getBoundingClientRect(), d = pc.width / r.width, s = kindSpots.find((q) => q[2] === i); return s ? [r.left + s[0] / d, r.top + s[1] / d] : null; },
    // for the browser tests: a tile's centre on the screen, and its piece
    tileSpot: (i) => { const r = pc.getBoundingClientRect(), d = pc.width / r.width, q = slots[i]; return q ? [r.left + (q[0] + q[2] / 2) / d, r.top + (q[1] + q[2] / 2) / d] : null; },
    // for the browser tests: where the fraction f (the middle by default) of piece i's side of the polygon lies on the screen
    sideSpot: (i, f = 0.5) => {
      if (!fence || !shown || !fence.seg[i]) return null;
      const sg = fence.seg[i], r = loopCanvas.getBoundingClientRect(), d = loopCanvas.width / r.width;
      const q = G.polar(fence, sg[0][0] + (sg[1][0] - sg[0][0]) * f, sg[0][1] + (sg[1][1] - sg[0][1]) * f), p = stageMap(loopCanvas.width, loopCanvas.height).at(q[0], q[1]);
      return [r.left + p[0] / d, r.top + p[1] / d];
    },
    // for the browser tests: the polygon's arrow of piece i, doubled, y upwards
    arrowAt: (i) => (fence && n !== GIANT && fence.arrows[i] ? fence.arrows[i].slice(0, 2) : null),
    // for the browser tests: where piece i's two attachment ticks are on the pieces canvas (its own pixels), and whether each is vertical
    tickSpots: (i) => {
      const q = slots[i], p = pieces[i];
      if (!q || !p) return null;
      const dpr = pc.width / pc.getBoundingClientRect().width, f = fitShape(p.cells, q[0], q[1], q[2], q[2], tileFill(q[2], dpr), tileExt);
      return { u: f.u, slot: q.slice(), ends: p.pairs[0].map((m) => [f.sx(m[0] / 2 + 0.5), f.sy(m[1] / 2 + 0.5), Math.abs(m[0]) % 2 === 1]) };
    },
    // for the browser tests: where the middle of the k-th cell of piece i, and the corner j of the polygon, lie on the screen
    cellSpot: (i, k, dx = 0, dy = 0) => {
      if (!fenceCells || !fenceCells.sq[i] || !fenceCells.sq[i][k]) return null;
      const c = fenceCells.sq[i][k], r = loopCanvas.getBoundingClientRect(), d = loopCanvas.width / r.width;
      const q = G.polar(fence, c[0] + 0.5 + dx, c[1] + 0.5 + dy), p = stageMap(loopCanvas.width, loopCanvas.height).at(q[0], q[1]);
      return [r.left + p[0] / d, r.top + p[1] / d];
    },
    cornerSpot: (j) => {
      if (!fence || !fence.seg[j]) return null;
      const r = loopCanvas.getBoundingClientRect(), d = loopCanvas.width / r.width, c = fence.seg[j][0];
      const q = G.polar(fence, c[0], c[1]), p = stageMap(loopCanvas.width, loopCanvas.height).at(q[0], q[1]);
      return [r.left + p[0] / d, r.top + p[1] / d];
    },
    // for the browser tests: a point of the pieces canvas that lies in no tile's slot, or null
    freeSpot: () => {
      const r = pc.getBoundingClientRect(), d = pc.width / r.width;
      for (let y = 2; y < r.height; y += 4) for (let x = 2; x < r.width; x += 4) {
        if (!slots.some(([sx, sy, q]) => x * d >= sx && x * d < sx + q && y * d >= sy && y * d < sy + q)) return [r.left + x, r.top + y];
      }
      return null;
    },
    pieceAt: (i) => pieces[i] ? { cells: pieces[i].cells, pair: pieces[i].pairs[0], color: pieces[i].color, corner: pieces[i].corner } : null,
    busy: () => anim !== null,
    areaRatio500: () => areaRatio(DATA.dev500),
  };
})();

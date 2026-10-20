/* Fence Challenge · limit-shape lab.
 * The pieces of n cells, each with its longest arrow between boundary-edge
 * midpoints, against a circle, with a loupe that magnifies the gap. For
 * n = 4..6 every piece is computed here: the arrows are folded into 0..45
 * degrees, sorted by direction, chained, and copied eight times into a loop,
 * the loop against the circle of radius R = X + Y. For n = 7..15 the shape is
 * the paper's greedy fence (Section 6.2): its reference polygon, each piece
 * once, drawn exactly from the distinct arrows of data/greedy.js, against the
 * circle of its bounding box. At 500 cells the loop is the paper's curve, from
 * its 13.5 million random 500-ominoes, shown at ×1 on arrival, and the lab's
 * own chain keeps drawing 500-ominoes in the pieces box. */
(function () {
  "use strict";
  const S = window.LimitSampler, G = window.LimitPolygon, DATA = window.LIMIT_DATA, CHIPS = window.LIMIT_CHIPS, GREEDY = window.LIMIT_GREEDY;
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
  const FIRST_FENCE = 7, LAST_FENCE = 15;   // the greedy fences of Section 6.2
  // The paper's fences for n = 5..8: the optimum where it is proved, otherwise
  // the best fence found and the upper bound (dynamic programming). From 9 on,
  // the greedy fence and the upper bound of Table 4 come with the polygon.
  const FENCES = {
    5: { opt: 128 }, 6: { opt: 1597 },
    7: { best: 19733, bound: 19830 }, 8: { best: 279134, bound: 280389 },
  };
  const SIDE_STEP = 0.1;    // degrees between two points drawn on a side of the polygon
  const PICK_RADIUS = 16;   // css pixels: how near a tap must be to an arrow's dot
  // The paper's area estimate for the 500-omino fence, each piece once, as printed (log10 of 2.0e603).
  const AREA500_LOG10 = 603 + Math.log10(2.0);
  // The random 500-ominoes behind the paper's loop.
  const PAPER500 = 13.5e6;
  const LOUPE_GAP = 0.6;   // the loupe never stretches the largest gap past this

  let n = 4, pieces = [], chain = null, loupeV = 0, loupe = 1, sel = -1;
  let fence = null, selKind = -1, kindSpots = [];   // n = 7..15: the greedy polygon, the chosen kind of arrow, its dots
  let giant = null, giantSamples = 0, giantDrawn = 0, openChip = null;
  let shown = null, anim = null, requestId = 0, tiles = false;

  // ---------- the work: a worker when possible, the page otherwise ----------
  let worker = null;
  try { worker = new Worker("worker.js?v=20261020a"); } catch (e) { worker = null; }
  const waiting = new Map();
  if (worker) {
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "pieces" && waiting.has(m.id)) { waiting.get(m.id)(m.pieces); waiting.delete(m.id); }
      else if (m.type === "giant") onGiant(m);
    };
    worker.onerror = () => { worker = null; };
  }
  function computePieces(k) {
    return new Promise((resolve) => {
      if (worker) {
        const id = ++requestId;
        waiting.set(id, resolve);
        worker.postMessage({ cmd: "pieces", n: k, id });
      } else {
        resolve(S.enumerateFree(k).map((cells) => ({ cells, pairs: S.diameters(cells).pairs, vecs: S.sampleVectors(cells) })));
      }
    });
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
  async function setN(k) {
    if (!STEPS.includes(k)) return;
    const from = n;
    n = k;
    sel = -1; selKind = -1;
    $("lab").dataset.n = String(k);
    $("n-value").textContent = String(k);
    const pill = $("n-pill");
    pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump");
    if (k === GIANT) {
      pieces = []; fence = null;
      chain = { R: 1, pts: DATA.dev500, edges: null };
      giantDrawn = 0;
      // Arriving at 500 cells: the loupe back at ×1, where the loop lies on its circle.
      if (from !== GIANT) loupeV = 0;
      runGiant(true);
    } else if (k >= FIRST_FENCE) {
      // The paper's greedy fence: one exact polygon, each piece once; no piece to compute here.
      runGiant(false);
      pieces = [];
      fence = G.build(GREEDY[k]);
      chain = { R: fence.R, pts: null, edges: null, vecs: G.folded(fence) };
    } else {
      runGiant(false);
      const want = k;
      const raw = await computePieces(k);
      if (n !== want) return;
      fence = null;
      pieces = orderPieces(k, raw);
      chain = chainOf(pieces);
    }
    // The loop's canvas says what it shows: a loop of sorted arrows, or the greedy fence's polygon.
    loopCanvas.dataset.i18nAriaLabel = fence && k !== GIANT ? "ls.fence" : "ls.loop";
    loopCanvas.setAttribute("aria-label", t(loopCanvas.dataset.i18nAriaLabel));
    syncControls();
    syncLoupe();
    morphTo(loopPolar());
    drawPieces();
    caption();
    syncChips();
    syncSource();
    if (openChip) window.mathChip.refresh();
    status(k === GIANT ? t("ls.s.giant") : t("ls.s.n", { n: k, count: fmtNum(pieceCount(), 0), g: fmtPct(maxGap()) }));
    // The pill and the gap change width with n: centre them again.
    centreReadout();
  }
  function orderPieces(k, raw) {
    if (k !== 4) return raw.map((p, i) => Object.assign({}, p, { color: COLORS[i % COLORS.length] }));
    // The hub's five tetrominoes, in its order and colours.
    const byKey = new Map(raw.map((p) => [S.canonical(p.cells).key, p]));
    return TETRO.map((h) => {
      const p = byKey.get(S.canonical(h.cells).key);
      const cells = h.cells.map((c) => c.slice());
      return { cells, pairs: S.diameters(cells).pairs, vecs: p.vecs, color: h.color };
    });
  }

  // Sorted, weighted vectors chained from (0, 0); each edge remembers its piece.
  function chainOf(list) {
    const v = [];
    list.forEach((p, pi) => p.vecs.forEach((w) => v.push([w[0], w[1], w[2], pi])));
    v.sort((a, b) => a[1] * b[0] - b[1] * a[0]);
    const ch = S.chainDeviation(v);
    return { R: ch.R, X: ch.X, Y: ch.Y, pts: ch.pts, edges: v.map((w) => w[3]), vecs: v };
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
    drawLoop(true);
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
    const from = shown || to;
    const t0 = performance.now(), dur = REDUCED ? 0 : 420;
    cancelAnimationFrame(anim);
    const tick = (now) => {
      const f = dur ? Math.min(1, (now - t0) / dur) : 1, e = f * f * (3 - 2 * f);
      const mid = new Float64Array(720);
      for (let i = 0; i < 720; i++) mid[i] = from[i] + (to[i] - from[i]) * e;
      shown = mid;
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
  function drawLoop(exact) {
    const { w, h, dpr } = fitCanvas(loopCanvas);
    const ctx = lctx;
    ctx.clearRect(0, 0, w, h);
    if (!shown) return;
    const box = loopBox(w, h, dpr);
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    let peak = 0;
    for (let i = 0; i < 720; i++) peak = Math.max(peak, loupe * shown[i]);
    if (fence) peak = Math.max(peak, loupe * fence.gap.max);   // the corners are sharper than 720 directions
    const R = (Math.min(box.w, box.h) * 0.42) / (1 + Math.max(0, peak));
    const at = (th, d) => {
      const r = R * (1 + loupe * d), a = th * Math.PI / 180;
      return [cx + r * Math.sin(a), cy + r * Math.cos(a)];
    };
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
    if (exact && fence) drawFence(ctx, at, dpr);
    else if (exact && chain && chain.edges) drawEdges(ctx, at, dpr);
    else {
      ctx.save();
      ctx.shadowColor = "rgba(47, 243, 255, 0.7)"; ctx.shadowBlur = 10 * dpr;
      ctx.strokeStyle = "#2ff3ff"; ctx.lineWidth = 2.4 * dpr; ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }
  }
  // The edges of the loop: in the colour of their piece while each stays
  // readable, cyan otherwise; the chosen piece lit in white.
  function drawEdges(ctx, at, dpr) {
    const pts = chain.pts, edges = chain.edges, coloured = pieces.length <= 35;
    const seg = (k, i) => {
      const a = pts[i], b = pts[i + 1];
      if (k % 2 === 0) return [at(k * 45 + a[0], a[1]), at(k * 45 + b[0], b[1])];
      return [at(k * 45 + 45 - a[0], a[1]), at(k * 45 + 45 - b[0], b[1])];
    };
    ctx.save();
    ctx.lineCap = "round";
    if (!coloured) {
      ctx.globalAlpha = sel >= 0 ? 0.5 : 1;
      ctx.shadowColor = "rgba(47, 243, 255, 0.7)"; ctx.shadowBlur = 10 * dpr;
      ctx.strokeStyle = "#2ff3ff"; ctx.lineWidth = 2.4 * dpr; ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < 720; i++) { const p = at(i / 2, shown[i]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.lineWidth = 3 * dpr;
      for (let k = 0; k < 8; k++) {
        for (let i = 0; i < edges.length; i++) {
          const [p, q] = seg(k, i);
          ctx.strokeStyle = pieces[edges[i]].color;
          ctx.globalAlpha = sel >= 0 && edges[i] !== sel ? 0.5 : 1;
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
      }
    }
    if (sel >= 0) {
      ctx.globalAlpha = 1;
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)"; ctx.shadowBlur = 12 * dpr;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4.5 * dpr;
      for (let k = 0; k < 8; k++) {
        for (let i = 0; i < edges.length; i++) {
          if (edges[i] !== sel) continue;
          const [p, q] = seg(k, i);
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // The greedy fence, exactly: each side is traced from the polygon's own corners, point by point in the
  // plane, so that the corners stay sharp under the loupe and a straight side bends only as the loupe says.
  // The places of the chosen arrow are lit in white; the true corners are dots, the four corner pieces
  // wear a ring.
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
  function drawFence(ctx, at, dpr) {
    const C = fence.corners, N = C.length;
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
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
    ctx.restore();
    // The true corners as dots, thinned where they crowd: the loupe pulls them apart.
    ctx.save();
    ctx.fillStyle = "rgba(255, 212, 59, 0.85)";
    let last = null;
    for (let j = 0; j < N; j++) {
      const q = G.polar(fence, C[j][0], C[j][1]), p = at(q[0], q[1]);
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 4 * dpr) continue;
      last = p;
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const kc = chain.vecs.find((v) => v[3]);
    if (kc) {
      ctx.save();
      ctx.strokeStyle = "#ff5fb3"; ctx.lineWidth = 1.6 * dpr;
      for (const [a, b] of G.placesOf(fence, kc[0], kc[1])) {
        const q = G.polar(fence, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), p = at(q[0], q[1]);
        ctx.beginPath(); ctx.arc(p[0], p[1], 6 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    if (selKind >= 0) {
      const k = chain.vecs[selKind];
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)"; ctx.shadowBlur = 12 * dpr;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4.5 * dpr;
      for (const [a, b] of G.placesOf(fence, k[0], k[1])) {
        const pts = [];
        sideTrace(a, b, at, pts, false);
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------- the pieces: tiles, or the fan of all arrows ----------
  const pc = $("pieces"), pctx = pc.getContext("2d");
  let slots = [];
  function pieceCount() { return fence ? fence.count : pieces.length; }
  function drawPieces() {
    const { w, h, dpr } = fitCanvas(pc);
    pctx.clearRect(0, 0, w, h);
    slots = []; kindSpots = [];
    tiles = false;
    if (n === GIANT) {
      if (giant) drawShape(giant.cells, giant.pairs, "#7f83ff", 0, 0, w, h, 0.94, dpr, false, false);
      syncPieceAccess();
      return;
    }
    if (fence) {
      drawKinds(w, h, dpr);
      syncPieceAccess();
      return;
    }
    const N = pieces.length;
    if (!N) return;
    // The grid whose square slots are largest.
    let cols = 1, s = 0;
    for (let c = 1; c <= N; c++) {
      const size = Math.min(w / c, h / Math.ceil(N / c));
      if (size > s) { s = size; cols = c; }
    }
    if (s >= 24 * dpr) {
      tiles = true;
      const rows = Math.ceil(N / cols);
      const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2;
      pieces.forEach((p, i) => {
        const x = ox + (i % cols) * s, y = oy + Math.floor(i / cols) * s;
        slots.push([x, y, s]);
        drawShape(p.cells, p.pairs, p.color, x, y, s, s, 0.66, dpr, i === sel, true);
      });
    } else drawFan(w, h, dpr);
    syncPieceAccess();
  }
  // Every folded arrow from one corner, in its piece's colour, as faint as its
  // share: exactly what the loop is built from.
  function drawFan(w, h, dpr) {
    const ctx = pctx, pad = 14 * dpr;
    let L = 0;
    for (const v of chain.vecs) L = Math.max(L, Math.hypot(v[0], v[1]));
    const size = Math.min(w - 2 * pad, (h - 2 * pad) / Math.sin(Math.PI / 4) * 0.98);
    const u = size / L, ox = pad + (w - 2 * pad - size) / 2, oy = h - pad - (h - 2 * pad - size * Math.sin(Math.PI / 4)) / 2;
    ctx.save();
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeStyle = "rgba(216, 246, 255, 0.28)"; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + size, oy);
    ctx.moveTo(ox, oy); ctx.lineTo(ox + size * Math.SQRT1_2, oy - size * Math.SQRT1_2); ctx.stroke();
    ctx.setLineDash([]);
    const a = Math.min(0.9, Math.max(0.14, 160 / chain.vecs.length));
    ctx.lineWidth = Math.max(1, 1.2 * dpr);
    for (const v of chain.vecs) {
      ctx.globalAlpha = a * Math.max(0.35, v[2]);
      ctx.strokeStyle = pieces[v[3]].color;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + v[0] * u, oy - v[1] * u); ctx.stroke();
    }
    ctx.restore();
  }
  // The kinds of arrows of a fence, folded to 0..45 degrees and drawn from one point: a dot at each tip,
  // bigger and brighter the more pieces share the arrow, the corner pieces' arrow apart. The polygon is
  // exactly these arrows, end to end.
  function drawKinds(w, h, dpr) {
    const ctx = pctx, pad = 14 * dpr, K = chain.vecs;
    let L = 0, top = 1;
    for (const v of K) { L = Math.max(L, Math.hypot(v[0], v[1])); top = Math.max(top, v[2]); }
    const size = Math.min(w - 2 * pad, (h - 2 * pad) / Math.sin(Math.PI / 4) * 0.98);
    const u = size / L, ox = pad + (w - 2 * pad - size) / 2, oy = h - pad - (h - 2 * pad - size * Math.sin(Math.PI / 4)) / 2;
    ctx.save();
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeStyle = "rgba(216, 246, 255, 0.28)"; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + size, oy);
    ctx.moveTo(ox, oy); ctx.lineTo(ox + size * Math.SQRT1_2, oy - size * Math.SQRT1_2); ctx.stroke();
    ctx.setLineDash([]);
    const lit = (m) => Math.log(1 + m) / Math.log(1 + top);
    ctx.lineWidth = 1 * dpr;
    K.forEach((v, i) => {
      ctx.strokeStyle = "rgba(216, 246, 255, " + (i === selKind ? 0.5 : 0.07) + ")";
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + v[0] * u, oy - v[1] * u); ctx.stroke();
    });
    K.forEach((v, i) => {
      const x = ox + v[0] * u, y = oy - v[1] * u, r = (1.8 + 3.6 * Math.sqrt(v[2] / top)) * dpr;
      kindSpots.push([x, y, i]);
      ctx.globalAlpha = i === selKind ? 1 : 0.35 + 0.65 * lit(v[2]);
      ctx.fillStyle = i === selKind ? "#ffffff" : v[3] ? "#ff5fb3" : "#2de2d5";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (i === selKind) {
        ctx.globalAlpha = 1; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(x, y, r + 4 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.restore();
  }
  function nearestKind(x, y, radius) {
    let best = -1, d = radius;
    for (const [sx, sy, i] of kindSpots) {
      const e = Math.hypot(sx - x, sy - y);
      if (e <= d) { d = e; best = i; }
    }
    return best;
  }
  function pickKind(i) {
    if (!fence || n === GIANT || !chain.vecs[i]) return;
    selKind = selKind === i ? -1 : i;
    drawPieces();
    drawLoop(true);
    caption();
    if (selKind >= 0) {
      const k = chain.vecs[selKind];
      status(t(k[3] ? "ls.s.cornerArrow" : "ls.s.kind", { pair: t("ls.pair", { x: fmtHalf(k[0]), y: fmtHalf(k[1]) }), m: fmtNum(k[2], 0), k: G.placesOf(fence, k[0], k[1]).length }));
    }
  }
  function syncPieceAccess() {
    const kinds = !!fence && n !== GIANT;
    pc.style.cursor = tiles || kinds ? "pointer" : "default";
    if (tiles || kinds) pc.setAttribute("tabindex", "0"); else pc.removeAttribute("tabindex");
    const label = n === GIANT ? t("ls.giantAria") : kinds ? t("ls.kinds", { kinds: fmtNum(chain.vecs.length, 0), count: fmtNum(fence.count, 0), n })
      : tiles ? t("ls.pieces", { count: fmtNum(pieces.length, 0), n }) : t("ls.fan", { count: fmtNum(pieces.length, 0), n });
    pc.setAttribute("aria-label", label);
    // The canvas explains itself through its box (the bubbles skip canvases).
    pc.parentElement.setAttribute("data-lab-tip", n === GIANT ? t(REDUCED ? "ls.tipGiantStill" : "ls.tipGiant") : kinds ? t("ls.tipKinds") : tiles ? t("ls.tipTiles") : t("ls.tipFan"));
  }
  // One piece, fitted into a box, with its longest arrows.
  function drawShape(cells, pairs, color, x, y, bw, bh, fill, dpr, chosen, tile) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [cx, cy] of cells) { minX = Math.min(minX, cx); maxX = Math.max(maxX, cx + 1); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy + 1); }
    const u = Math.min(bw, bh) * fill / Math.max(maxX - minX, maxY - minY);
    const X0 = x + bw / 2 - ((minX + maxX) / 2) * u, Y0 = y + bh / 2 - ((minY + maxY) / 2) * u;
    // Rows grow downwards, as on the hub's boards.
    const sx = (gx) => X0 + gx * u, sy = (gy) => Y0 + gy * u;
    const ctx = pctx;
    // Each piece on its own tile, as in the labs' trays.
    if (tile) {
      const g = Math.max(1.5 * dpr, Math.min(3 * dpr, bw * 0.05)), rr = Math.min(10 * dpr, bw * 0.2);
      ctx.save();
      roundRect(ctx, x + g, y + g, bw - 2 * g, bh - 2 * g, rr);
      ctx.fillStyle = chosen ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.035)";
      ctx.fill();
      if (chosen) { ctx.shadowColor = "rgba(255, 255, 255, 0.25)"; ctx.shadowBlur = 14 * dpr; }
      ctx.strokeStyle = chosen ? "#ffffff" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = (chosen ? 1.5 : 1) * dpr;
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
    // The longest arrows, from midpoint to midpoint (doubled coordinates).
    const lw = Math.max(1.2 * dpr, Math.min(2.6 * dpr, u * 0.1));
    ctx.shadowColor = "rgba(47, 243, 255, 0.85)"; ctx.shadowBlur = Math.min(6 * dpr, lw * 2.5);
    ctx.strokeStyle = "#2ff3ff"; ctx.fillStyle = "#2ff3ff";
    ctx.lineWidth = lw;
    for (const [p, q] of pairs) {
      const ax = sx(p[0] / 2 + 0.5), ay = sy(p[1] / 2 + 0.5), bx = sx(q[0] / 2 + 0.5), by = sy(q[1] / 2 + 0.5);
      const ang = Math.atan2(by - ay, bx - ax), head = Math.max(4 * dpr, lw * 3.2);
      const ex = bx - Math.cos(ang) * head * 0.6, ey = by - Math.sin(ang) * head * 0.6;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(ang - 0.45) * head, by - Math.sin(ang - 0.45) * head);
      ctx.lineTo(bx - Math.cos(ang + 0.45) * head, by - Math.sin(ang + 0.45) * head);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function pick(i) {
    sel = sel === i ? -1 : i;
    drawPieces();
    drawLoop(true);
    if (sel >= 0) status(t("ls.s.pick", { i: sel + 1 }));
  }
  pc.addEventListener("click", (e) => {
    const r = pc.getBoundingClientRect(), dpr = pc.width / r.width;
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    if (fence && n !== GIANT) {
      // A tap near a dot chooses that arrow; a tap elsewhere lets go of the chosen one.
      const i = nearestKind(x, y, PICK_RADIUS * dpr);
      if (i >= 0) pickKind(i); else if (selKind >= 0) pickKind(selKind);
      return;
    }
    if (!tiles) return;
    const i = slots.findIndex(([sx, sy, s]) => x >= sx && x < sx + s && y >= sy && y < sy + s);
    if (i >= 0) pick(i);
  });
  pc.addEventListener("keydown", (e) => {
    if (fence && n !== GIANT) {
      const K = chain.vecs.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pickKind(selKind < 0 ? 0 : (selKind + 1) % K); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pickKind(selKind < 0 ? K - 1 : (selKind - 1 + K) % K); }
      else if (e.key === "Escape" && selKind >= 0) pickKind(selKind);
      return;
    }
    if (!tiles || !pieces.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pick((sel + 1 + pieces.length) % pieces.length); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pick((sel - 1 + pieces.length) % pieces.length); }
    else if (e.key === "Escape" && sel >= 0) pick(sel);
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
  function caption() {
    const c = $("caption");
    if (n === GIANT) {
      c.innerHTML = DICE + `<span>${fmtNum(giantSamples, 0)}</span><span class="visually-hidden">${t("ls.samples", { s: fmtNum(giantSamples, 0) })}</span>`;
    } else if (fence && selKind >= 0) {
      // The chosen arrow and the number of pieces that share it.
      const k = chain.vecs[selKind];
      c.textContent = t("ls.pair", { x: fmtHalf(k[0]), y: fmtHalf(k[1]) }) + " · " + fmtNum(k[2], 0);
    } else c.textContent = t("ls.count", { count: fmtNum(pieceCount(), 0) });
    if (n === GIANT) c.setAttribute("data-lab-tip", t(REDUCED ? "ls.tipSamplesStill" : "ls.tipSamples")); else c.removeAttribute("data-lab-tip");
    $("gap-value").textContent = fmtPct(maxGap());
    // « loop » only where there is a loop
    const poly = !!fence && n !== GIANT;
    $("gap-tok").dataset.i18nTitle = poly ? "ls.gapPoly" : "ls.gap";
    $("gap-tok").setAttribute("data-lab-tip", t(poly ? "ls.gapPoly" : "ls.gap"));
    $("gap-label").dataset.i18n = poly ? "ls.gapPoly" : "ls.gapLabel";
    $("gap-label").textContent = t(poly ? "ls.gapPoly" : "ls.gapLabel");
  }
  // At 500 cells, the paper's sample behind the loop, in the corner of the stage.
  function syncSource() {
    $("src-tag").hidden = n !== GIANT;
    $("src-tag").title = t(REDUCED ? "ls.srcStill" : "ls.src");
    $("src-count").textContent = t("ls.srcCount", { m: fmtNum(PAPER500 / 1e6, 1) });
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
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key === "+" || e.key === "=") step(1);
    else if (e.key === "-" || e.key === "_") step(-1);
    else if (e.key === "[" || e.key === "]") setLoupe(Math.max(0, Math.min(100, loupeV + (e.key === "]" ? 10 : -10))));
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
    else if (fence) { want.add("count"); want.add("arrow"); want.add("polygon"); }
    else { want.add("count"); want.add("arrow"); want.add("loop"); }
    document.querySelectorAll(".math-chip").forEach((b) => {
      b.hidden = !want.has(b.dataset.chip);
    });
    if (openChip && !want.has(openChip)) closeCard();
  }
  function live(id) {
    const tag = (s, k) => `<span class="live">${s} · ${t(k || "ls.live.computed")}</span>`;
    const N0 = (x) => fmtNum(Math.round(x), 0);
    if (id === "count" && n !== GIANT) return tag(`<i>n</i> = ${n}: ${N0(pieceCount())}`, fence ? "ls.live.paper" : null);
    if (id === "polygon" && fence) {
      // A = A_ref + the corrections (Lemma on the area decomposition): the polygon's area is computed
      // here from its arrows, the greedy fence and the bounds are the paper's, the corrections follow.
      const f1 = (x) => fmtNum(x, x % 1 ? 1 : 0), fz = FENCES[n];
      let s = `<span class="f">${t("ls.live.ref")} = ${f1(fence.area)}</span> · ${t("ls.live.computed")}`;
      s += `<br><span class="f">${t("ls.live.greedy")} = ${N0(fence.L)}</span> · ${t("ls.live.paper")}`;
      s += `<br><span class="f">${t("ls.live.corr")} = ${MINUS}${f1(fence.area - fence.L)}</span> · ${t("ls.live.computed")}`;
      if (fz && fz.best) s += `<br>${t("ls.live.fence", { f: t("ls.live.best", { b: N0(fz.best), u: N0(fz.bound) }) })}`;
      else s += `<br>${t("ls.live.upper", { u: N0(fence.U), g: fmtNum(100 * (fence.U - fence.L) / fence.L, 3) })}`;
      return `<span class="live">${s}</span>`;
    }
    if (id === "loop" && chain && n !== GIANT) {
      // Exact area of the loop of this n, shrunk by 8 (a factor 64 in area).
      let s = 0;
      const p = chain.pts;
      for (let i = 0; i + 1 < p.length; i++) s += 0.5 * (1 + p[i][1]) * (1 + p[i + 1][1]) * Math.sin((p[i + 1][0] - p[i][0]) * Math.PI / 180);
      const est = (8 * s * chain.R * chain.R) / 64;
      const fz = FENCES[n];
      let paper = "";
      if (fz && fz.opt) paper = `<br>${t("ls.live.fence", { f: t("ls.live.opt", { o: N0(fz.opt) }) })}`;
      else if (fz) paper = `<br>${t("ls.live.fence", { f: t("ls.live.best", { b: N0(fz.best), u: N0(fz.bound) }) })}`;
      return `<span class="live"><span class="f">${t("ls.live.loop")} ≈ ${N0(est)}</span> · ${t("ls.live.computed")}${paper}</span>`;
    }
    if (id === "gap" && fence) {
      // The whole polygon, and the sector of the paper's deviation figure (the south to the south-east).
      const r = G.range(fence, 0, 45);
      return `<span class="live"><span class="f"><i>n</i> = ${n}: ${fmtPct(maxGap(), 2)}</span> · ${t("ls.live.whole")} · ${t("ls.live.computed")}` +
        `<br><span class="f">${fmtPct(r.min, 2)} … ${fmtPct(r.max, 2)}</span> · ${t("ls.live.sector")} · ${t("ls.live.computed")}</span>`;
    }
    if (id === "gap") return tag(`<i>n</i> = ${n}: ${fmtPct(maxGap())}`, n === GIANT ? "ls.live.paper" : null);
    if (id === "sample") return tag(t("ls.samples", { s: N0(giantSamples) }));
    if (id === "giant") return tag(`≈ ${fmtSci(AREA500_LOG10)}`, "ls.live.paper");
    return "";
  }
  // The card itself is the shared math-chip card; this lab provides its texts.
  window.mathChip = window.mathChip || {};
  window.mathChip.provide = (chip) => {
    const id = chip.dataset.chip, c = CHIPS[fence && n !== GIANT && (id === "gap" || id === "arrow") ? id + "Fence" : id];
    if (!c) return null;
    const l = lang();
    return { title: t("ls.chip." + id), lead: c.lead[l], body: c.detail[l] + live(id), src: c.section[l],
      data: { label: c.label, lines: c.lines, chip: id } };
  };
  function closeCard() { if (window.mathChip.close) window.mathChip.close(false); }
  document.addEventListener("math-chip-open", (e) => { openChip = e.detail.dataset.chip || null; });
  document.addEventListener("math-chip-close", () => { openChip = null; });

  // ---------- language and size ----------
  document.querySelectorAll("[data-lang-btn]").forEach((b) => b.addEventListener("click", () => window.i18n.setLang(b.dataset.langBtn)));
  document.addEventListener("fc-langchange", () => {
    syncControls(); caption(); syncChips(); syncSource(); syncLoupe(); syncPieceAccess();
    centreReadout();
  });
  new ResizeObserver(() => { drawLoop(true); drawPieces(); centreReadout(); }).observe(loopCanvas);
  new ResizeObserver(() => drawPieces()).observe(pc);
  window.addEventListener("resize", centreReadout);

  syncLoupe();
  // A link may open the lab on a size of its own: .../limit-shape-lab/?n=11
  const asked = +new URLSearchParams(location.search).get("n");
  setN(STEPS.includes(asked) ? asked : 4);

  // For tests and figure export.
  window.limitLab = {
    state: () => ({ n, pieces: pieceCount(), loupe, loupeV, maxLoupe: maxLoupe(), sel, tiles, gap: maxGap(), R: chain && chain.R, X: chain && chain.X, Y: chain && chain.Y, samples: giantSamples, source: !$("src-tag").hidden, chips: [...document.querySelectorAll(".math-chip")].filter((b) => !b.hidden).map((b) => b.dataset.chip),
      fence: !!fence && n !== GIANT, kinds: fence && n !== GIANT ? chain.vecs.length : 0, corners: fence && n !== GIANT ? fence.corners.length : 0, selKind, area: fence && n !== GIANT ? fence.area : 0 }),
    setN, setLoupe, pick, pickKind,
    kindAt: (i) => chain && chain.vecs ? chain.vecs[i] : null,
    // where a kind's dot sits on the screen, for the browser tests
    spot: (i) => { const r = pc.getBoundingClientRect(), d = pc.width / r.width, s = kindSpots.find((q) => q[2] === i); return s ? [r.left + s[0] / d, r.top + s[1] / d] : null; },
    vectors: () => pieces.map((p) => p.vecs),
    busy: () => anim !== null,
    areaRatio500: () => areaRatio(DATA.dev500),
  };
})();

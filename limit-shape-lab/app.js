/* Fence Challenge · limit-shape lab.
 * The pieces of n cells, each with its longest arrow between boundary-edge
 * midpoints; the arrows folded into 0..45 degrees, sorted by direction,
 * chained, and copied eight times into a loop; the loop against the circle
 * of radius R = X + Y; a loupe that magnifies the gap. For n = 4..10 every
 * piece is computed here; at 500 cells the loop is the paper's curve, and a
 * random 500-omino keeps changing in the pieces box. */
(function () {
  "use strict";
  const S = window.LimitSampler, DATA = window.LIMIT_DATA, CHIPS = window.LIMIT_CHIPS;
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
  const STEPS = [4, 5, 6, 7, 8, 9, 10, 500];
  const GIANT = 500;
  // The paper's fences for each n: the optimum where it is proved, otherwise
  // the best fence found and the upper bound.
  const FENCES = {
    5: { opt: 128 }, 6: { opt: 1597 },
    7: { best: 19733, bound: 19830 }, 8: { best: 279134, bound: 280389 },
    9: { best: 4003811, bound: 4052974 }, 10: { best: 60832848, bound: 61484424 },
  };
  // The run behind the paper's curve at 500 cells: its chain ends at
  // X + Y = 4.46826e8 after 4.5e6 vectors; there are about 1.9994e300 500-ominoes.
  const RUN500 = { R: 4.46826e8, N: 4.5e6, A: 1.9994e300 };
  const LOUPE_GAP = 0.6;   // the loupe never stretches the largest gap past this

  let n = 4, pieces = [], chain = null, loupeV = 0, loupe = 1, sel = -1;
  let giant = null, giantSamples = 0, giantDrawn = 0, openChip = null, chipOpener = null;
  let shown = null, anim = null, requestId = 0, loupeAnim = null, tiles = false;

  // ---------- the work: a worker when possible, the page otherwise ----------
  let worker = null;
  try { worker = new Worker("worker.js?v=20261007f"); } catch (e) { worker = null; }
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
    if (openChip === "sample") openCard("sample");
  }

  // ---------- choosing n ----------
  async function setN(k) {
    const from = n;
    n = k;
    sel = -1;
    $("lab").dataset.n = String(k);
    $("n-value").textContent = String(k);
    const pill = $("n-pill");
    pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump");
    if (k === GIANT) {
      pieces = [];
      chain = { R: 1, pts: DATA.dev500, edges: null };
      giantDrawn = 0;
      runGiant(true);
    } else {
      runGiant(false);
      const want = k;
      const raw = await computePieces(k);
      if (n !== want) return;
      pieces = orderPieces(k, raw);
      chain = chainOf(pieces);
    }
    syncControls();
    syncLoupe();
    morphTo(loopPolar());
    drawPieces();
    caption();
    syncChips();
    if (openChip) openCard(openChip);
    status(k === GIANT ? t("ls.s.giant") : t("ls.s.n", { n: k, count: pieces.length, g: fmtPct(maxGap()) }));
    if (k === GIANT && from !== GIANT && from !== null) sweepLoupe();
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
  function vFor(L) { const m = maxLoupe(); return m > 1 ? Math.max(0, Math.min(100, 100 * Math.log(L) / Math.log(m))) : 0; }
  function syncLoupe() {
    loupe = loupeAt(loupeV);
    const k = loupe < 10 ? Math.round(loupe * 10) / 10 : Math.round(loupe);
    $("loupe-x").textContent = "×" + fmtNum(k, k < 10 && k % 1 ? 1 : 0);
    $("loupe").value = String(Math.round(loupeV));
    $("loupe").setAttribute("aria-valuetext", t("ls.loupeAria", { k: fmtNum(k, k < 10 && k % 1 ? 1 : 0) }));
  }
  function setLoupe(v) {
    loupeV = v;
    syncLoupe();
    drawLoop(true);
  }
  // Arriving at 500 cells: the loupe opens all the way once, then rests near ×40.
  function sweepLoupe() {
    cancelAnimationFrame(loupeAnim);
    const rest = vFor(40);
    if (REDUCED) { setLoupe(rest); return; }
    const start = loupeV, t0 = performance.now();
    const step = (now) => {
      const f = (now - t0) / 2200;
      let v;
      if (f < 0.55) { const e = f / 0.55; v = start + (100 - start) * e * e * (3 - 2 * e); }
      else if (f < 1) { const e = (f - 0.55) / 0.45; v = 100 + (rest - 100) * e * e * (3 - 2 * e); }
      else v = rest;
      setLoupe(v);
      if (f < 1 && n === GIANT) loupeAnim = requestAnimationFrame(step);
      else { loupeAnim = null; status(t("ls.s.loupe", { k: Math.round(loupe) })); }
    };
    loupeAnim = requestAnimationFrame(step);
  }
  $("loupe").addEventListener("input", (e) => { cancelAnimationFrame(loupeAnim); loupeAnim = null; setLoupe(+e.target.value); });
  $("loupe").addEventListener("change", () => status(t("ls.s.loupe", { k: Math.round(loupe) })));

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
  function loopPolar() { return chain ? octants(chain.pts) : []; }
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
  // The part of the stage the loop may use: beside or above an open card.
  function loopBox(w, h, dpr) {
    const card = $("card");
    if (card.hidden) return { x: 0, y: 0, w, h };
    const st = $("stage").getBoundingClientRect(), cr = card.getBoundingClientRect();
    const right = (cr.right - st.left) * dpr, top = (cr.top - st.top) * dpr;
    // Wide screens hold the card at the top left: the loop takes the rest of the width.
    if (window.innerWidth > 860 && window.innerHeight > 520) return { x: right, y: 0, w: w - right, h };
    return { x: 0, y: 0, w, h: Math.max(h * 0.3, top) };
  }
  function drawLoop(exact) {
    const { w, h, dpr } = fitCanvas(loopCanvas);
    const ctx = lctx;
    ctx.clearRect(0, 0, w, h);
    if (!shown) return;
    const box = loopBox(w, h, dpr);
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    let peak = 0;
    for (let i = 0; i < 720; i++) peak = Math.max(peak, loupe * shown[i]);
    const R = (Math.min(box.w, box.h) * 0.42) / (1 + Math.max(0, peak));
    const at = (th, d) => {
      const r = R * (1 + loupe * d), a = th * Math.PI / 180;
      return [cx + r * Math.sin(a), cy + r * Math.cos(a)];
    };
    // The circle, and its four points on the axes, where the gap is 0 by construction.
    ctx.save();
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.strokeStyle = "rgba(216, 246, 255, 0.42)";
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(216, 246, 255, 0.75)";
    for (let k = 0; k < 4; k++) {
      const p = at(k * 90, 0);
      ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // The loop's inside, faintly.
    ctx.beginPath();
    for (let i = 0; i < 720; i++) { const p = at(i / 2, shown[i]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
    ctx.fillStyle = "rgba(47, 243, 255, 0.07)";
    ctx.fill();
    if (exact && chain && chain.edges) drawEdges(ctx, at, dpr);
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

  // ---------- the pieces: tiles, or the fan of all arrows ----------
  const pc = $("pieces"), pctx = pc.getContext("2d");
  let slots = [];
  function drawPieces() {
    const { w, h, dpr } = fitCanvas(pc);
    pctx.clearRect(0, 0, w, h);
    slots = [];
    tiles = false;
    if (n === GIANT) {
      if (giant) drawShape(giant.cells, giant.pairs, "#7f83ff", 0, 0, w, h, 0.94, dpr, false, false);
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
  function syncPieceAccess() {
    pc.style.cursor = tiles ? "pointer" : "default";
    if (tiles) pc.setAttribute("tabindex", "0"); else pc.removeAttribute("tabindex");
    const label = n === GIANT ? t("ls.giantAria") : tiles ? t("ls.pieces", { count: fmtNum(pieces.length, 0), n }) : t("ls.fan", { count: fmtNum(pieces.length, 0), n });
    pc.setAttribute("aria-label", label);
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
    if (!tiles) return;
    const r = pc.getBoundingClientRect(), dpr = pc.width / r.width;
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    const i = slots.findIndex(([sx, sy, s]) => x >= sx && x < sx + s && y >= sy && y < sy + s);
    if (i >= 0) pick(i);
  });
  pc.addEventListener("keydown", (e) => {
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
  function fmtPct(d) {
    const s = fmtNum(Math.abs(d) * 100, n === GIANT ? 2 : 1);
    return (d < 0 ? MINUS : "+") + s + " %";
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
    } else c.textContent = t("ls.count", { count: fmtNum(pieces.length, 0) });
    $("gap-value").textContent = fmtPct(maxGap());
  }
  function syncControls() {
    const i = STEPS.indexOf(n);
    const fewer = $("fewer"), more = $("more");
    fewer.setAttribute("aria-disabled", i <= 0 ? "true" : "false");
    more.setAttribute("aria-disabled", i >= STEPS.length - 1 ? "true" : "false");
    fewer.classList.toggle("skip", n === GIANT);
    more.classList.toggle("skip", n === 10);
    const fk = n === GIANT ? "ls.fromGiant" : "ls.fewer", mk = n === 10 ? "ls.toGiant" : "ls.more";
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
    else if (e.key === "[" || e.key === "]") { cancelAnimationFrame(loupeAnim); setLoupe(Math.max(0, Math.min(100, loupeV + (e.key === "]" ? 10 : -10)))); }
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
    else { want.add("count"); want.add("arrow"); want.add("loop"); }
    document.querySelectorAll(".math-chip").forEach((b) => {
      b.hidden = !want.has(b.dataset.chip);
      b.setAttribute("aria-expanded", openChip === b.dataset.chip ? "true" : "false");
    });
    if (openChip && !want.has(openChip)) closeCard(false);
  }
  function live(id) {
    const tag = (s) => `<span class="live">${s} · ${t("ls.live.computed")}</span>`;
    const N0 = (x) => fmtNum(Math.round(x), 0);
    if (id === "count" && n !== GIANT) return tag(`<i>n</i> = ${n}: ${N0(pieces.length)}`);
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
    if (id === "gap") return tag(`<i>n</i> = ${n}: ${fmtPct(maxGap())}`);
    if (id === "sample") return tag(t("ls.samples", { s: N0(giantSamples) }));
    if (id === "giant") {
      // The paper's run: X + Y per vector, scaled to every 500-omino, each once (÷ 8).
      const ratio = areaRatio(DATA.dev500);
      const logR = Math.log10(RUN500.R / RUN500.N) + Math.log10(RUN500.A) - Math.log10(8);
      const logArea = Math.log10(ratio * Math.PI) + 2 * logR;
      return tag(`≈ ${fmtSci(logArea)}`);
    }
    return "";
  }
  function openCard(id, opener) {
    const c = CHIPS[id], l = lang(), card = $("card");
    $("card-lead").innerHTML = c.lead[l];
    $("card-body").innerHTML = c.detail[l] + live(id);
    $("card-section").textContent = c.section[l];
    card.dataset.label = c.label; card.dataset.lines = c.lines; card.dataset.chip = id;
    card.hidden = false;
    openChip = id;
    if (opener) chipOpener = opener;
    syncChips();
    drawLoop(true);
    if (opener) card.focus({ preventScroll: true });
  }
  function closeCard(returnFocus) {
    const card = $("card");
    if (card.hidden) return;
    card.hidden = true; openChip = null;
    syncChips();
    drawLoop(true);
    if (returnFocus && chipOpener && !chipOpener.hidden) chipOpener.focus({ preventScroll: true });
    chipOpener = null;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".math-chip");
    if (!b) return;
    e.stopPropagation();
    if (openChip === b.dataset.chip) closeCard(true); else openCard(b.dataset.chip, b);
  });
  // A tap elsewhere closes the card; the language switch keeps it open.
  document.addEventListener("pointerdown", (e) => {
    if ($("card").hidden) return;
    if (e.target.closest("#card, .math-chip, .langSel")) return;
    closeCard(false);
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("card").hidden) closeCard(true); });
  $("card-close").addEventListener("click", () => closeCard(true));

  // ---------- language and size ----------
  document.querySelectorAll("[data-lang-btn]").forEach((b) => b.addEventListener("click", () => window.i18n.setLang(b.dataset.langBtn)));
  document.addEventListener("fc-langchange", () => {
    syncControls(); caption(); syncChips(); syncLoupe(); syncPieceAccess();
    if (openChip) openCard(openChip);
    centreReadout();
  });
  new ResizeObserver(() => { drawLoop(true); drawPieces(); centreReadout(); }).observe(loopCanvas);
  new ResizeObserver(() => drawPieces()).observe(pc);
  window.addEventListener("resize", centreReadout);

  syncLoupe();
  setN(4).then(centreReadout);

  // For tests and figure export.
  window.limitLab = {
    state: () => ({ n, pieces: pieces.length, loupe, loupeV, maxLoupe: maxLoupe(), sel, tiles, gap: maxGap(), R: chain && chain.R, X: chain && chain.X, Y: chain && chain.Y, samples: giantSamples, chips: [...document.querySelectorAll(".math-chip")].filter((b) => !b.hidden).map((b) => b.dataset.chip) }),
    setN, setLoupe: (v) => { cancelAnimationFrame(loupeAnim); loupeAnim = null; setLoupe(v); }, pick,
    vectors: () => pieces.map((p) => p.vecs),
    busy: () => anim !== null || loupeAnim !== null,
    areaRatio500: () => areaRatio(DATA.dev500),
  };
})();

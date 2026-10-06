/* Hexomino lab: build a fence of the 35 hexominoes, then view it as a
 * polygon of reference vectors, one per piece.
 *
 * Interaction: choose any piece in the tray, in any
 * order; a tap or click on the board places it there when it fits (a red
 * outline shows where it does not). Pressing a placed piece chooses it, and
 * dragging it moves it; then it turns, flips, moves with the arrow keys and
 * goes back to the tray. Dragging empty board pans; pinch or wheel zooms.
 * Nothing ever chooses the next piece for you. */
(function () {
  "use strict";
  const M = window.FenceMath;
  const PIECES = window.HEXOMINOES;
  const CHIPS = window.HX_CHIPS;
  const FENCES = window.HEXO_FENCES;
  const t = (k, v) => window.i18n.t(k, v);
  const lang = () => window.i18n.get();
  const key = (x, y) => x + "," + y;
  const MINUS = "−";

  const $ = (id) => document.getElementById(id);
  const lab = $("lab"), canvas = $("board"), ctx = canvas.getContext("2d");
  const trayEl = $("tray"), statusEl = $("status");
  const PHONE = window.matchMedia("(max-width: 860px)");

  // ---------- state ----------
  const placed = new Map();          // piece index -> { index, cells: [[x,y]] }
  const occ = new Map();             // cell key -> piece index
  const orient = PIECES.map((p) => p.cells.map((c) => c.slice())); // tray orientation
  let sel = null;                    // chosen piece index, placed or not
  let ghost = null;                  // { index, cells, at, blocked } preview
  let undoStack = [];
  let analysis = M.analyzeFence([]);
  let ref = null;                    // referenceData of the current fence
  let mode = "build";
  let showCorners = false;
  let arrowState = null;             // { perm, from, to, t0, phase }
  let pickedArrow = null;
  const view = { s: 22, ox: 0, oy: 0 }; // px per cell, screen position of (0,0)
  let anim = null;                   // assembly of a known fence
  let loaded = null, loadedSnap = "";
  let openChip = null, chipOpener = null;
  const FIT_MAX = 24;

  const color = (i, a = 1) => `hsla(${PIECES[i].hue}, 82%, 62%, ${a})`;
  function fmt(x) {
    const r = Math.round(x * 100000) / 100000;
    let s = String(Math.abs(r));
    if (lang() !== "en") s = s.replace(".", ",");
    return (r < 0 ? MINUS : "") + s;
  }
  function status(msg) { statusEl.textContent = ""; statusEl.textContent = msg; }

  // ---------- geometry helpers ----------
  function normalize(cells) {
    const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
    return cells.map(([x, y]) => [x - mx, y - my]);
  }
  const rot = (cells) => normalize(cells.map(([x, y]) => [y, -x]));
  const flp = (cells) => normalize(cells.map(([x, y]) => [-x, y]));
  function handle(cells) {
    const c = centroid(cells);
    let best = cells[0], bd = Infinity;
    for (const q of cells) { const d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2; if (d < bd) { bd = d; best = q; } }
    return best;
  }
  function centroid(pts) { return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]; }
  function placeAt(shape, cell) {
    const h = handle(shape);
    return shape.map(([x, y]) => [x - h[0] + cell[0], y - h[1] + cell[1]]);
  }
  function fits(cells, except) {
    return cells.every(([x, y]) => { const o = occ.get(key(x, y)); return o === undefined || o === except; });
  }

  // ---------- board changes ----------
  function snapshot() { return [...placed.values()].map((p) => ({ index: p.index, cells: p.cells.map((c) => c.slice()) })); }
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 300) undoStack.shift(); }
  function put(index, cells) { placed.set(index, { index, cells }); for (const [x, y] of cells) occ.set(key(x, y), index); }
  function lift(index) {
    const p = placed.get(index);
    if (!p) return;
    for (const [x, y] of p.cells) occ.delete(key(x, y));
    placed.delete(index);
  }
  const sig = () => [...placed.values()].map((p) => p.index + ":" + p.cells.join(";")).sort().join("|");
  function changed() {
    const pieces = [...placed.values()].map((p) => ({ id: p.index, cells: p.cells }));
    const before = analysis.area;
    analysis = M.analyzeFence(pieces);
    ref = null;
    if (analysis.valid && analysis.area > 0) {
      try { const r = M.referenceData(pieces, analysis.largest); if (r.ok) ref = r; } catch (e) { ref = null; }
    }
    $("area-value").textContent = analysis.area;
    if (analysis.area !== before) { const pill = $("area-pill"); pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
    if (!anim && loaded && sig() !== loadedSnap) loaded = null;
    if (!ref && mode === "arrows") setMode("build");
    syncControls();
    syncTray();
    syncChips();
    syncJump();
    draw();
  }
  function syncControls() {
    const arrows = $("mode-arrows");
    arrows.setAttribute("aria-disabled", ref ? "false" : "true");
    arrows.title = ref ? t("hx.arrows") : t("hx.noArrows");
    const chosenPlaced = sel !== null && placed.has(sel);
    $("remove").disabled = !chosenPlaced;
    $("rotate").disabled = sel === null;
    $("flip").disabled = sel === null;
    $("undo").disabled = !undoStack.length;
  }
  function syncJump() {
    const j = $("jump");
    if (mode === "build" && loaded === "1597") {
      j.innerHTML = `<span class="was">1586</span>+11`;
      j.title = t("hx.vs2025", { d: "+11" });
      j.hidden = false;
    } else j.hidden = true;
  }

  // ---------- tray ----------
  const COLS = () => (PHONE.matches ? 9 : 5);
  function miniSvg(cells, hue) {
    const w = Math.max(...cells.map((c) => c[0])) + 1, h = Math.max(...cells.map((c) => c[1])) + 1;
    const n = Math.max(w, h);
    const ox = (n - w) / 2, oy = (n - h) / 2;
    const rects = cells.map(([x, y]) => `<rect x="${x + ox + 0.06}" y="${n - 1 - y - oy + 0.06}" width="0.88" height="0.88" rx="0.14"/>`).join("");
    return `<svg viewBox="0 0 ${n} ${n}" aria-hidden="true"><g fill="hsl(${hue},82%,62%)">${rects}</g></svg>`;
  }
  function buildTray() {
    trayEl.innerHTML = "";
    PIECES.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.index = i;
      b.tabIndex = i === 0 ? 0 : -1;
      b.innerHTML = miniSvg(orient[i], p.hue);
      b.addEventListener("click", () => choose(i));
      trayEl.appendChild(b);
    });
    syncTray();
  }
  function syncTray() {
    let tabbed = false;
    for (const b of trayEl.children) {
      const i = +b.dataset.index;
      const used = placed.has(i);
      b.classList.toggle("is-placed", used);
      b.setAttribute("aria-pressed", sel === i ? "true" : "false");
      b.setAttribute("aria-label", t(used ? "hx.pieceUsed" : "hx.piece", { n: i + 1 }));
      const tab = sel === null ? i === 0 : sel === i;
      b.tabIndex = tab ? 0 : -1;
      tabbed = tabbed || tab;
    }
    if (!tabbed && trayEl.firstChild) trayEl.firstChild.tabIndex = 0;
  }
  trayEl.addEventListener("keydown", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const i = +b.dataset.index, n = PIECES.length, c = COLS();
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: c, ArrowUp: -c, Home: -i, End: n - 1 - i }[e.key];
    if (d === undefined) return;
    e.preventDefault(); e.stopPropagation();
    const j = Math.max(0, Math.min(n - 1, i + d));
    for (const x of trayEl.children) x.tabIndex = -1;
    trayEl.children[j].tabIndex = 0;
    trayEl.children[j].focus();
  });
  function refreshChip(i) {
    const b = trayEl.children[i];
    if (b) b.innerHTML = miniSvg(placed.has(i) ? normalize(placed.get(i).cells) : orient[i], PIECES[i].hue);
  }
  function choose(i) {
    sel = sel === i && !placed.has(i) ? null : i;
    ghost = null;
    if (sel !== null && placed.has(sel)) revealCells(placed.get(sel).cells);
    const b = trayEl.children[i];
    if (b) b.scrollIntoView({ block: "nearest", inline: "nearest" });
    syncControls(); syncTray(); draw();
  }

  // ---------- actions ----------
  function placePiece(i, cells) {
    if (!fits(cells)) { ghost = { index: i, cells, blocked: true }; status(t("hx.s.blocked")); draw(); return false; }
    pushUndo();
    put(i, cells);
    orient[i] = normalize(cells);
    sel = i; ghost = null;
    refreshChip(i);
    changed();
    keepInView(cells);
    status(t("hx.s.placed", { n: analysis.area }));
    return true;
  }
  function transform(fn) {
    if (sel === null) return;
    if (placed.has(sel)) {
      const p = placed.get(sel);
      const next = placeAt(fn(normalize(p.cells)), handle(p.cells));
      if (!fits(next, sel)) { flash($("rotate")); flash($("flip")); status(t("hx.s.blocked")); return; }
      pushUndo(); lift(sel); put(sel, next); refreshChip(sel); changed();
    } else {
      orient[sel] = fn(orient[sel]);
      refreshChip(sel);
      if (ghost && ghost.at) { const cells = placeAt(orient[sel], ghost.at); ghost = { index: sel, cells, at: ghost.at, blocked: !fits(cells) }; }
      draw();
    }
  }
  function moveSel(dx, dy) {
    if (sel === null) return;
    if (placed.has(sel)) {
      const next = placed.get(sel).cells.map(([x, y]) => [x + dx, y + dy]);
      if (!fits(next, sel)) { status(t("hx.s.blocked")); return; }
      pushUndo(); lift(sel); put(sel, next); changed(); keepInView(next);
      status(t("hx.s.moved", { n: analysis.area }));
    } else {
      const at0 = ghost && ghost.at ? ghost.at : screenToCell(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const at = [at0[0] + dx, at0[1] + dy];
      const cells = placeAt(orient[sel], at);
      ghost = { index: sel, cells, at, blocked: !fits(cells) };
      draw();
    }
  }
  function removeSel() {
    if (sel === null || !placed.has(sel)) return;
    pushUndo(); const i = sel; lift(i); refreshChip(i); changed();
    status(t("hx.s.removed", { n: analysis.area }));
  }
  function undo() {
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    placed.clear(); occ.clear();
    for (const p of snap) { put(p.index, p.cells); orient[p.index] = normalize(p.cells); }
    PIECES.forEach((p, i) => refreshChip(i));
    ghost = null;
    changed();
    status(t("hx.s.undone", { n: analysis.area }));
  }
  // Erase acts on the second tap; between the two it asks "again?".
  let armTimer = 0;
  function disarm() {
    clearTimeout(armTimer);
    const c = $("clear");
    if (!c.classList.contains("is-armed")) return;
    c.classList.remove("is-armed");
    $("again").hidden = true;
    c.title = t("hx.clear"); c.setAttribute("aria-label", t("hx.clear"));
  }
  function clearAll() {
    const c = $("clear");
    if (!c.classList.contains("is-armed")) {
      c.classList.add("is-armed");
      $("again").hidden = false;
      c.title = t("hx.clearConfirm"); c.setAttribute("aria-label", t("hx.clearConfirm"));
      armTimer = setTimeout(disarm, 2600);
      return;
    }
    disarm();
    if (!placed.size) return;
    pushUndo(); placed.clear(); occ.clear(); sel = null; ghost = null; loaded = null;
    PIECES.forEach((p, i) => refreshChip(i));
    changed();
    status(t("hx.s.cleared"));
  }
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#clear")) disarm(); }, true);
  function flash(el) { if (!el) return; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 400); }
  function shake(el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const el = $("toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ---------- the two known fences, matched to our pieces ----------
  function loadFence(name) {
    const pieces = M.parseGrid(FENCES[name]);
    const byCanon = new Map(PIECES.map((p, i) => [p.canon, i]));
    let sx = 0, sy = 0, n = 0;
    for (const p of pieces) for (const c of p.cells) { sx += c[0]; sy += c[1]; n++; }
    const cx = Math.round(sx / n), cy = Math.round(sy / n);
    const out = pieces.map((p) => ({ index: byCanon.get(M.canonical(p.cells)), cells: p.cells.map(([x, y]) => [x - cx, y - cy]) }));
    const a = M.analyzeFence(out.map((p) => ({ id: p.index, cells: p.cells })));
    const r = M.referenceData(out.map((p) => ({ id: p.index, cells: p.cells })), a.largest);
    if (r.ok) { const pos = new Map(r.order.map((o, k) => [o.id, k])); out.sort((p, q) => pos.get(p.index) - pos.get(q.index)); }
    return out;
  }
  function assemble(name, stepMs) {
    if (anim) return;
    if (mode !== "build") setMode("build");
    const replacesOwn = placed.size > 0 && !loaded;
    const target = loadFence(name);
    pushUndo(); placed.clear(); occ.clear(); sel = null; ghost = null; loaded = null;
    PIECES.forEach((p, i) => refreshChip(i));
    changed();
    fitTo(target.flatMap((p) => p.cells), true);
    if (replacesOwn) toast(t("hx.toastUndo"), 3600);
    let k = 0;
    anim = { born: new Map() };
    const step = () => {
      if (k >= target.length) {
        anim = null; loaded = name; loadedSnap = sig(); changed();
        status(t("hx.s.loaded", { n: analysis.area }));
        return;
      }
      const p = target[k++];
      put(p.index, p.cells); orient[p.index] = normalize(p.cells); refreshChip(p.index);
      anim.born.set(p.index, performance.now());
      changed();
      setTimeout(step, stepMs);
    };
    step();
  }

  // ---------- views ----------
  function setMode(m) {
    if (m === "arrows" && !ref) { shake($("mode-arrows")); toast(t("hx.noArrows")); return; }
    mode = m;
    lab.dataset.mode = m;
    $("mode-build").setAttribute("aria-pressed", m === "build" ? "true" : "false");
    $("mode-arrows").setAttribute("aria-pressed", m === "arrows" ? "true" : "false");
    pickedArrow = null;
    if (m === "arrows") {
      arrowState = { perm: [...Array(ref.order.length).keys()], from: null, t0: 0, phase: "fence" };
      showEquation();
    } else arrowState = null;
    syncChips(); syncJump();
    requestAnimationFrame(() => { resize(); if (placed.size) fitAll(); });
  }
  function showEquation() {
    const eq = $("equation");
    const phase = arrowState.phase;
    eq.classList.toggle("arranged", phase !== "fence");
    const area = phase === "fence" ? ref.aRef : M.shoelace(polyFor(arrowState.perm));
    $("val-ref").textContent = fmt(area);
    $("val-delta").textContent = fmt(ref.sumDelta);
    $("val-area").textContent = fmt(ref.area);
    const b = $("bound-tag");
    if (phase !== "shuffled") { b.textContent = "≤ " + fmt(M.minkowskiBound(ref.order.map((o) => o.v))); b.hidden = false; b.title = t("hx.boundTag", { f: b.textContent.slice(2) }); }
    else b.hidden = true;
  }
  function polyFor(perm) {
    const vs = perm.map((k) => ref.order[k].v);
    const pts = [[0, 0]];
    for (const v of vs.slice(0, -1)) pts.push([pts[pts.length - 1][0] + v[0], pts[pts.length - 1][1] + v[1]]);
    const c0 = centroid(ref.polygon), c1 = centroid(pts);
    return pts.map(([x, y]) => [x - c1[0] + c0[0], y - c1[1] + c0[1]]);
  }
  function startsOf(perm) {
    const pts = polyFor(perm);
    const s = new Array(perm.length);
    perm.forEach((k, j) => { s[k] = pts[j]; });
    return s;
  }
  function currentStarts() {
    const to = arrowState.to || ref.order.map((o) => o.mIn);
    if (!arrowState.from) return to;
    const u = ease(Math.min(1, (performance.now() - arrowState.t0) / 900));
    return to.map((p, k) => [arrowState.from[k][0] + (p[0] - arrowState.from[k][0]) * u, arrowState.from[k][1] + (p[1] - arrowState.from[k][1]) * u]);
  }
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  function rearrange(perm, phase) {
    const from = currentStarts();
    arrowState = { perm, from, to: startsOf(perm), t0: performance.now(), phase };
    showEquation();
    syncChips();
    requestAnimationFrame(draw);
  }
  function shuffle() {
    const p = [...Array(ref.order.length).keys()];
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    rearrange(p, "shuffled");
  }
  function sortArrows() {
    const wasFence = arrowState.phase === "fence";
    if (arrowState.phase === "sorted") { rearrange([...Array(ref.order.length).keys()], "fence"); return; }
    const cv = M.convexArrangement(ref.order.map((o) => o.v));
    rearrange(cv.order, "sorted");
    if (wasFence && Math.abs(cv.area - ref.aRef) < 1e-9) toast("⬡ " + t("hx.toastConvex"));
  }

  // ---------- view ----------
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function fitTo(cells, cap) {
    const w = canvas.clientWidth;
    // On phones the arrows' equation sits on the top of the board.
    const top = mode === "arrows" && PHONE.matches ? 56 : 0;
    const h = canvas.clientHeight - top;
    if (!cells.length) { view.s = 22; view.ox = w / 2; view.oy = h / 2; return; }
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 2, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 2;
    view.s = Math.min(w / (x1 - x0), h / (y1 - y0));
    if (cap !== false) view.s = Math.min(view.s, FIT_MAX);
    view.ox = w / 2 - ((x0 + x1) / 2) * view.s;
    view.oy = top + h / 2 + ((y0 + y1) / 2) * view.s;
  }
  function fitAll() { fitTo([...placed.values()].flatMap((p) => p.cells)); draw(); }
  // The fence grows: keep it all in sight, zooming out only when needed.
  function keepInView(cells) {
    const w = canvas.clientWidth, h = canvas.clientHeight, m = view.s;
    const out = cells.some(([x, y]) => X(x) < m || X(x + 1) > w - m || Y(y + 1) < m || Y(y) > h - m);
    if (out) { const s0 = view.s; fitAll(); view.s = Math.min(view.s, s0); fitCenterOnly(); }
  }
  function fitCenterOnly() {
    const cells = [...placed.values()].flatMap((p) => p.cells);
    if (!cells.length) return;
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    view.ox = canvas.clientWidth / 2 - cx * view.s; view.oy = canvas.clientHeight / 2 + cy * view.s;
    draw();
  }
  function zoomAt(f, sx, sy) {
    const s2 = Math.max(3, Math.min(80, view.s * f));
    const k = s2 / view.s;
    view.ox = sx - (sx - view.ox) * k; view.oy = sy - (sy - view.oy) * k; view.s = s2;
    draw();
  }
  const X = (x) => view.ox + x * view.s;
  const Y = (y) => view.oy - y * view.s;
  function screenToCell(sx, sy) { return [Math.floor((sx - view.ox) / view.s), Math.floor((view.oy - sy) / view.s)]; }
  function revealCells(cells) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const out = cells.some(([x, y]) => X(x) < 0 || X(x + 1) > w || Y(y + 1) < 0 || Y(y) > h);
    if (out) { const c = centroid(cells); view.ox = w / 2 - (c[0] + 0.5) * view.s; view.oy = h / 2 + (c[1] + 0.5) * view.s; }
  }

  // ---------- drawing ----------
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    drawGrid(w, h);
    if (mode === "arrows" && ref) drawArrows(); else drawBuild();
    if (anim || (arrowState && arrowState.from && performance.now() - arrowState.t0 < 950)) requestAnimationFrame(draw);
  }
  function drawGrid(w, h) {
    if (view.s < 5) return;
    ctx.strokeStyle = view.s < 9 ? "rgba(90,112,143,0.18)" : "rgba(90,112,143,0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = Math.floor(-view.ox / view.s), x1 = Math.ceil((w - view.ox) / view.s);
    const y0 = Math.floor((view.oy - h) / view.s), y1 = Math.ceil(view.oy / view.s);
    for (let x = x0; x <= x1; x++) { const sx = Math.round(X(x)) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, h); }
    for (let y = y0; y <= y1; y++) { const sy = Math.round(Y(y)) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(w, sy); }
    ctx.stroke();
  }
  function fillCells(cells, style) {
    ctx.fillStyle = style;
    for (const [x, y] of cells) ctx.fillRect(X(x), Y(y + 1), view.s + 0.5, view.s + 0.5);
  }
  function drawPiece(p, alpha, scale) {
    const s = view.s, g = Math.max(0.6, s * 0.06);
    ctx.fillStyle = color(p.index, alpha);
    const k = scale === undefined ? 1 : scale;
    for (const [x, y] of p.cells) {
      const cx = X(x) + s / 2, cy = Y(y + 1) + s / 2, half = (s / 2 - g) * k;
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    }
  }
  function outline(cells, style, width) {
    const set = new Set(cells.map((c) => key(c[0], c[1])));
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.beginPath();
    for (const [x, y] of cells) {
      if (!set.has(key(x, y + 1))) { ctx.moveTo(X(x), Y(y + 1)); ctx.lineTo(X(x + 1), Y(y + 1)); }
      if (!set.has(key(x, y - 1))) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 1), Y(y)); }
      if (!set.has(key(x - 1, y))) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 1)); }
      if (!set.has(key(x + 1, y))) { ctx.moveTo(X(x + 1), Y(y)); ctx.lineTo(X(x + 1), Y(y + 1)); }
    }
    ctx.stroke();
  }
  function drawBuild() {
    if (analysis.regions.length) {
      const live = analysis.valid;
      ctx.save();
      ctx.shadowColor = "rgba(46,207,153,0.8)"; ctx.shadowBlur = live ? 14 : 0;
      fillCells(analysis.largest, live ? "rgba(46,207,153,0.42)" : "rgba(46,207,153,0.12)");
      ctx.restore();
      for (const r of analysis.regions.slice(1)) fillCells(r, "rgba(46,207,153,0.1)");
    }
    const now = performance.now();
    for (const p of placed.values()) {
      let k;
      if (anim && anim.born.has(p.index)) { const u = Math.min(1, (now - anim.born.get(p.index)) / 260); k = 0.3 + 0.7 * ease(u); }
      drawPiece(p, 1, k);
    }
    if (sel !== null && placed.has(sel)) {
      ctx.save(); ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
      outline(placed.get(sel).cells, "rgba(255,255,255,0.95)", 2.2);
      ctx.restore();
    }
    if (ghost && sel === ghost.index && !placed.has(ghost.index)) {
      drawPiece(ghost, ghost.blocked ? 0.22 : 0.45);
      outline(ghost.cells, ghost.blocked ? "rgba(255,95,143,0.95)" : "rgba(255,255,255,0.85)", 1.8);
    }
  }
  const CHAIN = { NE: "#2ff3ff", NW: "#b388ff", SW: "#ff3bd4", SE: "#ff8a3d" };
  function drawArrows() {
    const now = performance.now();
    const st = arrowState;
    const settled = !st.from || now - st.t0 > 900;
    const fencePhase = st.phase === "fence" && settled;
    const starts = currentStarts();
    const fade = st.from ? Math.min(1, (now - st.t0) / 900) : 1;
    if (st.phase === "fence") {
      fillCells(analysis.largest, `rgba(46,207,153,${0.16 * fade})`);
      for (const p of placed.values()) drawPiece(p, 0.16 * fade + (pickedArrow === p.index ? 0.5 : 0));
    }
    ctx.beginPath();
    st.perm.forEach((k, j) => { const p = starts[k]; (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(p[0]), Y(p[1])); });
    ctx.closePath();
    ctx.fillStyle = "rgba(47,243,255,0.13)"; ctx.fill();
    if (fencePhase) {
      for (const o of ref.order) {
        ctx.beginPath();
        ctx.moveTo(X(o.mIn[0]), Y(o.mIn[1]));
        for (const b of o.boundary) ctx.lineTo(X(b[0]), Y(b[1]));
        ctx.lineTo(X(o.mOut[0]), Y(o.mOut[1]));
        ctx.closePath();
        ctx.fillStyle = pickedArrow === o.id ? "rgba(255,59,212,0.85)" : "rgba(255,59,212,0.45)";
        ctx.fill();
        ctx.strokeStyle = "#ff5f8f"; ctx.lineWidth = Math.max(1.5, view.s * 0.16); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(X(o.attachIn[0][0]), Y(o.attachIn[0][1])); ctx.lineTo(X(o.attachIn[1][0]), Y(o.attachIn[1][1])); ctx.stroke();
      }
    }
    for (let k = 0; k < ref.order.length; k++) {
      const o = ref.order[k], a = starts[k];
      const b = [a[0] + o.v[0], a[1] + o.v[1]];
      let col = "#2ff3ff";
      if (st.phase === "sorted") col = CHAIN[M.chainOf(o.v)];
      const corner = showCorners && st.phase === "fence" && o.D !== 0;
      if (corner) col = "#ffd43b";
      arrow(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), col, pickedArrow === o.id || corner);
    }
    if (showCorners && fencePhase) {
      ctx.font = `700 ${Math.max(11, Math.min(16, view.s * 0.9))}px ui-monospace, Menlo, monospace`;
      ctx.fillStyle = "#ffd43b"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const r0 = centroid(ref.polygon);
      for (const o of ref.order) if (o.D !== 0) {
        const c = centroid(placed.get(o.id).cells.map(([x, y]) => [x + 0.5, y + 0.5]));
        const d = Math.hypot(c[0] - r0[0], c[1] - r0[1]) || 1;
        ctx.fillText((o.D > 0 ? "+" : MINUS) + Math.abs(o.D) + "°", X(c[0] + ((c[0] - r0[0]) / d) * 2.2), Y(c[1] + ((c[1] - r0[1]) / d) * 2.2));
      }
    }
    if (pickedArrow !== null && fencePhase) {
      const o = ref.order.find((q) => q.id === pickedArrow);
      const tag = `v = (${fmt(o.v[0])}; ${fmt(o.v[1])})   Δ = ${fmt(o.delta)}   D = ${o.D < 0 ? MINUS : ""}${Math.abs(o.D)}°`;
      ctx.font = "600 13px ui-monospace, Menlo, monospace";
      const mx = X((o.mIn[0] + o.mOut[0]) / 2), my = Y((o.mIn[1] + o.mOut[1]) / 2);
      const tw = ctx.measureText(tag).width + 16;
      const cx = Math.min(Math.max(mx, tw / 2 + 6), canvas.clientWidth - tw / 2 - 6);
      ctx.fillStyle = "rgba(10,14,20,0.92)"; roundRect(cx - tw / 2, my - 32, tw, 24, 12); ctx.fill();
      ctx.fillStyle = "#d8f6ff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tag, cx, my - 20);
    }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function arrow(x1, y1, x2, y2, col, wide) {
    const lw = Math.max(1.4, Math.min(3.2, view.s * 0.13)) * (wide ? 1.8 : 1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, hl = Math.min(len * 0.35, Math.max(6, view.s * 0.55));
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = wide ? 12 : 5;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * hl * 0.6, y2 - uy * hl * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * hl - uy * hl * 0.45, y2 - uy * hl + ux * hl * 0.45);
    ctx.lineTo(x2 - ux * hl + uy * hl * 0.45, y2 - uy * hl - ux * hl * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- pointer ----------
  const pointers = new Map();
  let gesture = null;
  const SLOP = { mouse: 5, pen: 8, touch: 10 };
  function local(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (gesture && gesture.dragFrom && gesture.didMove) { lift(sel); put(sel, gesture.orig); changed(); }
      gesture = { kind: "pinch", d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ox: view.ox, oy: view.oy };
      return;
    }
    const cell = screenToCell(p[0], p[1]);
    const hit = occ.get(key(cell[0], cell[1]));
    gesture = { start: p, last: p, cell, hit, type: e.pointerType, moved: false };
    // Pressing a placed piece chooses it at once, so a drag moves it.
    if (mode === "build" && hit !== undefined) {
      if (sel !== hit) { sel = hit; ghost = null; syncControls(); syncTray(); draw(); }
      gesture.dragFrom = cell; gesture.orig = placed.get(hit).cells.map((c) => c.slice());
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (!gesture) {
      if (e.pointerType === "mouse" && mode === "build" && sel !== null && !placed.has(sel)) {
        const at = screenToCell(p[0], p[1]);
        const cells = placeAt(orient[sel], at);
        ghost = { index: sel, cells, at, blocked: !fits(cells) };
        draw();
      }
      return;
    }
    if (gesture.kind === "pinch") {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const s2 = Math.max(3, Math.min(80, gesture.s * d / gesture.d));
      const k = s2 / gesture.s;
      view.s = s2;
      view.ox = mid[0] - (gesture.mid[0] - gesture.ox) * k;
      view.oy = mid[1] - (gesture.mid[1] - gesture.oy) * k;
      draw();
      return;
    }
    if (!gesture.moved && Math.hypot(p[0] - gesture.start[0], p[1] - gesture.start[1]) < (SLOP[gesture.type] || 8)) return;
    gesture.moved = true;
    if (gesture.dragFrom) {
      const c = screenToCell(p[0], p[1]);
      const dx = c[0] - gesture.dragFrom[0], dy = c[1] - gesture.dragFrom[1];
      const next = gesture.orig.map(([x, y]) => [x + dx, y + dy]);
      if (fits(next, sel)) {
        lift(sel); put(sel, next); gesture.didMove = true;
        analysis = M.analyzeFence([...placed.values()].map((q) => ({ id: q.index, cells: q.cells })));
        $("area-value").textContent = analysis.area;
        draw();
      }
      return;
    }
    gesture.kind = "pan";
    view.ox += p[0] - gesture.last[0]; view.oy += p[1] - gesture.last[1];
    gesture.last = p;
    draw();
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.kind === "pinch") { if (pointers.size === 0) gesture = null; return; }
    const g = gesture; gesture = null;
    if (g.didMove) {
      const now = placed.get(sel).cells;
      lift(sel); put(sel, g.orig); pushUndo(); lift(sel); put(sel, now);
      changed();
      status(t("hx.s.moved", { n: analysis.area }));
      return;
    }
    if (g.moved) return;
    tap(g);
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); gesture = null; });
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && ghost && !ghost.blocked) { ghost = null; draw(); } });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); const p = local(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });

  function tap(g) {
    if (mode === "arrows") {
      pickedArrow = g.hit !== undefined && pickedArrow !== g.hit ? g.hit : null;
      draw();
      return;
    }
    if (g.hit !== undefined) return; // chosen on pointerdown
    if (sel !== null && !placed.has(sel)) { placePiece(sel, placeAt(orient[sel], g.cell)); return; }
    sel = null; ghost = null; syncControls(); syncTray(); draw();
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.key === "Escape") { if (!$("card").hidden) closeCard(true); else { sel = null; ghost = null; syncControls(); syncTray(); draw(); } return; }
    if (mode !== "build") return;
    if (e.target.closest && e.target.closest(".tray, .card, .langSel")) return;
    const k = e.key;
    if (k === "r" || k === "R") transform(rot);
    else if (k === "f" || k === "F") transform(flp);
    else if (k === "Delete" || k === "Backspace") removeSel();
    else if (k.startsWith("Arrow") && (e.target === canvas || e.target === document.body)) {
      e.preventDefault();
      moveSel(k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0, k === "ArrowUp" ? 1 : k === "ArrowDown" ? -1 : 0);
    } else if (k === "Enter" && e.target === canvas && ghost && !ghost.blocked) placePiece(ghost.index, ghost.cells);
  });

  // ---------- math chips and their cards ----------
  function syncChips() {
    const want = new Set();
    if (mode === "build") {
      if (loaded === "1597") want.add("thm1597");
      else if (loaded === "1586") want.add("record2025");
      if (analysis.area > 0) want.add("area");
    } else if (arrowState) {
      if (arrowState.phase === "fence") { want.add("refvec"); want.add("lemma"); if (showCorners) want.add("rotation"); }
      else { want.add("p2"); if (arrowState.phase === "sorted") want.add("bound"); }
    }
    document.querySelectorAll(".math-chip").forEach((b) => {
      b.hidden = !want.has(b.dataset.chip);
      b.setAttribute("aria-expanded", openChip === b.dataset.chip ? "true" : "false");
      b.setAttribute("aria-label", t("hx.math") + ": " + CHIPS[b.dataset.chip].section[lang()]);
    });
    if (openChip && !want.has(openChip)) closeCard(false);
  }
  function live(id) {
    const tag = (s) => `<span class="live">${s} · ${t("hx.live.computed")}</span>`;
    if (id === "area") return tag(`${t("hx.area")} = ${analysis.area}`);
    if (!ref) return "";
    if (id === "lemma") return tag(`${fmt(ref.aRef)} + (${fmt(ref.sumDelta)}) = ${fmt(ref.area)}`);
    if (id === "rotation") return tag(`Σ D = ${ref.sumD}°`);
    const F = M.convexArrangement(ref.order.map((o) => o.v)).area;
    if (id === "p2") return tag(t("hx.live.order", { a: fmt(M.shoelace(polyFor(arrowState.perm))), f: fmt(F) }));
    if (id === "bound") return tag(t("hx.live.bound", { f: fmt(M.minkowskiBound(ref.order.map((o) => o.v))), a: fmt(F) }));
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
    card.focus({ preventScroll: true });
  }
  function closeCard(returnFocus) {
    const card = $("card");
    if (card.hidden) return;
    card.hidden = true; openChip = null;
    syncChips();
    if (returnFocus && chipOpener && !chipOpener.hidden) chipOpener.focus({ preventScroll: true });
    chipOpener = null;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".math-chip");
    if (!b) return;
    e.stopPropagation();
    if (openChip === b.dataset.chip) closeCard(true); else openCard(b.dataset.chip, b);
  });
  // Close on a tap anywhere else.
  document.addEventListener("pointerdown", (e) => {
    if ($("card").hidden) return;
    if (e.target.closest("#card, .math-chip")) return;
    closeCard(false);
  }, true);
  $("card-close").addEventListener("click", () => closeCard(true));
  document.addEventListener("fc-langchange", () => {
    syncControls(); syncTray(); syncChips(); syncJump(); disarm();
    $("area-value").textContent = analysis.area;
    if (mode === "arrows") showEquation();
    if (openChip) openCard(openChip);
    draw();
  });

  // ---------- wiring ----------
  document.querySelectorAll("[data-lang-btn]").forEach((b) => b.addEventListener("click", () => window.i18n.setLang(b.dataset.langBtn)));
  $("mode-build").addEventListener("click", () => setMode("build"));
  $("mode-arrows").addEventListener("click", () => setMode("arrows"));
  $("rotate").addEventListener("click", () => transform(rot));
  $("flip").addEventListener("click", () => transform(flp));
  $("remove").addEventListener("click", removeSel);
  $("undo").addEventListener("click", undo);
  $("clear").addEventListener("click", clearAll);
  $("load2025").addEventListener("click", () => assemble("1586", 18));
  $("reveal").addEventListener("click", () => assemble("1597", 90));
  $("shuffle").addEventListener("click", shuffle);
  $("sort").addEventListener("click", sortArrows);
  $("corners").addEventListener("click", () => { showCorners = !showCorners; $("corners").setAttribute("aria-pressed", showCorners ? "true" : "false"); syncChips(); draw(); });
  $("zoom-in").addEventListener("click", () => zoomAt(1.25, canvas.clientWidth / 2, canvas.clientHeight / 2));
  $("zoom-out").addEventListener("click", () => zoomAt(0.8, canvas.clientWidth / 2, canvas.clientHeight / 2));
  $("zoom-fit").addEventListener("click", fitAll);
  new ResizeObserver(resize).observe(canvas);

  buildTray();
  resize();
  fitTo([]);
  changed();

  // For tests and figure export.
  window.hexLab = {
    state: () => ({ placed: [...placed.keys()], sel, ghost: ghost && ghost.index, blocked: !!(ghost && ghost.blocked), area: analysis.area, valid: analysis.valid, mode, arrows: !!ref, phase: arrowState && arrowState.phase, refArea: ref && ref.aRef, cell: view.s }),
    cellToScreen: (x, y) => { const r = canvas.getBoundingClientRect(); return [r.left + X(x + 0.5), r.top + Y(y + 0.5)]; },
    placedCells: (i) => (placed.has(i) ? placed.get(i).cells.map((c) => c.slice()) : null),
    busy: () => !!anim,
    fitsAt: (i, x, y) => fits(placeAt(orient[i], [x, y])),
    occupied: (x, y) => occ.has(key(x, y)),
  };
})();

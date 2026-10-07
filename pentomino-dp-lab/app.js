/* Pentomino DP lab.
 * The overlay canvas draws the dynamic program (grid, layer dots, start)
 * with its own view, fitted to the current layer and tweened between
 * layers. When the order closes, the shared piece engine takes over: a board
 * fitted to the fence, the pieces placed one by one, the Shoelace fan.
 * DP coordinates are doubled (dp.js). The overlay's world puts a DP vertex v
 * at (v/2, -v/2); the engine's board shifts that by (ox, oy). */
(function () {
  "use strict";

  var D = window.PentoDP, L = window.LatticeSquare, PE = window.PieceEngine;
  function t(k, v) { return window.i18n ? window.i18n.t(k, v) : k; }
  function $(id) { return document.getElementById(id); }

  var LETTERS = D.PENTOS.map(function (p) { return p[0]; });
  var COLORS = {
    F: "#ff6b6b", I: "#f59f00", L: "#ffd43b", N: "#38d9a9", P: "#94d82d", T: "#22b8cf",
    U: "#4dabf7", V: "#748ffc", W: "#9775fa", X: "#da77f2", Y: "#f06595", Z: "#ffa8a8"
  };
  var SEED = "FIV", MIN_PIECES = 3;
  var STEP_MS = 620, EDGE_MS = 24, TWEEN_MS = 350, PAD = 24;

  var canon = function (cells) { return L._internals.canonicalizeShape(cells).key; };
  var toCells = function (arr) { return arr.map(function (c) { return { x: c[0], y: c[1] }; }); };
  var nameByCanon = new Map(D.PENTOS.map(function (p) { return [canon(toCells(p[1])), p[0]]; }));
  var pieceSet = {
    order: 5,
    shapes: D.PENTOS.map(function (p) { return toCells(p[1]); }),
    build: function (shapes) {
      return shapes.map(function (cells) {
        var n = nameByCanon.get(canon(cells));
        return { id: n, name: n, cells: cells, color: COLORS[n] };
      });
    }
  };

  var stage = $("dp-stage"), board = $("game-board"), layer = $("dp-layer");
  var lctx = layer.getContext("2d");
  var pill = $("area-value"), statusEl = $("dp-status"), layout = $("dp-layout"), prevEl = $("dp-prev");
  var chipArea = document.querySelector('[data-math="m.area"]');
  var chipLayer = document.querySelector(".dp-layerchip");
  var chipOrders = document.querySelector('[data-math="m.orders"]');
  var chipWorst = document.querySelector('[data-math="m.worst"]');
  var chipBest = document.querySelector('[data-math="m.best"]');

  var engine = null, boardSize = 0, ox = 0, oy = 0;
  var order = [], own = null, loaded = null, last = null;
  var run = null, timer = 0, playing = false;
  var view = null, tween = null, raf = 0, veil = 1;

  /* ---------- order and tray ---------- */

  function idx(letter) { return LETTERS.indexOf(letter); }
  function letters(o) { return o.map(function (i) { return LETTERS[i]; }).join(""); }
  function setOrder(str, why) {
    order = str.split("").map(idx);
    loaded = why || null;
    resetRun();
  }

  var trayButtons = [];
  function buildTray() {
    var tray = $("piece-tray");
    tray.innerHTML = "";
    D.PENTOS.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "piece-btn";
      b.dataset.pieceId = p[0];
      var cv = document.createElement("canvas");
      cv.width = 64; cv.height = 64;
      cv.className = "piece-preview";
      cv.setAttribute("aria-hidden", "true");
      drawPreview(cv, p[1], COLORS[p[0]]);
      var badge = document.createElement("span");
      badge.className = "dp-badge";
      badge.setAttribute("aria-hidden", "true");
      b.appendChild(cv);
      b.appendChild(badge);
      b.addEventListener("click", function () { togglePiece(i); });
      tray.appendChild(b);
      trayButtons.push(b);
    });
  }

  function drawPreview(cv, cells, color) {
    var ctx = cv.getContext("2d");
    var mx = Math.max.apply(null, cells.map(function (c) { return c[0]; }));
    var my = Math.max.apply(null, cells.map(function (c) { return c[1]; }));
    var s = Math.floor((cv.width - 4) / 5);
    var x0 = Math.floor((cv.width - (mx + 1) * s) / 2), y0 = Math.floor((cv.height - (my + 1) * s) / 2);
    ctx.clearRect(0, 0, cv.width, cv.height);
    cells.forEach(function (c) {
      var px = x0 + c[0] * s, py = y0 + (my - c[1]) * s;
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
    });
  }

  function togglePiece(i) {
    var at = order.indexOf(i);
    if (at >= 0) order.splice(at, 1); else order.push(i);
    loaded = null; own = null;
    resetRun();
  }

  function syncTray() {
    var cur = -1;
    if (run && run.phase === "layers" && run.step > 0) cur = order[run.step - 1];
    if (run && run.phase === "trace" && run.placed > 0) cur = run.tr[run.placed - 1].piece;
    trayButtons.forEach(function (b, i) {
      var k = order.indexOf(i), name = LETTERS[i];
      b.classList.toggle("selected", k >= 0);
      b.classList.toggle("is-current", i === cur);
      b.querySelector(".dp-badge").textContent = k >= 0 ? String(k + 1) : "";
      var tip = k >= 0 ? t("dp.pieceIn", { name: name, k: k + 1 }) : t("dp.piece", { name: name });
      b.setAttribute("aria-label", tip);
      b.setAttribute("data-lab-tip", tip);
      b.setAttribute("aria-pressed", k >= 0 ? "true" : "false");
    });
  }

  /* ---------- the run ---------- */

  function stopTimers() { window.clearTimeout(timer); timer = 0; playing = false; }

  function resetRun() {
    stopTimers();
    run = null;
    pill.textContent = "0";
    layout.dataset.phase = "idle";
    veil = 1;
    if (engine) { engine.clear(); engine.detectArea(); }
    goView(fitTo(null), false);
    syncTray(); syncControls();
    statusEl.textContent = order.length ? t("dp.s.order", { list: letters(order).split("").join(" ") }) : "";
  }

  function ensureRun() {
    if (run) return run;
    var res = D.fixedOrder(order), tr = D.trace(res);
    run = { res: res, tr: tr ? tr.pieces : null, valid: tr ? tr.valid : false, step: 0, phase: "layers",
      fan: [], shown: 0, sum: 0, placed: 0, flood: null };
    return run;
  }

  function step() {
    if (run && (run.phase === "done" || run.phase === "none")) resetRun();
    if (order.length < MIN_PIECES) { say("dp.s.few"); return; }
    var r = ensureRun();
    if (r.phase !== "layers") return;
    r.step += 1;
    layout.dataset.phase = "layers";
    pill.textContent = "–";
    var states = r.res.layers[r.step].size;
    say("dp.s.step", { i: r.step, states: states.toLocaleString(locale()), word: plural(states, "dp.state1", "dp.stateN") });
    goView(fitTo(r.step), true);
    if (r.step >= order.length) close();
    syncTray(); syncControls();
  }

  function play() {
    if (playing) { stopTimers(); syncControls(); return; }
    if (run && (run.phase === "done" || run.phase === "none")) resetRun();
    if (order.length < MIN_PIECES) { say("dp.s.few"); return; }
    var r = ensureRun();
    if (r.phase !== "layers") return;
    playing = true;
    (function tick() {
      if (run !== r || !playing || r.phase !== "layers") { if (run === r && r.phase !== "layers") playing = false; syncControls(); return; }
      step();
      timer = window.setTimeout(tick, STEP_MS);
    })();
    syncControls();
  }

  function close() {
    var r = run;
    if (r.res.best == null || r.res.best <= 0) {
      r.phase = "none";
      layout.dataset.phase = "none";
      say("dp.s.open");
      playing = false;
      return;
    }
    r.phase = "zoom";
    layout.dataset.phase = "trace";
    r.fan = [];
    r.tr.forEach(function (pc, j) {
      for (var k = 0; k + 1 < pc.path.length; k++) r.fan.push({ a: pc.path[k], b: pc.path[k + 1], piece: j });
    });
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      fitEngineToFence(r);
      goView(engineView(), true, function () {
        if (run !== r) return;
        r.phase = "trace";
        traceTick();
      });
    }, STEP_MS * 0.6);
  }

  function traceTick() {
    var r = run;
    if (!r || r.phase !== "trace") return;
    if (r.shown < r.fan.length) {
      var e = r.fan[r.shown];
      if (r.placed <= e.piece) { while (r.placed <= e.piece) r.placed++; placeUpTo(r.placed); syncTray(); }
      r.sum += cross(e.a, e.b);
      r.shown += 1;
      pill.textContent = fmt(r.sum);
      chipArea.setAttribute("data-math-vars", JSON.stringify({ sum: fmt(r.sum) }));
      draw();
      timer = window.setTimeout(traceTick, EDGE_MS);
      return;
    }
    if (r.placed < r.tr.length) { r.placed = r.tr.length; placeUpTo(r.placed); }
    r.phase = "done";
    layout.dataset.phase = "done";
    engine.detectArea();
    r.flood = engine.getState().area;
    pill.textContent = fmt(r.flood);
    say(r.valid ? "dp.s.closed" : "dp.s.bound", { n: fmt(r.res.best) });
    compareWithLast(r);
    if (order.length === MIN_PIECES && letters(order) === SEED) invite();
    playing = false;
    syncTray(); syncControls(); draw();
  }

  // Same pieces, another order: the previous area, struck, beside the pill.
  function compareWithLast(r) {
    var set = order.slice().sort(function (a, b) { return a - b; }).join(",");
    prevEl.hidden = true;
    if (last && last.set === set && last.order !== letters(order) && last.area !== r.res.best) {
      var d = r.res.best - last.area;
      prevEl.innerHTML = "";
      var s = document.createElement("s"); s.textContent = fmt(last.area);
      var dd = document.createElement("span"); dd.className = d > 0 ? "up" : "down";
      dd.textContent = (d > 0 ? "+" : "−") + fmt(Math.abs(d));
      prevEl.appendChild(s); prevEl.appendChild(dd);
      prevEl.setAttribute("data-lab-tip", t("dp.prevTip", { a: fmt(last.area), b: fmt(r.res.best) }));
      prevEl.hidden = false;
    }
    last = { set: set, order: letters(order), area: r.res.best };
  }

  function invite() {
    var tray = $("piece-tray");
    tray.classList.remove("dp-invite");
    void tray.offsetWidth;
    tray.classList.add("dp-invite");
    window.setTimeout(function () { tray.classList.remove("dp-invite"); }, 2600);
  }

  // Signed triangle (start, a, b) in cells: doubled coordinates give 4x the
  // cross product, the triangle is half of it.
  function cross(a, b) {
    var sx = D.START.x, sy = D.START.y;
    return ((a[0] - sx) * (b[1] - sy) - (b[0] - sx) * (a[1] - sy)) / 8;
  }

  /* ---------- views ---------- */

  function dims() {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var r = layer.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width * dpr)), h: Math.max(1, Math.round(r.height * dpr)), dpr: dpr };
  }

  // A view fitting the start and the dots of layer i (null: the idle frame).
  function fitTo(i) {
    var sx = D.START.x / 2, sy = -D.START.y / 2;
    var b = { x0: sx - 4, x1: sx + 4, y0: sy - 4, y1: sy + 4 };
    if (i != null && run) {
      run.res.layers[i].forEach(function (st, k) {
        var u = D.unkey(k), x = u.x / 2, y = -u.y / 2;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      });
      b.x0 -= 1; b.x1 += 1; b.y0 -= 1; b.y1 += 1;
    }
    var d = dims(), pad = PAD * d.dpr;
    var bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    var scale = Math.min((d.w - 2 * pad) / bw, (d.h - 2 * pad) / bh);
    return { scale: scale, x: (d.w - bw * scale) / 2 - b.x0 * scale, y: (d.h - bh * scale) / 2 - b.y0 * scale };
  }

  // The engine's view, in the overlay's world.
  function engineView() {
    var v = engine.state.view;
    return { scale: v.scale, x: v.offsetX + ox * v.scale, y: v.offsetY + oy * v.scale };
  }

  function goView(target, animate, done) {
    window.cancelAnimationFrame(raf);
    if (!view || !animate) { view = target; tween = null; draw(); if (done) done(); return; }
    var from = view, t0 = performance.now(), veil0 = veil, veil1 = run && run.phase === "zoom" ? 0 : 1;
    tween = function (now) {
      var u = Math.min(1, (now - t0) / TWEEN_MS), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      view = { scale: from.scale + (target.scale - from.scale) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
      veil = veil0 + (veil1 - veil0) * e;
      draw();
      if (u < 1) raf = window.requestAnimationFrame(tween);
      else { tween = null; if (done) done(); }
    };
    raf = window.requestAnimationFrame(tween);
  }

  /* ---------- the engine board, for the fence ---------- */

  function fitEngineToFence(r) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    r.tr.forEach(function (pc) { pc.cells.forEach(function (c) {
      var x = c[0], y = -c[1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }); });
    var size = Math.max(9, Math.max(x1 - x0, y1 - y0) + 1 + 4);
    if (!engine || size !== boardSize) makeEngine(size);
    ox = Math.round((size - 1) / 2 - (x0 + x1) / 2);
    oy = Math.round((size - 1) / 2 - (y0 + y1) / 2);
    engine.clear();
  }

  function makeEngine(size) {
    if (engine) engine.destroy();
    boardSize = size;
    engine = PE.createPieceEngine({
      root: stage, canvas: board, tray: null, lattice: L, pieceSet: pieceSet,
      board: { size: size }, padding: PAD, enableKeys: false,
      callbacks: { onStatus: function () {}, onArea: function () { draw(); } }
    });
    engine.resize();
  }

  function placeUpTo(n) {
    var types = engine.state.pieceTypeMap, placed = [];
    for (var j = 0; j < n && j < run.tr.length; j++) {
      var pc = run.tr[j], name = LETTERS[pc.piece], type = types.get(name);
      var cells = pc.cells.map(function (c) { return { x: c[0] + ox, y: -c[1] + oy }; });
      var key = L.cellsKey(L._internals.anchorAtLexMin(cells));
      var vi = type.variants.findIndex(function (v) { return v.key === key; });
      var marker = cells.slice().sort(L.cellSort)[0];
      placed.push({ id: j + 1, typeId: name, variantIndex: vi, marker: marker });
    }
    engine.setState({ placedPieces: placed, selectedPieceId: null });
  }

  /* ---------- drawing ---------- */

  function sc(v) { return { x: v[0] / 2 * view.scale + view.x, y: -v[1] / 2 * view.scale + view.y }; }

  function draw() {
    if (!view) return;
    var d = dims();
    if (layer.width !== d.w) layer.width = d.w;
    if (layer.height !== d.h) layer.height = d.h;
    lctx.clearRect(0, 0, d.w, d.h);
    var r = run;
    if (veil > 0.001) {
      lctx.save();
      lctx.globalAlpha = veil;
      roundRect(0.5, 0.5, d.w - 1, d.h - 1, 12 * d.dpr);
      lctx.fillStyle = "#0f141c";
      lctx.fill();
      drawGrid(d);
      if (r && (r.phase === "layers" || r.phase === "none" || r.phase === "zoom")) {
        if (r.step > 1) drawLayer(r.res.layers[r.step - 1], 0.18, d.dpr);
        if (r.step > 0) drawLayer(r.res.layers[r.step], 1, d.dpr);
      }
      lctx.restore();
    }
    if (r && (r.phase === "trace" || r.phase === "done") && r.shown) drawFan(r, d.dpr);
    drawStart(d.dpr, r && (r.phase === "zoom" || r.phase === "trace" || r.phase === "done"));
    lctx.save();
    roundRect(0.5, 0.5, d.w - 1, d.h - 1, 12 * d.dpr);
    lctx.strokeStyle = "rgba(170,220,255,0.18)";
    lctx.lineWidth = d.dpr;
    lctx.stroke();
    lctx.restore();
  }

  function roundRect(x, y, w, h, rad) {
    lctx.beginPath();
    lctx.moveTo(x + rad, y);
    lctx.arcTo(x + w, y, x + w, y + h, rad);
    lctx.arcTo(x + w, y + h, x, y + h, rad);
    lctx.arcTo(x, y + h, x, y, rad);
    lctx.arcTo(x, y, x + w, y, rad);
    lctx.closePath();
  }

  // Cell boundaries sit at half-integers of the world (cell centres at integers).
  function drawGrid(d) {
    var s = view.scale;
    if (s < 3 * d.dpr) return;
    var x0 = Math.floor((-view.x) / s) - 1, x1 = Math.ceil((d.w - view.x) / s) + 1;
    var y0 = Math.floor((-view.y) / s) - 1, y1 = Math.ceil((d.h - view.y) / s) + 1;
    lctx.beginPath();
    for (var x = x0; x <= x1; x++) { var px = (x + 0.5) * s + view.x; lctx.moveTo(px, 0); lctx.lineTo(px, d.h); }
    for (var y = y0; y <= y1; y++) { var py = (y + 0.5) * s + view.y; lctx.moveTo(0, py); lctx.lineTo(d.w, py); }
    lctx.strokeStyle = "rgba(90,112,143," + Math.min(0.55, 0.12 + s / (60 * d.dpr)).toFixed(2) + ")";
    lctx.lineWidth = d.dpr;
    lctx.stroke();
  }

  function drawLayer(lay, strength, dpr) {
    var best = new Map(), lo = Infinity, hi = -Infinity;
    lay.forEach(function (st, k) {
      var u = D.unkey(k), pk = u.x + "," + u.y, cur = best.get(pk);
      if (cur === undefined || st.v > cur.v) best.set(pk, { v: st.v, x: u.x, y: u.y });
    });
    best.forEach(function (b) { if (b.v < lo) lo = b.v; if (b.v > hi) hi = b.v; });
    var rad = Math.max(2 * dpr, Math.min(view.scale * 0.17, 7 * dpr));
    best.forEach(function (b) {
      var p = sc([b.x, b.y]), w = hi > lo ? (b.v - lo) / (hi - lo) : 1;
      lctx.beginPath();
      lctx.arc(p.x, p.y, rad * (0.6 + 0.4 * w), 0, Math.PI * 2);
      lctx.fillStyle = "rgba(255,216,74," + (strength * (0.25 + 0.75 * w)).toFixed(3) + ")";
      lctx.fill();
    });
  }

  function drawFan(r, dpr) {
    var o = sc([D.START.x, D.START.y]), alpha = r.phase === "done" ? 0.12 : 0.28;
    for (var k = 0; k < r.shown; k++) {
      var e = r.fan[k], a = sc(e.a), b = sc(e.b), s = cross(e.a, e.b);
      if (!s) continue;
      lctx.beginPath(); lctx.moveTo(o.x, o.y); lctx.lineTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.closePath();
      lctx.fillStyle = s > 0 ? "rgba(0,209,255," + alpha + ")" : "rgba(255,59,212," + alpha + ")";
      lctx.fill();
    }
    lctx.beginPath();
    for (var k2 = 0; k2 < r.shown; k2++) {
      var a2 = sc(r.fan[k2].a), b2 = sc(r.fan[k2].b);
      if (k2 === 0) lctx.moveTo(a2.x, a2.y);
      lctx.lineTo(b2.x, b2.y);
    }
    lctx.strokeStyle = "rgba(255,255,255,0.9)";
    lctx.lineWidth = Math.max(1.5 * dpr, view.scale * 0.07);
    lctx.lineJoin = "round";
    lctx.stroke();
  }

  function drawStart(dpr, lit) {
    var p = sc([D.START.x, D.START.y]);
    var rad = Math.min(14 * dpr, Math.max(5 * dpr, view.scale * 0.36));
    lctx.beginPath();
    lctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    lctx.lineWidth = Math.max(1.5 * dpr, Math.min(3 * dpr, view.scale * 0.09));
    lctx.strokeStyle = lit ? "#ffd84a" : "rgba(255,255,255,0.85)";
    lctx.stroke();
    if (lit) {
      lctx.beginPath();
      lctx.arc(p.x, p.y, rad * 0.45, 0, Math.PI * 2);
      lctx.fillStyle = "#ffd84a";
      lctx.fill();
    }
  }

  /* ---------- controls, chips, status ---------- */

  function fact(n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f; }
  function orderCount(n) { return n < 3 ? 1 : fact(n - 1) / 2; }
  function locale() { var l = window.i18n ? window.i18n.get() : "en"; return l === "en" ? "en-US" : l; }
  function fmt(n) { return Number(n).toLocaleString(locale(), { maximumFractionDigits: 1 }); }
  function plural(n, one, many) { return t(n === 1 ? one : many); }
  function say(k, v) { statusEl.textContent = t(k, v); }

  function setDisabled(el, off, tipKey) {
    if (off) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
    if (tipKey) {
      var tip = t(off ? tipKey + "Off" : tipKey);
      el.setAttribute("aria-label", tip);
      el.setAttribute("data-lab-tip", tip);
    }
  }

  function corners(lay) {
    var s = new Set();
    lay.forEach(function (st, k) { var u = D.unkey(k); s.add(u.x + "," + u.y); });
    return s.size;
  }

  function syncControls() {
    var n = order.length, r = run;
    setDisabled($("dp-step"), n < MIN_PIECES, "dp.stepTip");
    setDisabled($("dp-shuffle"), n < 4, "dp.shuffleTip");
    setDisabled($("dp-clear"), n === 0);
    var pb = $("dp-play");
    setDisabled(pb, n < MIN_PIECES, playing ? "dp.pauseTip" : "dp.playTip");
    pb.setAttribute("data-playing", playing ? "true" : "false");
    ["worst", "best"].forEach(function (w) {
      var b = $("dp-" + w), on = loaded === w;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var tip = t(on ? "dp.backTip" : "dp." + w + "Tip");
      b.setAttribute("aria-label", tip);
      b.setAttribute("data-lab-tip", tip);
    });

    chipOrders.hidden = n < 4;
    chipOrders.setAttribute("data-math", n === 12 ? "m.orders12" : "m.orders");
    chipOrders.setAttribute("data-math-src", "m.orders.src");
    chipOrders.setAttribute("data-math-vars", JSON.stringify({ n: n, count: orderCount(n).toLocaleString(locale()), all: (19958400).toLocaleString(locale()) }));

    var phase = r ? r.phase : "idle";
    var showLayer = r && r.step > 0;
    chipLayer.hidden = !showLayer;
    if (showLayer) {
      var key = phase === "done" ? (r.valid ? "m.close" : "m.bound") : phase === "none" ? "m.none" : "m.layer";
      chipLayer.setAttribute("data-math", key);
      chipLayer.setAttribute("data-math-src", "m.layer.src");
      var i = Math.min(r.step, n), lay = r.res.layers[i], st = lay.size, co = corners(lay);
      chipLayer.setAttribute("data-math-vars", JSON.stringify({
        i: i, n: n, tried: r.res.tried[i].toLocaleString(locale()),
        states: st.toLocaleString(locale()), statesWord: plural(st, "dp.state1", "dp.stateN"),
        corners: co.toLocaleString(locale()), cornersWord: plural(co, "dp.corner1", "dp.cornerN"),
        best: r.res.best != null ? fmt(r.res.best) : "", flood: r.flood != null ? fmt(r.flood) : ""
      }));
    }
    chipArea.hidden = !(r && (phase === "trace" || phase === "done"));
    if (r) chipArea.setAttribute("data-math-vars", JSON.stringify({ sum: fmt(r.sum) }));
    chipWorst.hidden = loaded !== "worst";
    chipBest.hidden = loaded !== "best";
    if (!r || phase !== "done") prevEl.hidden = true;
  }

  function shuffle() {
    if (order.length < 4) return;
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), tmp = order[i];
      order[i] = order[j]; order[j] = tmp;
    }
    loaded = null; own = null;
    resetRun();
  }

  function reveal(which) {
    if (loaded === which) {
      var back = own; own = null; loaded = null;
      if (back) { order = back.slice(); resetRun(); }
      return;
    }
    if (!loaded) own = order.slice();
    setOrder(window.DP_ORDERS[which], which);
    play();
  }

  function bind() {
    $("dp-step").addEventListener("click", function () { stopTimers(); step(); });
    $("dp-play").addEventListener("click", play);
    $("dp-shuffle").addEventListener("click", shuffle);
    $("dp-clear").addEventListener("click", function () { order = []; loaded = null; own = null; last = null; resetRun(); });
    $("dp-worst").addEventListener("click", function () { reveal("worst"); });
    $("dp-best").addEventListener("click", function () { reveal("best"); });
    document.querySelectorAll(".math-chip").forEach(function (c) {
      if (!c.hasAttribute("data-math-src")) c.setAttribute("data-math-src", c.getAttribute("data-math") + ".src");
    });
    document.querySelectorAll("[data-lang-btn]").forEach(function (b) {
      b.addEventListener("click", function () { if (window.i18n) window.i18n.setLang(b.getAttribute("data-lang-btn")); });
    });
    document.addEventListener("fc-langchange", function () {
      syncTray(); syncControls();
      if (run && run.phase === "done") pill.textContent = fmt(run.flood);
      else if (run && run.phase === "trace") pill.textContent = fmt(run.sum);
    });
    document.addEventListener("keydown", function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || e.target.getAttribute && e.target.getAttribute("role") === "link") return;
      if (e.key === " ") { e.preventDefault(); stopTimers(); step(); }
      else if (e.key === "Enter") { e.preventDefault(); play(); }
    });
    var rq = 0;
    new ResizeObserver(function () {
      if (rq) return;
      rq = window.requestAnimationFrame(function () {
        rq = 0;
        if (!run || run.phase === "layers" || run.phase === "none") view = fitTo(run && run.step ? run.step : null);
        else if (engine && run.phase !== "zoom") { engine.resize(); view = engineView(); }
        draw();
      });
    }).observe(layer);
  }

  makeEngine(9);
  buildTray();
  bind();
  setOrder(SEED);

  window.dpLab = {
    get order() { return letters(order); },
    get run() { return run; },
    get engine() { return engine; },
    get playing() { return playing; },
    setOrder: setOrder, step: step, play: play
  };
})();

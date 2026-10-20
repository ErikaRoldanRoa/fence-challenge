/* Fence Challenge · contest mode (CIRM, 19-22.10.2026). Inert unless this phone came through a
 * contest page (localStorage "fc-contest"). Each new record of a closed fence, per board, is kept on
 * the phone and queued; cigales/sync.html (same origin, loaded hidden) sends the queue, so the hub
 * itself keeps connect-src 'none'. A new personal best is a party (confetti and a line, on the phone); when the server says
 * it is the best so far of that board among all players (cigales/sync.html passes it on), a trophy. The contest ends on
 * Thursday 22.10.2026 at 19:30, Zurich time: the server refuses records from then on, the badge says so. */
(() => {
  "use strict";
  // Loaded by the hub (index.html) and by the three labs of the printed boards (data-board sq20, hex6, tri10).
  const VERSION = "2026-10-20a"; // = cigales/version.txt, bumped with every contest release
  const me = document.currentScript;
  const ROOT = me ? new URL(".", me.src).href : "";
  const LAB = me && me.dataset.board;
  let ctx = null;
  try { ctx = JSON.parse(localStorage.getItem("fc-contest") || "null"); } catch (e) { ctx = null; }
  if (!ctx || !ctx.workshop || !ctx.device || !ctx.name) return;
  const BEST = "fc-contest-best-" + ctx.workshop, QUEUE = "fc-contest-queue";
  const ENDS = Date.parse("2026-10-22T19:30:00+02:00");
  const over = () => Date.now() >= ENDS;
  const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LANG = (() => { let l = ""; try { l = localStorage.getItem("fc-lang") || ""; } catch (e) {} l = (l || navigator.language || "fr").slice(0, 2).toLowerCase(); return l === "de" || l === "en" ? l : "fr"; })();
  const TXT = {
    fr: { first: "Première clôture !", record: "Record battu !", was: "avant", trophy: "Meilleur du concours", tap: "touche pour continuer", over: "Concours terminé", record_: "record",
      boards: { sq: "damier 9 × 9", hex: "nid d’abeilles", tri: "champ de triangles", sq20: "grand damier 20 × 20", hex6: "grand hexagone", tri10: "grand triangle" } },
    en: { first: "First fence!", record: "New record!", was: "was", trophy: "Best of the contest", tap: "tap to continue", over: "Contest over", record_: "record",
      boards: { sq: "checkerboard 9 × 9", hex: "honeycomb", tri: "triangle field", sq20: "big board 20 × 20", hex6: "big hexagon", tri10: "big triangle" } },
    de: { first: "Erster Zaun!", record: "Neuer Rekord!", was: "vorher", trophy: "Bestwert des Wettbewerbs", tap: "tippen zum Weitermachen", over: "Wettbewerb beendet", record_: "Rekord",
      boards: { sq: "Schachbrett 9 × 9", hex: "Bienenwabe", tri: "Dreiecksfeld", sq20: "großes Brett 20 × 20", hex6: "großes Sechseck", tri10: "großes Dreieck" } },
  }[LANG];
  const held = {};   // the boards on which this phone holds the best record so far (the server's last word)
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const best = read(BEST, {});

  const css = document.createElement("style");
  css.textContent = ".fc-contest{position:fixed;left:8px;top:8px;z-index:50;display:flex;align-items:center;gap:8px;" +
    "padding:6px 14px;border-radius:999px;background:rgba(13,17,23,.92);border:2px solid #ffd24a;color:#fff;font:700 14px/1.2 Manrope,system-ui,sans-serif;" +
    "text-decoration:none;box-shadow:0 0 18px -6px #ffd24a;white-space:nowrap;max-width:calc(100vw - 180px);overflow:hidden;text-overflow:ellipsis}" +
    ".pCard .icon.kit,.pCard .pMenuSep{display:none!important}" +
    ".pCard .pStatus{position:sticky;bottom:8px;z-index:6;padding:6px;margin:0 -6px;border-radius:999px;background:rgba(13,17,23,.88);backdrop-filter:blur(4px)}" +
    (LAB ? ".fc-contest{left:50%;top:auto;bottom:6px;transform:translateX(-50%);max-width:calc(100vw - 24px)}.fc-contest.pop{animation:none}" : "") +
    ".fc-contest.upd{border-color:#6dff7a;box-shadow:0 0 22px -4px #6dff7a}" +
    ".fc-contest b{color:#ffd24a}.fc-contest.pop{animation:fcpop .7s}@keyframes fcpop{30%{transform:scale(1.15)}}" +
    ".fc-party{position:fixed;left:50%;top:13%;transform:translateX(-50%);z-index:72;pointer-events:none;padding:10px 22px;border-radius:999px;" +
    "background:rgba(13,17,23,.95);border:3px solid #ffd24a;color:#fff;font:800 21px/1.25 Manrope,system-ui,sans-serif;text-align:center;box-shadow:0 0 38px -4px #ffd24a;" +
    "max-width:calc(100vw - 24px);animation:fcparty 2.9s both}.fc-party b{color:#ffd24a}.fc-party small{display:block;font:600 12px/1.3 Manrope,system-ui,sans-serif;opacity:.7}" +
    "@keyframes fcparty{0%{transform:translateX(-50%) scale(.4);opacity:0}12%{transform:translateX(-50%) scale(1.12);opacity:1}22%{transform:translateX(-50%) scale(1)}85%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-14px)}}" +
    ".fc-trophy{position:fixed;inset:0;z-index:73;display:grid;place-items:center;background:rgba(5,8,12,.74);cursor:pointer;animation:fcfade .3s both}" +
    ".fc-trophy .tc{display:grid;gap:6px;justify-items:center;text-align:center;padding:22px 28px;border-radius:26px;background:rgba(13,17,23,.97);border:3px solid #ffd24a;" +
    "box-shadow:0 0 70px -6px #ffd24a;color:#fff;font:700 18px/1.3 Manrope,system-ui,sans-serif;max-width:min(88vw,420px)}" +
    ".fc-trophy .t{font-size:min(26vmin,140px);line-height:1;filter:drop-shadow(0 0 22px rgba(255,210,74,.75));animation:fctro 1.8s ease-in-out infinite}" +
    ".fc-trophy b{color:#ffd24a;font-size:24px}.fc-trophy small{opacity:.7;font-size:12px;margin-top:8px}" +
    "@keyframes fctro{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-8px) rotate(4deg)}}@keyframes fcfade{from{opacity:0}to{opacity:1}}" +
    "@media (prefers-reduced-motion:reduce){.fc-party,.fc-trophy,.fc-trophy .t{animation:none!important}}";
  document.head.appendChild(css);
  const badge = document.createElement("a");
  badge.className = "fc-contest";
  badge.href = ctx.back ? new URL(ctx.back, location.origin).href : ROOT + "cigales/";
  const show = (board) => {
    if (badge.classList.contains("upd")) return;
    const n = board ? best[board] : Math.max(0, ...Object.values(best));
    const cup = (board ? held[board] : Object.values(held).some(Boolean)) ? " 🏆" : "";
    badge.innerHTML = "🏁 " + ctx.name.replace(/[<>&]/g, "") + (over() ? " · " + TXT.over : n ? " · " + TXT.record_ + " <b>" + n + "</b>" + cup : " · concours");
  };
  show(LAB);

  const frame = document.createElement("iframe");
  frame.src = ROOT + "cigales/sync.html";
  frame.title = "";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px";
  const mount = () => {
    document.body.appendChild(badge);
    document.body.appendChild(frame);
    // The big boards are open from the start in the contest: no small board to play first.
    for (const a of document.querySelectorAll("a[data-launch]")) { a.classList.add("unlocked"); a.removeAttribute("aria-disabled"); }
    // Straight to the first board when coming from the contest page.
    if (location.hash === "#jouer") {
      const first = document.querySelector('[data-tiling="sq"]');
      if (first) setTimeout(() => first.scrollIntoView({ block: "start", behavior: "smooth" }), 300);
    }
  };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  // The camera reads whichever printed board is in view: another board's marks take the phone to
  // that board's own place, its camera open (19.10: the 9 x 9 and the 20 x 20 from the same button).
  const placeOf = (sheetId) => {
    const B = window.FenceBoards;
    const id = B && B.current ? B.current(sheetId) : sheetId;
    const b = B && B.get && B.get(id);
    if (!b || !b.home) return "";
    return b.home.page === "hub" ? ROOT + "index.html#camera=" + b.home.card : ROOT + b.home.page + "/index.html#camera";
  };
  const wrapInboard = (I) => {
    if (!I || typeof I.open !== "function" || I._contest) return I;
    const open = I.open;
    I.open = function (opts) {
      const o = Object.assign({}, opts);
      const own = opts && opts.onSheet;
      o.onSheet = (sheetId) => {
        const B = window.FenceBoards;
        const here = B && B.current ? B.current(o.boardId) : o.boardId;
        const there = B && B.current ? B.current(sheetId) : sheetId;
        const go = there && there !== here && placeOf(sheetId);
        if (go) { location.assign(go); return; }
        if (own) own(sheetId);
      };
      return open.call(this, o);
    };
    I._contest = true;
    return I;
  };
  if (window.FenceInboard) wrapInboard(window.FenceInboard);
  else {
    let held;
    try {
      Object.defineProperty(window, "FenceInboard", { configurable: true, enumerable: true,
        get: () => held, set: (v) => { held = wrapInboard(v); } });
    } catch (e) {}
  }

  // In a lab: every verdict goes through the shared rule (fence-analysis.js), on screen or by the
  // camera; once the board has been still for a moment, a closed fence is a candidate record.
  if (LAB && window.FenceAnalysis && typeof window.FenceAnalysis.analyze === "function") {
    const analyze = window.FenceAnalysis.analyze;
    // The camera judges every frame: the same fence again keeps its pending count, so a fence
    // held under the camera is counted 900 ms after it is first seen.
    let timer = 0, pending = 0;
    window.FenceAnalysis.analyze = function () {
      const r = analyze.apply(this, arguments);
      try {
        const fence = r && r.area >= 1 && r.regionCount === 1 && !r.cornerLeak;
        if (fence && r.area === pending) return r;
        clearTimeout(timer);
        pending = fence ? r.area : 0;
        if (fence) timer = setTimeout(() => { pending = 0; window.FenceContest.note(LAB, r.area); }, 900);
      } catch (e) {}
      return r;
    };
  }

  // The party: confetti over the screen for a couple of seconds (nothing but the words when the phone asks for less motion) and a line.
  const COLORS = ["#ff5d62", "#ff9f3f", "#ffd24a", "#c8ec3a", "#1fcf5b", "#12c4b0", "#38d9ff", "#6fa8ff", "#a778fb", "#f742dd"];
  function confetti(strong) {
    if (REDUCED || !document.body) return;
    const cv = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.className = "fc-confetti";
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:71;pointer-events:none";
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    document.body.appendChild(cv);
    const ps = Array.from({ length: strong ? 150 : 100 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.35, y: H * 0.3, vx: (Math.random() - 0.5) * 15, vy: -4 - Math.random() * 15,
      w: 6 + Math.random() * 6, h: 10 + Math.random() * 8, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: COLORS[(Math.random() * COLORS.length) | 0] }));
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / 2500;
      if (k >= 1 || !cv.isConnected) { cv.remove(); return; }
      g.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += 0.55; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.min(1, 2 * (1 - k)); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      requestAnimationFrame(frame);
    })(t0);
  }
  const buzz = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} };
  function party(board, area, was) {
    if (!document.body) return;
    confetti(false);
    buzz([70, 40, 70]);
    for (const old of document.querySelectorAll(".fc-party")) old.remove();
    const el = document.createElement("div");
    el.className = "fc-party";
    el.setAttribute("role", "status");
    el.dataset.board = board;
    el.dataset.kind = was ? "record" : "first";
    el.innerHTML = "🎉 " + (was ? TXT.record : TXT.first) + " <b>" + area + "</b>" + (was ? "<small>" + TXT.was + " " + was + "</small>" : "");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2950);
  }
  // The trophy: the best record so far of the board among all players (the server compares; the first player to reach the top keeps it on a tie).
  function trophy(board, area) {
    if (!document.body) return;
    confetti(true);
    buzz([90, 50, 90, 50, 180]);
    for (const old of document.querySelectorAll(".fc-party, .fc-trophy")) old.remove();
    const el = document.createElement("div");
    el.className = "fc-trophy";
    el.setAttribute("role", "status");
    el.dataset.board = board;
    el.innerHTML = '<div class="tc"><div class="t" aria-hidden="true">🏆</div><b>' + TXT.trophy + "</b><span>" + (TXT.boards[board] || board) + " · <b>" + area + "</b></span><small>" + TXT.tap + "</small></div>";
    el.addEventListener("click", () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }
  // What the sync page learnt from the server about a record just sent, and the end of the contest.
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    const r = e.data.fcRank;
    if (r && typeof r.board === "string") {
      held[r.board] = !!r.leader;
      if (r.leader && r.record) trophy(r.board, r.area);
      show(LAB);
    }
    if (e.data.fcClosed) { for (const k of Object.keys(held)) held[k] = false; show(LAB); }
  });

  // A newer site: the badge turns into « 🔄 mise à jour », one tap reloads (pseudonym and records stay on the phone).
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data.fcVersion !== "string" || e.data.fcVersion === VERSION) return;
    badge.innerHTML = "🔄 <b>mise à jour</b> · update";
    badge.classList.add("upd");
    badge.onclick = (ev) => { ev.preventDefault(); location.reload(); };
  });

  window.FenceContest = {
    placeOf,
    note(board, area) {
      if (over() || !(area > (best[board] || 0))) return;
      const was = best[board] || 0;
      best[board] = area;
      write(BEST, best);
      const q = read(QUEUE, []).filter((r) => !(r.workshop === ctx.workshop && r.board === board));
      q.push({ workshop: ctx.workshop, board, area });
      write(QUEUE, q);
      show(board);
      badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
      party(board, area, was);
      try { frame.contentWindow.postMessage("fc-contest-sync", location.origin); } catch (e) {}
    },
  };
})();

/* Fence Challenge · contest mode (CIRM, 19-22.10.2026). Inert unless this phone came through a
 * contest page (localStorage "fc-contest"). Each new record of a closed fence, per board, is kept on
 * the phone and queued; cigales/sync.html (same origin, loaded hidden) sends the queue, so the hub
 * itself keeps connect-src 'none'. */
(() => {
  "use strict";
  // Loaded by the hub (index.html) and by the three labs of the printed boards (data-board sq20, hex6, tri10).
  const me = document.currentScript;
  const ROOT = me ? new URL(".", me.src).href : "";
  const LAB = me && me.dataset.board;
  let ctx = null;
  try { ctx = JSON.parse(localStorage.getItem("fc-contest") || "null"); } catch (e) { ctx = null; }
  if (!ctx || !ctx.workshop || !ctx.device || !ctx.name) return;
  const BEST = "fc-contest-best-" + ctx.workshop, QUEUE = "fc-contest-queue";
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
    ".fc-contest b{color:#ffd24a}.fc-contest.pop{animation:fcpop .7s}@keyframes fcpop{30%{transform:scale(1.15)}}";
  document.head.appendChild(css);
  const badge = document.createElement("a");
  badge.className = "fc-contest";
  badge.href = ctx.back ? new URL(ctx.back, location.origin).href : ROOT + "cigales/";
  const show = (board) => {
    const n = board ? best[board] : Math.max(0, ...Object.values(best));
    badge.innerHTML = "🏁 " + ctx.name.replace(/[<>&]/g, "") + (n ? " · record <b>" + n + "</b>" : " · concours");
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

  // In a lab: every verdict goes through the shared rule (fence-analysis.js), on screen or by the
  // camera; once the board has been still for a moment, a closed fence is a candidate record.
  if (LAB && window.FenceAnalysis && typeof window.FenceAnalysis.analyze === "function") {
    const analyze = window.FenceAnalysis.analyze;
    let timer = 0;
    window.FenceAnalysis.analyze = function () {
      const r = analyze.apply(this, arguments);
      try {
        clearTimeout(timer);
        if (r && r.area >= 1 && r.regionCount === 1 && !r.cornerLeak) {
          const area = r.area;
          timer = setTimeout(() => window.FenceContest.note(LAB, area), 900);
        }
      } catch (e) {}
      return r;
    };
  }

  window.FenceContest = {
    note(board, area) {
      if (!(area > (best[board] || 0))) return;
      best[board] = area;
      write(BEST, best);
      const q = read(QUEUE, []).filter((r) => !(r.workshop === ctx.workshop && r.board === board));
      q.push({ workshop: ctx.workshop, board, area });
      write(QUEUE, q);
      show(board);
      badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
      try { frame.contentWindow.postMessage("fc-contest-sync", location.origin); } catch (e) {}
    },
  };
})();

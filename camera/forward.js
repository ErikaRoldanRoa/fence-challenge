/* Fence Challenge · where a printed sheet's QR code leads.
 *
 * Every printed sheet carries a QR code to camera/?board=<id>. A board is
 * played in its own place, a hub card or a lab: this page goes there at once,
 * and that place opens its camera inside the board (index.html#camera=<card>,
 * <lab>/index.html#camera). A sheet printed before goes to the board it is
 * played on today. camera/ without a board, and a board with no place of its
 * own, stay on this page; so does camera/?board=<id>&stay.
 *
 * Runs in the head, after the lattice modules and boards.js, before anything
 * else on this page starts.
 */
(function () {
  "use strict";
  try {
    const Boards = window.FenceBoards;
    if (!Boards || typeof Boards.get !== "function" || typeof Boards.current !== "function") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("stay")) return;
    const asked = params.get("board");
    if (!asked || !Boards.get(asked)) return;
    const now = Boards.current(asked);
    const def = now ? Boards.get(now) : null;
    // only the boards the kit prints today have a place of their own
    if (!def || !def.layout || def.layout.v !== 2) return;
    const home = def.home || {};
    let to = null;
    if (home.page === "hub" && /^(sq|hex|tri)$/.test(home.card || "")) to = "../index.html#camera=" + home.card;
    else if (/^(square|hex|triangle)-lab$/.test(home.page || "")) to = "../" + home.page + "/index.html#camera";
    if (to) window.location.replace(to);
  } catch (e) {
    /* anything unexpected: this page's own camera */
  }
})();

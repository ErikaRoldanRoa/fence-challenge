/* Fence Challenge · where a printed sheet's QR code leads.
 *
 * Every printed sheet carries a QR code to camera/?board=<id>. A board is
 * played in its own place, a hub card or a lab: this page goes there at once,
 * and that place opens its camera inside the board (index.html#camera=<card>,
 * <lab>/index.html#camera). A sheet printed before goes to the board it is
 * played on today. camera/ without a board, and a board with no place of its
 * own, stay on this page; so does camera/?board=<id>&stay.
 *
 * The first script of the page, before any stylesheet, so that the forward
 * waits for nothing else. The table is the registry's answer
 * (FenceBoards.current(id) -> its home) written out; window.FenceForward
 * exposes it so that it can be checked against camera/boards.js. When the
 * page stays, its own scripts (SCRIPTS, every script of index.html after
 * this one, in order) are asked for at once instead of one after the other.
 */
(function () {
  "use strict";
  const HUB = "../index.html#camera=";
  const PLACE = {
    sq9: HUB + "sq",
    hex5: HUB + "hex",
    tri4: HUB + "tri",
    sq20: "../square-lab/index.html#camera",
    hex6: "../hex-lab/index.html#camera",
    tri10: "../triangle-lab/index.html#camera",
    "sq9-v1": HUB + "sq",
    hex4: HUB + "hex",
    "tri4-v1": HUB + "tri",
    "sq20-v1": "../square-lab/index.html#camera",
    "hex6-v1": "../hex-lab/index.html#camera",
    tri13: "../triangle-lab/index.html#camera",
  };
  const SCRIPTS = [
    "../i18n.js",
    "i18n.js",
    "../lattice-square.js",
    "../lattice-hex.js",
    "../lattice-triangular.js",
    "../fence-analysis.js",
    "../vendor/js-aruco2/cv.js",
    "../vendor/js-aruco2/aruco.js",
    "../vendor/js-aruco2/dictionaries/aruco_4x4_1000.js",
    "../vendor/qrcode-generator/qrcode.js",
    "boards.js",
    "core.js",
    "view.js",
  ];
  window.FenceForward = { PLACE, SCRIPTS };
  try {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get("board");
    if (!params.has("stay") && asked && Object.prototype.hasOwnProperty.call(PLACE, asked)) {
      window.location.replace(PLACE[asked]);
      return;
    }
  } catch (e) {
    /* anything unexpected: this page's own camera */
  }
  try {
    const head = document.head || document.getElementsByTagName("head")[0];
    for (const href of SCRIPTS) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "script";
      link.href = href;
      head.appendChild(link);
    }
  } catch (e) {
    /* the scripts still load, one after the other */
  }
})();

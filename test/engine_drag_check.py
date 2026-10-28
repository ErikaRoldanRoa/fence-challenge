"""A dragged piece of the home page's three cards keeps its place under the finger.

A piece is taken by its far end (a cell that is not the piece's anchor) and dragged a few cells with a finger on a
phone and with a mouse on a laptop; the cell taken must end where the finger went, to within the rounding of the
tiling (a triangle card moves its pieces on a sparser set of places, so it may end one step off).

Usage: python3 test/engine_drag_check.py BASE_URL
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/). Needs playwright. Exits 1 on a failure.
FC_BROWSER=webkit runs it in the engine of Safari (the default is chromium).
"""
import math
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
ENGINE = os.environ.get("FC_BROWSER", "chromium")
# card -> the farthest the cell taken may end from the finger, in steps between two cells
CARDS = {"sq": 0.1, "hex": 0.6, "tri": 1.05}
fails = []

PIECE = """(id) => {
  const root = document.getElementById('engine-' + id), eng = root._engine, st = eng.state, lat = eng.lattice;
  const p = st.placedPieces[0]; if (!p) return null;
  const variant = st.pieceTypeMap.get(p.typeId).variants[p.variantIndex];
  const cells = variant.cells.map((c) => lat.translateCell(c, p.marker));
  const canvas = root.querySelector('canvas'), r = canvas.getBoundingClientRect(), v = st.view, k = r.width / canvas.width;
  const pos = (c) => { const e = st.board.map.get(lat.cellKey(c)); return { x: r.left + (e.centroid.x * v.scale + v.offsetX) * k, y: r.top + (e.centroid.y * v.scale + v.offsetY) * k }; };
  const all = cells.map(pos);
  let step = Infinity;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) step = Math.min(step, Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y));
  const far = all[all.length - 1];
  return { x: far.x, y: far.y, step, n: cells.length, onBoard: cells.every((c) => st.board.map.has(lat.cellKey(c))) };
}"""
SPAWN = "(id) => { const eng = document.getElementById('engine-' + id)._engine; eng.clear(); eng.spawnPiece(eng.pieceTypes[0].id); eng.render(); }"
# a piece that a turn changes (not the square tetromino, which is its own turn), and where its anchor cell stands on the screen
SPAWN_TURNING = "(id) => { const eng = document.getElementById('engine-' + id)._engine; eng.clear(); const t = eng.pieceTypes.find((q) => q.rotateMap[q.spawnVariant] !== q.spawnVariant); eng.spawnPiece(t.id); eng.render(); }"
MARKER = """(id) => {
  const root = document.getElementById('engine-' + id), eng = root._engine, st = eng.state, lat = eng.lattice;
  const p = st.placedPieces[0]; if (!p) return null;
  const canvas = root.querySelector('canvas'), r = canvas.getBoundingClientRect(), v = st.view, k = r.width / canvas.width;
  const e = st.board.map.get(lat.cellKey(p.marker));
  const own = st.pieceTypeMap.get(p.typeId).variants[p.variantIndex];
  const cells = own.cells.map((c) => st.board.map.get(lat.cellKey(lat.translateCell(c, p.marker))));
  let step = Infinity;
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) step = Math.min(step, Math.hypot(cells[i].centroid.x - cells[j].centroid.x, cells[i].centroid.y - cells[j].centroid.y) * v.scale * k);
  return { x: r.left + (e.centroid.x * v.scale + v.offsetX) * k, y: r.top + (e.centroid.y * v.scale + v.offsetY) * k, step };
}"""


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def touch_drag(page, a, b, steps=10):
    if ENGINE != "chromium":   # only Chromium takes touch events from a script: elsewhere a mouse drag stands in
        page.mouse.move(a[0], a[1])
        page.mouse.down()
        for k in range(1, steps + 1):
            page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps)
            page.wait_for_timeout(15)
        page.mouse.up()
        return
    cdp = page.context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": a[0], "y": a[1]}]})
    for k in range(1, steps + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": a[0] + (b[0] - a[0]) * k / steps, "y": a[1] + (b[1] - a[1]) * k / steps}]})
        page.wait_for_timeout(15)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    cdp.detach()


with sync_playwright() as pw:
    browser = getattr(pw, ENGINE).launch()
    for name, (w, h), touch in (("phone", (390, 844), True), ("laptop", (1280, 900), False)):
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "index.html")
        page.wait_for_timeout(1200)
        for card, limit in CARDS.items():
            page.evaluate("(id) => document.getElementById('engine-' + id).scrollIntoView({block: 'center'})", card)
            page.wait_for_timeout(300)
            page.evaluate(SPAWN, card)
            page.wait_for_timeout(200)
            g0 = page.evaluate(PIECE, card)
            check(g0 is not None and g0["onBoard"], f"[{name} {card}] a piece stands on the card's board")
            if not g0:
                continue
            a = (g0["x"], g0["y"])
            for dx, dy in ((2, 0), (-1, 1), (0, -2)):
                b = (a[0] + dx * g0["step"], a[1] + dy * g0["step"])
                if touch:
                    touch_drag(page, a, b)
                else:
                    page.mouse.move(*a)
                    page.mouse.down()
                    for k in range(1, 9):
                        page.mouse.move(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8)
                    page.mouse.up()
                page.wait_for_timeout(150)
                g1 = page.evaluate(PIECE, card)
                gap = math.hypot(g1["x"] - b[0], g1["y"] - b[1]) / g0["step"]
                check(g1["onBoard"] and gap <= limit, f"[{name} {card}] a drag of ({dx}, {dy}) steps: the cell taken ends {gap:.2f} step from the finger (at most {limit})")
                a = (g1["x"], g1["y"])
        if not touch:
            # a turn (the R key) while a piece is held keeps it where it is: it does not jump to the pointer
            for card in CARDS:
                page.evaluate("(id) => document.getElementById('engine-' + id).scrollIntoView({block: 'center'})", card)
                page.wait_for_timeout(250)
                page.evaluate(SPAWN_TURNING, card)
                page.wait_for_timeout(150)
                g = page.evaluate(PIECE, card)
                a = (g["x"], g["y"])
                page.mouse.move(*a)
                page.mouse.down()
                for k in range(1, 7):
                    page.mouse.move(a[0] + g["step"] * 1.0 * k / 6, a[1] + g["step"] * 0.5 * k / 6)
                page.wait_for_timeout(100)
                held = (a[0] + g["step"], a[1] + g["step"] * 0.5)
                page.keyboard.press("r")
                page.wait_for_timeout(100)
                m1 = page.evaluate(MARKER, card)
                page.mouse.move(held[0] + g["step"] * 0.15, held[1])      # a small move after the turn
                page.wait_for_timeout(100)
                m2 = page.evaluate(MARKER, card)
                page.mouse.up()
                jump = math.hypot(m2["x"] - m1["x"], m2["y"] - m1["y"]) / m1["step"]       # from where the turn left the anchor
                check(jump <= 1.2, f"[{name} {card}] a turn while the piece is held: its anchor moves {jump:.2f} step by the next small move (at most 1.2)")
        check(not errors, f"[{name}] no errors in the page {errors[:2]}")
        ctx.close()
    browser.close()

print("\n%d check(s) failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

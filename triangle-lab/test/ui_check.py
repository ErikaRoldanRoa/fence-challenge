"""Browser check of the triangle lab on phones, a tablet and a laptop, played like a visitor.

Usage: python3 ui_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots (English) go to OUTDIR.
"""
import itertools
import json
import math
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "triangle-lab/index.html"
fails = []

# name, width, height, touch, the least triangle edge in px (a finger is about 40 px wide)
VIEWS = [
    ("short phone", 390, 664, True, 19),
    ("tall phone", 390, 844, True, 21),
    ("small phone", 360, 640, True, 17),
    ("low phone", 390, 580, True, None),
    ("edge of short", 390, 679, True, None),
    ("edge of tall", 390, 680, True, None),
    ("middle phone", 390, 720, True, None),
    ("big phone", 412, 915, True, None),
    ("tablet", 820, 1180, True, None),
    ("laptop", 1400, 900, False, None),
    ("phone sideways", 844, 390, True, 12),
]
LANGS = ["en", "fr", "de"]
CONTROLS = ["#detect-area", ".langSel", "#rotate-piece", "#flip-piece", ".lab-nav a:nth-child(1)", ".lab-nav a:nth-child(2)", "#clear-board", "#camera-chip", ".side-brand"]

STATE = """() => {
  const e0 = state.boardCells[0].vertices;
  const world = Math.hypot(e0[0].x - e0[1].x, e0[0].y - e0[1].y);
  const r = dom.canvas.getBoundingClientRect();
  const q = (s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null;
                     const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
  return { cells: state.boardCells.length, edge: world * state.view.scale / state.view.dpr, canvas: [r.left, r.top, r.right, r.bottom],
           scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight,
           chips: Array.from(document.querySelectorAll('#piece-tray [data-type]')).map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }),
           controls: %s.map((s) => [s, q(s)]),
           camera: q('#camera-chip'), placed: state.placedPieces.length };
}""" % json.dumps(CONTROLS)

PIECE = """() => { const p = state.placedPieces[0]; if (!p) return null;
  const cells = pieceAbsoluteCells(p); const e = state.boardCellMap.get(cellKey(cells[0]));
  const pt = worldToCss(e.centroid); const r = dom.canvas.getBoundingClientRect();
  return { x: r.left + pt.x, y: r.top + pt.y, marker: p.marker, variant: p.variantIndex, onBoard: cells.every((c) => state.boardCellMap.has(cellKey(c))), n: cells.length }; }"""


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def overlap(a, b):
    return a and b and a[0] < b[2] - 0.5 and b[0] < a[2] - 0.5 and a[1] < b[3] - 0.5 and b[1] < a[3] - 0.5


def inside(a, w, h):
    return a[0] >= -0.5 and a[1] >= -0.5 and a[2] <= w + 0.5 and a[3] <= h + 0.5


def touch_drag(page, a, b, steps=10):
    cdp = page.context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": a[0], "y": a[1]}]})
    for k in range(1, steps + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": a[0] + (b[0] - a[0]) * k / steps, "y": a[1] + (b[1] - a[1]) * k / steps}]})
        page.wait_for_timeout(15)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    cdp.detach()


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for lang, (name, w, h, touch, least) in itertools.product(LANGS, VIEWS):
        label = f"{lang} {name} {w}x{h}"
        ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch, device_scale_factor=2)
        ctx.add_init_script("try{localStorage.setItem('fc-lang','%s')}catch(e){}" % lang)
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL)
        page.wait_for_selector("#piece-tray [data-type]")
        page.wait_for_timeout(450)
        s = page.evaluate(STATE)
        portrait_phone = touch and w < 500 and h > w
        check(not errors, f"[{label}] no errors in the console {errors[:2]}")
        check(s["cells"] == 384, f"[{label}] the board has 384 triangles")
        check(s["scrollW"] <= s["iw"] + 1, f"[{label}] nothing scrolls sideways")
        if portrait_phone:
            check(s["scrollH"] <= s["ih"] + 1, f"[{label}] a portrait phone shows everything with no scroll")
        if least:
            check(s["edge"] >= least, f"[{label}] a triangle edge is {s['edge']:.1f} px (at least {least})")
        check(len(s["chips"]) == 12 and all(inside(c, w, h) for c in s["chips"]), f"[{label}] twelve piece chips, all on the screen")
        if portrait_phone and h >= 640:
            small = min(min(c[2] - c[0], c[3] - c[1]) for c in s["chips"])
            check(small >= 36, f"[{label}] the smallest chip is {small:.0f} px (at least 36)")
        bad = [(i, j) for i, j in itertools.combinations(range(len(s["chips"])), 2) if overlap(s["chips"][i], s["chips"][j])]
        check(not bad, f"[{label}] no two chips overlap")
        check(not any(overlap(c, s["canvas"]) for c in s["chips"]) or not portrait_phone, f"[{label}] no chip lies on the board")
        shown = [(sel, r) for sel, r in s["controls"] if r]
        pairs = [(a[0], b[0]) for a, b in itertools.combinations(shown, 2) if overlap(a[1], b[1])]
        check(not pairs, f"[{label}] no two controls overlap {pairs[:2]}")
        check(all(inside(r, w, h) for _, r in shown), f"[{label}] every control is on the screen")
        hits = page.evaluate("""(sels) => sels.map((s) => { const e = document.querySelector(s); if (!e) return true;
            const b = e.getBoundingClientRect(); const t = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
            return !!t && (t === e || e.contains(t)); })""", [sel for sel, _ in shown])
        check(all(hits), f"[{label}] each control is hit at its centre")
        if lang == "en":
            page.screenshot(path=str(OUT / f"{name.replace(' ', '-')}.png"))

        # play: a chip puts its piece on the board, a drag moves it, rotate and flip turn it, erase empties the board
        chip = page.locator("#piece-tray [data-type]").first
        (chip.tap if touch else chip.click)()
        page.wait_for_timeout(150)
        p0 = page.evaluate(PIECE)
        check(p0 is not None and p0["n"] == 6 and p0["onBoard"], f"[{label}] a chip puts its piece, six triangles, on the board")
        if p0:
            # the piece keeps its place under the finger: it ends where the finger went, to within one lattice step
            a = (p0["x"], p0["y"])
            p1 = p0
            for dx, dy in ((3, 0), (-1.5, 2)):
                b = (a[0] + dx * s["edge"], a[1] + dy * s["edge"])
                if touch:
                    touch_drag(page, a, b)
                else:
                    page.mouse.move(*a)
                    page.mouse.down()
                    for k in range(1, 9):
                        page.mouse.move(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8)
                    page.mouse.up()
                page.wait_for_timeout(150)
                p1 = page.evaluate(PIECE)
                gap = math.hypot(p1["x"] - b[0], p1["y"] - b[1]) / s["edge"]
                check(p1 and p1["onBoard"] and gap <= 0.6, f"[{label}] a drag of ({dx}, {dy}) edges: the piece ends {gap:.2f} edge from the finger, on the board")
                a = (p1["x"], p1["y"])
            page.locator("#rotate-piece").tap() if touch else page.locator("#rotate-piece").click()
            page.wait_for_timeout(100)
            p2 = page.evaluate(PIECE)
            check(p2 and p2["onBoard"] and (p2["variant"], p2["marker"]) != (p1["variant"], p1["marker"]), f"[{label}] rotate turns the piece")
            page.locator("#flip-piece").tap() if touch else page.locator("#flip-piece").click()
            page.wait_for_timeout(100)
            p3 = page.evaluate(PIECE)
            check(p3 and p3["onBoard"], f"[{label}] flip keeps it on the board")
            for _ in range(2):  # the erase button asks for a second tap
                page.locator("#clear-board").tap() if touch else page.locator("#clear-board").click()
                page.wait_for_timeout(120)
            check(page.evaluate("state.placedPieces.length") == 0, f"[{label}] erase empties the board")
        ctx.close()
    browser.close()

print("\n%d check(s) failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

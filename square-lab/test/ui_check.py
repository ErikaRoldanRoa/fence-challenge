"""Browser check of the square lab on phones, a tablet and a laptop, played like a visitor.

Usage: python3 ui_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots (English) go to OUTDIR.
"""
import itertools
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "square-lab/index.html"
fails = []

# name, width, height, touch, the least cell the grid is drawn with, in px (a finger is about 40 px wide)
VIEWS = [
    ("short phone", 390, 664, True, 14),
    ("tall phone", 390, 844, True, 17),
    ("small phone", 360, 640, True, 13),
    ("low phone", 390, 580, True, None),
    ("edge of short", 390, 679, True, None),
    ("edge of tall", 390, 680, True, None),
    ("middle phone", 390, 720, True, None),
    ("big phone", 412, 915, True, 17),
    ("tablet", 820, 1180, True, None),
    ("laptop", 1400, 900, False, 30),
    ("phone sideways", 844, 390, True, 14),
    ("small phone sideways", 640, 360, True, None),
]
LANGS = ["en", "fr", "de"]
CONTROLS = ["#detect-game-area", ".langSel", "#rotate-piece", "#flip-piece", ".lab-nav a:nth-child(1)", ".lab-nav a:nth-child(2)",
            "#clear-board", "#camera-toggle", ".side-brand"]

# The grid is drawn by the lab the way it computes it (see renderGameBoard); the check reads what it drew.
STATE = """() => {
  const c = document.getElementById('game-board'), r = c.getBoundingClientRect();
  const W = Math.max(320, Math.floor(r.width)), H = Math.max(320, Math.floor(r.height));
  const pad = Math.max(4, Math.min(14, Math.floor(W * 0.02)));
  const cell = Math.max(8, Math.floor(Math.min((W - 2 * pad) / 20, (H - 2 * pad) / 20))) * r.width / W;
  const q = (s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null;
                     const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
  return { cell, canvas: [r.left, r.top, r.right, r.bottom], square: Math.abs(r.width - r.height) < 1,
           scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight,
           chips: Array.from(document.querySelectorAll('#piece-tray .piece-btn')).map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }),
           controls: %s.map((s) => [s, q(s)]),
           brand: document.querySelector('.side-brand').innerText.split('\\n').map((x) => x.trim()) };
}""" % json.dumps(CONTROLS)

# The cells the pieces cover, read from the pixels at each cell's centre (an empty cell is #121a26), and where the grid sits on the screen.
CELLS = """() => {
  const c = document.getElementById('game-board'), r = c.getBoundingClientRect(), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = Math.max(320, Math.floor(r.width)), H = Math.max(320, Math.floor(r.height));
  const pad = Math.max(4, Math.min(14, Math.floor(W * 0.02)));
  const cell = Math.max(8, Math.floor(Math.min((W - 2 * pad) / 20, (H - 2 * pad) / 20)));
  const ox = Math.floor((W - cell * 20) / 2), oy = Math.floor((H - cell * 20) / 2), scale = r.width / W;
  const cells = [];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const d = ctx.getImageData(Math.round((ox + (x + 0.5) * cell) * dpr), Math.round((oy + (y + 0.5) * cell) * dpr), 1, 1).data;
    if (Math.abs(d[0] - 18) + Math.abs(d[1] - 26) + Math.abs(d[2] - 38) > 60) cells.push([x, y]);
  }
  return { cells, cell: cell * scale, left: r.left + ox * scale, top: r.top + oy * scale };
}"""


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


def far_cell(cells):
    """The covered cell farthest from the piece's top-left corner: where a finger takes hold of it."""
    x0, y0 = min(c[0] for c in cells), min(c[1] for c in cells)
    return max(cells, key=lambda c: (c[0] - x0) + (c[1] - y0))


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
        page.wait_for_selector("#piece-tray .piece-btn")
        page.wait_for_timeout(450)
        s = page.evaluate(STATE)
        portrait_phone = touch and w < 500 and h > w
        check(not errors, f"[{label}] no errors in the console {errors[:2]}")
        check(s["square"], f"[{label}] the board is square")
        check(s["scrollW"] <= s["iw"] + 1, f"[{label}] nothing scrolls sideways")
        if portrait_phone:
            check(s["scrollH"] <= s["ih"] + 1, f"[{label}] a portrait phone shows everything with no scroll")
        if least:
            check(s["cell"] >= least, f"[{label}] a cell is drawn {s['cell']:.1f} px wide (at least {least})")
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
        check(not any(overlap(r, s["canvas"]) for sel, r in shown if sel != ".langSel" or portrait_phone), f"[{label}] no control lies on the board")
        hits = page.evaluate("""(sels) => sels.map((s) => { const e = document.querySelector(s); if (!e) return true;
            const b = e.getBoundingClientRect(); const t = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
            return !!t && (t === e || e.contains(t)); })""", [sel for sel, _ in shown])
        check(all(hits), f"[{label}] each control is hit at its centre")
        check(len(s["brand"]) == 2 and s["brand"][1] == "Dr. Erika Roldán", f"[{label}] the credit has the paper's line, and the author's name under it {s['brand']}")

        # where the area stands: low on a tall phone, between erase and the camera; in the top strip on a short one
        d = dict(shown)
        if portrait_phone and h >= 680:
            pill = d["#detect-game-area"]
            check(pill[1] > h / 2, f"[{label}] the area pill is low on a tall phone")
            if "#camera-toggle" in d and "#clear-board" in d:
                left, right = pill[0] - d["#clear-board"][2], d["#camera-toggle"][0] - pill[2]
                check(left > 0 and right > 0 and abs(left - right) < 8, f"[{label}] it stands in the middle of the room between erase and the camera ({left:.0f} | {right:.0f} px)")
        if portrait_phone and h < 680:
            check(d["#detect-game-area"][1] < 80, f"[{label}] the area pill stays in the top strip on a short phone")
        if lang == "en":
            page.screenshot(path=str(OUT / f"{name.replace(' ', '-')}.png"))

        # play: a chip puts its piece on the board, a drag moves it as far as the finger goes, rotate and flip turn it, erase empties the board
        chip = page.locator("#piece-tray .piece-btn").first
        (chip.tap if touch else chip.click)()
        page.wait_for_timeout(150)
        p0 = page.evaluate(CELLS)
        check(len(p0["cells"]) == 5, f"[{label}] a chip puts its piece, five cells, on the board")
        if len(p0["cells"]) == 5:
            cells = [tuple(c) for c in p0["cells"]]
            for dx, dy in ((3, 0), (-2, 2), (0, -3)):
                gx, gy = far_cell(cells)
                a = (p0["left"] + (gx + 0.5) * p0["cell"], p0["top"] + (gy + 0.5) * p0["cell"])
                b = (a[0] + dx * p0["cell"], a[1] + dy * p0["cell"])
                if touch:
                    touch_drag(page, a, b)
                else:
                    page.mouse.move(*a)
                    page.mouse.down()
                    for k in range(1, 9):
                        page.mouse.move(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8)
                    page.mouse.up()
                page.wait_for_timeout(150)
                p1 = page.evaluate(CELLS)
                moved = sorted((x + dx, y + dy) for x, y in cells)
                got = sorted(tuple(c) for c in p1["cells"])
                check(got == moved, f"[{label}] a drag of ({dx}, {dy}) cells by the piece's far end: the piece moves exactly as far as the finger")
                cells = got if got == moved else cells
            page.locator("#rotate-piece").tap() if touch else page.locator("#rotate-piece").click()
            page.wait_for_timeout(100)
            p2 = page.evaluate(CELLS)
            check(len(p2["cells"]) == 5 and sorted(map(tuple, p2["cells"])) != sorted(cells), f"[{label}] rotate turns the piece")
            page.locator("#flip-piece").tap() if touch else page.locator("#flip-piece").click()
            page.wait_for_timeout(100)
            check(len(page.evaluate(CELLS)["cells"]) == 5, f"[{label}] flip keeps the five cells on the board")
            for _ in range(2):  # the erase button asks for a second tap
                page.locator("#clear-board").tap() if touch else page.locator("#clear-board").click()
                page.wait_for_timeout(120)
            check(len(page.evaluate(CELLS)["cells"]) == 0, f"[{label}] erase empties the board")
        ctx.close()
    browser.close()

print("\n%d check(s) failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

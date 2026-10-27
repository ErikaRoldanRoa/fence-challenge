"""Browser check of the square lab on phones, a tablet and a laptop, played like a visitor.

Usage: python3 ui_check.py BASE_URL OUTDIR [cup]
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots (English) go to OUTDIR.
FC_BROWSER=webkit runs it in the engine of Safari (the default is chromium).
"""
import itertools
import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "square-lab/index.html"
ROOT = Path(__file__).resolve().parents[2]
ENGINE = os.environ.get("FC_BROWSER", "chromium")
ONLY_CUP = len(sys.argv) > 3 and sys.argv[3] == "cup"      # the trophy checks alone
STORE = "fc-trophies-sq12"
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
# the cup: not yet, won, and the sentence read out at the win
TEXT = {
    "en": ("Not yet the best fence of all", "The best fence of all", "Trophy won: the best fence of all."),
    "fr": ("Pas encore la meilleure barrière de toutes", "La meilleure barrière de toutes", "Trophée gagné\u202f: la meilleure barrière de toutes."),
    "de": ("Noch nicht der beste Zaun von allen", "Der beste Zaun von allen", "Pokal gewonnen: der beste Zaun von allen."),
}
CONTROLS = ["#detect-game-area", ".langSel", "#rotate-piece", "#flip-piece", ".lab-nav a:nth-child(1)", ".lab-nav a:nth-child(2)",
            "#clear-board", "#camera-toggle", ".side-brand", "#shelf"]

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
           brand: document.querySelector('.side-brand').textContent.split('\\n').map((x) => x.trim()),
           brandRows: (() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.side-brand')); return new Set(Array.from(r.getClientRects()).filter((q) => q.width > 0).map((q) => Math.round(q.top))).size; })() };
}""" % json.dumps(CONTROLS)

# The cells the pieces cover, read from the pixels at each cell's centre (a piece has its own colour; an empty cell is
# #121a26 and the inside of a closed fence is tinted green, neither is a piece), and where the grid sits on the screen.
PALETTE = {"F": [255, 107, 107], "I": [245, 159, 0], "L": [255, 212, 59], "N": [56, 217, 169], "P": [148, 216, 45], "T": [34, 184, 207],
           "U": [77, 171, 247], "V": [116, 143, 252], "W": [151, 117, 250], "X": [218, 119, 242], "Y": [240, 101, 149], "Z": [255, 168, 168]}
CELLS = """() => {
  const PAL = %s;
  const c = document.getElementById('game-board'), r = c.getBoundingClientRect(), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = Math.max(320, Math.floor(r.width)), H = Math.max(320, Math.floor(r.height));
  const pad = Math.max(4, Math.min(14, Math.floor(W * 0.02)));
  const cell = Math.max(8, Math.floor(Math.min((W - 2 * pad) / 20, (H - 2 * pad) / 20)));
  const ox = Math.floor((W - cell * 20) / 2), oy = Math.floor((H - cell * 20) / 2), scale = r.width / W;
  const cells = [], by = {};
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const d = ctx.getImageData(Math.round((ox + (x + 0.5) * cell) * dpr), Math.round((oy + (y + 0.5) * cell) * dpr), 1, 1).data;
    let best = null, bd = 1e9;
    for (const k in PAL) { const dd = Math.abs(d[0] - PAL[k][0]) + Math.abs(d[1] - PAL[k][1]) + Math.abs(d[2] - PAL[k][2]); if (dd < bd) { bd = dd; best = k; } }
    if (bd < 36) { cells.push([x, y]); (by[best] = by[best] || []).push([x, y]); }
  }
  return { cells, by, cell: cell * scale, left: r.left + ox * scale, top: r.top + oy * scale };
}""" % json.dumps(PALETTE)


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def overlap(a, b):
    return a and b and a[0] < b[2] - 0.5 and b[0] < a[2] - 0.5 and a[1] < b[3] - 0.5 and b[1] < a[3] - 0.5


def inside(a, w, h):
    return a[0] >= -0.5 and a[1] >= -0.5 and a[2] <= w + 0.5 and a[3] <= h + 0.5


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


def far_cell(cells):
    """The covered cell farthest from the piece's top-left corner: where a finger takes hold of it."""
    x0, y0 = min(c[0] for c in cells), min(c[1] for c in cells)
    return max(cells, key=lambda c: (c[0] - x0) + (c[1] - y0))


# The best fence and a poor one, from the DP lab's own code and data (computed here, never written into this file).
FENCES_JS = """
const path = require('path');
const root = process.argv[1];
const D = require(path.join(root, 'pentomino-dp-lab', 'dp.js'));
global.window = {};
require(path.join(root, 'pentomino-dp-lab', 'data', 'orders.js'));
const O = global.window.DP_ORDERS, names = D.PENTOS.map((p) => p[0]);
function fence(order) {
  const r = D.fixedOrder([...order].map((c) => names.indexOf(c)));
  const tr = D.trace(r);
  return { valid: tr.valid, pieces: tr.pieces.map((pc) => ({ letter: names[pc.piece], cells: pc.cells })) };
}
console.log(JSON.stringify({ best: fence(O.best), poor: fence(O.worst) }));
"""

CUP = """() => { const e = document.querySelector('#shelf .trophy'); let stored = null; try { stored = localStorage.getItem('%s'); } catch (x) { stored = 'blocked'; }
  return { on: e.classList.contains('on'), pop: e.classList.contains('pop'), title: e.title, label: document.getElementById('shelf').getAttribute('aria-label'),
           status: document.getElementById('trophy-status').textContent, stored, words: document.getElementById('shelf').innerText.trim() }; }""" % STORE


def normalized(cells):
    x0, y0 = min(c[0] for c in cells), min(c[1] for c in cells)
    return sorted((x - x0, y - y0) for x, y in cells)


def drag_cell(page, p, cell, shift, touch=False):
    a = (p["left"] + (cell[0] + 0.5) * p["cell"], p["top"] + (cell[1] + 0.5) * p["cell"])
    b = (a[0] + shift[0] * p["cell"], a[1] + shift[1] * p["cell"])
    if touch:
        touch_drag(page, a, b)
    else:
        page.mouse.move(*a)
        page.mouse.down()
        for k in range(1, 9):
            page.mouse.move(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8)
        page.mouse.up()
    page.wait_for_timeout(60)


def build(page, pieces):
    """Put these pieces on the board through the page's own controls: a chip puts a piece, rotate and flip turn it to its shape, a drag takes it to its place."""
    every = [tuple(c) for pc in pieces for c in pc["cells"]]
    x0, x1, y0, y1 = min(c[0] for c in every), max(c[0] for c in every), min(c[1] for c in every), max(c[1] for c in every)
    dx, dy = (20 - (x1 - x0 + 1)) // 2 - x0, (20 - (y1 - y0 + 1)) // 2 - y0     # the whole fence in the middle of the board
    for pc in pieces:
        want = [(x + dx, y + dy) for x, y in pc["cells"]]
        page.locator('#piece-tray .piece-btn[data-piece-id="%s"]' % pc["letter"]).click()
        page.wait_for_timeout(60)
        found = False
        for flip in (0, 1):
            if flip:
                page.locator("#flip-piece").click()
                page.wait_for_timeout(40)
            for _ in range(4):
                mine = page.evaluate(CELLS)
                if normalized(mine["by"].get(pc["letter"], [])) == normalized(want):
                    found = True
                    break
                page.locator("#rotate-piece").click()
                page.wait_for_timeout(40)
            if found:
                break
        if not found:
            return False
        cells = [tuple(c) for c in mine["by"][pc["letter"]]]
        corner = (min(c[0] for c in cells), min(c[1] for c in cells))
        goal = (min(c[0] for c in want), min(c[1] for c in want))
        grab = max(cells, key=lambda c: c[0] + c[1])
        drag_cell(page, mine, grab, (goal[0] - corner[0], goal[1] - corner[1]))
    return True


def clear(page):
    for _ in range(2):  # the erase button asks for a second tap
        page.locator("#clear-board").click()
        page.wait_for_timeout(100)


def cup_checks(browser, fences):
    """The cup lights for the best fence of all twelve pieces and for nothing else, is kept, and says so."""
    text = TEXT["en"]
    new = lambda: browser.new_context(viewport={"width": 1400, "height": 900}, device_scale_factor=1)

    def page_of(ctx):
        ctx.add_init_script("try{localStorage.setItem('fc-lang','en')}catch(e){}")
        page = ctx.new_page()
        page.errors = []
        page.on("console", lambda m: m.type == "error" and page.errors.append(m.text))
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.goto(URL)
        page.wait_for_selector("#piece-tray .piece-btn")
        page.wait_for_timeout(400)
        return page

    ctx = new()
    page = page_of(ctx)
    check(fences["best"]["valid"] and fences["poor"]["valid"], "[cup] the two fences are valid placements of the twelve pieces")
    check(build(page, fences["poor"]["pieces"]), "[cup] the poor fence goes on the board through the page's controls")
    s = page.evaluate(CUP)
    check(len(page.evaluate(CELLS)["cells"]) == 60, "[cup] twelve pieces, sixty cells, on the board")
    check(not s["on"] and s["stored"] is None and s["status"] == "", "[cup] a closed fence of all twelve pieces below the best wins nothing and stores nothing")
    clear(page)
    check(build(page, fences["best"]["pieces"]), "[cup] the best fence goes on the board through the page's controls")
    s = page.evaluate(CUP)
    check(s["on"] and s["pop"], "[cup] the best fence lights the cup, and it pops")
    check(s["title"] == text[1] and s["label"] == text[1] and s["status"] == text[2], "[cup] the tooltip, the label and the status read out the win")
    check(s["stored"] is not None and json.loads(s["stored"]) == {"g": True}, "[cup] and it is kept on the device")
    check(s["words"] == "", "[cup] nothing is written under it")
    page.screenshot(path=str(OUT / "cup-won.png"))
    clear(page)
    page.reload()
    page.wait_for_selector("#piece-tray .piece-btn")
    page.wait_for_timeout(300)
    s = page.evaluate(CUP)
    check(s["on"] and not s["pop"] and s["label"] == text[1], "[cup] after a reload the cup is still lit, without a pop")
    check(not page.errors, f"[cup] no errors in the page {page.errors[:2]}")
    ctx.close()

    # eleven pieces of the best fence do not close it
    ctx = new()
    page = page_of(ctx)
    check(build(page, fences["best"]["pieces"][:11]), "[cup] eleven pieces of the best fence go on the board")
    s = page.evaluate(CUP)
    check(not s["on"] and s["stored"] is None, "[cup] eleven pieces win nothing")
    ctx.close()

    # a browser that refuses storage: the cup still shines for the visit
    ctx = new()
    ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});")
    page = page_of(ctx)
    check(build(page, fences["best"]["pieces"]), "[cup, storage refused] the best fence goes on the board")
    s = page.evaluate(CUP)
    check(s["on"] and s["stored"] == "blocked", "[cup, storage refused] a win still lights the cup for the visit")
    check(not page.errors, f"[cup, storage refused] and raises no error {page.errors[:2]}")
    ctx.close()


with sync_playwright() as pw:
    browser = getattr(pw, ENGINE).launch()
    for lang, (name, w, h, touch, least) in ([] if ONLY_CUP else itertools.product(LANGS, VIEWS)):
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
        check(len(s["brand"]) == 2 and s["brand"][1] == "Dr. Erika Roldán" and s["brandRows"] == 2, f"[{label}] the credit has the paper's line, and the author's name under it {s['brand']} on {s['brandRows']} rows")

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

        # where the cup stands: top left, or between erase and the camera on a short phone, or right of flip when held sideways
        cup = d["#shelf"]
        sideways = touch and w > h and h <= 500
        if portrait_phone and h < 680:
            gap_l, gap_r = cup[0] - d["#clear-board"][2], d["#camera-toggle"][0] - cup[2]
            check(gap_l > 0 and gap_r > 0 and abs(gap_l - gap_r) < 8, f"[{label}] the cup stands in the middle of the room between erase and the camera ({gap_l:.0f} | {gap_r:.0f} px)")
        elif sideways:
            check(cup[0] >= d["#flip-piece"][2] and cup[1] < 20, f"[{label}] the cup stands right of rotate and flip")
        else:
            check(cup[0] < 30 and cup[1] < 20, f"[{label}] the cup stands in the top-left corner")
        off = TEXT[lang][0]
        check(page.evaluate("() => { const e = document.getElementById('shelf'); return e.getAttribute('aria-label') + '|' + e.querySelector('.trophy').title + '|' + e.querySelector('.trophy').classList.contains('on'); }") == f"{off}|{off}|false",
              f"[{label}] a new player's cup is dark and says so")
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
    fences = json.loads(subprocess.run(["node", "-e", FENCES_JS, str(ROOT)], capture_output=True, text=True, check=True).stdout)
    cup_checks(browser, fences)
    browser.close()

print("\n%d check(s) failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

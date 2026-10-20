"""Limit-shape lab · browser checks.

Usage: python3 limit-shape-lab/test/ui_check.py <base-url> <outdir> [--only=desk:en]
(base-url serves the repository root, e.g. http://127.0.0.1:8811/)
Desktop and phone, FR / DE / EN: no console errors, the size steps (4..15, then 500),
the optimal fences for n = 4..6 (their pieces on tiles, the chosen piece lit on the polygon,
the cards with the numbers the lab counts) and the greedy polygons of Section 6.2 for
n = 7..15, their tags, the loupe and its keys (browser shortcuts left alone), the chips per
state, the cards, the bubbles, slides and long presses on the arrows' dots, a one-line
caption, the disabled home.
"""
import json
import math
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/limit-shape-lab/"
# The data of the paper's curves, read from the lab's own file, to see that the pages draw them the right way up and in the right colours.
_paper = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "paper.js"), encoding="utf-8").read()
def _data(name):
    i = _paper.index('"%s":' % name) + len(name) + 3
    return json.JSONDecoder().raw_decode(_paper[i:])[0]
HIST, DEV = _data("hist500"), _data("dev500")
def curve_points(d):
    return [(float(a), float(b)) for a, b in re.findall(r"[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)", d)]
def drawn_like(vals, ys, thr):
    """A bigger value is drawn higher on the screen (a smaller y), at every sampled pair that differs by more than thr."""
    seen = bad = 0
    for k in range(60):
        i, j = (k * 37) % len(vals), (k * 91 + 13) % len(vals)
        if i < len(ys) and j < len(ys) and abs(vals[i] - vals[j]) > thr:
            seen += 1
            if (vals[i] - vals[j]) * (ys[j] - ys[i]) <= 0: bad += 1
    return seen >= 12 and bad == 0
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/limit-shape-lab-check"
os.makedirs(OUT, exist_ok=True)
failures = []
count = 0


def check(cond, msg):
    global count
    count += 1
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


VIEWS = [("desk", {"width": 1400, "height": 900}, False), ("phone", {"width": 390, "height": 844}, True)]
LANGS = ["fr", "de", "en"]
# --only=desk:en runs one view in one language (a quick check while working); no argument runs all six
for a in sys.argv[3:]:
    if a.startswith("--only="):
        v, l = a.split("=", 1)[1].split(":")
        VIEWS = [x for x in VIEWS if x[0] == v]
        LANGS = [l]
TITLES = {"fr": "Forme limite", "de": "Grenzform", "en": "Limit shape"}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for view, size, mobile in VIEWS:
        for lang in LANGS:
            ctx = browser.new_context(viewport=size, is_mobile=mobile, has_touch=mobile, bypass_csp=True)  # lets the test poll state; the page itself keeps its policy
            ctx.add_init_script(f"try {{ localStorage.setItem('fc-lang', '{lang}'); }} catch (e) {{}}")
            pg = ctx.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            pg.goto(BASE, wait_until="networkidle")
            pg.wait_for_function("window.limitLab && !limitLab.busy()")
            tag = f"{view} {lang}"
            st = pg.evaluate("limitLab.state()")
            check(st["n"] == 4 and st["pieces"] == 5, f"{tag}: opens on the 5 tetrominoes")
            check(TITLES[lang] in pg.title(), f"{tag}: title in the language")
            check(sorted(st["chips"]) == ["arrow", "count", "gap", "polygon"], f"{tag}: chips at n = 4: {st['chips']}")
            check(st["tiles"] and st["fence"] and st["optimal"], f"{tag}: the tetrominoes sit on tiles, round the optimal fence's polygon")
            check(not st["source"] and not pg.is_visible("#src-tag"), f"{tag}: no paper tag below 500")
            name = pg.evaluate("document.getElementById('fence-tag').getAttribute('aria-labelledby').split(' ').map((i) => document.getElementById(i).textContent).join(' ')")
            check(pg.is_visible("#fence-tag") and pg.evaluate("i18n.t('ls.optName')") in name, f"{tag}: at n = 4 the stage names the optimal fence: {name!r}")
            # Browser shortcuts keep their keys: Ctrl or Cmd with = (zoom) does not step n.
            pg.keyboard.press("Control+Equal")
            pg.keyboard.press("Meta+Equal")
            check(pg.evaluate("limitLab.state().n") == 4, f"{tag}: Ctrl/Cmd + = leaves n alone")
            # [ and ] work, and are announced, while the loupe's slider has focus.
            pg.focus("#loupe")
            pg.keyboard.press("]")
            check(pg.evaluate("limitLab.state().loupeV") == 10 and pg.inner_text("#status") == pg.evaluate("i18n.t('ls.s.loupe', {k: document.getElementById('loupe-x').textContent.slice(1)})"),
                  f"{tag}: ] on the focused slider moves the loupe and says so: {pg.inner_text('#status')!r}")
            pg.keyboard.press("[")
            check(pg.evaluate("limitLab.state().loupeV") == 0, f"{tag}: [ brings the loupe back")
            pg.evaluate("document.activeElement.blur()")
            nav = pg.eval_on_selector_all(".lab-nav > *", "els => els.map(e => e.getAttribute('href'))")
            check(nav == ["../hub/", "../cube-lab/", "../hexomino-lab/", "../pentomino-dp-lab/"], f"{tag}: nav order {nav}")
            check(st["maxLoupe"] * abs(st["gap"]) <= 0.6 + 1e-9, f"{tag}: loupe capped at n = 4 (×{st['maxLoupe']:.2f})")
            check(pg.get_attribute("#fewer", "aria-disabled") == "true", f"{tag}: no step below 4")
            check(abs(st["gap"] + 0.271131) < 1e-6 and abs(st["area"] - 11.5) < 1e-9, f"{tag}: n = 4: the largest gap is the polygon's dip of 27.1 %, its area 11.5")
            pg.screenshot(path=f"{OUT}/{view}-{lang}-n4.png")

            # Steps up to 15 (the greedy fences from 7), then the jump to 500, then back.
            COUNTS = {5: 12, 6: 35, 7: 108, 8: 369, 9: 1285, 10: 4655, 11: 17073, 12: 63600, 13: 238591, 14: 901971, 15: 3426576}
            KINDS = {7: 13, 8: 16, 9: 20, 10: 24, 11: 30, 12: 36, 13: 42, 14: 49, 15: 55}
            for k, c in COUNTS.items():
                pg.click("#more")
                pg.wait_for_function(f"limitLab.state().n === {k} && limitLab.state().pieces === {c} && !limitLab.busy()", timeout=15000)
                st = pg.evaluate("limitLab.state()")
                if k <= 6:
                    check(st["fence"] and st["optimal"] and st["tiles"], f"{tag}: n = {k} is the optimal fence: its polygon, its pieces on tiles")
                    check(sorted(st["chips"]) == ["arrow", "count", "gap", "polygon"], f"{tag}: chips at n = {k}: {st['chips']}")
                    check(st["kinds"] == {5: 7, 6: 9}[k], f"{tag}: n = {k}: {st['kinds']} kinds of arrows")
                if k >= 7:
                    check(st["fence"] and not st["optimal"] and not st["tiles"], f"{tag}: n = {k} is the greedy polygon, drawn from its arrows")
                    check(sorted(st["chips"]) == ["arrow", "count", "gap", "polygon"], f"{tag}: chips at n = {k}: {st['chips']}")
                    check(st["kinds"] == KINDS[k], f"{tag}: n = {k}: {st['kinds']} kinds of arrows")
            st = pg.evaluate("limitLab.state()")
            check(st["pieces"] == 3426576, f"{tag}: 3426576 pieces at n = 15")
            check(pg.get_attribute("#more", "class").find("skip") >= 0, f"{tag}: + becomes the jump at n = 15")
            # The caption stays on one line, with the count and with the arrow most pieces share.
            one_line = "(() => { const c = document.getElementById('caption'); return c.getBoundingClientRect().height < 22 && c.scrollWidth <= c.clientWidth + 1; })()"
            check(pg.evaluate(one_line), f"{tag}: the caption {pg.inner_text('#caption')!r} on one line")
            big = pg.evaluate("(() => { let b = 0; for (let i = 0; i < limitLab.state().kinds; i++) if (limitLab.kindAt(i)[2] > limitLab.kindAt(b)[2]) b = i; return b; })()")
            pg.evaluate(f"limitLab.pickKind({big})")
            check(pg.evaluate(one_line), f"{tag}: the caption {pg.inner_text('#caption')!r} on one line")
            pg.evaluate(f"limitLab.pickKind({big})")
            pg.click("#more")
            pg.wait_for_function("limitLab.state().n === 500")
            pg.wait_for_function("limitLab.state().samples >= 2 && !limitLab.busy()", timeout=20000)
            st = pg.evaluate("limitLab.state()")
            check(sorted(st["chips"]) == ["gap", "giant", "sample"], f"{tag}: chips at 500: {st['chips']}")
            check(abs(st["loupe"] - 1) < 1e-9, f"{tag}: arriving at 500 the loupe is at ×1 ({st['loupe']:.1f})")
            check(st["source"] and pg.is_visible("#src-tag"), f"{tag}: at 500 the stage names the paper's sample")
            check(not pg.is_visible("#fence-tag"), f"{tag}: no greedy-fence tag at 500")
            check(pg.get_attribute("#more", "aria-disabled") == "true", f"{tag}: no step above 500")
            check(abs(st["gap"] - 0.004176685) < 1e-8, f"{tag}: gap at 500 is the paper's 0.42 %")
            pg.screenshot(path=f"{OUT}/{view}-{lang}-n500.png")

            # The loupe.
            pg.evaluate("limitLab.setLoupe(100)")
            st = pg.evaluate("limitLab.state()")
            check(abs(st["loupe"] * abs(st["gap"]) - 0.6) < 1e-6, f"{tag}: full loupe stretches the largest gap to 0.6")
            pg.click(".math-chip[data-chip='giant']")
            live = pg.inner_text(".math-pop .live")
            check("603" in live and "2" in live.split("603")[0], f"{tag}: the 500-cell estimate is the paper's 2.0·10^603: {live}")
            pg.click("[data-lang-btn='" + ("de" if lang != "de" else "fr") + "']")
            check(pg.is_visible(".math-pop"), f"{tag}: the language switch keeps the card open")
            pg.click("[data-lang-btn='" + lang + "']")
            pg.click(".math-pop .math-close")
            pg.screenshot(path=f"{OUT}/{view}-{lang}-n500-loupe.png")

            # Every visible chip opens a card with no LaTeX and no line numbers.
            for chip in pg.query_selector_all(".math-chip:not([hidden])"):
                chip.click()
                pg.wait_for_selector(".math-pop:not([hidden])")
                text = pg.inner_text(".math-pop")
                check(not re.search(r"\\label|sec:|lem:|fig:|tab:|l\. ?\d", text), f"{tag}: card {chip.get_attribute('data-chip')} has no source labels")
                check(len(pg.inner_text(".math-pop .math-src")) > 3, f"{tag}: card {chip.get_attribute('data-chip')} names its section")
                pg.mouse.click(5, size["height"] - 5)
                pg.wait_for_selector(".math-pop", state="hidden")

            pg.click("#fewer")
            pg.wait_for_function("limitLab.state().n === 15 && limitLab.state().pieces === 3426576 && !limitLab.busy()", timeout=15000)
            check(True, f"{tag}: back from 500 to 15")
            pg.evaluate("limitLab.setLoupe(0)")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5")

            # The polygon card of an optimal fence: the polygon's area from its arrows, the cells the lab counts on the pieces, the
            # corrections between them, the paper's optimum; the arrow card counts the pieces that take their longest arrow.
            norm = lambda t: re.sub(r"[\u202f\u00a0]", " ", t)
            fmtn = lambda x: norm(pg.evaluate("(x) => x.toLocaleString({en: 'en-US', fr: 'fr-FR', de: 'de-DE'}[i18n.get()], {minimumFractionDigits: x % 1 ? 1 : 0, maximumFractionDigits: x % 1 ? 1 : 0})", x))
            for k, ref, cells, corr, longest in ((4, 11.5, 9, 2.5, "0 / 5"), (5, 141.5, 128, 13.5, "7 / 12"), (6, 1663, 1597, 66, "30 / 35")):
                pg.evaluate(f"limitLab.setN({k})")
                pg.wait_for_function(f"limitLab.state().n === {k} && limitLab.state().optimal && !limitLab.busy()")
                pg.click(".math-chip[data-chip='polygon']")
                live = norm(pg.inner_text(".math-pop .live"))
                check(f"= {fmtn(ref)} " in live and f"= {fmtn(cells)} " in live and f"= −{fmtn(corr)} " in live,
                      f"{tag}: n = {k}: polygon {ref}, enclosed {cells}, corrections −{corr}: {live!r}")
                check(re.search(r"(?i)(optimum|Optimum) " + re.escape(fmtn(cells)), live), f"{tag}: n = {k}: the paper's optimum {cells}: {live!r}")
                pg.click(".math-pop .math-close")
                pg.click(".math-chip[data-chip='arrow']")
                live = norm(pg.inner_text(".math-pop .live"))
                check(f"= {longest}" in live, f"{tag}: n = {k}: pieces with their longest arrow {longest}: {live!r}")
                pg.click(".math-pop .math-close")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5 && !limitLab.busy()")

            # The polygon card at n = 9: the polygon's area from its arrows, the paper's fence, the corrections.
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().pieces === 1285 && limitLab.state().fence && !limitLab.busy()")
            st = pg.evaluate("limitLab.state()")
            check(st["corners"] == 100 and st["area"] == 4007124.5, f"{tag}: n = 9: 100 corners, area {st['area']}")
            check(abs(st["gap"] - 0.0696229) < 1e-6, f"{tag}: n = 9: largest gap over the whole polygon {st['gap']:.6f}")
            check(abs(st["maxLoupe"] * abs(st["gap"]) - 0.6) < 1e-9, f"{tag}: the loupe's cap stretches the largest gap to 0.6 at n = 9 (×{st['maxLoupe']:.2f})")
            pg.click(".math-chip[data-chip='polygon']")
            live = pg.inner_text(".math-pop .live")
            check(re.search(r"4.?007.?124.5|4.?007.?124,5", live) and re.search(r"4.?003.?811", live) and re.search(r"3.?313.5|3.?313,5", live) and re.search(r"4.?052.?974", live),
                  f"{tag}: n = 9: polygon area, the paper's fence, the corrections, the bound: {live!r}")
            pg.click(".math-pop .math-close")
            pg.click(".math-chip[data-chip='gap']")
            live = pg.inner_text(".math-pop .live")
            check(re.search(r"6[.,]96", live) and re.search(r"6[.,]90", live), f"{tag}: n = 9: gap over the whole polygon and in the paper's sector: {live!r}")
            pg.click(".math-pop .math-close")
            # An arrow kind: a tap on its dot lights its places on the polygon, a second tap lets go.
            x, y = pg.evaluate("limitLab.spot(5)")
            pg.mouse.click(x, y) if not mobile else pg.touchscreen.tap(x, y)
            check(pg.evaluate("limitLab.state().selKind") == 5, f"{tag}: a tap on a dot chooses that arrow")
            pg.mouse.click(x, y) if not mobile else pg.touchscreen.tap(x, y)
            check(pg.evaluate("limitLab.state().selKind") == -1, f"{tag}: a second tap lets go")
            # Keys on the dock: ArrowRight chooses the first kind, Escape lets go.
            pg.focus("#pieces")
            pg.keyboard.press("ArrowRight")
            check(pg.evaluate("limitLab.state().selKind") == 0, f"{tag}: ArrowRight on the dock chooses the first arrow")
            pg.keyboard.press("Escape")
            check(pg.evaluate("limitLab.state().selKind") == -1, f"{tag}: Escape lets go")
            check(pg.inner_text("#status") == pg.evaluate("i18n.t('ls.s.noKind')"), f"{tag}: letting go is announced")
            # A slide from one dot to another: the choice follows the finger (or the held mouse) and stays.
            a, b = pg.evaluate("limitLab.spot(3)"), pg.evaluate("limitLab.spot(12)")
            if mobile:
                cdp = ctx.new_cdp_session(pg)
                touch = lambda kind, pt=None: cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": pt[0], "y": pt[1], "id": 7}] if pt else []})
                touch("touchStart", a)
                for s in range(1, 9):
                    touch("touchMove", (a[0] + (b[0] - a[0]) * s / 8, a[1] + (b[1] - a[1]) * s / 8))
                held = pg.evaluate("limitLab.state().selKind")
                touch("touchEnd")
            else:
                pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.mouse.move(b[0], b[1], steps=8)
                held = pg.evaluate("limitLab.state().selKind")
                pg.mouse.up()
            check(held == 12 and pg.evaluate("limitLab.state().selKind") == 12, f"{tag}: a slide over the dots chooses the one under it, and release keeps it")
            pg.evaluate("limitLab.pickKind(12)")
            if mobile:
                # A long press on a dot chooses it: the dock's bubble does not open and swallow it.
                touch("touchStart", a)
                pg.wait_for_timeout(800)
                bubble = pg.is_visible("#lab-tip.on")
                touch("touchEnd")
                pg.wait_for_timeout(100)
                check(not bubble and pg.evaluate("limitLab.state().selKind") == 3, f"{tag}: a long press on a dot chooses it, no bubble")
                pg.evaluate("limitLab.pickKind(3)")
            # A chosen arrow stays through a change of language (the pair written as the language writes it) and goes with a new size.
            pg.evaluate("limitLab.pickKind(5)")
            cap = pg.inner_text("#caption")
            check((";" in cap) if lang in ("fr", "de") else ("," in cap and ";" not in cap), f"{tag}: the chosen arrow's pair in the caption, as the language writes it: {cap!r}")
            pg.click("[data-lang-btn='" + ("de" if lang != "de" else "fr") + "']")
            check(pg.evaluate("limitLab.state().selKind") == 5 and ";" in pg.inner_text("#caption"), f"{tag}: the chosen arrow stays through a change of language: {pg.inner_text('#caption')!r}")
            pg.click("[data-lang-btn='" + lang + "']")
            pg.evaluate("limitLab.setN(11)")
            pg.wait_for_function("limitLab.state().n === 11 && !limitLab.busy()")
            check(pg.evaluate("limitLab.state().selKind") == -1, f"{tag}: a new size lets go of the chosen arrow")
            name = pg.evaluate("document.getElementById('fence-tag').getAttribute('aria-labelledby').split(' ').map((i) => document.getElementById(i).textContent).join(' ')")
            check(pg.is_visible("#fence-tag") and pg.evaluate("i18n.t('ls.fenceName')") in name, f"{tag}: at n = 11 the stage names the greedy fence: {name!r}")
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().n === 9 && !limitLab.busy()")
            # The stage's accessible name says greedy polygon at 9 and optimal polygon at 4; the canvas is not blank; the full loupe stretches the gap to 0.6.
            check(pg.get_attribute("#loop", "aria-label") == pg.evaluate("i18n.t('ls.fence')"), f"{tag}: the loop's name at n = 9 names the polygon")
            check(pg.get_attribute("#gap-tok", "data-lab-tip") == pg.evaluate("i18n.t('ls.gapPoly')"), f"{tag}: the gap says polygon at n = 9")
            lit = pg.evaluate("(() => { const c = document.getElementById('loop'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) k++; return k; })()")
            check(lit > 2000, f"{tag}: the polygon is drawn ({lit} lit pixels)")
            pg.evaluate("limitLab.setLoupe(100)")
            st = pg.evaluate("limitLab.state()")
            check(abs(st["loupe"] * abs(st["gap"]) - 0.6) < 1e-6, f"{tag}: at n = 9 the full loupe stretches the largest gap to 0.6")
            pg.evaluate("limitLab.setLoupe(0)")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5 && !limitLab.busy()")
            check(pg.get_attribute("#loop", "aria-label") == pg.evaluate("i18n.t('ls.fenceOpt')"), f"{tag}: the loop's name at n = 4 names the optimal fence's polygon")
            check(pg.get_attribute("#gap-tok", "data-lab-tip") == pg.evaluate("i18n.t('ls.gapPoly')"), f"{tag}: the gap says polygon at n = 4")
            # the API refuses a size the lab does not have
            pg.evaluate("limitLab.setN(16)")
            check(pg.evaluate("limitLab.state().n") == 4, f"{tag}: an unknown size changes nothing")
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().n === 9 && !limitLab.busy()")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5 && !limitLab.busy()")

            # Choosing a piece lights its own side of the polygon, in white, and only that one.
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && limitLab.state().tiles && !limitLab.busy()")
            pg.evaluate("limitLab.setLoupe(0)")
            white = """(([x, y]) => { const c = document.getElementById('loop'), r = c.getBoundingClientRect(), d = c.width / r.width;
              const px = Math.round((x - r.left) * d), py = Math.round((y - r.top) * d), R = Math.round(6 * d);
              const img = c.getContext('2d').getImageData(Math.max(0, px - R), Math.max(0, py - R), 2 * R, 2 * R).data; let k = 0;
              for (let i = 0; i < img.length; i += 4) if (img[i] > 235 && img[i + 1] > 235 && img[i + 2] > 235 && img[i + 3] > 200) k++; return k; })"""
            pg.evaluate("limitLab.pick(4)")
            lit = [pg.evaluate(white, pg.evaluate(f"limitLab.sideSpot({i})")) for i in range(12)]
            check(lit[4] > 8 and sum(1 for i, v in enumerate(lit) if i != 4 and v > 8) == 0, f"{tag}: piece 5 of 12 lights its own side of the polygon and no other: {lit}")
            check(pg.evaluate("limitLab.state().sel") == 4 and "5" in pg.inner_text("#status") and "12" in pg.inner_text("#status") and "2.5" in pg.inner_text("#status").replace(",", ".").replace(" ", ""),
                  f"{tag}: the choice is announced with its arrow: {pg.inner_text('#status')!r}")
            cap = pg.inner_text("#caption")
            check((";" in cap) if lang in ("fr", "de") else ("," in cap and ";" not in cap), f"{tag}: the chosen piece's arrow in the caption, as the language writes it: {cap!r}")
            for i in (0, 11, 7):
                pg.evaluate(f"limitLab.pick({i})")
                lit = [pg.evaluate(white, pg.evaluate(f"limitLab.sideSpot({j})")) for j in range(12)]
                check(lit[i] > 8 and sum(1 for j, v in enumerate(lit) if j != i and v > 8) == 0, f"{tag}: piece {i + 1} lights its own side: {lit}")
            pg.evaluate("limitLab.pick(7)")
            # the pieces on the tiles are where the fence puts them: each arrow is the polygon's own
            pcs = pg.evaluate("[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => limitLab.pieceAt(i))")
            check(sum(1 for q in pcs if q["corner"]) == 4, f"{tag}: four of the twelve pieces are corner pieces")
            check(len({q["color"] for q in pcs}) == 12, f"{tag}: twelve colours round the polygon")
            # Tapping a tile, the keys, a second tap, and Escape.
            pg.evaluate("limitLab.pick(7)")
            x, y = pg.evaluate("limitLab.tileSpot(2)")
            pg.mouse.click(x, y) if not mobile else pg.touchscreen.tap(x, y)
            check(pg.evaluate("limitLab.state().sel") == 2, f"{tag}: a tap on a tile chooses its piece")
            pg.mouse.click(x, y) if not mobile else pg.touchscreen.tap(x, y)
            check(pg.evaluate("limitLab.state().sel") == -1 and pg.inner_text("#status") == pg.evaluate("i18n.t('ls.s.noPiece')"), f"{tag}: a second tap lets go, and says so")
            pg.focus("#pieces")
            pg.keyboard.press("ArrowRight")
            check(pg.evaluate("limitLab.state().sel") == 0, f"{tag}: ArrowRight on the dock chooses the first piece")
            pg.keyboard.press("ArrowLeft")
            check(pg.evaluate("limitLab.state().sel") == 11, f"{tag}: ArrowLeft goes round to the last piece")
            pg.keyboard.press("Escape")
            check(pg.evaluate("limitLab.state().sel") == -1, f"{tag}: Escape lets go")
            # A chosen piece stays through a change of language, and goes with a new size.
            pg.evaluate("limitLab.pick(3)")
            pg.click("[data-lang-btn='" + ("de" if lang != "de" else "fr") + "']")
            check(pg.evaluate("limitLab.state().sel") == 3 and ";" in pg.inner_text("#caption"), f"{tag}: the chosen piece stays through a change of language: {pg.inner_text('#caption')!r}")
            pg.click("[data-lang-btn='" + lang + "']")
            pg.evaluate("limitLab.setN(6)")
            pg.wait_for_function("limitLab.state().n === 6 && !limitLab.busy()")
            check(pg.evaluate("limitLab.state().sel") == -1, f"{tag}: a new size lets go of the chosen piece")
            # n = 6 has 35 tiles: every one of them lights its own side.
            bad = []
            for i in range(35):
                pg.evaluate(f"limitLab.pick({i})")
                lit = [pg.evaluate(white, pg.evaluate(f"limitLab.sideSpot({j})")) for j in range(35)]
                if not (lit[i] > 4 and sum(1 for j, v in enumerate(lit) if j != i and v > 4 and abs(j - i) > 1) == 0): bad.append(i)
            check(not bad, f"{tag}: at n = 6 each of the 35 pieces lights its own side ({bad})")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5 && !limitLab.busy()")
            box = pg.query_selector("#pieces").bounding_box()
            pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2) if not mobile else pg.tap("#pieces", position={"x": box["width"] / 2, "y": box["height"] / 2})
            check(pg.evaluate("limitLab.state().sel") >= 0, f"{tag}: a tap on a piece chooses it")

            # ---- the pieces as the fence places them: each feature of the stage and of the tiles fails here when it breaks ----
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && limitLab.state().tiles && !limitLab.busy()")
            pg.evaluate("limitLab.setLoupe(0)")
            hexrgb = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]
            # How opaque a side is at the fraction f of its length: the most opaque pixel of its own colour in a 5 x 5 window (the dashed
            # circle and a thin interior fill, of other colours, may lie beneath it; the edge of a stroke is lighter than its middle).
            stage_alpha = """(([i, f, rgb]) => { const c = document.getElementById('loop'), r = c.getBoundingClientRect(), d = c.width / r.width, p = limitLab.sideSpot(i, f);
              const px = Math.round((p[0] - r.left) * d), py = Math.round((p[1] - r.top) * d), a = c.getContext('2d').getImageData(px - 2, py - 2, 5, 5).data;
              let best = 0; for (let j = 0; j < a.length; j += 4)
                if (Math.abs(a[j] - rgb[0]) + Math.abs(a[j + 1] - rgb[1]) + Math.abs(a[j + 2] - rgb[2]) <= 45) best = Math.max(best, a[j + 3]);
              return best; })"""
            alphas = lambda i, rgb: [pg.evaluate(stage_alpha, [i, f, rgb]) for f in (0.5, 0.3, 0.7)]
            ring_hits = """((i) => { const c = document.getElementById('loop'), r = c.getBoundingClientRect(), d = c.width / r.width, p = limitLab.sideSpot(i);
              const px = (p[0] - r.left) * d, py = (p[1] - r.top) * d, g = c.getContext('2d'); let k = 0;
              for (let a = 0; a < 360; a += 15) { const x = Math.round(px + 6 * d * Math.cos(a * Math.PI / 180)), y = Math.round(py + 6 * d * Math.sin(a * Math.PI / 180));
                const q = g.getImageData(x - 1, y - 1, 3, 3).data;
                for (let j = 0; j < q.length; j += 4) if (q[j] > 220 && q[j + 1] > 60 && q[j + 1] < 140 && q[j + 2] > 140 && q[j + 2] < 215 && q[j + 3] > 120) { k++; break; } }
              return k; })"""
            pcs = pg.evaluate("[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => limitLab.pieceAt(i))")
            # each side wears its own piece's colour; the corner pieces, and only they, wear a ring on the polygon
            off = [i for i, q in enumerate(pcs) if max(alphas(i, hexrgb(q["color"]))) < 235]
            check(not off, f"{tag}: n = 5: each side of the polygon wears its piece's colour, fully opaque {off}")
            rings = [pg.evaluate(ring_hits, i) for i in range(12)]
            check(all((rings[i] >= 12) == bool(pcs[i]["corner"]) for i in range(12)) and sum(1 for q in pcs if q["corner"]) == 4, f"{tag}: n = 5: the four corner pieces wear a ring, no other piece does: {rings}")
            # a chosen piece is white, the other sides are dimmed (half as bright)
            pg.evaluate("limitLab.pick(4)")
            dim = []
            for i, q in enumerate(pcs):
                al = alphas(i, [255, 255, 255] if i == 4 else hexrgb(q["color"]))
                if i == 4: ok_i = max(al) >= 240       # lit in white, fully opaque
                else: ok_i = 100 <= min(al) <= 210 and max(al) < 235   # dimmed to half, still there (the dashed circle and the fence's cells may lie beneath it)
                if not ok_i: dim.append((i, al))
            check(not dim, f"{tag}: n = 5: the chosen piece is white and the other sides are dimmed {dim[:3]}")
            pg.evaluate("limitLab.pick(4)")
            # each tile's arrow is the polygon's arrow of that piece, and the attachment ticks lie along their edges
            wrong = [i for i, q in enumerate(pcs) if pg.evaluate(f"limitLab.arrowAt({i})") != [q["pair"][1][0] - q["pair"][0][0], -(q["pair"][1][1] - q["pair"][0][1])]]
            check(not wrong, f"{tag}: n = 5: each tile's arrow points where its side of the polygon points {wrong}")
            white = """(([x, y, r]) => { const c = document.getElementById('pieces'), g = c.getContext('2d'), a = g.getImageData(Math.round(x - r), Math.round(y - r), 2 * r + 1, 2 * r + 1).data;
              for (let j = 0; j < a.length; j += 4) if (a[j] > 235 && a[j + 1] > 235 && a[j + 2] > 235 && a[j + 3] > 200) return true; return false; })"""
            bad = []
            for i in range(12):
                ts = pg.evaluate(f"limitLab.tickSpots({i})")
                dpr = pg.evaluate("document.getElementById('pieces').width / document.getElementById('pieces').getBoundingClientRect().width")
                u, r = ts["u"], max(1, round(0.5 * dpr))
                for x, y, vertical in ts["ends"]:
                    along, across = 0.3 * u, max(3 * dpr, 0.3 * u)
                    on = [(x, y - along), (x, y + along)] if vertical else [(x - along, y), (x + along, y)]
                    offp = [(x - across, y), (x + across, y)] if vertical else [(x, y - across), (x, y + across)]
                    # the arrow may cover one side of a tick (it leaves the edge into the piece), never both; nothing white lies across it
                    if not any(pg.evaluate(white, [px, py, r]) for px, py in on) or any(pg.evaluate(white, [px, py, r]) for px, py in offp): bad.append(i)
            check(not bad, f"{tag}: n = 5: the white ticks lie along the attachment edges of the pieces {sorted(set(bad))}")
            # the four corner pieces' tiles have a pink border, the others do not (the pixel on the middle of the tile's left border)
            border = """(([x, y, s, dpr]) => { const g = Math.max(1.5 * dpr, Math.min(3 * dpr, s * 0.05)), a = document.getElementById('pieces').getContext('2d').getImageData(Math.round(x + g) - 1, Math.round(y + s / 2), 3, 1).data;
              let hit = false; for (let j = 0; j < a.length; j += 4) if (a[j] > 220 && a[j + 1] > 60 && a[j + 1] < 140 && a[j + 2] > 140 && a[j + 2] < 215 && a[j + 3] > 150) hit = true; return hit; })"""
            dpr5 = pg.evaluate("document.getElementById('pieces').width / document.getElementById('pieces').getBoundingClientRect().width")
            pinks = [pg.evaluate(border, pg.evaluate(f"limitLab.tickSpots({i}).slot") + [dpr5]) for i in range(12)]
            check(pinks == [bool(q["corner"]) for q in pcs], f"{tag}: n = 5: the four corner pieces' tiles have the pink border, the others do not {pinks}")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().tiles && !limitLab.busy()")
            p4 = pg.evaluate("[0, 1, 2, 3, 4].map((i) => limitLab.pieceAt(i))")
            check(sorted(q["color"] for q in p4) == sorted(["#ff5b7f", "#ff9d1e", "#2de2d5", "#7f83ff", "#ffd84a"]), f"{tag}: n = 4: the tetrominoes keep the hub's five colours {[q['color'] for q in p4]}")
            check(sum(1 for q in p4 if q["corner"]) == 4, f"{tag}: n = 4: four corner pieces")
            # the words: the stage's tag, the status after a size, the caption of a chosen piece
            fixt = lambda v, w: ("−" if v < 0 else "") + (f"{abs(v):.1f}" if abs(v) % 1 else f"{int(abs(v))}")
            def pairs(dx2, dy2, lg=None):
                lg = lg or lang
                x, y = [fixt(v / 2, lg).replace(".", "," if lg != "en" else ".") for v in (dx2, dy2)]
                return {"en": f"({x}, {y})", "fr": f"({x}\u202f; {y})", "de": f"({x}; {y})"}[lg]
            squeeze = lambda t: re.sub(r"[  ]", " ", t)
            tag4 = pg.get_attribute("#fence-tag", "data-lab-tip") or pg.get_attribute("#fence-tag", "title")
            check(tag4 == pg.evaluate("i18n.t('ls.optTip') + ' ' + PaperRef.tip('fig:fence-art')"), f"{tag}: n = 4: the tag's bubble describes the optimal fence and where the paper shows one")
            st4 = squeeze(pg.inner_text("#status"))
            check(re.search(r"\b9\b", st4) and not re.search(r"(?i)greedy|gloutonne|11[.,]5", st4), f"{tag}: n = 4: the status says optimal and 9 cells, not greedy: {st4!r}")
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && limitLab.state().tiles && !limitLab.busy()")
            st5 = squeeze(pg.inner_text("#status"))
            check("128" in st5 and "141" not in st5 and not re.search(r"(?i)greedy|gloutonne", st5), f"{tag}: n = 5: the status says 128 cells, not the polygon's area, not greedy: {st5!r}")
            for i in (0, 4, 7, 11):
                pg.evaluate(f"limitLab.pick({i})")
                a2 = pg.evaluate(f"limitLab.arrowAt({i})")
                want = f"{i + 1}/12 · {pairs(a2[0], a2[1])}"
                check(squeeze(pg.inner_text("#caption")) == squeeze(want), f"{tag}: n = 5: the caption of piece {i + 1} is its arrow as drawn, x then y: {pg.inner_text('#caption')!r} vs {want!r}")
                want_status = pg.evaluate("(a) => i18n.t('ls.s.pick', a)", {"i": i + 1, "count": "12", "pair": pairs(a2[0], a2[1])})
                check(squeeze(pg.inner_text("#status")) == squeeze(want_status), f"{tag}: n = 5: the status of piece {i + 1}: {pg.inner_text('#status')!r}")
            pg.evaluate("limitLab.pick(11)")
            # the keys: with nothing chosen, ArrowRight goes to the first piece and ArrowLeft to the last; the bubble goes at once
            pg.focus("[data-lang-btn='en']")
            pg.keyboard.press("Tab")   # by the keyboard from the language buttons into the box: its bubble explains it
            check(pg.evaluate("document.activeElement.id") == "pieces" and pg.is_visible("#lab-tip.on") and pg.inner_text("#lab-tip") == pg.evaluate("i18n.t('ls.tipTiles')"), f"{tag}: Tab into the pieces box shows its bubble")
            pg.keyboard.press("ArrowRight")
            check(pg.evaluate("limitLab.state().sel") == 0 and not pg.is_visible("#lab-tip.on"), f"{tag}: ArrowRight with nothing chosen chooses the first piece, and the bubble is gone")
            pg.keyboard.press("Escape")
            pg.keyboard.press("ArrowLeft")
            check(pg.evaluate("limitLab.state().sel") == 11, f"{tag}: ArrowLeft with nothing chosen chooses the last piece")
            pg.keyboard.press("ArrowUp"); pg.keyboard.press("Escape")
            check(pg.evaluate("limitLab.state().sel") == -1, f"{tag}: ArrowUp then Escape lets go")
            # a slide over the tiles chooses the one under the finger (or the held mouse), release keeps it; a tap away from every tile lets go
            a, b = pg.evaluate("limitLab.tileSpot(0)"), pg.evaluate("limitLab.tileSpot(3)")
            if mobile:
                cdp = ctx.new_cdp_session(pg)
                touch = lambda kind, pt=None: cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": pt[0], "y": pt[1], "id": 9}] if pt else []})
                touch("touchStart", a)
                for k in range(1, 9):
                    touch("touchMove", (a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8))
                held = pg.evaluate("limitLab.state().sel")
                touch("touchEnd")
            else:
                pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.mouse.move(b[0], b[1], steps=8)
                held = pg.evaluate("limitLab.state().sel")
                pg.mouse.up()
            check(held == 3 and pg.evaluate("limitLab.state().sel") == 3, f"{tag}: a slide over the tiles chooses the one under it, and release keeps it ({held})")
            fs = pg.evaluate("limitLab.freeSpot()")
            if fs:
                pg.evaluate("limitLab.pick(3)") if pg.evaluate("limitLab.state().sel") != 3 else None
                pg.mouse.click(fs[0], fs[1]) if not mobile else pg.touchscreen.tap(fs[0], fs[1])
                check(pg.evaluate("limitLab.state().sel") == -1, f"{tag}: a tap away from every tile lets go")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().tiles && !limitLab.busy()")
            # the gap card at n = 4 says the dip, not the bulge
            pg.click(".math-chip[data-chip='gap']")
            live = squeeze(pg.inner_text(".math-pop .live"))
            check("−27" in live and "25" not in live, f"{tag}: n = 4: the gap card reads the largest gap, the 27.1 % dip: {live!r}")
            pg.click(".math-pop .math-close")
            # the box flips between tiles and kinds when it becomes small: what was chosen is let go and the texts say so
            home = pg.viewport_size
            pg.evaluate("limitLab.setN(6)")
            pg.wait_for_function("limitLab.state().n === 6 && limitLab.state().tiles && !limitLab.busy()")
            pg.evaluate("limitLab.pick(3)")
            pg.set_viewport_size({"width": 480, "height": 300})
            pg.wait_for_function("!limitLab.state().tiles", timeout=5000)
            st = pg.evaluate("limitLab.state()")
            cap = squeeze(pg.inner_text("#caption"))
            check(st["sel"] == -1 and st["selKind"] == -1 and "/" not in cap and squeeze(pg.inner_text("#status")) == squeeze(pg.evaluate("i18n.t('ls.s.noKind')")),
                  f"{tag}: n = 6 in a small box: the piece is let go and the caption and the status say so ({cap!r}, {pg.inner_text('#status')!r})")
            check(st["kinds"] == 9 and st["optimal"], f"{tag}: n = 6 in a small box: the 9 kinds of arrows of the optimal fence")
            k = pg.evaluate("(() => { for (let i = 0; i < 9; i++) { const v = limitLab.kindAt(i); if (v[3]) return i; } return -1; })()")
            pg.evaluate(f"limitLab.pickKind({k})")
            want_corner = pg.evaluate("(a) => i18n.t('ls.s.cornerArrow', a)", {"pair": pairs(5, 5)})
            check(squeeze(pg.inner_text("#status")) == squeeze(want_corner), f"{tag}: n = 6 in a small box: the corner kind is the corner pieces' arrow, one piece for each of the four corners: {pg.inner_text('#status')!r}")
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && !limitLab.busy()")
            small5 = False
            for w_, h_ in ((420, 240), (380, 220), (340, 200), (300, 180)):
                pg.set_viewport_size({"width": w_, "height": h_})
                pg.wait_for_timeout(200)
                if not pg.evaluate("limitLab.state().tiles"): small5 = True; break
            check(small5, f"{tag}: n = 5 in a very small box shows the kinds of arrows")
            if small5:
                one = pg.evaluate("(() => { for (let i = 0; i < limitLab.state().kinds; i++) { const v = limitLab.kindAt(i); if (v[3] && v[2] !== 4) return i; } return -1; })()")
                check(one >= 0, f"{tag}: n = 5: a corner kind that is the arrow of one piece only")
                pg.evaluate(f"limitLab.pickKind({one})")
                kd = pg.evaluate(f"limitLab.kindAt({one})")
                want_kind = pg.evaluate("(a) => i18n.t('ls.s.kind', a)", {"pair": pairs(kd[0] * 2, kd[1] * 2), "m": "1", "k": "1"})
                check(squeeze(pg.inner_text("#status")) == squeeze(want_kind), f"{tag}: n = 5: a corner arrow of one piece is told as any arrow: {pg.inner_text('#status')!r}")
            pg.set_viewport_size(home)
            pg.evaluate("limitLab.setN(6)")
            pg.wait_for_function("limitLab.state().n === 6 && limitLab.state().tiles && !limitLab.busy()", timeout=5000)
            cap = squeeze(pg.inner_text("#caption"))
            check(pg.evaluate("limitLab.state().selKind") == -1 and "·" not in cap.replace(" · " + squeeze(pg.evaluate("i18n.t('ls.optName')")), ""), f"{tag}: n = 6 back in a large box: nothing stays chosen, the caption is the count: {cap!r}")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().tiles && !limitLab.busy()")

            # ---- one cell size for the tiles; the fence itself behind the polygon; the preview under a mouse; the bubble where it belongs ----
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && limitLab.state().tiles && !limitLab.busy()")
            pg.evaluate("limitLab.setLoupe(0)")
            pcs = pg.evaluate("[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => limitLab.pieceAt(i))")
            ts = [pg.evaluate(f"limitLab.tickSpots({i})") for i in range(12)]
            us = [x["u"] for x in ts]
            dpr5 = pg.evaluate("document.getElementById('pieces').width / document.getElementById('pieces').getBoundingClientRect().width")
            check(max(us) - min(us) < 1e-9 and us[0] > 0, f"{tag}: n = 5: the twelve tiles share one cell size ({min(us):.4f} .. {max(us):.4f})")
            fill = 0.9 if ts[3]["slot"][2] < 44 * dpr5 else 0.8
            check(abs(us[3] * 5 - ts[3]["slot"][2] * fill) < 1e-6, f"{tag}: n = 5: the five-cell piece fills its tile ({us[3] * 5:.2f} of {ts[3]['slot'][2] * fill:.2f})")
            arrows = [pg.evaluate(f"limitLab.arrowAt({i})") for i in range(12)]
            badlen = [i for i in range(12) if abs(math.hypot(ts[i]["ends"][1][0] - ts[i]["ends"][0][0], ts[i]["ends"][1][1] - ts[i]["ends"][0][1]) / us[i] - math.hypot(*arrows[i]) / 2) > 1e-6]
            check(not badlen, f"{tag}: n = 5: on the tiles each arrow is as long as it is, counted in cells {badlen}")
            # the fence behind the polygon: each cell in its piece's colour, faintly, away from the polygon's line (it runs through the middle of thin pieces)
            cell_px = """((p) => { const c = document.getElementById('loop'), r = c.getBoundingClientRect(), d = c.width / r.width, px = Math.round((p[0] - r.left) * d), py = Math.round((p[1] - r.top) * d);
              const a = c.getContext('2d').getImageData(px, py, 1, 1).data; return [a[0], a[1], a[2], a[3]]; })"""
            def cell_samples(i, ncells=5):
                out = []
                for k in range(ncells):
                    for dx, dy in ((0.3, 0.3), (-0.3, 0.3), (0.3, -0.3), (-0.3, -0.3)):
                        out.append(pg.evaluate(cell_px, pg.evaluate(f"limitLab.cellSpot({i}, {k}, {dx}, {dy})")))
                return out
            nocell = []
            for i, q in enumerate(pcs):
                want = hexrgb(q["color"])
                if not any(50 <= px[3] <= 140 and sum(abs(a - b) for a, b in zip(px[:3], want)) <= 100 for px in cell_samples(i)): nocell.append(i)
            check(not nocell and pg.evaluate("limitLab.state().cells") == 60, f"{tag}: n = 5: the fence is drawn behind the polygon, each cell in its piece's colour, faintly {nocell}")
            # one cell on the screen is as long as one cell of a piece; the polygon's corners are as far apart as its arrows are long, in those cells
            c0, c1 = pg.evaluate("limitLab.cellSpot(3, 0)"), pg.evaluate("limitLab.cellSpot(3, 1)")
            cellpx = math.hypot(c1[0] - c0[0], c1[1] - c0[1])
            badcorner = []
            for j in range(12):
                a, b = pg.evaluate(f"limitLab.cornerSpot({j})"), pg.evaluate(f"limitLab.cornerSpot({(j + 1) % 12})")
                if abs(math.hypot(b[0] - a[0], b[1] - a[1]) / cellpx - math.hypot(*arrows[j]) / 2) > 0.02: badcorner.append(j)
            check(not badcorner, f"{tag}: n = 5: the polygon and the cells are on one scale {badcorner}")
            # a chosen piece is full, the others step back
            pg.evaluate("limitLab.pick(6)")
            full = max(px[3] for px in cell_samples(6))
            others = max(min(px[3] for px in cell_samples(i, 2)) for i in (0, 3, 9))   # the cleanest sample of each: a stroke may cross the others
            check(full >= 190 and others <= 90, f"{tag}: n = 5: a chosen piece's cells are full ({full}), the others step back ({others})")
            pg.evaluate("limitLab.pick(6)")
            # the loupe bends the polygon: the cells fade out as it grows, and are back at x1
            pg.evaluate("limitLab.setLoupe(100)")
            gone = max(px[3] for i in (0, 3, 6, 9) for px in cell_samples(i, 2))
            pg.evaluate("limitLab.setLoupe(0)")
            back = max(px[3] for px in cell_samples(3))
            check(gone < 30 and back >= 50, f"{tag}: n = 5: the cells fade out under the full loupe ({gone}) and are back at x1 ({back})")
            # a mouse over a tile previews its side of the polygon: its stroke is lighter than it was
            if not mobile:
                bright = """(([i, f]) => { const c = document.getElementById('loop'), r = c.getBoundingClientRect(), d = c.width / r.width, p = limitLab.sideSpot(i, f);
                  const px = Math.round((p[0] - r.left) * d), py = Math.round((p[1] - r.top) * d), a = c.getContext('2d').getImageData(px - 2, py - 2, 5, 5).data;
                  let best = null; for (let j = 0; j < a.length; j += 4) if (a[j + 3] >= 240 && (!best || a[j] + a[j + 1] + a[j + 2] > best)) best = a[j] + a[j + 1] + a[j + 2];
                  return best || 0; })"""
                boxp = pg.query_selector("#pieces").bounding_box()
                pg.mouse.move(boxp["x"] + boxp["width"] + 300, boxp["y"] + 10)
                base = max(pg.evaluate(bright, [6, f]) for f in (0.5, 0.3, 0.7))
                a = pg.evaluate("limitLab.tileSpot(6)")
                pg.mouse.move(a[0] - 40, a[1] - 40); pg.mouse.move(a[0], a[1])
                lit = max(pg.evaluate(bright, [6, f]) for f in (0.5, 0.3, 0.7))
                check(pg.evaluate("limitLab.state().hover") == 6 and lit > base + 60, f"{tag}: a mouse over a tile previews its side, lighter than before ({base} -> {lit})")
                pg.mouse.move(boxp["x"] + boxp["width"] + 300, boxp["y"] + 10)
                check(pg.evaluate("limitLab.state().hover") == -1, f"{tag}: the preview goes with the mouse")
            # a chosen piece is announced again in the new language
            pg.evaluate("limitLab.pick(4)")
            other = "de" if lang != "de" else "fr"
            pg.click(f"[data-lang-btn='{other}']")
            a2 = pg.evaluate("limitLab.arrowAt(4)")
            want_status = pg.evaluate("(a) => i18n.t('ls.s.pick', a)", {"i": 5, "count": "12", "pair": pairs(a2[0], a2[1], other)})
            check(squeeze(pg.inner_text("#status")) == squeeze(want_status), f"{tag}: after a change of language the status says the choice in the new language: {pg.inner_text('#status')!r}")
            pg.click(f"[data-lang-btn='{lang}']")
            pg.evaluate("limitLab.pick(4)")
            # the bubble of the pieces box, reached by the keyboard from the far side of the screen, lands in view and not on the tiles
            pg.focus("[data-lang-btn='fr']")
            for _ in range(3): pg.keyboard.press("Tab")
            tb = pg.evaluate("(() => { const t = document.getElementById('lab-tip'), r = t.getBoundingClientRect(), b = document.getElementById('pieces').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, b.left, b.top, b.right, b.bottom, innerWidth, innerHeight, document.activeElement.id]; })()")
            inside = tb[0] >= 0 and tb[1] >= 0 and tb[2] <= tb[8] and tb[3] <= tb[9]
            overlap = not (tb[2] <= tb[4] or tb[0] >= tb[6] or tb[3] <= tb[5] or tb[1] >= tb[7])
            check(tb[10] == "pieces" and inside and not overlap, f"{tag}: the bubble of the pieces box lands in view, not on the tiles {tb}")
            pg.keyboard.press("Escape")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().tiles && !limitLab.busy()")

            # ---- the paper by result: a pill names it (Table 4, Fig. 28, § 6.2) and opens it; nothing is « from the paper » any more ----
            # Table 3 and Table 4 as the paper prints them (paper-tech.tex): n -> A'(n), U(n), L(n), the gap in %; n -> best, bound, difference in %.
            T4 = {7: (108, 20385, 19718, "3.38"), 8: (369, 284170, 279105, "1.81"), 9: (1285, 4052974, 4003811, "1.23"), 10: (4655, 61484424, 60832848, "1.07"),
                  11: (17073, 942469010, 934201230, "0.89"), 12: (63600, 14736083080, 14625233629, "0.76"), 13: (238591, 231340860898, 229830309620, "0.66"),
                  14: (901971, 3657193899930, 3635789660265, "0.59"), 15: (3426576, 57965740117847, 57656581776211, "0.54")}
            T3 = {7: (19733, 19830, "0.49"), 8: (279134, 280389, "0.45")}
            digits = lambda x: int(re.sub(r"\D", "", x))
            pct = lambda x: re.search(r"\d+[.,]\d+", x).group(0).replace(",", ".")
            PAGEW = {"fr": "page", "de": "seite", "en": "page"}[lang]
            P4 = pg.evaluate("PAPER_REFS.refs['tab:heur'].page")   # the page of Table 4 in the paper's build, as the registry has it
            def open_card(chip):
                pg.click(f".math-chip[data-chip='{chip}']")
                pg.wait_for_selector(".math-pop:not([hidden])")
            def pop_h2():
                return pg.inner_text(".math-pop h2")
            def esc_card():
                pg.keyboard.press("Escape")
                pg.wait_for_selector(".math-pop", state="hidden")
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().n === 9 && limitLab.state().fence && !limitLab.busy()")
            check("(§ 6.2)" in pg.inner_text("#status") or "§ 6.2" in pg.inner_text("#status"), f"{tag}: the status names the greedy fence by its section: {pg.inner_text('#status')!r}")
            open_card("polygon")
            card_title = pop_h2()
            check([x for x in pg.eval_on_selector_all(".math-pop .paper-ref", "els => els.map(e => e.textContent)")] ==
                  ["Lemma 3", "Table 4", "Table 4", "§ 6.2 Heuristic greedy solver", "Fig. 24", "Lemma 3"], f"{tag}: the polygon card names Lemma 3, Table 4 (twice), § 6.2, Fig. 24")
            check(not re.search(r"d’après l’article|laut Artikel|from the paper", pg.inner_text(".math-pop .live")), f"{tag}: no value is « from the paper »")
            if not mobile:
                pg.hover(".math-pop .live .paper-ref >> nth=0")
                pg.wait_for_timeout(450)
                tip = pg.inner_text("#lab-tip")
                check("Table 4" in tip and str(P4) in tip and pg.is_visible("#lab-tip.on"), f"{tag}: a pill's bubble says what and where: {tip!r}")
                pg.mouse.move(5, 5)
            pg.click(".math-pop .live .paper-ref >> nth=0")
            check(pop_h2() == "Table 4", f"{tag}: the pill opens Table 4: {pop_h2()!r}")
            kicker = pg.inner_text(".math-pop .math-kicker").lower().replace("\xa0", " ")
            check("optimal polyomino fences" in kicker and f"{PAGEW} {P4}" in kicker, f"{tag}: the page names the paper and page {P4}: {kicker!r}")
            check(pg.inner_text(".math-pop .math-where").strip().endswith("§ 6.2 Heuristic greedy solver"), f"{tag}: the page says which section the table is in")
            rows = [[c.inner_text() for c in r.query_selector_all("td")] for r in pg.query_selector_all(".math-pop .ref-table tbody tr")]
            want_rows = [[str(k)] for k in sorted(T4)]
            check([r[0] for r in rows] == [x[0] for x in want_rows], f"{tag}: Table 4 has the rows 7 to 15")
            check(lang != "fr" or (not any("\u202f" in c for r in rows for c in r[1:4]) and any("\u00a0" in c for r in rows for c in r[1:4])), f"{tag}: in French the groups of digits are separated by a no-break space, not by a hair of a space: {rows[-1]}")
            bad = [r[0] for r in rows if (digits(r[1]), digits(r[2]), digits(r[3]), pct(r[4])) != T4[int(r[0])]]
            check(not bad, f"{tag}: every number of Table 4 is as the paper prints it (wrong rows: {bad})")
            check(pg.eval_on_selector(".math-pop .ref-table tr.on td", "e => e.textContent") == "9", f"{tag}: the row of n = 9 is lit")
            check(pg.is_visible(".math-pop .math-note") and "arXiv" in pg.inner_text(".math-pop .math-note") and pg.locator(".math-pop .math-open").count() == 0,
                  f"{tag}: until the paper is public, the page says so and links nowhere")
            inview = lambda col: pg.evaluate("(c) => { const e = document.querySelector('.math-pop .math-excerpt'), h = e.querySelector('th[data-col=' + c + ']'), a = e.getBoundingClientRect(), b = h.getBoundingClientRect(); return b.left >= a.left - 1 && b.right <= a.right + 1; }", col)
            check(inview("L"), f"{tag}: the greedy fence's pill opens Table 4 with its column, L(n), in view")
            sw = pg.evaluate("(() => { const p = document.querySelector('.math-pop'), s = document.querySelector('.math-pop .ref-swipe'), sc = document.querySelector('.math-pop .ref-scroll'); return [sc.scrollWidth > sc.clientWidth + 2, p.classList.contains('scrolls'), getComputedStyle(s).display !== 'none']; })()")
            check(sw[0] == sw[1] == sw[2] and (sw[0] if mobile else True), f"{tag}: the hint to swipe shows exactly when the table is wider than the card (and always on a phone): {sw}")
            box = pg.evaluate("(() => { const r = document.querySelector('.math-pop').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight]; })()")
            check(box[0] >= 0 and box[1] >= 0 and box[2] <= box[4] + 0.5 and box[3] <= box[5] + 0.5, f"{tag}: the reference page stays in view {box}")
            # Back goes to the card; a section pill goes on to the section, and Back comes back one page at a time.
            check(pg.inner_text(".math-pop .math-back").strip() == card_title, f"{tag}: Back is named after the card it returns to")
            pg.click(".math-pop .math-back")
            check(pop_h2() == card_title and pg.locator(".math-pop .math-back").count() == 0, f"{tag}: Back returns to the card")
            check(pg.evaluate("document.activeElement.dataset.ref") == "tab:heur" and pg.evaluate("document.activeElement.closest('.live') !== null"), f"{tag}: and puts the focus back on the pill that opened the page")
            pg.click(".math-pop .live .paper-ref >> nth=1")
            check(pop_h2() == "Table 4" and inview("U"), f"{tag}: the upper bound's pill opens Table 4 on U(n)")
            pg.click(".math-pop .math-back")
            pg.click(".math-pop .live .paper-ref >> nth=0")
            pg.click(".math-pop .math-where .paper-ref")
            check(pop_h2() == "Section 6.2 · Heuristic greedy solver" and pg.inner_text(".math-pop .math-back").strip() == "Table 4", f"{tag}: the section pill opens the section, Back names Table 4: {pop_h2()!r}")
            inside = pg.eval_on_selector_all(".math-pop .math-body .paper-ref", "els => els.map(e => e.textContent)")
            check(inside == ["Table 4", "Fig. 24"], f"{tag}: a section page lists the results it holds, in the paper's order: {inside}")
            pg.click(".math-pop .math-where .paper-ref")
            inside = pg.eval_on_selector_all(".math-pop .math-body .paper-ref", "els => els.map(e => e.textContent)")
            check(pop_h2() == "Section 6 · Larger fences" and inside == ["Eq. (13)", "§ 6.2 Heuristic greedy solver", "§ 6.3 The limit shape"], f"{tag}: Section 6 lists its equation and its two subsections: {pop_h2()!r} {inside}")
            pg.click(".math-pop .math-back")
            pg.click(".math-pop .math-back")
            check(pop_h2() == "Table 4" and pg.evaluate("document.activeElement.closest('.math-where') !== null"), f"{tag}: Back returns to Table 4, the focus on the section pill")
            legend = pg.inner_text(".math-pop .math-excerpt .ref-cap")
            check(all(w in legend for w in ("A′(n)", "U(n)", "L(n)", "Fmax", "Δmax")), f"{tag}: the table's legend says what its columns are: {legend!r}")
            # a change of language rewrites the page where it stands
            other = "de" if lang != "de" else "fr"
            pg.click(f"[data-lang-btn='{other}']")
            pg.wait_for_timeout(100)
            k2 = pg.inner_text(".math-pop .math-kicker").lower().replace("\xa0", " ")
            check(pop_h2() == "Table 4" and f"{ {'fr': 'page', 'de': 'seite', 'en': 'page'}[other] } {P4}" in k2 and pg.locator(".math-pop .ref-table").count() == 1,
                  f"{tag}: a change of language keeps the page and rewrites it: {k2!r}")
            pg.click(f"[data-lang-btn='{lang}']")
            pg.wait_for_timeout(100)
            esc_card()
            check(pg.evaluate("document.activeElement && document.activeElement.dataset.chip") == "polygon", f"{tag}: Escape closes the whole stack and gives the focus back to the chip")
            # The three other pages of this card, with the data of the paper behind them.
            open_card("polygon")
            pg.click(".math-pop .math-src .paper-ref >> nth=1")
            legend = pg.eval_on_selector_all(".math-pop .ref-legend li", "els => els.map(e => [e.textContent.trim().split(' · ')[0], e.classList.contains('on')])")
            polys = pg.evaluate("() => [document.querySelectorAll('.math-pop .ref-poly-main polygon').length, document.querySelectorAll('.math-pop .ref-poly-inset polygon').length, document.querySelectorAll('.math-pop .ref-poly-main polygon.on').length, document.querySelectorAll('.math-pop .ref-poly-main circle').length]")
            check(pop_h2() == "Figure 24" and [f[0] for f in legend] == ["n = 9", "n = 11", "n = 13", "n = 15"] and [f[1] for f in legend] == [True, False, False, False],
                  f"{tag}: Figure 24's legend names n = 9, 11, 13, 15, the one on show in bold: {legend}")
            check(polys == [4, 4, 1, 1], f"{tag}: the four polygons are drawn on top of each other in one box with the dashed circle, and again in the inset; the one on show is outlined: {polys}")
            esc_card()
            pg.evaluate("limitLab.setN(7)")
            pg.wait_for_function("limitLab.state().n === 7 && !limitLab.busy()")
            open_card("polygon")
            pg.click(".math-pop .live .paper-ref >> nth=1")
            rows = [[c.inner_text() for c in r.query_selector_all("td")] for r in pg.query_selector_all(".math-pop .ref-table tbody tr")]
            check(pop_h2() == "Table 3" and [(digits(r[1]), digits(r[2]), pct(r[3])) for r in rows] == [T3[7], T3[8]] and pg.eval_on_selector(".math-pop .ref-table tr.on td", "e => e.textContent") == "7",
                  f"{tag}: Table 3 as printed, the row of n = 7 lit: {rows}")
            esc_card()
            # The stage's two tokens open the result they show, as a card of their own (no Back); the keys do too.
            for k, want in ((4, "Figure 23"), (5, "Section 3.4 · Identification of all optimal pentomino fences"), (6, "Section 4.3 · Identification of all optimal solutions"), (9, "Section 6.2 · Heuristic greedy solver")):
                pg.evaluate(f"limitLab.setN({k})")
                pg.wait_for_function(f"limitLab.state().n === {k} && !limitLab.busy()")
                pg.click("#fence-tag")
                pg.wait_for_selector(".math-pop:not([hidden])")
                check(pop_h2() == want and pg.locator(".math-pop .math-back").count() == 0, f"{tag}: n = {k}: the fence's token opens {want}: {pop_h2()!r}")
                esc_card()
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().n === 9 && !limitLab.busy()")
            pg.focus("#fence-tag")
            pg.keyboard.press("Enter")
            pg.wait_for_selector(".math-pop:not([hidden])")
            check(pop_h2().startswith("Section 6.2"), f"{tag}: Enter on the token opens it")
            esc_card()
            check(pg.evaluate("document.activeElement.id") == "fence-tag", f"{tag}: and Escape gives the focus back to the token")
            pg.keyboard.press("Space")
            pg.wait_for_selector(".math-pop:not([hidden])")
            check(pop_h2().startswith("Section 6.2"), f"{tag}: Space on the token opens it")
            esc_card()
            # 500 cells: the gap is read off Figure 28, whose curve the page draws; the sample's footer leads to Figure 26; the token to Figure 27
            pg.evaluate("limitLab.setN(500)")
            pg.wait_for_function("limitLab.state().n === 500 && !limitLab.busy()")
            open_card("gap")
            check(not re.search(r"d’après l’article|laut Artikel|from the paper", pg.inner_text(".math-pop .live")) and pg.inner_text(".math-pop .live .paper-ref") == "Fig. 28",
                  f"{tag}: n = 500: the gap is Fig. 28, not « from the paper »: {pg.inner_text('.math-pop .live')!r}")
            pg.click(".math-pop .live .paper-ref")
            marks = pg.eval_on_selector_all(".math-pop .ref-spark text", "els => els.map(e => e.textContent)")
            check(pop_h2() == "Figure 28" and any(re.fullmatch(r"\+0[.,]42\W?%", m) for m in marks) and any(re.fullmatch(r"[−-]0[.,]10\W?%", m) for m in marks) and pg.locator(".math-pop .ref-spark circle").count() == 2,
                  f"{tag}: Figure 28 draws the curve with its largest values, +0.42 % and −0.10 %: {marks}")
            circ = pg.eval_on_selector_all(".math-pop .ref-spark circle", "els => els.map(e => [+e.getAttribute('cx'), +e.getAttribute('cy')])")
            hi_, lo_ = max(DEV, key=lambda q: q[1]), min(DEV, key=lambda q: q[1])
            check(len(circ) == 2 and circ[0][1] < circ[1][1] and abs((circ[0][0] - 6) / 288 - hi_[0] / 45) < 0.01 and abs((circ[1][0] - 6) / 288 - lo_[0] / 45) < 0.01,
                  f"{tag}: Figure 28: the largest value sits at its own angle ({hi_[0]:.2f}°) above the smallest, at its own ({lo_[0]:.2f}°): {circ}")
            said = pg.get_attribute(".math-pop .ref-spark", "aria-label") or ""
            check(re.search(r"\+0[.,]42", said) and re.search(r"[−-]0[.,]10", said) and pg.get_attribute(".math-pop .ref-spark", "aria-hidden") is None, f"{tag}: Figure 28 tells its marked values to a screen reader: {said!r}")
            ys28 = [pt[1] for pt in curve_points(pg.get_attribute(".math-pop .ref-spark path", "d"))]
            step28 = max(1, len(DEV) // 400)
            check(drawn_like([q[1] for q in DEV[::step28]], ys28, 0.0015), f"{tag}: Figure 28's curve is drawn the right way up")
            if not mobile:
                wpage = pg.evaluate("document.querySelector('.math-pop').getBoundingClientRect().width")
                check(wpage >= 480, f"{tag}: a reference page is wider than a card: {wpage:.0f} px")
            pg.click(".math-pop .math-where .paper-ref")
            check(pop_h2() == "Section 6.3 · The limit shape", f"{tag}: Fig. 28 is in § 6.3")
            esc_card()
            open_card("sample")
            pg.click(".math-pop .math-src .paper-ref >> nth=2")
            check(pop_h2() == "Figure 26" and pg.locator(".math-pop .ref-spark path").count() == 2, f"{tag}: Figure 26: the histogram's two curves: {pop_h2()!r}")
            curves = {c: curve_points(d) for c, d in pg.eval_on_selector_all(".math-pop .ref-spark path", "els => els.map(e => [e.getAttribute('stroke'), e.getAttribute('d')])")}
            top26 = max(q[1] for q in HIST)
            check(drawn_like([q[2] for q in HIST], [pt[1] for pt in curves.get("#7fe7b8", [])], 0.15) and drawn_like([q[1] / top26 for q in HIST], [pt[1] for pt in curves.get("#5ea8ff", [])], 0.01),
                  f"{tag}: Figure 26: the green curve is how often each direction occurs, the blue one the mean length, as the caption says, both the right way up")
            esc_card()
            pg.click("#src-tag")
            pg.wait_for_selector(".math-pop:not([hidden])")
            check(pop_h2() == "Figure 27" and pg.locator(".math-pop .math-back").count() == 0, f"{tag}: the 13.5 M token opens Figure 27")
            esc_card()
            open_card("giant")
            check(pg.inner_text(".math-pop .live .paper-ref") == "§ 6.3" and "Eq. (13)" in pg.eval_on_selector_all(".math-pop .paper-ref", "els => els.map(e => e.textContent)"), f"{tag}: the estimate is § 6.3, and the count of 500-ominoes is Eq. (13)")
            pg.click(".math-pop .math-lead .paper-ref")
            formula = re.sub(r"\s+", "", pg.inner_text(".math-pop .math-formula"))
            check(pop_h2() == "Equation (13)" and formula == "A′(n)≈(1/8)·c·λn/n", f"{tag}: Equation (13) is shown as the paper writes it: {formula!r}")
            pg.click(".math-pop .math-back")
            esc_card()
            # Once the paper is public the page links to its page of the paper (one line in paper-refs.js); not before.
            pg.evaluate("PAPER_REFS.paper.url = 'https://example.org/paper.pdf'")
            open_card("giant")
            pg.click(".math-pop .live .paper-ref")
            href = pg.get_attribute(".math-pop .math-open", "href")
            check(href == f"https://example.org/paper.pdf#page={P4}" and pg.get_attribute(".math-pop .math-open", "target") == "_blank" and "noopener" in pg.get_attribute(".math-pop .math-open", "rel")
                  and pg.locator(".math-pop .math-note").count() == 0, f"{tag}: with the paper public the page links to its page: {href!r}")
            esc_card()
            pg.evaluate("PAPER_REFS.paper.url = null")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().tiles && !limitLab.busy()")

            # ---- the card is modal, steady and exact ----
            # Tab goes round the card and the language switch, never into the lab behind; a pill, clicked for real, opens its own page and
            # never runs out of the card; Close and Back stay in view while a long page scrolls; the card of n = 500 keeps its focus while
            # its line changes; a page follows its control and the language; a long press explains a pill without opening it.
            WHERE = "(() => { const a = document.activeElement; return a === document.querySelector('.math-pop') ? 'pop' : a.closest('.math-pop') ? 'card' : a.closest('.langSel') ? 'lang' : 'OUT:' + a.tagName + '#' + a.id; })()"
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && !limitLab.busy()")
            open_card("polygon")
            seen, out = set(), None
            for key_ in ["Tab"] * 40 + ["Shift+Tab"] * 40:
                pg.keyboard.press(key_)
                w = pg.evaluate(WHERE)
                seen.add(w)
                if w.startswith("OUT"): out = (key_, w); break
            check(out is None and {"card", "lang"} <= seen, f"{tag}: Tab and Shift+Tab go round the card and the language switch, never into the lab behind: {seen} {out}")
            keys = pg.evaluate("[...document.querySelectorAll('.math-pop .paper-ref')].map(e => e.dataset.ref)")
            wrong = []
            for q, key_ in enumerate(keys):
                pg.locator(".math-pop .paper-ref").nth(q).click(timeout=4000)
                got = pg.evaluate("document.querySelector('.math-pop').dataset.refKey")
                over = pg.evaluate("(() => { const p = document.querySelector('.math-pop'); return p.scrollWidth - p.clientWidth; })()")
                if got != key_ or over > 1: wrong.append((q, key_, got, over))
                pg.click(".math-pop .math-back")
            check(len(keys) >= 4 and not wrong, f"{tag}: n = 5: each of the card's {len(keys)} pills, clicked for real, opens its own page, which stays inside the card: {wrong}")
            esc_card()
            # Close and Back stay in view while a page scrolls
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().n === 9 && !limitLab.busy()")
            open_card("polygon")
            pg.click(".math-pop .live .paper-ref >> nth=0")
            pg.evaluate("document.querySelector('.math-pop').scrollTop = 9999")
            bar = pg.evaluate("""(() => { const p = document.querySelector('.math-pop').getBoundingClientRect(), x = document.querySelector('.math-pop .math-close').getBoundingClientRect(), b = document.querySelector('.math-pop .math-back').getBoundingClientRect();
              return [x.top >= p.top - 1 && x.bottom <= p.top + 60, b.top >= p.top - 1 && b.bottom <= p.top + 60]; })()""")
            check(bar == [True, True], f"{tag}: Close and Back stay at the top of the card while its page is scrolled to the bottom: {bar}")
            # a page follows the language: Back names the card in the new language
            other = "de" if lang != "de" else "fr"
            pg.click(f"[data-lang-btn='{other}']")
            pg.wait_for_timeout(150)
            check(pg.inner_text(".math-pop .math-back").strip() == pg.evaluate("i18n.t('ls.chip.polygon')"), f"{tag}: after a change of language Back names the card in the new language: {pg.inner_text('.math-pop .math-back')!r}")
            pg.click(f"[data-lang-btn='{lang}']")
            pg.wait_for_timeout(150)
            esc_card()
            # the card opened from the stage's token follows the size
            pg.evaluate("limitLab.setN(5)")
            pg.wait_for_function("limitLab.state().n === 5 && !limitLab.busy()")
            pg.click("#fence-tag")
            pg.wait_for_selector(".math-pop:not([hidden])")
            first = pop_h2()
            pg.keyboard.press("+")
            pg.wait_for_function("limitLab.state().n === 6 && !limitLab.busy()")
            check(first.startswith("Section 3.4") and pop_h2().startswith("Section 4.3"), f"{tag}: the page opened from the token follows the size: {first!r} then {pop_h2()!r}")
            esc_card()
            # at 500 cells the sample's line changes about twice a second: the card keeps its pills, its focus and its page
            pg.evaluate("limitLab.setN(500)")
            pg.wait_for_function("limitLab.state().n === 500 && !limitLab.busy()")
            open_card("sample")
            pg.evaluate("(() => { const p = document.querySelector('.math-pop .math-src .paper-ref'); p.__mark = 1; p.focus(); })()")
            for _ in range(6): pg.evaluate("window.mathChip.refresh()")
            pg.wait_for_timeout(1300)
            check(pg.evaluate("(() => { const a = document.activeElement; return !!(a && a.__mark) && !!a.closest('.math-pop'); })()"), f"{tag}: n = 500: while the line changes the card's pill is the same node and keeps the focus")
            pg.click(".math-pop .math-src .paper-ref >> nth=2")
            pg.evaluate("(() => { const b = document.querySelector('.math-pop .math-back'); b.__mark = 1; b.focus(); })()")
            for _ in range(6): pg.evaluate("window.mathChip.refresh()")
            pg.wait_for_timeout(1300)
            check(pg.evaluate("(() => { const a = document.activeElement; return !!(a && a.__mark) && a.classList.contains('math-back'); })()") and pop_h2() == "Figure 26", f"{tag}: and the page opened from it keeps its Back button and the focus on it")
            esc_card()
            # a long press on a pill explains it and opens nothing
            if mobile:
                pg.evaluate("limitLab.setN(9)")
                pg.wait_for_function("limitLab.state().n === 9 && !limitLab.busy()")
                open_card("polygon")
                card_t = pop_h2()
                cdp_ = ctx.new_cdp_session(pg)
                pg.locator(".math-pop .live .paper-ref").first.scroll_into_view_if_needed()
                pg.wait_for_timeout(150)
                spot = pg.evaluate("(() => { const r = document.querySelector('.math-pop .live .paper-ref').getClientRects()[0]; return [r.left + r.width / 2, r.top + r.height / 2]; })()")
                cdp_.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": spot[0], "y": spot[1]}]})
                pg.wait_for_timeout(800)
                shown = pg.is_visible("#lab-tip.on")
                cdp_.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
                pg.wait_for_timeout(300)
                check(shown and pop_h2() == card_t and pg.locator(".math-pop .math-back").count() == 0, f"{tag}: a long press on a pill shows its bubble and opens nothing: {pop_h2()!r}")
                esc_card()
            # back to the size the rest of the checks start from
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().tiles && !limitLab.busy()")
            # Bubbles (hover only where there is a mouse).
            if not mobile:
                # a bubble measured where the last one stood would shrink beside the right edge: the first one after a far-away one is as wide as ever, and stands over its control
                pg.mouse.move(5, 5)
                pg.wait_for_timeout(300)
                pg.hover("#more")
                pg.wait_for_timeout(450)
                clean = pg.evaluate("document.querySelector('#lab-tip').getBoundingClientRect().width")
                pg.hover(".math-chip[data-chip='polygon']")
                pg.wait_for_timeout(450)
                pg.hover("#more")
                pg.wait_for_timeout(450)
                again = pg.evaluate("(() => { const r = document.querySelector('#lab-tip').getBoundingClientRect(), c = document.querySelector('#more').getBoundingClientRect(); return [r.width, (r.left + r.width / 2) - (c.left + c.width / 2)]; })()")
                check(abs(again[0] - clean) < 1.5 and abs(again[1]) < 40, f"{tag}: the bubble that follows a far-away one is as wide as ever and stands over its control: {clean:.0f} then {again[0]:.0f} px, {again[1]:.0f} px off")
                pg.hover("#more")
                pg.wait_for_timeout(450)
                tip = pg.inner_text("#lab-tip") if pg.query_selector("#lab-tip") else ""
                check(len(tip) > 5 and pg.get_attribute("#more", "title") is None, f"{tag}: + explains itself in a bubble")
                home = pg.query_selector(".lab-nav a[href='../hub/']")
                home.hover()
                pg.wait_for_timeout(450)
                check(pg.inner_text("#lab-tip") == pg.evaluate("i18n.t('lab.home')"), f"{tag}: the home explains itself")
                home.click()
                pg.wait_for_url("**/hub/")
                check(pg.locator("a.piece").count() == 10, f"{tag}: the home lands on the hub")
                pg.go_back()
                pg.wait_for_function("window.limitLab && !limitLab.busy()")
            if mobile:
                cdp = ctx.new_cdp_session(pg)
                def long_press(sel, ms=900):
                    b = pg.query_selector(sel).bounding_box()
                    pt = [{"x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2}]
                    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt})
                    pg.wait_for_timeout(ms)
                    seen = pg.is_visible("#lab-tip.on")
                    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
                    pg.wait_for_timeout(150)
                    return seen
                pg.wait_for_timeout(2000)  # any bubble from the taps above has gone
                n0 = pg.evaluate("limitLab.state().n")
                check(long_press("#more"), f"{tag}: a long press on + explains it")
                pg.wait_for_timeout(1300)
                check(long_press("#more"), f"{tag}: a second long press soon after explains it again")
                check(pg.evaluate("limitLab.state().n") == n0, f"{tag}: neither long press acted as a tap")
            # A link can open the lab on a size: ?n=11 lands on the 11-omino fence, an unknown size on 4.
            pg2 = ctx.new_page()
            pg2.goto(BASE + "?n=11", wait_until="networkidle")
            pg2.wait_for_function("window.limitLab && !limitLab.busy()")
            st2 = pg2.evaluate("limitLab.state()")
            check(st2["n"] == 11 and st2["fence"] and st2["pieces"] == 17073, f"{tag}: ?n=11 opens on the 11-omino fence")
            pg2.goto(BASE + "?n=5", wait_until="networkidle")
            pg2.wait_for_function("window.limitLab && !limitLab.busy()")
            st2 = pg2.evaluate("limitLab.state()")
            check(st2["n"] == 5 and st2["optimal"] and st2["tiles"] and st2["pieces"] == 12, f"{tag}: ?n=5 opens on the optimal pentomino fence")
            pg2.goto(BASE + "?n=12345", wait_until="networkidle")
            pg2.wait_for_function("window.limitLab && !limitLab.busy()")
            check(pg2.evaluate("limitLab.state().n") == 4, f"{tag}: an unknown size opens on 4")
            pg2.close()
            body = pg.inner_text("body")
            check(("20" + "25") not in body, f"{tag}: no year on screen")
            ow = pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            check(ow, f"{tag}: no horizontal overflow")
            check(not errors, f"{tag}: no console errors {errors[:2]}")
            ctx.close()
    # The page keeps its Content-Security-Policy (no inline script, no eval): once more with the policy enforced, the sizes
    # that matter and a piece chosen; the page's own state is polled with evaluate, which the policy does not touch.
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
    pg.goto(BASE, wait_until="networkidle")
    def settled():
        for _ in range(150):
            if pg.evaluate("!!window.limitLab && !limitLab.busy()"): return True
            pg.wait_for_timeout(100)
        return False
    check(settled(), "policy on: the lab opens")
    for k in (4, 5, 6, 9, 500, 4):
        pg.evaluate(f"limitLab.setN({k})")
        check(settled() and pg.evaluate("limitLab.state().n") == k, f"policy on: n = {k}")
        if k in (4, 5, 6):
            pg.evaluate("limitLab.pick(2)")
            check(pg.evaluate("limitLab.state().sel") == 2, f"policy on: a piece chosen at n = {k}")
    # the references under the policy: a pill opens its page (data drawn as SVG), Back and Escape work, the paper's link is allowed to navigate
    for n_, chip_, nth_, h2_ in ((9, "polygon", 0, "Table 4"), (500, "gap", 0, "Figure 28"), (9, "polygon", 4, "Figure 24")):
        pg.evaluate(f"limitLab.setN({n_})")
        settled()
        pg.click(f".math-chip[data-chip='{chip_}']")
        pg.click((".math-pop .live .paper-ref" if nth_ == 0 else ".math-pop .math-src .paper-ref") + (" >> nth=0" if nth_ == 0 else " >> nth=1"))
        check(pg.inner_text(".math-pop h2") == h2_ and pg.locator(".math-pop .math-excerpt").count() == 1, f"policy on: {h2_} opens with its data")
        pg.click(".math-pop .math-back")
        pg.keyboard.press("Escape")
    pg.click("#fence-tag") if pg.evaluate("limitLab.state().fence && limitLab.state().n !== 500") else None
    pg.keyboard.press("Escape")
    check(not errs, f"policy on: no console error or warning {errs[:2]}")
    ctx.close()
    browser.close()

print(f"\nlimit-shape ui: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

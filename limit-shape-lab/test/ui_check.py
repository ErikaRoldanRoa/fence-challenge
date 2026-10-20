"""Limit-shape lab · browser checks.

Usage: python3 limit-shape-lab/test/ui_check.py <base-url> <outdir>
(base-url serves the repository root, e.g. http://127.0.0.1:8811/)
Desktop and phone, FR / DE / EN: no console errors, the size steps (4..15, then 500),
the optimal fences for n = 4..6 (their pieces on tiles, the chosen piece lit on the polygon,
the cards with the numbers the lab counts) and the greedy polygons of Section 6.2 for
n = 7..15, their tags, the loupe and its keys (browser shortcuts left alone), the chips per
state, the cards, the bubbles, slides and long presses on the arrows' dots, a one-line
caption, the disabled home.
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/limit-shape-lab/"
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
TITLES = {"fr": "Forme limite", "de": "Grenzform", "en": "Limit shape"}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for view, size, mobile in VIEWS:
        for lang in ["fr", "de", "en"]:
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
            # The loop's accessible name says polygon at 9 and loop at 4; the canvas is not blank; the full loupe stretches the gap to 0.6.
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

            # Bubbles (hover only where there is a mouse).
            if not mobile:
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
    browser.close()

print(f"\nlimit-shape ui: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

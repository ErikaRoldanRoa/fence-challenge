"""Limit-shape lab · browser checks.

Usage: python3 limit-shape-lab/test/ui_check.py <base-url> <outdir>
(base-url serves the repository root, e.g. http://127.0.0.1:8811/)
Desktop and phone, FR / DE / EN: no console errors, the size steps, the
loupe, the chips per state, the cards, the bubbles, the disabled home.
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
            check(sorted(st["chips"]) == ["arrow", "count", "gap", "loop"], f"{tag}: chips at n = 4: {st['chips']}")
            check(st["tiles"], f"{tag}: the tetrominoes sit on tiles")
            nav = pg.eval_on_selector_all(".lab-nav > *", "els => els.map(e => e.getAttribute('aria-disabled') === 'true' ? 'home' : e.getAttribute('href'))")
            check(nav == ["home", "../cube-lab/", "../hexomino-lab/", "../pentomino-dp-lab/"], f"{tag}: nav order {nav}")
            check(st["maxLoupe"] * abs(st["gap"]) <= 0.6 + 1e-9, f"{tag}: loupe capped at n = 4 (×{st['maxLoupe']:.2f})")
            check(pg.get_attribute("#fewer", "aria-disabled") == "true", f"{tag}: no step below 4")
            check(abs(st["gap"] - 0.17851) < 1e-4, f"{tag}: gap at n = 4 is 17.9 %")
            pg.screenshot(path=f"{OUT}/{view}-{lang}-n4.png")

            # Steps up to 10, then the jump to 500, then back.
            for k, c in [(5, 12), (6, 35), (7, 108), (8, 369), (9, 1285), (10, 4655)]:
                pg.click("#more")
                pg.wait_for_function(f"limitLab.state().n === {k} && limitLab.state().pieces === {c}", timeout=15000)
            st = pg.evaluate("limitLab.state()")
            check(st["pieces"] == 4655, f"{tag}: 4655 pieces at n = 10")
            check(not pg.evaluate("limitLab.state().tiles"), f"{tag}: at n = 10 the arrows fan out instead of tiles")
            check(pg.get_attribute("#more", "class").find("skip") >= 0, f"{tag}: + becomes the jump at n = 10")
            pg.click("#more")
            pg.wait_for_function("limitLab.state().n === 500")
            pg.wait_for_function("limitLab.state().samples >= 2 && !limitLab.busy()", timeout=20000)
            st = pg.evaluate("limitLab.state()")
            check(sorted(st["chips"]) == ["gap", "giant", "sample"], f"{tag}: chips at 500: {st['chips']}")
            check(abs(st["loupe"] - 40) < 0.5, f"{tag}: arriving at 500 the loupe sweeps and rests near ×40 ({st['loupe']:.1f})")
            check(pg.get_attribute("#more", "aria-disabled") == "true", f"{tag}: no step above 500")
            check(abs(st["gap"] - 0.00399285) < 1e-8, f"{tag}: gap at 500 is the paper's 0.40 %")
            pg.screenshot(path=f"{OUT}/{view}-{lang}-n500.png")

            # The loupe.
            pg.evaluate("limitLab.setLoupe(100)")
            st = pg.evaluate("limitLab.state()")
            check(abs(st["loupe"] * abs(st["gap"]) - 0.6) < 1e-6, f"{tag}: full loupe stretches the largest gap to 0.6")
            pg.click(".math-chip[data-chip='giant']")
            live = pg.inner_text("#card .live")
            check("603" in live, f"{tag}: the 500-cell estimate is about 1.9·10^603: {live}")
            pg.click("[data-lang-btn='" + ("de" if lang != "de" else "fr") + "']")
            check(pg.is_visible("#card"), f"{tag}: the language switch keeps the card open")
            pg.click("[data-lang-btn='" + lang + "']")
            pg.click("#card-close")
            pg.screenshot(path=f"{OUT}/{view}-{lang}-n500-loupe.png")

            # Every visible chip opens a card with no LaTeX and no line numbers.
            for chip in pg.query_selector_all(".math-chip:not([hidden])"):
                chip.click()
                pg.wait_for_selector("#card:not([hidden])")
                text = pg.inner_text("#card")
                check(not re.search(r"\\label|sec:|lem:|fig:|tab:|l\. ?\d", text), f"{tag}: card {chip.get_attribute('data-chip')} has no source labels")
                check(len(pg.inner_text("#card-section")) > 3, f"{tag}: card {chip.get_attribute('data-chip')} names its section")
                pg.mouse.click(5, size["height"] - 5)
                pg.wait_for_selector("#card", state="hidden")

            pg.click("#fewer")
            pg.wait_for_function("limitLab.state().n === 10 && limitLab.state().pieces === 4655", timeout=15000)
            check(True, f"{tag}: back from 500 to 10")
            pg.evaluate("limitLab.setLoupe(0)")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5")

            # The loop card at n = 9 sets the estimate beside the paper's fences.
            pg.evaluate("limitLab.setN(9)")
            pg.wait_for_function("limitLab.state().pieces === 1285 && !limitLab.busy()")
            pg.click(".math-chip[data-chip='loop']")
            live = pg.inner_text("#card .live")
            check(re.search(r"4.?003.?811", live) and re.search(r"4.?006.?336", live), f"{tag}: n = 9 estimate next to the best fence: {live!r}")
            pg.click("#card-close")
            pg.evaluate("limitLab.setN(4)")
            pg.wait_for_function("limitLab.state().n === 4 && limitLab.state().pieces === 5 && !limitLab.busy()")

            # Choosing a piece lights its edges.
            box = pg.query_selector("#pieces").bounding_box()
            pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2) if not mobile else pg.tap("#pieces", position={"x": box["width"] / 2, "y": box["height"] / 2})
            check(pg.evaluate("limitLab.state().sel") >= 0, f"{tag}: a tap on a piece chooses it")

            # Bubbles (hover only where there is a mouse).
            if not mobile:
                pg.hover("#more")
                pg.wait_for_timeout(450)
                tip = pg.inner_text("#lab-tip") if pg.query_selector("#lab-tip") else ""
                check(len(tip) > 5 and pg.get_attribute("#more", "title") is None, f"{tag}: + explains itself in a bubble")
                home = pg.query_selector(".lab-nav [aria-disabled='true']")
                home.hover()
                pg.wait_for_timeout(450)
                check(len(pg.inner_text("#lab-tip")) > 10, f"{tag}: the disabled home explains itself")
                url = pg.url
                home.click(force=True)
                pg.wait_for_timeout(300)
                check(pg.url == url, f"{tag}: the disabled home does not navigate")
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
            body = pg.inner_text("body")
            check(("20" + "25") not in body, f"{tag}: no year on screen")
            ow = pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            check(ow, f"{tag}: no horizontal overflow")
            check(not errors, f"{tag}: no console errors {errors[:2]}")
            ctx.close()
    browser.close()

print(f"\nlimit-shape ui: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

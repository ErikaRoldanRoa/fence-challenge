"""Browser check of the hexomino lab, played like a visitor.

Usage: python3 ui_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 on the first failed check; screenshots go to OUTDIR.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "hexomino-lab/"
fails = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def state(page):
    return page.evaluate("window.hexLab.state()")


def tap_cell(page, x, y, touch=False):
    sx, sy = page.evaluate(f"window.hexLab.cellToScreen({x},{y})")
    if touch:
        page.touchscreen.tap(sx, sy)
    else:
        page.mouse.click(sx, sy)


def wait_idle(page):
    for _ in range(200):
        if not page.evaluate("window.hexLab.busy()"):
            break
        page.wait_for_timeout(100)
    page.wait_for_timeout(300)


def chips(page):
    return page.evaluate("[...document.querySelectorAll('.math-chip')].filter(b => !b.hidden).map(b => b.dataset.chip)")


def run(browser, lang, vp, touch, shots):
    ctx = browser.new_context(viewport=vp, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    ctx.add_init_script(f"try{{localStorage.setItem('fc-lang','{lang}')}}catch(e){{}}")
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector("#tray .chip")
    tag = f"{lang}-{'phone' if touch else 'desk'}"
    page.screenshot(path=str(OUT / f"{tag}-empty.png"))

    check(touch is False or state(page)["cell"] >= 20, f"{tag}: cells at least 20 px on a phone ({state(page)['cell']})")
    check(page.get_attribute("#mode-arrows", "aria-disabled") == "true", f"{tag}: arrows view disabled without a fence")

    # Any piece, in any order, placed on the first tap.
    page.click("#tray .chip[data-index='12']")
    check(state(page)["sel"] == 12, f"{tag}: tray chooses piece 13")
    tap_cell(page, 0, 0, touch)
    s = state(page)
    check(12 in s["placed"], f"{tag}: piece placed on the first tap")
    check(s["sel"] == 12, f"{tag}: the placed piece stays chosen (no next piece forced)")
    page.click("#tray .chip[data-index='3']")
    spot = page.evaluate("""(() => { for (let r = 1; r < 6; r++) for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++)
      if (!window.hexLab.occupied(x, y) && !window.hexLab.fitsAt(3, x, y)) return [x, y]; return null; })()""")
    tap_cell(page, spot[0], spot[1], touch)
    check(3 not in state(page)["placed"] and state(page)["blocked"], f"{tag}: a blocked spot shows a red outline, places nothing")
    far = page.evaluate("(() => { for (let x = 6; x < 20; x++) if (window.hexLab.fitsAt(3, x, 0)) return x; })()")
    tap_cell(page, far, 0, touch)
    check(3 in state(page)["placed"], f"{tag}: second piece, chosen out of order")
    # Edit the first piece again.
    c = page.evaluate("window.hexLab.placedCells(12)")
    tap_cell(page, c[0][0], c[0][1], touch)
    check(state(page)["sel"] == 12, f"{tag}: tap re-chooses a placed piece")
    page.click("#rotate")
    c2 = page.evaluate("window.hexLab.placedCells(12)")
    check(c2 != c, f"{tag}: the placed piece turns in place")
    if not touch:
        page.locator("#board").focus()
        page.keyboard.press("ArrowRight")
        c3 = page.evaluate("window.hexLab.placedCells(12)")
        check(c3 and c3[0][0] == c2[0][0] + 1, f"{tag}: arrow key moves it")
        # Drag piece 3 without choosing it first.
        c4 = page.evaluate("window.hexLab.placedCells(3)")
        x0, y0 = page.evaluate(f"window.hexLab.cellToScreen({c4[0][0]},{c4[0][1]})")
        x1, y1 = page.evaluate(f"window.hexLab.cellToScreen({c4[0][0]+3},{c4[0][1]-4})")
        page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move((x0+x1)/2, (y0+y1)/2, steps=4); page.mouse.move(x1, y1, steps=4); page.mouse.up()
        c5 = page.evaluate("window.hexLab.placedCells(3)")
        check(c5 and c5[0] == [c4[0][0] + 3, c4[0][1] - 4], f"{tag}: dragging an unchosen placed piece moves it")
        page.keyboard.press("Control+z")
        check(page.evaluate("window.hexLab.placedCells(3)") == c4, f"{tag}: undo puts it back")
        c = page.evaluate("window.hexLab.placedCells(12)")
        tap_cell(page, c[0][0], c[0][1], touch)
    page.click("#remove")
    check(12 not in state(page)["placed"], f"{tag}: put back in the tray")
    page.click("#undo")
    check(12 in state(page)["placed"], f"{tag}: undo brings it back")
    tap_cell(page, -5, 6, touch)
    check(state(page)["sel"] is None, f"{tag}: tapping empty space deselects, chooses nothing")
    check(page.is_disabled("#remove") and page.is_disabled("#rotate"), f"{tag}: nothing chosen: remove and turn disabled")
    # Clear asks again.
    page.click("#clear")
    check(page.is_visible("#again") and state(page)["placed"], f"{tag}: clear arms first")
    page.screenshot(path=str(OUT / f"{tag}-armed.png"))
    page.click("#clear")
    check(not state(page)["placed"], f"{tag}: second tap clears")
    page.click("#undo")
    page.click("#mode-arrows", force=True)
    check(state(page)["mode"] == "build" and page.is_visible("#toast"), f"{tag}: arrows view refuses without a closed fence, with a hint")

    # The two bundled fences.
    check(chips(page) == [], f"{tag}: no chip on a board without area {chips(page)}")
    page.click("#load-previous")
    wait_idle(page)
    page.screenshot(path=str(OUT / f"{tag}-previous.png"))
    check(sorted(chips(page)) == ["area", "recordPrev"], f"{tag}: chips on the previous best fence {chips(page)}")
    s = state(page)
    check(s["area"] == 1586 and s["valid"], f"{tag}: previous best fence encloses 1586")
    page.click("#reveal")
    wait_idle(page)
    s = state(page)
    check(s["area"] == 1597 and s["valid"] and s["arrows"], f"{tag}: paper fence encloses 1597, arrows available")
    page.screenshot(path=str(OUT / f"{tag}-1597.png"))

    check(sorted(chips(page)) == ["area", "thm1597"], f"{tag}: chips after the reveal {chips(page)}")
    page.click("#mode-arrows")
    page.wait_for_timeout(300)
    check(sorted(chips(page)) == ["lemma", "refvec"], f"{tag}: chips on the arrows {chips(page)}")
    eq = [page.inner_text(f"#val-{k}") for k in ("ref", "delta", "area")]
    check(eq == ["1663", "−66", "1597"], f"{tag}: equation reads {eq}")
    page.screenshot(path=str(OUT / f"{tag}-arrows.png"))
    page.click("#corners")
    page.wait_for_timeout(200)
    check(len(chips(page)) == 3 and "rotation" in chips(page), f"{tag}: corner chip {chips(page)}")
    page.screenshot(path=str(OUT / f"{tag}-corners.png"))
    page.click("#corners")
    page.click("#shuffle")
    page.wait_for_timeout(1100)
    check(state(page)["phase"] == "shuffled", f"{tag}: shuffled")
    shuffled = float(page.inner_text("#val-ref").replace("−", "-").replace(",", "."))
    check(not page.is_visible("#tok-delta") and not page.is_visible("#tok-area"), f"{tag}: no equation for a shuffled order")
    check(shuffled <= 1663, f"{tag}: shuffled polygon area {shuffled} <= 1663")
    page.screenshot(path=str(OUT / f"{tag}-shuffled.png"))
    page.click("#sort")
    page.wait_for_timeout(1100)
    check(sorted(chips(page)) == ["bound", "p2"], f"{tag}: chips when sorted {chips(page)}")
    check(state(page)["phase"] == "sorted" and page.inner_text("#val-ref") == "1663", f"{tag}: sorted back to the convex 1663")
    page.screenshot(path=str(OUT / f"{tag}-sorted.png"))

    # Math chips: only the ones the state needs.
    page.click("[data-chip='p2']")
    page.wait_for_timeout(400)
    check(page.is_visible(".math-pop") and page.get_attribute(".math-pop", "data-label") == "sec:8way", f"{tag}: P2 card opens")
    check(page.is_visible(".math-pop .math-close") and page.inner_text(".math-pop h2").strip().endswith("?"), f"{tag}: the card has a close button and its question")
    txt = page.inner_text(".math-pop")
    check(not any(w in txt for w in ("sec:", "thm:", "paper-tech", "in preparation", "en préparation", "Vorbereitung")), f"{tag}: no labels or file names on the card")
    page.screenshot(path=str(OUT / f"{tag}-card-p2.png"))
    page.mouse.click(5, 300)
    page.wait_for_timeout(200)
    check(not page.is_visible(".math-pop"), f"{tag}: a tap outside closes the card")
    page.click("#mode-build")
    page.click("[data-chip='thm1597']")
    page.wait_for_timeout(400)
    check(page.get_attribute(".math-pop", "data-label") == "thm:1597", f"{tag}: theorem card")
    page.click(".math-pop .math-close")
    page.wait_for_timeout(200)
    check(not page.is_visible(".math-pop"), f"{tag}: the close button closes the card")
    page.screenshot(path=str(OUT / f"{tag}-card-thm.png"))
    check(not errors, f"{tag}: no console errors {errors[:3]}")
    ctx.close()




def tip_checks(browser, url, ready, items, home_sel, touch_sel, tag):
    """The shared bubble (../lab-tip.js): hover, keyboard focus, touch long
    press, the disabled home, no native title, no layout shift."""
    for lang in ("en", "fr", "de"):
        ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
        pg = ctx.new_page()
        pg.add_init_script(f"localStorage.setItem('fc-lang','{lang}')")
        pg.goto(url)
        pg.wait_for_function(ready)
        pg.wait_for_timeout(300)
        bubble = lambda: pg.evaluate("(() => { const t = document.querySelector('.lab-tip'); return t && t.classList.contains('on') ? t.textContent : null; })()")
        check(pg.evaluate("document.querySelectorAll('body [title]').length") == 0, f"{tag} {lang}: no native title left")
        before = pg.evaluate("JSON.stringify([...document.querySelectorAll('.ctl, .chip, canvas')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        for sel, key in items:
            pg.mouse.move(5, 5)
            pg.wait_for_timeout(80)
            box = pg.locator(sel).first.bounding_box()
            pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            pg.wait_for_timeout(120)
            early = bubble()
            pg.wait_for_timeout(300)
            want = pg.evaluate(f"window.i18n.t({key!r})")
            check(early is None and bubble() == want, f"{tag} {lang}: hover {sel} shows '{want}' after a delay")
        if lang == "en":
            pg.screenshot(path=str(OUT / f"{tag}-tip-hover.png"))
        after = pg.evaluate("JSON.stringify([...document.querySelectorAll('.ctl, .chip, canvas')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        check(before == after, f"{tag} {lang}: the bubble moves nothing")
        # the disabled home explains itself and goes nowhere
        url0 = pg.url
        box = pg.locator(home_sel).bounding_box()
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pg.wait_for_timeout(450)
        check(bubble() == pg.evaluate("window.i18n.t('lab.homeSoon')"), f"{tag} {lang}: the disabled home explains itself")
        if lang == "fr":
            pg.screenshot(path=str(OUT / f"{tag}-tip-home-fr.png"))
        pg.click(home_sel, force=True)
        pg.wait_for_timeout(200)
        check(pg.url == url0, f"{tag} {lang}: the disabled home does not navigate")
        # keyboard focus
        pg.mouse.move(5, 5)
        pg.focus(items[0][0])
        pg.keyboard.press("Shift+Tab")
        pg.keyboard.press("Tab")
        pg.wait_for_timeout(60)
        check(bubble() is not None, f"{tag} {lang}: keyboard focus shows the bubble")
        ctx.close()
    # touch: a long press explains, a tap does not
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2, bypass_csp=True)
    pg = ctx.new_page()
    pg.add_init_script("localStorage.setItem('fc-lang','de')")
    pg.goto(url)
    pg.wait_for_function(ready)
    pg.wait_for_timeout(300)
    bubble = lambda: pg.evaluate("(() => { const t = document.querySelector('.lab-tip'); return t && t.classList.contains('on') ? t.textContent : null; })()")
    box = pg.locator(touch_sel).bounding_box()
    pg.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    pg.wait_for_timeout(600)
    check(bubble() is None, f"{tag}: a tap shows no bubble")
    pg.evaluate(f"""(() => {{ const el = document.querySelector({touch_sel!r}); const r = el.getBoundingClientRect();
      const o = {{ bubbles: true, pointerType: 'touch', pointerId: 7, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }};
      el.dispatchEvent(new PointerEvent('pointerdown', o)); window.__lp = () => el.dispatchEvent(new PointerEvent('pointerup', o)); }})()""")
    pg.wait_for_timeout(250)
    check(bubble() is None, f"{tag}: not yet at 250 ms of a press")
    pg.wait_for_timeout(350)
    check(bubble() is not None, f"{tag}: a long press shows the bubble")
    pg.screenshot(path=str(OUT / f"{tag}-tip-longpress-de.png"))
    pg.evaluate("window.__lp()")
    pg.wait_for_timeout(200)
    check(bubble() is not None, f"{tag}: the bubble stays a moment after the press")
    pg.wait_for_timeout(1700)
    check(bubble() is None, f"{tag}: then it goes")
    ctx.close()


with sync_playwright() as p:
    b = p.chromium.launch()
    for lang in ("en", "fr", "de"):
        run(b, lang, {"width": 1400, "height": 900}, False, True)
        run(b, lang, {"width": 390, "height": 844}, True, True)
    print("[tips]")
    tip_checks(b, URL, "window.hexLab", [("#rotate", "hx.rotate"), ("#mode-build", "hx.build"), ("#zoom-in", "hx.zoomIn")],
               ".lab-nav [aria-disabled='true']", "#mode-build", "hexo")
    b.close()

print(json.dumps({"failed": fails}, ensure_ascii=False))
sys.exit(1 if fails else 0)

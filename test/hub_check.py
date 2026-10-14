"""Check of the hub of all the labs (hub/).

In Chromium and WebKit, at 390 x 844 and 1440 x 900, in FR / DE / EN: no
console error, no horizontal scroll, no optimum and no year 2025 in any
visible string, bubble or label; no layout shift; the three warm-up doors open
the first hub at their mission; every card and link opens the right page
without errors; the manual opens and closes (button, Escape, beside it) and
stays out of the Tab path while closed; the language switch, the keyboard
path and the copy button work; every lab's home leads back here.

Usage: python3 test/hub_check.py <base-url> [outdir]
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = sys.argv[2] if len(sys.argv) > 2 else None
HUB = BASE + "hub/"
LANGS = ["en", "fr", "de"]
VIEWS = [(390, 844, True), (1440, 900, False)]
# Optima of the papers and of the boards: the hub asks, it never answers.
FORBIDDEN = re.compile(r"(?<![\d.])(1597|1586|1588|111|128|52|1331|25544|2025)(?![\d])")
DOORS = ["../#sqT", "../#hexT", "../#triT"]
CARDS = ["../square-lab/", "../hex-lab/", "../triangle-lab/",
         "../hexomino-lab/", "../pentomino-dp-lab/", "../limit-shape-lab/", "../cube-lab/"]
QUESTION = {"en": "How much can a fence enclose?", "fr": "Combien une barrière peut-elle enclore ?",
            "de": "Wie viel kann ein Zaun einschließen?"}

fails, oks = [], 0
def check(cond, msg):
    global oks
    if cond: oks += 1
    else: fails.append(msg)

TEXTS = r"""() => {
  const out = [document.body.innerText, document.title];
  document.querySelectorAll('*').forEach((e) => {
    for (const a of ['title', 'aria-label', 'data-lab-tip', 'alt', 'placeholder']) { const v = e.getAttribute(a); if (v) out.push(v); }
  });
  for (const l of ['fr', 'de', 'en']) for (const k in DICT[l]) if (k.startsWith('mh.')) out.push(DICT[l][k]);
  return out.join('\n');
}"""

with sync_playwright() as p:
    for eng in ("chromium", "webkit"):
        b = getattr(p, eng).launch()
        for (w, h, touch) in VIEWS:
            for lang in LANGS:
                tag = f"{eng} {w}x{h} {lang}"
                ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=touch, device_scale_factor=2 if touch else 1)
                ctx.add_init_script("try{localStorage.setItem('fc-lang','%s')}catch(e){}" % lang)
                ctx.add_init_script("window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}")
                pg = ctx.new_page(); errs = []
                pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                pg.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
                pg.goto(HUB, wait_until="networkidle")
                pg.wait_for_timeout(1100)
                check(pg.evaluate("window.__cls") < 0.001, f"{tag}: no layout shift while loading")
                check(pg.inner_text("h1") == QUESTION[lang], f"{tag}: the question in the language")
                check(pg.evaluate("document.documentElement.lang") == lang, f"{tag}: html lang")
                check(pg.get_attribute(f'[data-lang-btn="{lang}"]', "aria-pressed") == "true", f"{tag}: language pressed")
                check(pg.evaluate("document.scrollingElement.scrollWidth <= innerWidth"), f"{tag}: no horizontal scroll")
                check(pg.evaluate("document.querySelectorAll('body [title]').length") == 0, f"{tag}: no native title left")
                check(pg.evaluate("[...document.querySelectorAll('.face.front')].every(f => f.innerText.replace(/\\u2605/g, '').trim() === '')"), f"{tag}: the tiles' fronts carry no words")
                hrefs = pg.eval_on_selector_all("a.card", "els => els.map(e => e.getAttribute('href'))")
                check(hrefs == CARDS, f"{tag}: cards {hrefs}")
                doors = pg.eval_on_selector_all("a.door", "els => els.map(e => e.getAttribute('href'))")
                check(doors == DOORS, f"{tag}: doors {doors}")
                names = pg.eval_on_selector_all(".dname", "els => els.map(e => [e.querySelector('.kicker') && e.querySelector('.kicker').textContent, e.querySelector('.dtitle') && e.querySelector('.dtitle').textContent])")
                want = pg.evaluate("['hub.sqTitle', 'hub.hexTitle', 'hub.triTitle'].map(k => i18n.t(k).split(' · '))")
                check(names == want, f"{tag}: door titles are the first hub's missions {names}")
                tips = pg.eval_on_selector_all("a, button", "els => els.filter(e => !(e.getAttribute('data-lab-tip') || e.getAttribute('aria-label'))).map(e => e.outerHTML.slice(0, 60))")
                check(not tips, f"{tag}: every control explains itself {tips}")
                text = pg.evaluate(TEXTS)
                bad = sorted(set(m.group(0) for m in FORBIDDEN.finditer(text)))
                check(not bad, f"{tag}: no optimum, no year 2025 in any string {bad}")
                check("\u2014" not in text, f"{tag}: no em dash")
                small = pg.evaluate("""() => [...document.querySelectorAll('a, button')].filter(e => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(e => e.textContent.trim().slice(0, 20))""")
                check(not small, f"{tag}: every touch box at least 44 px {small}")
                if OUT:
                    pg.screenshot(path=os.path.join(OUT, f"hub_{eng}_{w}_{lang}.png"), full_page=True)
                # Every card opens its page with no error.
                if lang == "en" or eng == "chromium":
                    for i, href in enumerate(CARDS):
                        pg.goto(HUB, wait_until="networkidle")
                        pg.wait_for_timeout(1100)
                        card = pg.locator("a.card").nth(i)
                        card.scroll_into_view_if_needed()
                        if touch:
                            # A first tap turns the tile over; the second opens the lab.
                            card.tap(); pg.wait_for_timeout(700)
                            check(pg.url.startswith(HUB) and "flipped" in (card.get_attribute("class") or ""), f"{tag}: card {i}: a first tap turns it over")
                            card.tap()
                        else: card.click()
                        want = BASE + href[3:]
                        pg.wait_for_url(want + "**")
                        pg.wait_for_load_state("networkidle")
                        check(pg.url.split("?")[0] == want, f"{tag}: card {i} opens {href}")
                # Every door opens the first hub with its mission in view.
                if lang == "en" or eng == "chromium":
                    for i, href in enumerate(DOORS):
                        pg.goto(HUB, wait_until="networkidle")
                        pg.wait_for_timeout(1100)
                        door = pg.locator("a.door").nth(i)
                        if touch:
                            door.tap(); pg.wait_for_timeout(700); door.tap()
                        else: door.click()
                        pg.wait_for_url(BASE + href[3:])
                        pg.wait_for_load_state("networkidle")
                        pg.wait_for_timeout(300)
                        box = pg.evaluate("(id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })", href[4:])
                        check(0 <= box[0] and box[1] <= box[2], f"{tag}: door {i} shows its mission {box}")
                check(not errs, f"{tag}: no console error {errs[:3]}")
                ctx.close()

        # Keyboard path, bubble on focus, copy, language switch (desktop).
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        if eng == "chromium":
            ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        ctx.add_init_script("try{localStorage.setItem('fc-lang','en')}catch(e){}")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(HUB, wait_until="networkidle")
        bubble = lambda: pg.evaluate("(() => { const t = document.querySelector('.lab-tip'); return t && t.classList.contains('on') ? t.textContent : null; })()")
        pg.wait_for_timeout(1100)
        order = []
        for _ in range(26):
            pg.keyboard.press("Tab")
            order.append(pg.evaluate("(() => { const a = document.activeElement; return a.getAttribute('href') || a.id || a.getAttribute('data-lang-btn'); })()"))
        check(order[:4] == ["manualBtn", "fr", "de", "en"], f"{eng}: Tab starts on the manual and the language switch {order[:4]}")
        # WebKit, like Safari, leaves links out of the Tab order by default.
        if eng == "chromium":
            want = ["../", "rowP1", "rowP2"] + DOORS + CARDS + ["stripP2", "stripP3", "stripP1", "https://erikaroldan.net"]
            check(order[4:4 + len(want)] == want,
                  f"{eng}: Tab then walks the first hub, the paper doors, the warm-ups, the labs, the people and the signature, never the closed manual {order[4:4 + len(want)]}")
        pg.focus("a.card >> nth=0")
        if eng == "chromium":
            pg.keyboard.press("Shift+Tab"); pg.keyboard.press("Tab")
        pg.wait_for_timeout(80)
        if eng == "chromium":
            check(bubble() == pg.evaluate("i18n.t('mh.n.square') + i18n.t('mh.q.square')"), f"{eng}: keyboard focus on a lab shows its name and question")
        active = pg.evaluate("document.activeElement.getAttribute('href')")
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(1500)
        check("/square-lab/" in pg.url, f"{eng}: Enter on a card opens it ({active} -> {pg.url})")
        pg.goto(HUB, wait_until="networkidle")
        # Hover: the bubble after a short delay, nothing moves.
        pg.wait_for_timeout(1100)
        before = pg.evaluate("JSON.stringify([...document.querySelectorAll('.piece, .tag, .ctl')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        box = pg.locator("a.card").nth(3).bounding_box()
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pg.wait_for_timeout(500)
        check(bubble() == pg.evaluate("i18n.t('mh.n.hexo') + i18n.t('mh.q.hexo')"), f"{eng}: hover on a lab shows its name and question")
        lifted = pg.evaluate("(() => { const a = document.querySelectorAll('a.card .slab'); return [getComputedStyle(a[3]).opacity, getComputedStyle(a[4]).opacity]; })()")
        check(lifted[0] == "1" and float(lifted[1]) < 0.6, f"{eng}: the pointed piece comes forward, the others step back {lifted}")
        box = pg.locator("a.door").nth(1).bounding_box()
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pg.wait_for_timeout(500)
        check(bubble() == pg.evaluate("i18n.t('hub.hexTitle').split(' · ')[0] + i18n.t('mh.warm.hex')"), f"{eng}: hover on a door shows its bubble")
        # While one piece is lifted, every other piece still takes the pointer.
        missed = []
        pieces = pg.locator("a.piece")
        for i in range(pieces.count()):
            prev = pieces.nth((i + 1) % pieces.count()).bounding_box()
            pg.mouse.move(prev["x"] + prev["width"] / 2, prev["y"] + prev["height"] / 2); pg.wait_for_timeout(450)
            bb = pieces.nth(i).bounding_box()
            hit = pg.evaluate("([x, y]) => { const e = document.elementFromPoint(x, y); const a = e && e.closest('a.piece'); return a === document.querySelectorAll('a.piece')[%d]; }" % i, [bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2])
            if not hit: missed.append(pieces.nth(i).get_attribute("href"))
        check(not missed, f"{eng}: with another piece lifted, each piece still takes the pointer {missed}")
        pg.mouse.move(2, 2); pg.wait_for_timeout(700)
        after = pg.evaluate("JSON.stringify([...document.querySelectorAll('.piece, .tag, .ctl')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        check(before == after, f"{eng}: no layout shift")
        # Language switch in place.
        pg.click('[data-lang-btn="de"]'); pg.wait_for_timeout(150)
        check(pg.inner_text("h1") == QUESTION["de"] and pg.title().startswith("Alle Labore"), f"{eng}: switch to German")
        check(pg.inner_text(".door >> nth=0 >> .dtitle") == "Das Schachbrett", f"{eng}: the doors switch too")
        pg.click('[data-lang-btn="en"]'); pg.wait_for_timeout(150)
        # The manual: closed and out of reach, opens, closes three ways.
        man = lambda: pg.evaluate("(() => { const m = document.getElementById('manual'); return [m.classList.contains('open'), m.hasAttribute('inert'), getComputedStyle(m).visibility, document.getElementById('manualBtn').getAttribute('aria-expanded')]; })()")
        check(man() == [False, True, "hidden", "false"], f"{eng}: the manual starts closed {man()}")
        ids = pg.eval_on_selector_all(".paperblock", "els => els.map(e => e.id)")
        check(ids == ["mP2", "mP3", "mP1"], f"{eng}: the technical paper first, then the two DMVM papers {ids}")
        pg.click("#manualBtn"); pg.wait_for_timeout(450)
        check(man() == [True, False, "visible", "true"] and pg.evaluate("document.activeElement.id") == "manualClose", f"{eng}: the button opens the manual, focus inside {man()}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
        check(man()[0] is False and pg.evaluate("document.activeElement.id") == "manualBtn", f"{eng}: Escape closes it, focus back on the button")
        pg.click("#manualBtn"); pg.wait_for_timeout(450)
        pg.mouse.click(40, 450); pg.wait_for_timeout(450)
        check(man()[0] is False, f"{eng}: a click beside the manual closes it")
        pg.click("#manualBtn"); pg.wait_for_timeout(450)
        pg.click("#manualClose"); pg.wait_for_timeout(450)
        check(man()[0] is False, f"{eng}: the cross closes it")
        # A paper's strip opens the manual at that paper; closing returns to it.
        for door, block in (("#stripP2", "mP2"), ("#rowP1", "mP1"), ("#stripP3", "mP3")):
            pg.locator(door).scroll_into_view_if_needed(); pg.click(door); pg.wait_for_timeout(500)
            seen = pg.evaluate("(id => { const m = document.getElementById('manual').getBoundingClientRect(), b = document.getElementById(id).getBoundingClientRect(); return m.right > 0 && b.top >= 0 && b.top < innerHeight / 2; })", block)
            check(man()[0] is True and seen, f"{eng}: {door} opens the manual at its paper")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
            check(pg.evaluate("'#' + document.activeElement.id") == door, f"{eng}: closing returns to {door}")
        pg.click("#manualBtn"); pg.wait_for_timeout(450)
        # Copy the BibTeX.
        pg.locator("#copy").scroll_into_view_if_needed()
        pg.click("#copy"); pg.wait_for_timeout(200)
        check(pg.evaluate("document.getElementById('copy').classList.contains('done')"), f"{eng}: copy confirms")
        if eng == "chromium":
            clip = pg.evaluate("navigator.clipboard.readText()")
            check(clip.startswith("@misc{FenceChallenge,\n  author") and clip.rstrip().endswith("}") and "year         = {2026}" in clip, f"{eng}: the BibTeX lands in the clipboard as written")
        # External links and the citation file.
        links = pg.eval_on_selector_all("a.tag", "els => els.map(e => e.getAttribute('href'))")
        check(links == ["https://arxiv.org/abs/2607.22379", "https://doi.org/10.1515/dmvm-2025-0056", "../CITATION.cff"], f"{eng}: paper links, arXiv first, then the published article {links}")
        r = pg.request.get(BASE + "CITATION.cff")
        check(r.ok, f"{eng}: CITATION.cff is served")
        check(not errs, f"{eng}: no page error {errs}")
        ctx.close()

        # Reduced motion: no piece moves on hover.
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        pg = ctx.new_page(); pg.goto(HUB, wait_until="networkidle")
        rest = pg.evaluate("getComputedStyle(document.querySelector('a.card .slab')).transform")
        box = pg.locator("a.card").first.bounding_box()
        pg.mouse.move(box["x"] + 20, box["y"] + 20); pg.wait_for_timeout(300)
        check(pg.evaluate("getComputedStyle(document.querySelector('a.card .slab')).transform") == rest, f"{eng}: reduced motion keeps the pieces still")
        ctx.close()

        # Every 2026 lab's home leads here.
        ctx = b.new_context(viewport={"width": 1400, "height": 900})
        for lab in ("cube-lab", "hexomino-lab", "limit-shape-lab", "pentomino-dp-lab"):
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            pg.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
            pg.goto(BASE + lab + "/", wait_until="networkidle")
            pg.click(".lab-nav a[href='../hub/']")
            pg.wait_for_url("**/hub/")
            pg.wait_for_load_state("networkidle")
            check(pg.locator("a.card").count() == len(CARDS) and pg.locator("a.door").count() == 3, f"{eng}: {lab} home lands on the hub")
            check(not errs, f"{eng}: {lab} and the hub without errors {errs[:3]}")
            pg.close()
        ctx.close()
        b.close()

for f in fails: print("FAIL", f)
print(f"hub check: {oks} ok, {len(fails)} failed")
sys.exit(1 if fails else 0)

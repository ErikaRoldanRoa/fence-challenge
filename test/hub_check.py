"""Check of the hub of all the labs (hub/).

In Chromium and WebKit, at 390 x 844 and 1440 x 900, in FR / DE / EN: no
console error, no horizontal scroll, no optimum and no year 2025 in any
visible string, bubble or label; every card and link opens the right page
without errors; the language switch, the keyboard path and the copy button
work; every lab's home leads back here.

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
CARDS = ["../square-lab/", "../hex-lab/", "../triangle-lab/", "../camera/",
         "../hexomino-lab/", "../pentomino-dp-lab/", "../cube-lab/", "../limit-shape-lab/",
         "../hexomino-lab/", "../pentomino-dp-lab/", "../cube-lab/"]
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
                pg = ctx.new_page(); errs = []
                pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                pg.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
                pg.goto(HUB, wait_until="networkidle")
                pg.wait_for_timeout(300)
                check(pg.inner_text("h1") == QUESTION[lang], f"{tag}: the question in the language")
                check(pg.evaluate("document.documentElement.lang") == lang, f"{tag}: html lang")
                check(pg.get_attribute(f'[data-lang-btn="{lang}"]', "aria-pressed") == "true", f"{tag}: language pressed")
                check(pg.evaluate("document.scrollingElement.scrollWidth <= innerWidth"), f"{tag}: no horizontal scroll")
                check(pg.evaluate("document.querySelectorAll('body [title]').length") == 0, f"{tag}: no native title left")
                hrefs = pg.eval_on_selector_all("a.card", "els => els.map(e => e.getAttribute('href'))")
                check(hrefs == CARDS, f"{tag}: cards {hrefs}")
                tips = pg.eval_on_selector_all("a, button", "els => els.filter(e => !(e.getAttribute('data-lab-tip') || e.getAttribute('aria-label'))).map(e => e.outerHTML.slice(0, 60))")
                check(not tips, f"{tag}: every control explains itself {tips}")
                text = pg.evaluate(TEXTS)
                bad = sorted(set(m.group(0) for m in FORBIDDEN.finditer(text)))
                check(not bad, f"{tag}: no optimum, no year 2025 in any string {bad}")
                check("—" not in text, f"{tag}: no em dash")
                small = pg.evaluate("""() => [...document.querySelectorAll('a, button')].filter(e => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(e => e.textContent.trim().slice(0, 20))""")
                check(not small, f"{tag}: every touch box at least 44 px {small}")
                if OUT:
                    pg.screenshot(path=os.path.join(OUT, f"hub_{eng}_{w}_{lang}.png"), full_page=True)
                # Every card opens its page with no error.
                if lang == "en" or eng == "chromium":
                    for i, href in enumerate(CARDS):
                        pg.goto(HUB, wait_until="networkidle")
                        card = pg.locator("a.card").nth(i)
                        card.scroll_into_view_if_needed()
                        if touch: card.tap()
                        else: card.click()
                        want = BASE + href[3:]
                        pg.wait_for_url(want + "**")
                        pg.wait_for_load_state("networkidle")
                        check(pg.url.split("?")[0] == want, f"{tag}: card {i} opens {href}")
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
        order = []
        for _ in range(20):
            pg.keyboard.press("Tab")
            order.append(pg.evaluate("(() => { const a = document.activeElement; return a.getAttribute('href') || a.id || a.getAttribute('data-lang-btn'); })()"))
        check(order[:3] == ["fr", "de", "en"], f"{eng}: Tab starts on the language switch {order[:3]}")
        # WebKit, like Safari, leaves links out of the Tab order by default.
        if eng == "chromium":
            check(order[3:5] == ["https://doi.org/10.1515/dmvm-2025-0056", "https://arxiv.org/abs/2607.22379"] and order[5:16] == CARDS,
                  f"{eng}: Tab then walks the paper links and the cards in order {order[3:16]}")
        pg.focus("a.card >> nth=0")
        if eng == "chromium":
            pg.keyboard.press("Shift+Tab"); pg.keyboard.press("Tab")
        pg.wait_for_timeout(80)
        if eng == "chromium":
            check(bubble() == pg.evaluate("i18n.t('mh.open.square')"), f"{eng}: keyboard focus on a card shows its bubble")
        active = pg.evaluate("document.activeElement.getAttribute('href')")
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(1500)
        check("/square-lab/" in pg.url, f"{eng}: Enter on a card opens it ({active} -> {pg.url})")
        pg.goto(HUB, wait_until="networkidle")
        # Hover: the bubble after a short delay, nothing moves.
        before = pg.evaluate("JSON.stringify([...document.querySelectorAll('.card, .tag, .ctl')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        box = pg.locator("a.card").nth(4).bounding_box()
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pg.wait_for_timeout(500)
        check(bubble() == pg.evaluate("i18n.t('mh.open.hexo')"), f"{eng}: hover on a card shows its bubble")
        pg.mouse.move(2, 2); pg.wait_for_timeout(300)
        after = pg.evaluate("JSON.stringify([...document.querySelectorAll('.card, .tag, .ctl')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        check(before == after, f"{eng}: no layout shift")
        # Language switch in place.
        pg.click('[data-lang-btn="de"]'); pg.wait_for_timeout(150)
        check(pg.inner_text("h1") == QUESTION["de"] and pg.title().startswith("Alle Labore"), f"{eng}: switch to German")
        pg.click('[data-lang-btn="en"]'); pg.wait_for_timeout(150)
        # Copy the BibTeX.
        pg.locator("#copy").scroll_into_view_if_needed()
        pg.click("#copy"); pg.wait_for_timeout(200)
        check(pg.evaluate("document.getElementById('copy').classList.contains('done')"), f"{eng}: copy confirms")
        if eng == "chromium":
            clip = pg.evaluate("navigator.clipboard.readText()")
            check(clip.startswith("@misc{FenceChallenge,\n  author") and clip.rstrip().endswith("}") and "year         = {2026}" in clip, f"{eng}: the BibTeX lands in the clipboard as written")
        # External links and the citation file.
        links = pg.eval_on_selector_all("a.tag", "els => els.map(e => e.getAttribute('href'))")
        check(links == ["https://doi.org/10.1515/dmvm-2025-0056", "https://arxiv.org/abs/2607.22379", "../CITATION.cff"], f"{eng}: paper links {links}")
        r = pg.request.get(BASE + "CITATION.cff")
        check(r.ok, f"{eng}: CITATION.cff is served")
        check(not errs, f"{eng}: no page error {errs}")
        ctx.close()

        # Reduced motion: no card moves on hover.
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        pg = ctx.new_page(); pg.goto(HUB, wait_until="networkidle")
        box = pg.locator("a.card").first.bounding_box()
        pg.mouse.move(box["x"] + 20, box["y"] + 20); pg.wait_for_timeout(300)
        check(pg.evaluate("getComputedStyle(document.querySelector('a.card')).transform") in ("none", ""), f"{eng}: reduced motion keeps the cards still")
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
            check(pg.locator("a.card").count() == len(CARDS), f"{eng}: {lab} home lands on the hub")
            check(not errs, f"{eng}: {lab} and the hub without errors {errs[:3]}")
            pg.close()
        ctx.close()
        b.close()

for f in fails: print("FAIL", f)
print(f"hub check: {oks} ok, {len(fails)} failed")
sys.exit(1 if fails else 0)

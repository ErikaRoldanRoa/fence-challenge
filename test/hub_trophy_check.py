"""The trophy of each of the home page's three cards: its goal icon, dark until the best fence of the card is built.

For each card (the squares, the hexagons, the triangles), in French, German and English:
  - the icon is dark and says so; no number is written in what it says;
  - a fence smaller than the best (the pill is live, the number shown) leaves it dark;
  - the best fence of the card's pieces on its board lights it, the icon, its bubble and its label say so, the polite
    announcement says it, and a device that built it remembers it (clearing the board does not take it back, a reload shows it);
  - another card's trophy stays dark.
The fences are placed through the card's own engine (setState, then detectArea, as the card does after a move); they come from
test/hub_best_fences.json: the optimal boundaries of the paper's dynamic programme, each judged by the card's own rule
(the card's analysis on its real board) before it was kept.

Usage: python3 test/hub_trophy_check.py BASE_URL [OUTDIR]
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/). Needs playwright. Exits 1 on a failure.
FC_BROWSER=webkit runs it in the engine of Safari (the default is chromium).
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = sys.argv[2] if len(sys.argv) > 2 else None
ENGINE = os.environ.get("FC_BROWSER", "chromium")
HERE = os.path.dirname(os.path.abspath(__file__))
FENCES = json.load(open(os.path.join(HERE, "hub_best_fences.json")))
CARDS = ["sq", "hex", "tri"]
fails = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


PLACE = """([id, placed]) => {
  const eng = document.getElementById('engine-' + id)._engine;
  eng.setState({ placedPieces: placed, selectedTypeId: null, selectedPieceId: null });
  return eng.detectArea().area;
}"""
CLEAR = "(id) => { const eng = document.getElementById('engine-' + id)._engine; eng.clear(); eng.detectArea(); }"
STATE = """(id) => {
  const el = document.querySelector('.icon.goal[data-goal="' + id + '"]');
  return { won: el.classList.contains('won'), aria: el.getAttribute('aria-label'), tip: el.getAttribute('data-tip'),
           i18n: [el.getAttribute('data-i18n-aria-label'), el.getAttribute('data-i18n-data-tip')],
           stored: (() => { try { return localStorage.getItem('fc-hub-trophy-' + id); } catch (e) { return 'unreadable'; } })(),
           svg: !!el.querySelector('svg'), box: (() => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
           pill: document.getElementById('pill-' + id).classList.contains('live'), shown: document.getElementById('area-' + id).textContent };
}"""


with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch()
    for lang in ("fr", "de", "en"):
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx.add_init_script("try{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('fc-lang','%s')}}catch(e){}" % lang)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
        pg.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE, wait_until="networkidle")
        pg.wait_for_function("document.getElementById('engine-sq') && document.getElementById('engine-sq')._engine && document.getElementById('engine-tri')._engine")
        D = pg.evaluate("DICT")[lang]
        tag = f"[{lang}]"
        check(pg.evaluate("document.documentElement.lang") == lang, f"{tag} the page is in the language")
        for card in CARDS:
            s = pg.evaluate(STATE, card)
            check(not s["won"] and s["svg"] and s["stored"] is None, f"{tag} {card}: a new device has a dark trophy: {s}")
            check(s["aria"] == D["hub.goalAria"] and s["tip"] == D["hub.goalTip"], f"{tag} {card}: it says the goal and that the trophy is not won: {s['aria']!r}")
            check(not re.search(r"\d", s["aria"] + s["tip"]), f"{tag} {card}: no number in what it says")
            check(s["box"][0] >= 32 and s["box"][1] >= 32, f"{tag} {card}: the icon is a touch target of 32 px or more: {s['box']}")
        # a smaller fence on each card leaves its trophy dark
        for card in CARDS:
            lesser = FENCES[card]["lesser"]
            shown = pg.evaluate(PLACE, [card, lesser["placedPieces"]])
            pg.wait_for_timeout(120)
            s = pg.evaluate(STATE, card)
            check(shown == lesser["area"] and s["pill"] and s["shown"] == str(lesser["area"]) and not s["won"], f"{tag} {card}: a fence of {lesser['area']} cells is live and leaves the trophy dark: {s}")
            pg.evaluate(CLEAR, card)
        # the best fence of one card lights its trophy and no other
        for card in CARDS:
            best = FENCES[card]["best"]
            shown = pg.evaluate(PLACE, [card, best["placedPieces"]])
            pg.wait_for_timeout(1300)
            s = pg.evaluate(STATE, card)
            check(shown == best["area"] and s["pill"] and s["won"], f"{tag} {card}: the best fence lights the trophy: {s}")
            check(s["aria"] == D["hub.goalAriaOn"] and s["tip"] == D["hub.goalTipOn"] and s["i18n"] == ["hub.goalAriaOn", "hub.goalTipOn"], f"{tag} {card}: its label and bubble say it is won: {s['aria']!r}")
            check(not re.search(r"\d", s["aria"] + s["tip"]), f"{tag} {card}: still no number in what it says")
            check(s["stored"] == "1", f"{tag} {card}: the device remembers it")
            check(D["hub.liveBest"] in pg.inner_text("#hubLive") or D["hub.liveBest"] in (pg.evaluate("document.getElementById('hubLive').textContent") or ""), f"{tag} {card}: the polite announcement says it")
            after = CARDS[CARDS.index(card) + 1:]
            check(not any(pg.evaluate(STATE, o)["won"] for o in after), f"{tag} {card}: the cards after it stay dark")
            pg.evaluate(CLEAR, card)
            pg.wait_for_timeout(100)
            check(pg.evaluate(STATE, card)["won"], f"{tag} {card}: clearing the board does not take the trophy back")
            if OUT and lang == "en":
                pg.locator(f'article.pCard[data-tiling="{card}"]').screenshot(path=os.path.join(OUT, f"hub_trophy_{card}.png"))
        # a reload shows the three lit, in the language chosen
        pg.reload(wait_until="networkidle")
        pg.wait_for_function("document.getElementById('engine-tri') && document.getElementById('engine-tri')._engine")
        for card in CARDS:
            s = pg.evaluate(STATE, card)
            check(s["won"] and s["aria"] == D["hub.goalAriaOn"] and s["tip"] == D["hub.goalTipOn"], f"{tag} {card}: after a reload the trophy is lit and says so: {s['aria']!r}")
        # the language switch carries the words of the lit trophy
        other = "de" if lang != "de" else "en"
        pg.click(f'[data-lang-btn="{other}"]')
        pg.wait_for_timeout(200)
        O = pg.evaluate("DICT")[other]
        s = pg.evaluate(STATE, "sq")
        check(s["won"] and s["aria"] == O["hub.goalAriaOn"] and s["tip"] == O["hub.goalTipOn"], f"{tag} switching to {other}: the lit trophy changes its words: {s['aria']!r}")
        check(not errs, f"{tag} no console error {errs[:2]}")
        ctx.close()
    # a device that has not built them: dark again in a fresh context, and the three are independent of the labs' trophies
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=ENGINE == "chromium")
    pg = ctx.new_page()
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_function("document.getElementById('engine-sq') && document.getElementById('engine-sq')._engine")
    check(all(not pg.evaluate(STATE, c)["won"] for c in CARDS), "a fresh device: the three trophies are dark")
    if OUT:
        pg.screenshot(path=os.path.join(OUT, "hub_trophy_phone_dark.png"), full_page=False)
    ctx.close()
    browser.close()

print("hub trophies: %d failed" % len(fails))
sys.exit(1 if fails else 0)

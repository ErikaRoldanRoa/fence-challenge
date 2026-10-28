"""Browser check of the triangle lab's trophies, played like a visitor: a closed fence of all twelve pieces wins the trophy of
its configuration, the shelf and the case say so in three languages, and what was won is kept.

Usage: python3 trophy_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots go to OUTDIR.
FC_BROWSER=webkit runs it in the engine of Safari (the default is chromium).

The three fences of fences.fixture.json are boards of the twelve hexiamonds; each is the best fence of its configuration, so
each wins that configuration's trophy and none wins the trophy of the best of all.
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "triangle-lab/index.html"
ENGINE = os.environ.get("FC_BROWSER", "chromium")
FENCES = json.load(open(Path(__file__).with_name("fences.fixture.json")))
fails = []

CONFIG_TITLE = {"en": "The best of this configuration", "fr": "Le meilleur de cette configuration", "de": "Das Beste dieser Konfiguration"}
GLOBAL_TITLE = {"en": "The best of all configurations", "fr": "Le meilleur de toutes les configurations", "de": "Das Beste aller Konfigurationen"}
NOT_YET = {"en": "Not yet", "fr": "Pas encore", "de": "Noch nicht"}
WON = {"en": "Trophy won", "fr": "Trophée gagné", "de": "Pokal gewonnen"}

# The fence as pieces on the board: the board is moved so that every triangle is on it, each piece gets the orientation and
# the place that cover exactly its triangles.
PLACE = """(fence) => {
  const byPiece = {};
  for (const [k, name] of Object.entries(fence.cells)) { const c = k.split(",").map(Number); (byPiece[name] = byPiece[name] || []).push(c); }
  const all = Object.keys(fence.cells).map((k) => k.split(",").map(Number));
  let shift = null;
  for (let di = -40; di <= 40 && !shift; di += 1) for (let dj = -40; dj <= 40 && !shift; dj += 1) {
    if (all.every(([i, j, o]) => state.boardCellMap.has(`${i + di},${j + dj},${o}`))) shift = [di, dj];
  }
  if (!shift) return { error: "the fence does not fit the board" };
  state.placedPieces = [];
  for (const type of state.pieceTypes) {
    const mine = byPiece[type.id];
    const target = mine.map(([i, j, o]) => `${i + shift[0]},${j + shift[1]},${o}`).sort().join("|");
    let found = null;
    type.variants.forEach((variant, vi) => {
      if (found) return;
      const v0 = variant.cells[0];
      for (const t of mine) {
        if (t[2] !== v0.o) continue;
        const marker = { i: t[0] + shift[0] - v0.i, j: t[1] + shift[1] - v0.j, o: variant.markerO };
        const got = variant.cells.map((c) => `${c.i + marker.i},${c.j + marker.j},${c.o}`).sort().join("|");
        if (got === target) { found = { vi, marker }; break; }
      }
    });
    if (!found) return { error: "no orientation of " + type.id };
    state.placedPieces.push({ id: state.nextPieceId++, typeId: type.id, variantIndex: found.vi, marker: found.marker });
  }
  render();
  return { shift };
}"""

SEEN = """() => ({
  config: { on: document.getElementById('trophy-config').classList.contains('on'), tier: ['gold', 'silver', 'bronze'].find((t) => document.getElementById('trophy-config').classList.contains('tier-' + t)) || null, title: document.getElementById('trophy-config').title },
  global: { on: document.getElementById('trophy-global').classList.contains('on'), title: document.getElementById('trophy-global').title },
  stored: localStorage.getItem('fc-trophies-tri12'),
  status: document.getElementById('status').textContent,
})"""

EVERYTHING_SAID = """() => {
  const out = [document.body.innerText];
  for (const e of document.querySelectorAll('[title],[aria-label]')) out.push(e.getAttribute('title') || '', e.getAttribute('aria-label') || '');
  return out.join(' | ');
}"""


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def new_page(browser, w, h, touch, lang, storage=None):
    ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    ctx.add_init_script("try{localStorage.setItem('fc-lang','%s')}catch(e){}" % lang)
    if storage is not None:
        ctx.add_init_script("try{if(!sessionStorage.getItem('seeded')){localStorage.setItem('fc-trophies-tri12', %s);sessionStorage.setItem('seeded','1')}}catch(e){}" % json.dumps(storage))
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector("#piece-tray [data-type]")
    page.wait_for_timeout(350)
    return ctx, page, errors


def measure(page):
    page.click("#detect-area")
    page.wait_for_timeout(120)


with sync_playwright() as pw:
    browser = getattr(pw, ENGINE).launch()

    # ---- a new visitor: both trophies dark, nothing stored, nothing to open but an empty case
    for lang in ("en", "fr", "de"):
        ctx, page, errors = new_page(browser, 1280, 800, False, lang)
        s = page.evaluate(SEEN)
        check(not s["config"]["on"] and not s["global"]["on"], f"[{lang}] a new visitor has both trophies dark")
        check(s["config"]["title"] == NOT_YET[lang] + CONFIG_TITLE[lang][3:] or NOT_YET[lang].lower() in s["config"]["title"].lower(), f"[{lang}] the small trophy says it is not yet won: {s['config']['title']!r}")
        check(s["stored"] is None, f"[{lang}] nothing is stored before a trophy is won")
        check(not errors, f"[{lang}] no errors in the console {errors[:2]}")
        ctx.close()

    # ---- the flow on a laptop and on a phone
    for label, w, h, touch in (("laptop", 1280, 800, False), ("tall phone", 390, 844, True), ("short phone", 390, 640, True), ("phone sideways", 844, 390, True)):
        ctx, page, errors = new_page(browser, w, h, touch, "en")
        for n, fence in enumerate(FENCES, 1):
            r = page.evaluate(PLACE, fence)
            check("error" not in r, f"[{label}] fence {n} put on the board {r}")
            measure(page)
            s = page.evaluate(SEEN)
            check(page.evaluate("state.enclosedRegionCount") == 1 and page.evaluate("state.area") >= 0, f"[{label}] fence {n}: one inside")
            check(s["config"]["on"] and s["config"]["tier"] == "bronze", f"[{label}] fence {n}: the trophy of its configuration is lit, in bronze")
            check(not s["global"]["on"], f"[{label}] fence {n}: the best of all is not won by a fence that is not the best")
            check(WON["en"] in s["status"], f"[{label}] fence {n}: the status says the trophy is won ({s['status'][-60:]!r})")
            check(json.loads(s["stored"])["c"].__len__() == n, f"[{label}] fence {n}: {n} configuration(s) kept on the device")
        # the case
        page.click("#shelf")
        page.wait_for_timeout(200)
        check(page.evaluate("!document.getElementById('case').hidden"), f"[{label}] the shelf opens the case")
        check(page.evaluate("document.querySelectorAll('#case-grid .sc').length") == 3, f"[{label}] one small cup for each of the three configurations won")
        count = page.evaluate("document.getElementById('case-count').textContent")
        check(count.startswith("3 / 19") and count.endswith("400"), f"[{label}] the count: {count!r}")
        seen = page.evaluate("Array.from(document.querySelectorAll('#case-seen .pc')).map((e) => e.classList.contains('empty'))")
        check(len(seen) == 12 and not any(seen), f"[{label}] the configuration on the board is shown as twelve pieces")
        # the keys belong to the case while it is open: R does not turn a piece behind it
        page.evaluate("state.status = null; state.selectedPieceId = state.placedPieces[0].id")
        page.keyboard.press("r")
        page.wait_for_timeout(80)
        check(page.evaluate("state.status") is None, f"[{label}] with the case open the R key does nothing to the board")
        check(page.evaluate("document.querySelectorAll('#case-globals .case-g').length") == 7, f"[{label}] seven global cups")
        check(page.evaluate("document.querySelectorAll('#case-globals .case-g.on').length") == 0, f"[{label}] none of them is won")
        box = page.evaluate("""() => { const p = document.getElementById('case-panel').getBoundingClientRect(); const c = document.getElementById('case-close').getBoundingClientRect();
          const t = document.elementFromPoint((c.left + c.right) / 2, (c.top + c.bottom) / 2);
          const s = document.getElementById('case-seen');
          return { panel: [p.left, p.top, p.right, p.bottom], iw: innerWidth, ih: innerHeight, closeHit: !!t && (t.id === 'case-close' || document.getElementById('case-close').contains(t)), seenFits: s.scrollWidth <= s.clientWidth + 1 }; }""")
        check(box["panel"][0] >= -0.5 and box["panel"][2] <= box["iw"] + 0.5 and box["panel"][3] <= box["ih"] + 0.5, f"[{label}] the case is on the screen")
        check(box["closeHit"], f"[{label}] the cross can be tapped")
        check(box["seenFits"], f"[{label}] the twelve pieces fit their row")
        page.screenshot(path=str(OUT / f"case-{label.replace(' ', '-')}.png"))
        page.click("#case-grid .sc >> nth=1")
        page.wait_for_timeout(100)
        check(page.evaluate("document.querySelectorAll('#case-grid .sc.sel').length") == 1, f"[{label}] a small cup can be chosen, and shows its pieces")
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        check(page.evaluate("document.getElementById('case').hidden"), f"[{label}] Escape closes the case")
        check(page.evaluate("document.activeElement && document.activeElement.id") == "shelf", f"[{label}] the focus goes back to the shelf")
        page.keyboard.press("r")
        page.wait_for_timeout(80)
        check(page.evaluate("state.status") is not None, f"[{label}] with the case closed the R key works on the board again")
        # a piece taken away: no closed fence, the trophy of the configuration dims, what was won is kept
        page.evaluate("state.placedPieces.pop(); measureLive(); render();")
        s = page.evaluate(SEEN)
        check(not s["config"]["on"], f"[{label}] with a piece missing the small trophy is dark again")
        check(json.loads(s["stored"])["c"].__len__() == 3, f"[{label}] what was won stays won")
        # the page holds no maximum
        said = page.evaluate(EVERYTHING_SAID)
        import re
        check(not re.search(r"\b11[0-9]\b", said), f"[{label}] no area of 110 or more is written anywhere on the page")
        check(not errors, f"[{label}] no errors in the console {errors[:2]}")
        ctx.close()

    # ---- what was won comes back after a reload, in each language
    for lang in ("en", "fr", "de"):
        ctx, page, errors = new_page(browser, 390, 844, True, lang)
        page.evaluate(PLACE, FENCES[0])
        measure(page)
        page.reload()
        page.wait_for_selector("#piece-tray [data-type]")
        page.wait_for_timeout(300)
        page.evaluate(PLACE, FENCES[0])
        page.evaluate("measureLive()")
        s = page.evaluate(SEEN)
        check(s["config"]["on"] and s["config"]["title"] == CONFIG_TITLE[lang], f"[{lang}] after a reload the same configuration is still won: {s['config']['title']!r}")
        check(s["global"]["title"].startswith(NOT_YET[lang]), f"[{lang}] the big trophy says it is not yet won: {s['global']['title']!r}")
        page.click("#shelf")
        page.wait_for_timeout(150)
        check(page.evaluate("document.getElementById('case-count').getAttribute('aria-label')") is not None, f"[{lang}] the count has a label")
        page.screenshot(path=str(OUT / f"case-{lang}.png"))
        check(not errors, f"[{lang}] no errors in the console {errors[:2]}")
        ctx.close()

    # ---- the best of all, won earlier: its trophy is lit in every configuration, and the case shows it
    ctx, page, errors = new_page(browser, 390, 844, True, "en", storage=json.dumps({"g": True, "c": []}))
    s = page.evaluate(SEEN)
    check(s["global"]["on"] and s["global"]["title"] == GLOBAL_TITLE["en"], f"the big trophy of a visitor who won it is lit: {s['global']['title']!r}")
    page.click("#shelf")
    page.wait_for_timeout(150)
    check(page.evaluate("document.querySelectorAll('#case-globals .case-g.on').length") == 1, "and it is the first of the case's global cups")
    check(page.evaluate("document.querySelectorAll('#case-grid .sc').length") == 0, "no small cups, none won")
    check(page.evaluate("Array.from(document.querySelectorAll('#case-seen .pc')).every((e) => e.classList.contains('empty'))"), "twelve empty places wait for a configuration")
    check(not errors, f"no errors in the console {errors[:2]}")
    ctx.close()

    browser.close()

print("\n%d check(s) failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

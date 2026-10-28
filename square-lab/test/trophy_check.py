"""Browser check of the square lab's trophies, played like a visitor: a closed fence of all twelve pieces wins the trophy of its
configuration, the shelf and the case say so in three languages, and what was won is kept.

Usage: python3 trophy_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots go to OUTDIR.
FC_BROWSER=webkit runs it in the engine of Safari (the default is chromium).

The fences of fences.fixture.json are boards of the twelve pentominoes; each is the best fence of its configuration, so each wins
that configuration's trophy and none wins the trophy of the best of all. They reach the board the way a printed board does
(the page takes pieces from sessionStorage when the address ends in #paper).
"""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "square-lab/index.html"
ENGINE = os.environ.get("FC_BROWSER", "chromium")
FENCES = json.load(open(Path(__file__).with_name("fences.fixture.json")))
fails = []

CONFIG_ON = {"en": "The best fence of this configuration", "fr": "La meilleure barrière de cette configuration", "de": "Der beste Zaun dieser Konfiguration"}
CONFIG_OFF = {"en": "Not yet the best fence of this configuration", "fr": "Pas encore la meilleure barrière de cette configuration", "de": "Noch nicht der beste Zaun dieser Konfiguration"}
GLOBAL_ON = {"en": "The best fence of all", "fr": "La meilleure barrière de toutes", "de": "Der beste Zaun von allen"}
GLOBAL_OFF = {"en": "Not yet the best fence of all", "fr": "Pas encore la meilleure barrière de toutes", "de": "Noch nicht der beste Zaun von allen"}
WON = {"en": "Trophy won: the best fence of this configuration.", "fr": "Trophée gagné : la meilleure barrière de cette configuration.", "de": "Pokal gewonnen: der beste Zaun dieser Konfiguration."}

# The fence as the pieces of a printed board: each piece gets the camera piece type, the orientation and the place that cover
# exactly its cells (the board is the lab's 20 x 20), and the page takes them when the address ends in #paper.
IMPORT = """(arg) => {
  const [fence, count] = arg;
  const lattice = window.LatticeSquare, Boards = window.FenceBoards;
  const types = Boards.pieceTypes('sq20');
  const byPiece = {};
  for (const [k, name] of Object.entries(fence.cells)) { const c = k.split(',').map(Number); (byPiece[name] = byPiece[name] || []).push(c); }
  const all = Object.keys(fence.cells).map((k) => k.split(',').map(Number));
  let shift = null;
  for (let dx = -40; dx <= 40 && !shift; dx += 1) for (let dy = -40; dy <= 40 && !shift; dy += 1) if (all.every(([x, y]) => x + dx >= 0 && x + dx < 20 && y + dy >= 0 && y + dy < 20)) shift = [dx, dy];
  if (!shift) return { error: 'the fence does not fit the board' };
  const placements = [];
  const used = new Set();
  for (const [name, mine] of Object.entries(byPiece)) {
    const target = mine.map(([x, y]) => `${x + shift[0]},${y + shift[1]}`).sort().join('|');
    let found = null;
    for (const type of types) {
      if (used.has(type.id) || found) continue;
      const variants = lattice.buildVariants(type.cells.map((c) => ({ x: c.x, y: c.y }))).variants;
      variants.forEach((v, vi) => {
        if (found) return;
        const v0 = v.cells[0];
        for (const t of mine) {
          const marker = { x: t[0] + shift[0] - v0.x, y: t[1] + shift[1] - v0.y };
          if (v.cells.map((c) => `${c.x + marker.x},${c.y + marker.y}`).sort().join('|') === target) { found = { type: type.id, vi, marker }; break; }
        }
      });
    }
    if (!found) return { error: 'no piece for ' + name };
    used.add(found.type);
    placements.push({ typeId: found.type, variantIndex: found.vi, marker: found.marker });
  }
  sessionStorage.setItem('fc-paper-import', JSON.stringify({ boardId: 'sq20', placements: placements.slice(0, count) }));
  history.replaceState(null, '', location.pathname + location.search);
  location.hash = '#paper';
  return { ok: true };
}"""

SEEN = """() => ({
  config: { on: document.getElementById('trophy-config').classList.contains('on'), tier: ['gold', 'silver', 'bronze'].find((t) => document.getElementById('trophy-config').classList.contains('tier-' + t)) || null, title: document.getElementById('trophy-config').title },
  global: { on: document.getElementById('trophy-global').classList.contains('on'), title: document.getElementById('trophy-global').title },
  stored: localStorage.getItem('fc-trophies-sq12'),
  status: document.getElementById('trophy-status').textContent,
  area: document.getElementById('area-value').textContent,
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
        ctx.add_init_script("try{if(!sessionStorage.getItem('seeded')){localStorage.setItem('fc-trophies-sq12', %s);sessionStorage.setItem('seeded','1')}}catch(e){}" % json.dumps(storage))
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector("#piece-tray .piece-btn")
    page.wait_for_timeout(350)
    return ctx, page, errors


def put(page, fence, count=12):
    r = page.evaluate(IMPORT, [fence, count])
    page.wait_for_timeout(300)
    return r


with sync_playwright() as pw:
    browser = getattr(pw, ENGINE).launch()

    # ---- a new visitor: both trophies dark, nothing stored, nothing of the best written anywhere
    for lang in ("en", "fr", "de"):
        ctx, page, errors = new_page(browser, 1280, 800, False, lang)
        s = page.evaluate(SEEN)
        check(not s["config"]["on"] and not s["global"]["on"], f"[{lang}] a new visitor has both trophies dark")
        check(s["config"]["title"] == CONFIG_OFF[lang] and s["global"]["title"] == GLOBAL_OFF[lang], f"[{lang}] they say it is not yet: {s['config']['title']!r}, {s['global']['title']!r}")
        check(s["stored"] is None, f"[{lang}] nothing is stored before a trophy is won")
        page.click("#shelf")
        page.wait_for_timeout(200)
        said = page.evaluate(EVERYTHING_SAID)
        check(not re.search(r"\b1[1-2][0-9]\b", said), f"[{lang}] no area of 110 or more is written anywhere on the page or in the case")
        check(not errors, f"[{lang}] no errors in the console {errors[:2]}")
        ctx.close()

    # ---- the flow on a laptop and on phones
    for label, w, h, touch in (("laptop", 1280, 800, False), ("tall phone", 390, 844, True), ("short phone", 390, 640, True), ("phone sideways", 844, 390, True)):
        ctx, page, errors = new_page(browser, w, h, touch, "en")
        for n, fence in enumerate(FENCES, 1):
            r = put(page, fence)
            check("error" not in r, f"[{label}] fence {n} put on the board {r}")
            s = page.evaluate(SEEN)
            check(s["area"] == str(fence["area"]), f"[{label}] fence {n}: the lab measures {s['area']}, the fence has {fence['area']}")
            check(s["config"]["on"] and s["config"]["tier"] == "bronze", f"[{label}] fence {n}: the trophy of its configuration is lit, in bronze")
            check(not s["global"]["on"], f"[{label}] fence {n}: the best of all is not won by a fence that is not the best")
            check(s["status"] == WON["en"], f"[{label}] fence {n}: the status says the trophy is won ({s['status']!r})")
            check(len(json.loads(s["stored"])["c"]) == n, f"[{label}] fence {n}: {n} configuration(s) kept on the device")
        # the case
        page.click("#shelf")
        page.wait_for_timeout(200)
        check(page.evaluate("!document.getElementById('case').hidden"), f"[{label}] the shelf opens the case")
        check(page.evaluate("document.querySelectorAll('#case-grid .sc').length") == len(FENCES), f"[{label}] one small cup for each configuration won")
        count = page.evaluate("document.getElementById('case-count').textContent")
        check(count.startswith("%d / 19" % len(FENCES)) and count.endswith("400"), f"[{label}] the count: {count!r}")
        seen = page.evaluate("Array.from(document.querySelectorAll('#case-seen .pc')).map((e) => e.classList.contains('empty') || !e.querySelector('canvas'))")
        check(len(seen) == 12 and not any(seen), f"[{label}] the configuration on the board is shown as twelve pieces")
        check(page.evaluate("document.querySelectorAll('#case-globals .case-g').length") == 7, f"[{label}] seven global cups")
        check(page.evaluate("document.querySelectorAll('#case-globals .case-g.on').length") == 0, f"[{label}] none of them is won")
        # the keys belong to the case while it is open: R does not turn a piece behind it
        before = page.evaluate("document.getElementById('game-status').textContent")
        page.keyboard.press("r")
        page.wait_for_timeout(80)
        check(page.evaluate("document.getElementById('game-status').textContent") == before, f"[{label}] with the case open the R key does nothing to the board")
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
        # a piece short: no closed fence, the trophy of the configuration dims, what was won is kept
        put(page, FENCES[-1], 11)
        s = page.evaluate(SEEN)
        check(not s["config"]["on"], f"[{label}] with a piece missing the small trophy is dark again")
        check(len(json.loads(s["stored"])["c"]) == len(FENCES), f"[{label}] what was won stays won")
        check(not errors, f"[{label}] no errors in the console {errors[:2]}")
        ctx.close()

    # ---- what was won comes back after a reload, in each language
    for lang in ("en", "fr", "de"):
        ctx, page, errors = new_page(browser, 390, 844, True, lang)
        put(page, FENCES[0])
        page.goto(URL)
        page.wait_for_selector("#piece-tray .piece-btn")
        page.wait_for_timeout(300)
        put(page, FENCES[0])
        s = page.evaluate(SEEN)
        check(s["config"]["on"] and s["config"]["title"] == CONFIG_ON[lang], f"[{lang}] after a reload the same configuration is still won: {s['config']['title']!r}")
        check(s["global"]["title"] == GLOBAL_OFF[lang], f"[{lang}] the big trophy says it is not yet won: {s['global']['title']!r}")
        page.click("#shelf")
        page.wait_for_timeout(150)
        check(page.evaluate("document.getElementById('case-count').getAttribute('aria-label')") is not None, f"[{lang}] the count has a label")
        page.screenshot(path=str(OUT / f"case-{lang}.png"))
        check(not errors, f"[{lang}] no errors in the console {errors[:2]}")
        ctx.close()

    # ---- the best of all, won earlier (and kept by the lab as it was before configurations were counted): lit in every configuration
    for stored in ({"g": True}, {"g": True, "c": []}):
        ctx, page, errors = new_page(browser, 390, 844, True, "en", storage=json.dumps(stored))
        s = page.evaluate(SEEN)
        check(s["global"]["on"] and s["global"]["title"] == GLOBAL_ON["en"], f"the big trophy of a visitor who won it is lit {stored}: {s['global']['title']!r}")
        page.click("#shelf")
        page.wait_for_timeout(150)
        check(page.evaluate("document.querySelectorAll('#case-globals .case-g.on').length") == 1, "and it is the first of the case's global cups")
        check(page.evaluate("document.querySelectorAll('#case-grid .sc').length") == 0, "no small cups, none won")
        check(page.evaluate("Array.from(document.querySelectorAll('#case-seen .pc')).every((e) => e.classList.contains('empty'))"), "twelve empty places wait for a configuration")
        check(not errors, f"no errors in the console {errors[:2]}")
        ctx.close()

    # ---- a board with a corner open wins nothing (the verdict is stood in for: no fence of the best area is among the fixtures)
    ctx, page, errors = new_page(browser, 390, 844, True, "en")
    page.evaluate("() => { SqVerdict.verdict = () => 'best'; }")
    page.evaluate("() => { window.__analyze = FenceAnalysis.analyze; FenceAnalysis.analyze = (a) => Object.assign({}, window.__analyze(a), { cornerLeak: true }); }")
    put(page, FENCES[0])
    s = page.evaluate(SEEN)
    check(s["stored"] is None and not s["config"]["on"] and not s["global"]["on"], "with a corner left open nothing is won and nothing is kept")
    page.evaluate("() => { FenceAnalysis.analyze = window.__analyze; }")
    put(page, FENCES[0])
    stored = json.loads(page.evaluate(SEEN)["stored"])
    check(stored["g"] is True and len(stored["c"]) == 1, "with the corner closed the configuration's trophy and the best of all are won")
    check(not errors, f"no errors in the console {errors[:2]}")
    ctx.close()

    browser.close()

print("\n%d check(s) failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

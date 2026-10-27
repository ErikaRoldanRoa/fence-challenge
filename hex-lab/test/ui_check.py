"""Browser check of the hex lab's trophies, played like a visitor.

Usage: python3 ui_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots go to OUTDIR.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "hex-lab/index.html"
KEY = "fc-trophies-hex7"
fails = []

# One of the two fences the paper draws (its Figure 8, top), moved to the middle of the board; named in the page.
PUBLISHED = [[[6, 3], [7, 1], [7, 2], [8, 2]], [[2, -1], [3, -1], [4, -2], [5, -2]], [[-2, 4], [-2, 5], [-1, 3], [-1, 5]],
             [[-1, 6], [0, 6], [1, 6], [2, 6]], [[6, -2], [7, -2], [7, -1], [7, 0]], [[3, 5], [4, 4], [4, 5], [5, 4]],
             [[-1, 2], [0, 0], [0, 1], [1, 0]]]
BETTER_34 = {"arc": [[-2, 4], [-1, 4], [0, 2], [0, 3]], "bar": [[-6, 2], [-6, 3], [-6, 4], [-6, 5]], "bee": [[-6, 0], [-6, 1], [-5, -1], [-5, 0]],
             "pistol": [[1, -1], [1, 0], [1, 1], [2, -1]], "propeller": [[0, -3], [1, -3], [1, -2], [2, -4]], "wave": [[-6, 6], [-5, 6], [-4, 5], [-3, 5]],
             "worm": [[-4, -2], [-3, -3], [-2, -3], [-1, -3]]}
NOTYET_34 = {"arc": [[-5, 5], [-5, 6], [-4, 6], [-3, 5]], "bar": [[-5, 1], [-5, 2], [-5, 3], [-5, 4]], "bee": [[-2, 5], [-1, 4], [-1, 5], [0, 4]],
             "pistol": [[-2, -3], [-1, -4], [-1, -3], [0, -3]], "propeller": [[-5, -1], [-4, -1], [-4, 0], [-3, -2]], "wave": [[1, 2], [1, 3], [2, 0], [2, 1]],
             "worm": [[1, -3], [2, -3], [2, -2], [2, -1]]}

TEXT = {
    "en": {"cfg_on": "The best of this configuration", "cfg_off": "Not yet the best of this configuration",
           "glob_on": "The best of all configurations", "glob_off": "Not yet the best of all configurations",
           "won_cfg": "Trophy won: the best of this configuration.", "won_glob": "Trophy won: the best of all configurations.", "closed": "Fence closed, area %d hexagons!"},
    "fr": {"cfg_on": "Le meilleur de cette configuration", "cfg_off": "Pas encore le meilleur de cette configuration",
           "glob_on": "Le meilleur de toutes les configurations", "glob_off": "Pas encore le meilleur de toutes les configurations",
           "won_cfg": "Trophée gagné : le meilleur de cette configuration.", "won_glob": "Trophée gagné : le meilleur de toutes les configurations.",
           "closed": "Barrière fermée, aire %d hexagones !"},
    "de": {"cfg_on": "Das Beste dieser Konfiguration", "cfg_off": "Noch nicht das Beste dieser Konfiguration",
           "glob_on": "Das Beste aller Konfigurationen", "glob_off": "Noch nicht das Beste aller Konfigurationen",
           "won_cfg": "Pokal gewonnen: das Beste dieser Konfiguration.", "won_glob": "Pokal gewonnen: das Beste aller Konfigurationen.",
           "closed": "Zaun geschlossen, Fläche %d Sechsecke!"},
}

PLACE = """(pieces) => {
  state.placedPieces = [];
  for (const [name, cells] of Object.entries(pieces)) {
    const own = state.pieceTypeMap.get(name);
    const abs = cells.map(([q, r]) => ({ q, r }));
    const variantIndex = own.variantIndexByKey.get(cellsKey(anchorAtLexMin(abs)));
    if (variantIndex === undefined) throw new Error("no variant for " + name);
    const marker = abs.slice().sort(cellSort)[0];
    state.placedPieces.push({ id: state.nextPieceId++, typeId: name, variantIndex, marker: { q: marker.q, r: marker.r } });
  }
  state.selectedPieceId = null; state.freshPieceId = null;
  measureLive(); refreshTray(); render();
}"""

SHELF = """() => { const t = (id) => { const e = document.getElementById(id); return { on: e.classList.contains('on'), tier: ['gold','silver','bronze'].find(c => e.classList.contains('tier-' + c)) || null,
    label: e.getAttribute('aria-label'), title: e.title, pop: e.classList.contains('pop') }; };
  return { cfg: t('trophy-config'), glob: t('trophy-global'), hidden: document.getElementById('shelf').hidden, status: document.getElementById('status').textContent,
           stored: (() => { try { return localStorage.getItem('%s'); } catch (e) { return 'blocked'; } })(), words: document.getElementById('shelf').innerText.trim() }; }""" % KEY


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def rect(page, sel):
    return page.evaluate("""(s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null;
        const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }""", sel)


def overlap(a, b):
    return a and b and a[0] < b[2] - 0.5 and b[0] < a[2] - 0.5 and a[1] < b[3] - 0.5 and b[1] < a[3] - 0.5


def shelf(page):
    return page.evaluate(SHELF)


def play(page, pieces):
    page.evaluate(PLACE, pieces)
    page.wait_for_timeout(120)
    return shelf(page)


def new_page(browser, lang, vp, touch, init=""):
    ctx = browser.new_context(viewport=vp, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    ctx.add_init_script("try{localStorage.setItem('fc-lang','%s')}catch(e){}" % lang + init)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector("#piece-tray *")
    page.wait_for_timeout(400)
    return ctx, page, errors


def best_fence(page):
    names = page.evaluate("(s) => LatticeHex.TETRAHEX_FULL_SET.build(s.map(cs => cs.map(([q, r]) => ({ q, r })))).map(p => p.id)", PUBLISHED)
    return {n: [[q - 3, r - 2] for q, r in cells] for n, cells in zip(names, PUBLISHED)}


def run(browser, lang, vp, touch, tag):
    t = TEXT[lang]
    label = f"{lang} {tag}"
    ctx, page, errors = new_page(browser, lang, vp, touch)
    tall_phone = touch and vp["height"] > vp["width"] and vp["height"] >= 680
    short_phone = touch and vp["height"] > vp["width"] and vp["height"] < 680

    # ---- a new player: both trophies dark, nothing written under them, the credit on two lines ----
    s = shelf(page)
    check(not s["hidden"] and not s["cfg"]["on"] and not s["glob"]["on"], f"[{label}] a new player sees two dark trophies")
    check(s["words"] == "", f"[{label}] nothing is written under or beside the trophies")
    check(s["cfg"]["label"] == t["cfg_off"] and s["glob"]["label"] == t["glob_off"] and s["cfg"]["title"] == t["cfg_off"], f"[{label}] their labels say not yet")
    lines = page.evaluate("() => document.querySelector('.side-brand').innerText.split('\\n').map((x) => x.trim())")
    check(len(lines) == 2 and lines[1] == "Dr. Erika Roldán", f"[{label}] the author's name stands on its own line under the paper's line")
    check(page.evaluate("() => document.getElementById('verdict') === null"), f"[{label}] no text about doing better or not")

    # ---- where things stand on this screen ----
    pill, lang_sw, sh = rect(page, "#detect-area"), rect(page, ".langSel"), rect(page, "#shelf")
    trash, cam = rect(page, "#clear-board"), rect(page, "#camera-chip")
    small, big = rect(page, "#trophy-config"), rect(page, "#trophy-global")
    check(abs(small[3] - big[3]) < 0.6, f"[{label}] the two trophies stand on one baseline")
    check(not overlap(sh, lang_sw) and not overlap(sh, pill) and not overlap(sh, trash) and not overlap(sh, cam), f"[{label}] the trophies touch nothing else")
    if tall_phone or not touch:
        check(sh[0] < 30 and sh[1] < 20, f"[{label}] the trophies stand in the top-left corner")
    if tall_phone:
        check(pill[1] > vp["height"] / 2, f"[{label}] the area pill is low on a tall phone")
    if short_phone:
        check(trash[2] < sh[0] and sh[2] < cam[0], f"[{label}] on a short phone the trophies stand between erase and the camera")
        check(abs((sh[0] - trash[2]) - (cam[0] - sh[2])) < 6, f"[{label}] and in the middle of the room between them")
    check(rect(page, ".side-brand")[3] <= vp["height"], f"[{label}] the credit stays on the screen")

    # ---- a fence below its configuration's best wins nothing ----
    s = play(page, BETTER_34)
    check(not s["cfg"]["on"] and not s["glob"]["on"] and s["stored"] is None, f"[{label}] a fence short of its best wins nothing and stores nothing")

    # ---- the best of its configuration: the small trophy lights, in its tier's colour, and is kept ----
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and s["cfg"]["tier"] == "silver" and not s["glob"]["on"], f"[{label}] the best of a configuration lights the small trophy, silver")
    check(s["cfg"]["pop"] and not s["glob"]["pop"], f"[{label}] and it pops")
    check(s["cfg"]["label"] == t["cfg_on"] and s["status"] == t["won_cfg"], f"[{label}] the label and the status read out the win")
    check(s["stored"] is not None and json.loads(s["stored"])["g"] is False and len(json.loads(s["stored"])["c"]) == 1, f"[{label}] one configuration is stored")
    page.wait_for_timeout(900)
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and not s["cfg"]["pop"], f"[{label}] the same fence again wins nothing more")

    # ---- the best of all: both light; the global one stays in every configuration ----
    s = play(page, best_fence(page))
    check(s["cfg"]["on"] and s["cfg"]["tier"] == "gold" and s["glob"]["on"] and s["glob"]["pop"], f"[{label}] the best of all lights both, the small one gold")
    check(s["glob"]["label"] == t["glob_on"] and s["status"] == t["won_glob"], f"[{label}] the global win is read out")
    page.screenshot(path=str(OUT / f"{lang}-{tag}-both.png"))
    page.wait_for_timeout(900)
    s = play(page, BETTER_34)
    check(s["glob"]["on"] and not s["glob"]["pop"], f"[{label}] the global trophy stays lit in another configuration")
    check(not s["cfg"]["on"], f"[{label}] while that configuration's own trophy is still dark")
    page.evaluate("() => { onClear(); }")
    s = shelf(page)
    check(s["glob"]["on"] and not s["cfg"]["on"], f"[{label}] with the board empty the global trophy stays and the small one rests")
    check(json.loads(s["stored"])["g"] is True and len(json.loads(s["stored"])["c"]) == 2, f"[{label}] two configurations and the global one are stored")

    # ---- remembered: a new visit finds them ----
    page.reload()
    page.wait_for_selector("#piece-tray *")
    page.wait_for_timeout(300)
    s = shelf(page)
    check(s["glob"]["on"] and not s["cfg"]["on"], f"[{label}] after a reload the global trophy is still lit")
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and not s["cfg"]["pop"], f"[{label}] and the configuration won before is lit at once, without a pop")
    check(not errors, f"[{label}] no console errors" + (": " + "; ".join(errors[:3]) if errors else ""))
    ctx.close()


def run_special(browser):
    # a phone that came through a contest page keeps the hints to itself
    ctx, page, errors = new_page(browser, "en", {"width": 1280, "height": 800}, False,
                                 init="try{localStorage.setItem('fc-contest','%s')}catch(e){}" % json.dumps({"workshop": "w", "device": "d", "name": "n"}))
    s = shelf(page)
    check(s["hidden"], "[contest] no trophies on a contest phone")
    s = play(page, best_fence(page))
    check(s["hidden"] and s["stored"] is None, "[contest] and nothing is stored there")
    check(not errors, "[contest] no console errors")
    ctx.close()
    # a browser that refuses storage: the trophies still work for the visit
    ctx, page, errors = new_page(browser, "en", {"width": 1280, "height": 800}, False,
                                 init="Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});")
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and s["stored"] == "blocked", "[blocked storage] a win still lights the trophy for the visit")
    check(not errors, "[blocked storage] and raises no error" + (": " + "; ".join(errors[:2]) if errors else ""))
    ctx.close()


with sync_playwright() as p:
    browser = p.chromium.launch()
    desk, tall, short, side = {"width": 1280, "height": 800}, {"width": 390, "height": 844}, {"width": 360, "height": 640}, {"width": 844, "height": 390}
    for lang in ("en", "fr", "de"):
        run(browser, lang, desk, False, "desk")
        run(browser, lang, tall, True, "tall")
        run(browser, lang, short, True, "short")
    run(browser, "en", side, True, "side")
    run_special(browser)
    browser.close()

print("\n%d failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

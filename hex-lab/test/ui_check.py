"""Browser check of the hex lab's verdict line, played like a visitor.

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
    "en": {"better": "You can do better with this configuration.", "notYet": "Not yet the best possible in all configurations.",
           "best": "You have the best possible over all configurations: 60 of the 360 reach it.", "closed": "Fence closed, area %d hexagons!",
           "tip": "A configuration is the order of the pieces around the fence."},
    "fr": {"better": "Tu peux faire mieux avec cette configuration.", "notYet": "Pas encore le meilleur possible parmi toutes les configurations.",
           "best": "Tu as le meilleur possible parmi toutes les configurations : 60 sur 360 l’atteignent.", "closed": "Barrière fermée, aire %d hexagones !",
           "tip": "Une configuration est l’ordre des pièces autour de la barrière."},
    "de": {"better": "Mit dieser Konfiguration geht noch mehr.", "notYet": "Noch nicht das Bestmögliche über alle Konfigurationen.",
           "best": "Du hast das Bestmögliche über alle Konfigurationen: 60 von 360 erreichen es.", "closed": "Zaun geschlossen, Fläche %d Sechsecke!",
           "tip": "Eine Konfiguration ist die Reihenfolge der Teile um den Zaun."},
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


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def verdict_state(page):
    return page.evaluate("""() => { const v = document.getElementById('verdict'); const r = v.getBoundingClientRect();
        return { hidden: v.hidden || getComputedStyle(v).display === 'none', text: v.textContent, best: v.classList.contains('best'),
                 rect: [r.left, r.top, r.right, r.bottom], status: document.getElementById('status').textContent }; }""")


def rect(page, sel):
    r = page.evaluate("(s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }", sel)
    return r


def overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def run(browser, lang, vp, touch, tag, contest=False):
    ctx = browser.new_context(viewport=vp, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    init = "try{localStorage.setItem('fc-lang','%s')}catch(e){}" % lang
    if contest:
        init += "try{localStorage.setItem('fc-contest','%s')}catch(e){}" % json.dumps({"workshop": "w", "device": "d", "name": "n"})
    ctx.add_init_script(init)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector("#piece-tray .chip, #piece-tray button, #piece-tray *")
    page.wait_for_timeout(400)
    t = TEXT[lang]
    label = f"{lang} {tag}" + (" contest" if contest else "")

    names = page.evaluate("(s) => LatticeHex.TETRAHEX_FULL_SET.build(s.map(cs => cs.map(([q, r]) => ({ q, r })))).map(p => p.id)", PUBLISHED)
    best = {n: [[q - 3, r - 2] for q, r in cells] for n, cells in zip(names, PUBLISHED)}

    check(verdict_state(page)["hidden"], f"[{label}] no verdict on an empty board")
    check(page.evaluate("() => document.getElementById('verdict').title") == t["tip"], f"[{label}] the bubble says what a configuration is")
    lines = page.evaluate("() => document.querySelector('.side-brand').innerText.split('\\n').map((s) => s.trim())")
    check(len(lines) == 2 and lines[1] == "Dr. Erika Roldán", f"[{label}] the author's name stands on its own line under the paper's line")
    pill0 = rect(page, "#detect-area")
    if touch and vp["height"] > vp["width"]:
        # a phone held upright: the area stands low, in the row of erase and the camera, out of the way of the browser's own bars
        trash = rect(page, "#clear-board")
        check(pill0[1] > vp["height"] / 2, f"[{label}] the area pill is low on a phone")
        check(abs((pill0[1] + pill0[3]) / 2 - (trash[1] + trash[3]) / 2) < 14, f"[{label}] the area pill stands in the row of erase")
    elif not touch:
        check(pill0[3] < 100, f"[{label}] the area pill stays on top on a large screen")
    cases = [("best", 35, best), ("better", 34, BETTER_34), ("notYet", 34, NOTYET_34)]
    for kind, area, pieces in cases:
        page.evaluate(PLACE, pieces)
        v = verdict_state(page)
        check(v["hidden"], f"[{label}] {kind}: nothing shown before the area is tapped")
        check(page.evaluate("() => document.getElementById('area-chip').textContent") == str(area), f"[{label}] {kind}: the area pill reads {area}")
        page.click("#detect-area")
        page.wait_for_timeout(150)
        v = verdict_state(page)
        if contest:
            check(v["hidden"] and t["closed"] % area in v["status"] and t[kind] not in v["status"], f"[{label}] {kind}: a contest phone gets no verdict")
            continue
        check(not v["hidden"] and v["text"] == t[kind], f"[{label}] {kind}: the line reads « {v['text']} »")
        check(v["best"] == (kind == "best"), f"[{label}] {kind}: highlighted only at the top")
        check(v["status"] == t["closed"] % area + " " + t[kind], f"[{label}] {kind}: the screen-reader line says both")
        pill = rect(page, "#detect-area")
        if touch and vp["height"] >= 680 and vp["height"] > vp["width"]:
            # a tall phone: the area is low, so the line opens above it, over the lower pieces, never over the credit
            check(v["rect"][3] <= pill[1] + 6 and not overlap(v["rect"], pill), f"[{label}] {kind}: the line sits above the area pill")
        else:
            check(v["rect"][1] >= pill[3] - 6 and not overlap(v["rect"], pill), f"[{label}] {kind}: the line sits under the area pill")
        check(v["rect"][0] >= 0 and v["rect"][2] <= vp["width"] and v["rect"][3] <= vp["height"], f"[{label}] {kind}: the line stays inside the screen")
        check(not overlap(v["rect"], rect(page, ".langSel")), f"[{label}] {kind}: the line does not cover the language switch")
        cred = rect(page, ".side-brand")
        check(not overlap(v["rect"], cred) and cred[3] <= vp["height"], f"[{label}] {kind}: nothing covers the credit, and it stays on the screen")
        if kind in ("best", "better"):
            page.screenshot(path=str(OUT / f"{lang}-{tag}-{kind}.png"))
        if kind == "best":
            # a change to the board takes the line away: it spoke about the fence that was there
            page.evaluate("() => { state.selectedPieceId = state.placedPieces[0].id; render(); dom.canvas.focus(); }")
            page.keyboard.press("Delete")
            page.wait_for_timeout(150)
            check(verdict_state(page)["hidden"], f"[{label}] {kind}: removing a piece takes the line away")
    # six pieces, however placed: no verdict (a closed ring of all seven is what it speaks about)
    page.evaluate(PLACE, {k: v for k, v in BETTER_34.items() if k != "bee"})
    page.click("#detect-area")
    page.wait_for_timeout(100)
    check(verdict_state(page)["hidden"], f"[{label}] six pieces: no verdict")
    check(not errors, f"[{label}] no console errors" + (": " + "; ".join(errors[:3]) if errors else ""))
    ctx.close()


with sync_playwright() as p:
    browser = p.chromium.launch()
    desk, phone, side = {"width": 1280, "height": 800}, {"width": 390, "height": 844}, {"width": 844, "height": 390}
    for lang in ("en", "fr", "de"):
        run(browser, lang, desk, False, "desk")
        run(browser, lang, phone, True, "phone")
    run(browser, "en", side, True, "side")
    run(browser, "en", desk, False, "desk", contest=True)
    browser.close()

print("\n%d failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

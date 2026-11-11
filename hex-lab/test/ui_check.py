"""Browser check of the hex lab's trophies and of the trophy case, played like a visitor.

Usage: python3 ui_check.py BASE_URL OUTDIR
BASE_URL serves the repository root (e.g. http://127.0.0.1:8791/).
Needs playwright. Exits 1 when a check fails; screenshots go to OUTDIR.
FC_BROWSER=webkit runs it in the engine of Safari (the default is chromium).
"""
import json
import math
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
URL = BASE + "hex-lab/index.html"
ENGINE = os.environ.get("FC_BROWSER", "chromium")
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
    "en": {"case": "Trophy case", "count": "%d of 360 configurations", "cfg_on": "The best of this configuration", "cfg_off": "Not yet the best of this configuration",
           "glob_on": "The best of all configurations", "glob_off": "Not yet the best of all configurations",
           "won_cfg": "Trophy won: the best of this configuration.", "won_glob": "Trophy won: the best of all configurations.", "closed": "Fence closed, area %d hexagons!"},
    "fr": {"case": "Coffre aux trophées", "count": "%d sur 360 configurations", "cfg_on": "Le meilleur de cette configuration", "cfg_off": "Pas encore le meilleur de cette configuration",
           "glob_on": "Le meilleur de toutes les configurations", "glob_off": "Pas encore le meilleur de toutes les configurations",
           "won_cfg": "Trophée gagné : le meilleur de cette configuration.", "won_glob": "Trophée gagné : le meilleur de toutes les configurations.",
           "closed": "Barrière fermée, aire %d hexagones !"},
    "de": {"case": "Pokalschrank", "count": "%d von 360 Konfigurationen", "cfg_on": "Das Beste dieser Konfiguration", "cfg_off": "Noch nicht das Beste dieser Konfiguration",
           "glob_on": "Das Beste aller Konfigurationen", "glob_off": "Noch nicht das Beste aller Konfigurationen",
           "won_cfg": "Pokal gewonnen: das Beste dieser Konfiguration.", "won_glob": "Pokal gewonnen: das Beste aller Konfigurationen.",
           "closed": "Zaun geschlossen, Fläche %d Sechsecke!"},
    "es": {"case": "Vitrina de trofeos", "count": "%d de 360 configuraciones", "cfg_on": "La mejor valla de esta configuración", "cfg_off": "Todavía no es la mejor valla de esta configuración",
           "glob_on": "La mejor valla de todas las configuraciones", "glob_off": "Todavía no es la mejor valla de todas las configuraciones",
           "won_cfg": "Trofeo ganado: la mejor valla de esta configuración.", "won_glob": "Trofeo ganado: la mejor valla de todas las configuraciones.",
           "closed": "¡Valla cerrada, área de %d hexágonos!"},
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
    hiddenFromReaders: e.getAttribute('aria-hidden') === 'true', title: e.title, pop: e.classList.contains('pop') }; };
  return { cfg: t('trophy-config'), glob: t('trophy-global'), hidden: document.getElementById('shelf').hidden, status: document.getElementById('status').textContent, said: document.getElementById('trophy-status').textContent,
           label: document.getElementById('shelf').getAttribute('aria-label'),
           stored: (() => { try { return localStorage.getItem('%s'); } catch (e) { return 'blocked'; } })(), words: document.getElementById('shelf').innerText.trim() }; }""" % KEY

# The cell at the far end of the first piece on the board, where a finger takes hold of it, and the cell step in CSS pixels.
GRAB = """() => { const p = state.placedPieces[0]; if (!p) return null;
  const cells = pieceAbsoluteCells(p); const e = state.boardCellMap.get(cellKey(cells[cells.length - 1]));
  const pt = worldToCss(e.centroid); const r = dom.canvas.getBoundingClientRect();
  const o = worldToCss(state.boardCellMap.get(cellKey({ q: 0, r: 0 })).centroid), n = worldToCss(state.boardCellMap.get(cellKey({ q: 1, r: 0 })).centroid);
  return { x: r.left + pt.x, y: r.top + pt.y, step: Math.hypot(n.x - o.x, n.y - o.y), n: cells.length,
           onBoard: cells.every((c) => state.boardCellMap.has(cellKey(c))) }; }"""


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


def press(page, sel, touch):
    (page.tap if touch else page.click)(sel)


# The saving icon of the case: a picture right after the count (not a control, no focus stop) that says whether this browser keeps what
# is won, and is struck through when it keeps nothing.
SAVED = {
    "en": ("Kept on this device", "Nothing is kept in this browser"),
    "fr": ("Gardé sur cet appareil", "Rien n’est gardé dans ce navigateur"),
    "de": ("Auf diesem Gerät gespeichert", "In diesem Browser wird nichts gespeichert"),
    "es": ("Guardado en este dispositivo", "No se guarda nada en este navegador"),
}
SAVED_ICON = """() => {
  const e = document.getElementById('case-saved');
  if (!e) return null;
  const rb = (n) => n.getBoundingClientRect();
  const head = document.querySelector('.case-head'), count = document.getElementById('case-count'), close = document.getElementById('case-close');
  const i = rb(e), c = rb(count), x = rb(close), h = rb(head);
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const shown = (k) => { const g = e.querySelector('.' + k); return !!g && getComputedStyle(g).display !== 'none'; };
  const mid = document.elementFromPoint((i.left + i.right) / 2, (i.top + i.bottom) / 2);
  return { role: e.getAttribute('role'), label: e.getAttribute('aria-label'), title: e.getAttribute('title'), off: e.classList.contains('off'),
    drawing: ['kept', 'lost'].filter(shown), tabIndex: e.tabIndex, text: e.textContent.trim(), hiddenPicture: e.querySelector('svg').getAttribute('aria-hidden') === 'true',
    stops: Array.from(document.querySelectorAll('#case a[href], #case button, #case input, #case select, #case textarea, #case [tabindex]')).filter((n) => n.tabIndex >= 0).map((n) => n.id),
    afterCount: count.nextElementSibling === e, size: [Math.round(i.width * 10) / 10, Math.round(i.height * 10) / 10],
    sameRow: Math.abs((i.top + i.bottom) / 2 - (c.top + c.bottom) / 2) < 2,
    rows: new Set(Array.from(head.children).filter((n) => getComputedStyle(n).display !== 'none' && !n.classList.contains('case-bar')).map((n) => Math.round((rb(n).top + rb(n).bottom) / 2))).size,
    inHead: i.left >= h.left - 0.5 && i.right <= h.right + 0.5, touchesCount: hit(i, c), touchesCross: hit(i, x), gapToCross: Math.round((x.left - i.right) * 10) / 10,
    reached: !!mid && (mid === e || e.contains(mid)), at: [(i.left + i.right) / 2, (i.top + i.bottom) / 2],
    maskOk: (() => { const g = e.querySelector('.lost g[mask]'), m = g && /#([\\w-]+)/.exec(g.getAttribute('mask')), k = m && document.getElementById(m[1]); return !!k && k.tagName.toLowerCase() === 'mask'; })() };
}"""


def saved_checks(page, label, lang, off, touch=False):
    """The open case has its saving icon: an image after the count, named (and told in its tooltip) in the language of the page, whole
    when this browser keeps what is won and struck through when it keeps nothing; no focus stop, no word; a tap on it does nothing."""
    s = page.evaluate(SAVED_ICON)
    check(s is not None, f"[{label}] the open case has its saving icon")
    if s is None:
        return None
    want = SAVED[lang][1 if off else 0]
    check(s["role"] == "img" and s["label"] == want and s["title"] == want, f"[{label}] the icon is an image named {want!r}, its tooltip says the same ({s['label']!r} / {s['title']!r})")
    check(s["off"] == off and s["drawing"] == (["lost"] if off else ["kept"]), f"[{label}] it is drawn {'struck through' if off else 'whole'} {s['drawing']}")
    check(s["maskOk"], f"[{label}] and the gap around the strike is made by a mask that exists")
    check(s["tabIndex"] == -1 and s["stops"] == ["case-close", "case-grid"], f"[{label}] it is no focus stop: the case's tab stops stay the cross and the grid {s['stops']}")
    check(s["text"] == "" and s["hiddenPicture"], f"[{label}] no word is written in it, and its drawing is hidden from readers")
    check(s["afterCount"] and s["sameRow"] and s["rows"] == 1 and s["inHead"], f"[{label}] it stands right after the count, on the header's one row ({s['rows']} row)")
    check(not s["touchesCount"] and not s["touchesCross"] and s["gapToCross"] >= 8 and s["reached"], f"[{label}] it touches neither the count nor the cross ({s['gapToCross']} px from the cross)")
    check(18 <= s["size"][0] <= 20 and 18 <= s["size"][1] <= 20, f"[{label}] it is {s['size']} px")
    (page.touchscreen.tap if touch else page.mouse.click)(*s["at"])
    page.wait_for_timeout(80)
    check(page.evaluate("() => !document.getElementById('case').hidden"), f"[{label}] a tap on it does nothing: the case stays open")
    return s

# a browser that refuses storage altogether, and one whose storage is full for the trophies (window.__full tells it to stop being)
BLOCKED = "Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});"
FULL = ("window.__full = true; (() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { "
        "if (window.__full && String(k).indexOf('fc-trophies') === 0) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; })();")


CASE = """() => { const q = (s) => document.querySelector(s), all = (s) => Array.from(document.querySelectorAll(s));
  const panel = q('.case-panel'), pb = panel.getBoundingClientRect(), cb = q('#case-close').getBoundingClientRect();
  return { open: !q('#case').hidden, count: q('#case-count').textContent, fill: q('#case-fill').style.width,
    cups: all('#case-grid .sc').length, on: all('#case-grid .sc.on').length,
    tiers: { gold: all('#case-grid .sc.tier-gold').length, silver: all('#case-grid .sc.tier-silver').length, bronze: all('#case-grid .sc.tier-bronze').length },
    globalsOn: all('#case-globals .case-g.on').map((e) => e.getAttribute('aria-label')), globals: all('#case-globals .case-g').length,
    text: q('#case').innerText.replace(/\\s+/g, ' ').trim(), panel: [pb.left, pb.top, pb.right, pb.bottom], close: [cb.left, cb.top, cb.right, cb.bottom],
    wide: panel.scrollWidth > panel.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
    scrolls: panel.scrollHeight > panel.clientHeight + 1,
    sel: all('#case-grid .sc.sel').length, dots: all('#case-seen .hexdot').length, seenLabel: q('#case-seen').getAttribute('aria-label'),
    focus: document.activeElement && (document.activeElement.id || document.activeElement.className) }; }"""


def case_checks(page, label, lang, vp, touch, t, won, glob):
    """Open the case on a board with nothing closed; look at it, walk it, close it."""
    page.evaluate(PLACE, {"arc": NOTYET_34["arc"]})        # one piece on the board, no closed fence: no configuration to preselect
    press(page, "#shelf", touch)
    page.wait_for_timeout(200)
    c = page.evaluate(CASE)
    check(c["open"] and c["focus"] == "case-panel", f"[{label}] the shelf opens the case and the focus goes into it")
    check(not page.evaluate("() => document.getElementById('case-close').matches(':focus-visible')"), f"[{label}] with no ring on the cross after a tap")
    check(c["count"] == f"{won} / 360" and c["fill"].startswith(f"{100 * won / 360:.2f}"[:4]), f"[{label}] the case counts {won} / 360 and the bar follows")
    check(c["cups"] == 360 and c["on"] == won, f"[{label}] 360 small cups, {won} of them won")
    check(c["tiers"] == {"gold": 60, "silver": 244, "bronze": 56}, f"[{label}] the tiers are 60 gold, 244 silver, 56 bronze")
    check(c["globals"] == 8 and len(c["globalsOn"]) == (1 if glob else 0), f"[{label}] eight global cups, " + ("the best of all won" if glob else "none won"))
    check(all(ch in "0123456789 /" for ch in c["text"]), f"[{label}] not a word in the case, only numbers: '{c['text']}'")
    pl, pt, pr, pb = c["panel"]
    check(pl >= 0 and pt >= 0 and pr <= vp["width"] and pb <= vp["height"], f"[{label}] the case fits inside the screen")
    check(c["close"][2] - c["close"][0] >= 40 and c["close"][3] - c["close"][1] >= 40 and c["close"][3] <= vp["height"], f"[{label}] its close button is a full-size target on the screen")
    check(not c["wide"], f"[{label}] and nothing scrolls sideways")
    if vp["width"] >= 390 and vp["height"] >= 844 or not touch:
        check(not c["scrolls"], f"[{label}] a tall screen shows the whole case, nothing to scroll")
    check(c["sel"] == 0 and c["dots"] == 7, f"[{label}] no configuration chosen yet: seven empty places wait")
    saved_checks(page, label, lang, False, touch)

    # tap a cup: its seven pieces appear, in order
    cup = page.evaluate("() => { const e = document.querySelectorAll('#case-grid .sc')[100]; e.scrollIntoView({block:'nearest'}); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, e.dataset.key]; }")
    (page.touchscreen.tap if touch else page.mouse.click)(cup[0], cup[1])
    page.wait_for_timeout(120)
    c = page.evaluate(CASE)
    check(c["sel"] == 1 and c["dots"] == 7 and cup[2].split(",")[0] in (c["seenLabel"] or ""), f"[{label}] a tapped cup shows its configuration, read out in order")
    page.screenshot(path=str(OUT / f"{lang}-{vp['width']}x{vp['height']}-case.png"))
    page.evaluate("() => { const p = document.querySelector('.case-panel'); p.scrollTop = p.scrollHeight; document.getElementById('case-grid').scrollTop = 1e6; }")
    page.wait_for_timeout(80)
    c = page.evaluate(CASE)
    check(c["close"][0] >= 0 and c["close"][1] >= 0 and c["close"][2] <= vp["width"] and c["close"][3] <= vp["height"], f"[{label}] scrolled to its end, the case still shows its close button")
    page.screenshot(path=str(OUT / f"{lang}-{vp['width']}x{vp['height']}-case-end.png"))
    page.evaluate("() => { document.querySelector('.case-panel').scrollTop = 0; document.getElementById('case-grid').scrollTop = 0; }")

    # keyboard: Tab goes round close and grid; the arrows walk the grid; the board does not hear the keys
    page.focus("#case-panel")
    page.keyboard.press("Shift+Tab")
    check(page.evaluate("() => document.activeElement.id") == "case-grid", f"[{label}] Shift+Tab from the panel goes to the grid, not out of the case")
    page.focus("#case-close")
    page.keyboard.press("Tab")
    check(page.evaluate("() => document.activeElement.id") == "case-grid", f"[{label}] Tab goes from the close button to the grid")
    page.keyboard.press("Tab")
    check(page.evaluate("() => document.activeElement.id") == "case-close", f"[{label}] and round to the close button again")
    page.keyboard.press("Shift+Tab")
    check(page.evaluate("() => document.activeElement.id") == "case-grid", f"[{label}] Shift+Tab goes back")
    before = page.evaluate("() => document.querySelector('#case-grid .sc.sel').dataset.key")
    page.keyboard.press("ArrowRight")
    after = page.evaluate("() => document.querySelector('#case-grid .sc.sel').dataset.key")
    check(before != after, f"[{label}] an arrow key moves to the next configuration")
    page.evaluate("() => { state.selectedPieceId = state.placedPieces[0].id; }")
    board = "() => JSON.stringify(state.placedPieces.map((p) => [p.id, p.variantIndex, p.marker.q, p.marker.r]))"
    placed = page.evaluate(board)
    page.keyboard.press("Delete")
    page.keyboard.press("r")
    page.keyboard.press("f")
    check(page.evaluate(board) == placed and placed != "[]", f"[{label}] Delete, R and F do nothing to the board while the case is open")

    # closing: Escape, the cross and the dark around the panel; the focus goes back to the shelf
    page.keyboard.press("Escape")
    check(not page.evaluate(CASE)["open"] and page.evaluate("() => document.activeElement.id") == "shelf", f"[{label}] Escape closes the case and gives the focus back to the shelf")
    press(page, "#shelf", touch)
    page.wait_for_timeout(100)
    press(page, "#case-close", touch)
    check(not page.evaluate(CASE)["open"], f"[{label}] the cross closes it")
    press(page, "#shelf", touch)
    page.wait_for_timeout(100)
    (page.touchscreen.tap if touch else page.mouse.click)(2, 2)
    check(not page.evaluate(CASE)["open"], f"[{label}] a tap on the dark around the panel closes it")


def best_fence(page):
    names = page.evaluate("(s) => LatticeHex.TETRAHEX_FULL_SET.build(s.map(cs => cs.map(([q, r]) => ({ q, r })))).map(p => p.id)", PUBLISHED)
    return {n: [[q - 3, r - 2] for q, r in cells] for n, cells in zip(names, PUBLISHED)}


def run(browser, lang, vp, touch, tag):
    t = TEXT[lang]
    label = f"{lang} {tag}"
    ctx, page, errors = new_page(browser, lang, vp, touch)
    check(page.evaluate("document.documentElement.lang") == lang, f"[{lang} {tag}] the page speaks {lang}")
    tall_phone = touch and vp["height"] > vp["width"] and vp["height"] >= 680
    short_phone = touch and vp["height"] > vp["width"] and vp["height"] < 680

    # ---- a new player: both trophies dark, nothing written under them, the credit on two lines ----
    s = shelf(page)
    check(not s["hidden"] and not s["cfg"]["on"] and not s["glob"]["on"], f"[{label}] a new player sees two dark trophies")
    check(s["words"] == "", f"[{label}] nothing is written under or beside the trophies")
    check(s["cfg"]["title"] == t["cfg_off"] and s["glob"]["title"] == t["glob_off"], f"[{label}] their tooltips say not yet")
    check(s["cfg"]["hiddenFromReaders"] and s["glob"]["hiddenFromReaders"], f"[{label}] the two cups are decoration, the shelf button speaks for them")
    check(s["label"] == f'{t["case"]}: {t["count"] % 0}. {t["cfg_off"]}. {t["glob_off"]}.', f"[{label}] the shelf button names the case, the count and where the two cups stand")
    lines = page.evaluate("() => document.querySelector('.side-brand').textContent.split('\\n').map((x) => x.trim())")
    rows = page.evaluate("() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.side-brand')); return new Set(Array.from(r.getClientRects()).filter((q) => q.width > 0).map((q) => Math.round(q.top))).size; }")
    check(len(lines) == 2 and lines[1] == "Dr. Erika Roldán" and rows == 2, f"[{label}] the author's name stands on its own line under the paper's line")
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
    check(s["cfg"]["title"] == t["cfg_on"] and s["said"] == t["won_cfg"] and s["label"].startswith(f'{t["case"]}: {t["count"] % 1}.'), f"[{label}] the tooltip, the button's label and the live region of the trophies read out the win")
    check(s["stored"] is not None and json.loads(s["stored"])["g"] is False and len(json.loads(s["stored"])["c"]) == 1, f"[{label}] one configuration is stored")
    page.wait_for_timeout(900)
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and not s["cfg"]["pop"], f"[{label}] the same fence again wins nothing more")

    # ---- the best of all: both light; the global one stays in every configuration ----
    s = play(page, best_fence(page))
    check(s["cfg"]["on"] and s["cfg"]["tier"] == "gold" and s["glob"]["on"] and s["glob"]["pop"], f"[{label}] the best of all lights both, the small one gold")
    check(s["glob"]["title"] == t["glob_on"] and s["said"] == t["won_glob"], f"[{label}] the global win is read out")
    page.screenshot(path=str(OUT / f"{lang}-{tag}-both.png"))
    page.wait_for_timeout(900)
    s = play(page, BETTER_34)
    check(s["glob"]["on"] and not s["glob"]["pop"], f"[{label}] the global trophy stays lit in another configuration")
    check(not s["cfg"]["on"], f"[{label}] while that configuration's own trophy is still dark")
    page.evaluate("() => { onClear(); }")
    s = shelf(page)
    check(s["glob"]["on"] and not s["cfg"]["on"], f"[{label}] with the board empty the global trophy stays and the small one rests")
    check(json.loads(s["stored"])["g"] is True and len(json.loads(s["stored"])["c"]) == 2, f"[{label}] two configurations and the global one are stored")
    case_checks(page, label, lang, vp, touch, t, won=2, glob=True)

    # ---- remembered: a new visit finds them ----
    page.reload()
    page.wait_for_selector("#piece-tray *")
    page.wait_for_timeout(300)
    s = shelf(page)
    check(s["glob"]["on"] and not s["cfg"]["on"], f"[{label}] after a reload the global trophy is still lit")
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and not s["cfg"]["pop"], f"[{label}] and the configuration won before is lit at once, without a pop")
    # the case opens on the configuration that is on the board
    press(page, "#shelf", touch)
    page.wait_for_timeout(150)
    chosen = page.evaluate("() => { const e = document.querySelector('#case-grid .sc.sel'); return e ? e.dataset.key : null; }")
    want = page.evaluate("() => HexVerdict.canonicalKey(trophies.order)")
    check(chosen == want, f"[{label}] the case opens on the configuration now on the board")
    page.screenshot(path=str(OUT / f"{lang}-{tag}-case-board.png"))
    page.keyboard.press("Escape")
    check(not errors, f"[{label}] no console errors" + (": " + "; ".join(errors[:3]) if errors else ""))
    ctx.close()


def run_special(browser):
    # a phone that came through a contest page has the trophies too
    ctx, page, errors = new_page(browser, "en", {"width": 390, "height": 844}, True,
                                 init="try{localStorage.setItem('fc-contest','%s')}catch(e){}" % json.dumps({"workshop": "w", "device": "d", "name": "n"}))
    s = shelf(page)
    check(not s["hidden"], "[contest] a contest phone has the shelf")
    s = play(page, best_fence(page))
    check(s["glob"]["on"] and s["cfg"]["on"] and s["stored"] not in (None, "blocked"), "[contest] its trophies light and are kept")
    press(page, "#shelf", True)
    page.wait_for_timeout(200)
    check(page.evaluate(CASE)["open"], "[contest] the case opens")
    covered = page.evaluate("() => { const b = document.getElementById('case-close').getBoundingClientRect(); const t = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); return !(t && document.getElementById('case').contains(t)); }")
    check(not covered, "[contest] nothing of the contest covers the case's cross")
    check(not errors, "[contest] no console errors")
    ctx.close()
    # a case with everything won, and one with the gold tier won: set from stored progress
    for name, pick, globs, count in (("full", "all", 8, 360), ("gold", "gold", 4, 60)):
        ctx, page, errors = new_page(browser, "en", {"width": 390, "height": 844}, True)
        keys = page.evaluate("(pick) => HexTrophies.entries(HexTrophies.empty()).filter((e) => pick === 'all' || e.tier === pick).map((e) => e.key)", pick)
        page.evaluate("([k, v]) => localStorage.setItem(k, v)", [KEY, json.dumps({"g": True, "c": keys})])
        page.reload()
        page.wait_for_selector("#piece-tray *")
        page.wait_for_timeout(300)
        press(page, "#shelf", True)
        page.wait_for_timeout(200)
        c = page.evaluate(CASE)
        check(c["on"] == count and c["count"] == f"{count} / 360" and len(c["globalsOn"]) == globs, f"[{name} case] {count} cups won, {globs} global cups lit")
        page.screenshot(path=str(OUT / f"en-case-{name}.png"))
        check(not errors, f"[{name} case] no console errors" + (": " + "; ".join(errors[:2]) if errors else ""))
        ctx.close()
    # a trophy is won by a piece set down, not while it is carried, and its read-out is not taken away by the status line
    ctx, page, errors = new_page(browser, "en", {"width": 390, "height": 844}, True)
    page.evaluate(PLACE.replace("measureLive();", "measureLive(false);"), NOTYET_34)       # a piece carried over a finished fence
    page.wait_for_timeout(120)
    s = shelf(page)
    check(not s["cfg"]["on"] and s["stored"] is None, "[carried] while a piece is carried over a finished fence nothing is won and nothing is kept")
    page.evaluate("measureLive()")                                                          # set down
    page.wait_for_timeout(120)
    s = shelf(page)
    check(s["cfg"]["on"] and s["stored"] is not None, "[carried] set down, the trophy of the configuration is won and kept")
    page.evaluate("setStatus('hx.s.placed', { name: 'arc' })")
    check(page.evaluate("document.getElementById('trophy-status').textContent") == TEXT["en"]["won_cfg"], "[carried] a status line written right after does not take the read-out away")
    check(not errors, "[carried] no console errors" + (": " + "; ".join(errors[:2]) if errors else ""))
    ctx.close()
    # a browser that refuses storage: the trophies still work for the visit
    ctx, page, errors = new_page(browser, "en", {"width": 1280, "height": 800}, False,
                                 init="Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});")
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and s["stored"] == "blocked", "[blocked storage] a win still lights the trophy for the visit")
    press(page, "#shelf", False)
    page.wait_for_timeout(200)
    saved_checks(page, "blocked storage, case", "en", True, False)
    page.keyboard.press("Escape")
    check(not errors, "[blocked storage] and raises no error" + (": " + "; ".join(errors[:2]) if errors else ""))
    ctx.close()

    # a browser that refuses storage, in each language: the case's icon is struck through and says that nothing is kept
    for lang in ("en", "fr", "de", "es"):
        ctx, page, errors = new_page(browser, "en", {"width": 390, "height": 844}, True, init=BLOCKED)
        page.evaluate("(l) => document.querySelector('[data-lang-btn=\"' + l + '\"]').click()", lang)    # the language cannot be kept either
        page.wait_for_timeout(100)
        s = play(page, NOTYET_34)
        check(s["cfg"]["on"] and s["stored"] == "blocked", f"[{lang}, storage refused] a win still lights the trophy for the visit, and nothing is kept")
        press(page, "#shelf", True)
        page.wait_for_timeout(200)
        saved_checks(page, f"{lang}, storage refused", lang, True, True)
        check(not errors, f"[{lang}, storage refused] no console errors" + (": " + "; ".join(errors[:2]) if errors else ""))
        ctx.close()
    # a save that fails (the storage is full): the icon is whole, turns struck through at the first win that cannot be kept, and is whole
    # again once a save goes through (it follows the real state, not the first guess)
    ctx, page, errors = new_page(browser, "en", {"width": 390, "height": 844}, True, init=FULL)
    press(page, "#shelf", True)
    page.wait_for_timeout(200)
    saved_checks(page, "full storage, before a win", "en", False, True)
    page.keyboard.press("Escape")
    s = play(page, NOTYET_34)
    check(s["cfg"]["on"] and s["stored"] is None, "[full storage] a win still lights the trophy for the visit, and nothing is stored")
    press(page, "#shelf", True)
    page.wait_for_timeout(200)
    saved_checks(page, "full storage, after a win that could not be kept", "en", True, True)
    page.keyboard.press("Escape")
    page.evaluate("window.__full = false")
    s = play(page, best_fence(page))
    kept = json.loads(s["stored"]) if s["stored"] else None
    check(kept is not None and kept["g"] is True and len(kept["c"]) == 2, "[full storage] the next win is saved, with the first one")
    press(page, "#shelf", True)
    page.wait_for_timeout(200)
    saved_checks(page, "full storage, after a save that went through", "en", False, True)
    check(not errors, "[full storage] no console errors" + (": " + "; ".join(errors[:2]) if errors else ""))
    ctx.close()

def touch_drag(page, a, b, steps=10):
    if ENGINE != "chromium":   # only Chromium takes touch events from a script: elsewhere a mouse drag stands in
        page.mouse.move(a[0], a[1])
        page.mouse.down()
        for k in range(1, steps + 1):
            page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps)
            page.wait_for_timeout(15)
        page.mouse.up()
        return
    cdp = page.context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": a[0], "y": a[1]}]})
    for k in range(1, steps + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": a[0] + (b[0] - a[0]) * k / steps, "y": a[1] + (b[1] - a[1]) * k / steps}]})
        page.wait_for_timeout(15)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    cdp.detach()


def drag_checks(browser):
    # a piece keeps its place under the finger: taken by its far end, it ends where the finger went, to within one cell step
    for tag, vp, touch in (("desk", {"width": 1280, "height": 800}, False), ("tall", {"width": 390, "height": 844}, True),
                           ("short", {"width": 360, "height": 640}, True)):
        ctx, page, errors = new_page(browser, "en", vp, touch)
        chip = page.locator("#piece-tray [data-type]").first
        (chip.tap if touch else chip.click)()
        page.wait_for_timeout(150)
        g0 = page.evaluate(GRAB)
        check(g0 is not None and g0["n"] == 4 and g0["onBoard"], f"[drag {tag}] a chip puts its piece, four hexagons, on the board")
        if g0:
            a = (g0["x"], g0["y"])
            for dx, dy in ((3, 0), (-1.5, 2), (0, -2)):
                b = (a[0] + dx * g0["step"], a[1] + dy * g0["step"])
                if touch:
                    touch_drag(page, a, b)
                else:
                    page.mouse.move(*a)
                    page.mouse.down()
                    for k in range(1, 9):
                        page.mouse.move(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8)
                    page.mouse.up()
                page.wait_for_timeout(150)
                g1 = page.evaluate(GRAB)
                gap = math.hypot(g1["x"] - b[0], g1["y"] - b[1]) / g0["step"]
                check(g1["onBoard"] and gap <= 0.6, f"[drag {tag}] a drag of ({dx}, {dy}) steps: the piece ends {gap:.2f} step from the finger, on the board")
                a = (g1["x"], g1["y"])
        check(not errors, f"[drag {tag}] no console errors")
        ctx.close()


with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch()
    desk, tall, short, side = {"width": 1280, "height": 800}, {"width": 390, "height": 844}, {"width": 360, "height": 640}, {"width": 844, "height": 390}
    for lang in ("en", "fr", "de", "es"):
        run(browser, lang, desk, False, "desk")
        run(browser, lang, tall, True, "tall")
        run(browser, lang, short, True, "short")
    run(browser, "en", side, True, "side")
    run_special(browser)
    drag_checks(browser)
    browser.close()

print("\n%d failed" % len(fails) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)

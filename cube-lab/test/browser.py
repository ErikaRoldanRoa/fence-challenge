#!/usr/bin/env python3
"""Plays the cube lab like a visitor, in Chrome, on a desktop and a phone
screen, and checks the state after every step: pieces chosen out of order,
placed (on a touch screen: shown first, then confirmed), a placed piece
chosen again, turned, moved by the pad, the keys and a drag, put back,
the move undone; a wall opened, its cast shown and exported, the view from
below. Screenshots land in OUTDIR.

Usage: python3 cube-lab/test/browser.py OUTDIR   (from the repo root;
needs Playwright and Google Chrome). Exit code 0 when every check holds."""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cube-lab-test"
os.makedirs(OUT, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


handler = functools.partial(Quiet, directory=ROOT)
srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/cube-lab/"

fails = []


def check(cond, what):
    print(("  ok   " if cond else "  FAIL ") + what)
    if not cond:
        fails.append(what)


def run(browser, name, w, h, touch):
    print(f"[{name}]")
    ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=touch, has_touch=touch,
                              device_scale_factor=2 if touch else 1, bypass_csp=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.add_init_script("localStorage.setItem('fc-lang','en')")
    pg.goto(URL)
    pg.wait_for_function("window.cubeLab")
    pg.evaluate("cubeLab.setView(0.8, 0.95, 16)")
    st = lambda: pg.evaluate("cubeLab.state()")
    at = lambda cell, where="top": pg.evaluate(f"cubeLab.screenOf({json.dumps(cell)}, '{where}')")

    def tap(p):
        if touch:
            pg.touchscreen.tap(p["x"], p["y"])
        else:
            pg.mouse.click(p["x"], p["y"])
        pg.wait_for_timeout(60)

    chip = lambda i: pg.locator(f'.chip[data-shape="{i}"]')

    def reach(c, where="floor"):
        q = at(c, where)
        return pg.evaluate(f"document.elementFromPoint({q['x']}, {q['y']}) === document.getElementById('space')")

    def spot(*cands):
        # the first of these floor cells a finger can reach
        for c in cands:
            if reach(c):
                return c
        raise AssertionError(f"none of {cands} in reach")

    def free_cell(gap=2):
        # an empty floor cell `gap` cells clear of every piece, in reach
        cells = [c for p in st()["pieces"] for c in p["cells"]]
        n = 12 if st()["mode"] == "penta" else 9
        for x in range(n):
            for z in range(n):
                if any(abs(c[0] - x) <= gap and abs(c[2] - z) <= gap for c in cells):
                    continue
                if reach([x, 0, z]):
                    return [x, 0, z]
        raise AssertionError("no free floor cell in sight")

    def free_floor():
        # A floor cell two cells clear of every piece, that the finger can
        # reach (no control lies over it).
        cells = [c for p in st()["pieces"] for c in p["cells"]]
        for x in range(9):
            for z in range(9):
                if any(abs(c[0] - x) < 3 and abs(c[2] - z) < 3 for c in cells):
                    continue
                q = at([x, 0, z], "floor")
                if pg.evaluate(f"document.elementFromPoint({q['x']}, {q['y']}) === document.getElementById('space')"):
                    return q
        raise AssertionError("no free floor cell in sight")
    check(st()["hand"] is None and st()["pieces"] == [], "starts empty, nothing in hand")
    # the walls of the step are on the first screen, above the pieces: in the tetracube step the tetracubes' one, in the pentacube step the three of the paper; each a small picture of the wall
    # with the cube and the number of cubes of its pieces; no sentence is written there, a bubble says what each one is
    wall_labels = lambda: pg.eval_on_selector_all("#walls .ctl.wall", "els => els.map(e => e.getAttribute('aria-label'))")
    check(st()["mode"] == "tetra" and pg.locator("#walls .ctl.wall").count() == 1 and pg.locator(".wallsRow").is_visible(), "the wall of the tetracubes is in view on the first screen")
    check(wall_labels() == ["See the wall of the 8 tetracubes, each once"], f"it says what it is: {wall_labels()}")
    check(pg.locator("#walls .wallN").all_inner_texts() == ["4"] and pg.locator("#walls .wallN svg").count() == 1 and pg.locator("#walls .ctl.wall img").count() == 1, "a picture of the wall, the cube and the number 4, as the step button has")
    box = pg.locator(".wallsRow").bounding_box()
    check(box is not None and box["y"] >= 0 and box["y"] + box["height"] <= pg.viewport_size["height"] and box["x"] >= 0 and box["x"] + box["width"] <= pg.viewport_size["width"], "the row is inside the window, nothing to scroll to")
    tray = pg.locator("#tray").bounding_box()
    check(tray is not None and box["y"] + box["height"] <= tray["y"] + 1, "and it sits above the pieces")
    check(pg.inner_text(".wallsRow").strip() == "4", "the only writing is the number")
    check(pg.locator(".modes #mode-tetra, .modes #mode-penta, .modes #mode-hexa, .modes #mode-hepta").count() == 4 and pg.locator("#mode-hexa").is_visible() and pg.locator("#mode-hepta").is_visible(), "four steps: 4, 5, 6 and 7 cubes a piece")
    if not touch:
        pg.hover("#walls .ctl.wall >> nth=0")
        pg.wait_for_timeout(700)
        check(pg.locator(".lab-tip").is_visible() and "8 tetracubes" in pg.inner_text(".lab-tip"), "on the mouse a bubble tells it")
        pg.mouse.move(5, 500)
    check(pg.locator('[data-math="m.tetra"]').is_hidden(), "the tetracube math waits for a room found by hand")
    check(pg.get_attribute("#undo", "aria-disabled") == "true", "undo is off with nothing to undo")
    f0 = st()["frames"]
    pg.wait_for_timeout(500)
    check(st()["frames"] - f0 <= 1, "nothing is drawn while nothing changes")
    pg.click('[data-math="m.room"]')
    check(pg.locator(".math-pop").is_visible() and "inside" in pg.inner_text(".math-pop h2"), "a math chip opens its panel")
    check("label" not in pg.inner_text(".math-pop") and "\\" not in pg.inner_text(".math-pop"), "no LaTeX in the panel")
    pills = lambda: pg.eval_on_selector_all(".math-pop .math-src .paper-ref", "els => els.map(e => e.textContent)")
    check(pills() == ["§ 7.1 Definitions", "§ 2.1 Fences and their area"], f"the panel's footer names where the paper says it: {pills()}")
    # a chip that gives its own source (our argument, not the paper's) keeps it: no pill on the paper
    pg.keyboard.press("Escape")
    # (even when the chip also names a place in the paper: the chip's own source wins)
    pg.evaluate("document.querySelector('[data-math=\"m.tetra\"]').setAttribute('data-paper-label', 'sec:3d')")
    pg.evaluate("mathChip.show(document.querySelector('[data-math=\"m.tetra\"]'))")
    check(pg.inner_text(".math-pop .math-src") == "Our argument, not in the paper" and pg.locator(".math-pop .math-src .paper-ref").count() == 0, "the tetracube card keeps its own footer, not the paper's")
    pg.keyboard.press("Escape")
    pg.click('[data-math="m.room"]')
    pg.screenshot(path=f"{OUT}/{name}-math.png")
    check(pg.locator(".math-pop .math-close").is_visible(), "the panel has a close button")
    pg.click(".math-pop .math-close")
    check(pg.locator(".math-pop").is_hidden(), "the close button closes it")

    # 1. choose piece 5 first, out of order
    chip(4).click()
    check(st()["hand"] == 4, "chip 5 chosen first")
    chip(6).click()
    check(st()["hand"] == 6, "another chip replaces it")
    chip(6).click()
    check(st()["hand"] is None, "a second tap on the chosen chip lets go")
    chip(4).click()

    # 2. place it on the floor
    a = spot([2, 0, 2], [3, 0, 3], [4, 0, 2], [4, 0, 4])
    tap(at(a, "floor"))
    s = st()
    check(len(s["pieces"]) == 1 and s["pieces"][0]["shape"] == 4, "piece 5 placed")
    check(s["hand"] is None, "hand empty after placing (each piece once)")
    check("placed" in (chip(4).get_attribute("class") or ""), "its chip shows it used")
    check(pg.get_attribute("#undo", "aria-disabled") == "false", "undo wakes up")

    # 3. another piece, elsewhere
    chip(1).click()
    c2 = free_cell(3)
    tap(at(c2, "floor"))
    s = st()
    check(len(s["pieces"]) == 2 and s["pieces"][1]["shape"] == 1, "piece 2 placed after piece 5")

    # 4. choose a placed piece by its chip, then by a tap on it
    chip(4).click()
    s = st()
    check(s["sel"] == 0 and s["hand"] is None, "a used chip selects its piece")
    check(pg.locator("#pad").is_visible() and pg.locator("#tray").is_hidden(), "the move pad takes the tray's place")
    tap(free_floor())
    check(st()["sel"] is None, "a tap on empty floor lets go")
    top = max(s["pieces"][0]["cells"], key=lambda c: (c[1], -c[0] - c[2]))
    tap(at(top, "top"))
    check(st()["sel"] == 0, "a tap on a placed piece selects it")
    pg.screenshot(path=f"{OUT}/{name}-selected.png")

    # 5. turn and tip it where it stands
    before = st()["pieces"][0]["cells"]
    pg.click("#turn")
    after = st()["pieces"][0]["cells"]
    check(after != before or "bumps" in pg.inner_text("#status"), "turn turns the placed piece (or refuses aloud)")
    pg.click("#tip")
    tipped = st()["pieces"][0]["cells"]
    check(all(c[1] >= 0 for c in tipped), "tip keeps it in the space")

    # 6. move: pad, keys
    before = st()["pieces"][0]["cells"]
    pg.click('[data-nudge="right"]')
    after = st()["pieces"][0]["cells"]
    diff = {tuple(a - b for a, b in zip(x, y)) for x, y in zip(after, before)}
    check(len(diff) == 1 and sum(abs(v) for v in next(iter(diff))) == 1, "pad moves it one cell")
    pg.click('[data-nudge="rise"]')
    risen = st()["pieces"][0]["cells"]
    check(all(r[1] == a[1] + 1 for r, a in zip(risen, after)), "pad lifts it one layer")
    pg.click('[data-nudge="sink"]')
    if not touch:
        pg.focus("#space")
        before = st()["pieces"][0]["cells"]
        pg.keyboard.press("ArrowUp")
        after = st()["pieces"][0]["cells"]
        check(after != before, "arrow key moves it")
        # drag it across the floor
        s = st()
        p0 = s["pieces"][0]["cells"]
        sel = s["sel"]
        # a cube of the piece the pointer really reaches, and a free spot
        cell = next(c for c in sorted(p0, key=lambda c: -c[1]) if (pg.evaluate(f"cubeLab.hit({at(c, 'top')['x']}, {at(c, 'top')['y']})") or {}).get("piece") == sel)
        start = at(cell, "top")
        others = {tuple(c) for p in s["pieces"][1:] for c in p["cells"]}
        shift = next(d for d in ([-2, 0], [2, 0], [0, -2], [0, 2], [-1, 0], [1, 0]) if all(0 <= c[0] + d[0] < 9 and 0 <= c[2] + d[1] < 9 and (c[0] + d[0], c[1], c[2] + d[1]) not in others for c in p0))
        pg.mouse.move(start["x"], start["y"])
        pg.mouse.down()
        dest = at([cell[0] + shift[0], cell[1], cell[2] + shift[1]], "top")
        for k in range(1, 9):
            pg.mouse.move(start["x"] + (dest["x"] - start["x"]) * k / 8, start["y"] + (dest["y"] - start["y"]) * k / 8)
        pg.mouse.up()
        pg.wait_for_timeout(60)
        moved = st()["pieces"][0]["cells"]
        check(moved != p0 and all(m[1] == q[1] for m, q in zip(moved, p0)), "drag moves it along its layer")
        if moved == p0:
            print("    debug drag:", sel, cell, shift, p0, start, dest, pg.inner_text("#status"), st()["sel"])

    # 7. a move out of the space is held in red; letting go brings it back
    s = st()
    sel0 = s["sel"]
    for _ in range(12):
        pg.click('[data-nudge="left"]')
    for _ in range(12):
        pg.click('[data-nudge="up"]')
    check(st()["clash"] and st()["sel"] == sel0, "moved past the edge, the piece is held in red")
    pg.keyboard.press("Escape")
    back = st()["pieces"][0]["cells"]
    check(all(0 <= c[0] < 9 and 0 <= c[2] < 9 for c in back) and not st()["clash"], "letting go there brings it back inside")
    pg.evaluate(f"cubeLab.select({sel0})")

    # 8. put it back, undo
    n = len(st()["pieces"])
    pg.click("#delete")
    s = st()
    check(len(s["pieces"]) == n - 1 and s["sel"] is None, "delete puts it back")
    check("placed" not in (chip(4).get_attribute("class") or ""), "its chip is free again")
    pg.click("#undo")
    s = st()
    check(len(s["pieces"]) == n, "undo brings it back")
    pg.keyboard.press("Escape")

    # 9. the pentacubes: open a wall, its cast, the svg, the view from below
    pg.click("#mode-penta")
    check(pg.get_attribute("#print", "href") == "print/pentacubes.zip", "print: one zip for the step")
    names = wall_labels()
    check(names == [f"See the wall of the 29 pentacubes, each once ({k} of 3)" for k in (1, 2, 3)], f"the pentacube step shows its three walls, built with its pieces, and no other: {names}")
    check(pg.locator("#walls .wallN").all_inner_texts() == ["5", "5", "5"] and pg.locator("#walls .wallK").all_inner_texts() == ["1", "2", "3"], "each with the cube and the number of cubes of its pieces, and its own number among the three")
    check(not any(v in " ".join(names).replace(" ", "").replace("\u202f", "") for v in ("52", "1331", "25872")), "no volume is told before a wall is opened")
    pg.locator("#walls .ctl.wall").nth(0).click()
    pg.locator("#walls .ctl.wall").nth(0).click()
    check(st()["busy"] and "moment" in pg.inner_text("#status").lower() or "instant" in pg.inner_text("#status").lower(), "a tap while the wall goes up is answered")
    pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=60000)
    s = st()
    check(s["volume"] == 52 and len(s["pieces"]) == 29, "wall 1 opens whole")
    check(pg.locator("#walls .ctl.wall").nth(0).get_attribute("aria-pressed") == "true", "the opened wall shows chosen")
    check(pg.locator("#walls .ctl.wall").count() == 3, "three walls in the pentacube step")
    pg.click('[data-math="m.wallinfo"]')
    check("146" in pg.inner_text(".math-pop"), "wall 1 chip: best possible")
    check(pg.eval_on_selector_all(".math-pop .math-src .paper-ref", "els => els.map(e => e.textContent)") == ["§ 7.3 Pentacubes", "Fig. 30"], "wall 1 chip: the footer names the pentacube section and the figure of the wall")
    card_q = pg.inner_text(".math-pop h2")
    pg.click('.math-pop .math-src .paper-ref[data-ref="fig:52"]')
    check(pg.inner_text(".math-pop h2") == "Figure 30" and pg.locator(".math-pop .math-back").count() == 1, "the figure's pill opens its page, with Back")
    pg.click(".math-pop .math-back")
    check(pg.inner_text(".math-pop h2") == card_q, "Back returns to the card")
    pg.keyboard.press("Escape")
    if not touch:
        pg.mouse.move(700, 450)
        for _ in range(10):
            pg.mouse.wheel(0, -3000)
    for _ in range(30):
        pg.evaluate("cubeLab.setView(0.8, 1.0, 0.5)")
    check(st()["camR"] >= st()["minR"] - 1e-6, "the camera never goes inside the wall")
    check(sum("placed" in (chip(i).get_attribute("class") or "") for i in range(29)) == 29, "all 29 chips used")
    pg.click('[data-math="m.cover"]')
    check("144" in pg.inner_text(".math-pop"), "the exact-cover panel opens after a wall")
    pg.keyboard.press("Escape")
    check(pg.locator(".math-pop").is_hidden(), "Escape closes the panel")
    pg.click("#cast")
    pg.wait_for_timeout(1400)
    s = st()
    check(s["castGoal"] == 1 and s["cast"] == 1, "the cast sets")
    pg.screenshot(path=f"{OUT}/{name}-cast.png")
    svg = pg.evaluate("cubeLab.svg('both')")
    check(svg.count("<polygon") > 100 and "translate(" in svg, "svg of wall and cast side by side")
    if not touch:
        open(f"{OUT}/v52-wall-and-cast.svg", "w").write(svg)
    tap(at([1, 0, 1], "floor"))
    check(st()["sel"] is None, "taps do nothing while the cast shows")
    pg.click('[data-math="m.cast"]')
    check("3 × 4 × 4" in pg.inner_text(".math-pop"), "the cast chip names the almost-cube")
    pg.keyboard.press("Escape")
    pg.click("#cast")
    for _ in range(80):   # the pieces glide back in about a second and a half; a loaded machine takes longer
        pg.wait_for_timeout(100)
        if st()["cast"] == 0 and len(st()["pieces"]) == 29: break
    check(st()["cast"] == 0 and len(st()["pieces"]) == 29, "the wall comes back whole")
    pg.evaluate("cubeLab.setView(0.8, 2.5, 24)")
    pg.wait_for_timeout(100)
    pg.screenshot(path=f"{OUT}/{name}-below.png")
    # spread: taps only look
    pg.eval_on_selector("#spread", "e => { e.value = 60; e.dispatchEvent(new Event('input')); }")
    p0 = st()["pieces"][0]["cells"][0]
    tap(at(p0, "top"))
    check(st()["sel"] is None, "while spread, a tap does not select")
    pg.eval_on_selector("#spread", "e => { e.value = 0; e.dispatchEvent(new Event('input')); }")

    # 10. a chosen chip on a full wall
    chip(10).click()
    check(st()["sel"] is not None, "a chip of an opened wall selects its piece")
    pg.click("#delete")
    check(len(st()["pieces"]) == 28 and st()["volume"] < 52, "taking a piece out lets the room out")
    pg.screenshot(path=f"{OUT}/{name}-open.png")

    # 11. chips follow the context
    vis = lambda k: pg.locator(f'.math-chip[data-math="{k}"]').is_visible()
    check(vis("m.bound") and vis("m.cover") and vis("m.room") and not vis("m.tetra"), "pentacube wall chips: bound, cover, and what counts as inside")
    pg.click("#mode-tetra")
    check(vis("m.room") and vis("m.wall") and not vis("m.bound"), "tetracube chips: inside and the wall, not the bound")

    # 12. wrap the room
    pg.click("#play-wrap")
    s = st()
    check(s["play"] == "wrap" and s["room"] == "p1" and s["mode"] == "penta" and s["roomCells"], "wrap starts with the easy pentacube room")
    check(pg.get_attribute("#print", "href") == "print/rooms.zip", "print in wrap: the rooms")
    check(vis("m.roominfo") and not vis("m.cover"), "wrap: the room's chip shows")
    pg.click("#mode-tetra")
    s = st()
    check(s["room"] == "t1" and s["mode"] == "tetra", "the tetracube step gives the hard room")
    pg.screenshot(path=f"{OUT}/{name}-wrap-t1.png")
    rooms = pg.evaluate("cubeLab.rooms()")
    def wrap(rid):
        r = next(x for x in rooms if x["id"] == rid)
        cells = st()["roomCells"]
        off = [cells[0][a] - r["room"][0][a] for a in range(3)]
        pg.evaluate(f"cubeLab.place({json.dumps(r['witness'])}, {json.dumps(off)})")
        pg.wait_for_timeout(80)
        return st()["solved"]
    check(not st()["solved"], "an empty room is not wrapped")
    check(wrap("t1"), "the witness wall wraps the single cube")
    check(st()["busy"], "a win plays: burst, then the room alone")
    pg.wait_for_timeout(700)
    pg.screenshot(path=f"{OUT}/{name}-wrap-t1-win.png")
    pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=10000)
    check(st()["cast"] == 0, "after the win the wall is back")
    check(pg.locator(".roomDots i.boss.done").count() == 1, "the hard room's mark fills")
    pg.locator("#rooms .roomStep").nth(1).click()
    check(st()["room"] == "p1", "from the hard room, on goes to the first pentacube room")
    penta = [x["id"] for x in rooms if x["step"] == "penta"]
    pick = "p8" if "p8" in penta else penta[-1]
    for _ in range(penta.index(pick)):
        pg.locator("#rooms .roomStep").nth(1).click()
    check(pg.locator("#rooms .roomStep").nth(0).get_attribute("aria-disabled") != "true", "a step back is offered")
    rid = st()["room"]
    check(rid == pick, "a room of the ladder is chosen")
    check(wrap(rid), "its witness wall wraps it")
    pg.screenshot(path=f"{OUT}/{name}-wrap-{rid}.png")

    ov = pg.evaluate("document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight")
    check(not ov, "no page overflow")
    check(not errs, "no console errors " + (str(errs[:2]) if errs else ""))
    ctx.close()


def held_piece(browser):
    # A held piece turns and moves freely; the camera stays still; letting go
    # while it overlaps puts it back.
    print("[held piece]")
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    pg = ctx.new_page()
    pg.add_init_script("localStorage.setItem('fc-lang','en')")
    pg.goto(URL)
    pg.wait_for_function("window.cubeLab")
    st = lambda: pg.evaluate("cubeLab.state()")
    line = [[2, 0, 4], [3, 0, 4], [4, 0, 4], [5, 0, 4]]
    block = [[4, 0, 6], [5, 0, 6], [4, 0, 7], [5, 0, 7]]
    pg.evaluate(f"cubeLab.place({json.dumps([line, block])})")
    pg.evaluate("cubeLab.select(0)")
    pg.wait_for_timeout(100)
    cam0 = (st()["camTarget"], st()["camR"])
    pg.click("#turn")
    s = st()
    check(s["clash"] and s["sel"] == 0, "a quarter turn into the other piece is kept, in red, still held")
    check((s["camTarget"], s["camR"]) == cam0, "turning does not move the camera")
    pg.screenshot(path=f"{OUT}/held-clash.png")
    pg.click("#turn")
    s = st()
    got = sorted(map(tuple, s["pieces"][0]["cells"]))
    check(not s["clash"] and got == [(3, 0, 4), (4, 0, 4), (5, 0, 4), (6, 0, 4)], "a half turn through the collision ends valid")
    pg.click('[data-nudge="right"]')
    check((st()["camTarget"], st()["camR"]) == cam0, "moving inside the picture does not move the camera")
    pg.click("#undo")
    pg.evaluate("cubeLab.select(0)")
    pg.click("#turn")
    check(st()["clash"], "overlapping again")
    pg.keyboard.press("Escape")
    s = st()
    check(s["sel"] is None and not s["clash"] and sorted(map(tuple, s["pieces"][0]["cells"])) == sorted(map(tuple, line)), "letting go while overlapping puts it back")
    ctx.close()


def tetra_wall(browser):
    """The wall of the 8 tetracubes opens in the tetracube step, shows its card, and the walls leave the screen in the wrap step."""
    print("[tetracube wall]")
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    ctx.add_init_script("localStorage.setItem('fc-lang','en')")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.cubeLab")
    pg.click("#walls .ctl.wall >> nth=0")
    for _ in range(80):
        s = pg.evaluate("cubeLab.state()")
        if not s["busy"] and len(s["pieces"]) == 8:
            break
        pg.wait_for_timeout(150)
    s = pg.evaluate("cubeLab.state()")
    check(len(s["pieces"]) == 8 and s["volume"] == 1 and s["mode"] == "tetra", f"the wall of the tetracubes opens whole in the tetracube step ({len(s['pieces'])} pieces, volume {s['volume']}, {s['mode']})")
    check(pg.locator("#walls .ctl.wall[aria-pressed='true']").count() == 1, "its button shows chosen")
    check(pg.locator('.math-chip[data-math="m.wallinfo"]').is_visible(), "its card is on the screen")
    pg.click('.math-chip[data-math="m.wallinfo"]')
    pop = pg.inner_text(".math-pop")
    check("8 pieces of 4 cubes" in pop and "Nothing does better" in pop and "34" in pop and "Our argument, not in the paper" in pop, "the card says what it is and that it is the lab's own argument")
    pg.keyboard.press("Escape")
    check(not pg.locator(".math-pop").count() or not pg.locator(".math-pop").is_visible(), "the card closes")
    pg.click("#mode-penta")
    check(pg.locator("#walls .ctl.wall").count() == 3 and pg.locator("#walls .ctl.wall[aria-pressed='true']").count() == 0 and "29 pentacubes" in pg.get_attribute("#walls .ctl.wall >> nth=0", "aria-label"), "in the pentacube step: its own three walls, none chosen")
    for step, label, pieces, volume in (("hexa", "166 hexacubes", 166, 1331), ("hepta", "1023 heptacubes", 1023, 25872)):
        listed = step == "hexa"          # the hexacubes keep a list of their 166 pieces; the heptacubes only show their wall
        pg.click(f"#mode-{step}")
        pg.wait_for_timeout(300)
        check(pg.locator("#walls .ctl.wall").count() == 1 and label in pg.get_attribute("#walls .ctl.wall", "aria-label"), f"the {step} step shows the wall of the {label}, and no other")
        if listed:
            chips = pg.locator("#tray .chip")
            labels = pg.eval_on_selector_all("#tray .chip", "els => els.map(e => e.getAttribute('aria-label'))")
            twins = [l for l in labels if "mirror image of piece" in l]
            check(pg.locator(".trayZone").is_visible() and chips.count() == pieces and all(l.startswith("Piece ") and ", 6 cubes" in l for l in labels), f"the {step} step lists its {pieces} pieces, all of 6 cubes, and nothing of another step ({chips.count()} chips)")
            check(len(twins) == 108 and len(set(labels)) == pieces, f"54 pairs of mirror twins are named in the bubbles, 58 pieces are their own mirror image: {len(twins)} of {pieces} name a twin (166 one-sided, 112 free)")
            check(not pg.locator("#tray .chip.placed").count(), "nothing is placed before the wall is opened")
        else:
            check(not pg.locator(".trayZone").is_visible() and pg.locator("#tray .chip").count() == 0, f"the {step} step has no pieces to build with: nothing of another step is mixed in")
        check(not pg.locator("#print").is_visible(), f"and no pieces to print")
        pg.click("#walls .ctl.wall >> nth=0")
        for _ in range(400):
            s_ = pg.evaluate("cubeLab.state()")
            if not s_["busy"] and len(s_["pieces"]) == pieces:
                break
            pg.wait_for_timeout(200)
        s_ = pg.evaluate("cubeLab.state()")
        check(len(s_["pieces"]) == pieces and s_["volume"] == volume and s_["mode"] == step, f"the {step} wall opens whole: {len(s_['pieces'])} pieces, volume {s_['volume']}")
        check(pg.locator('.math-chip[data-math="m.wallinfo"]').is_visible() and not pg.locator('.math-chip[data-math="m.turn"]').is_visible(), f"the {step} step: the card of the wall, no mirror card")
        if listed:
            # the wall is built with exactly the pieces of the list: each once, so every chip is placed and every piece of the wall has the colour of its chip
            check(pg.locator("#tray .chip.placed").count() == pieces and len({p_["shape"] for p_ in s_["pieces"]}) == pieces and all(p_["shape"] >= 0 for p_ in s_["pieces"]), f"the {step} wall is the {pieces} pieces of the list, each once: {pg.locator('#tray .chip.placed').count()} chips placed")
            # a chip of the list chooses its piece in the wall
            pg.locator("#tray .chip").nth(57).click()
            pg.wait_for_timeout(400)
            st_ = pg.evaluate("cubeLab.state()")
            check(st_["sel"] is not None and st_["pieces"][st_["sel"]]["shape"] == 57 and "chosen" in pg.inner_text("#status"), f"a chip of the list chooses its piece in the wall: {pg.inner_text('#status').strip()!r}")
            lit = pg.locator("#tray .chip.chosen")
            check(lit.count() == 1 and lit.get_attribute("data-shape") == "57" and pg.locator("#tray").is_visible() and not pg.locator(".pad").is_visible(), "its chip lights up, the list stays on the screen and the pad of arrows does not take its place")
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(200)
            check(pg.locator("#tray .chip.chosen").count() == 0, "letting go puts the light out")
        # a piece of the wall is taken out: put back in the tray where there is one, taken out where there is none; undo brings it back
        top = max(s_["pieces"][-1]["cells"], key=lambda c: c[1])
        q = pg.evaluate(f"cubeLab.screenOf({json.dumps(top)}, 'top')")
        pg.mouse.click(q["x"], q["y"])
        pg.wait_for_timeout(400)
        want_label, want_status = ("Put the chosen piece back in the tray (Delete)", "Piece back in the tray.") if listed else ("Take the chosen piece out (Delete)", "Piece taken out.")
        check(pg.get_attribute("#delete", "aria-label") == want_label, f"the {step} step: the button says what it does: {pg.get_attribute('#delete', 'aria-label')}")
        if listed:
            # a piece chosen in the wall: its chip lights up and the list scrolls to it
            shape = s_["pieces"][-1]["shape"]
            box = pg.evaluate(f"(() => {{ const c = document.querySelector('#tray .chip.chosen'), t = document.getElementById('tray').getBoundingClientRect(), r = c ? c.getBoundingClientRect() : null; return r ? {{shape: c.dataset.shape, inside: r.top >= t.top - 1 && r.bottom <= t.bottom + 1 && r.left >= t.left - 1 && r.right <= t.right + 1}} : null; }})()")
            check(box is not None and box["shape"] == str(shape) and box["inside"], f"a piece chosen in the wall lights its chip (piece {shape + 1}) and the list shows it: {box}")
        pg.keyboard.press("Delete")
        pg.wait_for_timeout(500)
        check(pg.inner_text("#status").strip() == want_status and len(pg.evaluate("cubeLab.state()")["pieces"]) == pieces - 1, f"the {step} step: Delete takes the piece out and says so: {pg.inner_text('#status').strip()!r}")
        if listed:
            check(pg.locator("#tray .chip.placed").count() == pieces - 1, "and its chip is free again")
        pg.keyboard.press("Control+z")
        pg.wait_for_timeout(500)
        check(len(pg.evaluate("cubeLab.state()")["pieces"]) == pieces, f"the {step} step: undo brings it back")
        words = (("fr", "Remettre la pièce choisie dans la réserve (Suppr)"), ("de", "Das gewählte Teil in die Ablage zurücklegen (Entf)"), ("en", "Put the chosen piece back in the tray (Delete)")) if listed else \
                (("fr", "Retirer la pièce choisie (Suppr)"), ("de", "Das gewählte Teil herausnehmen (Entf)"), ("en", "Take the chosen piece out (Delete)"))
        for lang, want in words:
            pg.evaluate(f"window.i18n.setLang('{lang}')")
            pg.wait_for_timeout(200)
            check(pg.get_attribute("#delete", "aria-label") == want, f"the {step} step, {lang}: {pg.get_attribute('#delete', 'aria-label')!r}")
    # the wrap step needs pieces to build with: chosen from the heptacube step (its wall open), it moves to a step that has them
    pg.click("#play-wrap")
    pg.wait_for_timeout(500)
    s_ = pg.evaluate("cubeLab.state()")
    check(s_["mode"] in ("tetra", "penta") and pg.locator(".trayZone").is_visible() and pg.locator("#tray .chip").count() > 0 and not pg.locator(".wallsRow").is_visible(), f"wrap chosen from the heptacube step goes to a step with pieces ({s_['mode']}), no wall on the screen")
    pg.click("#play-explore")
    pg.wait_for_timeout(500)
    s_ = pg.evaluate("cubeLab.state()")
    check(s_["play"] == "explore" and s_["mode"] in ("tetra", "penta") and pg.locator(".wallsRow").is_visible() and len(s_["pieces"]) == 0 and pg.locator("#walls .ctl.wall[aria-pressed='true']").count() == 0, f"back to exploring: on a step with pieces ({s_['mode']}), its own wall in the row and not open, no wall of another step on the board")
    pg.click("#mode-penta")
    pg.wait_for_timeout(300)
    check(pg.locator(".trayZone").is_visible() and pg.locator("#tray .chip").count() == 29, "back in the pentacube step: its 29 pieces")
    check(pg.get_attribute("#delete", "aria-label") == "Put the chosen piece back in the tray (Delete)", f"and its button still puts a piece back in the tray: {pg.get_attribute('#delete', 'aria-label')}")
    pg.click("#play-wrap")
    pg.wait_for_timeout(300)
    check(not pg.locator(".wallsRow").is_visible() and not pg.locator("#mode-hexa").is_visible() and not pg.locator("#mode-hepta").is_visible(), "in the wrap step the walls and the steps of the hexacubes and heptacubes are not on the screen")
    pg.click("#play-explore")
    pg.wait_for_timeout(300)
    check(pg.locator(".wallsRow").is_visible(), "back in the explore step they are")
    check(not errs, f"no script error {errs[:1]}")
    ctx.close()


def wall_links(browser):
    """?wall=1|2|3, a wall's id or the trailing number of its id opens that wall at once; anything else is ignored."""
    print("[wall links]")
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    ctx.add_init_script("localStorage.setItem('fc-lang','en')")
    for q, pieces, volume, step in (("?wall=1", 29, 52, "penta"), ("?wall=1331", 166, 1331, "hexa"), ("?wall=hepta_greedy_25872", 1023, 25872, "hepta"), ("?wall=3", 1023, 25872, "hepta"), ("?wall=4", 8, 1, "tetra"), ("?wall=TETRA_V1", 8, 1, "tetra")):
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL + q)
        pg.wait_for_function("window.cubeLab")
        for _ in range(240):
            s = pg.evaluate("cubeLab.state()")
            if not s["busy"] and len(s["pieces"]) == pieces:
                break
            pg.wait_for_timeout(250)
        s = pg.evaluate("cubeLab.state()")
        check(len(s["pieces"]) == pieces and s["volume"] == volume and s["mode"] == step, f"{q} opens the wall of {pieces} pieces whole, in the {step} step ({len(s['pieces'])} pieces, volume {s['volume']}, {s['mode']})")
        check(pg.locator("#walls .ctl.wall[aria-pressed='true']").count() == 1, f"{q}: its button shows chosen")
        # the tab names the step the link opened (the shared i18n once reset it to the first step's title after the page had set its own)
        want_title = pg.evaluate("window.i18n.t('cu.docTitle.' + cubeLab.state().mode)")
        check(pg.title() == want_title and (step == "tetra" or "tetracubes" not in pg.title()), f"{q}: the tab says '{pg.title()}'")
        check(not errs, f"{q}: no script error {errs[:1]}")
        pg.close()
    # the first title is the page's own, in the visitor's language
    for lang in ("fr", "de"):
        c2 = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
        c2.add_init_script(f"localStorage.setItem('fc-lang','{lang}')")
        p2 = c2.new_page()
        p2.goto(URL + "?wall=1")
        p2.wait_for_function("window.cubeLab")
        p2.wait_for_timeout(500)
        check(p2.title() == p2.evaluate("window.i18n.t('cu.docTitle.penta')") and "29" in p2.title(), f"{lang}: the tab of ?wall=1 says '{p2.title()}'")
        c2.close()
    for q in ("?wall=0", "?wall=5", "?wall=abc", "?wall=", "?wall=%E0%A4%A", "?wall=52x", "?wall=toString", "?wall=__proto__"):
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL + q)
        pg.wait_for_function("window.cubeLab")
        pg.wait_for_timeout(600)
        s = pg.evaluate("cubeLab.state()")
        check(s["pieces"] == [] and s["mode"] == "tetra" and not errs, f"{q} opens nothing and breaks nothing {errs[:1]}")
        pg.close()
    ctx.close()


def faces_only(browser):
    # ?conn=6: the chips speak of faces only and drop the corner arguments.
    print("[faces only]")
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    pg = ctx.new_page()
    pg.add_init_script("localStorage.setItem('fc-lang','en')")
    pg.goto(URL + "?conn=6")
    pg.wait_for_function("window.cubeLab")
    check(pg.evaluate("cubeLab.conn") == 6, "conn=6 is read")
    pg.click('[data-math="m.room"]')
    check("faces only" in pg.inner_text(".math-pop"), "inside, faces-only wording")
    pg.keyboard.press("Escape")
    pg.click("#mode-penta")
    pg.locator("#walls .ctl.wall").nth(0).click()
    pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=60000)
    vis = lambda k: pg.locator(f'.math-chip[data-math="{k}"]').is_visible()
    check(not vis("m.bound") and not vis("m.cover") and not vis("m.tetra"), "faces only: no corner bounds")
    ctx.close()




def tip_checks(browser, url, ready, items, home_sel, touch_sel, tag):
    """The shared bubble (../lab-tip.js): hover, keyboard focus, touch long
    press, the home link, no native title, no layout shift."""
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
            pg.screenshot(path=str(Path(OUT) / f"{tag}-tip-hover.png"))
        after = pg.evaluate("JSON.stringify([...document.querySelectorAll('.ctl, .chip, canvas')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))")
        check(before == after, f"{tag} {lang}: the bubble moves nothing")
        # the home explains itself and leads to the hub of all the labs
        box = pg.locator(home_sel).bounding_box()
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pg.wait_for_timeout(450)
        check(bubble() == pg.evaluate("window.i18n.t('lab.home')"), f"{tag} {lang}: the home explains itself")
        if lang == "fr":
            pg.screenshot(path=str(Path(OUT) / f"{tag}-tip-home-fr.png"))
        check(pg.get_attribute(home_sel, "href") == "../hub/", f"{tag} {lang}: the home links to the hub")
        pg.click(home_sel)
        pg.wait_for_url("**/hub/")
        check(pg.locator("a.piece").count() == 10, f"{tag} {lang}: the home lands on the hub")
        pg.go_back()
        pg.wait_for_function(ready)
        pg.wait_for_timeout(200)
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
    pg.screenshot(path=str(Path(OUT) / f"{tag}-tip-longpress-de.png"))
    pg.evaluate("window.__lp()")
    pg.wait_for_timeout(200)
    check(bubble() is not None, f"{tag}: the bubble stays a moment after the press")
    pg.wait_for_timeout(1700)
    check(bubble() is None, f"{tag}: then it goes")
    ctx.close()


def three_walls(browser):
    """The three walls of volume 52: each opens whole with the 29 pentacubes once and says what the paper says; they are told apart; the walls have a frame of their own above the pieces."""
    print("[three walls of volume 52]")
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    ctx.add_init_script("localStorage.setItem('fc-lang','en')")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.cubeLab")
    pg.click("#mode-penta")
    pg.wait_for_timeout(400)
    seen = []
    for k in range(3):
        pg.locator("#walls .ctl.wall").nth(k).click()
        pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=60000)
        pg.wait_for_timeout(500)
        s = pg.evaluate("cubeLab.state()")
        shapes = {p_["shape"] for p_ in s["pieces"]}
        check(len(s["pieces"]) == 29 and s["volume"] == 52 and len(shapes) == 29 and min(shapes) >= 0, f"wall {k + 1} opens whole: 29 pieces, each of the 29 pentacubes once, volume {s['volume']}")
        check(pg.locator("#walls .ctl.wall[aria-pressed='true']").count() == 1 and pg.locator("#walls .ctl.wall").nth(k).get_attribute("aria-pressed") == "true" and pg.locator("#tray .chip.placed").count() == 29, f"wall {k + 1} shows chosen and the 29 chips are placed")
        pg.click('.math-chip[data-math="m.wallinfo"]')
        pop = pg.inner_text(".math-pop")
        pills = pg.eval_on_selector_all(".math-pop .math-src .paper-ref", "els => els.map(e => e.textContent)")
        check("146" in pop and "144 cubes line the pocket exactly and a single cube sticks out" in pop, f"wall {k + 1} chip: best possible, 144 line the pocket and one cube sticks out")
        check("It is one of many: more than 35 million walls of volume 52 had been found when the search was stopped." in pop, f"wall {k + 1} chip: one of many, as the paper's search found")
        check(pills == (["§ 7.3 Pentacubes", "Fig. 30"] if k == 0 else ["§ 7.3 Pentacubes"]), f"wall {k + 1} chip: the footer {pills}")
        pg.keyboard.press("Escape")
        pg.click('.math-chip[data-math="m.bound"]')
        check("The three walls here reach 52" in pg.inner_text(".math-pop"), f"wall {k + 1}: the bound card speaks of the three walls")
        pg.keyboard.press("Escape")
        pg.click("#cast")
        pg.wait_for_timeout(2800)
        pg.click('.math-chip[data-math="m.cast"]')
        check("3 × 4 × 4 box with a 2 × 2 layer on one face" in pg.inner_text(".math-pop"), f"wall {k + 1}: the pocket is the almost-cube the cast card names")
        pg.keyboard.press("Escape")
        pg.click("#cast")
        pg.wait_for_timeout(2200)
        seen.append(sorted(tuple(c) for p_ in s["pieces"] for c in p_["cells"]))
    check(seen[0] != seen[1] and seen[0] != seen[2] and seen[1] != seen[2], "the three walls are three different walls")
    # the walls and the pieces are two places: the walls stand in a frame of their own, above the list
    fr = pg.evaluate("(() => { const w = document.querySelector('.wallsRow'), t = document.getElementById('tray'), cs = getComputedStyle(w); const a = w.getBoundingClientRect(), b = t.getBoundingClientRect(); return { border: cs.borderTopWidth, above: a.bottom <= b.top, inside: [...document.querySelectorAll('#walls .ctl.wall, .wallChips .math-chip')].every(e => { const r = e.getBoundingClientRect(); return r.left >= a.left && r.right <= a.right && r.top >= a.top && r.bottom <= a.bottom; }) }; })()")
    check(fr["border"] == "1px" and fr["above"] and fr["inside"], f"the walls have a frame of their own, above the list of pieces: {fr}")
    check(not errs, f"no script error {errs[:1]}")
    ctx.close()


def whole_chips(browser):
    """No chip is cut in half: the list shows whole rows (whole columns on a phone) at every place it is scrolled to."""
    print("[whole chips]")
    probe = """(() => { const t = document.getElementById('tray'), r0 = t.getBoundingClientRect(); let part = 0, whole = 0;
      t.querySelectorAll('.chip').forEach((c) => { const r = c.getBoundingClientRect();
        const ox = Math.min(r.right, r0.right) - Math.max(r.left, r0.left), oy = Math.min(r.bottom, r0.bottom) - Math.max(r.top, r0.top);
        if (ox > 1 && oy > 1) { if (r.left >= r0.left - 0.75 && r.right <= r0.right + 0.75 && r.top >= r0.top - 0.75 && r.bottom <= r0.bottom + 0.75) whole++; else part++; } });
      return { part, whole, along: getComputedStyle(t).gridAutoFlow.indexOf('column') === 0, max: t.scrollWidth - t.clientWidth, maxv: t.scrollHeight - t.clientHeight, left: t.scrollLeft, top: t.scrollTop }; })()"""
    for name, w, h, touch in (("desktop", 1400, 900, False), ("laptop", 1280, 720, False), ("tablet", 820, 1180, True), ("phone", 390, 844, True), ("small phone", 390, 664, True)):
        ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=touch, has_touch=touch, device_scale_factor=2 if touch else 1, bypass_csp=True)
        ctx.add_init_script("localStorage.setItem('fc-lang','en')")
        pg = ctx.new_page()
        pg.goto(URL)
        pg.wait_for_function("window.cubeLab")
        pg.wait_for_timeout(500)
        for step in ("penta", "hexa"):
            pg.click(f"#mode-{step}")
            pg.wait_for_timeout(500)
            if step == "hexa":
                pg.click("#walls .ctl.wall >> nth=0")
                pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=60000)
                pg.wait_for_timeout(600)
            info = pg.evaluate(probe)
            for where in ("start", "a row in", "the end"):
                if where == "a row in":
                    pg.evaluate("(() => { const t = document.getElementById('tray'), c = t.querySelector('.chip'), g = getComputedStyle(t); const p = (g.gridAutoFlow.indexOf('column') === 0) ? c.offsetWidth + parseFloat(g.columnGap) : c.offsetHeight + parseFloat(g.rowGap); if (g.gridAutoFlow.indexOf('column') === 0) t.scrollLeft = 3 * p; else t.scrollTop = 3 * p; })()")
                elif where == "the end":
                    pg.evaluate("(() => { const t = document.getElementById('tray'); t.scrollLeft = t.scrollWidth; t.scrollTop = t.scrollHeight; })()")
                pg.wait_for_timeout(500)
                info = pg.evaluate(probe)
                check(info["part"] == 0 and info["whole"] > 0, f"{name}, {step} step, list at {where}: {info['whole']} whole chips, {info['part']} cut in half")
        ctx.close()


# The standard shapes, written as pictures here and nowhere else in the lab: the letters the lists put on the flat pieces are checked against them.
POLYOMINOES = {
    4: {"I": ["####"], "O": ["##", "##"], "T": ["###", ".#."], "L": ["###", "#.."], "S": [".##", "##."]},
    5: {"F": [".##", "##.", ".#."], "I": ["#####"], "L": ["####", "#..."], "N": ["##..", ".###"], "P": ["##", "##", "#."],
        "T": ["###", ".#.", ".#."], "U": ["#.#", "###"], "V": ["#..", "#..", "###"], "W": ["#..", "##.", ".##"],
        "X": [".#.", "###", ".#."], "Y": ["####", ".#.."], "Z": ["##.", ".#.", ".##"]},
}


def canon2(cells):
    """A planar piece up to the 8 turns and flips of the plane."""
    best = None
    for k in range(8):
        pts = list(cells)
        if k & 1:
            pts = [(-x, y) for x, y in pts]
        for _ in range(k >> 1):
            pts = [(-y, x) for x, y in pts]
        mx, my = min(x for x, y in pts), min(y for x, y in pts)
        t = tuple(sorted((x - mx, y - my) for x, y in pts))
        if best is None or t < best:
            best = t
    return best


def pic(rows):
    return {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "#"}


def classes_names_looks(browser):
    """The pieces of the lists wear their class (flat, 3D alone, 3D with a twin) on their frame and in their bubble, the flat ones their name; the look button
    shrinks the pieces, makes them see-through, or both, and the key L does the same."""
    print("[classes, names, looks]")
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    ctx.add_init_script("localStorage.setItem('fc-lang','en')")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL)
    pg.wait_for_function("window.cubeLab")
    labels = lambda: pg.eval_on_selector_all("#tray .chip", "els => els.map(e => e.getAttribute('aria-label'))")
    classes = lambda: pg.eval_on_selector_all("#tray .chip", "els => els.map(e => (e.className.match(/k-(\\w+)/) || [])[1])")
    colour = lambda sel: pg.evaluate(f"getComputedStyle(document.querySelector({sel!r})).borderTopColor")
    # the same cells the lab builds its pieces from, and the classes worked out here from them
    truth = lambda n: pg.evaluate(f"""(() => {{ const G = window.CubeGeometry, flat = (p) => [0, 1, 2].some((a) => p.every((c) => c[a] === p[0][a]));
      return G.polycubes({n}).map((p) => ({{ flat: flat(p), chiral: G.canon(p) !== G.canon(G.mirror(p)), cells: p }})); }})()""")
    frames = {}
    for step, n, want in (("tetra", 4, (5, 1, 2)), ("penta", 5, (12, 5, 12)), ("hexa", 6, (35, 23, 108))):
        pg.click(f"#mode-{step}")
        pg.wait_for_timeout(500)
        cl, lb, tr = classes(), labels(), truth(n)
        got = (cl.count("flat"), cl.count("sym"), cl.count("twin"))
        check(got == want and len(cl) == len(tr), f"{step}: {got[0]} flat, {got[1]} 3D alone, {got[2]} 3D with a twin, as worked out from the cells: {got}")
        ok = all((c == "flat") == t["flat"] and (c == "twin") == (t["chiral"] and not t["flat"]) for c, t in zip(cl, tr))
        check(ok, f"{step}: every chip wears the class of its own piece")
        # the words say it too: colour is never the only cue
        words = all((("flat" in l) if c == "flat" else ("3D, its own mirror image" in l) if c == "sym" else ("3D, mirror image of piece" in l)) for c, l in zip(cl, lb))
        check(words and len(set(lb)) == len(lb), f"{step}: every label says the class in words, each piece its own")
        # the bubble says what the piece is and nothing of its number or its cubes (Erika, 22.10); the screen reader keeps the full label
        tips = pg.eval_on_selector_all("#tray .chip", "els => els.map(e => e.getAttribute('data-lab-tip'))")
        want = {"flat": None, "sym": "3D, its own mirror image", "twin": "3D, it has a mirror twin"}
        ok_tips = all(("Piece" not in tp and "cube" not in tp) and ((tp == want[c]) if want[c] else (tp == "Flat" or tp.startswith("Flat, the "))) for c, tp in zip(cl, tips))
        check(ok_tips, f"{step}: every bubble is the class and the name, no number and no cubes: {sorted(set(tips))[:4]}...")
        # a twin names its twin, and the twin names it back
        back = {}
        for i, l in enumerate(lb):
            if "mirror image of piece" in l:
                back[i + 1] = int(l.split("mirror image of piece ")[1].split(",")[0])
        check(all(back.get(m) == i for i, m in back.items()), f"{step}: the {len(back)} twins name each other")
        # the names of the flat pieces, against the standard shapes drawn above
        if n in POLYOMINOES:
            named = {}
            for l, t in zip(lb, tr):
                if t["flat"]:
                    word = "tetromino" if n == 4 else "pentomino"
                    letter = l.split(f"the {word} ")[1].split(",")[0] if f"the {word} " in l else None
                    axis = next(a for a in range(3) if all(c[a] == t["cells"][0][a] for c in t["cells"]))
                    plane = {tuple(v for a, v in enumerate(c) if a != axis) for c in t["cells"]}
                    named.setdefault(letter, []).append(canon2([(a, b) for a, b in plane]))
            letters = sorted(named)
            check(letters == sorted(POLYOMINOES[n]) and all(len(v) == 1 for v in named.values()), f"{step}: each of the {len(POLYOMINOES[n])} flat pieces has its own letter: {letters}")
            check(all(named[k][0] == canon2(pic(POLYOMINOES[n][k])) for k in POLYOMINOES[n]), f"{step}: each letter is on the shape it names")
        else:
            flat_l = [l for l, c in zip(lb, cl) if c == "flat"]
            check(len(flat_l) == 35 and all(l.endswith(", 6 cubes, flat") for l in flat_l), f"{step}: the 35 flat hexacubes are only called flat")
        for c in ("flat", "sym", "twin"):
            frames[(step, c)] = colour(f"#tray .chip.k-{c}")
    check(len({frames[("penta", c)] for c in ("flat", "sym", "twin")}) == 3 and len(set(frames.values())) == 3, f"the three classes have three frames: {sorted(set(frames.values()))}")
    # an opened wall places every piece: the chips stay dashed, dim, and keep their class frame; the label says placed
    pg.click("#mode-penta")
    pg.click("#walls .ctl.wall >> nth=0")
    pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=60000)
    pg.wait_for_timeout(600)
    kept = {c: colour(f"#tray .chip.k-{c}") for c in ("flat", "sym", "twin")}
    check(kept == {c: frames[("penta", c)] for c in kept}, f"a placed chip keeps the frame of its class: {kept}")
    check(pg.evaluate("getComputedStyle(document.querySelector('#tray .chip.placed')).borderTopStyle") == "dashed" and pg.locator("#tray .chip.placed").count() == 29, "and it is still dashed")
    check(all(l.endswith(", placed: choose it where it stands") for l in labels()), "its label says it is placed")
    tips = pg.eval_on_selector_all("#tray .chip", "els => els.map(e => e.getAttribute('data-lab-tip'))")
    check(all(tp.endswith(", placed: choose it where it stands") and "Piece" not in tp for tp in tips), "and its bubble too, without the number")

    # ---- the look of the pieces, on the wall of volume 52 (29 pieces, 145 cubes)
    look = lambda: pg.evaluate("cubeLab.state().look")
    deep = lambda: pg.evaluate("cubeLab.looks(true)")
    btn = lambda: pg.get_attribute("#look", "aria-label")
    check(pg.locator("#look").is_visible() and look() == 0 and pg.get_attribute("#look", "data-look") == "0", "the look button is there, on solid")
    check(btn() == "Pieces solid. Next: pieces shrunk a little, to tell them apart (key L)" and pg.get_attribute("#look", "data-lab-tip") == btn(), f"it says the look and what its next press does: {btn()}")
    d = deep()
    check(d["widths"] == ["0.900"] and not d["transparent"] and d["depthWrite"] and d["see"] == 0, f"solid: every cube 0.9 wide, opaque: {d['widths']}")
    want_words = ["Pieces solid.", "Pieces shrunk a little, to tell them apart.", "Pieces see-through.", "Pieces shrunk and see-through."]
    for k in (1, 2, 3, 0):
        pg.click("#look")
        pg.wait_for_timeout(250)
        d = deep()
        check(look() == k and pg.get_attribute("#look", "data-look") == str(k) and pg.inner_text("#status").strip() == want_words[k], f"look {k}: the status says '{pg.inner_text('#status').strip()}'")
        shrunk, see = bool(k & 1), bool(k & 2)
        if shrunk:
            check(set(d["widths"]) <= {"0.760", "0.880", "1.000"} and "0.760" in d["widths"] and "1.000" in d["widths"], f"look {k}: the cubes are 0.76, 0.88 or 1 wide: {d['widths']}")
            check(d["apart"] >= 0.11 and d["sharing"] > 0 and d["joined"] < 1e-3, f"look {k}: cubes of two pieces stand {d['apart']:.2f} apart at least, cubes of one piece join ({d['sharing']} joins, widest gap {d['joined']:.4f})")
        else:
            check(d["widths"] == ["0.900"], f"look {k}: every cube 0.9 wide: {d['widths']}")
        check(d["transparent"] == see and d["depthWrite"] == (not see) and d["see"] == (1 if see else 0) and d["doubleSided"] == see, f"look {k}: {'see-through' if see else 'opaque'} (transparent {d['transparent']}, depth written {d['depthWrite']})")
        check(d["roomSolid"] == (52 if see else 0), f"look {k}: the room of 52 cubes {'stands inside as a solid' if see else 'is a glow'} ({d['roomSolid']} solid cubes)")
    # the wall is still the wall: same pieces, same volume, in every look
    s_ = pg.evaluate("cubeLab.state()")
    check(len(s_["pieces"]) == 29 and s_["volume"] == 52, f"the look changes nothing but the picture: {len(s_['pieces'])} pieces, volume {s_['volume']}")
    # the key L, the same cycle, from the board
    pg.focus("#space")
    pg.keyboard.press("l")
    pg.wait_for_timeout(150)
    k1 = look()
    pg.keyboard.press("L")
    pg.wait_for_timeout(150)
    k2 = look()
    pg.keyboard.press("l")
    pg.keyboard.press("l")
    pg.wait_for_timeout(150)
    check((k1, k2, look()) == (1, 2, 0), f"the key L cycles the look: {k1}, {k2}, then {look()} after two more")
    # the look stays when the pieces are cut, spread, chosen, and when the step changes
    pg.click("#look")
    pg.evaluate("(() => { const e = document.getElementById('spread'); e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); })()")
    pg.wait_for_timeout(300)
    d = deep()
    check(d["joined"] < 1e-3 and d["sharing"] > 0 and d["apart"] > 0, f"shrunk and spread: cubes of one piece still join ({d['sharing']} joins), no two pieces touch ({d['apart']:.2f} apart at least)")
    pg.evaluate("(() => { const e = document.getElementById('spread'); e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); })()")
    pg.evaluate("(() => { const e = document.getElementById('cut'); e.value = 3; e.dispatchEvent(new Event('input', { bubbles: true })); })()")
    pg.wait_for_timeout(300)
    check(look() == 1 and len(pg.evaluate("cubeLab.looks(true).widths")) >= 1, "shrunk and cut open: still drawn")
    pg.evaluate("(() => { const e = document.getElementById('cut'); e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); })()")
    pg.evaluate("cubeLab.select(3)")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(Path(OUT) / "look-shrunk-chosen.png"))
    pg.keyboard.press("Escape")
    pg.click("#look")
    pg.wait_for_timeout(300)
    pg.evaluate("cubeLab.select(3)")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(Path(OUT) / "look-seethrough-chosen.png"))
    pg.keyboard.press("Escape")
    pg.click("#mode-hexa")
    pg.wait_for_timeout(500)
    check(look() == 2, "the look stays when the step changes")
    # French and German say it too
    for lang, first in (("fr", "Pièces transparentes. Ensuite"), ("de", "Teile durchsichtig. Danach")):
        pg.click(f'[data-lang-btn="{lang}"]')
        pg.wait_for_timeout(300)
        check(btn().startswith(first), f"{lang}: {btn()}")
    pg.click('[data-lang-btn="en"]')
    pg.wait_for_timeout(200)
    # the pictures of the walls are drawn solid, whatever the look is when they are first drawn: they have a material of their own, which no look touches
    # (comparing two pictures from two page loads is no test here: a headless GPU now and then loses its second context, the pictures then come out broken, with the pushed version too)
    check(pg.evaluate("cubeLab.looks().thumbOwnMaterial") and look() == 2, "the pictures of the walls have a material of their own: no look reaches them")
    # the biggest wall, in the looks that cost most: drawn at once
    pg.click("#mode-hepta")
    pg.click("#walls .ctl.wall >> nth=0")
    pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=120000)
    pg.wait_for_timeout(600)
    times = pg.evaluate("""(() => { const out = []; for (const k of [1, 3, 0]) { const t0 = performance.now(); cubeLab.setLook(k); out.push(Math.round(performance.now() - t0)); } return out; })()""")
    check(max(times) < 2500, f"the 1023 heptacubes (7161 cubes): the looks are drawn in {times} ms")
    check(not errs, f"no script error {errs[:1]}")
    ctx.close()


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    only = os.environ.get("ONLY")      # ONLY=classes_names_looks runs that one part alone
    part = lambda f: (not only or only == f.__name__) and f(b)
    if not only or only == "run":
        run(b, "desktop", 1400, 900, False)
        run(b, "phone", 390, 844, True)
    for f in (faces_only, held_piece, tetra_wall, three_walls, whole_chips, classes_names_looks, wall_links):
        part(f)
    if not only or only == "tips":
        print("[tips]")
        tip_checks(b, URL, "window.cubeLab", [("#mode-penta", "cu.mode.pentaTip"), ("#mode-hexa", "cu.mode.hexaTip"), ("#turn", "cu.turnTip"), ("#cast", "cu.castTip"), ("#look", "cu.look.0"), ("#play-wrap", "cu.play.wrap")],
                   ".lab-nav a[href='../hub/']", "#mode-penta", "cube")
    b.close()
srv.shutdown()
print("FAILS:", fails if fails else "none")
sys.exit(1 if fails else 0)

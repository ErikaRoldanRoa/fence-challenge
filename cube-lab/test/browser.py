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
    check(pg.locator('[data-math="m.tetra"]').is_hidden(), "the tetracube math waits for a room found by hand")
    check(pg.get_attribute("#undo", "aria-disabled") == "true", "undo is off with nothing to undo")
    f0 = st()["frames"]
    pg.wait_for_timeout(500)
    check(st()["frames"] - f0 <= 1, "nothing is drawn while nothing changes")
    pg.click('[data-math="m.room"]')
    check(pg.locator(".math-pop").is_visible() and "inside" in pg.inner_text(".math-pop h2"), "a math chip opens its panel")
    check("label" not in pg.inner_text(".math-pop") and "\\" not in pg.inner_text(".math-pop"), "no LaTeX in the panel")
    pg.screenshot(path=f"{OUT}/{name}-math.png")
    pg.click('[data-math="m.room"]')
    check(pg.locator(".math-pop").is_hidden(), "a second tap closes it")

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

    # 7. a refused move shows red and changes nothing
    s = st()
    for _ in range(12):
        pg.click('[data-nudge="left"]')
    for _ in range(12):
        pg.click('[data-nudge="up"]')
    stuck = st()["pieces"][0]["cells"]
    check(all(0 <= c[0] < 9 and 0 <= c[2] < 9 for c in stuck), "moves stop at the edge of the space")

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
    pg.locator("#walls .ctl.wall").nth(0).click()
    pg.locator("#walls .ctl.wall").nth(1).click()
    check(st()["busy"] and "moment" in pg.inner_text("#status").lower() or "instant" in pg.inner_text("#status").lower(), "a tap while the wall goes up is answered")
    pg.wait_for_function("!document.body.hasAttribute('data-busy')", timeout=60000)
    s = st()
    check(s["volume"] == 52 and len(s["pieces"]) == 29, "wall 1 opens whole")
    check(pg.locator("#walls .ctl.wall").nth(0).get_attribute("aria-pressed") == "true", "the opened wall shows chosen")
    check(pg.locator("#walls .ctl.wall").count() == 3, "three walls")
    pg.click('[data-math="m.wallinfo"]')
    check("146" in pg.inner_text(".math-pop") and "13" in pg.inner_text(".math-pop"), "wall 1's chip: best possible, Puzzle 13")
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
    pg.wait_for_timeout(1400)
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


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    run(b, "desktop", 1400, 900, False)
    run(b, "phone", 390, 844, True)
    faces_only(b)
    b.close()
srv.shutdown()
print("FAILS:", fails if fails else "none")
sys.exit(1 if fails else 0)

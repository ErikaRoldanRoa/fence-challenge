"""Browser checks of the pentomino DP lab (desktop and phone, FR/DE/EN).
Usage: ~/anaconda3/bin/python3 pentomino-dp-lab/test/browser.py [outdir]
Serves the repository root on a free port."""
import functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/dp-lab-test"
os.makedirs(OUT, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/pentomino-dp-lab/"

fails, oks = [], 0
def check(cond, msg):
    global oks
    if cond: oks += 1; print("  ok  ", msg)
    else: fails.append(msg); print("  FAIL", msg)

def page_for(b, lang, phone):
    ctx = b.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1400, "height": 900},
                        is_mobile=phone, has_touch=phone)
    ctx.add_init_script(f"try{{localStorage.setItem('fc-lang','{lang}')}}catch(e){{}}")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(500)
    return ctx, pg, errs

def ev(pg, js): return pg.evaluate(js)
def wait_done(pg, not_order=None, ms=60000):
    for _ in range(ms // 200):
        st = pg.evaluate("[dpLab.run && dpLab.run.phase, dpLab.order]")
        if st[0] == "done" and st[1] != not_order: return True
        pg.wait_for_timeout(200)
    return False
def press(pg, sel, phone):
    if phone: pg.tap(sel)
    else: pg.click(sel)

with sync_playwright() as p:
    b = p.chromium.launch()
    for phone in (False, True):
        for lang in ("fr", "de", "en"):
            tag = f"{'phone' if phone else 'desk'}-{lang}"
            ctx, pg, errs = page_for(b, lang, phone)
            check(ev(pg, "dpLab.order") == "FIV", f"{tag}: opens on the seed F I V")
            check(ev(pg, "document.documentElement.lang") == lang, f"{tag}: language")
            badges = ev(pg, "[...document.querySelectorAll('.dp-badge')].map(b=>b.textContent).join('')")
            check(badges == "123", f"{tag}: three order badges")
            check(ev(pg, "document.getElementById('dp-shuffle').getAttribute('aria-disabled')") == "true", f"{tag}: shuffle off with 3 pieces")
            for i in range(3):
                press(pg, "#dp-step", phone); pg.wait_for_timeout(120)
                if i < 2:
                    check(ev(pg, "dpLab.run.step") == i + 1, f"{tag}: step {i+1}")
            check(not ev(pg, "document.querySelector('.dp-layerchip').hidden"), f"{tag}: the layer chip shows")
            check(wait_done(pg, ms=15000), f"{tag}: the trace finishes")
            st = ev(pg, "[dpLab.run.phase, dpLab.run.res.best, dpLab.run.flood, document.getElementById('area-value').textContent]")
            check(st[0] == "done" and st[1] == 6 and st[2] == 6 and st[3] == "6", f"{tag}: closes with area 6 (flood fill agrees): {st}")
            check(ev(pg, "document.querySelector('.dp-layerchip').getAttribute('data-math')") == "m.close", f"{tag}: closing chip")
            pg.screenshot(path=f"{OUT}/{tag}-seed-done.png")
            # Open the closing chip: no LaTeX, the section name.
            press(pg, ".dp-layerchip", phone); pg.wait_for_timeout(200)
            txt = ev(pg, "document.querySelector('.math-pop') && document.querySelector('.math-pop').innerText") or ""
            check("6" in txt and "\\" not in txt and "Optimal Polyomino Fences" in txt, f"{tag}: closing panel")
            pg.keyboard.press("Escape")
            # Step after the end starts again.
            press(pg, "#dp-step", phone); pg.wait_for_timeout(100)
            check(ev(pg, "[dpLab.run.phase, dpLab.run.step]") == ["layers", 1], f"{tag}: step restarts after the end")
            # Every button's centre belongs to the button, never to a chip.
            hits = ev(pg, """[...document.querySelectorAll('button, a.ctl, .ctl[role=link]')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(b).visibility!=='hidden'}).map(b=>{const r=b.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return b.contains(e)||e===b?'':(b.id||b.className)+'->'+(e&&(e.className||e.tagName))}).filter(Boolean)""")
            check(not hits, f"{tag}: every control's centre is its own {hits[:3]}")
            check(ev(pg, "!document.getElementById('dp-pill').hasAttribute('aria-live') && !document.getElementById('dp-pill').hasAttribute('role')"), f"{tag}: the pill is not a live region")
            # Add a fourth piece: the order matters.
            press(pg, '[data-piece-id="W"]', phone); pg.wait_for_timeout(100)
            check(ev(pg, "dpLab.order") == "FIVW", f"{tag}: W appended")
            check(ev(pg, "document.getElementById('dp-shuffle').getAttribute('aria-disabled')") is None, f"{tag}: shuffle on with 4 pieces")
            check(not ev(pg, "document.querySelector('[data-math=\"m.orders\"]').hidden"), f"{tag}: orders chip shows")
            press(pg, '[data-piece-id="I"]', phone); pg.wait_for_timeout(100)
            check(ev(pg, "dpLab.order") == "FVW", f"{tag}: I taken out")
            # Bubbles and the disabled home.
            check(ev(pg, "document.querySelectorAll('[data-lab-tip]').length") >= 20, f"{tag}: bubbles on the controls")
            before = pg.url
            pg.click('.lab-nav [aria-disabled="true"]', force=True); pg.wait_for_timeout(200)
            check(pg.url == before, f"{tag}: home disabled")
            check(not ev(pg, "document.body.innerText.includes('2025')"), f"{tag}: no year on the page")
            check(ev(pg, "document.documentElement.scrollWidth <= window.innerWidth"), f"{tag}: no horizontal overflow")
            # The area number keeps its size after a language switch.
            size0 = ev(pg, "parseFloat(getComputedStyle(document.getElementById('area-value')).fontSize)")
            other = "de" if lang != "de" else "en"
            press(pg, f'[data-lang-btn="{other}"]', phone); pg.wait_for_timeout(300)
            press(pg, f'[data-lang-btn="{lang}"]', phone); pg.wait_for_timeout(300)
            size1 = ev(pg, "parseFloat(getComputedStyle(document.getElementById('area-value')).fontSize)")
            check(size1 >= 30 and abs(size1 - size0) < 1, f"{tag}: area number keeps its size ({size0} -> {size1})")
            check(not errs, f"{tag}: no console errors {errs[:2]}")
            ctx.close()
    # The two reveals, desktop EN.
    ctx, pg, errs = page_for(b, "en", False)
    pg.click("#dp-worst"); wait_done(pg)
    st = ev(pg, "[dpLab.run.res.best, dpLab.run.flood]")
    check(st == [111, 111], f"worst order: 111 {st}")
    pg.screenshot(path=f"{OUT}/desk-en-worst.png")
    pg.click("#dp-best"); wait_done(pg, "TIPZLXFVUYNW")
    st = ev(pg, "[dpLab.run.res.best, dpLab.run.flood]")
    check(st == [128, 128], f"best order: 128 {st}")
    pg.screenshot(path=f"{OUT}/desk-en-best.png")
    pg.click("#dp-best"); pg.wait_for_timeout(200)
    check(ev(pg, "dpLab.order") == "FIV", f"the best order's button brings the visitor's order back: {ev(pg, 'dpLab.order')}")
    ev(pg, "dpLab.setOrder('LNVW')"); pg.click("#dp-play"); wait_done(pg)
    ev(pg, "dpLab.setOrder('LVNW')")
    pg.click("#dp-play"); wait_done(pg)
    prev = ev(pg, "document.getElementById('dp-prev').hidden ? '' : document.getElementById('dp-prev').textContent")
    check(prev.startswith("11"), f"same pieces, another order: the previous area shows ({prev})")
    pg.screenshot(path=f"{OUT}/desk-en-order-matters.png")
    ev(pg, "dpLab.setOrder('TIPZLXFVUYNW')"); pg.click("#dp-play"); pg.wait_for_timeout(300)
    check(ev(pg, "dpLab.playing"), "play runs")
    pg.click("#dp-play"); pg.wait_for_timeout(900)
    st = ev(pg, "[dpLab.playing, dpLab.run.step]")
    pg.wait_for_timeout(900)
    check(not st[0] and ev(pg, "dpLab.run.step") == st[1], f"play pauses {st}")
    check(not errs, f"reveals: no console errors {errs[:2]}")
    ctx.close()
    b.close()
print(f"{oks} ok, {len(fails)} failed")
sys.exit(1 if fails else 0)

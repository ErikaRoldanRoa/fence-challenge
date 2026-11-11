#!/usr/bin/env python3
"""The door cunef-2027/ (the QR codes of the printed boards open cunef-2027/?board=sq20|hex6|tri8). It opens with the Jornadas,
Wed 27.01.2027 at 00:00 in Madrid: before, no link into a lab, the camera or the hub exists in the page, nor a manifest or an
install offer; from then on the script makes them. Without script, never a link.
  1. Open (a fixed instant on 27.01), at four sizes, with each board and with none or an unknown one: no error, no request
     outside the site, no horizontal scroll, links at least 44 px high; the scanned board comes first and is marked, and on a
     phone its camera button is inside the first screen.
  2. Open: every link lands: a camera link in its lab, which asks for the camera; a play link in its lab, which does not.
  3. The opening, at fixed instants and phone time zones (the calendar of Madrid decides): the countdown's words; closed, zero
     a elements and no manifest; open, the seven links and the manifest. Without script: no link, only the dates.
  4. The install offer, open: the browser's prompt behind one button, the two taps on an iPhone, nothing once installed or when
     the browser offers nothing. Closed: no offer at all.
  5. (Chromium) the site's service worker controls the door.

  python3 test/cunef_door_check.py BASE_URL OUTDIR      (BASE_URL: the site root, ending with /; FC_BROWSER=webkit for Safari's engine)
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
ENGINE = os.environ.get("FC_BROWSER", "chromium")
os.makedirs(OUT, exist_ok=True)
OPENED = "2027-01-27T10:00:00Z"
CLOSED = "2026-11-11T13:50:00Z"
PLACE = {"sq20": "square-lab/index.html", "hex6": "hex-lab/index.html", "tri8": "triangle-lab/index.html"}
SIZES = {"phone": (390, 844), "se": (375, 553), "small": (320, 568), "laptop": (1440, 900)}
OPEN_TXT = "Ya está abierto: el Fence Challenge te espera"
LANGS_TXT = "Los tres laboratorios y la cámara hablan español: si tu móvil está en otro idioma, toca ES. El resto del sitio está, por ahora, en inglés, francés y alemán."   # the three boards' labs speak Spanish, the rest of the site not yet
OVER = "Las Jornadas 2027 han terminado: el Fence Challenge sigue abierto aquí, en línea"
CLOCK = [  # instant, phone time zone, board, countdown, open
    ("2026-11-11T13:50:00Z", "Europe/Zurich", None, "Se abre en 77 días", False),
    ("2026-11-11T13:50:00Z", "Europe/Madrid", "sq20", "Se abre en 77 días", False),
    ("2027-01-25T10:00:00Z", "Europe/Madrid", "hex6", "Se abre en 2 días", False),
    ("2027-01-26T10:00:00Z", "Europe/Madrid", None, "Se abre mañana", False),
    ("2027-01-26T20:00:00Z", "Asia/Tokyo", "tri8", "Se abre mañana", False),        # the phone is on 27.01, Madrid on 26.01 21:00
    ("2027-01-26T22:59:00Z", "Europe/Madrid", "hex6", "Se abre mañana", False),     # Madrid 26.01 23:59
    ("2027-01-26T23:00:00Z", "Europe/Madrid", "sq20", OPEN_TXT, True),              # Madrid 27.01 00:00
    ("2027-01-26T23:30:00Z", "America/Mexico_City", "hex6", OPEN_TXT, True),        # the phone is on 26.01, Madrid on 27.01
    ("2027-01-28T12:00:00Z", "Europe/Madrid", "tri8", OPEN_TXT, True),
    ("2027-01-29T22:30:00Z", "Europe/Madrid", None, OPEN_TXT, True),                # Madrid 29.01 23:30
    ("2027-01-29T23:30:00Z", "Europe/Madrid", None, OVER, True),                    # Madrid 30.01 00:30
    ("2027-06-01T12:00:00Z", "America/New_York", "sq20", OVER, True),
]
WAY_IN = re.compile(r"(^|/)(camera/|[a-z-]+-lab/|hub/)")
IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
          "Version/17.5 Mobile/15E148 Safari/604.1")
# the labs take #camera off their address and ask for the camera: count that ask, refuse it (no prompt)
GUM = """(function(){var md=navigator.mediaDevices||{};window.__gum=0;try{Object.defineProperty(navigator,'mediaDevices',
{configurable:true,value:Object.assign(Object.create(md),{getUserMedia:function(){window.__gum++;
return Promise.reject(new DOMException('test','NotAllowedError'));},enumerateDevices:function(){return Promise.resolve([]);}})});}catch(e){}})();"""
BIP = """(function(){var e=new Event('beforeinstallprompt',{cancelable:true});window.__prompted=0;
e.prompt=function(){window.__prompted++;return Promise.resolve();};e.userChoice=Promise.resolve({outcome:'dismissed'});
window.dispatchEvent(e);})();"""
STATE = """() => {
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const c = document.getElementById('count');
  return {
    count: c && vis(c) ? c.textContent : null,
    hrefs: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')),
    shown: [...document.querySelectorAll('a')].filter(vis).length,
    soon: [...document.querySelectorAll('.soon')].filter(vis).length,
    manifest: document.querySelectorAll('link[rel=manifest]').length,
    install: vis(document.getElementById('install')),
    first: document.querySelector('#boards .board').dataset.board,
    langs: (() => { const l = document.querySelector('.langs'); return l && vis(l) ? l.textContent.trim() : null; })(),
  };
}"""
fails, oks = [], 0


def check(cond, msg):
    global oks
    if cond:
        oks += 1
    else:
        fails.append(msg)
        print("FAIL", msg)


def visible(pg, sel):
    return pg.evaluate("s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }", sel)


def door(ctx, at):
    pg = ctx.new_page()
    pg.clock.set_fixed_time(at)
    return pg


with sync_playwright() as p:
    br = getattr(p, ENGINE).launch()

    # 1. open: sizes and boards
    for sname, (w, h) in SIZES.items():
        for board in [None, "sq20", "hex6", "tri8", "nope"]:
            ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1 if sname == "laptop" else 2)
            pg = door(ctx, OPENED)
            errors, foreign = [], []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            pg.on("request", lambda r: foreign.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith("data:") else None)
            pg.goto(BASE + "cunef-2027/" + (f"?board={board}" if board else ""), wait_until="networkidle")
            tag = f"{ENGINE}/{sname}/{board}"
            check(not errors, f"{tag}: no error {errors}")
            check(not foreign, f"{tag}: no request outside the site {foreign}")
            sw = pg.evaluate("document.documentElement.scrollWidth")
            check(sw <= w, f"{tag}: no horizontal scroll ({sw} > {w})")
            first = pg.evaluate("document.querySelector('#boards .board').dataset.board")
            yours = pg.evaluate("[...document.querySelectorAll('.board.yours')].map(e => e.dataset.board)")
            if board in PLACE:
                check(first == board and yours == [board], f"{tag}: {board} first and marked ({first}, {yours})")
                if sname != "laptop":
                    bottom = pg.evaluate("(e => e ? e.getBoundingClientRect().bottom : 1e9)(document.querySelector('.board.yours .cam'))")
                    check(bottom <= h, f"{tag}: the camera button of the scanned board inside the first screen ({bottom:.0f} > {h})")
            else:
                check(first == "sq20" and yours == [], f"{tag}: no board marked ({first}, {yours})")
            small = pg.evaluate("[...document.querySelectorAll('a,button')].filter(a => { const r = a.getBoundingClientRect(); return r.width && r.height < 44; }).map(a => a.textContent.trim())")
            check(not small, f"{tag}: every link and button at least 44 px high {small}")
            pg.screenshot(path=os.path.join(OUT, f"open_{sname}_{board}.png"), full_page=True)
            ctx.close()
        # the same size today, closed
        ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1 if sname == "laptop" else 2)
        pg = door(ctx, CLOSED)
        pg.goto(BASE + "cunef-2027/?board=hex6", wait_until="networkidle")
        check(pg.evaluate("document.documentElement.scrollWidth") <= w, f"{ENGINE}/{sname}/closed: no horizontal scroll")
        pg.screenshot(path=os.path.join(OUT, f"closed_{sname}_hex6.png"), full_page=True)
        ctx.close()

    # 2. open: every link lands where it should
    ctx = br.new_context(viewport={"width": 390, "height": 844})
    ctx.add_init_script(GUM)
    pg = door(ctx, OPENED)
    pg.goto(BASE + "cunef-2027/?board=sq20", wait_until="networkidle")
    hrefs = pg.evaluate("[...document.querySelectorAll('a')].map(a => a.href)")
    check(len(hrefs) == 7, f"{ENGINE}: seven links (three camera, three play, the hub) {hrefs}")
    for href in hrefs:
        want, cam = None, False
        for b, place in PLACE.items():
            if href.endswith(f"camera/?board={b}"):
                want, cam = BASE + place, True
            elif href.endswith(place):
                want = BASE + place
        if href.endswith("/hub/"):
            want = BASE + "hub/"
        pg2 = ctx.new_page()
        # the camera page sends the phone on at once (location.replace): wait for the address, not for its load event
        resp = pg2.goto(href, wait_until="commit", timeout=60000)
        try:
            if want:
                pg2.wait_for_url(want, timeout=60000)
            pg2.wait_for_load_state("load", timeout=60000)
        except Exception as e:
            print("waiting:", str(e).splitlines()[0])
        pg2.wait_for_timeout(600)
        gum = pg2.evaluate("window.__gum || 0")
        check(resp is not None and resp.status < 400 and want is not None and pg2.url == want,
              f"{ENGINE}: {href} lands on {pg2.url} (want {want}, status {resp.status if resp else None})")
        check((gum > 0) == cam, f"{ENGINE}: {href} asks for the camera {gum} times, expected {'yes' if cam else 'no'}")
        pg2.close()
    ctx.close()

    # 3. the opening
    for instant, tz, board, want, opened in CLOCK:
        ctx = br.new_context(timezone_id=tz, viewport={"width": 390, "height": 844})
        pg = door(ctx, instant)
        pg.goto(BASE + "cunef-2027/" + (f"?board={board}" if board else ""), wait_until="load")
        st = pg.evaluate(STATE)
        tag = f"{ENGINE} {instant} {tz} {board}"
        check(st["count"] == want, f"{tag}: countdown {st['count']!r} != {want!r}")
        if opened:
            check(len(st["hrefs"]) == 7 and st["shown"] == 7 and st["soon"] == 0 and st["manifest"] == 1,
                  f"{tag}: open, the seven links and the manifest, no « se abre » ({st})")
            check(st["langs"] == LANGS_TXT, f"{tag}: open, the line on languages ({st['langs']!r})")
        else:
            ways = [h for h in st["hrefs"] if h and WAY_IN.search(h)]
            check(st["langs"] is None, f"{tag}: closed, no line on languages ({st['langs']!r})")
            check(st["hrefs"] == [] and ways == [] and st["manifest"] == 0 and not st["install"] and st["soon"] == 3,
                  f"{tag}: closed, no a element, no way into a lab, the camera or the hub, no manifest, no offer; the boards say when ({st})")
        if board:
            check(st["first"] == board, f"{tag}: the scanned board first ({st['first']})")
        ctx.close()
    ctx = br.new_context(java_script_enabled=False)
    pg = ctx.new_page()
    pg.goto(BASE + "cunef-2027/?board=tri8", wait_until="load")
    n_a, n_m = pg.locator("a").count(), pg.locator("link[rel=manifest]").count()
    check(n_a == 0 and n_m == 0 and pg.locator("#count").is_hidden() and pg.locator(".soon").first.is_hidden() and pg.locator("#install").is_hidden(),
          f"{ENGINE} no script: no link ({n_a}), no manifest ({n_m}), no countdown, no « se abre », no offer")
    check("29 de enero de 2027" in pg.inner_text(".when"), f"{ENGINE} no script: the dates are there")
    ctx.close()

    # 4. the install offer
    ctx = br.new_context(viewport={"width": 1280, "height": 800})
    pg = door(ctx, OPENED)
    pg.goto(BASE + "cunef-2027/", wait_until="load")
    check(not visible(pg, "#install"), f"{ENGINE}: open, no offer when the browser offers nothing")
    pg.evaluate(BIP)
    check(visible(pg, "#install") and visible(pg, "#install-btn") and not visible(pg, "#install-ios"),
          f"{ENGINE}: open, the browser's offer shows one button")
    if visible(pg, "#install-btn"):
        pg.click("#install-btn")
        pg.wait_for_timeout(200)
    check(pg.evaluate("window.__prompted") == 1, f"{ENGINE}: the button opens the browser's own prompt")
    check(not visible(pg, "#install"), f"{ENGINE}: declined, the offer goes away")
    ctx.close()
    ctx = br.new_context(viewport={"width": 1280, "height": 800})
    pg = door(ctx, CLOSED)
    pg.goto(BASE + "cunef-2027/", wait_until="load")
    pg.evaluate(BIP)
    check(not visible(pg, "#install") and pg.evaluate("window.__prompted") == 0, f"{ENGINE}: closed, no offer even when the browser offers one")
    ctx.close()
    for at, shows in ((OPENED, True), (CLOSED, False)):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, user_agent=IPHONE)
        pg = door(ctx, at)
        pg.goto(BASE + "cunef-2027/", wait_until="load")
        got = visible(pg, "#install") and visible(pg, "#install-ios") and not visible(pg, "#install-btn")
        check(got == shows, f"{ENGINE}: on an iPhone, {'open: the two taps' if shows else 'closed: no offer'} ({got})")
        if shows:
            pg.screenshot(path=os.path.join(OUT, "iphone_install.png"), full_page=True)
        ctx.close()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, user_agent=IPHONE)
    ctx.add_init_script("Object.defineProperty(navigator, 'standalone', {get: () => true});")
    pg = door(ctx, OPENED)
    pg.goto(BASE + "cunef-2027/", wait_until="load")
    check(not visible(pg, "#install"), f"{ENGINE}: once installed, no offer")
    ctx.close()

    # 5. the service worker
    if ENGINE == "chromium":
        ctx = br.new_context()
        pg = door(ctx, OPENED)
        pg.goto(BASE + "cunef-2027/?board=tri8", wait_until="load")
        try:
            pg.evaluate("Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 8000))])")
            pg.reload(wait_until="load")
            pg.wait_for_function("!!navigator.serviceWorker.controller", timeout=15000)
        except Exception as e:
            print("service worker:", str(e).splitlines()[0])
        scope = pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r && r.scope)")
        check(scope == BASE, f"the site's service worker controls the door (scope {scope})")
        man = pg.evaluate("(l => l && l.href)(document.querySelector('link[rel=manifest]'))")
        check(man == BASE + "manifest.json", f"open, the door links the site's manifest ({man})")
        ctx.close()
    br.close()

print(json.dumps({"engine": ENGINE, "ok": oks, "fail": len(fails)}))
sys.exit(1 if fails else 0)

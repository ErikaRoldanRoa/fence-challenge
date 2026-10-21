"""The questionnaire on the contest's pages (cigales/index.html, ecran.html, resultats.html): when it is offered, to whom, and where it leads.

Usage: python3 test/feedback_check.py <base-url>      (the base address serves the repository root)

The clock and the network are faked, so every moment is reached on purpose. The contest offers its questionnaire (teams.js, `feedback.from`) from Thursday 22.10.2026 at 08:00,
Zurich time, and the contest ends the same day at 19:30. Checked: before 08:00 no page offers it; from 08:00 the phone page has a link and the big screen a QR code beside the way
in; after 19:30 the way in is replaced by the questionnaire's QR code on the screen and on the results sheet (nobody plays any more); every QR code decodes to the address of the
page with the contest's event id; the link leads to the questionnaire in the words of a contest; everyone who plays is offered it, the Cigales and the public group
(?g=cirm), at the same moments; a second call adds nothing."""
import json, sys

import cv2
import numpy as np
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
EVENT = "2026-10-22-cirm-cigales-enchivas"
URL = f"{BASE}retours/?e={EVENT}"
BEFORE, OPEN, FINAL = "2026-10-21T10:00:00+02:00", "2026-10-22T09:00:00+02:00", "2026-10-22T20:00:00+02:00"
failures, count = [], 0


def check(cond, msg):
    global count
    count += 1
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def handler(route):
    q = route.request.url.split("?", 1)[-1]
    hdr = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json"}
    if route.request.method == "OPTIONS":
        route.fulfill(status=204, headers=hdr)
        return
    if "getTeams" in q:
        body = {"status": "ok", "teams": {}}
    elif "getFences" in q:
        body = {"status": "ok", "fences": [], "now": "2026-10-22T09:00:00+02:00", "closes": "2026-10-22T19:30:00+02:00"}
    else:
        body = {"status": "ok"}
    route.fulfill(status=200, headers=hdr, body=json.dumps(body))


def open_page(browser, path, when, size=(1588, 1123), scale=1):
    ctx = browser.new_context(viewport={"width": size[0], "height": size[1]}, device_scale_factor=scale)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
    pg.route("https://script.google.com/**", handler)
    pg.clock.set_fixed_time(when)
    pg.goto(BASE + path, wait_until="domcontentloaded")
    pg.wait_for_timeout(900)
    if path.startswith("cigales/ecran"):
        pg.click("#intro")
        pg.wait_for_timeout(700)
    return ctx, pg, errs


def decode(pg, selector):
    png = pg.locator(selector).screenshot()
    img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_COLOR)
    img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    return cv2.QRCodeDetector().detectAndDecode(img)[0]


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---- before Thursday 08:00: nobody is offered it ----
    for path, sel in (("cigales/", "#fb"), ("cigales/?g=cirm", "#fb"), ("cigales/ecran.html", "#fbqr"), ("cigales/ecran.html?g=cirm", "#fbqr"), ("cigales/resultats.html", "#fbqr")):
        ctx, pg, errs = open_page(browser, path, BEFORE, size=(390, 844) if path.startswith("cigales/") and "ecran" not in path and "resultats" not in path else (1588, 1123))
        check(pg.locator(sel).count() == 0, f"before Thursday morning {path}: nothing offered")
        check(not errs, f"no console error {errs[:2]}")
        ctx.close()

    # ---- Thursday from 08:00: the phone page has a link, the screen a QR code beside the way in ----
    ctx, pg, errs = open_page(browser, "cigales/", OPEN, size=(390, 844))
    link = pg.locator("#fb")
    check(link.count() == 1 and link.get_attribute("href") == URL, f"the phone page links to the questionnaire with the event id: {link.get_attribute('href') if link.count() else None}")
    check("Donne ton avis" in link.inner_text() and "concours" in link.inner_text(), f"in words a visitor reads: {link.inner_text()!r}")
    check(pg.locator("#who button:not([disabled])").count() > 0, "and the contest still plays")
    link.click()
    pg.wait_for_selector("#w-q1", state="attached")
    pg.wait_for_load_state("load")      # the page's script swaps the words; on a real network the heading is attached before it has run
    check(pg.url == URL and pg.text_content("#w-q1") == "Comment s'est passé ce concours ?", f"the link leads to the questionnaire, in the words of a contest: {pg.url} · {pg.text_content('#w-q1')!r}")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    ctx, pg, errs = open_page(browser, "cigales/ecran.html", OPEN, size=(1920, 1080))
    check(pg.locator("#fbqr").count() == 1 and pg.locator("footer .join:not(.fb)").is_visible(), "the screen: the questionnaire's QR code beside the way in, which stays")
    check(decode(pg, "#fbqr") == URL, f"the screen's QR code decodes to the page: {decode(pg, '#fbqr')!r}")
    pg.evaluate("feedback(); feedback();")
    check(pg.locator("#fbqr").count() == 1 and pg.locator("footer .join.fb").count() == 1, "a second call adds nothing")
    box = pg.evaluate("(() => { const f = document.querySelector('footer').getBoundingClientRect(); return [...document.querySelectorAll('footer *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > f.right + 1 || r.left < f.left - 1 || r.bottom > innerHeight + 1); }).length; })()")
    check(box == 0, f"nothing in the foot leaves the screen: {box}")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    # the public group (everyone else at the CIRM) is offered it the same way: the link on its phone page, the QR code on its screen
    ctx, pg, errs = open_page(browser, "cigales/?g=cirm", OPEN, size=(390, 844))
    link = pg.locator("#fb")
    check(link.count() == 1 and link.get_attribute("href") == URL and "Donne ton avis" in link.inner_text() and "concours" in link.inner_text(), f"the public group's phone page links to the questionnaire too: {link.get_attribute('href') if link.count() else None}")
    check(pg.locator("#who button:not([disabled])").count() > 0, "and its contest still plays")
    check(pg.evaluate("document.documentElement.scrollHeight <= innerHeight + 1"), "on one screen, without scrolling, as before")
    pg.screenshot(path="/tmp/feedback-check-cirm-open.png")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()
    ctx, pg, errs = open_page(browser, "cigales/ecran.html?g=cirm", OPEN, size=(1920, 1080))
    check(pg.locator("#fbqr").count() == 1 and pg.locator("footer .join:not(.fb)").is_visible(), "the public group's screen: the questionnaire's QR code beside the way in, which stays")
    check(decode(pg, "#fbqr") == URL, f"whose QR code decodes to the page: {decode(pg, '#fbqr')!r}")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    ctx, pg, errs = open_page(browser, "cigales/resultats.html", OPEN)
    check(pg.locator("#fbqr").count() == 0 and pg.locator("footer .join").first.is_visible(), "the results sheet, the contest not over: it keeps its way in, no questionnaire yet")
    ctx.close()

    # ---- after the end: the way in is of no use, the questionnaire takes its place ----
    ctx, pg, errs = open_page(browser, "cigales/", FINAL, size=(390, 844))
    check(pg.locator("#fb").count() == 1 and "terminé" in pg.inner_text(".opens"), "the phone page: the contest is over and the link to the questionnaire is there")
    ctx.close()
    ctx, pg, errs = open_page(browser, "cigales/ecran.html", FINAL, size=(1920, 1080))
    check(pg.locator("#fbqr").count() == 1 and not pg.locator("footer .join:not(.fb)").is_visible(), "the screen: the way in gives its place to the questionnaire")
    check(decode(pg, "#fbqr") == URL, f"whose QR code decodes to the page: {decode(pg, '#fbqr')!r}")
    ctx.close()
    ctx, pg, errs = open_page(browser, "cigales/resultats.html", FINAL, scale=3)   # on paper the code is 23 mm wide; on this screen it needs more pixels to be read
    check(pg.locator("#fbqr").count() == 1 and not pg.locator("footer .join:not(.fb)").is_visible(), "the results sheet: the same")
    check(decode(pg, "#fbqr") == URL, f"its QR code decodes to the page: {decode(pg, '#fbqr')!r}")
    check("5 questions, 1 minute, anonyme" in pg.inner_text("footer"), "and says what it is")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    # ---- the public group, after the end: offered the same way ----
    ctx, pg, errs = open_page(browser, "cigales/?g=cirm", FINAL, size=(390, 844))
    check(pg.locator("#fb").count() == 1 and pg.locator("#fb").get_attribute("href") == URL and "terminé" in pg.inner_text(".overnote") and "jeu libre" in pg.inner_text(".overnote"), "the public group's phone page, after the end: the contest is over, free play goes on, and the link to the questionnaire is there")
    check(pg.evaluate("document.documentElement.scrollHeight <= innerHeight + 1"), "still on one screen, without scrolling")
    pg.screenshot(path="/tmp/feedback-check-cirm-final.png")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()
    ctx, pg, errs = open_page(browser, "cigales/ecran.html?g=cirm", FINAL, size=(1920, 1080))
    check(pg.locator("#fbqr").count() == 1 and decode(pg, "#fbqr") == URL, f"the public group's screen, after the end: the questionnaire's QR code decodes to the page: {decode(pg, '#fbqr')!r}")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()
    browser.close()

print(f"\nresults: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

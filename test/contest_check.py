"""The contest on a phone: a party for a new personal best, a trophy for the best so far of the board among all players, and the end.

Usage: python3 test/contest_check.py <base-url> [outdir]      (the base address serves the repository root)

The network is faked: the contest's API is answered by this script (what the server says about a record: where the phone stands on
its board), so every state is reached on purpose. The phone is a context whose localStorage holds a contest ticket, as the contest
page leaves it. Checked: the party (a first fence, a record, nothing for a lower one, nothing when the phone asks for less motion),
the trophy (only for a record that leads; its tap, its badge), the end of the contest (the clock: from 19:30 the prizes are frozen and
the phone goes on as free play: every new closed fence is sent, no trophy, the badge and the pages say so; an older server's « closed »
is still understood), the three languages, the hub and the big boards.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/contest-check"
os.makedirs(OUT, exist_ok=True)
failures, count = [], 0
API = "https://api.contest.test/exec"


def check(cond, msg):
    global count
    count += 1
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


TICKET = {"api": API, "workshop": "cigales-2026", "token": "tok", "device": "dev-contest0001", "name": "Testeuse", "team": "f", "group": "cigales", "back": "/cigales/"}


def phone(browser, lang="fr", reduced=False, now=None, ticket=None):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce" if reduced else "no-preference", bypass_csp=False)
    ctx.add_init_script("try { localStorage.setItem('fc-lang', %s); localStorage.setItem('fc-contest', %s); localStorage.setItem('cigales-team', 'f'); } catch (e) {}" % (json.dumps(lang), json.dumps(json.dumps(ticket or TICKET))))
    posts = []
    answer = {"fn": lambda body: {"status": "ok", "board": body["board"], "best": body["area"], "record": True, "top": 0, "leader": True, "closes": "2026-10-22T19:30:00+02:00"}}

    def handle(route):
        req = route.request
        hdr = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json"}
        if req.method == "OPTIONS":
            route.fulfill(status=204, headers=hdr)
            return
        if req.method == "POST":
            body = json.loads(req.post_data or "{}")
            posts.append(body)
            route.fulfill(status=200, headers=hdr, body=json.dumps(answer["fn"](body)))
        else:
            route.fulfill(status=200, headers=hdr, body=json.dumps({"status": "ok", "fences": [], "teams": {}}))

    ctx.route("https://api.contest.test/**", handle)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "api.contest.test" not in m.text and "ERR_" not in m.text else None)
    if now:
        pg.clock.set_fixed_time(now)
    return ctx, pg, posts, answer, errors


def lab(pg, path="square-lab/index.html"):
    pg.goto(BASE + path, wait_until="domcontentloaded")
    pg.wait_for_function("window.FenceContest && typeof FenceContest.note === 'function'")


def gone(pg, sel, ms=4000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        if pg.locator(sel).count() == 0:
            return True
        pg.wait_for_timeout(100)
    return False


with sync_playwright() as p:
    browser = getattr(p, os.environ.get("ENGINE", "chromium")).launch()   # ENGINE=webkit or firefox runs the same checks there

    # ---- the party: a first fence, a record, nothing for a lower one ----
    ctx, pg, posts, answer, errors = phone(browser, "fr")
    answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": b["area"] + 5, "leader": False}   # not the best of the board: no trophy
    lab(pg)
    pg.evaluate("FenceContest.note('sq20', 30)")
    check(pg.locator(".fc-party[data-kind=first]").count() == 1 and "Première clôture" in pg.inner_text(".fc-party") and "30" in pg.inner_text(".fc-party"), f"a first fence is a party: {pg.inner_text('.fc-party')!r}")
    check(pg.locator("canvas.fc-confetti").count() == 1, "with confetti")
    pg.screenshot(path=f"{OUT}/party-first-fr.png")
    check(gone(pg, "canvas.fc-confetti", 4500) and gone(pg, ".fc-party", 2000), "which goes by itself, and leaves the screen free")
    pg.evaluate("FenceContest.note('sq20', 45)")
    txt = pg.inner_text(".fc-party")
    check(pg.locator(".fc-party[data-kind=record]").count() == 1 and "Record battu" in txt and "45" in txt and "avant 30" in txt, f"a new personal best is a party: {txt!r}")
    check(pg.locator(".fc-trophy").count() == 0, "but no trophy while another player is ahead")
    gone(pg, ".fc-party", 4500)
    pg.evaluate("FenceContest.note('sq20', 40)")
    check(pg.locator(".fc-party").count() == 0 and pg.locator("canvas.fc-confetti").count() == 0, "a lower fence is no party")
    pg.evaluate("FenceContest.note('hex6', 12)")
    check(pg.locator(".fc-party[data-board=hex6][data-kind=first]").count() == 1, "each board has its own records")
    pg.wait_for_timeout(1500)
    check([(b["board"], b["area"]) for b in posts] == [("sq20", 30), ("sq20", 45), ("hex6", 12)] or [(b["board"], b["area"]) for b in posts][-1] == ("hex6", 12), f"the records go to the server: {[(b['board'], b['area']) for b in posts]}")
    check(not errors, f"no console error {errors[:2]}")
    ctx.close()

    # ---- the trophy: only for a record that leads ----
    ctx, pg, posts, answer, errors = phone(browser, "fr")
    answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": b["area"] - 3, "leader": True}
    lab(pg)
    pg.evaluate("FenceContest.note('sq20', 60)")
    pg.wait_for_selector(".fc-trophy", timeout=8000)
    t = pg.inner_text(".fc-trophy")
    check("Meilleur du concours" in t and "grand damier 20 × 20" in t and "60" in t, f"the best so far of the board is a trophy: {t!r}")
    check(pg.locator(".fc-party").count() == 0, "which takes the place of the party's line")
    check("🏆" in pg.inner_text(".fc-contest"), f"and the badge keeps a cup while the phone leads: {pg.inner_text('.fc-contest')!r}")
    pg.screenshot(path=f"{OUT}/trophy-fr.png")
    pg.click(".fc-trophy")
    check(pg.locator(".fc-trophy").count() == 0, "a tap sends it away")
    # beaten later: the next answer says it no longer leads, the cup goes
    answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": b["area"] + 9, "leader": False}
    pg.evaluate("FenceContest.note('sq20', 61)")
    pg.wait_for_timeout(1500)
    check("🏆" not in pg.inner_text(".fc-contest") and pg.locator(".fc-trophy").count() == 0, "a phone that no longer leads loses its cup")
    # a re-sent record that is not a new record never makes a trophy
    answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": False, "top": 1, "leader": True}
    pg.evaluate("FenceContest.note('hex6', 8)")
    pg.wait_for_timeout(1500)
    check(pg.locator(".fc-trophy").count() == 0, "a record the server did not take as new is no trophy")
    check(not errors, f"no console error {errors[:2]}")
    ctx.close()

    # ---- a server that says closed (the one before free play): nothing more is sent ----
    ctx, pg, posts, answer, errors = phone(browser, "fr")
    answer["fn"] = lambda b: {"status": "closed", "closes": "2026-10-22T19:30:00+02:00"}
    lab(pg)
    pg.evaluate("FenceContest.note('sq20', 22)")
    pg.wait_for_timeout(2500)
    n = len(posts)
    check(pg.locator(".fc-trophy").count() == 0, "a refused record is no trophy")
    check(pg.evaluate("JSON.parse(localStorage.getItem('fc-contest-queue') || '[]').length") == 0, "the queue is emptied: the phone stops sending")
    pg.evaluate("FenceContest.note('sq20', 23)")
    pg.wait_for_timeout(1500)
    check(len(posts) == n + 1 or len(posts) == n, f"at most one more try, then nothing: {len(posts)} posts")
    ctx.close()

    # ---- the end by the clock: the prizes are frozen, the phone goes on playing (free play) ----
    ctx, pg, posts, answer, errors = phone(browser, "fr", now="2026-10-22T19:31:00+02:00")
    answer["fn"] = lambda b: {"status": "ok", "free": True, "board": b["board"], "best": b["area"], "record": False, "closes": "2026-10-22T19:30:00+02:00"}   # what the server answers after the end: no rank
    lab(pg)
    pg.evaluate("FenceContest.note('sq20', 70)")
    pg.wait_for_timeout(1200)
    check(len(posts) == 1 and (posts[0]["board"], posts[0]["area"], posts[0]["name"]) == ("sq20", 70, "Testeuse"), f"after 19:30 a closed fence is still sent, with the pseudonym: {posts}")
    check(pg.locator(".fc-trophy").count() == 0, "the server says no rank: no trophy")
    check("jeu libre" in pg.inner_text(".fc-contest") and "70" in pg.inner_text(".fc-contest") and "Concours terminé" not in pg.inner_text(".fc-contest"), f"the badge says free play and the personal best: {pg.inner_text('.fc-contest')!r}")
    check(pg.locator(".fc-party[data-kind=first]").count() == 1, "a personal best is still a party")
    gone(pg, ".fc-party", 4500)
    pg.evaluate("FenceContest.note('sq20', 60)")
    pg.wait_for_timeout(1200)
    check(len(posts) == 2 and posts[1]["area"] == 60 and pg.locator(".fc-party").count() == 0, f"a lower fence is sent too, as play, and is no party: {[(b['board'], b['area']) for b in posts]}")
    pg.evaluate("FenceContest.note('sq20', 60)")
    pg.wait_for_timeout(800)
    check(len(posts) == 2, "the same fence again is sent once")
    pg.evaluate("FenceContest.note('sq20', 70)")
    pg.wait_for_timeout(1200)
    check(len(posts) == 3 and posts[2]["area"] == 70 and pg.locator(".fc-party").count() == 0, "a fence equal to the best is play, not a party")
    check(pg.evaluate("JSON.parse(localStorage.getItem('fc-contest-queue') || '[]').length") == 0, "and nothing is left in the queue")
    check(not errors, f"no console error {errors[:2]}")
    for path, who in (("cigales/index.html", "the Cigales' contest page"), ("cigales/index.html?g=cirm", "the public group's contest page")):
        pg.goto(BASE + path, wait_until="networkidle")
        op = pg.inner_text(".overnote" if "cirm" in path else ".opens")
        check("terminé" in op and "jeu libre" in op and "enregistrés" in op, f"{who} says the contest is over, that free play goes on and that it is recorded: {op!r}")
        check(pg.locator("#who button:not([disabled])").count() >= (1 if "cirm" in path else 3) and not pg.is_disabled("#pseudo"), f"{who} lets the phone go on playing")
    pg.goto(BASE + "cigales/index.html", wait_until="networkidle")
    check(pg.evaluate("getComputedStyle(document.getElementById('teams')).pointerEvents") == "none", "the teams stay closed")
    # a phone that comes to the contest page for the first time after the end: its pseudonym opens the game as before (a fresh phone, so no ticket is put back on each page)
    ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="fr-FR")
    ctx2.route("https://script.google.com/**", lambda route: route.fulfill(status=200, headers={"access-control-allow-origin": "*", "content-type": "application/json"}, body=json.dumps({"status": "ok", "teams": {}})))
    pg2 = ctx2.new_page()
    pg2.clock.set_fixed_time("2026-10-22T19:31:00+02:00")
    pg2.goto(BASE + "cigales/index.html", wait_until="networkidle")
    pg2.fill("#pseudo", "Libre")
    with pg2.expect_navigation():
        pg2.locator("#who button:not([disabled])").first.click()
    tk = pg2.evaluate("JSON.parse(localStorage.getItem('fc-contest') || 'null')")
    check(tk and tk["name"] == "Libre" and tk["workshop"] == "cigales-2026" and "index.html" in pg2.url, f"a new pseudonym after the end opens the game as before: {pg2.url} {tk and tk['name']}")
    pg2.wait_for_function("window.FenceContest && typeof FenceContest.note === 'function'")
    check("jeu libre" in pg2.inner_text(".fc-contest"), f"and the game wears the free-play badge: {pg2.inner_text('.fc-contest')!r}")
    ctx2.close()
    pg.goto(BASE + "cigales/ecran.html", wait_until="networkidle")
    pg.wait_for_timeout(500)
    check("terminé" in pg.inner_text("#opens") and pg.evaluate("document.body.classList.contains('over') && document.body.classList.contains('ranking')"), f"the screen keeps the final rankings: {pg.inner_text('#opens')!r}")
    ctx.close()
    ctx, pg, posts, answer, errors = phone(browser, "fr", now="2026-10-22T19:29:00+02:00")
    pg.goto(BASE + "cigales/index.html", wait_until="networkidle")
    check("19 h 30" in pg.inner_text(".opens") and pg.locator("#who button:not([disabled])").count() >= 3, f"a minute before, it is open and says until when: {pg.inner_text('.opens')!r}")
    pg.goto(BASE + "cigales/ecran.html", wait_until="networkidle")
    check("19 h 30" in pg.inner_text("#opens") and not pg.evaluate("document.body.classList.contains('over')"), "and so is the screen")
    ctx.close()

    # ---- less motion, the three languages, the hub ----
    ctx, pg, posts, answer, errors = phone(browser, "fr", reduced=True)
    answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": 0, "leader": True}
    lab(pg)
    pg.evaluate("FenceContest.note('sq20', 33)")
    pg.wait_for_selector(".fc-trophy", timeout=8000)
    check(pg.locator("canvas.fc-confetti").count() == 0, "a phone that asks for less motion gets no confetti, only the words")
    ctx.close()
    for lang, want_first, want_rec, want_cup in (("en", "First fence!", "New record!", "Best of the contest"), ("de", "Erster Zaun!", "Neuer Rekord!", "Bestwert des Wettbewerbs")):
        ctx, pg, posts, answer, errors = phone(browser, lang)
        answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": b["area"] + 4, "leader": False}
        lab(pg)
        pg.evaluate("FenceContest.note('sq20', 10)")
        check(want_first in pg.inner_text(".fc-party"), f"{lang}: the first fence speaks the language: {pg.inner_text('.fc-party')!r}")
        gone(pg, ".fc-party", 4500)
        pg.evaluate("FenceContest.note('sq20', 20)")
        check(want_rec in pg.inner_text(".fc-party"), f"{lang}: and the record: {pg.inner_text('.fc-party')!r}")
        gone(pg, ".fc-party", 4500)
        answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": 0, "leader": True}
        pg.evaluate("FenceContest.note('sq20', 30)")
        pg.wait_for_selector(".fc-trophy", timeout=8000)
        check(want_cup in pg.inner_text(".fc-trophy"), f"{lang}: and so does the trophy: {pg.inner_text('.fc-trophy')!r}")
        ctx.close()
    ctx, pg, posts, answer, errors = phone(browser, "fr")
    answer["fn"] = lambda b: {"status": "ok", "board": b["board"], "best": b["area"], "record": True, "top": b["area"] + 2, "leader": False}
    pg.goto(BASE + "index.html", wait_until="domcontentloaded")
    pg.wait_for_function("window.FenceContest && typeof FenceContest.note === 'function'")
    pg.evaluate("FenceContest.note('sq', 6)")
    check(pg.locator(".fc-party").count() == 1, "the hub's missions are a party too")
    ctx.close()
    browser.close()

print(f"\ncontest: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

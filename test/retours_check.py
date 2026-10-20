"""The questionnaire page (retours/index.html): the words of a workshop and of a contest, the answer that is sent, the offline queue, an event id that is hostile, a small phone.

Usage: python3 test/retours_check.py <base-url>      (the base address serves the repository root)

The network is faked: the contest's server is answered by this script, so every case is reached on purpose. Checked: the page says « atelier » for an ordinary event and
« concours » for the Cigales' event (or when asked with &w=concours), never both; the one POST carries the instrument, the event, the answers and nothing else;
a send with no network is kept and goes out once the network is back, exactly once; an event id is reduced to letters, digits and dashes; nothing scrolls sideways on a
320 px screen at any step; the focus follows the question."""
import json, re, sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
failures, count = [], 0
CIGALES = "2026-10-22-cirm-cigales-enchivas"
CY = "2026-10-10-cy-fence-challenge"


def check(cond, msg):
    global count
    count += 1
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def page(browser, query, size=(390, 844), online=True):
    ctx = browser.new_context(viewport={"width": size[0], "height": size[1]})
    pg = ctx.new_page()
    posts, errs = [], []
    state = {"online": online}
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)

    def handle(route):
        if not state["online"]:
            route.abort()
            return
        posts.append(json.loads(route.request.post_data or "{}"))
        route.fulfill(status=200, headers={"access-control-allow-origin": "*", "content-type": "application/json"}, body=json.dumps({"status": "ok", "survey_id": "s-test"}))

    pg.route("https://script.google.com/**", handle)
    pg.goto(BASE + "retours/" + query, wait_until="domcontentloaded")
    pg.wait_for_timeout(250)
    return ctx, pg, posts, errs, state


def all_text(pg):
    """The words of every step, shown or not."""
    return pg.evaluate("[...document.querySelectorAll('main')].map(m => m.textContent).join(' ')")


def fill_in(pg):
    pg.click("[data-step='0'] [data-next]")
    for v in ("amusant", "fascinant"):
        pg.click(f"#adj .opt[data-v='{v}']")
    pg.click("[data-step='1'] [data-next]")
    pg.click("[data-one='understood'] .opt[data-v='yes']")
    pg.click("[data-step='2'] [data-next]")
    pg.click("[data-one='feeling'] .opt[data-v='interested']")
    pg.click("[data-step='3'] [data-next]")
    for i, k in enumerate(["time_flew", "relevant", "like_class", "more", "demanding"]):
        pg.click(f"#likert .stmt:nth-child({i + 1}) .opt[data-v='{(i % 4) + 1}']")
    pg.click("[data-step='4'] [data-next]")
    pg.click("[data-one='age'] .opt[data-v='15-18']")


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---- the words: a workshop says « atelier », a contest says « concours », never both ----
    ctx, pg, posts, errs, _ = page(browser, f"?e={CY}")
    t = all_text(pg)
    check("atelier" in t and "concours" not in t, "an ordinary event: « atelier » everywhere, no « concours »")
    check(pg.inner_text("#w-q1") == "Comment s'est passé cet atelier ?", f"the first question is the instrument's own: {pg.inner_text('#w-q1')!r}")
    ctx.close()

    ctx, pg, posts, errs, _ = page(browser, f"?e={CIGALES}")
    t = all_text(pg)
    check("concours" in t and "atelier" not in t, f"the Cigales' event: « concours » everywhere, no « atelier »: {re.findall(r'.{25}atelier.{15}', t)[:2]}")
    want = {"#w-sub0": "Cinq petites questions sur le concours du Fence Challenge.", "#w-q1": "Comment s'est passé ce concours ?", "#w-q3": "ressenti pendant le concours ?",
            "#w-feel-interested": "le concours était agréable.", "#w-feel-very": "le concours était bien amusant", "#w-done": "prochains concours.", "#w-note0": "prochains concours."}
    bad = [k for k, v in want.items() if v not in pg.inner_text(k) and v not in pg.text_content(k)]
    check(not bad, f"the questions, the two feelings and the thanks follow: {bad}")
    stm = pg.eval_on_selector_all("#likert .stmt p", "els => els.map(e => e.textContent)")
    check(stm[1] == "Le contenu de ce concours était pertinent par rapport à ma vie quotidienne." and stm[2] == "L'activité de ce concours ressemble à ce qu'on fait tous les jours en classe."
          and stm[4] == "Le contenu de ce concours était exigeant pour moi." and stm[0] == "Le temps a filé." and stm[3] == "J'aimerais réaliser plus d'activités comme celle-ci.", f"the five statements, the two without the noun untouched: {stm}")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    ctx, pg, posts, errs, _ = page(browser, "?e=un-autre-evenement&w=concours")
    check("concours" in all_text(pg) and "atelier" not in all_text(pg), "any event can ask for the contest's words with &w=concours")
    ctx.close()

    # ---- what is sent ----
    ctx, pg, posts, errs, _ = page(browser, f"?e={CIGALES}")
    check(pg.inner_text("#adjCount") == "0 choisi", "no adjective chosen yet")
    fill_in(pg)
    pg.click("#send")
    pg.wait_for_timeout(600)
    check(len(posts) == 1, f"one send, one POST: {len(posts)}")
    b = posts[0] if posts else {}
    check(b.get("action") == "submitSurvey" and b.get("instrument") == "les-adapted-v1" and b.get("event") == CIGALES and b.get("mode") == "online" and b.get("lang") == "fr", f"the action, the instrument, the event, the mode, the language: {({k: b.get(k) for k in ('action', 'instrument', 'event', 'mode', 'lang')})}")
    a = b.get("answers", {})
    check(sorted(a.get("adjectives", [])) == ["amusant", "fascinant"] and a.get("understood") == "yes" and a.get("feeling") == "interested" and a.get("age") == "15-18"
          and a.get("likert") == {"time_flew": 1, "relevant": 2, "like_class": 3, "more": 4, "demanding": 1}, f"the answers, key by key: {a}")
    check(set(b.keys()) == {"action", "instrument", "event", "mode", "lang", "origin", "client_id", "hp", "answers"} and b.get("hp") == "" and len(b.get("client_id", "")) >= 8, f"nothing else leaves the phone: {sorted(b.keys())}")
    check(pg.evaluate("JSON.parse(localStorage.getItem('fcSurveyQueue') || '[]').length") == 0, "and the queue is empty once the server said ok")
    check(pg.locator("[data-step='6'].show").count() == 1 and "Merci" in pg.inner_text("[data-step='6']"), "the thanks are shown")
    # a second answer from the same phone is another answer
    pg.click("#again")
    check(pg.locator("[data-step='0'].show").count() == 1 and pg.inner_text("#adjCount") == "0 choisi", "« Nouvelle réponse » starts again, empty")
    fill_in(pg)
    pg.click("#send")
    pg.wait_for_timeout(500)
    check(len(posts) == 2 and posts[0]["client_id"] != posts[1]["client_id"], "a new answer has its own idempotency key")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    # ---- no network: the answer is kept and goes out once, when the network is back ----
    ctx, pg, posts, errs, state = page(browser, f"?e={CIGALES}", online=False)
    fill_in(pg)
    pg.click("#send")
    pg.wait_for_timeout(900)
    q = pg.evaluate("JSON.parse(localStorage.getItem('fcSurveyQueue') || '[]')")
    check(len(q) == 1 and q[0]["event"] == CIGALES and len(posts) == 0, f"offline: the answer waits on the phone ({len(q)} in the queue, {len(posts)} sent)")
    check(pg.is_visible("#pending") and "Pas de réseau" in pg.inner_text("#pending"), "and the page says so")
    state["online"] = True
    pg.evaluate("window.dispatchEvent(new Event('online'))")
    pg.wait_for_timeout(900)
    check(len(posts) == 1 and pg.evaluate("JSON.parse(localStorage.getItem('fcSurveyQueue') || '[]').length") == 0, f"back online: it goes out once and the queue empties ({len(posts)} sent)")
    pg.evaluate("window.dispatchEvent(new Event('online'))")
    pg.wait_for_timeout(500)
    check(len(posts) == 1, "and a second « online » sends nothing more")
    ctx.close()

    # ---- an event id that is hostile is reduced to letters, digits and dashes ----
    ctx, pg, posts, errs, _ = page(browser, "?e=%3Cimg%20src%3Dx%3E%22%3EÉvè%20N%C3%A8me_2026%2F..%2F")
    fill_in(pg)
    pg.click("#send")
    pg.wait_for_timeout(500)
    ev = posts[0]["event"] if posts else None
    check(ev is not None and re.fullmatch(r"[a-z0-9-]+", ev) is not None and len(ev) <= 80, f"the event id is clean: {ev!r}")
    check(pg.locator("img").count() == 0, "and nothing was injected into the page")
    ctx.close()
    ctx, pg, posts, errs, _ = page(browser, "")
    fill_in(pg)
    pg.click("#send")
    pg.wait_for_timeout(500)
    check(posts and posts[0]["event"] == "fence-challenge", f"with no event the id is the default one: {posts[0]['event'] if posts else None}")
    ctx.close()

    # ---- a small phone: nothing scrolls sideways at any step, the focus follows the question ----
    ctx, pg, posts, errs, _ = page(browser, f"?e={CIGALES}", size=(320, 640))
    widths, focus = [], []
    pg.click("[data-step='0'] [data-next]")
    for n in range(1, 6):
        widths.append(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        focus.append(pg.evaluate("document.activeElement && document.activeElement.tagName") in ("H1", "H2"))
        if n == 1:
            pg.click("#adj .opt[data-v='amusant']")
        pg.click(f"[data-step='{n}'] [data-next]") if n < 5 else None
    check(all(widths), f"320 px: no sideways scroll at any of the five questions: {widths}")
    check(all(focus), f"the focus lands on the question's title at each step: {focus}")
    check(pg.evaluate("[...document.querySelectorAll('.opt')].every(b => b.getBoundingClientRect().height === 0 || b.getBoundingClientRect().height >= 40)"), "every choice is at least 40 px tall")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()
    browser.close()

print(f"\nresults: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

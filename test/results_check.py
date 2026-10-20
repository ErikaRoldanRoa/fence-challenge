"""The results sheet of the contest (cigales/resultats.html): the teams ranked by the total of their best fences on the three grand boards, the four prizes,
the six boards, the public group, one A3 landscape page.

Usage: python3 test/results_check.py <base-url> [outdir]      (the base address serves the repository root)

The network is faked: the contest's server is answered by this script, so every case is reached on purpose. Checked: the order of the teams (the total
of the best fence of a team on each grand board; at the same total, the team that reached it first, which is the time of the last of the fences that make
it; the teams with no fence on a grand board last), the four prizes (the Cigales teams and the public of the CIRM, each for the grand 20 x 20 board and for
the total), the order and the length of each board's list, one player is one pseudonym, names shown as text (a name that is HTML does nothing), the end of the
contest, nothing that spills out of its box or is cut on the A3 page, the PDF (one page, A3), the phone (no sideways scroll), an empty contest, a server that
does not answer."""
import json, os, re, sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/results-check"
os.makedirs(OUT, exist_ok=True)
failures, count = [], 0


def check(cond, msg):
    global count
    count += 1
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def row(name, team, board, area, at):
    return {"name": name, "team": team, "board": board, "area": area, "at": "2026-10-20T" + at + "+02:00"}


# u and v tie on the grand board (u got there first); u and v tie on 148 only with their hexagon fences, u's last fence is the earlier; w leads on the total with
# two phones on the grand board (only the better counts); y and z tie on 60, and z's first fence is the earliest of all but y reached 60 before z did;
# t and n only played missions; hostile and foreign names
CIGALES = [
    row("Ana", "u", "sq20", 114, "20:00:00"), row("Bo", "v", "sq20", 114, "20:05:00"), row("Cy", "w", "sq20", 110, "20:10:00"),
    row("Di", "w", "sq20", 60, "20:11:00"), row("<img src=x onerror=window.__x=1>", "l", "sq20", 100, "20:12:00"), row("Éloïse", "f", "sq20", 93, "20:13:00"),
    row("Fay", "u", "hex6", 34, "20:14:00"), row("Gus", "v", "hex6", 34, "20:15:00"), row("Hal", "w", "tri10", 98, "20:16:00"),
    row("Ivo", "t", "sq", 8, "20:17:00"), row("Jo", "n", "hex", 7, "20:18:00"), row("Kim", "", "sq20", 95, "20:19:00"),
    row("Lou", "p", "sq20", 80, "20:20:00"), row("Max", "x", "sq20", 70, "20:21:00"), row("Ned", "y", "sq20", 60, "20:22:00"),
    row("Oz", "z", "sq20", 50, "19:00:00"), row("Ola", "z", "hex6", 10, "20:30:00"), row("Pat", "u", "sq20", 40, "20:24:00"),
]
# Zoe has a fence on each grand board, under one pseudonym: her total is the three added; Damian has the best fence on the grand 20 x 20 board
PUBLIC = [row("андре", "", "hex6", 3, "21:00:00"), row("Damian", "", "sq20", 116, "21:05:00"), row("Zoe", "", "sq20", 101, "21:10:00"),
          row("Zoe", "", "hex6", 34, "21:11:00"), row("Zoe", "", "tri10", 80, "21:12:00")]
COUNTS = {"u": 5, "v": 3, "w": 4, "l": 2, "f": 5}
NOW = "2026-10-21T08:12:00+02:00"


def phone_page(browser, fences=CIGALES, public=PUBLIC, counts=COUNTS, size=(1588, 1123), fail=False):
    ctx = browser.new_context(viewport={"width": size[0], "height": size[1]})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "contest.test" not in m.text and "ERR_" not in m.text else None)

    def handle(route):
        q = route.request.url.split("?", 1)[-1]
        hdr = {"access-control-allow-origin": "*", "content-type": "application/json"}
        if fail:
            route.abort()
            return
        if "action=getTeams" in q:
            body = {"status": "ok", "teams": counts}
        elif "workshop=cirm-2026" in q:
            body = {"status": "ok", "fences": public, "now": NOW, "closes": "2026-10-22T19:30:00+02:00"}
        else:
            body = {"status": "ok", "fences": fences, "now": NOW, "closes": "2026-10-22T19:30:00+02:00"}
        route.fulfill(status=200, headers=hdr, body=json.dumps(body))

    pg.route("https://script.google.com/**", handle)
    return ctx, pg, errs


def open_sheet(pg):
    pg.goto(BASE + "cigales/resultats.html", wait_until="domcontentloaded")
    pg.wait_for_function("document.body.dataset.ready === '1' || document.getElementById('stamp').textContent.includes('indisponibles')", timeout=20000)
    pg.wait_for_timeout(300)


def cards(pg):
    return pg.eval_on_selector_all("#prizes .prize", "els => els.map(c => [c.querySelector('.who').textContent, c.querySelector('.rule').textContent, c.querySelector('.wn').textContent, c.querySelector('.sc').textContent])")


def pub_col(pg, title):
    return pg.evaluate("""t => { const c = [...document.querySelectorAll('#pubgrid .col')].find(c => c.querySelector('b').textContent === t);
      return c ? [...c.querySelectorAll('.row')].map(r => [r.querySelector('.n').textContent, r.querySelector('.a').textContent]) : null; }""", title)


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---- the ranking: by the total of the best fence on each grand board ----
    ctx, pg, errs = phone_page(browser)
    open_sheet(pg)
    names = pg.eval_on_selector_all("#teams .trow:not(.head) .nm", "els => els.map(e => e.textContent)")
    ranks = pg.eval_on_selector_all("#teams .trow:not(.head) .rk", "els => els.map(e => e.textContent)")
    check(len(names) == 12, f"the twelve teams are listed: {len(names)}")
    check(names[:9] == ["Pentomino " + c for c in "WUVLFPXYZ"], f"the teams follow the total of their best fences on the three grand boards (w 208, u 148, v 148, ...): {names[:9]}")
    check(names[1:3] == ["Pentomino U", "Pentomino V"], "u and v tie on 148: u reached it first (its last fence is the earlier)")
    check(names[7:9] == ["Pentomino Y", "Pentomino Z"], "y and z tie on 60: y reached it first, though z made the earliest fence of all")
    check(ranks[:9] == [str(i) for i in range(1, 10)] and set(ranks[9:]) == {"–"}, f"the ranks run on, and the teams with no fence on a grand board have none: {ranks}")
    check(names[9:] == ["Pentomino I", "Pentomino N", "Pentomino T"], f"the teams with none are in alphabetical order, the ones that only played missions with them: {names[9:]}")

    def team_row(letter):
        return pg.evaluate("""n => { const r = [...document.querySelectorAll('#teams .trow:not(.head)')].find(r => r.querySelector('.nm').textContent === n);
          return [...r.querySelectorAll('.v')].map(e => e.textContent.trim()); }""", "Pentomino " + letter)

    check(team_row("U")[:4] == ["148", "114", "34", "·"], f"a row reads: the total, then the best on the 20 × 20, the hexagons, the triangles (u: 148, 114, 34, none): {team_row('U')}")
    check(team_row("W")[:4] == ["208", "110", "·", "98"], f"a team's best on a board is its best phone, not the sum of its phones (w: 110 and 98, not 60 as well): {team_row('W')}")
    check(team_row("T")[4:] == ["8", "·", "·"] and team_row("T")[:4] == ["·", "·", "·", "·"], f"the missions do not count in the total: {team_row('T')}")
    wins = pg.eval_on_selector_all("#teams .v.win", "els => els.map(e => e.closest('.trow').querySelector('.nm').textContent + ':' + e.textContent)")
    check(wins == ["Pentomino W:208", "Pentomino U:114"], f"the leader of the total and the leader of the 20 × 20 are marked: {wins}")
    boards = pg.eval_on_selector_all("#boards .box", "els => els.map(b => [b.querySelector('h3').textContent, [...b.querySelectorAll('li')].map(l => [l.querySelector('.n').textContent, l.querySelector('.a').textContent])])")
    grand = dict((b[0], b[1]) for b in boards)
    sq20 = next(v for k, v in grand.items() if k.startswith("Grand damier"))
    check([a for _, a in sq20] == ["114", "114", "110", "100", "95"] and len(sq20) == 5, f"the grand board lists the five best phones, the higher area first: {sq20}")
    check(sq20[0][0] == "Ana" and sq20[1][0] == "Bo", f"and at the same area the first to get there: {sq20[:2]}")
    mission1 = next(v for k, v in grand.items() if k.startswith("Mission I") and not k.startswith("Mission II"))
    check(mission1 == [["Ivo", "8"]], f"a board with one fence lists it: {mission1}")
    check([b[0][:6] for b in boards] == ["Grand ", "Grande", "Grande", "Missio", "Missio", "Missio"], f"the three grand boards come first: {[b[0][:12] for b in boards]}")
    check(pg.evaluate("window.__x") is None and pg.locator("#boards img").count() == 0, "a name that is HTML is only text: nothing ran")
    check("<img src=x onerror=window.__x=1>" in pg.inner_text("#boards"), "and it reads as it was written")
    check("Kim" in pg.inner_text("#boards"), "a fence of someone with no team is listed on its board")
    note = pg.inner_text("#teams .note")
    check(note.startswith("Classement provisoire") and "additionne" in note and "première équipe arrivée" in note, f"the note says how the total is made and how a tie is broken: {note[:90]!r}")

    # ---- the four prizes ----
    pr = cards(pg)
    check(len(pr) == 4, f"four prizes: {len(pr)}")
    check(pr[0] == ["Cigales · équipes", "Grand damier 20 × 20", "Pentomino U", "114"], f"the Cigales, the 20 × 20 (u and v tie on 114, u first): {pr[0]}")
    check(pr[1] == ["Cigales · équipes", "Total des trois plateaux", "Pentomino W", "208"], f"the Cigales, the total: {pr[1]}")
    check(pr[2] == ["Public du CIRM", "Grand damier 20 × 20", "Damian", "116"], f"the public of the CIRM, the 20 × 20: {pr[2]}")
    check(pr[3] == ["Public du CIRM", "Total des trois plateaux", "Zoe", "215"], f"the public of the CIRM, the total (one pseudonym, three fences: 101 + 34 + 80): {pr[3]}")
    check(pg.locator("#prizes .prize .bd").count() == 2 and pg.locator("#prizes .prize.none").count() == 0, "the two teams show their bird, the public has none")
    pub = pg.inner_text("#pub")
    check("Damian" in pub and "андре" in pub and "116" in pub, f"the public group has its own place, with names in any script: {pub[:120]!r}")
    cols = pg.eval_on_selector_all("#pubgrid .col b", "els => els.map(e => e.textContent)")
    check(cols == ["Damier 20 × 20", "Grille hexagones", "Grille triangles", "Total des trois"], f"it shows the three grand boards and the total when nobody played the missions: {cols}")
    check(pub_col(pg, "Total des trois") == [["Zoe", "215"], ["Damian", "116"], ["андре", "3"]], f"the public's total column: {pub_col(pg, 'Total des trois')}")
    check(pub_col(pg, "Damier 20 × 20") == [["Damian", "116"], ["Zoe", "101"]], f"and its 20 × 20 column: {pub_col(pg, 'Damier 20 × 20')}")
    check("08 h 12" in pg.inner_text("#stamp") and "mercredi 21 octobre" in pg.inner_text("#stamp"), f"the stamp says when, in Zurich time, from the server's clock: {pg.inner_text('#stamp')!r}")
    check("provisoires" in pg.inner_text("#prov").lower() and pg.locator("#sheet.final").count() == 0, "until the end, the results are provisional")
    check(pg.eval_on_selector("#prizes .cup", "e => getComputedStyle(e).opacity") == "0.5", "and the cups are pale")
    body = pg.inner_text("body")
    check("\u2014" not in body and "2025" not in body, "no em dash, no year 2025 on the sheet")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    # ---- the A3 page: nothing spills out of its box, nothing is cut, and the PDF is one A3 page ----
    ctx, pg, errs = phone_page(browser, size=(1588, 1123))
    open_sheet(pg)
    pg.emulate_media(media="print")
    pg.wait_for_timeout(200)
    spill = pg.evaluate("""() => {
      const out = [], sheet = document.getElementById('sheet').getBoundingClientRect();
      const inside = (el, box, what) => { const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        if (r.bottom > b.bottom + 0.6 || r.right > b.right + 0.6 || r.left < b.left - 0.6 || r.top < b.top - 0.6) out.push(what + ' ' + (el.textContent || '').trim().slice(0, 28)); };
      for (const el of document.querySelectorAll('header, #prizes, main, footer, #teams, #boards, #pub')) inside(el, document.getElementById('sheet'), 'section');
      for (const r of document.querySelectorAll('#teams .trow')) inside(r, document.getElementById('teams'), 'team row');
      for (const l of document.querySelectorAll('.box li, .box .empty')) inside(l, l.closest('.box'), 'board line');
      for (const c of document.querySelectorAll('#pubgrid .col')) inside(c, document.getElementById('pub'), 'public column');
      for (const c of document.querySelectorAll('.prize')) inside(c, document.getElementById('prizes'), 'prize');
      for (const e of document.querySelectorAll('.prize *')) inside(e, e.closest('.prize'), 'prize part');
      for (const e of document.querySelectorAll('#sheet *')) if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible' && e.children.length === 0 && e.clientWidth > 0 && !e.matches('svg *')) out.push('text wider than its box: ' + e.textContent.trim().slice(0, 28));
      return out;
    }""")
    check(spill == [], f"on the A3 page nothing spills out of its box: {spill[:6]}")
    cut = pg.evaluate("""() => [...document.querySelectorAll('#prizes .who, #prizes .rule, #prizes .how2, #teams .nm, #pubgrid .col b'), ...[...document.querySelectorAll('#prizes .prize')].filter(c => c.querySelector('.bd')).map(c => c.querySelector('.wn'))]
      .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 30))""")
    check(cut == [], f"and no title, rule or team name is cut short with an ellipsis: {cut[:6]}")
    check(abs(pg.evaluate("document.getElementById('sheet').getBoundingClientRect().width") - 1587.4) < 3, "the sheet is the width of an A3 landscape page")
    pdf = f"{OUT}/results.pdf"
    pg.emulate_media(media="screen")
    pg.pdf(path=pdf, width="420mm", height="297mm", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}, prefer_css_page_size=True)
    info = os.popen(f"pdfinfo '{pdf}'").read()
    pages = int(re.search(r"Pages:\s+(\d+)", info).group(1))
    w, h = map(float, re.search(r"Page size:\s+([\d.]+) x ([\d.]+)", info).groups())
    check(pages == 1 and abs(w - 1190.55) < 3 and abs(h - 841.89) < 3, f"the PDF is one A3 landscape page: {pages} page, {w} × {h} pt")
    pg.screenshot(path=f"{OUT}/sheet-screen.png")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    # ---- the end of the contest ----
    ctx, pg, errs = phone_page(browser)
    pg.clock.set_fixed_time("2026-10-22T20:00:00+02:00")
    open_sheet(pg)
    check(pg.locator("#sheet.final").count() == 1 and "finaux" in pg.inner_text("#prov").lower() and "terminé" in pg.inner_text("#open"), f"after Thursday 19:30 the sheet says final: {pg.inner_text('#prov')!r} · {pg.inner_text('#open')!r}")
    check(pg.inner_text("#teams .note").startswith("Classement final") and pg.eval_on_selector("#prizes .cup", "e => getComputedStyle(e).opacity") == "1", "the ranking is final and the cups are full")
    check(cards(pg)[1][2:] == ["Pentomino W", "208"], "and the prizes stand as they were")
    ctx.close()

    # ---- a public group that played a mission shows it ----
    ctx, pg, errs = phone_page(browser, public=PUBLIC + [row("Rue", "", "sq", 5, "21:20:00")])
    open_sheet(pg)
    cols = pg.eval_on_selector_all("#pubgrid .col b", "els => els.map(e => e.textContent)")
    check(cols == ["Damier 20 × 20", "Grille hexagones", "Grille triangles", "Total des trois", "Mission I"], f"a mission someone played gets its column, after the total: {cols}")
    check(cards(pg)[3][2:] == ["Zoe", "215"], "and a mission does not count in the total")
    ctx.close()

    # ---- the public group: the same total, a tie, and records with no pseudonym ----
    TIE = [row("Amy", "", "sq20", 50, "21:20:00"), row("Amy", "", "hex6", 40, "21:30:00"), row("Bob", "", "sq20", 45, "21:15:00"), row("Bob", "", "hex6", 45, "21:25:00"),
           row("", "", "sq20", 10, "21:40:00"), row("", "", "hex6", 10, "21:41:00")]
    ctx, pg, errs = phone_page(browser, public=TIE)
    open_sheet(pg)
    check(pub_col(pg, "Total des trois") == [["Bob", "90"], ["Amy", "90"], ["·", "10"]], f"two players on 90: Bob reached it first (his last fence is the earlier); two records with no pseudonym are two players, not one on 20: {pub_col(pg, 'Total des trois')}")
    check(cards(pg)[3][2:] == ["Bob", "90"] and cards(pg)[2][2:] == ["Amy", "50"], f"the prizes: the total to Bob, the 20 × 20 to Amy: {cards(pg)[2:]}")
    ctx.close()

    # ---- a name that is HTML wins a prize and is still only text ----
    HOST = [row('"><img src=x onerror=window.__z=1>', "", "sq20", 120, "21:00:00")]       # it closes a quote and a tag if nothing stops it
    ctx, pg, errs = phone_page(browser, public=HOST)
    open_sheet(pg)
    check(pg.evaluate("window.__z") is None and pg.locator("#prizes img, #pub img").count() == 0 and '"><img src=x onerror=window.__z=1>' in pg.inner_text("#prizes"), "a winner's name that is HTML is only text")
    check(pg.eval_on_selector_all("#prizes .prize", "els => els.map(c => c.getAttribute('aria-label'))")[2].startswith('Prix : Public du CIRM, Grand damier 20 × 20, "><img'), "also in the label read aloud, where a quote could break out of the attribute")
    ctx.close()

    # ---- nothing played yet ----
    ctx, pg, errs = phone_page(browser, fences=[], public=[], counts={})
    open_sheet(pg)
    check(pg.locator("#teams .trow:not(.head)").count() == 12 and set(pg.eval_on_selector_all("#teams .rk", "els => els.map(e => e.textContent)")) == {"–"}, "with no fence the twelve teams stand, unranked")
    check(pg.locator("#boards .empty").count() == 6, "and every board invites to play")
    check(pg.locator("#prizes .prize.none").count() == 4 and pg.inner_text("#prizes").count("à gagner") == 4, "and the four prizes are still to win")
    check(pg.locator("#teams .v.win").count() == 0, "with no leader marked")
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()

    # ---- the server does not answer ----
    ctx, pg, errs = phone_page(browser, fail=True)
    open_sheet(pg)
    check("indisponibles" in pg.inner_text("#stamp"), f"a server that does not answer is said so, not a crash: {pg.inner_text('#stamp')!r}")
    check(not [e for e in errs if "Failed to fetch" not in e], f"no script error {errs[:2]}")
    ctx.close()

    # ---- a phone ----
    ctx, pg, errs = phone_page(browser, size=(390, 844))
    open_sheet(pg)
    check(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "on a phone there is no sideways scroll")
    check(pg.locator("#teams .trow:not(.head)").count() == 12 and pg.locator("#boards .box").count() == 6, "and the teams and the six boards are all there")
    lay = pg.eval_on_selector_all("#prizes .prize", "els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; })")
    check(len(lay) == 4 and len({l[0] for l in lay}) == 1 and [l[1] for l in lay] == sorted(l[1] for l in lay) and all(l[2] > 300 for l in lay), f"the four prizes are one above the other, each as wide as the screen: {lay}")
    cut = pg.evaluate("() => [...document.querySelectorAll('#prizes .rule, #prizes .wn, #teams .nm')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 30))")
    check(cut == [], f"and nothing in them is cut: {cut[:4]}")
    pg.screenshot(path=f"{OUT}/sheet-phone.png", full_page=True)
    check(not errs, f"no console error {errs[:2]}")
    ctx.close()
    browser.close()

print(f"\nresults: {count - len(failures)}/{count} passed")
sys.exit(1 if failures else 0)

"""Layout check of the four 2026 labs and the hub of all the labs.

For each lab, viewport and state: no horizontal scroll, every visible control
is hit at its centre, no two controls overlap, an open math card stays inside
the viewport and its own controls are reachable (the card is modal: the
backdrop covers everything else on purpose). The limit-shape lab is also
checked at its tightest sizes (EXTRA): a 320 px phone, a phone held sideways,
and laptop widths where its top row is narrow.

Usage: python3 test/labs_layout.py <base-url> [outdir] [--webkit] [--lab=NAME] [--quick] [--run=N ...]
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else None
WEBKIT = "--webkit" in sys.argv
ONLY = [a.split("=",1)[1] for a in sys.argv if a.startswith("--lab=")]
QUICK = "--quick" in sys.argv
RUN = [int(a.split("=",1)[1]) for a in sys.argv if a.startswith("--run=")]   # only these runs (viewport + states) of each lab: to share a long check between processes
VIEWS = [(390, 664, True), (390, 844, True), (820, 1180, True), (1400, 900, False)]
LANGS = ["fr", "de", "en"]

# Each lab: list of (state name, js to reach it, wait ms).
STATES = {
    "hub": [("idle", "", 0)],
    "cube-lab": [("idle", "", 0),
                 ("penta-last-wall", "document.getElementById('mode-penta').click();"
                  "setTimeout(()=>{const w=[...document.querySelectorAll('#walls button')];w[w.length-1].click();},300)", 9000)],
    "hexomino-lab": [("idle", "", 0),
                     ("reveal", "document.getElementById('reveal').click()", 9000),
                     ("arrows", "document.getElementById('mode-arrows').click()", 800)],
    "limit-shape-lab": [("idle", "", 0),
                        ("n6", "limitLab.setN(6); setTimeout(()=>limitLab.pick(3), 300)", 1500),
                        ("n6-card", "limitLab.setN(6); setTimeout(()=>document.querySelector(\".math-chip[data-chip='polygon']\").click(), 500)", 2200),
                        ("n9", "limitLab.setN(9)", 1500),
                        ("n11-card", "limitLab.setN(11); setTimeout(()=>document.querySelector(\".math-chip[data-chip='polygon']\").click(), 500)", 2200),
                        ("n500", "limitLab.setN(500)", 4500)],
    "pentomino-dp-lab": [("idle", "", 0),
                         ("worst", "document.getElementById('dp-worst').click()", 14000)],
}
# Extra viewports for one lab, in some of its states: (views, state names).
EXTRA = {
    "limit-shape-lab": ([(320, 640, True), (667, 375, True), (960, 600, False), (1100, 700, False), (1366, 768, False)],
                        ("idle", "n6", "n6-card", "n11-card", "n500")),
}

CHECK = r"""
() => {
  const vw = innerWidth, vh = innerHeight;
  const sel = 'button, a[href], [role="link"], input, select, [tabindex="0"]';
  const vis = (el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' &&
      r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw && !el.closest('[hidden]');
  };
  const pop = document.querySelector('.math-pop:not([hidden])');
  const name = (el) => (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.split(' ').join('.') : el.tagName.toLowerCase()) + (el.dataset && (el.dataset.math || el.dataset.chip) ? '[' + (el.dataset.math || el.dataset.chip) + ']' : '');
  const issues = [];
  const se = document.scrollingElement;
  if (se.scrollWidth > vw + 1) issues.push('hscroll ' + se.scrollWidth + '>' + vw);
  let ctrls = [...document.querySelectorAll(sel)].filter(vis);
  ctrls = ctrls.filter((el) => !ctrls.some((o) => o !== el && o.contains(el)));
  if (pop) {
    const r = pop.getBoundingClientRect();
    if (r.left < 0 || r.top < 0 || r.right > vw + 0.5 || r.bottom > vh + 0.5) issues.push('card outside viewport');
    if (pop.scrollWidth > pop.clientWidth + 1) issues.push('card scrolls sideways by ' + (pop.scrollWidth - pop.clientWidth) + 'px');
    ctrls = ctrls.filter((el) => pop.contains(el));
  }
  // A control scrolled out of its own scroll box (a tray) is not covered; neither is the line of a wrapped pill that has gone out of it.
  const clippedAt = (el, cx, cy) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) {
        // what the box shows is inside its border
        const q = a.getBoundingClientRect(), l = q.left + a.clientLeft, t = q.top + a.clientTop;
        if (cx < l || cx > l + a.clientWidth || cy < t || cy > t + a.clientHeight) return true;
      }
    }
    return false;
  };
  const clipped = (el) => { const r = el.getBoundingClientRect(); return clippedAt(el, r.left + r.width / 2, r.top + r.height / 2); };
  // A page's bar stays while the page scrolls under it: what has gone under it is scrolled out of view, not covered.
  const bar = pop && pop.querySelector('.math-top.with-back');
  const underBar = (el) => { if (!bar || bar.contains(el)) return false; const r = el.getBoundingClientRect(); return r.top + r.height / 2 < bar.getBoundingClientRect().bottom; };
  ctrls = ctrls.filter((el) => !clipped(el) && !underBar(el));
  // A control that runs over two lines (a pill in a sentence) has one box per line: each is hit-tested on its own.
  const boxes = (el) => { const q = [...el.getClientRects()].filter((r) => r.width > 1 && r.height > 1); return q.length ? q : [el.getBoundingClientRect()]; };
  for (const el of ctrls) {
    for (const r of boxes(el)) {
      if (clippedAt(el, r.left + r.width / 2, r.top + r.height / 2)) continue;
      if (bar && !bar.contains(el) && r.top + r.height / 2 < bar.getBoundingClientRect().bottom) continue;   // this line has gone under the page's bar
      const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) issues.push('covered ' + name(el) + ' by ' + (hit ? name(hit) : 'null'));
      // a pill is a rectangle of text: its corners belong to it too, so that a tap near its edge never opens its neighbour
      if (el.classList.contains('paper-ref')) for (const [px, py] of [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]]) {
        if (px < 0 || py < 0 || px > vw - 1 || py > vh - 1) continue;
        const h2 = document.elementFromPoint(px, py);
        if (h2 && !(h2 === el || el.contains(h2)) && h2.closest('.paper-ref')) issues.push('edge of ' + name(el) + ' belongs to ' + name(h2.closest('.paper-ref')));
      }
      if (r.right > vw + 0.5 || r.left < -0.5) issues.push('outside ' + name(el));
    }
  }
  // What a scroll box shows is inside its border: a chip half scrolled out of a tray overlaps nothing beyond the tray.
  const shown = (el) => {
    const out = [];
    for (const r of boxes(el)) {
      let l = r.left, t = r.top, rt = r.right, bt = r.bottom;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) {
          const q = a.getBoundingClientRect();
          l = Math.max(l, q.left + a.clientLeft); t = Math.max(t, q.top + a.clientTop);
          rt = Math.min(rt, q.left + a.clientLeft + a.clientWidth); bt = Math.min(bt, q.top + a.clientTop + a.clientHeight);
        }
      }
      if (rt - l > 0 && bt - t > 0) out.push({ left: l, top: t, right: rt, bottom: bt });
    }
    return out;
  };
  const surface = (el) => el.tagName === 'CANVAS' || el.getAttribute('role') === 'img';
  for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
    if (surface(ctrls[i]) || surface(ctrls[j])) continue;
    let hit = false;
    for (const a of shown(ctrls[i])) for (const b of shown(ctrls[j])) {
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) hit = true;
    }
    if (hit) issues.push('overlap ' + name(ctrls[i]) + ' / ' + name(ctrls[j]));
  }
  return issues;
}
"""

def main():
    fails = []
    with sync_playwright() as p:
        eng = p.webkit if WEBKIT else p.chromium
        b = eng.launch(args=[] if WEBKIT else ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        views = [(390, 664, True)] if WEBKIT else VIEWS
        for lab, all_states in STATES.items():
            if ONLY and lab not in ONLY: continue
            runs = [(v, all_states) for v in views]
            if lab in EXTRA:
                runs += [(v, [s for s in all_states if s[0] in EXTRA[lab][1]]) for v in EXTRA[lab][0]]
            for ri, ((w, h, touch), states) in enumerate(runs):
                if RUN and ri not in RUN: continue
                for lang in (["en"] if QUICK else LANGS):
                    ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch and not WEBKIT,
                                        device_scale_factor=2 if touch else 1)
                    ctx.add_init_script("try{localStorage.setItem('fc-lang','%s')}catch(e){}" % lang)
                    for (st, js, wait) in states:
                        pg = ctx.new_page(); errs = []
                        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                        pg.goto(BASE + lab + "/?lang=" + lang, wait_until="networkidle")
                        pg.evaluate("()=>{const b=document.querySelector('[data-lang-btn=\"%s\"]'); if(b) b.click();}" % lang)
                        pg.wait_for_timeout(700)
                        if js:
                            pg.evaluate("()=>{" + js + "}")
                            pg.wait_for_timeout(wait)
                        tag = "%s %dx%d %s %s" % (lab, w, h, lang, st)
                        for i in pg.evaluate(CHECK): fails.append(tag + ": " + i)
                        for e in errs: fails.append(tag + ": pageerror " + e)
                        if OUT and lang == "en": pg.screenshot(path=os.path.join(OUT, "%s_%d_%s.png" % (lab, w * 10000 + h, st)))
                        chips = pg.evaluate("()=>[...document.querySelectorAll('.math-chip')].filter(c=>{const r=c.getBoundingClientRect();return r.width>2&&!c.closest('[hidden]')&&!c.hidden}).length")
                        for k in range(chips):
                            pg.evaluate("(k)=>{const c=[...document.querySelectorAll('.math-chip')].filter(c=>{const r=c.getBoundingClientRect();return r.width>2&&!c.closest('[hidden]')&&!c.hidden});c[k]&&c[k].click()}", k)
                            pg.wait_for_timeout(250)
                            for i in pg.evaluate(CHECK): fails.append(tag + " card%d: " % k + i)
                            if OUT and lang == "en" and k == 0: pg.screenshot(path=os.path.join(OUT, "%s_%d_%s_card.png" % (lab, w * 10000 + h, st)))
                            # Each pill of the card opens a page of the paper's reference in the same card: the same checks, then Back.
                            # the card is modal for the keyboard: Tab and Shift+Tab go round it and the language switch, never into the lab behind
                            for key in ["Tab"] * 8 + ["Shift+Tab"] * 8:
                                pg.keyboard.press(key)
                                where = pg.evaluate("() => { const a = document.activeElement; return !a ? 'none' : a === document.querySelector('.math-pop') ? 'pop' : a.closest('.math-pop') ? 'card' : a.closest('.langSel') ? 'lang' : 'OUT:' + a.tagName + (a.id ? '#' + a.id : ''); }")
                                if where.startswith("OUT"):
                                    fails.append(tag + " card%d: %s left the card for %s" % (k, key, where))
                                    break
                            keys = pg.evaluate("[...document.querySelectorAll('.math-pop .paper-ref')].slice(0, 6).map(e => e.dataset.ref)")
                            for q, key in enumerate(keys):
                                # a real click on the pill, hit-tested like a visitor's finger; the page it opens is the pill's own
                                try:
                                    pg.locator(".math-pop .paper-ref").nth(q).click(timeout=10000)   # (a loaded machine is slow to settle the card's slide-in)
                                except Exception:
                                    fails.append(tag + " card%d ref%d: a click on the pill %s does not reach it" % (k, q, key))
                                    pg.evaluate("(q)=>{const e=document.querySelectorAll('.math-pop .paper-ref')[q]; if (e) e.click();}", q)
                                pg.wait_for_timeout(200)
                                got = pg.evaluate("document.querySelector('.math-pop') && document.querySelector('.math-pop').dataset.refKey")
                                if got != key: fails.append(tag + " card%d ref%d: the pill %s opened %s" % (k, q, key, got))
                                for i in pg.evaluate(CHECK): fails.append(tag + " card%d ref%d: " % (k, q) + i)
                                if OUT and lang == "en" and k == 0 and q == 0: pg.screenshot(path=os.path.join(OUT, "%s_%d_%s_ref.png" % (lab, w * 10000 + h, st)))
                                pg.evaluate("()=>{const b=document.querySelector('.math-pop .math-back'); if (b) b.click();}")
                                pg.wait_for_timeout(120)
                            pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
                        pg.close()
                    ctx.close()
        b.close()
    for f in fails: print("FAIL", f)
    print("labs layout: %d issues" % len(fails))
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()

"""Layout check of the four 2026 labs.

For each lab, viewport and state: no horizontal scroll, every visible control
is hit at its centre, no two controls overlap, an open math card stays inside
the viewport and its own controls are reachable (the card is modal: the
backdrop covers everything else on purpose).

Usage: python3 test/labs_layout.py <base-url> [outdir] [--webkit] [--lab=NAME] [--quick]
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else None
WEBKIT = "--webkit" in sys.argv
ONLY = [a.split("=",1)[1] for a in sys.argv if a.startswith("--lab=")]
QUICK = "--quick" in sys.argv
VIEWS = [(390, 664, True), (390, 844, True), (820, 1180, True), (1400, 900, False)]
LANGS = ["fr", "de", "en"]

# Each lab: list of (state name, js to reach it, wait ms).
STATES = {
    "cube-lab": [("idle", "", 0),
                 ("penta-last-wall", "document.getElementById('mode-penta').click();"
                  "setTimeout(()=>{const w=[...document.querySelectorAll('#walls button')];w[w.length-1].click();},300)", 9000)],
    "hexomino-lab": [("idle", "", 0),
                     ("reveal", "document.getElementById('reveal').click()", 9000),
                     ("arrows", "document.getElementById('mode-arrows').click()", 800)],
    "limit-shape-lab": [("idle", "", 0),
                        ("n500", "for(let i=0;i<7;i++)document.getElementById('more').click()", 4500)],
    "pentomino-dp-lab": [("idle", "", 0),
                         ("worst", "document.getElementById('dp-worst').click()", 14000)],
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
    ctrls = ctrls.filter((el) => pop.contains(el));
  }
  // A control scrolled out of its own scroll box (a tray) is not covered.
  const clipped = (el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) {
        const q = a.getBoundingClientRect();
        if (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom) return true;
      }
    }
    return false;
  };
  ctrls = ctrls.filter((el) => !clipped(el));
  for (const el of ctrls) {
    const r = el.getBoundingClientRect();
    const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === el || el.contains(hit))) issues.push('covered ' + name(el) + ' by ' + (hit ? name(hit) : 'null'));
    if (r.right > vw + 0.5 || r.left < -0.5) issues.push('outside ' + name(el));
  }
  const surface = (el) => el.tagName === 'CANVAS' || el.getAttribute('role') === 'img';
  for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
    if (surface(ctrls[i]) || surface(ctrls[j])) continue;
    const a = ctrls[i].getBoundingClientRect(), b = ctrls[j].getBoundingClientRect();
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 1 && oy > 1) issues.push('overlap ' + name(ctrls[i]) + ' / ' + name(ctrls[j]));
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
        for lab, states in STATES.items():
            if ONLY and lab not in ONLY: continue
            for (w, h, touch) in views:
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
                            pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
                        pg.close()
                    ctx.close()
        b.close()
    for f in fails: print("FAIL", f)
    print("labs layout: %d issues" % len(fails))
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()

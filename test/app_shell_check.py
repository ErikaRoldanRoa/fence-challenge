#!/usr/bin/env python3
"""The site's service worker (sw.js) in Chromium, the repository served at /fence-challenge/ beside another site at /other/.
Checks, each with its negative control:
  1. it controls /fence-challenge/ and nothing else (a page at /other/ stays uncontrolled);
  2. another site's cache survives its activation, and its own old cache is removed;
  3. the hub opens offline once visited; a lab never visited does not;
  4. the live contest and feedback pages are never in its caches (cigales/version.txt);
  5. a new version takes over with no prompt and no tap.
Every page that registers it also links the manifest, whose start is the hub.

  python3 test/app_shell_check.py
"""
import functools
import http.server
import json
import shutil
import sys
import tempfile
import threading
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def serve(root):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def main():
    from playwright.sync_api import sync_playwright
    fails = []
    tmp = Path(tempfile.mkdtemp(prefix='fc-shell-'))
    site = tmp / 'fence-challenge'
    shutil.copytree(REPO, site, ignore=shutil.ignore_patterns('.git', 'node_modules', 'archive'))
    (tmp / 'other').mkdir()
    (tmp / 'other' / 'index.html').write_text('<!doctype html><title>other</title><p>other site</p>')
    srv = serve(tmp)
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context()
            pg = ctx.new_page()
            pg.goto(base + '/fence-challenge/hub/')
            pg.wait_for_timeout(500)
            pg.evaluate("navigator.serviceWorker.ready")
            pg.reload()
            pg.wait_for_function('!!navigator.serviceWorker.controller', timeout=15000)
            scope = pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r && r.scope)")
            if scope != base + '/fence-challenge/':
                fails.append(f'scope is /fence-challenge/ (got {scope})')
            man = pg.evaluate("document.querySelector('link[rel=manifest]') && document.querySelector('link[rel=manifest]').href")
            if not man:
                fails.append('the hub links the manifest')
            else:
                from urllib.parse import urljoin, urlparse
                m = json.loads((site / 'manifest.json').read_text())
                start = urlparse(urljoin(man, m['start_url'])).path
                if start != '/fence-challenge/hub/':
                    fails.append(f'the manifest starts on the hub (got {start})')
            other = ctx.new_page()
            other.goto(base + '/other/')
            other.wait_for_timeout(800)
            if other.evaluate('!!navigator.serviceWorker.controller'):
                fails.append('a page of another site stays uncontrolled')
            # 2. caches: plant another site's cache and an old one of ours, then activate a new version
            pg.evaluate("Promise.all([caches.open('other-site-v1'), caches.open('fence-challenge-old')])")
            sw = (site / 'sw.js').read_text()
            (site / 'sw.js').write_text(sw.replace("const VERSION = '", "const VERSION = 'next-", 1))
            pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
            ok = False
            for _ in range(40):
                keys = pg.evaluate('caches.keys()')
                if any(k.startswith('fence-challenge-next-') for k in keys) and 'fence-challenge-old' not in keys:
                    ok = True
                    break
                pg.wait_for_timeout(250)
            keys = pg.evaluate('caches.keys()')
            if not ok:
                fails.append(f'a new version takes over by itself and removes its own old cache (caches: {keys})')
            if 'other-site-v1' not in keys:
                fails.append("another site's cache survives")
            if pg.evaluate("document.querySelector('.sw-update, [data-sw-prompt]') !== null"):
                fails.append('no update prompt is shown')
            # 3 and 4: offline
            pg.goto(base + '/fence-challenge/cigales/version.txt')   # (the pages' CSP forbids an in-page fetch: navigations only)
            pg.wait_for_timeout(1000)                     # a worker that cached it would have done so by now
            pg.goto(base + '/fence-challenge/hub/')
            stored = pg.evaluate("""caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys()))))
                                     .then(all => all.flat().map(r => r.url).filter(u => u.includes('/cigales/')))""")
            if stored:
                fails.append(f'the contest pages are never cached by the worker (found {stored[:2]})')
            # offline for real: the server stops (Chromium's offline switch does not reach the service worker's own fetches)
            srv.shutdown(); srv.server_close()
            off = ctx.new_page()
            try:
                off.goto(base + '/fence-challenge/hub/', timeout=8000)
                if 'hub' not in (off.url or '') or off.evaluate('document.body.innerText.length') < 20:
                    fails.append('the hub opens offline once visited')
            except Exception:
                fails.append('the hub opens offline once visited')
            lab = ctx.new_page()
            try:
                r = lab.goto(base + '/fence-challenge/limit-shape-lab/', timeout=8000)
                if r and r.ok and 'limit' in lab.evaluate('document.title.toLowerCase()'):
                    fails.append('a lab never visited does not open offline (control)')
            except Exception:
                pass
            b.close()
    finally:
        try:
            srv.shutdown()
        except Exception:
            pass
        shutil.rmtree(tmp, ignore_errors=True)
    for f in fails:
        print('  FAIL:', f)
    print('app shell: ' + ('all checks pass' if not fails else f'{len(fails)} failed'))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())

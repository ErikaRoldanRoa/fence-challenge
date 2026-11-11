// Fence Challenge offline shell and quiet updates.
// Scope: /fence-challenge/ only (registered from each page with scope "<root>/"). Several sites share this origin, so the
// caches carry their own prefix and only those are ever deleted.
// Pages: network first (fresh when online), the cached copy after 3 s or offline. Files tagged ?v=: cache first (the tag is
// the version). Other files of the site: the cached copy at once, refreshed in the background.
// Never cached: other sites, anything but GET, the live contest and feedback pages (cigales/, retours/), test/, archive/,
// failed or opaque answers, answers marked no-store.
const VERSION = '2026-11-11a';
const PREFIX = 'fence-challenge-';
const CACHE = PREFIX + VERSION;
const ROOT = new URL('./', self.location).pathname;          // "/fence-challenge/"
const SHELL = [
  'hub/', 'hub/index.html', 'hub/hub.css?v=20261020c', 'hub/hub.js?v=20261019a', 'hub/i18n.js?v=20261020a',
  'i18n.js?v=20261111es', 'play-ui.css?v=20261019a', 'lab-tip.css?v=20261020c', 'lab-tip.js?v=20261020c',
  'fonts/manrope.css?v=20261019a', 'fonts/manrope-latin.woff2', 'favicon.svg', 'manifest.json',
];
const NEVER = ['cigales/', 'retours/', 'test/', 'archive/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(p => ROOT + p))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function cacheable(req, res) {
  return res && res.ok && res.type === 'basic' && !/no-store/i.test(res.headers.get('Cache-Control') || '');
}

function keep(req, res) {
  if (cacheable(req, res)) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return;
  const rel = url.pathname.slice(ROOT.length);
  if (NEVER.some(p => rel.startsWith(p))) return;

  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let done = false;
      // offline: the page as last seen; the site's root falls back to the hub, any other page never seen stays unavailable
      const fromCache = () => caches.match(req).then(r => r || (rel === '' || rel === 'index.html' ? caches.match(ROOT + 'hub/') : undefined));
      const timer = setTimeout(() => fromCache().then(r => { if (r && !done) { done = true; resolve(r); } }), 3000);
      fetch(req).then(res => { clearTimeout(timer); keep(req, res); if (!done) { done = true; resolve(res); } })
        .catch(() => { clearTimeout(timer); fromCache().then(r => { if (!done) { done = true; resolve(r || Response.error()); } }); });
    }));
    return;
  }
  if (url.searchParams.has('v')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(req, res))));
    return;
  }
  e.respondWith(caches.match(req).then(cached => {
    const fresh = fetch(req).then(res => keep(req, res)).catch(() => cached);
    return cached || fresh;
  }));
});

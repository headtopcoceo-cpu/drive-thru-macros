// Offline support: the app shell is cached on install; menu and deals data are network-first so weekly updates arrive.
const VERSION = 'dtm-2026-10-24h';
const SHELL = ['./', 'index.html', 'js/app.js', 'js/engine.js', 'js/store.js', 'js/pics.js', 'js/d3.min.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'data/menu.json', 'data/deals.json'];
const DATA = 'dtm-data', FONTS = 'dtm-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== DATA && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(url.pathname.replace(/^.*\/data\//, 'data/')))));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => { const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; })));
    return;
  }
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('index.html'))); return; }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
  }
});

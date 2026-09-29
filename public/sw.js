// Offline play: the page from the network when there is one (so updates arrive), hashed build
// files from the cache for ever, everything else from the cache while it refreshes behind.
const CACHE = 'purrcade-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/favicon-64.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== location.origin) return;
  const put = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then((res) => put('/', res)).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => put(r, res))));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => {
    const net = fetch(r).then((res) => put(r, res)).catch(() => hit);
    return hit || net;
  }));
});

// Pizza Damac service worker - intentionally minimal & safe.
// Caches ONLY small static images; the app itself always loads fresh from the
// network so deploys are never stuck on old cached versions.
const STATIC_CACHE = 'damac-static-v2';
const STATIC_ASSETS = ['/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  try {
    const url = new URL(e.request.url);
    if (e.request.method === 'GET' && url.origin === self.location.origin && STATIC_ASSETS.indexOf(url.pathname) !== -1) {
      e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    }
    // everything else falls through to the network untouched
  } catch (err) {}
});

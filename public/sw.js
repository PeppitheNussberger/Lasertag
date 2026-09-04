/*
 * The whole point of this file: once installed, the app opens and plays on the
 * field with zero reception, while still running on an https:// origin so the
 * camera (and therefore QR scanning) stays permitted.
 */
const CACHE = 'ctf-v2';
const SHELL = [
  '/', '/index.html', '/styles.css', '/app.js', '/game.js', '/i18n.js',
  '/vendor/jsQR.js', '/vendor/qrcode.js',
  '/flags.html', '/help.html',
  '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Never cache the sync layer - stale events would corrupt the game log.
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit || caches.match('/index.html'));
      // Cache-first keeps the field experience instant; the network copy
      // refreshes the cache in the background for next time.
      return hit || net;
    })
  );
});

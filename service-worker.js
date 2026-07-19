const CACHE_NAME = 'pol-in-one-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './rice-cor/index.html',
  './polspresso/index.html',
  './lista-spesa/index.html',
  './packlist/index.html',
  './fonts/fonts.css',
  './fonts/bebas-neue-latin-400-normal.woff2',
  './fonts/dm-sans-latin-300-normal.woff2',
  './fonts/dm-sans-latin-400-normal.woff2',
  './fonts/dm-sans-latin-400-italic.woff2',
  './fonts/dm-sans-latin-500-normal.woff2',
  './fonts/dm-sans-latin-600-normal.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// network-first per le pagine HTML (aggiornamenti subito se online),
// cache-first per il resto (font/icone, stabili)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.mode === 'navigate' || (req.destination === 'document')){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

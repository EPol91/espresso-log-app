const CACHE_NAME = 'pol-in-one-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './tracking-peso/index.html',
  './rice-cor/index.html',
  './polspresso/index.html',
  './lista-spesa/index.html',
  './packlist/index.html',
  './fonts/fonts.css',
  './fonts/playfair-display-latin-500-normal.woff2',
  './fonts/playfair-display-latin-600-normal.woff2',
  './fonts/playfair-display-latin-700-normal.woff2',
  './fonts/inter-latin-400-normal.woff2',
  './fonts/inter-latin-500-normal.woff2',
  './fonts/inter-latin-600-normal.woff2'
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

// Web Push (spinto dalla GitHub Action) → mostra notifica anche ad app chiusa
self.addEventListener('push', (e) => {
  let d = { title: 'Promemoria peso', body: 'Registra il peso di oggi' };
  try { if(e.data) d = Object.assign(d, e.data.json()); } catch(x){}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, tag: 'peso-now', data: { url: 'tracking-peso/index.html' },
    icon: './icon-192.png', badge: './icon-192.png',
    vibrate: [200, 100, 200], requireInteraction: true, renotify: true, silent: false
  }));
});

// Tap su una notifica → apre/porta in primo piano l'app (sul modulo giusto)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.focus(); if ('navigate' in w) { try { w.navigate(target); } catch (x) {} } return; }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

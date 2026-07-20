const CACHE_NAME = 'pol-in-one-v11';
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

// ===== IndexedDB minimale (il SW non può leggere localStorage) =====
function idbOpen(){
  return new Promise((res, rej) => {
    const r = indexedDB.open('pol_db', 1);
    r.onupgradeneeded = () => { if(!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbGet(key){
  return idbOpen().then(db => new Promise((res) => {
    const g = db.transaction('kv','readonly').objectStore('kv').get(key);
    g.onsuccess = () => res(g.result || null);
    g.onerror = () => res(null);
  })).catch(() => null);
}
function idbPut(key, val){
  return idbOpen().then(db => new Promise((res) => {
    const tx = db.transaction('kv','readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  })).catch(() => {});
}
function swTodayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Controllo promemoria peso quando il browser sveglia il SW (app chiusa)
async function checkPesoReminder(){
  const s = await idbGet('peso');
  if(!s || !s.enabled) return;
  const now = new Date(), p = (s.time || '07:30').split(':');
  const due = new Date(); due.setHours(+p[0], +p[1], 0, 0);
  if(now < due) return;
  const t = swTodayISO();
  if(s.lastEntryDate === t) return;      // già loggato oggi
  if(s.lastNotifiedDate === t) return;   // già notificato oggi
  await self.registration.showNotification('Promemoria peso', {
    body: 'Registra il peso di oggi', tag: 'peso-now',
    data: { url: 'tracking-peso/index.html' }, icon: './icon-192.png', badge: './icon-192.png'
  });
  try { if(self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge(1); } catch(e){}
  s.lastNotifiedDate = t;
  await idbPut('peso', s);
}
self.addEventListener('periodicsync', (e) => { if(e.tag === 'peso-check') e.waitUntil(checkPesoReminder()); });
self.addEventListener('sync', (e) => { if(e.tag === 'peso-check') e.waitUntil(checkPesoReminder()); });

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

// Service Worker נפרסטק - מאפשר עבודה במצב טיסה (אופליין)
// אסטרטגיה: רשת-קודם לדף עצמו (כדי לקבל עדכונים כשיש רשת) + נפילה למטמון כשאין רשת.
const CACHE = 'naparstek-v3';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  // לא מיירטים בקשות לדומיינים אחרים (Supabase, וכו') - שיזרמו כרגיל
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // רשת-קודם: מנסים רשת, מעדכנים מטמון; אם אין רשת - מגישים מהמטמון
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); return res; })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }
  // שאר בקשות GET מאותו מקור: מטמון-קודם
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => cached)
    )
  );
});

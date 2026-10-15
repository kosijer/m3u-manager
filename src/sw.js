/*
 * Service worker: aplikacija se otvara i bez interneta.
 * Build (vite.config.js) upisuje VERSION i PRECACHE (spisak fajlova ovog builda).
 * Streamovi, Worker za naziv pesme i upload slika idu direktno na mrežu.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = 'm3u-studio-' + VERSION;
const FONTS = 'm3u-studio-fonts';
// Skripte se traže sa Origin zaglavljem (crossorigin), a keširane su bez njega; Vary: Origin ne sme da ih razdvoji.
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE && key !== FONTS) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

/** Stranica: uvek sveža sa mreže (nova verzija odmah), a bez mreže iz keša. */
async function page(req) {
  try {
    return await fetch(req);
  } catch {
    return (await caches.match('./', MATCH)) || Response.error();
  }
}

/** Fajlovi aplikacije imaju hash u imenu, pa se iz keša ne menjaju. */
async function cacheFirst(req) {
  const hit = await caches.match(req, MATCH);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

/** Fontovi: odmah iz keša, a u pozadini se osvežavaju. */
async function fonts(req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  });
  return hit || update;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') e.respondWith(page(req));
  else if (url.origin === location.origin) e.respondWith(cacheFirst(req));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(fonts(req));
});

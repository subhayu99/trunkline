// Network-first service worker — keeps the app fresh on every load while
// providing offline fallback. Hashed Vite assets are cached on first hit so
// repeat loads stay fast; HTML / config.json / data.json are always fetched
// network-first so user changes (and new builds) propagate immediately.
const CACHE = "trunkline-v1";

self.addEventListener("install", (event) => {
  // Activate the new SW immediately on install so the cache version bumps.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add("./icon.svg").catch(() => null)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 1. Same-origin only — never proxy CDN / API requests.
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isFingerprinted = /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|svg|png|webp)$/.test(path);
  const isShellOrData = path === "/" || path.endsWith(".html")
    || path.endsWith("/config.json") || path.endsWith("/data.json");

  if (isFingerprinted) {
    // cache-first — the URL itself changes when the file changes (Vite hash)
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }))
    );
    return;
  }

  if (isShellOrData) {
    // network-first — fall back to cache only when offline.
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Anything else: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

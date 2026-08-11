// PulseBoard PWA — cache uniquement l'interface publique, jamais les données cliniques.
const CACHE_NAME = "pulseboard-online-v4";
const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-96.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Les appels serveur contiennent les données partagées : ils ne sont jamais mis en cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  // Seuls les fichiers d'interface versionnés peuvent être relus depuis le cache.
  if (url.pathname.startsWith("/assets/") || /\.(?:css|js|png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })),
    );
  }
});

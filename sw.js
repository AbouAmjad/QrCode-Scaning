// Increment when behavior changes to force a fresh service-worker install.
const CACHE = "toolcustody-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./results.html",
  "./dashboard.html",
  "./worker.html",
  "./tool.html",
  "./damage.html",
  "./consumables.html",
  "./receiving.html",
  "./repair.html",
  "./qr-labels.html",
  "./search.html",
  "./audit.html",
  "./reports.html",
  "./products.html",
  "./inventory.html",
  "./outstanding.html",
  "./requests.html",
  "./notifications.html",
  "./config.js",
  "./parser.js",
  "./ui.js",
  "./scan.js",
  "./app.css",
  "./manifest.json",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (event.request.method !== "GET") return;
  if (url.includes("script.google.com") || url.includes("googleapis.com") || url.includes("gstatic.com") || url.includes("jsdelivr.net")) {
    return;
  }
  // Never cache API responses. They are dynamic and include auth tokens in the URL.
  // Caching GET /api causes stale dashboards / people lists until the cache misses.
  try {
    const u = new URL(url);
    if (u.pathname.startsWith("/api")) return;
  } catch {
    // If URL parsing fails, fall back to network behavior (no caching).
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200 && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

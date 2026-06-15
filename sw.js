const CACHE = "toolcustody-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./results.html",
  "./dashboard.html",
  "./worker.html",
  "./tool.html",
  "./damage.html",
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

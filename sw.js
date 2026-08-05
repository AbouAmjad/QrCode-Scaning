// LIVE / no-cache service worker.
// This app must always show the latest ledger/audit/scan data.
// So we do NOT cache any GET responses at all.
//
// Note: Offline mode will not work by design.

self.addEventListener("install", (event) => {
  // Ensure the new SW takes control ASAP.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = req.url || "";

  // Let third-party CDNs behave normally.
  if (url.includes("script.google.com") || url.includes("googleapis.com") || url.includes("gstatic.com") || url.includes("jsdelivr.net")) {
    return;
  }

  // Always go to network; never serve cached data.
  event.respondWith(fetch(req));
});

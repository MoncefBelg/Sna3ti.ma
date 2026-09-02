/* =========================================================
   Sna3ti.ma Service Worker
   Cache-first for static assets, network-first for pages.
   ========================================================= */

const CACHE_NAME = "sna3ti-v1";
const STATIC_ASSETS = [
  "/",
  "/index-v3.html",
  "/manifest.json",
  "/assets/icon-192.svg",
  "/assets/icon-512.svg",
  "/assets/apple-touch-icon.svg"
];

/* ---- Install: pre-cache core shell ---- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ---- Activate: purge old caches ---- */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

/* ---- Fetch: network-first for HTML pages,
      cache-first for static assets ---- */
self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  /* Skip non-GET and cross-origin (CDN scripts, WhatsApp, etc.) */
  if (event.request.method !== "GET") return;
  if (url.origin !== location.origin) return;

  var isPage = event.request.mode === "navigate" ||
               event.request.headers.get("accept")?.includes("text/html");

  if (isPage) {
    /* Network-first: try the network, fall back to cache, then offline page */
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("/");
          });
        })
    );
  } else {
    /* Cache-first: serve from cache, update in background */
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) {
          /* Update cache in background */
          fetch(event.request).then(function (response) {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, response); });
            }
          }).catch(function () {});
          return cached;
        }
        return fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          }
          return response;
        });
      })
    );
  }
});

/* ---- Listen for skip-watching from the page ---- */
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

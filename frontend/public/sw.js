/**
 * SmartSoma Service Worker
 * Strategy:
 *   - App shell (JS/CSS/fonts): Cache-first
 *   - API calls (/api/*): Network-first with fallback to cache
 *   - Static materials (/static/materials/*): Cache-first (PDFs for offline study)
 */

const CACHE_NAME = "smartsoma-v1";
const API_CACHE  = "smartsoma-api-v1";

const APP_SHELL = [
  "/",
  "/student/dashboard",
  "/student/materials",
  "/student/progress",
  "/manifest.json",
];

// ── Install: pre-cache app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // API calls → Network-first, fall back to cached response
  if (url.pathname.startsWith("/api/")) {
    // Never cache authenticated API responses (prevents cross-user leakage on shared devices)
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static PDF materials → Cache-first (enables offline reading)
  if (url.pathname.startsWith("/static/materials/")) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Everything else → Cache-first (app shell, Next.js chunks)
  event.respondWith(cacheFirst(request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — content not cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

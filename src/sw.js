const CACHE = "timeleft-shell-__REVISION__";
const ASSETS = [
  "/",
  "/style.css",
  "/canvas.css",
  "/app.js",
  "/DeparturePixelZhCompact-d5eeaff4.woff2",
];
self.addEventListener(
  "install",
  (event) =>
    event.waitUntil(
      caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() =>
        self.skipWaiting()
      ),
    ),
);
self.addEventListener(
  "activate",
  (event) =>
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(
          names.filter((name) =>
            name.startsWith("timeleft-shell-") && name !== CACHE
          ).map((name) => caches.delete(name)),
        )
      ).then(() => self.clients.claim()),
    ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const key = request.mode === "navigate" && url.pathname === "/"
    ? "/"
    : url.pathname;
  if (!ASSETS.includes(key)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) return response;
    } catch { /* Use the last installed shell when offline. */ }
    return await (await caches.open(CACHE)).match(key) ??
      new Response(
        "TimeLeft 離線時無法使用。\nTimeLeft 离线时无法使用。\nTimeLeft is unavailable offline.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
  })());
});

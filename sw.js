/* Growth Gusto service worker: offline shell. Network-first for pages/js/css (updates arrive at once), cache fallback offline. Bump VERSION to drop old caches. */
const VERSION = "gg-v1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/base.css", "./css/compte.css", "./css/home.css", "./css/releve.css", "./css/labels.css", "./css/reception.css", "./css/stock.css", "./css/tickets.css", "./css/registre.css", "./css/notes.css", "./css/menage.css",
  "./js/core.js", "./js/compte.js", "./js/home.js", "./js/releve.js", "./js/labels.js", "./js/reception.js", "./js/stock.js", "./js/tickets.js", "./js/registre.js", "./js/notes.js", "./js/menage.js", "./js/main.js",
  "./vendor/qrcode.js", "./vendor/jsQR.js",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

const isFresh = (url, req) => req.mode === "navigate" || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(req, { cache: "no-cache", signal: ctrl.signal }); clearTimeout(t);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("./index.html") || await cache.match("./") : null);
    if (hit) return hit; throw err;
  }
}
async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(VERSION); const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {}); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    e.respondWith(isFresh(url, req) ? networkFirst(req) : staleWhileRevalidate(req, e));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req, e));
  }
});

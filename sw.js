/* Growth Gusto service worker: offline shell. Network-first, no-store, for pages/js/css/json (updates arrive at once), cache fallback offline. Bump VERSION to drop old caches. */
const VERSION = "gg-v5q";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/base.css", "./css/compte.css", "./css/abo.css", "./css/onboard.css", "./css/home.css", "./css/releve.css", "./css/labels.css", "./css/reception.css", "./css/stock.css", "./css/tickets.css", "./css/registre.css", "./css/notes.css", "./css/menage.css", "./css/finance.css", "./css/pennylane.css", "./css/oblig.css", "./css/rh.css", "./css/avis.css", "./css/auth.css", "./css/v2.css", "./css/tour.css", "./css/perms.css", "./css/perso.css", "./css/saisie.css", "./css/alertes.css", "./css/sondes.css", "./css/hygiene.css", "./css/caisse.css", "./css/import.css", "./css/resa.css", "./css/plan.css", "./css/marge.css", "./css/commande.css", "./css/controle.css", "./css/formation.css",
  "./js/config.js", "./js/core.js", "./js/icons.js", "./js/compte.js", "./js/abo.js", "./js/onboard.js", "./js/home.js", "./js/releve.js", "./js/labels.js", "./js/reception.js", "./js/stock.js", "./js/tickets.js", "./js/registre.js", "./js/notes.js", "./js/menage.js", "./js/finance.js", "./js/pennylane.js", "./js/oblig.js", "./js/rh.js", "./js/avis.js", "./js/auth.js", "./js/tour.js", "./js/perms.js", "./js/perso.js", "./js/saisie.js", "./js/alertes.js", "./js/sondes.js", "./js/hygiene.js", "./js/caisse.js", "./js/import.js", "./js/resa.js", "./js/plan.js", "./js/marge.js", "./js/commande.js", "./js/formation.js", "./js/controle.js", "./js/demo.js", "./js/main.js",
  "./css/achats.css", "./css/gaspi.css", "./js/achats.js", "./js/gaspi.js",
  "./vendor/qrcode.js", "./vendor/jsQR.js",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
/* the Firebase SDK (exact version in the URL, so a cached copy never goes stale): cached for offline launches in the kitchen */
const SDK = (url) => url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

const isFresh = (url, req) => req.mode === "navigate" || /\.(html|js|css|webmanifest|json)$/.test(url.pathname) || url.pathname.endsWith("/");

/* Network first, so a deploy shows on the next launch (no stale-asset trap). On a slow kitchen network the cached copy answers after
   2.5 s instead of making the launch wait; the network answer still refreshes the cache for next time. With no cached copy, wait for the network. */
async function networkFirst(req, e) {
  const cache = await caches.open(VERSION);
  if (self.navigator && navigator.onLine === false) { const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("./index.html") : null); if (hit) return hit; }
  /* no-store: skip the HTTP cache entirely (GitHub Pages sends max-age=600) */
  const net = fetch(req, { cache: "no-store" }).then((res) => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; });
  const cached = () => cache.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? cache.match("./index.html").then((h) => h || cache.match("./")) : null));
  e.waitUntil(net.catch(() => {}));
  return new Promise((resolve, reject) => {
    let done = false; const ok = (r) => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => cached().then(ok), 2500);
    net.then((r) => { clearTimeout(t); ok(r); }).catch((err) => { clearTimeout(t); cached().then((hit) => (hit ? ok(hit) : !done && reject(err))); });
  });
}
async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(VERSION); const hit = await cache.match(req);
  if (hit && self.navigator && navigator.onLine === false) return hit;
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {}); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    e.respondWith(isFresh(url, req) ? networkFirst(req, e) : staleWhileRevalidate(req, e));
  } else if (FONT_HOSTS.includes(url.hostname) || SDK(url)) {
    e.respondWith(staleWhileRevalidate(req, e));
  }
});

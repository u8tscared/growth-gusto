/* Growth Gusto service worker: offline shell. Network-first, no-store, for pages/js/css/json (updates arrive at once), cache fallback offline. Bump VERSION to drop old caches. */
const VERSION = "gg-v89";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/base.css", "./css/compte.css", "./css/abo.css", "./css/onboard.css", "./css/home.css", "./css/releve.css", "./css/labels.css", "./css/reception.css", "./css/stock.css", "./css/tickets.css", "./css/registre.css", "./css/notes.css", "./css/menage.css", "./css/finance.css", "./css/pennylane.css", "./css/oblig.css", "./css/rh.css", "./css/avis.css", "./css/auth.css", "./css/v2.css", "./css/tour.css", "./css/perms.css", "./css/perso.css", "./css/saisie.css", "./css/alertes.css", "./css/sondes.css", "./css/hygiene.css", "./css/caisse.css", "./css/import.css", "./css/resa.css", "./css/plan.css", "./css/resaimport.css", "./css/marge.css", "./css/commande.css", "./css/cmimport.css", "./css/controle.css", "./css/formation.css",
  "./js/config.js", "./js/core.js", "./js/lecons.js", "./js/parcours.js", "./css/parcours.css", "./js/icons.js", "./js/compte.js", "./js/abo.js", "./js/onboard.js", "./js/home.js", "./js/releve.js", "./js/labels.js", "./js/reception.js", "./js/stock.js", "./js/tickets.js", "./js/registre.js", "./js/notes.js", "./js/menage.js", "./js/finance.js", "./js/banque.js", "./js/pennylane.js", "./js/oblig.js", "./js/rh.js", "./js/avis.js", "./js/auth.js", "./js/tour.js", "./js/perms.js", "./js/perso.js", "./js/saisie.js", "./js/alertes.js", "./js/sondes.js", "./js/hygiene.js", "./js/caisse.js", "./js/import.js", "./js/resa.js", "./js/rzparse.js", "./js/resaimport.js", "./js/plan.js", "./js/marge.js", "./js/commande.js", "./js/cmimport.js", "./js/formation.js", "./js/controle.js", "./js/demo.js", "./js/main.js",
  "./css/achats.css", "./css/gaspi.css", "./js/achats.js", "./js/fournisseurs.js", "./css/fournisseurs.css", "./js/previsions.js", "./css/previsions.css", "./js/prix.js", "./css/prix.css", "./js/gaspi.js", "./css/salle.css", "./js/salle.js", "./css/clients.css", "./js/clients.js", "./css/consignes.css", "./js/consignes.js", "./css/rush.css", "./js/rush.js", "./css/livraison.css", "./js/livraison.js", "./css/multi.css", "./js/multi.js", "./css/frais.css", "./js/frais.js", "./css/intro.css", "./js/intro.js", "./css/grand.css", "./js/grand.js", "./css/espaces.css", "./js/espaces.js", "./css/verrou.css", "./js/verrou.js", "./css/bar.css", "./js/bar.js", "./css/recette.css", "./js/recette.js", "./css/sombre.css", "./js/theme.js", "./js/sombre-map.js", "./css/horsligne.css", "./js/horsligne.js", "./css/planif.css", "./js/planif.js", "./css/journee.css", "./js/journee.js", "./css/marques.css", "./js/marques.js",
  "./css/defis.css", "./js/defis.js", "./css/relais.css", "./js/relais.js", "./css/avisclients.css", "./js/avisclients.js", "./css/evenement.css", "./js/evenement.js", "./css/pourboires.css", "./js/pourboires.js",
  "./css/appel.css", "./css/ecran-client.css", "./js/appel.js",
  "./css/notifs.css", "./js/notifs.js", "./css/heuressup.css", "./js/heuressup.js",
  "./vendor/qrcode.js", "./vendor/jsQR.js",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
/* the Firebase SDK (exact version in the URL, so a cached copy never goes stale): cached for offline launches in the kitchen */
const SDK = (url) => url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");

/* offline launch must never miss a file: besides SHELL, every css/js that index.html links is cached too (a new module added to the page
   but forgotten here would otherwise break the first launch without network) */
async function pageAssets() {
  try {
    const html = await (await fetch("./index.html", { cache: "reload" })).text();
    return [...html.matchAll(/(?:src|href)="((?:js|css|vendor|icons)\/[^"?#]+)"/g)].map((m) => "./" + m[1]);
  } catch (e) { return []; }
}
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => { const all = [...new Set([...SHELL, ...(await pageAssets())])]; await Promise.all(all.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))); }).then(() => self.skipWaiting()));
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
    if (url.searchParams.has("ggping")) return; /* js/horsligne.js asks the real network whether it answers: never from the cache */
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    e.respondWith(isFresh(url, req) ? networkFirst(req, e) : staleWhileRevalidate(req, e));
  } else if (FONT_HOSTS.includes(url.hostname) || SDK(url)) {
    e.respondWith(staleWhileRevalidate(req, e));
  }
});

/* push (js/notifs.js, js/consignes.js; sent by functions/src/notifs.js and equipe.js): Firebase Cloud Messaging delivers a standard
   Web Push; we show it ourselves. Payload: { data: { title, body, url, tag, kind, at } } (FCM data message) or { notification: {…} }.
   App open and on screen (not Safari, which wants a notification for every push): the page shows it as a banner instead.
   Every push is kept in the cache « gg-pu-log » (last 30), read by the Notifications screen (« Reçues récemment »). */
async function puLog(n) {
  try { const c = await caches.open("gg-pu-log"); const r = await c.match("./__pu-log"); const L = r ? await r.json() : []; L.unshift(n); await c.put("./__pu-log", new Response(JSON.stringify(L.slice(0, 30)), { headers: { "content-type": "application/json" } })); } catch (e) {}
}
const isSafari = () => /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android|CriOS|Edg/.test(navigator.userAgent);
self.addEventListener("push", (e) => {
  let j = {}; try { j = e.data ? e.data.json() : {}; } catch (x) { j = { data: { body: e.data ? e.data.text() : "" } }; }
  const d = Object.assign({}, j.notification || {}, j.data || {});
  const title = d.title || "Growth Gusto";
  const url = d.url || "./#consignes";
  const n = { title, body: d.body || "", url, kind: d.kind || "", at: Date.now() };
  const opt = { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag || "gg", renotify: true, data: { url } };
  e.waitUntil((async () => {
    await puLog(n);
    if (!isSafari()) {
      const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const vis = cs.find((c) => c.visibilityState === "visible" && c.url.startsWith(self.registration.scope));
      if (vis && d.kind) { vis.postMessage({ gg: "notif", n }); return; }
    }
    await self.registration.showNotification(title, opt);
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#consignes", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ gg: "open", url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

/* Growth Gusto — area: appel serveur (menu QR → serveur) + écran client (route « ecran »). Prefix « ap ».
   - Appel serveur : depuis le menu QR de sa table (commande/), le client appelle le serveur, demande l'addition (et comment il règle),
     de l'eau ou du pain. Le serveur l'entend sur tous ses écrans (bulle en haut, carillon, vibration, alerte), la table sonne sur le plan
     de salle, « J'y vais » dit au client qui arrive, « C'est fait » ferme la demande. Libérer la table ferme ses demandes d'addition.
   - Écran client : une tablette tournée vers le client (comptoir, caisse, ou posée sur la table). Au repos : le logo, l'heure, le QR de la
     carte et celui des avis Google. Quand le serveur touche « Montrer sur l'écran client » dans l'addition : les plats, le total, la part
     de chacun, un QR pour payer avec son téléphone (Stripe, sur le compte du restaurant) et un QR pour laisser un avis. Payé : « Merci ! ».
     Toujours pas d'encaissement dans l'app (NF525) : un paiement en ligne se saisit sur la caisse comme « CB en ligne ».
     Mode d'appareil « Écran client » (js/espaces.js ES_ST) : verrouillé, en grand écran, sans menus.
   Data (members read/write unless said):
     restos/{rid}/tableCalls/t{table}-{kind}  written by the server (functions/src/commande.js op "call"): { table, kind, pay, at, again?, n, day,
                                              status: new → vu (« J'y vais » : seenAt, by, byName) → fait (doneAt) | annule, k }
     restos/{rid}/ecran/{screenId}            { name, seenAt, show: "idle"|"bill"|"merci", tabId, table, split, at, by, byName }
     restos/{rid}/salleTabs/{id}.payKey       32 hex, set when the bill is shown: the key of the customer's pay link (?r&b=tab&k=key)
     restos/{rid}/billPays/{id}               server only (members read): { tabId, table, amount, status: apayer|paye|abandonnee, at, paidAt } */
"use strict";

TAB_OF.ecran = "more";
(function apNav() {
  if (NAV.some((n) => n[0] === "ecran")) return;
  const i = NAV.findIndex((n) => n[0] === "cuisine");
  NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["ecran", "apScreen", "Écran client"]);
})();
/* leçon de la Prise en main (js/lecons.js, vérifiée par tools/lecons-test.js) */
if (typeof PC_LECONS === "object") PC_LECONS.ecran = { t: "Écran client", d: "Une tablette tournée vers le client : son addition, un QR pour payer avec son téléphone et un autre pour laisser un avis Google.", who: ["salle", "bar", "boss"],
  steps: ["Faites d'une tablette l'écran client (Vues & appareils)", "Sur l'addition d'une table, touchez « Montrer sur l'écran client »", "Le client scanne et paie sa part, le serveur est prévenu"],
  q: ["Le client a payé en ligne sur l'écran client. Que faites-vous à la caisse ?", ["Je le saisis en « CB en ligne »", "Rien, la caisse le sait déjà", "Je l'encaisse une deuxième fois"], 0],
  tip: "L'écran reste verrouillé : seul le code du gérant permet d'en sortir.",
  sc: { k: "ticket", t: "Table 5 · 2 couverts", lines: [["Burrata", "12,00 €"], ["Filet de bar", "24,00 €"]], total: "36,00 €" } };
try { if (typeof PC_FAMILLES === "object") { const f = PC_FAMILLES.find((x) => x[0] === "commande"); if (f && !f[4].includes("ecran")) f[4].push("ecran"); } } catch (e) {}
try { if (typeof AB_GATE !== "undefined") AB_GATE.ecran = ["pro", "Écran client"]; } catch (e) {}
try { if (typeof BIG_ROUTES !== "undefined" && !BIG_ROUTES.includes("ecran")) BIG_ROUTES.push("ecran"); } catch (e) {}
Object.assign(IC, {
  apScreen: ["r:2.5,4,19,13,2.5", "M8.5 21h7", "M12 17v4", "M7 9.5h5", "M7 12.5h3", "r:14,8,4,4,.8", "f:M2.5 6.5a2.5 2.5 0 0 1 2.5-2.5h14a2.5 2.5 0 0 1 2.5 2.5V17h-19z"],
  apBell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0", "f:M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"],
  apDrop: ["M12 2.7s6 6.3 6 11.3a6 6 0 0 1-12 0c0-5 6-11.3 6-11.3Z", "f:M12 2.7s6 6.3 6 11.3a6 6 0 0 1-12 0c0-5 6-11.3 6-11.3z"],
  apBread: ["M5 11a3.5 3.5 0 0 1 1-6.8C8 3 10 3 12 3s4 0 6 1.2A3.5 3.5 0 0 1 19 11v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z", "M9 11v6", "M15 11v6"],
  apWalk: ["c:13,4,1.8", "M9 21l2.2-6.5L14 17v4", "M7 12.5l2.5-4 4 .8 2 3.2 2.5 1", "M11.2 14.5 12.5 9.3"],
  apStar: ["m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9Z", "f:m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"],
  apPhone: ["r:6.5,2.5,11,19,2.5", "M10.5 18.5h3"],
});

/* the device mode « Écran client » (js/espaces.js): locked on this screen, grand écran, no menus */
try {
  if (typeof ES_ST !== "undefined" && !ES_ST.client) {
    ES_ST.client = { ic: "apScreen", t: "Écran client", dev: "Tablette tournée vers le client", route: "ecran", kiosk: true, mk: "cl",
      d: "L'addition, le QR pour payer et celui des avis, face au client.",
      sees: ["Au repos : votre logo, la carte et vos avis Google en QR code", "L'addition quand le serveur l'envoie, avec la part de chacun", "Un QR pour payer avec son téléphone, puis « Merci ! »"],
      hides: ["Le menu, la barre d'onglets et tout le reste de l'app"], exit: "le cadenas en bas de l'écran, puis le code du gérant" };
    const i = ES_ST_ORDER.indexOf("cuisine"); ES_ST_ORDER.splice(i >= 0 ? i + 1 : ES_ST_ORDER.length, 0, "client");
    if (typeof ES_DEVICES !== "undefined") { const j = ES_DEVICES.findIndex((x) => x[0] === "cuisine"); ES_DEVICES.splice(j >= 0 ? j + 1 : ES_DEVICES.length, 0, ["client", "apScreen", ES_ST.client.dev, ES_ST.client.d]); }
    ["salle", "bar"].forEach((p) => { const P = ES_POSTES[p]; if (P && !P.tools.includes("ecran")) P.tools.splice(Math.max(0, P.tools.indexOf("cuisine")) + 1, 0, "ecran"); });
  }
  if (typeof esMock === "function") {
    const m0 = esMock;
    esMock = function (k) {
      if (k === "cl") return `<span class="es-mk sc cl"><span class="mk-main"><span class="mk-bill"><i></i><i></i><i></i><b></b></span><span class="mk-qr"><i></i></span></span></span>`;
      return m0(k);
    };
  }
} catch (e) { console.warn("appel: modes", e); }

/* ───────── state ───────── */
const AP_KIND = { serveur: ["Appelle le serveur", "apBell"], addition: ["Demande l'addition", "slBill"], eau: ["Demande de l'eau", "apDrop"], pain: ["Demande du pain", "apBread"] };
const AP_PAY = { carte: "Carte", especes: "Espèces", titre: "Titre-resto" };
const AP = { rid: null, calls: null, seen: new Map(), init: false, scrs: null, pays: null, paySeen: new Set(), payInit: false, flash: null, beat: 0, demoT: 0, demoN: 0, tick: 0, slide: 0, sel: null };
const apEur = (v) => (typeof cmEur === "function" ? cmEur(v) : (Math.round((+v || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €");
const apAgo = (at) => { const m = Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 6e4)); return m < 1 ? "à l'instant" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
const apMe = () => (typeof esActorName === "function" && esShared && esShared() && esActorName()) || (S.me && S.me.name) || "";
const apKey = () => { const a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); };

function apWatch() {
  if (!S.rid || AP.rid === S.rid) return;
  AP.rid = S.rid; AP.calls = null; AP.seen = new Map(); AP.init = false; AP.scrs = null; AP.pays = null; AP.paySeen = new Set(); AP.payInit = false;
  const rid = S.rid;
  if (DB.mode === "demo") apSeedDemo();
  DB.watch("tableCalls", { order: "at", dir: "desc", limit: 60 }, (rows) => { if (S.rid !== rid) return; AP.calls = rows; apOnCalls(); });
  DB.watch("ecran", { limit: 12 }, (rows) => { if (S.rid !== rid) return; AP.scrs = rows; onData(); });
  DB.watch("billPays", { order: "at", dir: "desc", limit: 80 }, (rows) => { if (S.rid !== rid) return; AP.pays = rows; apOnPays(); });
}
/* the waiter's screens watch the calls with the tables (js/salle.js slWatch) */
if (typeof slWatch === "function") { const w0 = slWatch; slWatch = function () { const r = w0.apply(this, arguments); try { apWatch(); } catch (e) { console.warn("appel", e); } return r; }; }

/* ───────── the calls ───────── */
const apLive = () => (AP.calls || []).filter((c) => ["new", "vu"].includes(c.status) && Date.now() - (c.again || c.at || 0) < 3 * 3600e3)
  .sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1) || (a.at || 0) - (b.at || 0));
const apLabel = (c) => { const k = AP_KIND[c.kind] || AP_KIND.serveur; return k[0] + (c.kind === "addition" && AP_PAY[c.pay] ? ` · ${AP_PAY[c.pay].toLowerCase()}` : ""); };
/* quiet where it makes no sense: the customer screen, the kitchen screen, a kiosk */
const apQuiet = () => S.route === "ecran" || S.route === "cuisine" || (typeof esKioskOn === "function" && esKioskOn()) || (typeof window.evLiveOn === "function" && window.evLiveOn()); /* the event till (js/evenement.js) never rings for the restaurant */
function apOnCalls() {
  apLive().forEach((c) => {
    const k = c.status + "|" + (c.n || 1), p = AP.seen.get(c.id); AP.seen.set(c.id, k);
    if (AP.init && c.status === "new" && p !== k) apRing(c);
  });
  AP.init = true; apPill(); onData();
}
function apRing(c) {
  if (apQuiet()) return;
  try { SFX.init(); [[1568, 0], [1175, 0.2], [1568, 0.55], [1175, 0.75]].forEach(([f, at]) => SFX.tone(f, 0.38, "sine", 0.05, at)); buzz([40, 60, 40, 60, 40]); } catch (e) {}
  toast(`Table ${c.table} · ${apLabel(c)}`, "info");
  try { if (window.ALERTES && typeof window.ALERTES.push === "function") window.ALERTES.push({ type: "service", key: `apcall_${c.id}_${c.n || 1}`, level: "warn", text: `Table ${c.table} · ${apLabel(c)}`, sub: "Depuis le QR code de la table", day: c.day || dayKey(), route: "salle" }); } catch (e) {}
  const p = document.getElementById("apPill"); if (p) { p.classList.remove("wig"); void p.offsetWidth; p.classList.add("wig"); setTimeout(() => p.classList.remove("wig"), 1000); }
}
/* the open tab sitting at a table number (« 8+9 » joined tables included) */
const apTabAt = (n) => (typeof slOpenTabs === "function" ? slOpenTabs() : []).find((t) => String(t.table) === String(n) || String(t.table || "").split("+").includes(String(n))) || null;

/* a floating bubble on every staff screen: who calls, from which table.
   It can be pushed away (× or a swipe): it stays hidden on this device until a table calls again or calls back (relance).
   The call itself is not closed: it stays in « Les tables vous appellent » and on the floor plan. */
const apHidKey = (c) => `${c.id}|${c.n || 1}`;
function apHid() { if (!AP.hid) { try { AP.hid = new Set(JSON.parse(localStorage.getItem("gg-ap-hid") || "[]")); } catch (e) { AP.hid = new Set(); } } return AP.hid; }
function apHide(L) {
  const H = apHid(); L.forEach((c) => H.add(apHidKey(c)));
  const live = new Set((AP.calls || []).map(apHidKey)); [...H].forEach((k) => { if (!live.has(k)) H.delete(k); });
  try { localStorage.setItem("gg-ap-hid", JSON.stringify([...H].slice(-60))); } catch (e) {}
}
function apPillOff() {
  apHide(apLive()); const el = document.getElementById("apPill"); if (el) el.classList.remove("on");
  toast("Masqué sur cet appareil. L'appel reste dans Prise de commande.", "info");
}
function apPill() {
  let el = document.getElementById("apPill");
  const L = apLive().filter((c) => !apHid().has(apHidKey(c))), hide = !L.length || apQuiet() || !S.resto || (S.route === "salle" && !(S.params && S.params.id));
  if (hide) { if (el) { el.classList.remove("on"); } return; }
  if (!el) {
    el = document.createElement("div"); el.id = "apPill"; el.className = "ap-pill"; document.body.appendChild(el);
    swipeAway(el, () => { apPillOff(); el.style.translate = ""; el.style.opacity = ""; });
  }
  const c = L[0], nw = L.filter((x) => x.status === "new").length, k = AP_KIND[c.kind] || AP_KIND.serveur;
  el.classList.toggle("vu", !nw);
  el.innerHTML = `<button class="ap-po" data-act="apSheet" aria-label="${L.length} demande${L.length > 1 ? "s" : ""} des tables. Voir"><span class="ap-pi">${ico(k[1])}</span><span class="ap-pt"><b>Table ${esc(c.table)}</b><em>${esc(apLabel(c))}${c.status === "vu" && c.byName ? ` · ${esc(firstName(c.byName))} y va` : ` · <span data-apago="${c.again || c.at}">${apAgo(c.again || c.at)}</span>`}</em></span>${L.length > 1 ? `<span class="ap-pn mono">+${L.length - 1}</span>` : ""}</button><button class="ap-px" data-act="apPillX" data-noswipe aria-label="Masquer">${ico("x")}</button>`;
  requestAnimationFrame(() => el.classList.add("on"));
}
{ const rc0 = renderChrome; renderChrome = function () { const r = rc0.apply(this, arguments); try { apPill(); } catch (e) {} return r; }; }
setInterval(() => { document.querySelectorAll("[data-apago]").forEach((e) => { e.textContent = apAgo(+e.dataset.apago); }); }, 20000);

function apCallCard(c, i) {
  const k = AP_KIND[c.kind] || AP_KIND.serveur, tab = apTabAt(c.table);
  return `<div class="ap-cc ${c.status} st" style="--i:${i}"><span class="ap-ct mono">${esc(c.table)}</span>
    <div class="ap-cx"><b>${ico(k[1])}${esc(k[0])}</b><em>${c.kind === "addition" && AP_PAY[c.pay] ? `Règle en ${esc(AP_PAY[c.pay].toLowerCase())} · ` : ""}${c.status === "vu" ? `${c.byName ? esc(firstName(c.byName)) + " y va" : "Pris en charge"}` : `<span data-apago="${c.again || c.at}">${apAgo(c.again || c.at)}</span>`}${(c.n || 1) > 1 ? ` · relancé ${c.n - 1 > 1 ? `${c.n - 1} fois` : ""}`.trimEnd() : ""}</em></div>
    <div class="ap-cb">${c.kind === "addition" && tab ? `<button class="btn soft sm" data-act="apBill" data-id="${esc(c.id)}">${ico("slBill")}Addition</button>` : tab ? `<button class="btn ghost sm" data-act="apTable" data-id="${esc(c.id)}">Table</button>` : ""}
      ${c.status === "new" ? `<button class="btn acc sm" data-act="apGo" data-id="${esc(c.id)}">${ico("apWalk")}J'y vais</button>` : `<button class="btn acc sm" data-act="apDone" data-id="${esc(c.id)}">${ico("check")}Fait</button>`}</div></div>`;
}
function apSheetPaint() {
  const L = apLive();
  if (!L.length) { closeSheet(); return; }
  const html = `<div class="ap-sh"><div class="sl-shh"><span class="h2">Les tables vous appellent</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Depuis le QR code de leur table. « J'y vais » prévient le client que vous arrivez.</p>
    <div class="ap-ccs">${L.map(apCallCard).join("")}</div></div>`;
  const cur = document.querySelector(".ap-sh"); if (cur && document.getElementById("sheet").classList.contains("open")) cur.outerHTML = html; else openSheet(html);
}
/* the floor of « Prise de commande »: a strip of calls on top, and the tables that call ring on the plan */
if (typeof slFloor === "function") {
  const f0 = slFloor;
  slFloor = function () {
    const h = f0.apply(this, arguments), L = apLive(); if (!L.length) return h;
    const strip = `<div class="ap-strip st" style="--i:1"><div class="ap-sh-h">${ico("apBell")}<b>${L.length} table${L.length > 1 ? "s" : ""} vous appelle${L.length > 1 ? "nt" : ""}</b></div><div class="ap-ccs ap-row">${L.map(apCallCard).join("")}</div></div>`;
    const i = h.indexOf('<div class="sl-kpi'); return i < 0 ? h : h.slice(0, i) + strip + h.slice(i);
  };
}
if (VIEWS.salle) {
  const a0 = VIEWS.salle.after;
  VIEWS.salle.after = function (v) {
    const r = a0 ? a0.apply(this, arguments) : undefined;
    try {
      const L = apLive(); if (!L.length || typeof slTables !== "function") return r;
      const T = slTables().T;
      L.forEach((c) => T.filter((t) => String(t.n) === String(c.table)).forEach((t) => {
        v.querySelectorAll(`[data-act="slTable"][data-id="${CSS.escape(t.id)}"]`).forEach((el) => { el.classList.add("ap-ring", "k-" + c.kind); if (el.tagName === "BUTTON" && !el.querySelector(".ap-bdg")) el.insertAdjacentHTML("beforeend", `<i class="ap-bdg">${ico((AP_KIND[c.kind] || AP_KIND.serveur)[1])}</i>`); });
      }));
      L.forEach((c) => { const tab = apTabAt(c.table); if (tab) v.querySelectorAll(`.sl-or[data-id="${CSS.escape(tab.id)}"]`).forEach((el) => el.classList.add("ap-ring")); });
    } catch (e) { console.warn("appel", e); }
    return r;
  };
}
async function apSetCall(id, patch) { await safe(DB.update("tableCalls", id, patch)); }
/* closing a table answers its bill requests */
function apAutoDone(table) {
  (AP.calls || []).filter((c) => ["new", "vu"].includes(c.status) && String(c.table) === String(table) && c.kind === "addition")
    .forEach((c) => DB.update("tableCalls", c.id, { status: "fait", doneAt: Date.now(), by: S.me.id, byName: apMe() }).catch(() => {}));
}

/* ───────── customer screen: which screen, what it shows ───────── */
const apScrId = () => { if (DB.mode === "demo") return "demo"; try { return localStorage.getItem("gg-ecran-id") || "main"; } catch (e) { return "main"; } };
const apScr = (id = apScrId()) => (AP.scrs || []).find((s) => s.id === id) || { id, name: "Écran client", show: "idle" };
/* the screens on in the last 24 h (the waiter picks one when there are several) */
const apScreens = () => (AP.scrs || []).filter((s) => DB.mode !== "db" || Date.now() - (s.seenAt || s.at || 0) < 24 * 3600e3);
const apPaysOf = (tabId) => (AP.pays || []).filter((p) => p.tabId === tabId && p.status === "paye");
const apPaidOf = (tabId) => Math.round(apPaysOf(tabId).reduce((a, p) => a + (+p.amount || 0), 0) * 100) / 100;
const apOnline = () => DB.mode === "demo" || !!(typeof cmCfg === "function" && cmCfg().payOnline && typeof CM !== "undefined" && CM.link && CM.link.charges);
const apReview = () => (typeof rsGoogleUrl === "function" && typeof rsCfg === "function" ? rsGoogleUrl(rsCfg().googleReview) : "") || "";
function apPayUrl(tab, scr) {
  const base = typeof cmBase === "function" ? cmBase() : "https://app.growthgusto.fr/commande/";
  if (DB.mode === "demo") return `${base}?r=demo&b=demo&k=${"0".repeat(32)}${scr && scr.split > 1 ? `&n=${scr.split}` : ""}`;
  return `${base}?r=${encodeURIComponent(S.rid)}&b=${encodeURIComponent(tab.id)}&k=${tab.payKey || ""}${scr && scr.split > 1 ? `&n=${scr.split}` : ""}`;
}
/* what the screen shows now: the bill (until it is paid or the table is closed), « merci » for 90 s, else the welcome */
function apState(scr) {
  const now = Date.now();
  if (scr.show === "bill" && scr.tabId) {
    const tab = typeof slTabOf === "function" ? slTabOf(scr.tabId) : null;
    if (tab && tab.status === "open") {
      /* paid = online (billPays) + noted by the team dish by dish (salleTabs.parts, js/salle.js) */
      const items = slItemsOk(tab), total = slTotal(items), paid = typeof slPaidAll === "function" ? slPaidAll(tab) : apPaidOf(tab.id), left = Math.max(0, Math.round((total - paid) * 100) / 100);
      if (total > 0 && left <= 0.004) return { k: "merci", tab, paid, at: Math.max(0, ...apPaysOf(tab.id).map((p) => p.paidAt || p.at || 0), ...(tab.parts || []).map((p) => p.at || 0)) };
      return { k: "bill", tab, items, total, paid, left };
    }
    if (tab && now - (tab.closedAt || scr.at || 0) < 90e3) return { k: "merci", tab, paid: apPaidOf(tab.id), at: tab.closedAt || scr.at };
    if (!tab && SL.tabs == null) return { k: "wait" };
  }
  if (scr.show === "merci" && now - (scr.at || 0) < 90e3) return { k: "merci", at: scr.at };
  return { k: "idle" };
}
const apLogo = () => (typeof cmLogo === "function" ? cmLogo() : "");
const apQr = (url) => (typeof qrSvg === "function" && url ? qrSvg(url) : "");
function apIdle() {
  const name = (S.resto && S.resto.name) || "Bienvenue", lg = apLogo(), rv = apReview(), menu = typeof cmUrl === "function" ? cmUrl("") : "";
  const d = new Date(), h = d.getHours();
  return `<div class="ap-d idle">
    <div class="ap-idh">${lg ? `<span class="ap-lg"><img src="${esc(lg)}" alt=""></span>` : `<span class="ap-lg ini">${esc(typeof restoIni === "function" ? restoIni(name) : name.slice(0, 2))}</span>`}
      <div><span class="ap-k">${h < 11 ? "Bonjour" : h < 17 ? "Bon appétit" : "Bonsoir"}, bienvenue chez</span><h1>${esc(name)}</h1></div><span class="ap-clock mono" data-apclock>${pad(h)}:${pad(d.getMinutes())}</span></div>
    <p class="ap-tag">${esc((typeof cmCfg === "function" && cmCfg().msg) || "Installez-vous, on s'occupe de tout.")}</p>
    <div class="ap-qrs">
      ${menu ? `<div class="ap-qc"><div class="ap-qr">${apQr(menu)}</div><div><b>La carte sur votre téléphone</b><em>Les plats, les allergènes, et le serveur en un geste.</em></div></div>` : ""}
      ${rv ? `<div class="ap-qc rv"><div class="ap-qr">${apQr(rv)}</div><div><b>Vous avez aimé ?</b><em>Un avis Google nous aide énormément.</em><span class="ap-stars">${[0, 1, 2, 3, 4].map((i) => `<i style="--s:${i}">${ico("apStar")}</i>`).join("")}</span></div></div>` : ""}
    </div></div>`;
}
function apBillD(st, scr) {
  const { tab, total, paid, left } = st;
  /* the same rows as the waiter's bill: a dish someone already paid is ticked, the rest is what is left */
  const R = slBillRows(tab), rows = [...R.rows, ...R.free], split = +scr.split > 1 ? +scr.split : 0, part = split ? Math.ceil((total / split) * 100) / 100 : 0;
  const online = apOnline(), rv = apReview(), cov = +tab.covers || 0;
  const pay = online ? `<div class="ap-pay"><span class="ap-k">${ico("apPhone")}Payer avec votre téléphone</span><div class="ap-qr big">${apQr(apPayUrl(tab, scr))}</div>
      <p>Scannez, choisissez vos plats ou payez tout : Apple Pay, Google Pay ou carte.</p></div>`
    : `<div class="ap-pay off"><span class="ap-k">${ico("cmCard")}Votre serveur arrive</span><p class="ap-big">Carte, espèces ou titre-restaurant</p></div>`;
  return `<div class="ap-d bill">
    <div class="ap-bl"><div class="ap-bh"><span class="ap-k">Votre addition</span><h1>Table ${esc(tab.table)}</h1>${cov ? `<em>${cov} couvert${cov > 1 ? "s" : ""}</em>` : ""}</div>
      <div class="ap-lines">${rows.map((a, i) => `<div class="${!a.free && a.paid >= a.q ? "pd" : ""}" style="--i:${i}"><b class="mono">${a.q}</b><span>${esc(a.name)}${!a.free && a.paid ? `<i>${ico("check")}${a.paid >= a.q ? "payé" : `${a.paid} payé${a.paid > 1 ? "s" : ""}`}</i>` : ""}</span><em class="mono">${a.free ? "offert" : apEur(a.u * a.q)}</em></div>`).join("")}</div>
      <div class="ap-tot"><span>Total</span><b class="mono">${apEur(total)}</b></div>
      ${paid ? `<div class="ap-paid"><span>${ico("check")}Déjà payé</span><b class="mono">− ${apEur(paid)}</b></div><div class="ap-tot left"><span>Reste à régler</span><b class="mono">${apEur(left)}</b></div>` : ""}
      ${split ? `<div class="ap-split"><span>${split} parts de</span><b class="mono">${apEur(part)}</b></div>` : ""}</div>
    <div class="ap-br">${pay}${rv ? `<div class="ap-rv"><div class="ap-qr">${apQr(rv)}</div><div><b>Un petit avis ?</b><em>Ça nous aide énormément.</em></div></div>` : ""}</div></div>`;
}
function apMerci() {
  const rv = apReview(), name = (S.resto && S.resto.name) || "";
  return `<div class="ap-d merci"><div class="ap-conf" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.12}s;--r:${(i * 47) % 360}deg"></i>`).join("")}</div>
    <div class="ap-mc"><span class="ap-ok">${ico("check")}</span><h1>Merci !</h1><p>À très bientôt${name ? ` chez ${esc(name)}` : ""}.</p></div>
    ${rv ? `<div class="ap-rv big"><div class="ap-qr">${apQr(rv)}</div><div><b>Vous avez passé un bon moment ?</b><em>Laissez-nous un avis sur Google : 30 secondes, et ça change tout pour nous.</em><span class="ap-stars">${[0, 1, 2, 3, 4].map((i) => `<i style="--s:${i}">${ico("apStar")}</i>`).join("")}</span></div></div>` : ""}</div>`;
}
function apDisplay(scr) {
  const st = apState(scr);
  const body = st.k === "bill" ? apBillD(st, scr) : st.k === "merci" ? apMerci() : st.k === "wait" ? `<div class="ap-d idle"></div>` : apIdle();
  const fl = AP.flash && Date.now() - AP.flash.at < 5000 ? `<div class="ap-flash"><span>${ico("check")}</span><b>Paiement reçu</b><em class="mono">${apEur(AP.flash.amount)}</em></div>` : "";
  return `<div class="ap-scr k-${st.k}"><div class="ap-aur" aria-hidden="true"><i></i><i></i><i></i></div>${body}${fl}</div>`;
}
const apFull = () => (typeof esKioskOn === "function" && esKioskOn() && typeof esStation === "function" && esStation() === "client") || (typeof BIG !== "undefined" && BIG.on);

VIEWS.ecran = {
  render() {
    if (typeof slWatch === "function") slWatch(); else apWatch();
    if (typeof cmWatch === "function") cmWatch();
    if (typeof rsWatch === "function") rsWatch();
    const scr = apScr();
    if (apFull()) { apBeat(); return `<div class="ap-full">${apDisplay(scr)}${typeof esKioskOn === "function" && esKioskOn() ? "" : `<button class="ap-exit" data-act="bigTog" aria-label="Quitter le grand écran">${ico("x")}</button>`}</div>`; }
    const st = apState(scr), open = typeof slOpenTabs === "function" ? slOpenTabs().filter((t) => slItemsOk(t).length) : [];
    const stLbl = { idle: "Accueil : la carte et vos avis", bill: `L'addition de la table ${esc((st.tab || {}).table || "")}`, merci: "« Merci ! » et le QR des avis", wait: "…" }[st.k];
    const sideTabs = open.length ? `<div class="ap-tabs">${open.map((t) => `<button class="ap-tb${st.tab && st.tab.id === t.id && st.k === "bill" ? " on" : ""}" data-act="apShowTab" data-id="${esc(t.id)}"><b class="mono">${esc(t.table)}</b><span>${apEur(slTotal(slItemsOk(t)))}</span></button>`).join("")}</div>` : `<p class="note">Aucune table ouverte. L'addition s'affiche ici dès qu'un serveur la montre.</p>`;
    return `<div class="inner wide ap">${topBar("Écran client")}
      <p class="sub st" style="--i:1">Une tablette tournée vers le client : l'addition, un QR pour payer avec son téléphone et un autre pour laisser un avis.</p>
      <div class="ap-lay">
        <div class="ap-frame st" style="--i:2"><div class="ap-bezel">${apDisplay(scr)}</div><span class="ap-cap">${ico("apScreen")}Ce que voit le client · ${stLbl}</span></div>
        <div class="ap-side st" style="--i:3">
          <section class="glass pad"><div class="lbl">Afficher</div>
            <div class="ap-acts"><button class="btn ${st.k === "idle" ? "acc" : "soft"} sm" data-act="apShowIdle">${ico("home")}Accueil</button><button class="btn soft sm" data-act="apShowMerci">${ico("apStar")}Merci + avis</button></div>
            <div class="lbl" style="margin-top:14px">L'addition d'une table</div>${sideTabs}
            ${DB.mode === "demo" && st.k === "bill" && apOnline() ? `<button class="btn ghost sm ap-sim" data-act="apDemoPay">${ico("apPhone")}Démo : un client paie ses plats</button>` : ""}</section>
          <section class="glass pad"><div class="lbl">Cet appareil</div>
            <button class="btn acc block" data-act="apMakeScreen">${ico("apScreen")}Faire de cette tablette l'écran client</button>
            <button class="btn soft block" data-act="bigTog">${ico("bigIn")}Plein écran sans verrouiller</button>
            <p class="note">Verrouillé, l'écran reste allumé, sans menu, et seul le code du gérant permet d'en sortir.</p></section>
          ${!apOnline() ? `<section class="glass pad ap-tip">${ico("cmCard")}<div><b>Paiement par téléphone</b><p class="sub">Reliez Stripe dans <button class="sl-lnk" data-go="commandes">Commande en ligne</button> : le QR « Payer » apparaît sur l'addition.</p></div></section>` : ""}
          ${!apReview() ? `<section class="glass pad ap-tip">${ico("apStar")}<div><b>Avis Google</b><p class="sub">Collez votre lien d'avis dans <button class="sl-lnk" data-go="resa">Réservations</button> › Réglages › Avis : le QR apparaît à l'accueil et au « Merci ».</p></div></section>` : ""}
        </div></div></div>`;
  },
  after(v) {
    clearInterval(AP.tick);
    AP.tick = setInterval(() => {
      if (S.route !== "ecran") { clearInterval(AP.tick); return; }
      const d = new Date(); document.querySelectorAll("[data-apclock]").forEach((e) => { e.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; });
      /* « merci » and the paid flash end by themselves */
      const k = apState(apScr()).k, cur = (document.querySelector(".ap-scr") || {}).className || "";
      if (!cur.includes("k-" + k) || (AP.flash && Date.now() - AP.flash.at > 5000 && document.querySelector(".ap-flash"))) { if (AP.flash && Date.now() - AP.flash.at > 5000) AP.flash = null; refresh(); }
    }, 5000);
    void v;
  },
};
/* the screen says it is on (so the waiters know where the bill will show), every 10 minutes */
function apBeat() {
  if (DB.mode !== "db" || Date.now() - AP.beat < 10 * 6e4) return; AP.beat = Date.now();
  const id = apScrId(), cur = (AP.scrs || []).find((s) => s.id === id);
  const name = (() => { try { return localStorage.getItem("gg-ecran-name") || "Écran client"; } catch (e) { return "Écran client"; } })();
  (cur ? DB.update("ecran", id, { seenAt: Date.now(), name }) : DB.set("ecran", id, { name, seenAt: Date.now(), show: "idle", at: Date.now() })).catch(() => {});
}
/* a payment arrives: the screen celebrates, the waiter hears it */
function apOnPays() {
  (AP.pays || []).filter((p) => p.status === "paye").forEach((p) => {
    if (AP.paySeen.has(p.id)) return; AP.paySeen.add(p.id); if (!AP.payInit) return;
    if (S.route === "ecran") { AP.flash = { amount: p.amount, at: Date.now() }; try { SFX.done(); } catch (e) {} }
    else if (!apQuiet()) { try { SFX.ok(); buzz([20, 40, 20]); } catch (e) {} toast(`Table ${p.table || ""} · ${apEur(p.amount)} payés en ligne`); }
  });
  AP.payInit = true; onData(); if (typeof slBillLive === "function") slBillLive();
}

/* ───────── the waiter's bill sheet: « Montrer sur l'écran client », what was paid online ───────── */
async function apShow(tab, extra) {
  if (!tab) return;
  if (!tab.payKey && DB.mode !== "demo") { tab.payKey = apKey(); await safe(DB.update("salleTabs", tab.id, { payKey: tab.payKey })); }
  const L = apScreens().sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0)), id = DB.mode === "demo" ? "demo" : (L[0] && L[0].id) || "main", cur = (AP.scrs || []).find((s) => s.id === id) || {};
  const split = SL.bill && SL.bill.tab === tab.id && SL.bill.mode === "pers" ? SL.bill.n : 0;
  await safe(DB.set("ecran", id, { name: cur.name || "Écran client", seenAt: cur.seenAt || 0, show: "bill", tabId: tab.id, table: tab.table, split, at: Date.now(), by: S.me.id, byName: apMe(), ...(extra || {}) }));
  SFX.ok(); buzz([10, 30, 10]);
  if (DB.mode === "db" && !L.length) toast("L'addition attend sur l'écran client : ouvrez « Écran client » sur la tablette", "info");
  else toast(`Table ${tab.table} : l'addition s'affiche sur l'écran client`);
}
async function apScrSet(patch) {
  const id = apScrId(), cur = apScr(id);
  await safe(DB.set("ecran", id, { name: cur.name || "Écran client", seenAt: cur.seenAt || 0, show: "idle", tabId: "", table: "", split: 0, by: S.me.id, byName: apMe(), ...patch, at: Date.now() }));
}
if (typeof slBillPaint === "function") {
  const b0 = slBillPaint;
  slBillPaint = function () {
    const r = b0.apply(this, arguments);
    try {
      const sh = document.querySelector(".sl-sh.bill"), tab = SL.bill && slTabOf(SL.bill.tab); if (!sh || !tab) return r;
      const paid = apPaidOf(tab.id), shown = apScreens().some((s) => s.show === "bill" && s.tabId === tab.id) || (DB.mode === "demo" && apScr("demo").show === "bill" && apScr("demo").tabId === tab.id);
      const left = typeof slBillLeft === "function" ? slBillLeft(tab) : Math.max(0, slTotal(slItemsOk(tab)) - paid);
      const html = `${paid ? `<div class="ap-bpaid">${ico("check")}<span><b>${apEur(paid)} payés en ligne</b> par le client · reste ${apEur(left)}. Saisissez-les sur la caisse en « CB en ligne ».</span></div>` : ""}
        <button class="btn soft block ap-showb${shown ? " on" : ""}" data-act="apShowBill">${ico("apScreen")}${shown ? "Sur l'écran client · actualiser" : "Montrer sur l'écran client"}</button>`;
      const close = sh.querySelector('[data-act="slClose"]'); if (close) close.insertAdjacentHTML("beforebegin", html);
    } catch (e) { console.warn("appel", e); }
    return r;
  };
}
/* closing the table: the screen says « merci », the bill calls are answered */
if (ACT.slClose) {
  const c0 = ACT.slClose;
  ACT.slClose = async function () {
    const tab = SL.bill && slTabOf(SL.bill.tab);
    const r = await c0.apply(this, arguments);
    try {
      if (tab) {
        apAutoDone(tab.table);
        (AP.scrs || []).filter((s) => s.show === "bill" && s.tabId === tab.id).forEach((s) => DB.update("ecran", s.id, { show: "merci", at: Date.now() }).catch(() => {}));
      }
    } catch (e) { console.warn("appel", e); }
    return r;
  };
}

/* ───────── the QR menu settings: « Appel serveur » on / off ───────── */
if (typeof cmCfgTab === "function") {
  const t0 = cmCfgTab;
  cmCfgTab = function () {
    const h = t0.apply(this, arguments), on = cmCfg().calls !== false;
    const tog = `<button class="cm-tog${on ? " on" : ""}" data-act="apCallsTog" aria-pressed="${on}"><span class="cm-tt"><b>Appel serveur</b><em>Depuis le QR de sa table, le client appelle le serveur ou demande l'addition. Même commande en ligne fermée.</em></span><span class="cm-sw${on ? " on" : ""}"><i></i></span></button>`;
    return h.replace(/(<button class="cm-tog[^"]*" data-act="cmTakeTog"[\s\S]*?<\/button>)/, `$1${tog}`);
  };
}

/* ───────── demo ───────── */
function apSeedDemo() {
  const now = Date.now(), day = dayKey(), cp = `restos/${S.rid}/tableCalls`;
  if (!DB.local[cp]) DB.local[cp] = { "t5-addition": { table: "5", kind: "addition", pay: "carte", at: now - 70e3, n: 1, day, status: "new", src: "qr" } };
  const ep = `restos/${S.rid}/ecran`;
  if (!DB.local[ep]) DB.local[ep] = { demo: { name: "Comptoir", seenAt: now, show: "bill", tabId: "dst3", table: "3", split: 0, at: now - 30e3, by: "demo-sarah", byName: "Sarah Lemoine" } };
  const bp = `restos/${S.rid}/billPays`; if (!DB.local[bp]) DB.local[bp] = {};
  /* a table calls now and then while the visitor looks at the service screens */
  clearInterval(AP.demoT); AP.demoN = 0;
  AP.demoT = setInterval(() => {
    if (DB.mode !== "demo" || AP.demoN >= 4 || !["salle", "coupdefeu", "home", "plan"].includes(S.route)) return;
    const tabs = (typeof slOpenTabs === "function" ? slOpenTabs() : []).filter((t) => !apLive().some((c) => String(c.table) === String(t.table))); if (!tabs.length) return;
    const t = tabs[AP.demoN % tabs.length], kind = ["serveur", "eau", "addition", "pain"][AP.demoN % 4]; AP.demoN++;
    DB.set("tableCalls", `t${t.table}-${kind}`, { table: String(t.table), kind, pay: kind === "addition" ? "especes" : "", at: Date.now(), n: 1, day: dayKey(), status: "new", src: "qr" });
  }, 75000);
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  apSheet: () => { SFX.tap(); buzz(6); apSheetPaint(); },
  apPillX: () => { SFX.close(); buzz(6); apPillOff(); },
  apGo: async (a, id) => { SFX.ok(); buzz([10, 30, 10]); await apSetCall(id, { status: "vu", seenAt: Date.now(), by: S.me.id, byName: apMe() }); toast("Le client sait que vous arrivez"); if (document.querySelector(".ap-sh")) apSheetPaint(); },
  apDone: async (a, id) => { SFX.tap(); buzz(8); await apSetCall(id, { status: "fait", doneAt: Date.now(), by: S.me.id, byName: apMe() }); if (document.querySelector(".ap-sh")) apSheetPaint(); },
  apTable: (a, id) => { const c = (AP.calls || []).find((x) => x.id === id), tab = c && apTabAt(c.table); closeSheet(true); if (tab) go("salle", { id: tab.id }); else go("salle"); },
  apBill: async (a, id) => {
    const c = (AP.calls || []).find((x) => x.id === id), tab = c && apTabAt(c.table); if (!tab) { toast(`Aucune table ${c ? c.table : ""} ouverte`, "info"); return; }
    if (c.status === "new") await apSetCall(id, { status: "vu", seenAt: Date.now(), by: S.me.id, byName: apMe() });
    closeSheet(true); if (S.route !== "salle" || !S.params || S.params.id !== tab.id) go("salle", { id: tab.id }); setTimeout(() => { if (typeof slBillSheet === "function") slBillSheet(tab); }, 260);
  },
  apShowBill: async () => { const tab = SL.bill && slTabOf(SL.bill.tab); await apShow(tab); slBillPaint(false); },
  apShowTab: async (a, id) => { const tab = slTabOf(id); await apShow(tab); },
  apShowIdle: async () => { SFX.tap(); await apScrSet({ show: "idle" }); },
  apShowMerci: async () => { SFX.tap(); await apScrSet({ show: "merci" }); },
  apCallsTog: async () => { const on = cmCfg().calls !== false; SFX.tap(); await cmSaveCfg({ calls: !on }); toast(on ? "Appel serveur coupé" : "Appel serveur activé"); },
  apMakeScreen: () => {
    SFX.tap();
    if (typeof ES !== "undefined") { ES.devDraft = { kind: "partage", station: "client" }; }
    go("espaces");
  },
  apDemoPay: async () => {
    const st = apState(apScr()); if (st.k !== "bill") return;
    /* a guest pays their own dishes: one of each of the first two dishes still to pay */
    const lines = slBillRows(st.tab).rows.filter((r) => r.left > 0).slice(0, 2).map((r) => ({ rk: r.rk, q: 1, u: r.u }));
    const amt = lines.length ? Math.min(st.left, Math.round(lines.reduce((s, l) => s + l.u, 0) * 100) / 100) : Math.min(st.left, Math.ceil((st.total / Math.max(2, +st.tab.covers || 2)) * 100) / 100);
    await DB.set("billPays", "dp" + Date.now().toString(36), { tabId: st.tab.id, table: st.tab.table, amount: amt, status: "paye", at: Date.now(), paidAt: Date.now(), lines: lines.map(({ rk, q }) => ({ rk, q })) });
  },
});

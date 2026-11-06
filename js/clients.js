/* Growth Gusto — area: fichier clients & fidélité (route « clients »). Prefix « fd ».
   One file per client, built from everything the restaurant already knows, without retyping:
     · bookings (js/resa.js): visits (« arrivée »), no-shows, cancellations, the next table, the consent ticked on the booking page (optin);
     · takeaway orders with a phone number (js/commande.js, clientOrders): visits and money spent;
     · the file itself, restos/{rid}/clients/{key} (shared with js/resa.js, which writes name/phone/email/vip/notes):
         { name, phone, email, vip, notes, allergens:[ALLERGENS id], bday:"MM-DD", optEmail?, optSms?, optAt, optSrc, unsubAt?,
           passes:[ms] (visits noted by hand at the counter), used (stamps already spent on rewards), gifts:[{at,by}], createdAt, updatedAt }
         key = the phone's last 9 digits (rsPk), or « m » + a hash of the e-mail for a client without phone.
   Loyalty (restos/{rid}.fidCfg { on, goal, reward, orders, passes, bday, bdayMsg }): one stamp per visit, the reward once the card is full.
   Campaigns (restos/{rid}/campaigns/{id} { title, subject, body, ch:"email"|"sms", seg, n, to:[key], at, by, via:"server"|"mail"|"phone"|"demo",
     status:"envoi"|"envoyee", sent, done:[key] }): only to clients who said yes (RGPD), personalised with {prénom}.
     · e-mail: sent by the server (functions/src/clients.js, Brevo free plan, an unsubscribe link in every e-mail), or from the phone's
       own mail app (addresses in Cci, by batches) when the server is not there;
     · SMS: from the phone, one tap per client (free, nothing to pay), « STOP » mention added.
   RGPD: consent with its date and source, export of one client's data, deletion that also anonymises their past bookings.
   Exposed: fdPerson(phone) → the merged file (js/resa.js shows allergies and the loyalty reward on a booking), fdOpenSheet(key). */
"use strict";

TAB_OF.clients = "more";
Object.assign(IC, {
  fdUsers: ["c:9,8,4", "M2 21v-1.5A5.5 5.5 0 0 1 7.5 14h3a5.5 5.5 0 0 1 5.5 5.5V21", "f:M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", "M16 3.3a4 4 0 0 1 0 7.4", "M22 21v-1.5a5.5 5.5 0 0 0-4-5.3"],
  fdStamp: ["c:12,12,9", "f:M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z", "m8.5 12.3 2.3 2.3 4.7-5"],
  fdCake: ["M4 21h16", "M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7", "f:M5 14a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7H5z", "M5 16.5c1.2 0 1.7 1 3.5 1s2.3-1 3.5-1 1.7 1 3.5 1 2.3-1 3.5-1", "M12 12V8.5", "M12 5.8c.9-.8.9-1.9 0-3-.9 1.1-.9 2.2 0 3z"],
  fdGift: ["r:3,8,18,4,1.5", "M12 8v13", "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7", "f:M5 12h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z", "M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"],
  fdMega: ["M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z", "f:M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z", "M15 9a4 4 0 0 1 0 6", "M18 6.5a8 8 0 0 1 0 11"],
  fdSms: ["M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z", "f:M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z", "M9 11h.01", "M13 11h.01", "M17 11h.01"],
  fdMail: ["r:2.5,5,19,14,3", "m3 7.5 9 6 9-6"],
  fdCrown: ["M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z", "f:M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"],
  fdSearch: ["c:11,11,7", "m20 20-4-4"],
  fdHeart: ["M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z", "f:M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"],
  fdShield: ["M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z", "m9 12 2 2 4-4"],
  fdDl: ["M12 4v11", "m7 10 5 5 5-5", "M5 20h14"],
  fdBag: ["M6 7h12l1 14H5L6 7Z", "M9 10V6a3 3 0 0 1 6 0v4"],
  fdHand: ["M7 11V6.5a1.5 1.5 0 0 1 3 0V11", "M10 10V4.5a1.5 1.5 0 0 1 3 0V10", "M13 10V5.5a1.5 1.5 0 0 1 3 0V12", "M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.6 1.6 0 0 1 2.6-1.9L7 13.5"],
});
(function fdNav() { /* side nav: right after « Commandes en ligne » (or « Réservations »), without editing the shared NAV list */
  if (NAV.some((n) => n[0] === "clients")) return; let i = NAV.findIndex((n) => n[0] === "commandes"); if (i < 0) i = NAV.findIndex((n) => n[0] === "resa");
  NAV.splice(i >= 0 ? i + 1 : NAV.length, 0, ["clients", "fdUsers", "Clients & fidélité"]);
})();
try { if (typeof PM_ROUTE !== "undefined") PM_ROUTE.clients = PM_ROUTE.clients || "resa"; } catch (e) {}
try { if (typeof AB_GATE !== "undefined" && !AB_GATE.clients) AB_GATE.clients = ["pro", "Fichier clients & fidélité"]; } catch (e) {}
try { if (typeof AB_PACKS !== "undefined" && AB_PACKS.pro && !AB_PACKS.pro.feats.includes("Fichier clients & fidélité")) AB_PACKS.pro.feats.splice(2, 0, "Fichier clients & fidélité"); } catch (e) {}

const FD = { rid: null, camps: [], tab: "list", q: "", seg: "tous", n: 40, ed: null, add: null, comp: null, sms: null, mail: null, pass: null, memo: null, cfgEd: null };
const FD_DAY = 864e5;
const fdPl = (n, s, p) => `${n} ${n > 1 ? p || s + "s" : s}`;
const fdEur = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: n >= 100 ? 0 : 2, maximumFractionDigits: n >= 100 ? 0 : 2 }) + " €";
const fdMoney = () => { try { return typeof PERMS === "undefined" || !PERMS.cap ? true : PERMS.cap("seeMoney") !== false; } catch (e) { return true; } };
const fdMgr = () => { if (DB.mode === "demo") return true; try { if (typeof PERMS !== "undefined" && PERMS.isAdmin) return !!PERMS.isAdmin(); } catch (e) {} return myRole() !== "equipe"; };
const fdKey = (ph) => (typeof rsPk === "function" ? rsPk(ph) : (() => { const d = String(ph || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-9) : ""; })());
const fdMailOk = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m || "").trim());
function fdMailKey(m) { let h = 5381; const s = String(m || "").trim().toLowerCase(); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "m" + h.toString(36); }
const fdTel = (ph) => String(ph || "").replace(/[^\d+]/g, "");
const fdSince = (k) => (k ? -daysUntil(k) : null);
const fdMonthsFr = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function fdBdayIn(md) { /* days until the next birthday (0 = today) */
  const m = /^(\d{2})-(\d{2})$/.exec(md || ""); if (!m) return null; const t = parseDay(dayKey()); let d = new Date(t.getFullYear(), +m[1] - 1, +m[2]);
  if (d < t) d = new Date(t.getFullYear() + 1, +m[1] - 1, +m[2]); return Math.round((d - t) / FD_DAY);
}
const fdBdayTx = (md) => { const m = /^(\d{2})-(\d{2})$/.exec(md || ""); return m ? `${+m[2]}${+m[2] === 1 ? "er" : ""} ${fdMonthsFr[+m[1] - 1]}` : ""; };
const fdAgo = (k) => { const n = fdSince(k); if (n == null) return ""; if (n <= 0) return "aujourd'hui"; if (n === 1) return "hier"; if (n < 30) return `il y a ${n} j`; if (n < 365) return `il y a ${Math.round(n / 30)} mois`; return `il y a ${Math.floor(n / 365)} an${n >= 730 ? "s" : ""}`; };
const FD_TONES = [["#EFE9FF", "#3A10D8"], ["#FFF3D6", "#7A5A1A"], ["#E6F0FF", "#2F5FBF"], ["#FFE9DE", "#C8432A"], ["#E3F5EA", "#1E7F55"], ["#F4EDE0", "#4A4560"]];
function fdAva(p, size = 44) {
  const nm = String(p.name || "?").trim(); let h = 0; for (const c of nm) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [bg, fg] = FD_TONES[h % FD_TONES.length];
  const ini = nm.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return `<span class="fd-ava" style="--s:${size}px;background:${bg};color:${fg}">${esc(ini)}${p.vip ? `<i class="fd-ava-v">${ico("fdCrown")}</i>` : ""}</span>`;
}

/* ───────── loyalty settings ───────── */
const fdDefCfg = () => ({ on: true, goal: 10, reward: "Le dessert offert", orders: true, passes: true, bday: false, bdayMsg: "Joyeux anniversaire {prénom} ! Pour fêter ça, le dessert vous est offert ce mois-ci. À très vite !" });
function fdCfg() { const c = (S.resto && S.resto.fidCfg) || {}; const o = { ...fdDefCfg(), ...c }; o.goal = Math.min(20, Math.max(3, +o.goal || 10)); return o; }
const FD_REWARDS = ["Le dessert offert", "Un verre de vin offert", "Le café gourmand offert", "-10 % sur l'addition", "L'entrée offerte"];

/* ───────── data ───────── */
const fdDocs = () => (typeof R !== "undefined" && R.rid === S.rid ? R.clients || [] : []);
const fdOrders = () => (typeof CM !== "undefined" && CM.rid === S.rid ? CM.orders || [] : []);
const fdBookings = () => (typeof rsRows === "function" ? rsRows() : []);
function fdWatch() {
  if (!S.rid) return; const first = FD.rid !== S.rid, rid = S.rid;
  if (first) { FD.rid = S.rid; FD.camps = []; FD.memo = null; } /* set first: js/resa.js's demo seed re-renders the screen while we are still here */
  try { if (typeof rsWatch === "function") rsWatch(); } catch (e) {}
  try { if (typeof cmWatch === "function") cmWatch(); } catch (e) {}
  if (!first) return;
  if (DB.mode === "demo") fdSeedDemo();
  DB.watch("campaigns", { order: "at", dir: "desc", limit: 100 }, (rows) => { if (S.rid !== rid) return; FD.camps = rows; if (S.route === "clients") onData(); });
}
/* the merged file of every client (memoised on the three sources) */
function fdPeople() {
  const B = fdBookings(), D = fdDocs(), O = fdOrders(), cfg = fdCfg();
  if (FD.memo && FD.memo.b === B && FD.memo.d === D && FD.memo.o === O && FD.memo.c === S.resto) return FD.memo.list;
  const m = {}, today = dayKey();
  const get = (k) => (m[k] ||= { id: k, name: "", phone: "", email: "", resa: 0, orders: 0, passes: 0, noshow: 0, cancel: 0, spent: 0, next: null, first: "", last: "", optB: 0, notesB: [], hist: [], doc: null });
  const seen = (p, day) => { if (!day) return; if (!p.first || day < p.first) p.first = day; if (!p.last || day > p.last) p.last = day; };
  B.forEach((b) => {
    const k = fdKey(b.phone); if (!k) return; const p = get(k);
    if (!p.name && b.name) p.name = b.name; if (!p.phone) p.phone = b.phone; if (!p.email && b.email) p.email = b.email;
    if (b.status === "arrive") { p.resa++; seen(p, b.date); } else if (b.status === "noshow") p.noshow++; else if (b.status === "annule") p.cancel++;
    else if (rsLive(b) && b.date >= today && (!p.next || b.date + b.time < p.next.date + p.next.time)) p.next = b;
    if (b.optin === true && (+b.createdAt || 1) > p.optB) p.optB = +b.createdAt || 1;
    if (b.notes && b.date <= today) p.notesB.push(b.notes);
    p.hist.push({ k: "resa", day: b.date, t: b.time, at: parseDay(b.date).getTime() + rsMin(b.time) * 6e4, b });
  });
  if (cfg.orders !== false) O.forEach((o) => {
    if (!o.phone || ["annulee", "apayer", "abandonnee"].includes(o.status)) return; const k = fdKey(o.phone); if (!k) return; const p = get(k);
    if (!p.name && o.name) p.name = o.name; if (!p.phone) p.phone = o.phone; p.orders++; p.spent += +o.total || 0; seen(p, o.day || dayKey(new Date(o.at)));
    p.hist.push({ k: "cmd", day: o.day, at: +o.at || 0, o });
  });
  D.forEach((d) => {
    if (!d || !d.id || d.gone) return; const p = get(d.id); p.doc = d;
    if (d.name) p.name = d.name; if (d.phone) p.phone = d.phone; if (d.email) p.email = d.email;
    const ps = Array.isArray(d.passes) ? d.passes : []; if (cfg.passes !== false) { p.passes = ps.length; ps.forEach((t) => { seen(p, dayKey(new Date(t))); p.hist.push({ k: "pass", day: dayKey(new Date(t)), at: t }); }); }
    (Array.isArray(d.gifts) ? d.gifts : []).forEach((g) => p.hist.push({ k: "gift", day: dayKey(new Date(g.at)), at: g.at, g }));
  });
  const list = Object.values(m).map((p) => {
    const d = p.doc || {}; p.vip = !!d.vip; p.notes = d.notes || ""; p.allergens = Array.isArray(d.allergens) ? d.allergens : []; p.bday = d.bday || "";
    p.visits = p.resa + p.orders + p.passes; p.used = +d.used || 0; p.stamps = Math.max(0, p.visits - p.used);
    /* consent: the choice noted in the file, unless the client ticked « oui » on a booking made after it (and after any unsubscribe) */
    const hasC = d.optEmail != null || d.optSms != null, newer = p.optB > Math.max(+d.optAt || 0, +d.unsubAt || 0);
    p.optEmail = newer || (!hasC && !!p.optB) || (hasC && d.optEmail === true);
    p.optSms = newer || (!hasC && !!p.optB) || (hasC && d.optSms === true);
    p.optAt = newer || !hasC ? p.optB : +d.optAt || 0; p.optSrc = newer || !hasC ? (p.optB ? "réservation en ligne" : "") : d.optSrc || "";
    p.hist.sort((a, b) => b.at - a.at);
    p.tier = p.visits >= 10 ? ["Fidèle", "fi"] : p.visits >= 5 ? ["Habitué", "ha"] : p.visits >= 2 ? ["Revient", "re"] : p.visits === 1 ? ["Première visite", "nv"] : p.next ? ["Attendu", "nv"] : ["Contact", "ct"];
    p.bdIn = fdBdayIn(p.bday); p.ago = fdSince(p.last);
    return p;
  }).filter((p) => p.name || p.phone || p.email);
  list.sort((a, b) => (b.last || "").localeCompare(a.last || "") || b.visits - a.visits || (a.name || "").localeCompare(b.name || "", "fr"));
  FD.memo = { b: B, d: D, o: O, c: S.resto, list }; return list;
}
const fdById = (k) => fdPeople().find((p) => p.id === k) || null;
function fdPerson(ph) { const k = fdKey(ph); return k ? fdById(k) : null; }
const fdReward = (p, cfg = fdCfg()) => cfg.on !== false && p.stamps >= cfg.goal;
/* menu « Plus » badge: loyalty rewards waiting to be given */
function fdGiveN() { if (!S.rid || !(S.resto && (S.resto.resaCfg || S.resto.fidCfg))) return 0; fdWatch(); const c = fdCfg(); return c.on === false ? 0 : fdPeople().filter((p) => fdReward(p, c)).length; }

/* segments: [key, label, test, for campaigns] */
const FD_SEGS = [
  ["tous", "Tous", () => true, true],
  ["habitues", "Habitués", (p) => p.visits >= 3, true],
  ["absents", "À relancer", (p) => p.visits >= 2 && p.ago != null && p.ago >= 60, true],
  ["anniv", "Anniversaire", (p) => p.bdIn != null && p.bdIn <= 30, true],
  ["vip", "VIP", (p) => p.vip, true],
  ["nouveaux", "Nouveaux", (p) => p.visits === 1 && p.ago != null && p.ago <= 45, true],
  ["fidelite", "Récompense", (p) => fdReward(p), false],
  ["allergies", "Allergies", (p) => p.allergens.length > 0, false],
];
const fdSeg = (k) => FD_SEGS.find((s) => s[0] === k) || FD_SEGS[0];
const fdReach = (p, ch) => (ch === "sms" ? !!(p.optSms && fdKey(p.phone)) : !!(p.optEmail && fdMailOk(p.email)));
function fdMatch(p, q) { if (!q) return true; const t = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); const n = String(p.name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); const dq = q.replace(/\D/g, ""); return n.includes(t) || (dq.length >= 3 && String(p.phone || "").replace(/\D/g, "").includes(dq)) || String(p.email || "").toLowerCase().includes(t); }

/* write the file: what is there now + the patch (keeps what js/resa.js wrote) */
async function fdWrite(k, patch) {
  const cur = fdDocs().find((d) => d.id === k) || {}; const { id, ...rest } = cur; const p = fdById(k);
  const base = { name: (p && p.name) || "", phone: (p && p.phone) || "", email: (p && p.email) || "", createdAt: Date.now() };
  const doc = DB.clean({ ...base, ...rest, ...patch, updatedAt: Date.now() }); Object.keys(doc).forEach((x) => doc[x] === "" && x !== "name" && delete doc[x]);
  await safe(DB.set("clients", k, doc)); FD.memo = null;
}

/* ───────── view ───────── */
VIEWS.clients = {
  render() {
    fdWatch();
    if (S.params && S.params.tab && FD.tabFrom !== S.params) { FD.tab = S.params.tab; FD.tabFrom = S.params; }
    const L = fdPeople(), tab = FD.tab, TABS = [["list", "Fichier"], ["fid", "Fidélité"], ["camp", "Campagnes"]], ti = TABS.findIndex((t) => t[0] === tab);
    const seg = `<div class="seg fd-tabs st" style="--i:1" role="tablist"><span class="knob" style="width:calc(33.333% - 2.7px);transform:translateX(${ti * 100}%)"></span>${TABS.map(([k, t]) => `<button class="${k === tab ? "on" : ""}" data-act="fdTab" data-v="${k}" role="tab" aria-selected="${k === tab}">${t}</button>`).join("")}</div>`;
    const body = tab === "fid" ? fdFidHTML(L) : tab === "camp" ? fdCampHTML(L) : fdListHTML(L);
    return `<div class="inner fd">${topBar("Clients & fidélité", { right: tab === "list" ? `<button class="iconbtn" data-act="fdAdd" aria-label="Ajouter un client">${ico("plus")}</button>` : "" })}${seg}${body}</div>`;
  },
  after(v) {
    const q = $("#fdQ", v); if (q) q.addEventListener("input", () => { FD.q = q.value; FD.n = 40; const box = $("#fdRows", v); if (box) box.innerHTML = fdRowsHTML(fdPeople()); });
    if (v.classList.contains("nost") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    $$("[data-count]", v).forEach((el) => { const to = +el.dataset.count; const t0 = performance.now(); const f = (t) => { const x = Math.min(1, (t - t0) / 850); el.textContent = Math.round(to * (1 - Math.pow(1 - x, 4))); if (x < 1 && el.isConnected) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  },
};

/* ── Fichier ── */
function fdListHTML(L) {
  const known = L.filter((p) => p.visits > 0), back = known.filter((p) => p.visits >= 2).length, rate = known.length ? Math.round((back / known.length) * 100) : 0;
  const wk = L.filter((p) => p.bdIn != null && p.bdIn <= 7).length, reach = L.filter((p) => fdReach(p, "email") || fdReach(p, "sms")).length;
  const hero = `<div class="fd-hero wall st" style="--i:2">
    <div class="fd-hn"><div><b class="fd-big mono" data-count="${L.length}">${L.length}</b><span>${L.length > 1 ? "clients dans votre fichier" : "client dans votre fichier"}</span></div>
      <svg class="fd-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="7"/><circle class="fd-ringv" cx="32" cy="32" r="27" fill="none" stroke="#F6B93B" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(rate / 100) * 169.6} 169.6" transform="rotate(-90 32 32)" style="--c0:${(rate / 100) * 169.6}"/><text x="32" y="33" text-anchor="middle">${rate}%</text><text class="s" x="32" y="44" text-anchor="middle">reviennent</text></svg></div>
    <div class="fd-hs"><div><b class="mono">${L.filter((p) => p.visits >= 3).length}</b><em>habitués</em></div><div><b class="mono">${wk}</b><em>à fêter</em></div><div><b class="mono">${reach}</b><em>joignables</em></div></div></div>`;
  if (!L.length) return hero + `<div class="glass fd-empty st" style="--i:3">${fdArt()}<b class="h3">Votre fichier se remplit tout seul</b><p class="sub">Chaque réservation et chaque commande à emporter crée la fiche du client. Vous pouvez aussi l'ajouter à la main.</p><button class="btn acc" data-act="fdAdd">${ico("plus")}Ajouter un client</button></div>`;
  const chips = FD_SEGS.map(([k, t, f]) => { const n = k === "tous" ? L.length : L.filter(f).length; if (!n && k !== "tous" && k !== FD.seg) return ""; return `<button class="chip${FD.seg === k ? " on" : ""}" data-act="fdSegPick" data-v="${k}">${t}<span class="fd-cn">${n}</span></button>`; }).join("");
  return `${hero}
    <div class="fd-tools st" style="--i:3"><label class="fd-search">${ico("fdSearch")}<input class="input" id="fdQ" type="search" value="${esc(FD.q)}" placeholder="Nom, téléphone ou e-mail" autocomplete="off" enterkeyhint="search"></label>
      <div class="fd-chips">${chips}</div></div>
    <div class="glass fd-list st" style="--i:4"><div id="fdRows">${fdRowsHTML(L)}</div></div>
    ${fdMgr() ? `<div class="fd-foot st" style="--i:5"><button class="btn ghost sm" data-act="fdCsv">${ico("fdDl")}Exporter le fichier</button><span>${ico("fdShield")}Données gardées dans votre compte, jamais revendues.</span></div>` : ""}`;
}
function fdRowsHTML(L) {
  const f = fdSeg(FD.seg)[2], R0 = L.filter((p) => f(p) && fdMatch(p, FD.q.trim())), cfg = fdCfg();
  if (!R0.length) return `<div class="fd-none">${ico("fdSearch")}<b>Personne ici</b><em>${FD.q ? "Essayez un autre nom ou un numéro." : "Aucun client dans ce groupe pour l'instant."}</em></div>`;
  const rows = R0.slice(0, FD.n).map((p, i) => fdRowHTML(p, cfg, i)).join("");
  return rows + (R0.length > FD.n ? `<button class="btn ghost sm block fd-more" data-act="fdMore">Voir ${Math.min(40, R0.length - FD.n)} de plus</button>` : "");
}
function fdRowHTML(p, cfg, i) {
  const sub = [p.visits ? fdPl(p.visits, "visite") : p.next ? `Réservé ${(rsRel(p.next.date) || rsShort(p.next.date)).toLowerCase()}` : "Pas encore venu", p.last ? fdAgo(p.last) : ""].filter(Boolean).join(" · ");
  const tags = [p.allergens.length ? `<span class="fd-tag al" title="Allergies">${ico("alert")}${esc(p.allergens.length === 1 ? (allergenOf(p.allergens[0]) || {}).t || "Allergie" : fdPl(p.allergens.length, "allergie"))}</span>` : "",
    p.bdIn != null && p.bdIn <= 7 ? `<span class="fd-tag bd">${ico("fdCake")}${p.bdIn === 0 ? "Aujourd'hui" : p.bdIn === 1 ? "Demain" : `Dans ${p.bdIn} j`}</span>` : "",
    fdReward(p, cfg) ? `<span class="fd-tag gf">${ico("fdGift")}À offrir</span>` : "", p.noshow >= 2 ? `<span class="fd-tag ns">${fdPl(p.noshow, "no-show")}</span>` : ""].join("");
  const ring = cfg.on !== false && p.visits ? (() => { const r = Math.min(1, p.stamps / cfg.goal); return `<span class="fd-mr${r >= 1 ? " full" : ""}" title="${p.stamps}/${cfg.goal} tampons"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="#EFE6D6" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="${r * 94.2} 94.2" transform="rotate(-90 18 18)"/></svg><b>${Math.min(p.stamps, cfg.goal)}</b></span>`; })() : "";
  return `<button class="fd-row" data-act="fdOpen" data-id="${esc(p.id)}" style="--j:${Math.min(i, 12)}">${fdAva(p)}<span class="tx"><b>${esc(p.name || p.phone || p.email)}${p.vip ? `<span class="fd-vip">VIP</span>` : ""}</b><em>${esc(sub)}</em>${tags ? `<span class="fd-tags">${tags}</span>` : ""}</span>${ring}${ico("chev")}</button>`;
}
function fdArt() {
  return `<svg class="fd-art" viewBox="0 0 160 96" aria-hidden="true"><ellipse cx="80" cy="88" rx="60" ry="6" fill="#EFE6D6"/>
    <rect x="30" y="22" width="100" height="60" rx="14" fill="#5B2BFF"/><rect x="30" y="22" width="100" height="60" rx="14" fill="none" stroke="#2A0BA6" stroke-width="2"/>
    ${[0, 1, 2, 3, 4].map((i) => `<circle class="fd-art-s" style="--j:${i}" cx="${48 + i * 16}" cy="58" r="6" fill="${i < 3 ? "#F6B93B" : "rgba(255,255,255,.22)"}"/>`).join("")}
    <rect x="42" y="34" width="44" height="7" rx="3.5" fill="#fff" opacity=".9"/><path class="fd-art-h" d="M122 14c-3-5-11-3-10 3 1 4 10 9 10 9s9-5 10-9c1-6-7-8-10-3z" fill="#EF5A3C"/></svg>`;
}

/* ── Fidélité ── */
function fdCardHTML(cfg, stamps, big) {
  const g = cfg.goal, n = Math.min(stamps, g); const nm = (S.resto && S.resto.name) || "Votre restaurant";
  return `<div class="fd-card${big ? " big" : ""}${n >= g ? " full" : ""}"><div class="fd-card-h">${typeof restoMark === "function" ? restoMark(big ? 30 : 24) : ""}<b>${esc(nm)}</b><span>Carte de fidélité</span></div>
    <div class="fd-stamps" style="--g:${g <= 10 ? 5 : Math.ceil(g / 2)}">${Array.from({ length: g }, (_, i) => `<i class="${i < n ? "on" : ""}${i === g - 1 ? " last" : ""}" style="--j:${i}">${i === g - 1 ? ico("fdGift") : i < n ? ico("check") : ""}</i>`).join("")}</div>
    <div class="fd-card-f">${ico("fdGift")}<span>${esc(cfg.reward)}</span><em>${n >= g ? "à offrir" : `après ${fdPl(g, "visite")}`}</em></div></div>`;
}
function fdFidHTML(L) {
  const cfg = fdCfg(), mgr = fdMgr(), give = L.filter((p) => fdReward(p, cfg)).sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1) || b.stamps - a.stamps);
  const near = L.filter((p) => !fdReward(p, cfg) && p.visits && cfg.goal - p.stamps <= 2).sort((a, b) => b.stamps - a.stamps).slice(0, 6);
  const top = L.filter((p) => p.visits).slice().sort((a, b) => b.visits - a.visits).slice(0, 5);
  const off = cfg.on === false;
  const card = `<div class="glass pad fd-fcard st" style="--i:2">${fdCardHTML(cfg, Math.max(3, Math.round(cfg.goal * 0.6)), true)}
    <p class="sub fd-fexp">${off ? "Le programme est en pause : rien ne s'affiche pour les clients." : `Chaque visite donne un tampon, tout seul : réservation honorée${cfg.orders !== false ? ", commande à emporter" : ""}${cfg.passes !== false ? " ou passage noté au comptoir" : ""}. L'équipe voit la récompense sur la réservation.`}</p>
    <button class="btn acc block fd-passbtn" data-act="fdPass">${ico("fdStamp")}Noter un passage</button></div>`;
  const giveH = `<div class="glass pad fd-give st" style="--i:3"><div class="row"><span class="lbl fd-lb">${ico("fdGift")}À offrir</span><span class="pill ${give.length ? "warn" : "neu"}">${give.length}</span></div>
    ${give.length ? give.slice(0, 8).map((p) => `<div class="li fd-gl">${fdAva(p, 38)}<div class="tx"><b>${esc(p.name)}</b><em>${p.next ? `Vient ${(rsRel(p.next.date) || rsShort(p.next.date)).toLowerCase()} à ${p.next.time}` : `Dernière visite ${fdAgo(p.last)}`}</em></div><button class="btn sm fd-gbtn" data-act="fdGive" data-id="${esc(p.id)}">${ico("fdGift")}Offert</button></div>`).join("") : `<p class="sub fd-z">Personne pour l'instant. Les cartes pleines arrivent ici.</p>`}
    ${near.length ? `<div class="fd-near"><span class="lbl">Presque</span>${near.map((p) => `<button class="fd-nchip" data-act="fdOpen" data-id="${esc(p.id)}">${esc(firstName(p.name) || p.name)}<b>${cfg.goal - p.stamps === 1 ? "plus qu'1" : `plus que ${cfg.goal - p.stamps}`}</b></button>`).join("")}</div>` : ""}</div>`;
  const topH = top.length ? `<div class="glass pad fd-top st" style="--i:4"><span class="lbl fd-lb">${ico("fdHeart")}Vos plus fidèles</span>${top.map((p, i) => `<button class="fd-tl" data-act="fdOpen" data-id="${esc(p.id)}"><span class="fd-rk mono">${i + 1}</span>${fdAva(p, 34)}<div class="tx"><b>${esc(p.name)}</b><em>${fdPl(p.visits, "visite")}${fdMoney() && p.spent ? ` · ${fdEur(p.spent)} à emporter` : ""}</em></div>${ico("chev")}</button>`).join("")}</div>` : "";
  const set = mgr ? `<div class="glass pad fd-set st" style="--i:5"><span class="lbl">Réglages du programme</span>
    <button class="rs-tog${off ? "" : " on"}" data-act="fdCfgTog" data-v="on" aria-pressed="${!off}"><span><b>Carte de fidélité</b><em>${off ? "En pause" : "Active pour tous vos clients"}</em></span><i></i></button>
    <div class="fd-goal"><span><b>Visites pour la récompense</b><em>Entre 3 et 20</em></span><div class="fd-step"><button class="ac-sb" data-act="fdGoal" data-v="-1" aria-label="Moins">${ico("minus")}</button><b class="mono">${cfg.goal}</b><button class="ac-sb" data-act="fdGoal" data-v="1" aria-label="Plus">${ico("plus")}</button></div></div>
    <label class="field"><span>La récompense</span><input class="input" id="fdRw" maxlength="60" value="${esc(cfg.reward)}"></label>
    <div class="fd-rws">${FD_REWARDS.map((r) => `<button class="chip${r === cfg.reward ? " on" : ""}" data-act="fdRwPick" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div>
    <button class="rs-tog${cfg.orders !== false ? " on" : ""}" data-act="fdCfgTog" data-v="orders" aria-pressed="${cfg.orders !== false}"><span><b>Les commandes à emporter comptent</b><em>Une commande payée = un tampon</em></span><i></i></button>
    <button class="rs-tog${cfg.passes !== false ? " on" : ""}" data-act="fdCfgTog" data-v="passes" aria-pressed="${cfg.passes !== false}"><span><b>Passages notés au comptoir</b><em>Pour les clients venus sans réserver</em></span><i></i></button>
    <button class="rs-tog${cfg.bday ? " on" : ""}" data-act="fdCfgTog" data-v="bday" aria-pressed="${!!cfg.bday}"><span><b>E-mail d'anniversaire automatique</b><em>${DB.mode === "db" ? "Le matin du jour J, aux clients qui ont accepté vos nouvelles" : "Avec un compte Growth Gusto"}</em></span><i></i></button>
    ${cfg.bday ? `<label class="field"><span>Le message d'anniversaire</span><textarea class="input" id="fdBdM" rows="3" maxlength="400">${esc(cfg.bdayMsg)}</textarea></label>` : ""}
    <button class="btn soft block" data-act="fdCfgSave">Enregistrer les réglages</button></div>` : "";
  return `<div class="cols"><div>${card}${giveH}</div><div>${topH}${set}</div></div>`;
}

/* ── Campagnes ── */
const FD_TPL = [
  { k: "carte", t: "Nouvelle carte", ic: "book", seg: "tous", subj: "La nouvelle carte est arrivée", body: "Bonjour {prénom}, notre nouvelle carte vient de sortir ! Des produits de saison et quelques nouveautés du chef. On vous garde une table ?" },
  { k: "manque", t: "Vous nous manquez", ic: "fdHeart", seg: "absents", subj: "Ça fait longtemps, {prénom} !", body: "Bonjour {prénom}, cela fait un moment qu'on ne vous a pas vu. Revenez nous voir ce mois-ci : le café vous est offert sur présentation de ce message." },
  { k: "soiree", t: "Soirée spéciale", ic: "fdMega", seg: "habitues", subj: "Une soirée rien que pour vous", body: "Bonjour {prénom}, jeudi prochain nous organisons une soirée accords mets et vins. Places limitées, répondez vite pour réserver la vôtre !" },
  { k: "anniv", t: "Anniversaire", ic: "fdCake", seg: "anniv", subj: "Joyeux anniversaire {prénom} !", body: "Joyeux anniversaire {prénom} ! Pour fêter ça, le dessert vous est offert ce mois-ci. À très vite !" },
  { k: "places", t: "Places ce soir", ic: "resa", seg: "habitues", subj: "Il reste quelques tables ce soir", body: "Bonsoir {prénom}, il nous reste quelques tables ce soir. Envie de passer ? Répondez à ce message ou appelez-nous." },
  { k: "libre", t: "Message libre", ic: "edit", seg: "tous", subj: "", body: "" },
];
function fdCampHTML(L) {
  const mail = L.filter((p) => fdReach(p, "email")).length, sms = L.filter((p) => fdReach(p, "sms")).length, yes = L.filter((p) => fdReach(p, "email") || fdReach(p, "sms")).length;
  const abs = L.filter(fdSeg("absents")[2]).length, bd = L.filter((p) => p.bdIn != null && p.bdIn <= 30).length;
  const ideas = [abs ? { t: `${fdPl(abs, "habitué")} pas revenu${abs > 1 ? "s" : ""} depuis 2 mois`, s: "Un petit mot avec un café offert les fait souvent revenir.", tpl: "manque", ic: "fdHeart", c: "var(--tomato)" } : null,
    bd ? { t: `${fdPl(bd, "anniversaire")} dans le mois`, s: "Le dessert offert, c'est une table réservée.", tpl: "anniv", ic: "fdCake", c: "var(--saffron-edge)" } : null,
    { t: "Votre nouvelle carte", s: "Prévenez ceux qui aiment votre cuisine.", tpl: "carte", ic: "book", c: "var(--accent)" }].filter(Boolean).slice(0, 3);
  const hero = `<div class="glass pad fd-chero st" style="--i:2"><div class="fd-ch"><span class="fd-cic">${ico("fdMega")}</span><div><b class="h3">Faites revenir vos clients</b><em>${yes ? `${fdPl(yes, "client")} ${yes > 1 ? "ont" : "a"} accepté vos nouvelles` : "Personne n'a encore accepté vos nouvelles"}</em></div></div>
    <div class="fd-cst"><div>${ico("fdMail")}<b class="mono">${mail}</b><em>par e-mail</em></div><div>${ico("fdSms")}<b class="mono">${sms}</b><em>par SMS</em></div></div>
    <button class="btn acc block" data-act="fdNew" ${yes ? "" : "disabled"}>${ico("fdMega")}Nouvelle campagne</button>
    <p class="fd-rgpd">${ico("fdShield")}<span>Seuls les clients qui ont dit oui reçoivent vos messages : la case sur votre page de réservation, ou leur accord noté dans leur fiche. Chaque e-mail a son lien de désinscription.</span></p></div>`;
  const idH = `<div class="fd-ideas st" style="--i:3">${ideas.map((x, i) => `<button class="glass fd-idea" data-act="fdNew" data-v="${x.tpl}" style="--c:${x.c};--j:${i}" ${yes ? "" : "disabled"}><span class="fd-idc">${ico(x.ic)}</span><b>${esc(x.t)}</b><em>${esc(x.s)}</em><span class="fd-ia">Préparer${ico("chev")}</span></button>`).join("")}</div>`;
  const C = FD.camps;
  const hist = `<div class="glass pad fd-hist st" style="--i:4"><span class="lbl">Campagnes envoyées</span>${C.length ? C.slice(0, 12).map((c) => `<div class="li fd-hl"><span class="fd-hic ${c.ch}">${ico(c.ch === "sms" ? "fdSms" : "fdMail")}</span><div class="tx"><b>${esc(c.title || "Campagne")}</b><em>${when(c.at)} · ${c.status === "envoi" ? `en cours, ${c.sent || 0} sur ${c.n}` : `${fdPl(c.sent != null ? c.sent : c.n, "client")}`}${c.via === "mail" ? " · depuis votre messagerie" : c.via === "phone" ? " · depuis le téléphone" : c.via === "demo" ? " · démo" : ""}</em></div>${c.status === "envoi" && c.ch === "sms" ? `<button class="btn soft sm" data-act="fdSmsResume" data-id="${esc(c.id)}">Reprendre</button>` : ""}</div>`).join("") : `<p class="sub fd-z">Aucune campagne pour l'instant.</p>`}</div>`;
  return `<div class="cols"><div>${hero}${idH}</div><div>${hist}${fdConsentHelp()}</div></div>`;
}
function fdConsentHelp() {
  return `<div class="glass pad fd-help st" style="--i:5"><span class="lbl">Récolter des « oui »</span>
    <div class="fd-hrow"><span class="fd-hnum">1</span><div><b>Sur votre page de réservation</b><em>Une case « Recevoir les nouvelles du restaurant », jamais cochée d'avance.</em></div></div>
    <div class="fd-hrow"><span class="fd-hnum">2</span><div><b>Au restaurant</b><em>Le client est d'accord ? Ouvrez sa fiche et activez e-mail ou SMS : la date est notée.</em></div></div>
    <div class="fd-hrow"><span class="fd-hnum">3</span><div><b>Gratuit</b><em>Les SMS partent de votre téléphone, les e-mails par Growth Gusto. Rien à payer en plus.</em></div></div></div>`;
}

/* ───────── client sheet ───────── */
function fdOpenSheet(k) {
  const p = fdById(k); if (!p) return;
  FD.ed = { id: k, name: p.name, phone: p.phone, email: p.email, vip: p.vip, notes: p.notes, allergens: [...p.allergens], bday: p.bday, optEmail: !!p.optEmail, optSms: !!p.optSms, o0: [!!p.optEmail, !!p.optSms], del: false, all: false };
  fdPaint();
}
function fdPaint() {
  const e = FD.ed; if (!e) return; const p = fdById(e.id) || { visits: 0, hist: [], stamps: 0, noshow: 0, cancel: 0, spent: 0, tier: ["Contact", "ct"] }; const cfg = fdCfg(), money = fdMoney();
  const safeDish = e.allergens.length && typeof recipeAllergens === "function" ? S.notes.filter((n) => n.carte && (n.cat || "") === "Recettes" && !recipeAllergens(n, true).some((a) => e.allergens.includes(a))) : [];
  const [bm, bdd] = /^(\d{2})-(\d{2})$/.test(e.bday || "") ? e.bday.split("-") : ["", ""];
  const H = p.hist.slice(0, e.all ? 40 : 6);
  const hrow = (h) => { const I = { resa: ["resa", "Réservation"], cmd: ["fdBag", "À emporter"], pass: ["fdStamp", "Passage au comptoir"], gift: ["fdGift", "Récompense offerte"] }[h.k];
    const st = h.k === "resa" ? (RS_ST[h.b.status] || RS_ST.avenir) : null; const sub = h.k === "resa" ? `${+h.b.covers || 0} pers. · ${h.t}` : h.k === "cmd" ? (money ? fdEur(h.o.total) : `${(h.o.items || []).reduce((a, x) => a + (+x.q || 0), 0)} articles`) : h.k === "gift" ? esc(cfg.reward) : "";
    return `<div class="fd-hi ${h.k}"><span class="fd-hii">${ico(I[0])}</span><div><b>${I[1]}</b><em>${shortDate(h.day)}${sub ? ` · ${sub}` : ""}</em></div>${st ? `<span class="rs-stp ${st.k}">${st.t}</span>` : ""}</div>`; };
  const consent = (k, ic, t) => { const on = e[k]; const at = p.optAt ? new Date(p.optAt) : null; const info = on ? (e.o0[k === "optEmail" ? 0 : 1] && at ? `Depuis le ${shortDate(dayKey(at))}${p.optSrc ? ` · ${p.optSrc}` : ""}` : "Accord donné aujourd'hui") : "Ne recevra pas vos campagnes";
    return `<button class="rs-tog fd-ctog${on ? " on" : ""}" data-act="fdOpt" data-v="${k}" aria-pressed="${on}"><span class="fd-cti">${ico(ic)}</span><span><b>${t}</b><em>${esc(info)}</em></span><i></i></button>`; };
  openSheet(`<div class="fd-sh">
    <div class="fd-shh">${fdAva({ name: e.name, vip: e.vip }, 58)}<div class="fd-shn"><input class="fd-nm" id="fdNm" value="${esc(e.name)}" maxlength="60" aria-label="Nom" placeholder="Nom du client"><span class="fd-tier ${p.tier[1]}">${p.tier[0]}</span></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="fd-ct">${e.phone ? `<a class="btn soft sm" href="tel:${esc(fdTel(e.phone))}">${ico("rsPhone")}Appeler</a><a class="btn soft sm" href="sms:${esc(fdTel(e.phone))}">${ico("fdSms")}SMS</a>` : ""}${fdMailOk(e.email) ? `<a class="btn soft sm" href="mailto:${esc(e.email)}">${ico("fdMail")}E-mail</a>` : ""}
      <button class="btn sm fd-vipb${e.vip ? " on" : ""}" data-act="fdVip" aria-pressed="${e.vip}">${ico("fdCrown")}VIP</button></div>
    <div class="fd-kpi"><div><b class="mono">${p.visits}</b><em>visite${p.visits > 1 ? "s" : ""}</em></div><div><b class="mono">${p.last ? shortDate(p.last) : "–"}</b><em>dernière</em></div><div class="${p.noshow ? "bad" : ""}"><b class="mono">${p.noshow}</b><em>no-show</em></div>${money && p.spent ? `<div><b class="mono">${fdEur(p.spent)}</b><em>à emporter</em></div>` : `<div><b class="mono">${p.cancel}</b><em>annulée${p.cancel > 1 ? "s" : ""}</em></div>`}</div>
    ${p.next ? `<div class="fd-next">${ico("resa")}<span>Prochaine table <b>${esc((rsRel(p.next.date) || rsLong(p.next.date)).toLowerCase())} à ${p.next.time}</b> · ${+p.next.covers || 0} pers.</span></div>` : ""}
    ${cfg.on !== false ? `<div class="fd-sec">${fdCardHTML(cfg, p.stamps, false)}<div class="fd-cact">${fdReward(p, cfg) ? `<button class="btn fd-gbtn" data-act="fdGive" data-id="${esc(e.id)}">${ico("fdGift")}Récompense offerte</button>` : ""}<button class="btn soft" data-act="fdPassOne" data-id="${esc(e.id)}">${ico("plus")}Un passage</button></div></div>` : ""}
    <div class="fd-sec"><span class="lbl fd-lb al">${ico("alert")}Allergies</span><div class="fd-als">${ALLERGENS.map((a) => `<button class="chip fd-al${e.allergens.includes(a.id) ? " on" : ""}" data-act="fdAl" data-v="${a.id}" aria-pressed="${e.allergens.includes(a.id)}">${esc(a.t)}</button>`).join("")}</div>
      ${e.allergens.length && typeof recipeAllergens === "function" ? `<div class="fd-safe">${ico("fdShield")}<span>${safeDish.length ? `<b>${fdPl(safeDish.length, "plat")} sans risque à la carte :</b> ${safeDish.slice(0, 6).map((n) => esc(n.title)).join(", ")}${safeDish.length > 6 ? "…" : ""}` : "Aucun plat de la carte n'est sûr pour lui : prévenez le chef."}</span></div>` : ""}
      ${p.notesB && p.notesB.length && !e.notes ? `<p class="fd-nb">Noté sur ses réservations : « ${esc(p.notesB[0])} »</p>` : ""}</div>
    <div class="fd-sec fd-two"><label class="field"><span>Anniversaire</span><div class="fd-bd"><select class="input" id="fdBdD" aria-label="Jour"><option value="">Jour</option>${Array.from({ length: 31 }, (_, i) => `<option value="${pad(i + 1)}" ${bdd === pad(i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}</select><select class="input" id="fdBdM" aria-label="Mois"><option value="">Mois</option>${fdMonthsFr.map((m, i) => `<option value="${pad(i + 1)}" ${bm === pad(i + 1) ? "selected" : ""}>${m}</option>`).join("")}</select></div></label>
      <label class="field"><span>Téléphone</span><input class="input" id="fdPh" type="tel" inputmode="tel" value="${esc(e.phone)}" maxlength="25" placeholder="06 12 34 56 78" ${fdKey(e.phone) === e.id ? "readonly" : ""}></label>
      <label class="field"><span>E-mail</span><input class="input" id="fdEm" type="email" inputmode="email" value="${esc(e.email)}" maxlength="120" placeholder="client@exemple.fr"></label></div>
    <label class="field fd-sec"><span>Notes, préférences</span><textarea class="input" id="fdNo" rows="2" maxlength="300" placeholder="Aime la table près de la fenêtre, toujours un verre de blanc…">${esc(e.notes)}</textarea></label>
    <div class="fd-sec"><span class="lbl">Vos nouvelles et offres</span>${consent("optEmail", "fdMail", "Accepte les e-mails")}${consent("optSms", "fdSms", "Accepte les SMS")}</div>
    ${H.length ? `<div class="fd-sec"><span class="lbl">Historique</span><div class="fd-hl2">${H.map(hrow).join("")}</div>${p.hist.length > H.length ? `<button class="btn ghost sm block" data-act="fdAll">Tout l'historique (${p.hist.length})</button>` : ""}</div>` : ""}
    <button class="btn acc block fd-save" data-act="fdSave">${ico("check")}Enregistrer</button>
    ${fdMgr() ? `<div class="fd-rg"><button class="btn ghost sm" data-act="fdExport1">${ico("fdDl")}Ses données</button><button class="btn ghost sm fd-delb${e.del ? " arm" : ""}" data-act="fdDel">${ico("trash")}${e.del ? "Toucher encore pour effacer" : "Effacer ce client"}</button></div>` : ""}
  </div>`, (b) => { const keep = () => fdKeep(b); $$("input,textarea,select", b).forEach((x) => x.addEventListener("input", keep)); });
}
function fdKeep(b = $("#sheetBody")) {
  const e = FD.ed; if (!e || !b) return; const v = (id) => ((b.querySelector("#" + id) || {}).value ?? "");
  e.name = v("fdNm").trim(); e.phone = v("fdPh").trim(); e.email = v("fdEm").trim(); e.notes = v("fdNo").trim(); const d = v("fdBdD"), m = v("fdBdM"); e.bday = d && m ? `${m}-${d}` : "";
}

/* ───────── add a client ───────── */
function fdAddPaint() {
  const a = FD.add; if (!a) return;
  openSheet(`<div class="fd-sh"><div class="fd-shh"><span class="fd-cic">${ico("fdUsers")}</span><div style="flex:1"><b class="h3">Nouveau client</b><em class="sub">Le téléphone ou l'e-mail suffit</em></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="field"><span>Nom</span><input class="input" id="fdAn" value="${esc(a.name)}" maxlength="60" placeholder="Camille Martin" autocomplete="off"></label>
    <div class="grid2"><label class="field"><span>Téléphone</span><input class="input" id="fdAp" type="tel" inputmode="tel" value="${esc(a.phone)}" maxlength="25" placeholder="06 12 34 56 78"></label>
      <label class="field"><span>E-mail</span><input class="input" id="fdAe" type="email" inputmode="email" value="${esc(a.email)}" maxlength="120" placeholder="camille@mail.fr"></label></div>
    <button class="rs-tog${a.ok ? " on" : ""}" data-act="fdAddOk" aria-pressed="${a.ok}"><span><b>Accepte vos nouvelles</b><em>Le client vient de vous dire oui (e-mail et SMS)</em></span><i></i></button>
    <button class="rs-tog${a.pass ? " on" : ""}" data-act="fdAddPass" aria-pressed="${a.pass}"><span><b>Il est venu aujourd'hui</b><em>Son premier tampon sur la carte</em></span><i></i></button>
    <p class="fd-err" id="fdAerr"></p>
    <button class="btn acc block" data-act="fdAddSave">${ico("check")}Créer la fiche</button></div>`, (b) => { ["fdAn", "fdAp", "fdAe"].forEach((id) => { const i = $("#" + id, b); i && i.addEventListener("input", () => { a[{ fdAn: "name", fdAp: "phone", fdAe: "email" }[id]] = i.value; }); }); });
}

/* ───────── « Noter un passage » (the counter) ───────── */
function fdPassPaint() {
  const P = FD.pass; if (!P) return; const q = P.q.trim(), L = fdPeople(); const cfg = fdCfg();
  const hits = q ? L.filter((p) => fdMatch(p, q)).slice(0, 6) : L.filter((p) => p.visits).slice(0, 6);
  const isNum = q.replace(/\D/g, "").length >= 9 && !hits.some((p) => fdKey(p.phone) === fdKey(q));
  openSheet(`<div class="fd-sh fd-ps"><div class="fd-shh"><span class="fd-cic sf">${ico("fdStamp")}</span><div style="flex:1"><b class="h3">Noter un passage</b><em class="sub">Un tampon sur sa carte</em></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="fd-search big">${ico("fdSearch")}<input class="input" id="fdPq" value="${esc(P.q)}" type="search" placeholder="Nom ou téléphone" autocomplete="off" enterkeyhint="search"></label>
    <div class="fd-pl" id="fdPl">${fdPassRows(hits, cfg, q, isNum)}</div></div>`, (b) => {
    const i = $("#fdPq", b); if (!i) return; if (DESK_MQ.matches) setTimeout(() => i.focus(), 300);
    i.addEventListener("input", () => { P.q = i.value; const t = i.value.trim(); const h = t ? fdPeople().filter((p) => fdMatch(p, t)).slice(0, 6) : fdPeople().filter((p) => p.visits).slice(0, 6); const n = t.replace(/\D/g, "").length >= 9 && !h.some((p) => fdKey(p.phone) === fdKey(t)); $("#fdPl", b).innerHTML = fdPassRows(h, fdCfg(), t, n); });
  });
}
function fdPassRows(hits, cfg, q, isNum) {
  return hits.map((p) => `<button class="fd-prow" data-act="fdPassOne" data-id="${esc(p.id)}">${fdAva(p, 40)}<span class="tx"><b>${esc(p.name || p.phone)}</b><em>${p.stamps}/${cfg.goal} tampons${fdReward(p, cfg) ? " · récompense à offrir" : ""}</em></span><span class="fd-plus">${ico("plus")}</span></button>`).join("")
    + (isNum ? `<button class="fd-prow new" data-act="fdPassNew">${ico("plus")}<span class="tx"><b>Nouveau client</b><em>${esc(q)}</em></span></button>` : "")
    + (!hits.length && !isNum ? `<p class="sub fd-z">${q ? "Personne avec ce nom. Tapez son numéro pour créer sa carte." : "Tapez un nom ou un numéro."}</p>` : "");
}
async function fdAddPass(k) {
  const d = fdDocs().find((x) => x.id === k) || {}; const passes = (Array.isArray(d.passes) ? d.passes : []).concat(Date.now()).slice(-120);
  await fdWrite(k, { passes }); logEvent("client", `a noté un passage de ${(fdById(k) || {}).name || "client"}`);
}
function fdStampFx(p) {
  const cfg = fdCfg(); const full = fdReward(p, cfg);
  SFX.init && SFX.init(); full ? (SFX.done(), burst()) : SFX.ok(); buzz(full ? [12, 40, 12] : 10);
  toast(full ? `${firstName(p.name) || "Carte"} : carte pleine, ${cfg.reward.toLowerCase()} !` : `Tampon ajouté · ${Math.min(p.stamps, cfg.goal)}/${cfg.goal}`);
}

/* ───────── campaign composer ───────── */
function fdCompPaint() {
  const c = FD.comp; if (!c) return; const L = fdPeople(), f = fdSeg(c.seg)[2];
  const to = L.filter((p) => f(p) && fdReach(p, c.ch)); c.to = to.map((p) => p.id);
  const segs = FD_SEGS.filter((s) => s[3]).map(([k, t, fn]) => { const n = L.filter((p) => fn(p) && fdReach(p, c.ch)).length; return `<button class="chip${c.seg === k ? " on" : ""}" data-act="fdCSeg" data-v="${k}" ${n || c.seg === k ? "" : "disabled"}>${t}<span class="fd-cn">${n}</span></button>`; }).join("");
  const ex = to[0] || L[0] || { name: "Camille" }; const txt = fdFill(c.body, ex) + (c.ch === "sms" ? fdStop() : "");
  const srv = c.ch === "email" && DB.mode === "db", nSms = Math.max(1, Math.ceil(txt.length / 160));
  openSheet(`<div class="fd-sh fd-comp"><div class="fd-shh"><span class="fd-cic">${ico("fdMega")}</span><div style="flex:1"><b class="h3">Nouvelle campagne</b><em class="sub">Envoyée seulement aux clients qui ont dit oui</em></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="fd-tpls">${FD_TPL.map((t) => `<button class="fd-tpl${c.tpl === t.k ? " on" : ""}" data-act="fdTpl" data-v="${t.k}"><span>${ico(t.ic)}</span>${esc(t.t)}</button>`).join("")}</div>
    <div class="seg fd-ch2"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${c.ch === "sms" ? "100%" : "0"})"></span><button class="${c.ch === "email" ? "on" : ""}" data-act="fdCh" data-v="email">${ico("fdMail")}E-mail</button><button class="${c.ch === "sms" ? "on" : ""}" data-act="fdCh" data-v="sms">${ico("fdSms")}SMS</button></div>
    <div class="field"><span>Pour qui ?</span><div class="fd-chips wrap">${segs}</div></div>
    ${c.ch === "email" ? `<label class="field"><span>Objet</span><input class="input" id="fdCs" value="${esc(c.subj)}" maxlength="90" placeholder="Une bonne nouvelle"></label>` : ""}
    <label class="field"><span>Message <button class="fd-ins" data-act="fdIns">+ {prénom}</button></span><textarea class="input" id="fdCb" rows="4" maxlength="${c.ch === "sms" ? 450 : 1500}" placeholder="Bonjour {prénom}, …">${esc(c.body)}</textarea></label>
    <div class="fd-prev ${c.ch}"><span class="lbl">Aperçu pour ${esc(firstName(ex.name) || "un client")}</span>${c.ch === "sms" ? `<div class="fd-bub" id="fdPv">${esc(txt)}</div><em class="fd-pvn" id="fdPvn">${txt.length} caractères · ${fdPl(nSms, "SMS", "SMS")} par client</em>` : `<div class="fd-mpv"><b id="fdPs">${esc(fdFill(c.subj, ex) || "Sans objet")}</b><div id="fdPv">${esc(txt)}</div><a>Réserver une table</a><small>Se désinscrire</small></div>`}</div>
    <div class="fd-how">${ico(c.ch === "sms" ? "rsPhone" : srv ? "fdMail" : "fdMail")}<span>${c.ch === "sms" ? "Les SMS partent de votre téléphone, un par un, en un geste : gratuit." : srv ? "Envoyé par Growth Gusto au nom de votre restaurant, avec un lien de désinscription. Gratuit." : DB.mode === "demo" ? "Démo : rien ne part vraiment." : "Votre messagerie s'ouvre avec les adresses en copie cachée."}</span></div>
    <button class="btn acc block" data-act="fdSend" ${to.length && c.body.trim() && (c.ch === "sms" || c.subj.trim()) ? "" : "disabled"}>${ico(c.ch === "sms" ? "fdSms" : "fdMail")}${to.length ? `Envoyer à ${fdPl(to.length, "client")}` : "Personne à qui envoyer"}</button></div>`, (b) => {
    const s = $("#fdCs", b), t = $("#fdCb", b), btn = $("[data-act=fdSend]", b);
    const up = () => { if (s) c.subj = s.value; if (t) c.body = t.value; const tx = fdFill(c.body, ex) + (c.ch === "sms" ? fdStop() : ""); const pv = $("#fdPv", b); if (pv) pv.textContent = tx; const ps = $("#fdPs", b); if (ps) ps.textContent = fdFill(c.subj, ex) || "Sans objet"; const pn = $("#fdPvn", b); if (pn) pn.textContent = `${tx.length} caractères · ${fdPl(Math.max(1, Math.ceil(tx.length / 160)), "SMS", "SMS")} par client`; if (btn) btn.disabled = !(c.to.length && c.body.trim() && (c.ch === "sms" || c.subj.trim())); };
    s && s.addEventListener("input", up); t && t.addEventListener("input", up);
  });
}
const fdStop = () => `\n${(S.resto && S.resto.name) || "Le restaurant"} · Répondez STOP pour ne plus recevoir nos messages`;
/* {prénom} → the first name; without one, « Bonjour {prénom}, » becomes « Bonjour, » */
function fdFill(t, p) { const fn = firstName((p && p.name) || ""); return String(t || "").replace(/(,?\s?)\{pr[ée]nom\}/gi, (m, s) => (fn ? s + fn : "")); }

async function fdCampCreate(c, via) {
  const T = FD_TPL.find((t) => t.k === c.tpl) || {}; const title = T.k === "libre" || !T.t ? (c.subj || c.body).trim().slice(0, 50) || "Campagne" : T.t;
  const id = await safe(DB.add("campaigns", { title, subject: c.subj || "", body: c.body, ch: c.ch, seg: c.seg, n: c.to.length, to: c.to, at: Date.now(), by: S.me.name || "", uid: S.me.id, via, status: via === "demo" ? "envoyee" : "envoi", sent: via === "demo" ? c.to.length : 0, done: [] }));
  logEvent("client", `a lancé la campagne « ${c.subj || c.tpl} » (${c.to.length} clients, ${c.ch === "sms" ? "SMS" : "e-mail"})`, { ref: id });
  return id;
}
async function fdCall(op, data) {
  if (DB.mode !== "db") throw Object.assign(new Error("local"), { code: "local" });
  if (!(window.firebase && firebase.functions)) await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  const r = await firebase.app().functions("europe-west9").httpsCallable("clientsApi", { timeout: 60000 })({ op, rid: S.rid, ...(data || {}) }); return (r && r.data) || {};
}

/* SMS from the phone: one client at a time, the message pre-filled; comes back to the next one */
function fdSmsPaint() {
  const Q = FD.sms; if (!Q) return; const c = FD.camps.find((x) => x.id === Q.cid) || Q.camp; const left = Q.list.filter((k) => !Q.done.includes(k));
  if (!left.length) { closeSheet(true); SFX.done(); burst(); toast(`Campagne envoyée à ${fdPl(Q.done.length, "client")}`); DB.update("campaigns", Q.cid, { status: "envoyee", sent: Q.done.length, done: Q.done }).catch(() => {}); FD.sms = null; return; }
  const p = fdById(left[0]) || { name: "Client", phone: "" }; const txt = fdFill(c.body, p) + fdStop(); const n = Q.done.length;
  const href = `sms:${fdTel(p.phone)}${IS_IOS ? "&" : "?"}body=${encodeURIComponent(txt)}`;
  openSheet(`<div class="fd-sh fd-smsq"><div class="fd-shh"><span class="fd-cic">${ico("fdSms")}</span><div style="flex:1"><b class="h3">${esc(c.title || "Campagne SMS")}</b><em class="sub">${n} envoyé${n > 1 ? "s" : ""} sur ${Q.list.length}</em></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="fd-qbar"><i style="width:${(n / Q.list.length) * 100}%"></i></div>
    <div class="fd-qwho">${fdAva(p, 54)}<div><b class="h3">${esc(p.name || p.phone)}</b><em>${esc(p.phone)}</em></div></div>
    <div class="fd-bub">${esc(txt)}</div>
    <a class="btn acc block fd-qgo" href="${esc(href)}" data-act="fdSmsGo">${ico("fdSms")}Ouvrir le SMS pour ${esc(firstName(p.name) || "ce client")}</a>
    <div class="grid2"><button class="btn soft" data-act="fdSmsSkip">Passer</button><button class="btn soft" data-act="fdSmsDone">${ico("check")}Envoyé, suivant</button></div>
    <p class="fd-z sub">Votre appli Messages s'ouvre avec le texte prêt. Appuyez sur Envoyer, puis revenez ici.</p></div>`);
}
/* e-mail from the restaurant's own mail app: addresses in Cci, 40 per message (mail apps cut longer lists) */
function fdMailPaint() {
  const M = FD.mail; if (!M) return; const L = M.list.map((k) => fdById(k)).filter((p) => p && fdMailOk(p.email)); const B = []; for (let i = 0; i < L.length; i += 40) B.push(L.slice(i, i + 40));
  const body = fdFill(M.camp.body, { name: "" }) + `\n\n—\n${(S.resto && S.resto.name) || ""}\nVous recevez ce message car vous avez accepté nos nouvelles. Pour ne plus les recevoir, répondez simplement « STOP ».`;
  openSheet(`<div class="fd-sh"><div class="fd-shh"><span class="fd-cic">${ico("fdMail")}</span><div style="flex:1"><b class="h3">Envoyer depuis votre messagerie</b><em class="sub">${fdPl(L.length, "adresse")} en copie cachée</em></div><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    ${B.map((b, i) => `<a class="btn ${M.done.includes(i) ? "soft" : "acc"} block" data-act="fdMailGo" data-v="${i}" href="mailto:?bcc=${encodeURIComponent(b.map((p) => p.email.trim()).join(","))}&subject=${encodeURIComponent(fdFill(M.camp.subj, { name: "" }))}&body=${encodeURIComponent(body)}">${M.done.includes(i) ? ico("check") : ico("fdMail")}${B.length > 1 ? `Envoi ${i + 1} sur ${B.length} · ` : ""}${fdPl(b.length, "client")}</a>`).join("")}
    <p class="fd-z sub">Le {prénom} est retiré : un même message part à tous. Avec un compte Growth Gusto, chaque e-mail est personnalisé et part tout seul.</p>
    <button class="btn soft block" data-act="fdMailFin">${ico("check")}C'est envoyé</button></div>`);
}

/* ───────── demo: regulars with allergies, birthdays and consent; two past campaigns ───────── */
function fdSeedDemo() {
  const path = `restos/${S.rid}/clients`; const D = (DB.local[path] ||= {}); if (D._fd) return;
  const now = Date.now(), today = dayKey(), md = (n) => { const d = parseDay(addDays(today, n)); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const up = (ph, o) => { const k = fdKey(ph); D[k] = { ...(D[k] || {}), phone: ph, createdAt: now - 90 * FD_DAY, ...o, updatedAt: now - 3 * FD_DAY }; };
  up("06 12 48 77 31", { name: "Sophie Laurent", email: "sophie.laurent@mail.fr", vip: true, notes: "Aime la table 7, toujours un verre de Saint-Véran", allergens: ["fruitscoque"], bday: md(3), optEmail: true, optSms: true, optAt: now - 60 * FD_DAY, optSrc: "réservation en ligne", passes: [now - 45 * FD_DAY, now - 16 * FD_DAY, now - 2 * FD_DAY] });
  up("06 33 90 12 54", { name: "Hugo Mercier", email: "hugo.mercier@mail.fr", notes: "Toujours en terrasse", bday: md(18), optEmail: true, optSms: false, optAt: now - 40 * FD_DAY, optSrc: "noté par Marceau", passes: [now - 70 * FD_DAY, now - 33 * FD_DAY, now - 20 * FD_DAY, now - 11 * FD_DAY, now - 4 * FD_DAY] });
  up("07 61 05 44 18", { name: "Manon Girard", allergens: ["gluten"], optSms: true, optAt: now - 50 * FD_DAY, optSrc: "noté par Inès" });
  const extra = [["Claire Dubois", "06 71 82 93 04", "claire.dubois@mail.fr", ["lait"], md(1), 6, 92, true], ["Antoine Roux", "06 45 21 98 77", "antoine.roux@mail.fr", [], md(40), 9, 75, true], ["Léa Fournier", "07 82 14 66 30", "", ["crustaces", "mollusques"], "", 2, 88, true],
    ["Pierre Morel", "06 09 55 31 42", "pierre.morel@mail.fr", [], md(12), 11, 5, true], ["Emma Lambert", "06 28 73 40 19", "emma.lambert@mail.fr", [], "", 4, 70, false], ["Julien Garnier", "06 54 30 87 12", "j.garnier@mail.fr", ["sesame"], md(26), 3, 64, true],
    ["Chloé Bonnet", "07 16 92 48 35", "chloe.bonnet@mail.fr", [], md(6), 1, 9, true], ["Nicolas Faure", "06 81 47 05 63", "", [], "", 7, 1, false], ["Sarah Perrin", "06 92 18 64 27", "sarah.perrin@mail.fr", ["oeufs"], md(55), 2, 120, true]];
  extra.forEach(([name, phone, email, allergens, bday, n, lastAgo, ok], i) => {
    const passes = Array.from({ length: n }, (_, j) => now - (lastAgo + j * (9 + (i % 4) * 3)) * FD_DAY - 3600e3 * (12 + j % 8));
    up(phone, { name, email, allergens, bday, passes, vip: i === 3, used: n >= 11 ? 10 : 0, gifts: n >= 11 ? [{ at: now - 30 * FD_DAY, by: "Marceau" }] : [], ...(ok ? { optEmail: !!email, optSms: true, optAt: now - (40 + i * 7) * FD_DAY, optSrc: i % 2 ? "réservation en ligne" : "noté par Inès" } : {}) });
  });
  Object.defineProperty(D, "_fd", { value: true, enumerable: false });
  /* regulars come back: about half the demo bookings belong to a known face (one phone = one person) */
  const bp = `restos/${S.rid}/bookings`, BK = DB.local[bp] || {};
  const pool = Object.values(D).filter((c) => c && c.phone && c.name).map((c) => [c.name, c.phone, c.email || ""]);
  ["Thomas Petit", "Julie Robert", "Marc Durand", "Inès Moreau", "Paul Simon", "Lucie Michel", "Karim Haddad", "Anaïs Leroy", "Vincent Blanc", "Zoé Henry", "Olivier Muller", "Margaux Roussel"].forEach((nm, i) => pool.push([nm, `06 ${pad(20 + i * 6)} ${pad(31 + i * 5)} ${pad(47 + i * 3)} ${pad(12 + i * 7)}`, i % 3 ? `${nm.split(" ")[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@mail.fr` : ""]));
  let j = 0; Object.keys(BK).sort().forEach((id, i) => { const b = BK[id]; if (!b || i % 9 > 4 || b.date >= today || !["arrive", "noshow"].includes(b.status) || (fdKey(b.phone) && D[fdKey(b.phone)])) return; const [nm, ph, em] = pool[(j++ * 7) % pool.length]; b.name = nm; b.phone = ph; if (em && b.email) b.email = em; if (b.status === "arrive" && j % 4 === 0) b.optin = true; });
  try { DB.emit(bp); } catch (e) {}
  const cp = `restos/${S.rid}/campaigns`; if (!DB.local[cp]) DB.local[cp] = {
    dc1: { title: "Nouvelle carte", subject: "La carte d'automne est arrivée", body: "Bonjour {prénom}, notre carte d'automne vient de sortir…", ch: "email", seg: "tous", n: 9, sent: 9, to: [], at: now - 21 * FD_DAY, by: "Marceau", via: "server", status: "envoyee" },
    dc2: { title: "Places ce soir", subject: "", body: "Bonsoir {prénom}, il nous reste quelques tables ce soir…", ch: "sms", seg: "habitues", n: 5, sent: 5, to: [], at: now - 8 * FD_DAY, by: "Inès Benali", via: "phone", status: "envoyee" },
  };
  try { DB.emit(path); } catch (e) {}
}

/* ───────── actions ───────── */
Object.assign(ACT, {
  fdTab: (a, id, v) => { FD.tab = v; SFX.tick(); buzz(3); refresh(true); },
  fdSegPick: (a, id, v) => { FD.seg = FD.seg === v && v !== "tous" ? "tous" : v; FD.n = 40; SFX.tick(); buzz(3); refresh(true); },
  fdMore: () => { FD.n += 40; SFX.tap(); const b = $("#fdRows"); if (b) b.innerHTML = fdRowsHTML(fdPeople()); },
  fdOpen: (a, id) => { SFX.tap(); fdOpenSheet(id); },
  fdVip: () => { fdKeep(); const e = FD.ed; if (!e) return; e.vip = !e.vip; e.vip ? SFX.ok() : SFX.tap(); buzz(5); fdPaint(); },
  fdAl: (a, id, v) => { fdKeep(); const e = FD.ed; if (!e) return; const i = e.allergens.indexOf(v); i >= 0 ? e.allergens.splice(i, 1) : e.allergens.push(v); SFX.tick(); buzz(4); fdPaint(); },
  fdOpt: (a, id, v) => { fdKeep(); const e = FD.ed; if (!e) return; e[v] = !e[v]; e[v] ? SFX.ok() : SFX.tap(); buzz(5); fdPaint(); },
  fdAll: () => { fdKeep(); if (FD.ed) { FD.ed.all = true; fdPaint(); } },
  fdSave: async (a) => {
    fdKeep(); const e = FD.ed; if (!e) return; if (e.email && !fdMailOk(e.email)) { SFX.err(); toast("Cette adresse e-mail semble incomplète.", "err"); return; }
    const p = fdById(e.id) || {}; const patch = { name: e.name.slice(0, 60), phone: e.phone.slice(0, 25), email: e.email.slice(0, 120), vip: e.vip, notes: e.notes.slice(0, 300), allergens: e.allergens, bday: e.bday };
    if (e.optEmail !== !!p.optEmail || e.optSms !== !!p.optSms) { Object.assign(patch, { optEmail: e.optEmail, optSms: e.optSms, optAt: Date.now(), optSrc: `noté par ${firstName(S.me.name) || "l'équipe"}` }); if (!e.optEmail && p.optEmail) patch.unsubAt = Date.now(); }
    a.disabled = true; try { await fdWrite(e.id, patch); } catch (x) { a.disabled = false; return; }
    FD.ed = null; closeSheet(true); SFX.done(); buzz(8); toast("Fiche client enregistrée"); refresh(true);
  },
  fdDel: async (a) => {
    const e = FD.ed; if (!e) return; if (!e.del) { fdKeep(); e.del = true; SFX.tap(); buzz(6); fdPaint(); setTimeout(() => { if (FD.ed === e && e.del) { e.del = false; if ($(".fd-delb.arm")) fdPaint(); } }, 4000); return; }
    a.disabled = true; const p = fdById(e.id); const today = dayKey();
    try {
      await safe(DB.del("clients", e.id));
      /* right to erasure: past bookings and orders keep their numbers, not the person */
      for (const h of (p && p.hist) || []) { if (h.k === "resa" && h.b && h.b.date < today) await DB.update("bookings", h.b.id, { name: "Client effacé", phone: "", email: "", notes: "", optin: false }).catch(() => {}); if (h.k === "cmd" && h.o && h.o.id) await DB.update("clientOrders", h.o.id, { name: "", phone: "" }).catch(() => {}); }
    } catch (x) { a.disabled = false; return; }
    logEvent("client", "a effacé une fiche client (RGPD)"); FD.ed = null; FD.memo = null; closeSheet(true); SFX.close(); toast("Client effacé, avec son historique"); refresh(true);
  },
  fdExport1: async () => {
    const p = FD.ed && fdById(FD.ed.id); if (!p) return; const al = p.allergens.map((x) => (allergenOf(x) || {}).t || x).join(", ");
    const rows = [["Champ", "Valeur"], ["Nom", p.name], ["Téléphone", p.phone], ["E-mail", p.email], ["Anniversaire", fdBdayTx(p.bday)], ["Allergies", al], ["Notes", p.notes], ["VIP", p.vip ? "oui" : "non"], ["Accepte les e-mails", p.optEmail ? "oui" : "non"], ["Accepte les SMS", p.optSms ? "oui" : "non"], ["Accord donné le", p.optAt ? new Date(p.optAt).toLocaleDateString("fr-FR") : ""], ["Origine de l'accord", p.optSrc], ["Visites", p.visits], ["Tampons", p.stamps], [], ["Historique", ""], ...p.hist.map((h) => [shortDate(h.day), h.k === "resa" ? `Réservation ${h.t} · ${h.b.covers} pers. · ${(RS_ST[h.b.status] || RS_ST.avenir).t}` : h.k === "cmd" ? `Commande à emporter · ${fdEur(h.o.total)}` : h.k === "pass" ? "Passage" : "Récompense offerte"])];
    const nm = `client-${String(p.name || p.id).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.csv`;
    if (typeof stkDownload === "function") return stkDownload(nm, rows); return saveCsv(nm, rows);
  },
  fdCsv: async () => {
    const L = fdPeople(); const rows = [["Nom", "Téléphone", "E-mail", "Visites", "Dernière visite", "No-show", "Tampons", "Anniversaire", "Allergies", "VIP", "Accepte e-mails", "Accepte SMS", "Notes"],
      ...L.map((p) => [p.name, p.phone, p.email, p.visits, p.last ? shortDate(p.last) : "", p.noshow, p.stamps, fdBdayTx(p.bday), p.allergens.map((x) => (allergenOf(x) || {}).t || x).join(", "), p.vip ? "oui" : "", p.optEmail ? "oui" : "", p.optSms ? "oui" : "", p.notes])];
    if (typeof stkDownload === "function") return stkDownload(`clients-${dayKey()}.csv`, rows); return saveCsv(`clients-${dayKey()}.csv`, rows);
  },
  /* add */
  fdAdd: (a, id, v) => { SFX.tap(); FD.add = { name: "", phone: v || "", email: "", ok: false, pass: false }; fdAddPaint(); setTimeout(() => { const i = $("#fdAn"); if (i && DESK_MQ.matches) i.focus(); }, 350); },
  fdAddOk: () => { const a = FD.add; if (!a) return; a.ok = !a.ok; a.ok ? SFX.ok() : SFX.tap(); fdAddPaint(); },
  fdAddPass: () => { const a = FD.add; if (!a) return; a.pass = !a.pass; a.pass ? SFX.ok() : SFX.tap(); fdAddPaint(); },
  fdAddSave: async (b) => {
    const a = FD.add; if (!a) return; const err = (t) => { SFX.err(); const e = $("#fdAerr"); if (e) e.textContent = t; };
    const name = a.name.trim(), phone = a.phone.trim(), email = a.email.trim(); if (name.length < 2) return err("Le nom du client, s'il vous plaît.");
    const k = fdKey(phone) || (fdMailOk(email) ? fdMailKey(email) : ""); if (!k) return err(phone ? "Ce numéro semble incomplet." : "Un téléphone ou un e-mail, pour le retrouver.");
    if (email && !fdMailOk(email)) return err("Cette adresse e-mail semble incomplète.");
    const ex = fdById(k); if (ex && ex.doc) { FD.add = null; SFX.tap(); toast(`${ex.name || "Ce client"} est déjà dans le fichier`, "info"); fdOpenSheet(k); return; }
    b.disabled = true;
    try { await fdWrite(k, { name: name.slice(0, 60), phone: phone.slice(0, 25), email: email.slice(0, 120), src: "main", ...(a.ok ? { optEmail: !!email, optSms: !!fdKey(phone), optAt: Date.now(), optSrc: `noté par ${firstName(S.me.name) || "l'équipe"}` } : {}), ...(a.pass ? { passes: [Date.now()] } : {}) }); } catch (x) { b.disabled = false; return; }
    logEvent("client", `a ajouté ${name} au fichier clients`); FD.add = null; closeSheet(true); SFX.done(); buzz(8); toast(`${firstName(name)} est dans votre fichier`); refresh(true);
  },
  /* loyalty */
  fdPass: () => { SFX.tap(); FD.pass = { q: "" }; fdPassPaint(); },
  fdPassOne: async (a, id) => {
    if (FD.ed) fdKeep(); a.disabled = true; try { await fdAddPass(id); } catch (x) { a.disabled = false; return; }
    const p = fdById(id); if (p) fdStampFx(p); a.disabled = false;
    if (FD.ed && FD.ed.id === id) fdPaint(); else if (FD.pass) { FD.pass = null; closeSheet(true); refresh(true); } else refresh(true);
  },
  fdPassNew: () => { const q = FD.pass ? FD.pass.q.trim() : ""; FD.pass = null; FD.add = { name: "", phone: q, email: "", ok: false, pass: true }; fdAddPaint(); setTimeout(() => { const i = $("#fdAn"); i && i.focus(); }, 350); },
  fdGive: async (a, id) => {
    if (FD.ed) fdKeep(); const p = fdById(id); const cfg = fdCfg(); if (!p || !fdReward(p, cfg)) return; a.disabled = true;
    const d = p.doc || {}; try { await fdWrite(id, { used: (+d.used || 0) + cfg.goal, gifts: (Array.isArray(d.gifts) ? d.gifts : []).concat({ at: Date.now(), by: S.me.name || "" }).slice(-30) }); } catch (x) { a.disabled = false; return; }
    logEvent("client", `a offert la récompense fidélité à ${p.name}`); SFX.done(); burst(); buzz([10, 50, 10]); toast(`${cfg.reward} pour ${firstName(p.name) || "le client"} · nouvelle carte`);
    if (FD.ed && FD.ed.id === id) fdPaint(); else refresh(true);
  },
  fdCfgTog: async (a, id, v) => {
    const c = fdCfg(); const val = v === "on" ? c.on === false : v === "bday" ? !c.bday : c[v] === false; if (v === "bday" && val && DB.mode === "local") { SFX.err(); toast("Avec un compte Growth Gusto : les e-mails partent du serveur.", "info"); return; }
    fdCfgKeep(); SFX[val ? "ok" : "tap"](); buzz(4); await fdCfgWrite({ [v]: val }); refresh(true);
  },
  fdGoal: async (a, id, v) => { fdCfgKeep(); const c = fdCfg(); const g = Math.min(20, Math.max(3, c.goal + +v)); if (g === c.goal) return; SFX.tick(); buzz(3); await fdCfgWrite({ goal: g }); refresh(true); },
  fdRwPick: async (a, id, v) => { SFX.tick(); await fdCfgWrite({ reward: v }); refresh(true); },
  fdCfgSave: async () => { fdCfgKeep(); await fdCfgWrite({}); SFX.done(); toast("Programme de fidélité enregistré"); refresh(true); },
  /* campaigns */
  fdNew: (a, id, v) => { const t = FD_TPL.find((x) => x.k === (v || "carte")) || FD_TPL[0]; SFX.tap(); FD.comp = { tpl: t.k, ch: "email", seg: t.seg, subj: t.subj, body: t.body, to: [] }; const L = fdPeople(); if (!L.some((p) => fdSeg(t.seg)[2](p) && fdReach(p, "email")) && L.some((p) => fdSeg(t.seg)[2](p) && fdReach(p, "sms"))) FD.comp.ch = "sms"; fdCompPaint(); },
  fdTpl: (a, id, v) => { const c = FD.comp; const t = FD_TPL.find((x) => x.k === v); if (!c || !t) return; Object.assign(c, { tpl: t.k, seg: t.seg, subj: t.subj, body: t.body }); SFX.tick(); buzz(3); fdCompPaint(); },
  fdCh: (a, id, v) => { const c = FD.comp; if (!c) return; c.ch = v; SFX.tick(); buzz(3); fdCompPaint(); },
  fdCSeg: (a, id, v) => { const c = FD.comp; if (!c) return; c.seg = v; SFX.tick(); buzz(3); fdCompPaint(); },
  fdIns: (a, id, v, ev) => { ev && ev.preventDefault(); const t = $("#fdCb"); if (!t) return; const s = t.selectionStart ?? t.value.length; t.value = t.value.slice(0, s) + "{prénom}" + t.value.slice(t.selectionEnd ?? s); t.focus(); t.dispatchEvent(new Event("input")); SFX.tick(); },
  fdSend: async (a) => {
    const c = FD.comp; if (!c || !c.to.length) return; a.disabled = true;
    if (DB.mode === "demo") { await fdCampCreate(c, "demo").catch(() => {}); FD.comp = null; closeSheet(true); SFX.done(); burst(); toast(`Démo : la campagne serait partie à ${fdPl(c.to.length, "client")}`); FD.tab = "camp"; refresh(true); return; }
    if (c.ch === "sms") { let cid; try { cid = await fdCampCreate(c, "phone"); } catch (x) { a.disabled = false; return; } FD.sms = { cid, list: c.to.slice(), done: [], camp: { ...c, title: (FD_TPL.find((t) => t.k === c.tpl) || {}).t } }; FD.comp = null; fdSmsPaint(); return; }
    if (DB.mode === "db") {
      let cid; try { cid = await fdCampCreate(c, "server"); } catch (x) { a.disabled = false; return; }
      a.innerHTML = `<span class="fd-spin"></span>Envoi en cours…`;
      try { const r = await fdCall("send", { cid }); FD.comp = null; closeSheet(true); SFX.done(); burst(); toast(r.queued ? `Envoyé à ${fdPl(r.sent || 0, "client")} · le reste part demain matin` : `Campagne envoyée à ${fdPl(r.sent || c.to.length, "client")}`); FD.tab = "camp"; refresh(true); return; }
      catch (x) { console.warn("clientsApi", x); DB.update("campaigns", cid, { via: "mail" }).catch(() => {}); FD.mail = { cid, list: c.to.slice(), done: [], camp: c }; FD.comp = null; toast("L'envoi automatique n'est pas encore branché : votre messagerie prend le relais.", "info"); fdMailPaint(); return; }
    }
    let cid; try { cid = await fdCampCreate(c, "mail"); } catch (x) { a.disabled = false; return; } FD.mail = { cid, list: c.to.slice(), done: [], camp: c }; FD.comp = null; fdMailPaint();
  },
  fdSmsGo: (a) => { const Q = FD.sms; if (!Q) return; Q.opened = true; SFX.tap(); /* the link opens Messages; when the person comes back, the next client is ready */ },
  fdSmsDone: () => { const Q = FD.sms; if (!Q) return; const k = Q.list.find((x) => !Q.done.includes(x)); if (k) Q.done.push(k); Q.opened = false; SFX.ok(); buzz(5); DB.update("campaigns", Q.cid, { sent: Q.done.length, done: Q.done }).catch(() => {}); fdSmsPaint(); },
  fdSmsSkip: () => { const Q = FD.sms; if (!Q) return; const k = Q.list.find((x) => !Q.done.includes(x)); if (k) { Q.list = Q.list.filter((x) => x !== k); } SFX.tap(); fdSmsPaint(); },
  fdSmsResume: (a, id) => { const c = FD.camps.find((x) => x.id === id); if (!c) return; SFX.tap(); FD.sms = { cid: id, list: (c.to || []).slice(), done: (c.done || []).slice(), camp: c }; fdSmsPaint(); },
  fdMailGo: (a, id, v) => { const M = FD.mail; if (!M) return; if (!M.done.includes(+v)) M.done.push(+v); SFX.tap(); setTimeout(fdMailPaint, 600); },
  fdMailFin: () => { const M = FD.mail; if (!M) return; DB.update("campaigns", M.cid, { status: "envoyee", sent: M.list.length }).catch(() => {}); FD.mail = null; closeSheet(true); SFX.done(); toast("Campagne notée comme envoyée"); FD.tab = "camp"; refresh(true); },
});
function fdCfgKeep() { const r = $("#fdRw"), m = $("#fdBdM"); FD.cfgEd = { ...(r && r.value.trim() ? { reward: r.value.trim().slice(0, 60) } : {}), ...(m ? { bdayMsg: m.value.trim().slice(0, 400) } : {}) }; }
async function fdCfgWrite(patch) {
  const fidCfg = DB.clean({ ...fdCfg(), ...(FD.cfgEd || {}), ...patch }); FD.cfgEd = null;
  try { await safe(DB.update("restos", S.rid, { fidCfg })); if (S.resto) S.resto.fidCfg = fidCfg; FD.memo = null; } catch (e) {}
}
/* coming back from Messages: the SMS sheet asks « Envoyé, suivant » (we cannot know if it was sent) */
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && FD.sms && FD.sms.opened) { const b = $("[data-act=fdSmsDone]"); if (b) { b.classList.remove("soft"); b.classList.add("acc"); b.classList.add("fd-pulse"); } } });

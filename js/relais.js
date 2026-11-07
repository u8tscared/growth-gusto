/* Growth Gusto — area: relais (passer le relais, garder la trace, ouvrir et fermer les accès). Three small features that live together:
     « pa »  Passation de service : en fin de service, une note pour l'équipe suivante (ruptures, casse, client à rappeler, à préparer,
             à commander, infos) + l'humeur du service. L'équipe suivante la lit avant de commencer (à l'accueil, en prenant la main
             sur l'appareil du restaurant, en pointant son arrivée) et signe « J'ai lu ». Collection handovers :
             { day, slot: midi|soir, to: { day, slot }, mood: calme|charge|feu, items: [{ id, k, t, tel?, done?, doneBy?, doneAt? }],
               note, ok?, text (résumé pour la notification), at, uid, by, byId, reads: { [personId]: ts }, notified? }
     « jr »  Journal des actions : tout ce qui est fait dans l'app (events), signé et horodaté, filtrable par personne, type et période.
             Les gestes sensibles (annulations, offerts, suppressions, modifications) sont comptés, avec leur montant, et l'app signale
             qui en fait nettement plus que les autres. Rien ne s'efface : firestore.rules n'autorise ni modification ni suppression
             (sauf l'annulation immédiate d'un geste par l'app, 15 minutes, et la suppression du restaurant par son propriétaire).
     « ax »  Accès temporaires : un extra, un stagiaire, un saisonnier a un accès qui se ferme tout seul à la date choisie.
             members/{id}.until (ms, 0 = sans limite) + tmp: { why: extra|stage|saison|rempl }. Copié de l'invitation à l'arrivée.
             firestore.rules : un membre dont until est passé ne lit plus rien du restaurant. Dans l'app : il disparaît des listes
             « qui prend la main », son écran affiche « Merci pour votre mission », et le gérant le retrouve dans « Accès terminés ». */
"use strict";

Object.assign(IC, {
  paBaton: ["f:M14.6 4.2 19.8 9.4 9.4 19.8 4.2 14.6z", "M14.6 4.2 19.8 9.4 9.4 19.8 4.2 14.6z", "M11.9 6.9l5.2 5.2", "M7.5 16.5 3.5 20.5", "M17 3l4 4"],
  paOut: ["f:M5 7.5h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z", "M5 7.5h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z", "M3.5 7.5h17", "M9 4h6", "M9.5 11.5l5 5", "M14.5 11.5l-5 5"],
  paCrack: ["f:M6.5 3.5h11l-1.6 15.2a2 2 0 0 1-2 1.8h-3.8a2 2 0 0 1-2-1.8z", "M6.5 3.5h11l-1.6 15.2a2 2 0 0 1-2 1.8h-3.8a2 2 0 0 1-2-1.8z", "M12.5 3.5l-1.8 4 2.6 2.3-2 4.2"],
  paPhone: ["f:M5 4h3.5l1.5 4-2 1.3a11 11 0 0 0 6.7 6.7L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z", "M5 4h3.5l1.5 4-2 1.3a11 11 0 0 0 6.7 6.7L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"],
  paPrep: ["f:M4 13.5h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M4 13.5h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M2.5 13.5h19", "M8 10c0-1.5 1-1.5 1-3S8 5.5 8 4", "M12 10c0-1.5 1-1.5 1-3s-1-1.5-1-3", "M16 10c0-1.5 1-1.5 1-3s-1-1.5-1-3"],
  paCart: ["f:M6.2 6.5h14.3l-1.8 7.6a1.5 1.5 0 0 1-1.5 1.1H8.3a1.5 1.5 0 0 1-1.5-1.2z", "M2.5 3.5h2.4l2.4 11.4a1.5 1.5 0 0 0 1.5 1.1h8.5", "M6.2 6.5h14.3l-1.8 7.6a1.5 1.5 0 0 1-1.5 1.1", "c:9.5,20,1.4", "c:17,20,1.4"],
  paInfo: ["f:M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "c:12,12,8.5", "M12 11v5.5", "M12 7.6h.01"],
  paCalm: ["f:M3.5 14.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1 0 1.7.3 2 .6V20H3.5z", "M3.5 9.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 2.5 2", "M3.5 14.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 2.5 2"],
  paBusy: ["f:M4 20V11h3.5v9zM10.25 20V6h3.5v14zM16.5 20V3.5H20V20z", "M4 20V11h3.5v9z", "M10.25 20V6h3.5v14z", "M16.5 20V3.5H20V20z"],
  paSpark: ["f:M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z", "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z", "M19 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"],
  jrLog: ["f:M5.5 3.5h10l3 3v14h-13z", "M15.5 3.5h-10v17h13v-14z", "M15.5 3.5v3h3", "M8.5 10h7", "M8.5 13.5h7", "M8.5 17h4"],
  jrUndo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  jrGift: ["f:M4 11h16v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z", "r:3,7.5,18,3.5,1", "M4 11v8.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V11", "M12 7.5V21", "M12 7.5S10.5 3 8 3.5 6.5 7.5 12 7.5z", "M12 7.5s1.5-4.5 4-4 1.5 4-4 4z"],
  jrFlag: ["f:M5 4h12.5l-2.5 4.5 2.5 4.5H5z", "M5 21V4", "M5 4h12.5l-2.5 4.5 2.5 4.5H5"],
  jrSearch: ["c:11,11,6.5", "M20.5 20.5 15.8 15.8"],
  axTimer: ["f:M7 3.5h10v2.2a5 5 0 0 1-2.3 4.2L12 12l-2.7-2.1A5 5 0 0 1 7 5.7z", "M6 2.5h12", "M6 21.5h12", "M7 3.5v2.2a5 5 0 0 0 2.3 4.2L12 12l2.7-2.1A5 5 0 0 0 17 5.7V3.5", "M7 20.5v-2.2a5 5 0 0 1 2.3-4.2L12 12l2.7 2.1a5 5 0 0 1 2.3 4.2v2.2"],
  axCap: ["f:M12 4 2.5 9 12 14l9.5-5z", "M12 4 2.5 9 12 14l9.5-5z", "M6.5 11.2v4.3c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.3", "M21.5 9v5"],
  axBolt: ["f:M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z", "M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"],
  axInf: ["M6.5 8.5c-2 0-3.5 1.6-3.5 3.5s1.5 3.5 3.5 3.5c3.5 0 7.5-7 11-7 2 0 3.5 1.6 3.5 3.5s-1.5 3.5-3.5 3.5c-3.5 0-7.5-7-11-7z"],
  axDoor: ["f:M6 3.5h9.5v17H6z", "M3.5 20.5h17", "M6 20.5v-17h9.5v17", "M12.5 12h.01", "M15.5 6.5l3 1v13"],
});

/* ───────────── menu: one NAV entry each, next to their neighbours (phone, tablet and computer share it) ───────────── */
(function rlNav() {
  const at = (r) => NAV.findIndex((n) => n[0] === r);
  if (!NAV.some((n) => n[0] === "passation")) { const c = at("consignes"); const p = c >= 0 ? c + 1 : at("pointeuse"); NAV.splice(p >= 0 ? p : NAV.length, 0, ["passation", "paBaton", "Passation de service"]); }
  if (!NAV.some((n) => n[0] === "journal")) { const e = at("equipe"); NAV.splice(e >= 0 ? e + 1 : NAV.length, 0, ["journal", "jrLog", "Journal des actions"]); }
  Object.assign(TAB_OF, { passation: "more", journal: "more" });
  /* « Prise en main » (js/lecons.js): one lesson per menu screen; run again once every script has loaded, whatever their order */
  const lecons = () => { if (typeof PC_LECONS === "object" && !PC_LECONS.passation) {
    PC_LECONS.passation = { t: "Passation de service", d: "En fin de service, un mot pour l'équipe suivante : ruptures, casse, client à rappeler. Elle le lit en arrivant et signe.", who: ["cuisine", "salle", "bar", "plonge", "boss"],
      steps: ["En fin de service, touchez « À passer » puis « Écrire la passation »", "En arrivant, ouvrez « Reçue », lisez et touchez « J'ai lu, je valide »", "Cochez ce qui est fait, puis « Clôturer » quand tout est traité"],
      q: ["Un client a oublié son écharpe et repasse demain. Où le noter pour l'équipe suivante ?", ["Dans la passation, en « Client à rappeler »", "Sur un post-it au passe", "Nulle part, elle s'en souviendra"], 0],
      tip: "Rien à signaler ? Un seul geste : l'équipe suivante le sait aussi.",
      sc: { k: "check", t: "Passation du midi", rows: [["Plus de bar de ligne", 1], ["Rappeler M. Bernard", 1], ["Fond de veau à refroidir", 0]] } };
    PC_LECONS.journal = { t: "Journal des actions", d: "Qui a annulé, offert ou modifié quoi, et quand, avec le montant. Rien ne s'efface.", who: ["boss"],
      steps: ["Choisissez la période : aujourd'hui, 7 jours, 30 jours", "Touchez « Gestes sensibles » pour voir annulations et offerts", "Touchez une ligne pour le détail, ou exportez"],
      q: ["Un serveur annule un plat déjà envoyé. Que garde le journal ?", ["Qui, quand, le plat, le motif et le montant", "Rien, c'est annulé", "Seulement le total de la soirée"], 0],
      tip: "« À regarder » n'accuse personne : c'est un repère pour en parler.",
      sc: { k: "list", t: "Journal des actions", rows: [["jrUndo", "Sarah · annulé 1 joue de bœuf", "18 €", "warn"], ["jrGift", "Sarah · offert 1 café", "2 €", "acc"], ["check", "Lucas · relevé du midi", "11:10", "ok"]] } };
  }
  try { if (typeof PC_FAMILLES !== "undefined" && Array.isArray(PC_FAMILLES)) { const f = PC_FAMILLES.find((x) => x[0] === "consignes"); if (f && !f[4].includes("passation")) f[4].push("passation"); const g = PC_FAMILLES.find((x) => x[0] === "salaires"); if (g && !g[4].includes("journal")) g[4].push("journal"); } } catch (e) {} };
  lecons(); document.addEventListener("DOMContentLoaded", lecons);
  /* « En service » and « Mon espace » (js/espaces.js) keep the handover in their « Équipe » corner */
  try { if (typeof ES_ALWAYS !== "undefined" && !ES_ALWAYS.includes("passation")) ES_ALWAYS.splice(1, 0, "passation"); } catch (e) {}
  try { if (typeof ES_MOI_SET !== "undefined" && !ES_MOI_SET.includes("passation")) ES_MOI_SET.push("passation"); } catch (e) {}
  try { if (typeof ES_WELL !== "undefined") Object.assign(ES_WELL, { passation: "w-sa", journal: "w-vi" }); } catch (e) {}
})();

/* ───────────── small bits ───────────── */
const rlPl = (n, w, ws) => `${n} ${n > 1 ? ws || w + "s" : w}`;
const rlTry = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
const rlEur = (v) => (typeof slEur === "function" ? slEur(v) : `${fmt(v || 0, 2)} €`);
const rlCap = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const RL_MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const rlDay = (k) => { const d = parseDay(k); return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${RL_MS[d.getMonth()]}` : ""; };
const rlDayRel = (k) => (k === dayKey() ? "aujourd'hui" : k === addDays(dayKey(), -1) ? "hier" : k === addDays(dayKey(), 1) ? "demain" : rlDay(k));
const rlMember = (id) => (S.members || []).find((m) => m.id === id) || null;
const rlName = (id, fb) => { const m = rlMember(id); return (m && m.name) || (S.profiles[id] && S.profiles[id].name) || fb || "Quelqu'un"; };
const rlReduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const rlIsMgr = () => { try { return DB.mode === "demo" && !S.demoAs ? true : ["gerant", "chef"].includes(myRole()); } catch (e) { return false; } };
/* who is acting: on a restaurant device, the person who took over; otherwise me */
function rlWho() { const a = rlTry(() => (typeof esActor === "function" ? esActor() : null), null); return a ? { id: a.id, name: a.name } : { id: S.me.id, name: S.me.name || rlName(S.me.id, "") }; }
/* a full-screen layer (the same shell for writing and reading the handover) */
function rlLayer(id, cls, label) {
  let el = $("#" + id);
  if (!el) { el = document.createElement("div"); el.id = id; el.className = "rl-layer " + cls; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", label); document.body.appendChild(el); }
  el.hidden = false; try { ["#app", "#tabbar"].forEach((s) => $(s) && $(s).setAttribute("inert", "")); } catch (e) {}
  return el;
}
function rlLayerClose(id, after) {
  const el = $("#" + id); if (!el) return; el.classList.remove("on"); el.classList.add("off");
  if (!$$(".rl-layer.on").length) { try { ["#app", "#tabbar"].forEach((s) => $(s) && $(s).removeAttribute("inert")); } catch (e) {} }
  setTimeout(() => { if (!el.classList.contains("on")) { el.hidden = true; el.innerHTML = ""; el.classList.remove("off"); } after && after(); }, 380);
}

/* ═══════════════════════════ PASSATION ═══════════════════════════ */
/* [title, icon, class, placeholder, verb for the summary] */
const PA_K = {
  rupture: ["Ruptures", "paOut", "rupt", "Plus de joue de bœuf, 2 tartes restantes"],
  casse: ["Casse et matériel", "paCrack", "casse", "La trancheuse accroche, 3 verres cassés"],
  rappel: ["Client à rappeler", "paPhone", "rappel", "M. Durand, réservation de samedi"],
  prep: ["À préparer", "paPrep", "prep", "Refaire la sauce au vin, éplucher les carottes"],
  commande: ["À commander", "paCart", "cmd", "Appeler la marée avant 10 h"],
  info: ["Info", "paInfo", "info", "La table 12 fête un anniversaire à 20 h"],
};
const PA_ORDER = ["rupture", "rappel", "casse", "prep", "commande", "info"];
const PA_MOOD = { calme: ["Calme", "paCalm", "Service tranquille"], charge: ["Chargé", "paBusy", "Ça a bien tourné"], feu: ["Coup de feu", "cfFlame", "On a été pris de vitesse"] };
const PA = { rid: null, rows: null, F: null, R: null, seen: new Set(), pend: false, rec: null };
const PA_SLOT = { midi: "midi", soir: "soir" };
const paSlotT = (s) => slotDu(s);
const paNext = (day = dayKey(), slot = slotNow()) => (slot === "midi" ? { day, slot: "soir" } : { day: addDays(day, 1), slot: "midi" });
function PA_ROWS() {
  if (!S.rid) return [];
  if (PA.rid !== S.rid) {
    PA.rid = S.rid; PA.rows = []; const rid = S.rid;
    try { DB.watch("handovers", { order: "at", dir: "desc", limit: 150 }, (rows) => { if (S.rid !== rid) return; PA.rows = (rows || []).sort((a, b) => (b.at || 0) - (a.at || 0)); try { onData(); } catch (e) {} }); } catch (e) {}
  }
  return PA.rows || [];
}
/* the handover for the service that is starting now (written by the previous team) */
function paForNow() {
  const L = PA_ROWS(); const t = dayKey(), s = slotNow();
  const h = L.find((x) => x.to && x.to.day === t && x.to.slot === s);
  if (h) return h.closed && h.closed.at ? null : h;
  /* a handover written in the last 16 hours for a later service still counts (soir written at 23:30, read at 10:00) */
  return L.find((x) => x.to && x.to.day >= t && Date.now() - (x.at || 0) < 16 * 36e5 && !(x.day === t && x.slot === s)) || null;
}
/* the service running now: after midnight (until 5 h) it is still last night's « soir » */
const paSvcNow = () => (new Date().getHours() < 5 ? { day: addDays(dayKey(), -1), slot: "soir" } : { day: dayKey(), slot: slotNow() });
const paPrev = (sv) => (sv.slot === "soir" ? { day: sv.day, slot: "midi" } : { day: addDays(sv.day, -1), slot: "soir" });
const paOf = (sv) => PA_ROWS().find((x) => x.day === sv.day && x.slot === sv.slot) || null;
/* the one this service already wrote */
const paWritten = (sv = paSvcNow()) => paOf(sv);
const paTeam = (s) => (s === "soir" ? "équipe du soir" : "équipe du midi");
const paAud = (h) => paAudience(h.to || paNext(h.day, h.slot)).filter((m) => m.id !== h.byId && m.id !== h.uid);
const paMine = (h) => { const w = rlWho().id; return !!h && (h.uid === w || h.byId === w || h.uid === S.me.id); };
const paCanAdmin = (h) => rlIsMgr() || paMine(h);
/* where it stands: à écrire → envoyée → validée (signée « J'ai lu ») → clôturée (tout est traité) */
function paState(h) {
  if (!h) return { k: "todo", t: "À écrire" };
  if (h.closed && h.closed.at) return { k: "closed", t: "Clôturée" };
  const aud = paAud(h); const rd = Object.keys(h.reads || {}).filter((k) => h.reads[k]).length;
  const left = (h.items || []).filter((x) => !x.done && x.k !== "info").length;
  if (!rd) return { k: "sent", t: "Pas encore lue", left };
  return { k: "read", t: `Validée ${aud.length ? `${Math.min(rd, aud.length)}/${aud.length}` : `par ${rd}`}`, left };
}
const paReadAt = (h, pid) => (h && h.reads && h.reads[pid]) || 0;
const paCount = (h) => (h ? (h.items || []).length + (h.note ? 1 : 0) : 0);
/* the people of the next service: staff planned on it (their account or kitchen profile), else every active member */
function paAudience(to) {
  const ids = new Set();
  try {
    (S.shifts || []).forEach((sh) => {
      if (sh.day !== to.day) return; const a = (typeof rhT2m === "function" ? rhT2m(sh.start) : parseInt(sh.start, 10) * 60) || 0;
      if ((to.slot === "midi") !== (a < 16 * 60)) return;
      const st = (S.staff || []).find((x) => x.id === sh.staffId); if (st && st.memberId) ids.add(st.memberId);
    });
  } catch (e) {}
  const on = (m) => typeof axOn !== "function" || axOn(m);
  let list = (S.members || []).filter((m) => ids.has(m.id) && on(m));
  if (!list.length) list = (S.members || []).filter((m) => m.name && on(m) && m.role !== "kiosk");
  return list;
}
/* what the app already knows about this service: offered as lines, ticked by default when it matters */
function paSuggest() {
  const out = []; const t = dayKey(); const s = slotNow(); const t0 = (() => { const d = new Date(); d.setHours(s === "midi" ? 5 : 15, 0, 0, 0); return d.getTime(); })();
  const add = (k, tx, on = true, src = "") => { if (tx && !out.some((x) => x.t === tx)) out.push({ id: "s" + out.length, k, t: tx, on, src }); };
  /* ruptures from the consignes, still active */
  rlTry(() => (typeof csArr === "function" ? csArr("consignes") : []).filter((c) => c.kind === "rupture" && (typeof csLive !== "function" || csLive(c))).slice(0, 4).forEach((c) => add("rupture", String(c.text || "").split("\n")[0].slice(0, 110), true, "Consigne")), 0);
  /* waste of this service: breakage first */
  rlTry(() => {
    const W = (typeof hyArr === "function" ? hyArr("waste") : []).filter((w) => (w.at || 0) >= t0);
    const br = W.filter((w) => w.reason === "casse"); if (br.length) add("casse", `Casse : ${br.slice(0, 3).map((w) => w.name).join(", ")}${br.length > 3 ? "…" : ""}`, true, "Gaspillage");
    const other = W.filter((w) => w.reason !== "casse"); if (other.length >= 2) add("info", `${rlPl(other.length, "produit")} jeté${other.length > 1 ? "s" : ""} pendant le service`, false, "Gaspillage");
  }, 0);
  /* cooling still running: the next team must finish it */
  rlTry(() => (typeof hyArr === "function" ? hyArr("cool") : []).filter((b) => b.status === "run").slice(0, 3).forEach((b) => add("prep", `${b.kind === "refroid" ? "Refroidissement" : "Remise en température"} en cours : ${b.plat}, à finir et à noter`, true, "Hygiène")), 0);
  /* labels: products whose DLC ends today or tomorrow */
  rlTry(() => { const L = activeLots().filter((l) => (daysUntil(dlcOf(l)) ?? 99) <= 1); if (L.length) add("prep", `DLC à surveiller : ${L.slice(0, 4).map((l) => l.name).join(", ")}${L.length > 4 ? ` et ${L.length - 4} autres` : ""}`, L.length <= 6, "Étiquettes"); }, 0);
  /* the dishes the floor cancelled or had redone */
  rlTry(() => { const E = (S.events || []).filter((e) => e.type === "salle" && (e.at || 0) >= t0 && /annulé|refaire/.test(e.text || "")); if (E.length) add("info", `${rlPl(E.length, "plat annulé ou refait", "plats annulés ou refaits")} ce service : voir le journal`, false, "Salle"); }, 0);
  /* the next service's bookings */
  rlTry(() => {
    const to = paNext(t, s); const B = (typeof rsOfDay === "function" ? rsOfDay(to.day) : []).filter((b) => (typeof rsLive !== "function" || rsLive(b)) && b.time && ((to.slot === "midi") === (b.time < "16:00")));
    if (B.length) { const cov = B.reduce((a, b) => a + (+b.covers || 0), 0); add("info", `${rlPl(B.length, "réservation")} pour le service ${to.slot === "soir" ? "du soir" : "du midi"} (${rlPl(cov, "couvert")})`, true, "Réservations"); }
    B.filter((b) => b.notes && b.notes.trim()).slice(0, 2).forEach((b) => add("info", `${b.time} · ${b.name} : ${b.notes.trim().slice(0, 80)}`, true, "Réservations"));
  }, 0);
  /* fridges out of range during the service */
  rlTry(() => { const R = (S.readings || []).filter((r) => (r.at || 0) >= t0 && r.ok === false); if (R.length) add("casse", `${R.length > 1 ? `${R.length} relevés hors seuil` : "Un relevé hors seuil"} : ${[...new Set(R.map((r) => fridgeName(r.fridgeId)))].slice(0, 2).join(", ")}, à surveiller`, true, "Relevés"); }, 0);
  return out.slice(0, 8);
}

/* ───────────── write ───────────── */
function paWriteOpen(o = {}) {
  if (!S.resto) return;
  const sv = paSvcNow(); const t = o.day || sv.day, s = o.slot || sv.slot; const to = paNext(t, s);
  const mine = paWritten({ day: t, slot: s });
  PA.F = { day: t, slot: s, to, mood: (mine && mine.mood) || "", items: mine ? (mine.items || []).map((x) => ({ ...x })) : [], note: (mine && mine.note) || "", sug: mine ? [] : paSuggest(), edit: mine ? mine.id : null, add: null, gate: o.gate || null, by: o.by || null };
  const el = rlLayer("paWrite", "pa-w", "Passation de service"); paWritePaint(); void el.offsetWidth; el.classList.add("on"); SFX.sheet ? SFX.sheet() : SFX.tap(); buzz(6);
}
function paWriteRead() {
  const F = PA.F; if (!F) return;
  $$("#paWrite [data-pa-line]").forEach((inp) => { const it = F.items.find((x) => x.id === inp.dataset.paLine); if (it) it.t = inp.value; });
  $$("#paWrite [data-pa-tel]").forEach((inp) => { const it = F.items.find((x) => x.id === inp.dataset.paTel); if (it) it.tel = inp.value; });
  const n = $("#paNote"); if (n) F.note = n.value;
}
function paWritePaint(focus) {
  const F = PA.F; const el = $("#paWrite"); if (!F || !el) return;
  const aud = paAudience(F.to); const who = F.by || rlWho();
  const kinds = PA_ORDER.map((k, i) => { const K = PA_K[k]; return `<button class="pa-kb ${K[2]}" style="--i:${i}" data-act="paAdd" data-v="${k}">${ico(K[1])}<span>${esc(K[0])}</span></button>`; }).join("");
  const lines = F.items.map((it, i) => { const K = PA_K[it.k] || PA_K.info; return `<div class="pa-line ${K[2]}${it.fresh ? " fresh" : ""}" style="--i:${i}">
      <span class="pa-li">${ico(K[1])}</span>
      <div class="pa-lf"><span class="pa-lk">${esc(K[0])}</span><input class="pa-in" data-pa-line="${esc(it.id)}" value="${esc(it.t || "")}" placeholder="${esc(K[3])}" maxlength="160" enterkeyhint="done" aria-label="${esc(K[0])}">
      ${it.k === "rappel" ? `<input class="pa-in tel mono" data-pa-tel="${esc(it.id)}" value="${esc(it.tel || "")}" placeholder="Son numéro (facultatif)" inputmode="tel" maxlength="24" aria-label="Numéro de téléphone">` : ""}</div>
      <button class="pa-lx" data-act="paDel" data-id="${esc(it.id)}" aria-label="Retirer">${ico("x")}</button></div>`; }).join("");
  const sug = F.sug.length ? `<section class="pa-sug st" style="--i:3"><div class="pa-sh">${ico("paSpark")}<b>Repris de la journée</b><em>Touchez pour garder ou enlever</em></div>
      <div class="pa-sl">${F.sug.map((x, i) => { const K = PA_K[x.k] || PA_K.info; return `<button class="pa-sc ${K[2]}${x.on ? " on" : ""}" style="--i:${i}" data-act="paSug" data-id="${esc(x.id)}" aria-pressed="${x.on}"><span class="pa-scb">${ico(x.on ? "check" : "plus")}</span><span class="pa-sct"><b>${esc(x.t)}</b><em>${esc(x.src || K[0])}</em></span></button>`; }).join("")}</div></section>` : "";
  const n = F.items.filter((x) => (x.t || "").trim()).length + F.sug.filter((x) => x.on).length + ((F.note || "").trim() ? 1 : 0);
  el.innerHTML = `<div class="rl-card pa-card">
    <div class="rl-top"><span class="pa-tk"><span class="pa-tki">${ico("paBaton")}</span><span><b>${rlCap(paTeam(F.slot))} → ${paTeam(F.to.slot)}</b><em>Passation ${paSlotT(F.slot)}${F.to.day !== F.day ? ", pour demain midi" : ""}</em></span></span><button class="iconbtn" data-act="paWriteClose" aria-label="${F.gate ? "Revenir sans pointer" : "Fermer"}">${ico("x")}</button></div>
    <div class="rl-body">
      ${F.gate ? `<div class="pa-gate st" style="--i:0"><span class="pa-gi">${ico("clock")}</span><span><b>${esc(firstName(who.name) || "Vous")}, avant de pointer votre départ</b><em>Vous êtes responsable du service : la passation est obligatoire. Rien à signaler ? Un seul geste en bas.</em></span></div>` : ""}
      <div class="pa-aud st" style="--i:0"><span class="pa-avs">${aud.slice(0, 6).map((m, i) => `<span style="--j:${i}">${avatar(m.id, true)}</span>`).join("")}</span><span>${aud.length ? `${esc(aud.slice(0, 3).map((m) => firstName(m.name)).join(", "))}${aud.length > 3 ? ` et ${aud.length - 3} autres` : ""} le liront avant de commencer` : "L'équipe suivante la lira avant de commencer"}</span></div>
      <div class="lbl st" style="--i:1">Le service ${paSlotT(F.slot)}, c'était</div>
      <div class="pa-moods st" style="--i:1" role="radiogroup" aria-label="Le service">${Object.entries(PA_MOOD).map(([k, [t, ic, d]]) => `<button class="pa-mood m-${k}${F.mood === k ? " on" : ""}" role="radio" aria-checked="${F.mood === k}" data-act="paMood" data-v="${k}"><span class="pa-mi">${ico(ic)}</span><b>${t}</b><em>${d}</em></button>`).join("")}</div>
      ${sug}
      <div class="lbl st" style="--i:4">Ajouter pour l'équipe ${paSlotT(F.to.slot)}</div>
      <div class="pa-kinds st" style="--i:4">${kinds}</div>
      ${lines ? `<div class="pa-lines">${lines}</div>` : ""}
      <label class="pa-note st" style="--i:5"><span class="lbl">Un mot pour l'équipe</span><div class="pa-nw"><textarea id="paNote" class="input" rows="3" maxlength="600" placeholder="Bon courage pour ce soir, la salle est prête.">${esc(F.note || "")}</textarea>${typeof csSR === "function" && csSR() ? `<button class="pa-mic" data-act="paMic" aria-label="Dicter">${ico(IC.csMic ? "csMic" : "edit")}</button>` : ""}</div></label>
    </div>
    <div class="rl-cta">${n ? `<button class="btn acc block pa-go" data-act="paSend">${ico("paBaton")}Passer le relais<span class="pa-gn mono">${n}</span></button>` : `<button class="btn acc block pa-go" data-act="paSend" data-v="ok">${ico("check")}Rien à signaler, tout est en ordre</button>`}
      <p class="rl-fine">${F.gate ? "Votre départ sera pointé juste après · " : ""}Signé ${esc(firstName(who.name) || "par vous")} · ${hm(Date.now())}${F.edit ? " · remplace la passation déjà écrite" : ""}</p></div></div>`;
  if (focus) setTimeout(() => { const i = $(`#paWrite [data-pa-line="${focus}"]`); if (i) { i.focus({ preventScroll: false }); i.scrollIntoView({ block: "center", behavior: rlReduce() ? "auto" : "smooth" }); } }, 60);
}
async function paSend(ok) {
  const F = PA.F; if (!F || F.busy) return; paWriteRead();
  const items = F.sug.filter((x) => x.on).map((x) => ({ id: "i" + Math.random().toString(36).slice(2, 8), k: x.k, t: x.t, auto: x.src || "" }))
    .concat(F.items.filter((x) => (x.t || "").trim()).map((x) => ({ id: x.id, k: x.k, t: x.t.trim().slice(0, 160), ...(x.tel && x.tel.trim() ? { tel: x.tel.trim().slice(0, 24) } : {}), ...(x.done ? { done: x.done, doneBy: x.doneBy || "", doneAt: x.doneAt || 0 } : {}) })));
  const note = (F.note || "").trim().slice(0, 600);
  if (!ok && !items.length && !note) { SFX.err(); toast("Ajoutez au moins une ligne, ou touchez « Rien à signaler ».", "err"); return; }
  F.busy = true; const who = F.by || rlWho(); const now = Date.now();
  const text = ok && !items.length && !note ? "Rien à signaler, tout est en ordre." : [...items.map((x) => `${(PA_K[x.k] || PA_K.info)[0]} : ${x.t}`), note].filter(Boolean).join(" · ").slice(0, 400);
  const doc = { day: F.day, slot: F.slot, to: F.to, mood: F.mood || "", items, note, ok: !items.length && !note, text, at: now, uid: S.me.id, by: who.name || S.me.name || "", byId: who.id, reads: {} };
  const btn = $("#paWrite .pa-go"); if (btn) btn.disabled = true;
  try {
    let id = F.edit;
    if (id) { const prev = PA_ROWS().find((x) => x.id === id); await safe(DB.update("handovers", id, { ...doc, reads: (prev && prev.reads) || {}, editedAt: now })); }
    else id = await safe(DB.add("handovers", doc));
    logEvent("passation", `a passé le relais ${paSlotT(F.slot)} à l'équipe ${paSlotT(F.to.slot)}${items.length ? ` (${rlPl(items.length, "point")})` : " : rien à signaler"}`, { ref: id }).catch(() => {});
    if (!F.edit) paNotify(id);
    paFly(() => { PA.F = null; rlLayerClose("paWrite", F.gate ? () => F.gate.done() : null); if (!F.gate) toast(`Relais passé à l'${paTeam(F.to.slot)}`); if (S.route === "passation" || S.route === "home") rerender(); });
  } catch (e) { console.warn("passation", e); F.busy = false; if (btn) btn.disabled = false; SFX.err(); toast("Envoi impossible, réessayez.", "err"); }
}
/* the card folds into the baton and flies to the next team */
function paFly(done) {
  const card = $("#paWrite .rl-card"); SFX.done(); buzz([10, 40, 18]);
  if (!card || rlReduce()) { done(); return; }
  card.classList.add("pa-fold");
  const b = document.createElement("div"); b.className = "pa-flyb"; b.innerHTML = `<span>${ico("paBaton")}</span><b>Relais passé</b>`; document.body.appendChild(b);
  setTimeout(() => { try { burst(innerWidth / 2, innerHeight * 0.42); } catch (e) {} }, 380);
  setTimeout(() => { b.classList.add("go"); }, 820);
  setTimeout(() => { b.remove(); }, 1500);
  setTimeout(done, 700);
}
function paNotify(id) {
  if (!(window.GG_SERVER && GG_SERVER.equipe) || DB.mode !== "db" || typeof AUTH === "undefined" || !AUTH.call || !id) return;
  AUTH.call("equipeNotify", { rid: S.rid, kind: "passation", id }).catch((e) => console.warn("notify passation", e));
}

/* ───────────── read (before starting) ───────────── */
function paReadOpen(h, pid, o = {}) {
  if (!h) return; const who = pid ? { id: pid, name: rlName(pid, "") } : rlWho();
  PA.R = { id: h.id, pid: who.id, name: who.name, from: o.from || "" };
  PA.seen.add(h.id + "|" + who.id);
  const el = rlLayer("paRead", "pa-r", "Passation à lire"); paReadPaint(); void el.offsetWidth; el.classList.add("on");
  try { SFX.init(); SFX.tone(523, 0.12, "triangle", 0.025, 0.02); SFX.tone(659, 0.14, "triangle", 0.025, 0.12); SFX.tone(784, 0.22, "sine", 0.025, 0.22); } catch (e) { SFX.sheet && SFX.sheet(); }
  buzz([8, 30, 8]);
}
function paItemsHTML(h, live) {
  const by = {}; (h.items || []).forEach((x) => (by[x.k] ||= []).push(x)); const open = live && !(h.closed && h.closed.at);
  return PA_ORDER.filter((k) => by[k]).map((k, gi) => { const K = PA_K[k]; const left = by[k].filter((x) => !x.done).length; return `<section class="pa-grp ${K[2]} st" style="--i:${gi + 2}"><div class="pa-gh">${ico(K[1])}<b>${esc(K[0])}</b><span class="mono">${k === "info" || !left || left === by[k].length ? by[k].length : `${by[k].length - left}/${by[k].length} ${k === "rupture" ? "réglé" : "fait"}${by[k].length - left > 1 ? "s" : ""}`}</span></div>
    ${by[k].map((x) => { const can = open && k !== "info"; return `<div class="pa-it${x.done ? " done" : ""}"><span class="pa-itt">${esc(x.t)}${x.done ? `<em>${k === "rupture" ? "Réglé" : "Fait"} par ${esc(firstName(rlName(x.doneBy, "")))} · ${hm(x.done)}</em>` : ""}</span>
      ${x.tel ? `<a class="pa-call" href="tel:${esc(String(x.tel).replace(/[^\d+]/g, ""))}" aria-label="Appeler ${esc(x.tel)}">${ico("paPhone")}<span class="mono">${esc(x.tel)}</span></a>` : ""}
      ${can ? `<button class="pa-done${x.done ? " on" : ""}" data-act="paDone" data-id="${esc(h.id)}" data-v="${esc(x.id)}" aria-pressed="${!!x.done}">${ico("check")}<span>${x.done ? (k === "rupture" ? "Réglé" : "Fait") : k === "rupture" ? "C'est réglé" : "C'est fait"}</span></button>` : ""}</div>`; }).join("")}</section>`; }).join("");
}
function paReadersHTML(h, big) {
  const aud = paAud(h);
  const rd = Object.keys(h.reads || {}).filter((k) => h.reads[k]).sort((a, b) => h.reads[a] - h.reads[b]); const not = aud.filter((m) => !rd.includes(m.id));
  return `<div class="pa-rds${big ? " big" : ""}"><span class="pa-avs">${rd.slice(0, 8).map((id, i) => `<span style="--j:${i}" title="${esc(rlName(id))}">${avatar(id, true)}</span>`).join("")}</span>
    <span>${rd.length ? `Validée par ${esc(rd.slice(0, 3).map((id) => firstName(rlName(id))).join(", "))}${rd.length > 3 ? ` et ${rd.length - 3} autres` : ""}` : "Personne ne l'a encore validée"}${not.length && big ? ` · <b>pas encore : ${esc(not.slice(0, 4).map((m) => firstName(m.name)).join(", "))}${not.length > 4 ? "…" : ""}</b>` : ""}</span></div>`;
}
/* the steps a handover goes through, drawn as a small track: écrite → validée → clôturée */
function paTrackHTML(h) {
  const st = paState(h); const rd = Object.keys(h.reads || {}).filter((k) => h.reads[k]); const first = rd.length ? Math.min(...rd.map((k) => h.reads[k])) : 0;
  const steps = [["Écrite", `${esc(firstName(h.by || rlName(h.uid)))} · ${hm(h.at)}`, true], ["Validée", rd.length ? `${esc(firstName(rlName(rd[0])))}${rd.length > 1 ? ` +${rd.length - 1}` : ""} · ${hm(first)}` : "par l'équipe qui arrive", rd.length > 0], ["Clôturée", st.k === "closed" ? `${esc(firstName(h.closed.name || rlName(h.closed.by)))} · ${hm(h.closed.at)}` : st.left ? `${rlPl(st.left, "point")} à traiter` : "quand tout est traité", st.k === "closed"]];
  return `<ol class="pa-track" aria-label="Où en est la passation">${steps.map(([t, d, on], i) => `<li class="${on ? "on" : ""}${!on && (i === 0 || steps[i - 1][2]) ? " next" : ""}"><span class="pa-tdot">${on ? ico("check") : i + 1}</span><b>${t}</b><em>${d}</em></li>`).join("")}</ol>`;
}
function paReadPaint() {
  const R = PA.R; const el = $("#paRead"); if (!R || !el) return;
  const h = PA_ROWS().find((x) => x.id === R.id); if (!h) { rlLayerClose("paRead"); return; }
  const M = PA_MOOD[h.mood]; const read = paReadAt(h, R.pid); const n = paCount(h); const st = paState(h); const closed = st.k === "closed";
  const author = h.uid === R.pid || h.byId === R.pid; const to = h.to || paNext(h.day, h.slot);
  let cta;
  if (closed) cta = `<div class="pa-signed cl">${ico("check")}<span>Clôturée par ${esc(firstName(h.closed.name || rlName(h.closed.by)))} ${esc(rlDayRel(dayKey(new Date(h.closed.at))))} à ${hm(h.closed.at)}</span></div><div class="pa-cta2"><button class="btn soft" data-act="paReopen" data-id="${esc(h.id)}">${ico("jrUndo")}Rouvrir</button><button class="btn acc" data-act="paReadClose">Fermer</button></div>`;
  else if (!author && !read) cta = `<button class="btn acc block pa-sign" data-act="paSign"><span class="pa-sgi">${ico("check")}</span><span>J'ai lu${n > 1 ? ` les ${n} points` : ""}, je valide</span></button><button class="btn ghost block" data-act="paReadClose">${R.from ? "Plus tard" : "Fermer"}</button>`;
  else cta = `${read ? `<div class="pa-signed">${ico("check")}<span>Validée par ${esc(firstName(R.name) || "vous")} à ${hm(read)}</span></div>` : ""}
      <div class="pa-cta2"><button class="btn soft" data-act="paReadClose">Fermer</button><button class="btn acc" data-act="paClose" data-id="${esc(h.id)}">${ico("check")}${st.left ? `Clôturer (${st.left} non traité${st.left > 1 ? "s" : ""})` : "Clôturer, tout est traité"}</button></div>`;
  const tools = paCanAdmin(h) ? `<div class="pa-tools">${!closed ? `<button class="pa-tl" data-act="paEdit" data-id="${esc(h.id)}">${ico("edit")}Modifier</button>` : ""}<button class="pa-tl bad" data-act="paDel" data-id="${esc(h.id)}">${ico("trash")}<span>Supprimer</span></button></div>` : "";
  el.innerHTML = `<div class="rl-card pa-card pa-rc${closed ? " is-closed" : ""}">
    <div class="rl-top"><span class="pa-tk"><span class="pa-tki">${ico("paBaton")}</span><span><b>${rlCap(paTeam(h.slot))} → ${paTeam(to.slot)}</b><em>${esc(rlCap(rlDayRel(h.day)))} · passation ${paSlotT(h.slot)} écrite à ${hm(h.at)}</em></span></span><button class="iconbtn" data-act="paReadClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="rl-body">
      <header class="pa-rh st" style="--i:0"><span class="pa-rav">${avatar(h.byId || h.uid)}<i>${ico("paBaton")}</i></span>
        <div><span class="pa-rk">${closed ? "Passation clôturée" : !author && !read ? (R.from || paForNow() === h ? `${R.name ? esc(firstName(R.name)) + ", à" : "À"} lire avant de commencer` : "À lire et valider") : author ? "Votre passation" : "Passation validée"}</span><h2 class="pa-rt">${author ? `Vous passez le relais à l'${paTeam(to.slot)}` : `${esc(firstName(h.by || rlName(h.uid)))} passe le relais à l'${paTeam(to.slot)}`}</h2>
        ${M ? `<span class="pa-mp m-${esc(h.mood)}">${ico(M[1])}${esc(M[0])} · ${esc(M[2].toLowerCase())}</span>` : ""}</div></header>
      <div class="st" style="--i:1">${paTrackHTML(h)}</div>
      ${h.ok ? `<div class="pa-okc st" style="--i:2">${ico("paCalm")}<span><b>Rien à signaler</b><em>Tout est en ordre pour le service ${paSlotT(to.slot)}.</em></span></div>` : paItemsHTML(h, true)}
      ${h.note ? `<blockquote class="pa-q st" style="--i:8">${esc(h.note)}<cite>${esc(firstName(h.by || ""))}</cite></blockquote>` : ""}
      <div class="st" style="--i:9">${paReadersHTML(h, true)}</div>
      ${tools ? `<div class="st" style="--i:10">${tools}</div>` : ""}
    </div>
    <div class="rl-cta">${cta}</div></div>`;
}
async function paSign() {
  const R = PA.R; if (!R) return; const h = PA_ROWS().find((x) => x.id === R.id); if (!h) return;
  const b = $("#paRead .pa-sign"); if (b) { b.classList.add("ok"); b.disabled = true; }
  SFX.done(); buzz([10, 40, 10]);
  const reads = { ...(h.reads || {}), [R.pid]: Date.now() }; h.reads = reads;
  safe(DB.update("handovers", h.id, { reads })).catch(() => {});
  logEvent("passation", `a validé la passation ${paSlotT(h.slot)} de ${firstName(h.by || rlName(h.uid))}`, { ref: h.id }).catch(() => {});
  setTimeout(() => { try { burst(innerWidth / 2, innerHeight * 0.75); } catch (e) {} }, 220);
  /* opened by itself as the person starts: it goes away; opened from the page: it stays, to tick and close */
  setTimeout(() => { if (R.from) { PA.R = null; rlLayerClose("paRead"); toast(`Bon service${R.name ? ", " + firstName(R.name) : ""} !`); } else { paReadPaint(); toast("Passation validée"); } if (S.route === "home" || S.route === "passation") rerender(); }, 900);
}
function paAuto(pid, from) {
  try {
    if (!S.resto || PA.F || PA.R || $(".rl-layer.on") || $("#pmFlow.on") || $("#sheet").classList.contains("open")) return false;
    if (typeof esKioskOn === "function" && esKioskOn() && typeof esStation === "function" && esStation() === "cuisine") return false;
    const h = paForNow(); if (!h) return false; const who = pid || rlWho().id;
    if (h.uid === who || h.byId === who || paReadAt(h, who) || PA.seen.has(h.id + "|" + who)) return false;
    if (Date.now() - (h.at || 0) > 20 * 36e5) return false;
    paReadOpen(h, who, { from }); return true;
  } catch (e) { return false; }
}

/* ───────────── home card (every space), pilotage strip ───────────── */
function paWriteTime() { const h = new Date().getHours() + new Date().getMinutes() / 60; return (h >= 13.75 && h < 17) || h >= 21.25 || h < 2; }
function paHomeCard() {
  if (!S.resto || !VIEWS.passation || !permOk("passation")) return "";
  const h = paForNow(); const who = rlWho(); const mine = paWritten();
  if (h && h.uid !== who.id && h.byId !== who.id && !paReadAt(h, who.id)) {
    const n = paCount(h); const first = (h.items || []).slice(0, 2);
    return `<section class="pa-hm new st" style="--i:2" aria-label="Passation à lire"><span class="pa-hglow" aria-hidden="true"></span>
      <div class="pa-hh"><span class="pa-rav sm">${avatar(h.byId || h.uid, true)}<i>${ico("paBaton")}</i></span><span><b>À lire avant de commencer</b><em>Passation ${paSlotT(h.slot)} de ${esc(firstName(h.by || rlName(h.uid)))} · ${hm(h.at)}</em></span></div>
      ${h.ok ? `<p class="pa-hl">Rien à signaler, tout est en ordre.</p>` : first.map((x) => { const K = PA_K[x.k] || PA_K.info; return `<div class="pa-hi ${K[2]}">${ico(K[1])}<span>${esc(x.t)}</span></div>`; }).join("")}
      <button class="btn acc block sm pa-hb" data-act="paOpen" data-id="${esc(h.id)}">${ico("paBaton")}${n > 2 ? `Lire les ${n} points` : "Lire la passation"}</button></section>`;
  }
  if (!mine && (paWriteTime() || DB.mode === "demo")) {
    const to = paNext();
    return `<button class="pa-hm write st" style="--i:2" data-act="paWrite"><span class="pa-wi">${ico("paBaton")}</span><span><b>Fin du service ${paSlotT(slotNow())} ?</b><em>Passez le relais à l'équipe ${paSlotT(to.slot)} : ruptures, casse, clients à rappeler</em></span>${ico("chev")}</button>`;
  }
  if (h && paReadAt(h, who.id)) return `<button class="pa-hm done st" style="--i:2" data-go="passation"><span class="pa-wi">${ico("paBaton")}</span><span><b>Passation ${paSlotT(h.slot)}</b><em>Validée à ${hm(paReadAt(h, who.id))} · ${rlPl(paCount(h) || 0, "point")}</em></span>${ico("chev")}</button>`;
  return "";
}
function paPilotStrip() {
  if (!rlIsMgr()) return ""; const h = paWritten() || paForNow(); if (!h) return "";
  const aud = paAudience(h.to || paNext(h.day, h.slot)).filter((m) => m.id !== h.byId && m.id !== h.uid); const rd = aud.filter((m) => paReadAt(h, m.id));
  return `<button class="es-pstrip pa-ps st" style="--i:1" data-go="passation"><span class="es-rqi">${ico("paBaton")}</span><span><b>Passation ${paSlotT(h.slot)} · validée ${rd.length}/${aud.length || 0}${paState(h).k === "closed" ? " · clôturée" : ""}</b><em>${esc(firstName(h.by || ""))} · ${esc(String(h.text || "").slice(0, 90))}</em></span>${ico("chev")}</button>`;
}

/* ───────────── the page: today's relay (received / to pass), what is left to handle, the history ───────────── */
function paLegHTML(kind, sv, h, i) {
  const to = paNext(sv.day, sv.slot); const st = paState(h); const t0 = rlCap(paTeam(sv.slot)), t1 = rlCap(paTeam(to.slot));
  const when = h ? `${esc(rlCap(rlDayRel(h.day)))} · ${esc(firstName(h.by || rlName(h.uid)))} · ${hm(h.at)}` : kind === "in" ? `${esc(rlCap(rlDayRel(sv.day)))} : pas de passation écrite` : "En fin de service, avant de partir";
  const act = h ? `data-act="paView" data-id="${esc(h.id)}"` : kind === "out" ? `data-act="paWrite"` : "disabled";
  const sub = !h ? (kind === "out" ? `<span class="pa-legc go">${ico("paBaton")}Écrire la passation</span>` : "") : st.k === "closed" ? "" : `<span class="pa-legc">${h.ok ? "Rien à signaler" : `${rlPl(paCount(h), "point")}${st.left ? ` · ${st.left} à traiter` : ""}`}</span>`;
  return `<button class="pa-leg k-${kind} s-${st.k} st" style="--i:${i}" ${act}>
    <span class="pa-legk">${kind === "in" ? "Reçue" : "À passer"}<span class="pa-st s-${st.k}">${esc(st.t)}</span></span>
    <span class="pa-legt"><b>${t0}</b><span class="pa-arw">${ico("arrow")}</span><b>${t1}</b></span>
    <span class="pa-legw">${when}</span>${sub}</button>`;
}
function paCardHTML(x, i) {
  const M = PA_MOOD[x.mood]; const st = paState(x); const to = x.to || paNext(x.day, x.slot);
  return `<button class="pa-hc s-${st.k} st" style="--i:${Math.min(i, 8) + 3}" data-act="paView" data-id="${esc(x.id)}"><div class="pa-hch"><span class="pa-rav sm">${avatar(x.byId || x.uid, true)}<i>${ico("paBaton")}</i></span><span><b>${rlCap(paSlotT(x.slot).replace("du ", ""))} → ${paSlotT(to.slot).replace("du ", "")}</b><em>${esc(firstName(x.by || rlName(x.uid)))} · ${hm(x.at)}${M ? ` · ${esc(M[0].toLowerCase())}` : ""}</em></span><span class="pa-st s-${st.k}">${esc(st.t)}</span></div>
    ${x.ok ? `<p class="pa-hl">Rien à signaler.</p>` : `<div class="pa-hcl">${(x.items || []).slice(0, 3).map((y) => { const K = PA_K[y.k] || PA_K.info; return `<span class="pa-hi ${K[2]}${y.done ? " done" : ""}">${ico(K[1])}<span>${esc(y.t)}</span></span>`; }).join("")}${(x.items || []).length > 3 ? `<span class="pa-more">+ ${(x.items || []).length - 3}</span>` : ""}</div>`}
    ${st.k !== "closed" && st.left ? `<div class="pa-hcf"><span class="pa-bar" style="--p:${Math.round((1 - st.left / Math.max(1, (x.items || []).filter((y) => y.k !== "info").length)) * 100)}%"><i></i></span><span class="mono">${st.left} à traiter</span></div>` : ""}</button>`;
}
/* « passation obligatoire au départ »: restos.paCfg = { force, who: [staff ids] } (who empty: the managers, chefs and seconds) */
const paCfg = () => (S.resto && S.resto.paCfg) || {};
const PA_RESP = /g[ée]rant|chef|second|responsable|manager|ma[iî]tre d|directeur|directrice/i;
function paRespAuto(p) { if (!p) return false; const m = p.memberId ? rlMember(p.memberId) : null; return !!(m && ["gerant", "chef"].includes(m.role)) || PA_RESP.test(p.role || ""); }
function paResp() { const C = paCfg(); const P = rlTry(() => rhPeople(), []); return C.who && C.who.length ? P.filter((p) => C.who.includes(p.id)) : P.filter(paRespAuto); }
function paCfgHTML() {
  const C = paCfg(); const R = paResp(); const gerant = rlTry(() => myRole() === "gerant", false) || DB.mode === "demo";
  return `<section class="glass pa-cfg st" style="--i:4"><div class="li${gerant ? " tap" : ""}" ${gerant ? `data-act="paCfgSheet" role="button" tabindex="0"` : ""}><span class="ic w-in">${ico("clock")}</span><div class="tx"><b>Passation obligatoire au départ</b><em>${C.force ? `${R.length ? esc(R.slice(0, 3).map((p) => firstName(p.name)).join(", ")) + (R.length > 3 ? ` et ${R.length - 3} autres` : "") : "Aucun responsable choisi"} : pas de départ pointé sans passation` : "Non : la passation reste libre"}</em></div>${gerant ? ccSwTry(!!C.force) : ""}</div></section>`;
}
const ccSwTry = (on) => (typeof ccSw === "function" ? ccSw(on) : `<span class="pill ${on ? "acc" : "neu"}">${on ? "Oui" : "Non"}</span>`);
function paCfgSheet() {
  const C = S.ui.paCfg || (S.ui.paCfg = { force: !!paCfg().force, who: (paCfg().who || []).slice() }); const P = rlTry(() => rhPeople(), []);
  const auto = !C.who.length; const sel = (p) => (auto ? paRespAuto(p) : C.who.includes(p.id));
  openSheet(`<div class="pa-cfs"><div class="row"><span class="h2">Passation obligatoire</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Quand le responsable du service pointe son départ, l'app lui demande d'abord la passation pour l'équipe suivante. Il ne peut pas pointer sans. Si quelqu'un l'a déjà écrite pour ce service, rien ne lui est demandé.</p>
    <div class="li tap" data-act="paCfgForce" role="switch" aria-checked="${C.force}"><span class="ic w-in">${ico("clock")}</span><div class="tx"><b>Obligatoire au départ</b><em>${C.force ? "Oui, pour les responsables ci-dessous" : "Non, la passation reste libre"}</em></div>${ccSwTry(C.force)}</div>
    <div class="lbl" style="margin-top:14px">Qui est responsable du service ?</div>
    <p class="note" style="margin:0 2px 8px">${auto ? "Par défaut : gérants, chefs, seconds et responsables de salle. Touchez pour choisir vous-même." : "Votre choix. Touchez « Par défaut » pour revenir au choix automatique."}</p>
    <div class="pa-who">${P.map((p) => `<button class="pa-wb${sel(p) ? " on" : ""}" data-act="paCfgWho" data-id="${esc(p.id)}" aria-pressed="${sel(p)}">${typeof rhAva === "function" ? rhAva(p, 30) : ""}<span><b>${esc(firstName(p.name))}</b><em>${esc(p.role || "")}</em></span>${ico(sel(p) ? "check" : "plus")}</button>`).join("") || `<p class="note">Ajoutez d'abord votre équipe dans Employés.</p>`}</div>
    ${auto ? "" : `<button class="btn ghost block sm" data-act="paCfgAuto">Par défaut</button>`}
    <button class="btn acc block" data-act="paCfgSave" style="margin-top:10px">${ico("check")}Enregistrer</button></div>`);
}
/* the gate: true when this person must write the handover before clocking out */
function paMustWrite(sid) {
  const C = paCfg(); if (!C.force || !VIEWS.passation) return false;
  const p = rlTry(() => rhStaff(sid), null); if (!p) return false;
  const resp = C.who && C.who.length ? C.who.includes(sid) : paRespAuto(p); if (!resp) return false;
  return !paWritten();
}
VIEWS.passation = {
  render() {
    const L = PA_ROWS(); const sv = paSvcNow(); const prev = paPrev(sv); const hin = paOf(prev); const hout = paOf(sv);
    const F = S.ui.paF || "todo"; const legs = new Set([hin && hin.id, hout && hout.id]);
    const todo = L.filter((x) => paState(x).k !== "closed" && !legs.has(x.id)); const closed = L.filter((x) => paState(x).k === "closed");
    const list = F === "todo" ? todo : F === "closed" ? closed : L;
    const days = []; list.slice(0, 40).forEach((x) => { const g = days.find((d) => d[0] === x.day); g ? g[1].push(x) : days.push([x.day, [x]]); });
    let k = 0;
    const hist = days.length ? days.map(([d, xs]) => `<div class="pa-day lbl">${esc(rlCap(rlDayRel(d)))}</div>${xs.map((x) => paCardHTML(x, k++)).join("")}`).join("")
      : `<div class="glass empty st" style="--i:6"><div class="ic">${ico("paBaton")}</div><b>${F === "todo" ? "Rien d'autre à traiter" : F === "closed" ? "Aucune passation clôturée" : "Pas encore de passation"}</b>${F === "todo" ? "Les passations encore ouvertes des jours précédents apparaissent ici." : "À la fin de chaque service, l'équipe qui part écrit un mot à celle qui arrive."}</div>`;
    const chips = [["todo", "Encore ouvertes", todo.length], ["closed", "Clôturées", closed.length], ["all", "Toutes", L.length]];
    return `<div class="inner pa-page">${topBar("Passation de service")}
      <p class="pa-intro st" style="--i:1">L'équipe qui part écrit, celle qui arrive lit et valide, puis on clôture quand tout est traité.</p>
      <div class="pa-legs">${paLegHTML("in", prev, hin, 2)}${paLegHTML("out", sv, hout, 3)}</div>
      ${rlIsMgr() ? paCfgHTML() : ""}
      <div class="pa-hhd st" style="--i:5"><span class="lbl">Historique</span><div class="pa-chips" role="tablist">${chips.map(([v, t, n]) => `<button class="pa-chip${F === v ? " on" : ""}" role="tab" aria-selected="${F === v}" data-act="paFilter" data-v="${v}">${t}<span class="mono">${n}</span></button>`).join("")}</div></div>
      <div class="pa-hist">${hist}</div></div>`;
  },
};
function paDetail(id) { const h = PA_ROWS().find((x) => x.id === id); if (!h) return; closeSheet(true); paReadOpen(h, null, {}); }
/* ═══════════════════════════ JOURNAL DES ACTIONS ═══════════════════════════ */
/* [label, icon, colour, sensitive] */
const JR_CAT = {
  annul: ["Annulations", "jrUndo", "c-bad", true],
  offert: ["Offerts", "jrGift", "c-sa", true],
  suppr: ["Suppressions", "trash", "c-to", true],
  modif: ["Modifications", "edit", "c-vi", true],
  acces: ["Équipe et accès", "users", "c-in", false],
  argent: ["Caisse et argent", "euro", "c-mi", false],
  svc: ["Service", "slPad", "c-sk", false],
  hyg: ["Hygiène et traçabilité", "therm", "c-ok", false],
  autre: ["Autres", "activity", "c-nd", false],
};
const JR_P = [["jour", "Aujourd'hui"], ["7", "7 jours"], ["30", "30 jours"], ["tout", "Tout"]];
const JR = { rid: null, rows: null, p: "7", who: "", cat: "", q: "", sens: false, n: 120, open: new Set() };
function JR_ROWS() {
  if (!S.rid) return [];
  if (JR.rid !== S.rid) {
    JR.rid = S.rid; JR.rows = null; const rid = S.rid;
    try { DB.watch("events", { order: "at", dir: "desc", limit: 4000 }, (rows) => { if (S.rid !== rid) return; JR.rows = (rows || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)); try { if (S.route === "journal") onData(); } catch (e) {} }); } catch (e) {}
  }
  return JR.rows || S.events || [];
}
function jrCat(e) {
  if (e.k && JR_CAT[e.k]) return e.k;
  const t = String(e.text || "").toLowerCase(); const ty = e.type || "";
  if (/\bannul|avoir n°|fait refaire|refait/.test(t)) return "annul";
  if (/\boffert|a offert|récompense|remise|plus offert/.test(t)) return "offert";
  if (/supprim|a retiré|effacé|vidé les données|a fermé l'accès/.test(t)) return "suppr";
  if (/modifi|a changé|corrig|mis à jour|réinitialis|a passé .+ en |prolong|déconnect|a rendu/.test(t)) return ty === "team" ? "acces" : "modif";
  if (["team", "request", "formation"].includes(ty)) return "acces";
  if (["ticket", "caisse", "expense", "facture", "frais", "import", "order"].includes(ty)) return "argent";
  if (["salle", "passation", "client"].includes(ty)) return "svc";
  if (["reading", "reception", "chore", "lot", "open", "out", "lost", "move", "cooling", "fryer", "waste", "doc", "obl", "note", "stock"].includes(ty)) return "hyg";
  return "autre";
}
const jrWhoId = (e) => e.actorId || e.uid || "";
const jrWhoName = (e) => e.actor || (e.uid === "sonde" ? "Sonde" : rlName(e.uid, "Quelqu'un"));
function jrSince() { const t = dayKey(); return JR.p === "jour" ? parseDay(t).getTime() : JR.p === "7" ? parseDay(addDays(t, -6)).getTime() : JR.p === "30" ? parseDay(addDays(t, -29)).getTime() : 0; }
function jrFiltered(base) {
  const t0 = jrSince(); const q = JR.q.trim().toLowerCase();
  return base.filter((e) => (e.at || 0) >= t0 && (!JR.who || jrWhoId(e) === JR.who || e.uid === JR.who) && (!JR.cat || jrCat(e) === JR.cat) && (!JR.sens || JR_CAT[jrCat(e)][3] || e.cancelled)
    && (!q || `${jrWhoName(e)} ${e.text || ""} ${e.dev || ""}`.toLowerCase().includes(q)));
}
/* « à regarder »: someone doing clearly more cancellations or offers than the rest of the team over the period */
function jrInsight(L) {
  const by = {}; L.forEach((e) => { const c = jrCat(e); if (c !== "annul" && c !== "offert") return; const k = jrWhoId(e); if (!k) return; const o = (by[k] ||= { id: k, name: jrWhoName(e), annul: 0, offert: 0, amt: 0 }); o[c]++; o.amt += +e.amt || 0; });
  const arr = Object.values(by).map((o) => ({ ...o, n: o.annul + o.offert })).sort((a, b) => b.n - a.n);
  if (arr.length < 2 || arr[0].n < 3) return { arr, flag: null };
  const rest = arr.slice(1); /* compared with the others who also comped or cancelled in the period (not the whole team, which would inflate the ratio) */
  const avg = rest.reduce((a, o) => a + o.n, 0) / rest.length;
  return { arr, flag: arr[0].n >= Math.max(3, avg * 2) ? { ...arr[0], x: avg ? Math.round((arr[0].n / avg) * 10) / 10 : 0 } : null };
}
function jrRow(e, i) {
  const c = jrCat(e); const C = JR_CAT[c]; const wid = jrWhoId(e); const tx = String(e.text || "").replace(/^a /, "");
  return `<button class="jr-row ${C[2]}${C[3] ? " sens" : ""}${e.cancelled ? " gone" : ""}" style="--i:${Math.min(i, 14)}" data-act="jrOpen" data-id="${esc(e.id)}">
    <span class="jr-t mono">${hm(e.at)}</span>
    <span class="jr-who">${wid && wid !== "sonde" ? avatar(wid, true) : `<span class="jr-sd">${ico("sdProbe" in IC ? "sdProbe" : "therm")}</span>`}<b>${esc(firstName(jrWhoName(e)))}</b></span>
    <span class="jr-tx"><span>${esc(rlCap(tx))}</span>${e.cancelled ? `<em class="jr-gone">annulé ensuite${e.cancelledBy ? ` par ${esc(firstName(rlName(e.cancelledBy)))}` : ""}</em>` : ""}${e.dev ? `<em class="jr-dev">${ico("pmTablet")}${esc(e.dev)}${e.actor && e.uid && e.uid !== e.actorId ? ` · compte ${esc(firstName(rlName(e.uid)))}` : ""}</em>` : ""}</span>
    <span class="jr-cat">${ico(C[1])}<span>${esc(C[0])}</span></span>
    <span class="jr-amt mono">${e.amt ? rlEur(e.amt) : ""}</span></button>`;
}
/* Rafales : au moins 4 actions de la même personne à moins d'une minute d'écart (ex. 30 ventes de caisse importées d'un coup).
   Jamais un geste sensible ni une action annulée : ceux-là restent toujours en ligne, un par un. */
const jrTpl = (e) => String(e.text || "").toLowerCase().replace(/\d+([.,:/]\d+)*/g, "#").replace(/\s+/g, " ").trim();
const jrLone = (e) => e.cancelled || JR_CAT[jrCat(e)][3];
function jrGroups(L) {
  const out = []; let run = [];
  const flush = () => { if (run.length >= 4) out.push(run); else run.forEach((e) => out.push([e])); run = []; };
  L.forEach((e) => {
    const p = run[run.length - 1];
    if (jrLone(e)) { flush(); out.push([e]); return; }
    if (p && jrWhoId(p) === jrWhoId(e) && Math.abs((p.at || 0) - (e.at || 0)) <= 60000) run.push(e);
    else { flush(); run = [e]; }
  });
  flush(); return out;
}
function jrGrpRow(g, i) {
  const key = `${g[0].id}~${g.length}`; const open = JR.open.has(key);
  const fq = {}; g.forEach((e) => { const t = jrTpl(e); fq[t] = (fq[t] || 0) + 1; }); const top = Object.keys(fq).sort((a, b) => fq[b] - fq[a])[0];
  const h = g.find((e) => jrTpl(e) === top) || g[0];
  const cats = [...new Set(g.map(jrCat))]; const C = JR_CAT[cats[0]]; const wid = jrWhoId(h);
  const tpls = [...new Set(g.map(jrTpl))].length;
  const t0 = Math.min(...g.map((e) => e.at || 0)); const t1 = Math.max(...g.map((e) => e.at || 0));
  return `<div class="jr-grp${open ? " open" : ""}"><button class="jr-row jr-gr ${C[2]}" style="--i:${Math.min(i, 14)}" data-act="jrGrp" data-id="${esc(key)}" aria-expanded="${open}">
    <span class="jr-t mono">${hm(t1)}${hm(t0) !== hm(t1) ? `<i>${hm(t0)}</i>` : ""}</span>
    <span class="jr-who">${wid && wid !== "sonde" ? avatar(wid, true) : `<span class="jr-sd">${ico("sdProbe" in IC ? "sdProbe" : "therm")}</span>`}<b>${esc(firstName(jrWhoName(h)))}</b></span>
    <span class="jr-tx"><span>${esc(rlCap(String(h.text || "").replace(/^a /, "")))}</span><em class="jr-more"><b class="mono">+${g.length - 1}</b>${open ? "Replier" : tpls === 1 ? "du même genre" : "autres actions"}${ico("chev")}</em></span>
    <span class="jr-cat">${ico(C[1])}<span>${esc(cats.length > 1 ? `${C[0]} +${cats.length - 1}` : C[0])}</span></span>
    <span class="jr-amt mono"></span></button>
    ${open ? `<div class="jr-sub">${g.map((e, j) => jrRow(e, j)).join("")}</div>` : ""}</div>`;
}
VIEWS.journal = {
  render() {
    if (!rlIsMgr() && !(typeof PERMS !== "undefined" && PERMS.isAdmin && PERMS.isAdmin())) return VIEWS.noaccess ? VIEWS.noaccess.render({ route: "journal" }) : `<div class="inner">${topBar("Journal des actions")}<div class="glass empty">Réservé au gérant et aux chefs.</div></div>`;
    const all = JR_ROWS(); const t0 = jrSince(); const inP = all.filter((e) => (e.at || 0) >= t0);
    const L = jrFiltered(all); const shown = L.slice(0, JR.n);
    const cnt = {}; const amt = {}; inP.forEach((e) => { const c = jrCat(e); cnt[c] = (cnt[c] || 0) + 1; amt[c] = (amt[c] || 0) + (+e.amt || 0); });
    const money = rlTry(() => DB.mode === "demo" || myRole() === "gerant" || PERMS.cap("seeMoney"), false);
    const kpi = ["annul", "offert", "suppr", "modif"].map((k, i) => { const C = JR_CAT[k]; return `<button class="jr-kpi ${C[2]}${JR.cat === k ? " on" : ""}" style="--i:${i}" data-act="jrCat" data-v="${k}" aria-pressed="${JR.cat === k}"><span class="jr-ki">${ico(C[1])}</span><b class="mono" data-to="${cnt[k] || 0}">${cnt[k] || 0}</b><span>${esc(C[0])}</span>${money && amt[k] ? `<em class="mono">${rlEur(amt[k])}</em>` : `<em>&nbsp;</em>`}</button>`; }).join("");
    const ins = jrInsight(inP);
    const flag = ins.flag ? `<section class="jr-flag st" style="--i:3"><span class="jr-fi">${ico("jrFlag")}</span><div><b>À regarder · ${esc(firstName(ins.flag.name))}</b><p>${esc(firstName(ins.flag.name))} a ${[ins.flag.annul ? rlPl(ins.flag.annul, "annulation") : "", ins.flag.offert ? `${rlPl(ins.flag.offert, "offert")}` : ""].filter(Boolean).join(" et ")} sur la période${ins.flag.x >= 2 ? `, ${String(ins.flag.x).replace(".", ",")} fois la moyenne de l'équipe` : ""}${money && ins.flag.amt ? ` (${rlEur(ins.flag.amt)})` : ""}. Ce n'est peut-être rien : un mot suffit souvent.</p><button class="btn soft sm" data-act="jrWho" data-id="${esc(ins.flag.id)}">${ico("jrSearch")}Voir ses actions</button></div></section>` : "";
    const lead = ins.arr.length ? `<section class="glass jr-lead st" style="--i:4"><span class="lbl">Annulations et offerts par personne</span>${ins.arr.slice(0, 5).map((o) => { const mx = ins.arr[0].n || 1; return `<button class="jr-lr" data-act="jrWho" data-id="${esc(o.id)}">${avatar(o.id, true)}<b>${esc(firstName(o.name))}</b><span class="jr-lb"><i class="a" style="--w:${(o.annul / mx) * 100}%"></i><i class="o" style="--w:${(o.offert / mx) * 100}%"></i></span><span class="mono">${o.n}</span></button>`; }).join("")}<div class="jr-leg"><span class="a">Annulations</span><span class="o">Offerts</span></div></section>` : "";
    const people = [...new Map(inP.filter((e) => jrWhoId(e) && jrWhoId(e) !== "sonde").map((e) => [jrWhoId(e), jrWhoName(e)])).entries()].slice(0, 16);
    const byDay = {}; shown.forEach((e) => { (byDay[dayKey(new Date(e.at))] ||= []).push(e); });
    /* actions automatiques en rafale (ex. 30 ventes de caisse importées d'un coup) : une seule ligne repliée, qu'on déplie au toucher */
    const dayHTML = (L) => jrGroups(L).map((g, i) => g.length < 4 ? g.map((e, j) => jrRow(e, i + j)).join("") : jrGrpRow(g, i)).join("");
    const days = Object.keys(byDay).sort().reverse(); let k = 0;
    return `<div class="inner wide jr">${topBar("Journal des actions", { right: `<button class="btn soft sm" data-act="jrCsv">${ico("download" in IC ? "download" : "upload")}Exporter</button>` })}
      <p class="sub jr-lede st" style="--i:1">Tout ce qui se fait dans l'app, signé et à la minute. Rien ne s'efface : une action annulée reste ici, barrée.</p>
      <div class="jr-ctl st" style="--i:1"><div class="seg jr-per" role="tablist"><span class="knob" style="width:calc(${100 / JR_P.length}% - ${8 / JR_P.length}px);transform:translateX(${Math.max(0, JR_P.findIndex((x) => x[0] === JR.p)) * 100}%)"></span>${JR_P.map(([v, t]) => `<button role="tab" class="${JR.p === v ? "on" : ""}" aria-selected="${JR.p === v}" data-act="jrP" data-v="${v}">${t}</button>`).join("")}</div>
        <label class="jr-q">${ico("jrSearch")}<input id="jrQ" class="input" type="search" placeholder="Chercher : table 4, entrecôte, Sarah…" value="${esc(JR.q)}" autocomplete="off" enterkeyhint="search"></label></div>
      <div class="jr-kpis st" style="--i:2">${kpi}</div>
      <div class="jr-cols"><div class="jr-main">
        ${flag}
        <div class="jr-fil st" style="--i:4">${people.length > 1 ? `<div class="jr-ppl">${people.map(([id, n]) => `<button class="jr-pp${JR.who === id ? " on" : ""}" data-act="jrWho" data-id="${esc(id)}" aria-pressed="${JR.who === id}">${avatar(id, true)}<span>${esc(firstName(n))}</span></button>`).join("")}</div>` : ""}
          <div class="jr-chips"><button class="chip${!JR.cat && !JR.sens ? " on" : ""}" data-act="jrCat" data-v="">Tout</button><button class="chip jr-sens${JR.sens ? " on" : ""}" data-act="jrSens">${ico("jrFlag")}Gestes sensibles</button>${Object.entries(JR_CAT).filter(([c]) => cnt[c]).map(([c, C]) => `<button class="chip${JR.cat === c ? " on" : ""}" data-act="jrCat" data-v="${c}">${esc(C[0])}<span class="mono">${cnt[c]}</span></button>`).join("")}</div></div>
        ${JR.who || JR.cat || JR.q || JR.sens ? `<div class="jr-act st" style="--i:5"><span><b class="mono">${L.length}</b> ${L.length > 1 ? "actions" : "action"}${JR.who ? ` de ${esc(firstName(rlName(JR.who, people.find((p) => p[0] === JR.who)?.[1])))}` : ""}</span><button class="btn ghost sm" data-act="jrReset">${ico("x")}Tout afficher</button></div>` : ""}
        ${days.length ? `<div class="jr-list">${days.map((d) => `<section class="jr-day st" style="--i:${Math.min(6 + k++, 12)}"><div class="jr-dh"><b>${esc(rlCap(rlDayRel(d)))}</b><span class="mono">${byDay[d].length}</span></div><div class="jr-head" aria-hidden="true"><span>Heure</span><span>Qui</span><span>Action</span><span>Type</span><span>Montant</span></div>${dayHTML(byDay[d])}</section>`).join("")}</div>
          ${L.length > shown.length ? `<button class="btn soft block jr-moreb" data-act="jrMore">Voir ${Math.min(200, L.length - shown.length)} de plus</button>` : ""}`
          : `<div class="glass empty st" style="--i:6"><div class="ic">${ico("jrLog")}</div><b>Rien sur cette période</b>${JR.q ? "Essayez un autre mot." : "Chaque relevé, commande, annulation ou changement s'ajoute ici avec son auteur."}</div>`}
      </div><aside class="jr-side">${lead}<section class="glass jr-how st" style="--i:5"><span class="lbl">Comment c'est protégé</span><ul><li>Chaque action porte le nom de qui l'a faite, même sur la tablette partagée.</li><li>Personne ne peut modifier ou effacer une ligne, pas même un gérant.</li><li>Les annulations et les offerts gardent leur motif et leur montant.</li></ul></section></aside></div></div>`;
  },
  after(v) {
    const q = $("#jrQ", v); if (q) { q.addEventListener("input", debounce(() => { JR.q = q.value; JR.n = 120; rerender(); setTimeout(() => { const n = $("#jrQ"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); }, 280)); }
    $$(".jr-kpi b[data-to]", v).forEach((el, i) => { const to = +el.dataset.to; if (to > 0 && typeof countTo === "function" && !JR.counted) setTimeout(() => countTo(el, 0, to, 700), 120 + i * 70); }); JR.counted = true;
  },
};
function jrSheet(id) {
  const e = JR_ROWS().find((x) => x.id === id) || (S.events || []).find((x) => x.id === id); if (!e) return;
  const c = jrCat(e); const C = JR_CAT[c]; const d = new Date(e.at || 0); const wid = jrWhoId(e);
  const tgt = rlTry(() => (typeof homeEvTarget === "function" ? homeEvTarget(e) : false), false);
  openSheet(`<div class="jr-sh ${C[2]}"><div class="jr-shh"><span class="jr-shi">${ico(C[1])}</span><div><span class="lbl">${esc(C[0])}${C[3] ? " · geste sensible" : ""}</span><div class="h2">${esc(rlCap(String(e.text || "").replace(/^a /, "")))}</div></div></div>
    <div class="jr-kv"><div><span>Qui</span><b>${wid ? avatar(wid, true) : ""}${esc(jrWhoName(e))}</b></div>
      <div><span>Quand</span><b class="mono">${esc(rlCap(rlDay(dayKey(d))))} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}</b></div>
      ${e.dev ? `<div><span>Sur</span><b>${esc(e.dev)}</b></div>` : ""}
      ${e.actor && e.uid && e.uid !== e.actorId ? `<div><span>Compte de l'appareil</span><b>${esc(rlName(e.uid))}</b></div>` : ""}
      ${e.amt ? `<div><span>Montant</span><b class="mono">${rlEur(e.amt)}</b></div>` : ""}
      ${e.cancelled ? `<div><span>Ensuite</span><b>Annulé${e.cancelledBy ? ` par ${esc(rlName(e.cancelledBy))}` : ""}${e.cancelledAt ? ` à ${hm(e.cancelledAt)}` : ""}</b></div>` : ""}</div>
    <div class="jr-sha">${wid ? `<button class="btn soft block" data-act="jrWho" data-id="${esc(wid)}">${ico("jrSearch")}Toutes les actions de ${esc(firstName(jrWhoName(e)))}</button>` : ""}
    ${tgt && e.ref ? `<button class="btn ghost block" data-act="jrGoRef" data-id="${esc(e.id)}">Ouvrir${ico("chev")}</button>` : ""}</div>
    <p class="es-fine">Cette ligne ne peut être ni modifiée ni effacée.</p></div>`);
}
function jrCsv() {
  const L = jrFiltered(JR_ROWS()); if (!L.length) { toast("Rien à exporter sur cette période.", "info"); return; }
  const rows = [["Date", "Heure", "Qui", "Action", "Type", "Montant", "Appareil", "Annulé ensuite"]].concat(L.map((e) => { const d = new Date(e.at || 0); return [`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`, jrWhoName(e), rlCap(String(e.text || "").replace(/^a /, "")), JR_CAT[jrCat(e)][0], e.amt ? String(e.amt).replace(".", ",") : "", e.dev || "", e.cancelled ? "oui" : ""]; }));
  const name = `journal-${(S.resto?.name || "restaurant").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dayKey()}.csv`;
  if (typeof regSaveCsv === "function") return regSaveCsv(name, rows);
  const csv = "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); SFX.ok(); toast("Fichier prêt");
}

/* ═══════════════════════════ ACCÈS TEMPORAIRES ═══════════════════════════ */
const AX_WHY = { extra: ["Extra", "axBolt"], stage: ["Stagiaire", "axCap"], saison: ["Saisonnier", "esSun"], rempl: ["Remplacement", "esSwap"] };
const AX_MODES = [["perm", "axInf", "Sans limite", "Équipe fixe : CDI, CDD"], ["soir", "esServ", "Ce soir seulement", "Jusqu'à la fin du service"], ["semaine", "cal", "Cette semaine", "Jusqu'à dimanche soir"], ["mois", "axTimer", "Un mois", "30 jours à partir d'aujourd'hui"], ["date", "calcheck", "Jusqu'au…", "La date de fin de mission"]];
const axUntil = (m) => { const u = m && m.until; return typeof u === "number" && u > 0 ? u : 0; };
const axOn = (m) => { const u = axUntil(m); return !u || u > Date.now(); };
const axTemp = (m) => !!axUntil(m);
const axEndOf = (k) => { const d = parseDay(k); d.setHours(23, 59, 0, 0); return d.getTime(); };
function axModeUntil(A) {
  const t = dayKey();
  if (A.mode === "soir") { const d = parseDay(addDays(t, 1)); d.setHours(4, 0, 0, 0); return d.getTime(); }
  if (A.mode === "semaine") { const dow = parseDay(t).getDay(); return axEndOf(addDays(t, dow === 0 ? 0 : 7 - dow)); }
  if (A.mode === "mois") return axEndOf(addDays(t, 30));
  if (A.mode === "date") return A.date ? axEndOf(A.date) : 0;
  return 0;
}
const axWhen = (u) => { const d = new Date(u); const k = dayKey(d); const tm = d.getHours() === 4 && d.getMinutes() === 0 ? "la fin du service" : d.getHours() === 23 && d.getMinutes() === 59 ? "le soir" : hm(u); return `${rlCap(rlDayRel(k))}${tm === "le soir" ? "" : tm === "la fin du service" ? "" : " à " + tm}`; };
function axLeft(u) {
  const ms = u - Date.now(); if (ms <= 0) return "terminé";
  const h = ms / 36e5; if (h < 1) return `encore ${Math.max(1, Math.round(ms / 6e4))} min`; if (h < 30) return `encore ${Math.round(h)} h`;
  return `encore ${Math.round(h / 24)} jours`;
}
const axEndTx = (u) => { const d = new Date(u); if (d.getHours() === 4 && d.getMinutes() === 0) return `jusqu'à la fin du service de ${rlDayRel(addDays(dayKey(d), -1)) === "aujourd'hui" ? "ce soir" : rlDay(addDays(dayKey(d), -1)) + " soir"}`; return `jusqu'au ${rlDay(dayKey(d))}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`; };
/* a ring that empties as the mission ends */
function axRing(m, sz = 44) {
  const u = axUntil(m); const t0 = m.tmpFrom || m.joinedAt || Date.now() - 864e5; const tot = Math.max(1, u - t0); const left = Math.max(0, Math.min(1, (u - Date.now()) / tot));
  const R = sz / 2 - 4, C = 2 * Math.PI * R;
  return `<span class="ax-ring" style="--s:${sz}px"><svg viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${R}" class="bg"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - left)}"/></svg>${ico("axTimer")}</span>`;
}
const axPill = (m) => { if (!axTemp(m)) return ""; const w = AX_WHY[(m.tmp || {}).why] || AX_WHY.extra; return axOn(m) ? `<span class="ax-pill">${ico("axTimer")}${esc(w[0])} · ${esc(axLeft(axUntil(m)).replace("encore ", ""))}</span>` : `<span class="ax-pill off">${ico("axDoor")}Accès terminé</span>`; };
const axEndedList = (ms) => ms.filter((m) => !axOn(m));
function axEndedCard(list, canManage) {
  return `<div class="glass pad ax-ended st" style="--i:3"><div class="row"><span class="lbl">Accès terminés · ${list.length}</span></div><p class="sub" style="margin:2px 0 8px">Leur accès s'est fermé tout seul. Leurs actions restent dans le journal, à leur nom.</p>
    ${list.map((m) => `<div class="li ax-er">${typeof ccAva === "function" ? ccAva(m, 40) : avatar(m.id)}<div class="tx"><b>${esc(m.name || "")}</b><em>${esc((AX_WHY[(m.tmp || {}).why] || AX_WHY.extra)[0])} · fermé ${esc(rlDayRel(dayKey(new Date(axUntil(m)))))}</em></div>${canManage ? `<button class="btn soft sm" data-act="axReopen" data-id="${esc(m.id)}">${ico("esUnlock")}Rouvrir</button>` : ""}</div>`).join("")}</div>`;
}
/* « Accès temporaire » block on the person's sheet (js/compte.js ccMemberSheet) */
function axMemberBlock(m, edit) {
  if (!m) return ""; const u = axUntil(m);
  if (!u) return edit ? `<button class="ax-mb add" data-act="axSet" data-id="${esc(m.id)}"><span class="ax-mbi">${ico("axTimer")}</span><span><b>Accès sans limite</b><em>Pour un extra ou un stagiaire : un accès qui se ferme tout seul</em></span>${ico("chev")}</button>` : "";
  const w = AX_WHY[(m.tmp || {}).why] || AX_WHY.extra; const on = axOn(m);
  return `<div class="ax-mb${on ? "" : " off"}">${axRing(m, 52)}<div class="ax-mbt"><span class="lbl">${esc(w[0])} · accès temporaire</span><b>${on ? esc(rlCap(axEndTx(u))) : `Terminé ${esc(rlDayRel(dayKey(new Date(u))))}`}</b><em>${on ? `${esc(axLeft(u))}, puis il se ferme tout seul` : "Il ne voit plus rien du restaurant"}</em></div>
    ${edit ? `<div class="ax-mba">${on ? `<button class="btn soft sm" data-act="axPlus" data-id="${esc(m.id)}" data-v="1">+1 jour</button><button class="btn soft sm" data-act="axPlus" data-id="${esc(m.id)}" data-v="7">+1 semaine</button>` : `<button class="btn acc sm" data-act="axReopen" data-id="${esc(m.id)}">${ico("esUnlock")}Rouvrir</button>`}<button class="btn ghost sm" data-act="axSet" data-id="${esc(m.id)}">Changer</button>${on ? `<button class="btn ghost sm ax-stop" data-act="axStop" data-id="${esc(m.id)}">${ico("axDoor")}Fermer maintenant</button>` : ""}</div>` : ""}</div>`;
}
/* the « Jusqu'à quand ? » step of the « Nouvel équipier » flow (js/perms.js) and its own sheet */
function axPickerHTML(A, nm, flow) {
  const u = axModeUntil(A);
  return `<div class="ax-modes">${AX_MODES.map(([k, ic, t, d], i) => `<button class="ax-mode${A.mode === k ? " on" : ""}" style="--i:${i}" data-act="${flow ? "axFMode" : "axSMode"}" data-v="${k}" role="radio" aria-checked="${A.mode === k}"><span class="ax-mi">${ico(IC[ic] ? ic : "axTimer")}</span><span class="tx"><b>${t}</b><em>${d}</em></span>${k === "date" && A.mode === "date" ? `<input class="input ax-date" id="axDate" type="date" min="${dayKey()}" value="${esc(A.date || addDays(dayKey(), 14))}" aria-label="Date de fin">` : ""}</button>`).join("")}</div>
    ${A.mode !== "perm" ? `<div class="lbl pm-lbl">C'est</div><div class="ax-whys">${Object.entries(AX_WHY).map(([k, [t, ic]]) => `<button class="ax-why${A.why === k ? " on" : ""}" data-act="${flow ? "axFWhy" : "axSWhy"}" data-v="${k}" aria-pressed="${A.why === k}">${ico(IC[ic] ? ic : "users")}<span>${t}</span></button>`).join("")}</div>
      <div class="ax-prev"><span class="ax-pv">${ico("axDoor")}</span><span><b>${u ? `L'accès de ${nm} se ferme ${esc(axEndTx(u))}` : "Choisissez la date de fin"}</b><em>${u ? `${esc(axLeft(u))}. Ensuite il ne voit plus rien, ses actions restent signées à son nom.` : ""}</em></span></div>` : ""}`;
}
const axFlowA = (F) => (F.ax ||= { mode: "perm", date: "", why: "extra" });
function axFlowPatch(F) { const A = F && F.ax; if (!A) return {}; const u = axModeUntil(A); return u ? { until: u, tmp: { why: A.why || "extra" }, tmpFrom: Date.now() } : { until: 0 }; }
function axFlowRecap(F) { const A = F && F.ax; const u = A ? axModeUntil(A) : 0; return u ? `avoir un accès ${(AX_WHY[A.why] || AX_WHY.extra)[0].toLowerCase()} ${axEndTx(u)}, puis fermé tout seul` : ""; }
(function axFlowHooks() {
  if (typeof pmSteps !== "function" || typeof pmPane !== "function") return;
  const st0 = pmSteps; window.pmSteps = function (F) { const s = st0(F); if (!F.admin && !s.includes("duree")) { const i = s.indexOf("admin"); s.splice(i >= 0 ? i + 1 : 1, 0, "duree"); } return s; };
  const pa0 = pmPane; window.pmPane = function (F) {
    if (F.step !== "duree") return pa0(F); const A = axFlowA(F); const nm = esc(firstName(F.name) || "Il");
    return `<div class="pm-q"><span class="pm-kick">${nm}</span><h2 class="pm-h">Jusqu'à quand ?</h2><p class="pm-s">Pour un extra ou un stagiaire, l'accès se ferme tout seul. Rien à penser.</p></div>${axPickerHTML(A, nm, true)}`;
  };
  const eo0 = typeof pmEditOpen === "function" ? pmEditOpen : null;
  if (eo0) window.pmEditOpen = function (id) { eo0(id); const m = rlMember(id); if (PM.F && m) { const u = axUntil(m); PM.F.ax = u ? { mode: "date", date: dayKey(new Date(u)), why: (m.tmp || {}).why || "extra" } : { mode: "perm", date: "", why: "extra" }; } };
  if (typeof PERMS !== "undefined") PERMS.edit = (id) => window.pmEditOpen(id);
  if (typeof pmNext === "function") { const nx0 = pmNext; window.pmNext = function () { const F = PM.F; if (F && F.step === "duree") { axFRead(); const A = axFlowA(F); const u = axModeUntil(A); if (A.mode !== "perm" && (!u || u < Date.now())) { SFX.err(); toast(u ? "Cette date est déjà passée." : "Choisissez la date de fin.", "err"); return; } } return nx0.apply(this, arguments); }; }
})();
function axFRead() { const F = PM.F; if (!F || !F.ax) return; const d = $("#axDate"); if (d && d.value) F.ax.date = d.value; }
/* own sheet for a person already in the team */
function axSheet(id) {
  const m = rlMember(id); if (!m) return; const u = axUntil(m);
  AX.S = { id, mode: u ? "date" : "perm", date: u ? dayKey(new Date(u)) : addDays(dayKey(), 14), why: (m.tmp || {}).why || "extra" };
  axSheetPaint();
}
const AX = { S: null, ended: false, tick: 0 };
function axSheetPaint() {
  const A = AX.S; const m = A && rlMember(A.id); if (!m) return; const nm = esc(firstName(m.name) || "Il");
  openSheet(`<div class="ax-sh"><div class="row"><span class="h2">Accès de ${nm}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Un extra, un stagiaire, un remplacement : choisissez jusqu'à quand. L'accès se ferme tout seul.</p>${axPickerHTML(A, nm, false)}
    <button class="btn acc block" data-act="axSSave">${ico("check")}Enregistrer</button></div>`);
}
async function axSave(id, A) {
  const m = rlMember(id); if (!m) return; const u = axModeUntil(A); if (A.mode !== "perm" && !u) { SFX.err(); toast("Choisissez la date de fin.", "err"); return; }
  if (u && u < Date.now()) { SFX.err(); toast("Cette date est déjà passée.", "err"); return; }
  const patch = u ? { until: u, tmp: { why: A.why || "extra" }, tmpFrom: axUntil(m) ? m.tmpFrom || Date.now() : Date.now() } : { until: 0 };
  await safe(DB.update("members", id, patch)); Object.assign(m, patch);
  const fn = firstName(m.name);
  await logEvent("team", u ? `a donné à ${fn} un accès ${(AX_WHY[A.why] || AX_WHY.extra)[0].toLowerCase()} ${axEndTx(u)}` : `a rendu l'accès de ${fn} sans limite`, { k: "acces" }).catch(() => {});
  closeSheet(true); SFX.ok(); buzz(8); toast(u ? `Accès de ${fn} : ${axEndTx(u)}` : `${fn} a un accès sans limite`); renderChrome(); rerender();
}

/* ───────────── the person whose access ended ───────────── */
function axMe() { return rlMember(S.me.id); }
function axCheck() {
  if (!S.resto || !S.ready) return; const m = axMe();
  const ended = !!(m && !axOn(m) && !(S.resto && S.resto.owner === m.id) && !(DB.mode !== "demo" && S.isOwner && !DB.uid));
  if (ended && !AX.ended) axEndedShow(m); else if (!ended && AX.ended) axEndedHide();
  /* a restaurant device: the person who took over loses the hand when their access ends */
  rlTry(() => { const a = typeof esActor === "function" ? esActor() : null; const am = a && rlMember(a.id); if (am && !axOn(am)) { esSetActor(null); toast(`L'accès de ${firstName(am.name)} est terminé`, "info"); renderChrome(); rerender(); } }, 0);
}
function axEndedShow(m) {
  AX.ended = true; const el = rlLayer("axEnded", "ax-end", "Accès terminé"); const u = axUntil(m); const others = (S.restos || []).filter((r) => r.id !== S.rid);
  el.innerHTML = `<div class="ax-endc"><div class="ax-enda" aria-hidden="true"><i></i><i></i><span>${ico("axDoor")}</span></div>
    <span class="ax-endk">${esc(S.resto?.name || "")}</span><h2 class="title">Merci pour votre mission${m.name ? ", " + esc(firstName(m.name)) : ""}</h2>
    <p class="sub">Votre accès ${esc((AX_WHY[(m.tmp || {}).why] || AX_WHY.extra)[0].toLowerCase())} s'est fermé tout seul ${esc(rlDayRel(dayKey(new Date(u))))} à ${hm(u)}. Ce que vous avez fait reste signé à votre nom.</p>
    <p class="sub">Pour revenir, le gérant peut rouvrir votre accès en un geste.</p>
    <div class="ax-endb">${DB.mode === "demo" ? `<button class="btn acc block" data-act="axDemoBack">${ico("esEye")}Démo : revenir à la gérante</button>` : others.length ? `<button class="btn acc block" data-act="restoSwitch">${ico("store")}Ouvrir un autre restaurant</button>` : ""}
      ${DB.mode === "local" && typeof ACT.whoami === "function" ? `<button class="btn soft block" data-act="axWho">${ico("swap")}Changer de profil</button>` : ""}
      ${DB.uid && typeof AUTH !== "undefined" ? `<button class="btn ghost block" data-act="axOut">${ico("out")}Se déconnecter</button>` : ""}</div></div>`;
  void el.offsetWidth; el.classList.add("on"); try { SFX.close(); } catch (e) {}
}
function axEndedHide() { AX.ended = false; rlLayerClose("axEnded"); }
/* pilotage: missions that end soon, and the ones that just ended */
function axPilotStrip() {
  if (!rlIsMgr()) return ""; const now = Date.now();
  const soon = (S.members || []).filter((m) => axTemp(m) && axOn(m) && axUntil(m) - now < 3 * 864e5).sort((a, b) => axUntil(a) - axUntil(b));
  const gone = (S.members || []).filter((m) => axTemp(m) && !axOn(m) && now - axUntil(m) < 3 * 864e5);
  if (!soon.length && !gone.length) return "";
  const m = soon[0] || gone[0];
  return `<button class="es-pstrip ax-ps st" style="--i:1" data-act="ccMember" data-id="${esc(m.id)}"><span class="es-rqi">${ico("axTimer")}</span><span><b>${soon.length ? `${esc(firstName(m.name))} · accès ${esc(axEndTx(axUntil(m)))}` : `Accès de ${esc(firstName(m.name))} terminé`}</b><em>${soon.length > 1 ? `et ${rlPl(soon.length - 1, "autre mission")} qui se termine bientôt` : soon.length ? "Il se fermera tout seul. Prolongez en un geste si besoin." : "Fermé tout seul. Vous pouvez le rouvrir."}</em></span>${ico("chev")}</button>`;
}

/* ═══════════════════════════ hooks ═══════════════════════════ */
(function rlHooks() {
  /* home of every space: the handover card goes first, with the consignes */
  const ch0 = typeof csHomeCard === "function" ? csHomeCard : null;
  window.csHomeCard = function () { const a = rlTry(paHomeCard, ""); const b = ch0 ? rlTry(() => ch0(), "") : ""; return a + b; };
  if (typeof esPilotStrip === "function") { const ps0 = esPilotStrip; window.esPilotStrip = function () { return rlTry(() => ps0(), "") + rlTry(paPilotStrip, "") + rlTry(axPilotStrip, ""); }; }
  /* home: « à lire avant de commencer » opens by itself (not in the demo, where « Voir comme » or « Je pointe » opens it) */
  const H = VIEWS.home; const ha0 = H.after;
  H.after = function (v) { const r = ha0 ? ha0.apply(this, arguments) : undefined; if (DB.mode !== "demo" || PA.pend) { PA.pend = false; setTimeout(() => { if (S.route === "home") paAuto(null, "home"); }, 900); } return r; };
  /* restaurant device: the person who takes over reads it first */
  if (typeof esTookOver === "function") { const to0 = esTookOver; window.esTookOver = function (m) { const r = to0.apply(this, arguments); setTimeout(() => paAuto(m && m.id, "main"), 700); return r; }; }
  /* clock-in: the handover right after « Bon service » */
  if (ACT.rhPunch) { const rp0 = ACT.rhPunch; ACT.rhPunch = async function (a, sid, kind) {
    /* « passation obligatoire »: the person in charge writes it before the clock-out is recorded; the punch goes in right after */
    if (kind === "out" && rlTry(() => paMustWrite(sid), false) && !(PA.F && PA.F.gate)) {
      const p = rhStaff(sid); const args = arguments; const self = this; closeSheet(true); clearTimeout(RH.idleT);
      const m = p.memberId ? rlMember(p.memberId) : null;
      setTimeout(() => paWriteOpen({ by: { id: (m && m.id) || p.memberId || sid, name: p.name || (m && m.name) || "" }, gate: { sid, done: () => { RH.pin = { sid }; rp0.apply(self, args); } } }), 260);
      SFX.tap(); return;
    }
    const r = await rp0.apply(this, arguments); if (kind === "in") { const st = (S.staff || []).find((x) => x.id === sid); setTimeout(() => paAuto((st && st.memberId) || null, "pointage"), 2200); } return r; }; }
  /* end of the coup de feu: write the handover from the recap */
  if (typeof cfRecapSheet === "function") { const cr0 = cfRecapSheet; window.cfRecapSheet = function () { const r = cr0.apply(this, arguments); try { const b = $("#sheetBody .cf-end > .btn:last-child"); if (b && !paWritten() && permOk("passation")) b.insertAdjacentHTML("beforebegin", `<button class="btn acc block pa-cfb" data-act="paWrite">${ico("paBaton")}Passer le relais à l'équipe suivante</button>`), b.classList.replace("acc", "soft"); } catch (e) {} return r; }; }
  /* demo « Voir comme »: the person sees the handover as they start */
  if (typeof esDemoBecome === "function") { const db0 = esDemoBecome; window.esDemoBecome = function (mid, dev) { const r = db0.apply(this, arguments); const m = rlMember(mid); PA.pend = !!(m && m.role !== "gerant" && !dev); AX.ended && !(m && !axOn(m)) && axEndedHide(); setTimeout(axCheck, 400); return r; }; }
  try { if (typeof ES_PERSONAS !== "undefined" && !ES_PERSONAS.some((p) => p[0] === "demo-jade")) ES_PERSONAS.push(["demo-jade", "Stagiaire : son accès s'est fermé tout seul", null]); } catch (e) {}
  /* shared device: expired people disappear from « Qui prend la main ? » */
  if (typeof esTeam === "function") { const et0 = esTeam; window.esTeam = function () { return et0.apply(this, arguments).filter(axOn); }; }
  /* Réglages: one row, next to « Équipe », that says whether the handover is required at clock-out */
  if (VIEWS.reglages && VIEWS.reglages.render) { const rg0 = VIEWS.reglages.render; VIEWS.reglages.render = function () { const h = rg0.apply(this, arguments); if (!rlIsMgr() || !S.resto || h.includes("pa-rgrow")) return h;
    const C = paCfg(); const row = `<div class="li tap pa-rgrow" data-go="passation"><span class="ic w-sa">${ico("paBaton")}</span><div class="tx"><b>Passation de service</b><em>${C.force ? "Obligatoire au départ du responsable" : "Libre · la rendre obligatoire au départ"}</em></div>${ico("chev")}</div>`;
    const i = h.indexOf('data-go="equipe"'); if (i < 0) return h; const j = h.indexOf("</div>", h.indexOf(ico("chev"), i)); return j > 0 ? h.slice(0, j + 6) + row + h.slice(j + 6) : h; }; }
  /* the journal: only for those who run the restaurant */
  if (typeof PERMS !== "undefined" && PERMS.routeAllowed) { const ra0 = PERMS.routeAllowed; PERMS.routeAllowed = function (r) { if (r === "journal") return rlIsMgr() || !!rlTry(() => PERMS.isAdmin(), false); return ra0.apply(this, arguments); }; PERMS.can = (x) => PERMS.routeAllowed(x); }
  /* every action of a restaurant device says which device it was */
  const lg0 = logEvent;
  window.logEvent = function (type, text, extra = {}) { let dev = ""; try { if (typeof esShared === "function" && esShared()) dev = ES_ST[esStation()].dev; } catch (e) {} return lg0(type, text, dev && !extra.dev ? { dev, ...extra } : extra); };
})();
/* the end date: one listener for the flow and the sheet (their panes are repainted) */
document.addEventListener("change", (e) => {
  if (!e.target || e.target.id !== "axDate" || !e.target.value) return;
  if ($("#pmFlow.on") && PM.F && PM.F.ax) { PM.F.ax.date = e.target.value; PM.F.dir = "none"; pmPaint(); SFX.tick(); }
  else if (AX.S) { AX.S.date = e.target.value; axSheetPaint(); SFX.tick(); }
});
window.addEventListener("gg:ready", () => { clearInterval(AX.tick); AX.tick = setInterval(axCheck, 30000); setTimeout(axCheck, 1500); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(axCheck, 500); });

/* ═══════════════════════════ actions ═══════════════════════════ */
Object.assign(ACT, {
  /* passation */
  paWrite: () => { closeSheet(true); paWriteOpen(); },
  paWriteClose: () => { paWriteRead(); const g = PA.F && PA.F.gate; PA.F = null; SFX.close(); rlLayerClose("paWrite"); if (g) { SFX.err(); toast("Départ pas encore pointé : la passation est obligatoire", "err"); } },
  paMood: (a, id, v) => { paWriteRead(); PA.F.mood = PA.F.mood === v ? "" : v; SFX.tick(); buzz(5); paWritePaint(); },
  paSug: (a, id) => { paWriteRead(); const x = PA.F.sug.find((s) => s.id === id); if (!x) return; x.on = !x.on; x.on ? SFX.ok() : SFX.tick(); buzz(4); paWritePaint(); },
  paAdd: (a, id, v) => { paWriteRead(); const F = PA.F; F.items.forEach((x) => delete x.fresh); const it = { id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k: PA_K[v] ? v : "info", t: "", fresh: true }; F.items.push(it); SFX.tap(); buzz(5); paWritePaint(it.id); },
  paDel: (a, id) => { paWriteRead(); PA.F.items = PA.F.items.filter((x) => x.id !== id); SFX.tick(); paWritePaint(); },
  paSend: (a, id, v) => paSend(v === "ok"),
  paMic: (a) => {
    const SR = typeof csSR === "function" ? csSR() : null; if (!SR) return; const ta = $("#paNote"); if (!ta) return;
    if (PA.rec) { try { PA.rec.stop(); } catch (e) {} PA.rec = null; a.classList.remove("on"); return; }
    const r = new SR(); r.lang = "fr-FR"; r.interimResults = false; r.continuous = false; PA.rec = r; a.classList.add("on"); SFX.tap();
    const base = ta.value ? ta.value.replace(/\s*$/, " ") : "";
    r.onresult = (e) => { const t = [...e.results].map((x) => x[0].transcript).join(" "); ta.value = (base + t).slice(0, 600); PA.F.note = ta.value; };
    r.onend = () => { PA.rec = null; a.classList.remove("on"); }; r.onerror = r.onend; try { r.start(); } catch (e) { r.onend(); }
  },
  paOpen: (a, id) => { const h = PA_ROWS().find((x) => x.id === id) || paForNow(); closeSheet(true); if (h) paReadOpen(h); },
  paReadClose: () => { PA.R = null; SFX.close(); rlLayerClose("paRead"); if (S.route === "home" || S.route === "passation") rerender(); },
  paSign: () => paSign(),
  paDetail: (a, id) => paDetail(id),
  paView: (a, id) => { SFX.tap(); paDetail(id); },
  paFilter: (a, id, v) => { S.ui.paF = v; SFX.tick(); buzz(4); rerender(); },
  paClose: async (a, id) => {
    const h = PA_ROWS().find((x) => x.id === id); if (!h) return; const st = paState(h);
    if (st.left && !a.dataset.sure) { a.dataset.sure = "1"; a.innerHTML = `${ico("check")}Toucher encore : clôturer quand même`; SFX.tap(); return; }
    const who = rlWho(); const closed = { at: Date.now(), by: who.id, name: who.name || "" }; h.closed = closed;
    /* the person who closes it has read it too */
    const reads = paMine(h) || paReadAt(h, who.id) ? h.reads || {} : { ...(h.reads || {}), [who.id]: Date.now() }; h.reads = reads;
    SFX.done(); buzz([10, 40, 18]); paReadPaint(); toast("Passation clôturée");
    logEvent("passation", `a clôturé la passation ${paSlotT(h.slot)} de ${firstName(h.by || rlName(h.uid))}${st.left ? ` (${rlPl(st.left, "point")} non traité${st.left > 1 ? "s" : ""})` : ""}`, { ref: id }).catch(() => {});
    await safe(DB.update("handovers", id, { closed, reads })).catch(() => {}); if (S.route === "passation" || S.route === "home") rerender();
  },
  paReopen: async (a, id) => {
    const h = PA_ROWS().find((x) => x.id === id); if (!h) return; h.closed = null; SFX.tap(); paReadPaint(); toast("Passation rouverte");
    logEvent("passation", `a rouvert la passation ${paSlotT(h.slot)} de ${firstName(h.by || rlName(h.uid))}`, { ref: id }).catch(() => {});
    await safe(DB.update("handovers", id, { closed: null })).catch(() => {}); if (S.route === "passation") rerender();
  },
  paEdit: (a, id) => { const h = PA_ROWS().find((x) => x.id === id); if (!h) return; PA.R = null; rlLayerClose("paRead", () => paWriteOpen({ day: h.day, slot: h.slot })); },
  paDel: async (a, id) => {
    const h = PA_ROWS().find((x) => x.id === id); if (!h || !paCanAdmin(h)) return;
    if (!a.dataset.sure) { a.dataset.sure = "1"; a.classList.add("sure"); a.lastChild.textContent = "Toucher encore pour supprimer"; SFX.tap(); buzz(8); return; }
    PA.R = null; rlLayerClose("paRead"); SFX.close(); buzz([14, 30, 14]);
    PA.rows = (PA.rows || []).filter((x) => x.id !== id);
    await safe(DB.del("handovers", id)).catch(() => {});
    logEvent("passation", `a supprimé la passation ${paSlotT(h.slot)} de ${firstName(h.by || rlName(h.uid))} (${rlDay(h.day)})`, { k: "suppr" }).catch(() => {});
    toast("Passation supprimée"); rerender();
  },
  paCfgSheet: () => { S.ui.paCfg = null; SFX.tap(); paCfgSheet(); },
  paCfgForce: () => { const C = S.ui.paCfg; if (!C) return; C.force = !C.force; SFX.tick(); buzz(5); paCfgSheet(); },
  paCfgWho: (a, id) => { const C = S.ui.paCfg; if (!C) return; if (!C.who.length) C.who = rlTry(() => rhPeople(), []).filter(paRespAuto).map((p) => p.id); C.who = C.who.includes(id) ? C.who.filter((x) => x !== id) : [...C.who, id]; if (!C.who.length) C.who = ["-"]; SFX.tick(); buzz(4); paCfgSheet(); },
  paCfgAuto: () => { const C = S.ui.paCfg; if (!C) return; C.who = []; SFX.tick(); paCfgSheet(); },
  paCfgSave: async () => {
    const C = S.ui.paCfg; if (!C) return; const cfg = { force: !!C.force, who: C.who.length > 1 ? C.who.filter((x) => x !== "-") : C.who.slice() };
    await safe(DB.update("restos", S.rid, { paCfg: cfg })); if (S.resto) S.resto.paCfg = cfg; S.ui.paCfg = null;
    logEvent("team", cfg.force ? `a rendu la passation obligatoire au départ du responsable` : `a rendu la passation libre au départ`, { k: "modif" }).catch(() => {});
    closeSheet(true); SFX.ok(); buzz(8); toast(cfg.force ? "Passation obligatoire au départ du responsable" : "Passation libre au départ"); rerender();
  },
  paDone: async (a, id, v) => {
    const h = PA_ROWS().find((x) => x.id === id); if (!h) return; const who = (PA.R && PA.R.pid) || rlWho().id;
    const items = (h.items || []).map((x) => (x.id !== v ? x : x.done ? (({ done, doneBy, doneAt, ...r }) => r)(x) : { ...x, done: Date.now(), doneBy: who }));
    h.items = items; const it = items.find((x) => x.id === v); it && it.done ? (SFX.ok(), buzz([6, 20, 6])) : SFX.tick();
    if (it && it.done) logEvent("passation", `a fait « ${String(it.t).slice(0, 60)} » (passation ${paSlotT(h.slot)})`, { ref: h.id }).catch(() => {});
    if ($("#paRead.on")) paReadPaint(); else rerender();
    await safe(DB.update("handovers", id, { items })).catch(() => {});
  },
  /* journal */
  jrP: (a, id, v) => { JR.p = v; JR.n = 120; JR.counted = false; SFX.tick(); rerender(); },
  jrCat: (a, id, v) => { JR.cat = JR.cat === v ? "" : v; if (!v) JR.sens = false; JR.n = 120; SFX.tick(); buzz(4); rerender(); },
  jrSens: () => { JR.sens = !JR.sens; JR.cat = ""; JR.n = 120; SFX.tick(); buzz(4); rerender(); },
  jrWho: (a, id) => { const was = JR.who === id; closeSheet(true); JR.who = was ? "" : id; JR.n = 120; SFX.tick(); buzz(4); if (S.route !== "journal") go("journal"); else rerender(); },
  jrReset: () => { JR.who = ""; JR.cat = ""; JR.q = ""; JR.sens = false; JR.n = 120; SFX.close(); rerender(); },
  jrGrp: (a, id) => { if (JR.open.has(id)) JR.open.delete(id); else JR.open.add(id); SFX.tap(); buzz(4); rerender(); },
  jrMore: () => { JR.n += 200; SFX.tap(); rerender(); },
  jrOpen: (a, id) => { SFX.tap(); jrSheet(id); },
  jrCsv: () => jrCsv(),
  jrGoRef: (a, id) => { const e = JR_ROWS().find((x) => x.id === id); closeSheet(true); if (!e) return; if (typeof ACT.homeEv === "function") return ACT.homeEv(a, id); if (e.type === "reading" && e.ref) go("frigo", { id: e.ref }); else if (e.type === "note" && e.ref) go("note", { id: e.ref }); else if (e.type === "team") go("equipe"); else if (e.type === "chore") go("menage"); else if (e.type === "reception") go("reception"); },
  /* accès temporaires */
  axFMode: (a, id, v) => { const F = PM.F; if (!F) return; axFRead(); const A = axFlowA(F); A.mode = v; if (v === "date" && !A.date) A.date = addDays(dayKey(), 14); F.dir = "none"; SFX.tick(); buzz(5); pmPaint(); },
  axFWhy: (a, id, v) => { const F = PM.F; if (!F) return; axFRead(); axFlowA(F).why = v; F.dir = "none"; SFX.tick(); pmPaint(); },
  axSet: (a, id) => { SFX.tap(); axSheet(id); },
  axSMode: (a, id, v) => { const A = AX.S; if (!A) return; const d = $("#axDate"); if (d && d.value) A.date = d.value; A.mode = v; SFX.tick(); buzz(4); axSheetPaint(); },
  axSWhy: (a, id, v) => { const A = AX.S; if (!A) return; const d = $("#axDate"); if (d && d.value) A.date = d.value; A.why = v; SFX.tick(); axSheetPaint(); },
  axSSave: async () => { const A = AX.S; if (!A) return; const d = $("#axDate"); if (d && d.value) A.date = d.value; await axSave(A.id, A); AX.S = null; },
  axPlus: async (a, id, v) => {
    const m = rlMember(id); if (!m) return; const base = Math.max(axUntil(m), Date.now()); const u = base + (+v || 1) * 864e5;
    await safe(DB.update("members", id, { until: u })); m.until = u; await logEvent("team", `a prolongé l'accès de ${firstName(m.name)} ${axEndTx(u)}`, { k: "acces" }).catch(() => {});
    SFX.ok(); buzz([6, 20, 6]); toast(`${firstName(m.name)} : ${axEndTx(u)}`); if (typeof ccMemberSheet === "function") ccMemberSheet(id); rerender();
  },
  axStop: async (a, id) => {
    const m = rlMember(id); if (!m) return; if (!a.dataset.sure) { a.dataset.sure = "1"; a.lastChild.textContent = "Toucher encore pour fermer"; SFX.tap(); return; }
    const u = Date.now() - 1000; await safe(DB.update("members", id, { until: u, tmp: { ...(m.tmp || { why: "extra" }) } })); m.until = u;
    await logEvent("team", `a fermé l'accès de ${firstName(m.name)}`, { k: "acces" }).catch(() => {}); SFX.close(); buzz([14, 30, 14]); toast(`Accès de ${firstName(m.name)} fermé`); closeSheet(true); rerender(); renderChrome();
  },
  axReopen: async (a, id) => {
    const m = rlMember(id); if (!m) return; const u = axEndOf(addDays(dayKey(), 7));
    await safe(DB.update("members", id, { until: u, tmpFrom: Date.now() })); m.until = u; m.tmpFrom = Date.now();
    await logEvent("team", `a rouvert l'accès de ${firstName(m.name)} ${axEndTx(u)}`, { k: "acces" }).catch(() => {}); SFX.done(); buzz([10, 30, 10]); toast(`Accès de ${firstName(m.name)} rouvert ${axEndTx(u)}`); closeSheet(true); rerender(); renderChrome();
  },
  axDemoBack: (a, id, v, e) => { const g = (S.members || []).find((m) => m.role === "gerant"); axEndedHide(); if (g && typeof ACT.esDemoAs === "function") ACT.esDemoAs(a, g.id, "", e); },
  axWho: () => { axEndedHide(); ACT.whoami(); },
  axOut: () => { if (typeof AUTH !== "undefined" && AUTH.signOut) AUTH.signOut(); else if (ACT.auSignOut) ACT.auSignOut(); },
});

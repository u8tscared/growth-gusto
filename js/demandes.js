/* Growth Gusto — area: demandes RH (prefix « dr »). Congés, arrêts maladie, absences, échanges de service, indisponibilités.
   Rework of « Mes demandes » / « Demandes de l'équipe » (routes moiDemandes and esDemandes, declared in js/espaces.js).
   - Réglages du gérant, par type : délai minimum (bloquant ou simplement signalé), circuit de validation en plusieurs étapes
     (un gérant, un chef, une personne précise), personnes prévenues en copie, justificatif (aucun / possible / obligatoire + délai),
     durée maximum, demi-journées, répétition chaque semaine (indispo), accord du collègue d'abord (échange).
     Réglages communs : périodes bloquées, nombre d'absents en même temps, le gérant peut toujours trancher.
     Stored on restos/{rid}.drCfg { k:{<kind>:{…}}, blackout:[{from,to,t,kinds,strict}], maxOff, boss } (gérant only, firestore.rules).
   - Data: esRequests {kind, from, to, slot jour|midi|soir, rep "week" + until, note, reason, memberId, name, staffId,
     status attente|ok|refus|annule, late, black, steps[{who,st,by,byName,at,c}], cur, peer{id,name,staffId,st,at,c},
     shift{…}, shift2{…}, docs[{id,name,type,size,at}], docNeed, docDue, cc[], hist[{at,by,n,a,t}], freed[]}.
     Justificatifs: rhDocs/{id} {reqId, uid, readers[], name, type, size, data (data URL ≤ ~900 Ko), at, by}: read only by the
     person, the gérants and the people of the circuit (firestore.rules), so a sick note is never visible to the whole team.
   - Planning: an accepted leave / sick leave / absence / indispo blocks the person in the Planning intelligent (js/planif.js pfLeave
     → drCovers) and shows in the Planning (js/rh.js drPlanMark); accepting can free the person's services, an accepted swap moves
     the shifts itself. Notifications: kind « rh » (js/notifs.js, functions/src/notifs.js), sent to the next person of the circuit. */

Object.assign(IC, {
  drMed: ["r:3,3,18,18,5", "M12 8v8", "M8 12h8"],
  drClip: ["M21.4 11.1l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"],
  drFlow: ["c:5,6,2.5", "c:19,6,2.5", "c:12,18,2.5", "M7.5 6h9", "M6.5 8.2l4 7.6", "M17.5 8.2l-4 7.6"],
  drHist: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  drCal: ["r:3,4,18,17,3", "M3 9h18", "M8 2v4", "M16 2v4", "M8 14h3"],
  drFile: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
});

const DR = { F: null, C: null, open: null, tab: "todo", hk: "all", hp: "all", cache: {}, busy: false, dec: null, cfgDirty: false };
/* default rules, per kind (the gérant changes everything in « Réglages ») */
const DR_DEF = {
  conge: { on: true, notice: 30, strict: false, steps: [{ who: "gerant" }], cc: [], doc: "none", docH: 48, max: 0, half: false, rep: false, peer: false, info: false },
  maladie: { on: true, notice: 0, strict: false, steps: [{ who: "gerant" }], cc: [], doc: "required", docH: 48, max: 0, half: false, rep: false, peer: false, info: true },
  absence: { on: true, notice: 2, strict: false, steps: [{ who: "gerant" }], cc: [], doc: "optional", docH: 72, max: 0, half: true, rep: false, peer: false, info: false },
  echange: { on: true, notice: 2, strict: true, steps: [{ who: "gerant" }], cc: [], doc: "none", docH: 48, max: 0, half: false, rep: false, peer: true, info: false },
  dispo: { on: true, notice: 14, strict: true, steps: [{ who: "gerant" }], cc: [], doc: "none", docH: 48, max: 0, half: true, rep: true, peer: false, info: false },
};
const DR_G0 = { blackout: [], maxOff: 0, boss: true };
const DR_NOTICE = [[0, "Aucun"], [1, "24 h"], [2, "48 h"], [7, "1 sem."], [14, "2 sem."], [21, "3 sem."], [30, "1 mois"], [60, "2 mois"]];
const DR_MAX = [[0, "Sans limite"], [1, "1 jour"], [3, "3 jours"], [7, "1 sem."], [14, "2 sem."], [21, "3 sem."], [31, "1 mois"]];
const DR_DOCH = [[24, "24 h"], [48, "48 h"], [72, "72 h"], [168, "1 sem."]];
const DR_REASONS = { absence: ["Rendez-vous médical", "Raison familiale", "Enfant malade", "Transport", "Démarche administrative", "Autre"], maladie: ["Arrêt de travail", "Accident du travail", "Hospitalisation", "Enfant malade"] };
const DR_SLOTS = [["jour", "Journée"], ["midi", "Midi"], ["soir", "Soir"]];
const DR_TABL = { maladie: "Arrêt", echange: "Échange", dispo: "Indispo" };
const DR_SHORT = { conge: "congé", maladie: "arrêt", absence: "absence", echange: "échange", dispo: "indispo" };
const DR_LEAVE = ["conge", "maladie", "absence"];
const DR_HIST = { send: "a envoyé la demande", ok: "a accepté", refus: "a refusé", peer_ok: "a accepté l'échange", peer_refus: "a refusé l'échange", doc: "a ajouté un justificatif", undoc: "a retiré un justificatif", annule: "a annulé la demande", free: "a libéré les services du planning", restore: "a remis les services au planning", swap: "Le planning est mis à jour : les services sont échangés", auto: "Enregistrée et prise en compte", entered: "a saisi la demande", force: "a validé à la place du circuit" };

/* ───────── rules ───────── */
function drCfg() { const c = (S.resto && S.resto.drCfg) || {}; const k = {}; ES_REQ.forEach(([id]) => { k[id] = { ...DR_DEF[id], ...((c.k || {})[id] || {}) }; }); return { ...DR_G0, ...c, blackout: Array.isArray(c.blackout) ? c.blackout : [], k }; }
const drK = (kind, C) => (C || drCfg()).k[kind] || DR_DEF.conge;
const drKinds = () => ES_REQ.filter(([id]) => drK(id).on !== false);
const drKind = (k) => ES_REQ_OF[k] || ES_REQ[0];
const drIsLeave = (r) => DR_LEAVE.includes(r.kind);
const drRoleOf = (mid) => { const m = esMember(mid); return m ? m.role : ""; };
const drIsBoss = () => drRoleOf(S.me.id) === "gerant" || (DB.mode !== "db" && myRole() === "gerant");
const drName = (mid) => { const m = esMember(mid); return m ? m.name || "" : ""; };
const drNoticeTx = (n) => { const x = DR_NOTICE.find((o) => o[0] === n); if (x) return x[1]; return n % 7 === 0 ? `${n / 7} sem.` : `${n} jours`; };
const drMaxTx = (n) => (DR_MAX.find((o) => o[0] === n) || [0, `${n} jours`])[1];
/* people who can act on a step: "gerant" = every gérant, "chef" = every chef, "m:<memberId>" = that person */
function drWhoIds(who) {
  const M = (S.members || []).filter((m) => m.role !== "kiosk" && m.name);
  if (who === "gerant") return M.filter((m) => m.role === "gerant").map((m) => m.id);
  if (who === "chef") return M.filter((m) => m.role === "chef").map((m) => m.id);
  if (typeof who === "string" && who.startsWith("m:")) return M.some((m) => m.id === who.slice(2)) ? [who.slice(2)] : [];
  return [];
}
function drWhoLabel(who) {
  if (who === "gerant") { const l = drWhoIds("gerant"); return l.length === 1 ? firstName(drName(l[0])) + " (gérant)" : "Un gérant"; }
  if (who === "chef") { const l = drWhoIds("chef"); return l.length === 1 ? firstName(drName(l[0])) + " (chef)" : "Un chef"; }
  if (typeof who === "string" && who.startsWith("m:")) { const n = drName(who.slice(2)); return n || "Ancien membre"; }
  return "Quelqu'un";
}
/* the circuit for a request from `mid`: steps nobody else can answer are dropped (a chef who asks does not validate their own leave) */
function drStepsFor(kind, mid, C) { const k = drK(kind, C); if (k.info) return []; return (k.steps || []).filter((s) => drWhoIds(s.who).some((id) => id !== mid)).map((s) => ({ who: s.who, st: "attente" })); }
function drCircuitTx(kind, mid, peer) {
  const k = drK(kind); const parts = [];
  if (kind === "echange" && k.peer && peer) parts.push(firstName(drName(peer)) || "le collègue");
  drStepsFor(kind, mid).forEach((s) => parts.push(drWhoLabel(s.who)));
  if (k.info) return "Prise en compte tout de suite, le gérant est prévenu";
  return parts.length ? parts.join(", puis ") : "Acceptée tout de suite (personne d'autre ne valide)";
}

/* ───────── dates ───────── */
const drToday = () => dayKey();
function drDays(r) { const a = parseDay(r.from), b = parseDay(r.to || r.from); if (!a || !b) return 1; return Math.max(1, Math.round((b - a) / 864e5) + 1); }
const drD = (k, wd) => { const d = parseDay(k); if (!d) return ""; return `${wd ? ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][d.getDay()] + " " : ""}${d.getDate()} ${ES_MS[d.getMonth()]}`; };
function drDates(r) {
  const sl = r.slot && r.slot !== "jour" ? ` ${r.slot}` : "";
  if (r.rep === "week") return `chaque ${DAYS[parseDay(r.from).getDay()]}${sl}, du ${drD(r.from)} au ${drD(r.until || r.to || r.from)}`;
  if (r.to && r.to !== r.from) return `du ${drD(r.from, true)} au ${drD(r.to, true)}`;
  return `${drD(r.from, true)}${sl}`;
}
function drShort(r) { const t = DR_SHORT[r.kind] || "absence"; return r.slot && r.slot !== "jour" && r.kind !== "echange" ? `${t} ${r.slot}` : t; }
const drSvcOf = (s) => ((rhT2m(s.start) || 0) < 16 * 60 ? "midi" : "soir");
/* does a request cover this day (and this service)? recurring indispos repeat on the weekday of `from` until `until` */
function drCovers(r, k, svc) {
  if (!r || !r.from || !k) return false;
  const end = r.rep === "week" ? r.until || r.to || r.from : r.to || r.from;
  if (k < r.from || k > end) return false;
  if (r.rep === "week" && parseDay(k).getDay() !== parseDay(r.from).getDay()) return false;
  if (svc && r.slot && r.slot !== "jour" && r.slot !== svc) return false;
  return true;
}
const drEnd = (r) => (r.rep === "week" ? r.until || r.to || r.from : r.to || r.from);
/* an accepted leave that day (Mon planning, Mon espace) */
function esLeaveOn(day, mid = S.me.id) { return ES_REQS().find((r) => r.memberId === mid && r.status === "ok" && DR_LEAVE.includes(r.kind) && drCovers(r, day)) || null; }
function drSid(mid) { const p = typeof rhPeople === "function" ? rhPeople({ all: true }).find((x) => x.memberId === mid) : null; if (p) return p.id; const s = esStaff(mid); return s ? s.id : ""; }
function drShiftsOf(r) { const sid = r.staffId || drSid(r.memberId); if (!sid || typeof rhShiftsOf !== "function") return []; return rhShiftsOf(sid, r.from, drEnd(r)).filter((s) => drCovers(r, s.day, drSvcOf(s))); }
const drShTx = (s) => (s ? `${drD(s.day, true)} · ${s.start}–${s.end}` : "");

/* ───────── checks before sending ───────── */
function drEarliest(kind) { const n = +drK(kind).notice || 0; return addDays(drToday(), n); }
function drLate(kind, from) { const n = +drK(kind).notice || 0; return n > 0 && kind !== "maladie" && from < drEarliest(kind); }
function drBlack(kind, from, to) { return drCfg().blackout.find((b) => b && b.from && (!b.kinds || !b.kinds.length || b.kinds.includes(kind)) && from <= (b.to || b.from) && (to || from) >= b.from) || null; }
/* everything the person and the approver should know: [level ok|warn|bad, text, blocking] */
function drChecks(F, forMgr) {
  const k = drK(F.kind); const out = []; const today = drToday(); if (!F.from) return out;
  const to = F.rep ? F.until || F.from : F.to || F.from;
  if (F.kind !== "maladie" && F.from < today && !forMgr) out.push(["bad", "La date est déjà passée.", true]);
  if (F.kind === "maladie" && F.from < addDays(today, -31) && !forMgr) out.push(["bad", "Un arrêt de plus d'un mois en arrière : voyez-le avec le gérant.", true]);
  if (drLate(F.kind, F.from) && !forMgr) {
    const tx = `Le restaurant demande ${drNoticeTx(+k.notice)} à l'avance pour ${drKind(F.kind)[3]} : au plus tôt le ${drD(drEarliest(F.kind), true)}.`;
    out.push(k.strict ? ["bad", tx, true] : ["warn", `${tx} Vous pouvez l'envoyer, elle sera marquée « hors délai ».`, false]);
  }
  const b = drBlack(F.kind, F.from, to);
  if (b && !forMgr) { const tx = `Période bloquée${b.t ? ` « ${b.t} »` : ""} du ${drD(b.from)} au ${drD(b.to || b.from)}.`; out.push(b.strict ? ["bad", tx, true] : ["warn", tx + " La demande sera signalée.", false]); }
  if (+k.max && F.kind !== "maladie" && !F.rep && drDays({ from: F.from, to }) > +k.max && !forMgr) out.push(["bad", `${drMaxTx(+k.max)} au plus d'affilée pour ${drKind(F.kind)[3]}.`, true]);
  if (to < F.from) out.push(["bad", "La date de fin est avant la date de début.", true]);
  const mid = F.forMid || S.me.id;
  if (drIsLeave(F) || F.kind === "dispo") {
    const sh = drShiftsOf({ ...F, to, staffId: drSid(mid), memberId: mid });
    if (sh.length) out.push(["warn", `${esPl(sh.length, "service prévu", "services prévus")} au planning sur ces dates : ${sh.slice(0, 3).map(drShTx).join(", ")}${sh.length > 3 ? "…" : ""}.`, false]);
    const max = +drCfg().maxOff; if (max && drIsLeave(F) && F.kind !== "maladie") { const d = drBusiest(F.from, to, mid); if (d && d.n >= max) out.push(["warn", `Déjà ${esPl(d.n, "personne absente", "personnes absentes")} le ${drD(d.day, true)} (limite fixée : ${max}).`, false]); }
  }
  if (F.kind === "echange") {
    if (!F.shift) out.push(["bad", "Choisissez le service à échanger.", true]);
    if (!F.peer) out.push(["bad", "Choisissez avec qui.", true]);
    const sh = (S.shifts || []).find((s) => s.id === F.shift); const pSid = F.peer ? drSid(F.peer) : "";
    if (sh && pSid) {
      const busy = rhShiftsOf(pSid, sh.day, sh.day).filter((x) => x.id !== F.shift2 && drOverlap(x, sh));
      if (busy.length) out.push(["warn", `${firstName(drName(F.peer))} travaille déjà ce jour-là (${busy.map((x) => `${x.start}–${x.end}`).join(", ")}).`, false]);
      const lv = ES_REQS().find((r) => r.memberId === F.peer && ["ok", "attente"].includes(r.status) && r.kind !== "echange" && drCovers(r, sh.day, drSvcOf(sh)));
      if (lv) out.push(["warn", `${firstName(drName(F.peer))} a ${lv.status === "ok" ? "" : "demandé "}${drKind(lv.kind)[3]} ce jour-là.`, false]);
    }
  }
  const need = k.doc === "required" && !(F.docs || []).length && !F.later && !forMgr;
  if (need) out.push(["bad", "Ajoutez le justificatif (photo ou PDF), ou cochez « Je l'envoie plus tard ».", true]);
  return out;
}
function drOverlap(a, b) { const iv = (s) => { const x = rhT2m(s.start) || 0; let y = rhT2m(s.end) || x; if (y <= x) y += 1440; return [x, y]; }; const [a1, a2] = iv(a), [b1, b2] = iv(b); return a1 < b2 && b1 < a2; }
/* the most crowded day of a period: how many other people are off (accepted or pending leaves) */
function drBusiest(from, to, mid) {
  let best = null; for (let d = from, i = 0; d <= to && i < 62; d = addDays(d, 1), i++) {
    const n = new Set(ES_REQS().filter((r) => r.memberId !== mid && DR_LEAVE.includes(r.kind) && ["ok", "attente"].includes(r.status) && drCovers(r, d)).map((r) => r.memberId)).size;
    if (!best || n > best.n) best = { day: d, n };
  }
  return best;
}

/* ───────── circuit state ───────── */
function drStage(r) {
  if (!r || r.status !== "attente") return null;
  if (r.peer && r.peer.st === "attente") return { t: "peer", ids: [r.peer.id], label: firstName(r.peer.name || drName(r.peer.id)) || "le collègue" };
  const st = (r.steps || [])[r.cur || 0];
  if (st) return { t: "step", st, ids: drWhoIds(st.who).filter((id) => id !== r.memberId), label: drWhoLabel(st.who) };
  /* requests written before the circuit existed: the gérants and chefs answer */
  if (!r.steps) return { t: "legacy", ids: (S.members || []).filter((m) => ["gerant", "chef"].includes(m.role) && m.id !== r.memberId).map((m) => m.id), label: "Le gérant" };
  return { t: "step", st: null, ids: drWhoIds("gerant").filter((id) => id !== r.memberId), label: "Le gérant" };
}
function drCanAct(r, mid = S.me.id) {
  const g = drStage(r); if (!g) return false; if (g.ids.includes(mid)) return true;
  return g.t !== "peer" && drCfg().boss !== false && drRoleOf(mid) === "gerant" && mid !== r.memberId;
}
/* what is waiting for me: the colleague who must accept a swap, the person of the circuit, the gérant */
function esReqPending(mid = S.me.id) { return ES_REQS().filter((r) => drCanAct(r, mid)); }
const drTodo = () => esReqPending().sort((a, b) => (a.from || "").localeCompare(b.from || ""));
function drWhereTx(r) {
  if (r.status === "ok") return r.kind === "maladie" && !(r.steps || []).length ? "Prise en compte" : "Acceptée";
  if (r.status === "refus") return "Refusée"; if (r.status === "annule") return "Annulée";
  const g = drStage(r); if (!g) return ""; return g.t === "peer" ? `Attend l'accord de ${g.label}` : `Chez ${g.label}`;
}
function drDocLate(r) { return r.docNeed === "required" && !(r.docs || []).length && !["refus", "annule"].includes(r.status); }
function drMyReqs() { return ES_REQS().filter((r) => r.memberId === S.me.id).sort((a, b) => (b.at || 0) - (a.at || 0)); }

/* ───────── notifications (kind « rh »: js/notifs.js, functions/src/notifs.js) ───────── */
function drNotify(ids, title, body) {
  const to = [...new Set(ids || [])].filter((id) => id && id !== S.me.id && id !== DB.uid); if (!to.length) return;
  const mgr = to.filter((id) => ["gerant", "chef"].includes(drRoleOf(id))), team = to.filter((id) => !mgr.includes(id));
  if (DB.mode !== "db" || !DB.db || !S.rid) return;
  [[mgr, "esDemandes"], [team, "moiDemandes"]].forEach(([l, route]) => {
    if (!l.length) return;
    try { DB.db.collection(`restos/${S.rid}/notifs`).add({ kind: "rh", uid: DB.uid, title: String(title).slice(0, 90), body: String(body).slice(0, 180), url: `./?go=${route}`, to: l.slice(0, 50), at: Date.now() }).catch((e) => console.warn("rh notif", e)); } catch (e) { console.warn("rh notif", e); }
  });
}
const drWhoTx = (r) => `${firstName(r.name) || "Quelqu'un"} · ${drKind(r.kind)[2].toLowerCase()} ${drDates(r)}`;

/* ───────── justificatifs ───────── */
function drPickFile(cb, camera) {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = camera ? "image/*" : "image/*,application/pdf"; if (camera) inp.setAttribute("capture", "environment");
  inp.style.cssText = "position:fixed;left:-9999px;opacity:0"; document.body.appendChild(inp);
  inp.addEventListener("change", () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) cb(f); }, { once: true });
  setTimeout(() => { if (inp.isConnected && !(inp.files && inp.files.length)) inp.remove(); }, 120000);
  inp.click();
}
async function drReadFile(f) {
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name || "")) {
    if (f.size > 700 * 1024) throw new Error("big");
    const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(f); });
    return { name: String(f.name || "justificatif.pdf").slice(0, 80), type: "application/pdf", size: f.size, data };
  }
  let { canvas } = await shrink(f, 1700, 0.82); let data = "";
  for (const q of [0.8, 0.7, 0.6, 0.5, 0.42]) { data = canvas.toDataURL("image/jpeg", q); if (data.length <= 640 * 1024) break; }
  if (data.length > 640 * 1024) { const c = document.createElement("canvas"); const k = 1200 / Math.max(canvas.width, canvas.height); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k); c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); data = c.toDataURL("image/jpeg", 0.55); canvas = c; }
  return { name: String(f.name || "photo").replace(/\.\w+$/, "").slice(0, 70) + ".jpg", type: "image/jpeg", size: Math.round(data.length * 0.75), data, w: canvas.width, h: canvas.height };
}
const drKo = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
/* who may open the file: the person, every gérant, and the people of the circuit and the copy */
function drReaders(r) { const ids = new Set(drWhoIds("gerant")); (r.steps || []).forEach((s) => drWhoIds(s.who).forEach((id) => ids.add(id))); (r.cc || []).forEach((id) => ids.add(id)); ids.delete(r.memberId); return [...ids].slice(0, 40); }
async function drDocSave(r, f) {
  const doc = { reqId: r.id, uid: r.memberId, readers: drReaders(r), name: f.name, type: f.type, size: f.size, data: f.data, at: Date.now(), by: S.me.id };
  const id = await DB.add("rhDocs", doc); DR.cache[id] = doc; return { id, name: f.name, type: f.type, size: f.size, at: doc.at };
}
async function drDocGet(id) {
  if (DR.cache[id]) return DR.cache[id];
  let d = null;
  try { if (DB.mode === "db") { const s = await DB.db.doc(`restos/${S.rid}/rhDocs/${id}`).get(); d = s.exists ? s.data() : null; } else d = (DB.local[DB.path("rhDocs")] || {})[id] || null; } catch (e) { console.warn("rhDocs", e); d = null; }
  if (d) DR.cache[id] = d; return d;
}
const drDocIco = (t) => (t === "application/pdf" ? "drFile" : "image");

/* ═══════════════════════════ rows, cards ═══════════════════════════ */
function drAva(mid, sz = 36) {
  const p = typeof rhPeople === "function" ? rhPeople({ all: true }).find((x) => x.memberId === mid) : null;
  if (p && typeof rhAva === "function") return rhAva(p, sz);
  const m = esMember(mid) || { name: "?" }; return `<span class="rh-ava" style="--s:${sz}px;--c:${esc(m.color || "#5A6386")}">${esc(initials(m.name || "?"))}</span>`;
}
function drPill(r) {
  if (r.status === "ok") return `<span class="pill ok">${r.kind === "maladie" && !(r.steps || []).length ? "Pris en compte" : "Acceptée"}</span>`;
  if (r.status === "refus") return `<span class="pill bad">Refusée</span>`; if (r.status === "annule") return `<span class="pill neu">Annulée</span>`;
  return `<span class="pill warn"><span class="dot"></span>En attente</span>`;
}
function drFlags(r) {
  const f = [];
  if (r.late) f.push(`<span class="dr-flag warn">Hors délai</span>`);
  if (r.black) f.push(`<span class="dr-flag warn">Période bloquée</span>`);
  if (drDocLate(r)) f.push(`<span class="dr-flag ${r.docDue && r.docDue < Date.now() ? "bad" : "warn"}">Justificatif ${r.docDue && r.docDue < Date.now() ? "en retard" : "attendu"}</span>`);
  if ((r.docs || []).length) f.push(`<span class="dr-flag neu">${ico("drClip")}${r.docs.length}</span>`);
  if (r.by && r.by !== r.memberId) f.push(`<span class="dr-flag neu">Saisie par ${esc(firstName(drName(r.by)) || "le gérant")}</span>`);
  return f.length ? `<span class="dr-flags">${f.join("")}</span>` : "";
}
function drRow(r, o = {}) {
  const k = drKind(r.kind); const act = o.act && drCanAct(r); const g = drStage(r);
  const sub = [drDates(r), drIsLeave(r) && r.rep !== "week" ? esPl(drDays(r), "jour") : "", r.kind === "echange" && r.peer ? `avec ${firstName(r.peer.name || drName(r.peer.id))}` : "", r.reason || ""].filter(Boolean).join(" · ");
  return `<div class="dr-row k-${esc(r.kind)}${act ? " act" : ""}" data-act="drOpen" data-id="${esc(r.id)}" role="button" tabindex="0">
    ${o.who ? `<span class="dr-rava">${drAva(r.memberId, 40)}<i class="dr-rk">${ico(k[1])}</i></span>` : `<span class="es-rqi">${ico(k[1])}</span>`}
    <div class="dr-rt"><b>${o.who ? `${esc(firstName(r.name))} · ` : ""}${esc(k[2])}</b><em>${esc(sub)}</em>${r.note ? `<em class="dr-rn">« ${esc(r.note)} »</em>` : ""}
      ${r.status === "attente" && g ? `<em class="dr-where">${esc(drWhereTx(r))}</em>` : r.answer && r.status !== "attente" ? `<em class="dr-rn">${esc(firstName(r.answeredByName || "") || "Réponse")} : « ${esc(r.answer)} »</em>` : ""}${drFlags(r)}</div>
    ${act ? `<div class="dr-rb"><button class="btn sm soft" data-act="drDecide" data-id="${esc(r.id)}" data-v="refus" aria-label="Refuser">${ico("x")}</button><button class="btn sm acc" data-act="drDecide" data-id="${esc(r.id)}" data-v="ok">${g && g.t === "peer" ? "J'accepte" : "Accepter"}</button></div>` : drPill(r)}</div>`;
}
/* the steps, drawn as a little path: Envoyée → Inès → Thomas → Camille */
function drPath(r) {
  const nodes = [{ t: "Envoyée", s: "ok", sub: drD(dayKey(new Date(r.at || Date.now()))) }];
  if (r.peer) nodes.push({ t: firstName(r.peer.name || drName(r.peer.id)) || "Collègue", s: r.peer.st === "ok" ? "ok" : r.peer.st === "refus" ? "no" : r.status === "attente" ? "cur" : "skip", sub: "collègue" });
  (r.steps || []).forEach((st, i) => nodes.push({ t: st.by && ["ok", "refus"].includes(st.st) ? firstName(st.byName || drName(st.by)) : drWhoLabel(st.who).replace(/ \((gérant|chef)\)$/, ""), s: st.st === "ok" ? "ok" : st.st === "refus" ? "no" : st.st === "skip" ? "skip" : r.status === "attente" && (r.cur || 0) === i && !(r.peer && r.peer.st === "attente") ? "cur" : "wait", sub: st.st === "skip" ? "passée" : /gérant/.test(drWhoLabel(st.who)) ? "gérant" : /chef/.test(drWhoLabel(st.who)) ? "chef" : "valide" }));
  if (!r.steps && r.status !== "attente") nodes.push({ t: firstName(r.answeredByName || "") || "Gérant", s: r.status === "ok" ? "ok" : "no", sub: "gérant" });
  if (!r.steps && r.status === "attente") nodes.push({ t: "Gérant", s: "cur", sub: "valide" });
  nodes.push({ t: r.status === "ok" ? (r.kind === "maladie" && !(r.steps || []).length ? "Pris en compte" : "Acceptée") : r.status === "refus" ? "Refusée" : r.status === "annule" ? "Annulée" : "Réponse", s: r.status === "ok" ? "ok" : r.status === "refus" ? "no" : r.status === "annule" ? "skip" : "wait", sub: "" });
  return `<ol class="dr-path">${nodes.map((n, i) => `<li class="${n.s}" style="--j:${i}"><i>${n.s === "ok" ? ico("check") : n.s === "no" ? ico("x") : ""}</i><b>${esc(n.t)}</b>${n.sub ? `<em>${esc(n.sub)}</em>` : ""}</li>`).join("")}</ol>`;
}
/* the « Mon espace » card */
function esReqCard() {
  const mine = drMyReqs().filter((r) => r.status === "attente" || (r.at || 0) > Date.now() - 30 * 864e5); const todo = drTodo(); const late = drMyReqs().filter(drDocLate);
  return `<section class="glass es-reqc st" style="--i:6"><div class="row"><span class="lbl">Mes demandes</span><button class="btn ghost sm" data-act="esReqNew">${ico("plus")}Demander</button></div>
    ${todo.length ? `<button class="dr-todo" data-go="moiDemandes"><span class="es-rqi">${ico("esInbox")}</span><span><b>${esPl(todo.length, "demande")} à vous de répondre</b><em>${esc(todo.slice(0, 2).map(drWhoTx).join(" · "))}</em></span>${ico("chev")}</button>` : ""}
    ${late.length ? `<button class="dr-todo warn" data-act="drOpen" data-id="${esc(late[0].id)}"><span class="es-rqi">${ico("drClip")}</span><span><b>Justificatif à envoyer</b><em>${esc(drKind(late[0].kind)[2])} ${esc(drDates(late[0]))}${late[0].docDue ? ` · avant le ${esc(drD(dayKey(new Date(late[0].docDue))))} ${hm(late[0].docDue)}` : ""}</em></span>${ico("chev")}</button>` : ""}
    ${mine.length ? `<div class="es-rql">${mine.slice(0, 3).map((r) => drRow(r)).join("")}</div>${drMyReqs().length > 3 ? `<button class="btn ghost sm" data-go="moiDemandes">Tout voir</button>` : ""}`
      : `<div class="es-rqe">${drKinds().slice(0, 4).map(([k, i, t]) => `<button class="es-rqk" data-act="esReqNew" data-v="${k}">${ico(i)}<span>${esc(t)}</span></button>`).join("")}</div>`}
  </section>`;
}
/* in the Planning (js/rh.js): who is off, on a sick leave or unavailable that day */
function drPlanMark(p, d) {
  const rows = ES_REQS().filter((r) => r.kind !== "echange" && ["ok", "attente"].includes(r.status) && (r.staffId === p.id || (p.memberId && r.memberId === p.memberId)) && drCovers(r, d));
  if (!rows.length) return "";
  const has = typeof rhShiftsDay === "function" ? rhShiftsDay(p.id, d) : [];
  return rows.slice(0, 2).map((r) => { const clash = r.status === "ok" && has.some((s) => drCovers(r, d, drSvcOf(s))); return `<span class="dr-pm k-${esc(r.kind)}${r.status === "attente" ? " wait" : ""}${clash ? " clash" : ""}" data-act="drOpen" data-id="${esc(r.id)}" title="${esc(`${drKind(r.kind)[2]}${r.status === "attente" ? " (demandé)" : ""}${clash ? " : un service est encore prévu" : ""}`)}">${ico(drKind(r.kind)[1])}<span>${esc(drShort(r))}${r.status === "attente" ? " ?" : ""}</span></span>`; }).join("");
}

/* ═══════════════════════════ the request sheet ═══════════════════════════ */
function drNewF(kind, day, forMid) {
  const k = ES_REQ_OF[kind] && drK(kind).on !== false ? kind : (drKinds()[0] || ES_REQ[0])[0];
  const mgr = !!forMid; const d0 = day || (k === "maladie" || k === "absence" || mgr ? drToday() : drEarliest(k) > drToday() ? drEarliest(k) : addDays(drToday(), 1));
  const F = { kind: k, from: d0, to: d0, slot: "jour", rep: false, until: addDays(d0, 56), note: "", reason: "", shift: "", peer: "", shift2: "", docs: [], later: false, forMid: forMid || "", okNow: mgr };
  if (k === "echange") { const mine = drMyShifts(); const s = (day && mine.find((x) => x.day === day)) || mine[0]; if (s) { F.shift = s.id; F.from = F.to = s.day; } }
  return F;
}
function drMyShifts(mid = S.me.id) { const sid = drSid(mid); if (!sid || typeof rhShiftsOf !== "function") return []; const t = drToday(); const now = hm(Date.now()); return rhShiftsOf(sid, t, addDays(t, 60)).filter((s) => s.day > t || s.start > now); }
function drRead() {
  const F = DR.F; if (!F) return; const g = (i) => { const el = $("#" + i); return el ? el.value : null; };
  F.from = g("drFrom") ?? F.from; F.to = g("drTo") ?? F.to; F.until = g("drUntil") ?? F.until; F.note = (g("drNote") ?? F.note).slice(0, 200);
  if (F.kind === "echange" || F.rep) F.to = F.from; if (F.to && F.to < F.from && F.kind !== "echange") F.to = F.from;
  if (F.kind === "echange") { const s = (S.shifts || []).find((x) => x.id === F.shift); if (s) F.from = F.to = s.day; }
}
function drSheet() {
  const F = DR.F; if (!F) return; const k = drK(F.kind); const kk = drKind(F.kind); const mid = F.forMid || S.me.id; const mgr = !!F.forMid;
  const kinds = drKinds().map(([id, i, t]) => `<button class="${id === F.kind ? "on" : ""}" data-act="drKindF" data-v="${id}" aria-label="${esc(t)}">${ico(i)}<span>${esc(DR_TABL[id] || t)}</span></button>`).join("");
  let body = "";
  if (F.kind === "echange") {
    const mine = drMyShifts(mid); const sh = mine.find((s) => s.id === F.shift);
    const team = (typeof rhPeople === "function" ? rhPeople() : []).filter((p) => p.memberId && p.memberId !== mid);
    const theirs = F.peer ? drMyShifts(F.peer).filter((s) => !sh || s.day !== sh.day || !drOverlap(s, sh)) : [];
    body = `<span class="lbl">Mon service à échanger</span>
      ${mine.length ? `<div class="dr-shl">${mine.slice(0, 14).map((s) => `<button class="dr-shc${s.id === F.shift ? " on" : ""}" data-act="drShiftF" data-v="${esc(s.id)}"><b>${esc(drD(s.day, true))}</b><em class="mono">${esc(s.start)}–${esc(s.end)}</em>${s.post && RH_POSTS[s.post] ? `<i>${esc(RH_POSTS[s.post].t)}</i>` : ""}</button>`).join("")}</div>` : `<p class="dr-empty">Aucun service prévu dans les 2 mois à venir.</p>`}
      <span class="lbl">Avec qui</span>
      <div class="dr-ppl">${team.map((p) => `<button class="dr-pc${F.peer === p.memberId ? " on" : ""}" data-act="drPeerF" data-v="${esc(p.memberId)}">${rhAva(p, 34)}<span>${esc(rhFirst(p))}</span></button>`).join("") || `<p class="dr-empty">Personne d'autre dans l'équipe.</p>`}</div>
      ${F.peer ? `<span class="lbl">En échange, je prends</span><div class="dr-shl"><button class="dr-shc${!F.shift2 ? " on" : ""}" data-act="drShift2F" data-v=""><b>Rien</b><em>${esc(firstName(drName(F.peer)))} me remplace</em></button>${theirs.slice(0, 12).map((s) => `<button class="dr-shc${s.id === F.shift2 ? " on" : ""}" data-act="drShift2F" data-v="${esc(s.id)}"><b>${esc(drD(s.day, true))}</b><em class="mono">${esc(s.start)}–${esc(s.end)}</em></button>`).join("")}</div>` : ""}`;
  } else {
    const range = !F.rep && F.kind !== "absence" || (F.kind === "absence" && F.slot === "jour");
    body = `<div class="grid2"><label class="field"><span class="lbl">${range ? "Du" : "Le"}</span><input class="input" type="date" id="drFrom" value="${esc(F.from)}"${F.kind !== "maladie" && !mgr ? ` min="${drToday()}"` : ""}></label>
      ${F.rep ? `<label class="field"><span class="lbl">Jusqu'au</span><input class="input" type="date" id="drUntil" value="${esc(F.until)}" min="${esc(F.from)}"></label>` : range ? `<label class="field"><span class="lbl">Au</span><input class="input" type="date" id="drTo" value="${esc(F.to)}" min="${esc(F.from)}"></label>` : "<span></span>"}</div>
      ${k.half ? `<div class="seg dr-seg" role="tablist">${DR_SLOTS.map(([s, t]) => `<button class="${F.slot === s ? "on" : ""}" data-act="drSlotF" data-v="${s}">${t}</button>`).join("")}</div>` : ""}
      ${k.rep ? `<button class="dr-li" data-act="drRepF" role="switch" aria-checked="${!!F.rep}"><span class="tx"><b>Chaque semaine</b><em>${F.rep ? `Tous les ${DAYS[parseDay(F.from).getDay()]}s${F.slot !== "jour" ? " " + F.slot : ""}, jusqu'à la date choisie` : "Par exemple : jamais le lundi midi"}</em></span>${drSw(F.rep)}</button>` : ""}
      ${DR_REASONS[F.kind] ? `<div class="dr-chips">${DR_REASONS[F.kind].map((x) => `<button class="chip${F.reason === x ? " on" : ""}" data-act="drReasonF" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : ""}`;
  }
  const docs = k.doc !== "none" || (F.docs || []).length ? `<span class="lbl">Justificatif${k.doc === "required" ? " · obligatoire" : " · si vous en avez un"}</span>
    <div class="dr-docs">${(F.docs || []).map((d, i) => `<div class="dr-doc">${d.type === "application/pdf" ? `<span class="dr-dth">${ico("drFile")}</span>` : `<img class="dr-dth" src="${d.data}" alt="">`}<span class="tx"><b>${esc(d.name)}</b><em>${drKo(d.size)}</em></span><button class="iconbtn" data-act="drDocDropF" data-v="${i}" aria-label="Retirer">${ico("trash")}</button></div>`).join("")}
      <div class="dr-dadd"><button class="btn soft sm" data-act="drDocAddF" data-v="cam">${ico("camera")}Photo</button><button class="btn soft sm" data-act="drDocAddF">${ico("drClip")}Fichier ou PDF</button></div>
      ${k.doc === "required" && !(F.docs || []).length && !mgr ? `<button class="dr-li" data-act="drLaterF" role="switch" aria-checked="${!!F.later}"><span class="tx"><b>Je l'envoie plus tard</b><em>Au plus tard ${drDocHTx(k.docH)} après l'envoi de la demande</em></span>${drSw(F.later)}</button>` : ""}</div>` : "";
  const ph = { conge: "Mariage de ma sœur à Bordeaux", maladie: "Fièvre, le médecin m'arrête 3 jours", absence: "Rendez-vous à 11 h, je peux venir le soir", echange: "Je prends son soir, il prend mon midi", dispo: "Cours du soir le mardi" }[F.kind] || "";
  const chk = drChecks(F, mgr); const block = chk.some((c) => c[2]);
  const circ = mgr ? "" : `<div class="dr-circ">${ico("drFlow")}<span><b>Circuit</b>${esc(drCircuitTx(F.kind, mid, F.peer))}</span></div>`;
  openSheet(`<div class="es-sh dr-sh"><div class="es-shh"><span class="h2">${mgr ? `${esc(kk[2])} pour ${esc(firstName(drName(F.forMid)))}` : `Demander ${esc(kk[3])}`}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="es-kinds dr-kinds">${kinds}</div>
    ${!mgr && (+k.notice > 0 && F.kind !== "maladie") ? `<p class="dr-rule">${ico("clock")}<span>${esc(drNoticeTx(+k.notice))} à l'avance${k.strict ? "" : " (conseillé)"}${k.doc === "required" ? ` · justificatif obligatoire` : ""}</span></p>` : !mgr && F.kind === "maladie" ? `<p class="dr-rule">${ico("drMed")}<span>Prévenez dès que possible. ${k.doc === "required" ? `Envoyez l'arrêt de travail sous ${esc(drDocHTx(k.docH))}.` : ""}</span></p>` : ""}
    ${body}
    <label class="field"><span class="lbl">${mgr ? "Note" : "Un mot pour le gérant"}</span><input class="input" id="drNote" maxlength="200" value="${esc(F.note || "")}" placeholder="${esc(ph)}"></label>
    ${docs}
    <div id="drChk">${drChkHTML(chk)}</div>
    ${circ}
    ${mgr ? `<button class="dr-li" data-act="drOkNowF" role="switch" aria-checked="${!!F.okNow}"><span class="tx"><b>Accepter tout de suite</b><em>${F.okNow ? "Enregistrée comme acceptée, la personne est prévenue" : "Suit le circuit de validation habituel"}</em></span>${drSw(F.okNow)}</button>` : ""}
    <button class="btn acc block" data-act="drSend"${block ? " disabled" : ""}>${ico("check")}${mgr ? "Enregistrer" : "Envoyer la demande"}</button></div>`, (b) => {
    $$("#drFrom,#drTo,#drUntil", b).forEach((el) => el.addEventListener("change", () => { drRead(); drSheet(); }));
  });
}
const drDocHTx = (h) => (DR_DOCH.find((x) => x[0] === +h) || [0, `${h} h`])[1];
const drSw = (on) => `<span class="dr-sw${on ? " on" : ""}" aria-hidden="true"><i></i></span>`;
const drDot = (t) => String(t).replace(/\.\.(\s|$)/g, ".$1");
const drChkHTML = (chk) => (chk.length ? `<div class="dr-chk">${chk.map(([l, t]) => `<p class="${l}">${ico(l === "bad" ? "alert" : "clock")}<span>${esc(drDot(t))}</span></p>`).join("")}</div>` : "");

async function drSend(btn) {
  const F = DR.F; if (!F || DR.busy) return; drRead(); const mgr = !!F.forMid; const mid = F.forMid || S.me.id;
  const chk = drChecks(F, mgr); const bad = chk.find((c) => c[2]); if (bad) { SFX.err(); toast(drDot(bad[1]), "err"); drSheet(); return; }
  const k = drK(F.kind); const now = Date.now(); const me = { id: S.me.id, n: S.me.name || "" };
  const sh = F.kind === "echange" ? (S.shifts || []).find((s) => s.id === F.shift) : null; const sh2 = F.shift2 ? (S.shifts || []).find((s) => s.id === F.shift2) : null;
  const to = F.kind === "echange" ? sh.day : F.rep ? F.from : F.to || F.from;
  const peerP = F.peer ? { id: F.peer, name: drName(F.peer), staffId: drSid(F.peer), st: k.peer ? "attente" : "skip" } : null;
  let steps = mgr && F.okNow ? [] : drStepsFor(F.kind, mid);
  const doc = {
    kind: F.kind, from: F.from, to, slot: k.half || F.kind === "absence" ? F.slot : "jour", ...(F.rep ? { rep: "week", until: F.until || addDays(F.from, 56) } : {}),
    note: F.note || "", reason: F.reason || "", memberId: mid, name: drName(mid) || (mgr ? "" : me.n), staffId: drSid(mid), status: "attente", at: now, uid: S.me.id,
    late: !mgr && drLate(F.kind, F.from), black: !mgr && drBlack(F.kind, F.from, to) ? drBlack(F.kind, F.from, to).t || "oui" : "",
    steps, cur: 0, cc: (k.cc || []).filter((id) => id !== mid), docs: [], docNeed: k.doc, ...(k.doc === "required" ? { docDue: now + (+k.docH || 48) * 36e5 } : {}),
    ...(peerP ? { peer: peerP } : {}), ...(sh ? { shift: { id: sh.id, day: sh.day, start: sh.start, end: sh.end, post: sh.post || "" } } : {}), ...(sh2 ? { shift2: { id: sh2.id, day: sh2.day, start: sh2.start, end: sh2.end, post: sh2.post || "" } } : {}),
    hist: [{ at: now, by: me.id, n: me.n, a: mgr ? "entered" : "send" }], ...(mgr ? { by: me.id } : {}),
  };
  if (peerP && peerP.st === "skip") doc.peer = { ...peerP };
  const done = !steps.length && !(peerP && peerP.st === "attente");
  if (done) { doc.status = "ok"; doc.answeredBy = me.id; doc.answeredByName = me.n; doc.answeredAt = now; doc.hist.push({ at: now + 1, by: me.id, n: me.n, a: mgr ? "ok" : "auto" }); }
  DR.busy = true; if (btn) btn.disabled = true;
  let id; try { id = await safe(DB.add("esRequests", doc)); } catch (e) { DR.busy = false; if (btn) btn.disabled = false; return; }
  const r = { ...doc, id };
  if ((F.docs || []).length) { try { const list = []; for (const f of F.docs) list.push(await drDocSave(r, f)); await DB.update("esRequests", id, { docs: list, docDue: null }); r.docs = list; } catch (e) { console.warn("rhDocs", e); toast("La demande est partie, mais pas le justificatif : ajoutez-le depuis la demande.", "err"); } }
  DR.busy = false; DR.F = null; closeSheet(); SFX.done ? SFX.done() : SFX.ok(); buzz([10, 40, 10]); try { burst(); } catch (e) {}
  /* who hears about it */
  const g = drStage(r);
  if (done) { if (done && r.kind === "echange") await drSwap(r); drNotify([mid, ...(r.cc || []), ...drWhoIds("gerant")], mgr ? `${drKind(r.kind)[2]} enregistré` : `${firstName(r.name)} : ${drKind(r.kind)[2].toLowerCase()}`, `${drDates(r)}${r.note ? " · " + r.note : ""}`); }
  else if (g) drNotify(g.ids, g.t === "peer" ? `${firstName(r.name)} vous propose un échange` : `Demande à valider : ${drWhoTx(r)}`, g.t === "peer" ? `${drShTx(r.shift)}${r.shift2 ? ` contre ${drShTx(r.shift2)}` : ""}` : r.note || drDates(r));
  if (!done && (r.cc || []).length) drNotify(r.cc, `Pour info : ${drWhoTx(r)}`, r.note || "");
  toast(done ? (mgr ? "Enregistrée et acceptée" : r.kind === "maladie" ? "Arrêt enregistré, le gérant est prévenu" : "Acceptée") : g ? `Envoyée à ${g.label}` : "Demande envoyée");
  logEvent("request", mgr ? `a saisi ${drKind(r.kind)[3]} pour ${firstName(r.name)} (${drDates(r)})` : `a demandé ${drKind(r.kind)[3]} (${drDates(r)})`);
}

/* ═══════════════════════════ deciding ═══════════════════════════ */
async function drApply(r, ok, c, opts = {}) {
  const now = Date.now(); const me = { id: S.me.id, n: S.me.name || "" }; const g = drStage(r); if (!g) return;
  const hist = [...(r.hist || [])]; const patch = {};
  const force = g.t !== "peer" && !g.ids.includes(me.id);
  if (g.t === "peer") { patch.peer = { ...r.peer, st: ok ? "ok" : "refus", at: now, c: c || "" }; hist.push({ at: now, by: me.id, n: me.n, a: ok ? "peer_ok" : "peer_refus", t: c || "" }); }
  else {
    const steps = (r.steps || []).map((s) => ({ ...s }));
    if (steps[r.cur || 0]) Object.assign(steps[r.cur || 0], { st: ok ? "ok" : "refus", by: me.id, byName: me.n, at: now, c: c || "" });
    if (force && ok) steps.forEach((s, i) => { if (i > (r.cur || 0) && s.st === "attente") s.st = "skip"; });
    if (r.steps) patch.steps = steps; hist.push({ at: now, by: me.id, n: me.n, a: force && ok ? "force" : ok ? "ok" : "refus", t: c || "" });
    patch.cur = ok ? (force ? steps.length : (r.cur || 0) + 1) : r.cur || 0;
  }
  const nx = { ...r, ...patch };
  const final = !ok || (g.t === "peer" ? !(r.steps || []).length : !r.steps || nx.cur >= (nx.steps || []).length);
  if (final) Object.assign(patch, { status: ok ? "ok" : "refus", answeredBy: me.id, answeredByName: me.n, answeredAt: now, answer: c || "" });
  patch.hist = hist; Object.assign(nx, patch);
  await safe(DB.update("esRequests", r.id, patch));
  if (final && ok && r.kind === "echange") await drSwap(nx);
  if (final && ok && opts.free && drIsLeave(r)) await drFree(nx, true);
  /* tell the next one, or the person (and the colleague, the copy) */
  if (final) {
    drNotify([r.memberId], ok ? `${drKind(r.kind)[2]} accepté${r.kind === "echange" || r.kind === "absence" || r.kind === "dispo" ? "" : ""}` : `${drKind(r.kind)[2]} refusé`, `${drDates(r)}${c ? ` · « ${c} »` : ""} (${me.n})`);
    if (r.kind === "echange" && r.peer && g.t !== "peer") drNotify([r.peer.id], ok ? "Échange validé : le planning est à jour" : "Échange refusé", drShTx(r.shift));
    if (ok) drNotify(r.cc || [], `Accepté : ${drWhoTx(r)}`, me.n);
  } else { const g2 = drStage(nx); if (g2) drNotify(g2.ids, `Demande à valider : ${drWhoTx(r)}`, `${g.t === "peer" ? `${firstName(r.peer.name)} a accepté l'échange` : `${firstName(me.n)} a accepté`} · à vous`); }
  logEvent("request", `a ${ok ? "accepté" : "refusé"} ${g.t === "peer" ? "l'échange proposé par" : "la demande de"} ${firstName(r.name)} (${drKind(r.kind)[2].toLowerCase()} ${drDates(r)})`);
  return { final, nx };
}
/* swap: my shift goes to the colleague, theirs (if any) comes to me */
async function drSwap(r) {
  const a = r.shift && (S.shifts || []).find((s) => s.id === r.shift.id); const b = r.shift2 && (S.shifts || []).find((s) => s.id === r.shift2.id);
  const me = r.staffId || drSid(r.memberId), them = (r.peer && (r.peer.staffId || drSid(r.peer.id))) || "";
  if (!them) return;
  try {
    if (typeof rhEnsure === "function") { const P = rhPeople({ all: true }); for (const sid of [me, them]) { const p = P.find((x) => x.id === sid); if (p && p._virtual) await rhEnsure(p); } }
    if (a) await DB.update("shifts", a.id, { staffId: them, swapReq: r.id, by: S.me.id });
    if (b) await DB.update("shifts", b.id, { staffId: me, swapReq: r.id, by: S.me.id });
    await DB.update("esRequests", r.id, { swapped: true, hist: [...(r.hist || []), { at: Date.now() + 2, by: S.me.id, n: S.me.name || "", a: "swap" }] });
  } catch (e) { console.warn("swap", e); toast("L'échange est validé, mais le planning n'a pas pu être changé : faites-le dans Planning.", "err"); }
}
/* an accepted leave: the person's services of those days leave the planning (kept on the request, to put them back) */
async function drFree(r, quiet) {
  const l = drShiftsOf(r); if (!l.length) return 0;
  const freed = l.map(({ id, ...doc }) => ({ id, ...doc }));
  for (const s of l) await DB.del("shifts", s.id).catch(() => {});
  const cur = ES_REQS().find((x) => x.id === r.id) || r;
  await DB.update("esRequests", r.id, { freed: [...(cur.freed || []), ...freed], hist: [...(cur.hist || r.hist || []), { at: Date.now() + 3, by: S.me.id, n: S.me.name || "", a: "free", t: esPl(l.length, "service") }] });
  if (!quiet) toast(`${esPl(l.length, "service retiré", "services retirés")} du planning`);
  return l.length;
}
async function drRestore(r) {
  const l = r.freed || []; for (const { id, ...doc } of l) await DB.set("shifts", id, doc).catch(() => {});
  await DB.update("esRequests", r.id, { freed: [], hist: [...(r.hist || []), { at: Date.now(), by: S.me.id, n: S.me.name || "", a: "restore", t: esPl(l.length, "service") }] });
  toast(`${esPl(l.length, "service remis", "services remis")} au planning`);
}
function drDecideSheet(r, v) {
  const g = drStage(r); if (!g) return; const ok = v === "ok"; const sh = drIsLeave(r) ? drShiftsOf(r) : []; const force = g.t !== "peer" && !g.ids.includes(S.me.id);
  DR.dec = { id: r.id, v, free: DR.dec && DR.dec.id === r.id ? DR.dec.free : true };
  const imp = g.t === "peer" ? "" : drImpactHTML(r);
  openSheet(`<div class="es-sh dr-sh"><div class="es-shh"><span class="h2">${ok ? (g.t === "peer" ? "Accepter l'échange" : "Accepter") : "Refuser"}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="dr-dh">${drAva(r.memberId, 44)}<span><b>${esc(r.name || "")} · ${esc(drKind(r.kind)[2])}</b><em>${esc(drDates(r))}${drIsLeave(r) && r.rep !== "week" ? ` · ${esPl(drDays(r), "jour")}` : ""}</em></span></div>
    ${g.t === "peer" ? `<div class="dr-swap">${drSwapHTML(r)}</div>` : ""}
    ${imp}
    ${force && ok ? `<p class="dr-rule">${ico("drFlow")}<span>C'était à ${esc(g.label)} de répondre : en tant que gérant, vous validez directement la demande.</span></p>` : ""}
    ${ok && sh.length && g.t !== "peer" && drWillFinish(r) ? `<button class="dr-li" data-act="drDecFree" role="switch" aria-checked="${DR.dec.free}"><span class="tx"><b>Retirer ses ${esPl(sh.length, "service")} du planning</b><em>${esc(sh.slice(0, 3).map(drShTx).join(", "))}${sh.length > 3 ? "…" : ""}</em></span>${drSw(DR.dec.free)}</button>` : ""}
    <label class="field"><span class="lbl">${ok ? "Un mot (facultatif)" : "Pourquoi ? (la personne le lira)"}</span><textarea class="input dr-ta" id="drDecC" rows="2" maxlength="200" placeholder="${ok ? "Bon repos !" : "Trop de monde en congé cette semaine-là"}"></textarea></label>
    <button class="btn ${ok ? "acc" : "danger"} block" data-act="drDecGo">${ico(ok ? "check" : "x")}${ok ? (drWillFinish(r) ? "Accepter la demande" : "Accepter et passer à la suite") : "Refuser la demande"}</button></div>`);
}
const drWillFinish = (r) => { const g = drStage(r); if (!g) return false; if (g.t === "peer") return !(r.steps || []).length; if (!r.steps) return true; if (!g.ids.includes(S.me.id)) return true; return (r.cur || 0) + 1 >= r.steps.length; };
function drSwapHTML(r) {
  return `<div class="dr-swc"><span class="lbl">${esc(firstName(r.name))} vous donne</span><b>${esc(drShTx(r.shift) || "—")}</b>${r.shift && r.shift.post && RH_POSTS[r.shift.post] ? `<em>${esc(RH_POSTS[r.shift.post].t)}</em>` : ""}</div>
    <span class="dr-swi">${ico("esSwap")}</span>
    <div class="dr-swc"><span class="lbl">${r.shift2 ? `Et prend votre service` : "En échange"}</span><b>${r.shift2 ? esc(drShTx(r.shift2)) : "Rien : vous le remplacez"}</b></div>`;
}
/* what the approver should look at before answering: planned services, others off, notice, blocked period */
function drImpactHTML(r) {
  const L = []; const sh = drIsLeave(r) || r.kind === "dispo" ? drShiftsOf(r) : [];
  if (r.late) L.push(["warn", `Hors délai : posée le ${drD(dayKey(new Date(r.at)))}, le restaurant demande ${drNoticeTx(+drK(r.kind).notice)} à l'avance.`]);
  if (r.black) L.push(["warn", `Tombe sur une période bloquée${r.black !== "oui" ? ` (« ${r.black} »)` : ""}.`]);
  if (sh.length && r.status !== "refus") L.push([r.status === "ok" ? "bad" : "warn", `${esPl(sh.length, "service encore prévu", "services encore prévus")} : ${sh.slice(0, 4).map(drShTx).join(", ")}${sh.length > 4 ? "…" : ""}.`]);
  if (drIsLeave(r)) {
    const others = ES_REQS().filter((x) => x.id !== r.id && x.memberId !== r.memberId && DR_LEAVE.includes(x.kind) && ["ok", "attente"].includes(x.status) && x.from <= drEnd(r) && drEnd(x) >= r.from);
    if (others.length) L.push(["neu", `Aussi absents : ${others.slice(0, 4).map((x) => `${firstName(x.name)} (${drShort(x)}${x.status === "attente" ? ", demandé" : ""}, ${drDates(x)})`).join(" ; ")}.`]);
    const max = +drCfg().maxOff; if (max) { const d = drBusiest(r.from, drEnd(r), r.memberId); if (d && d.n >= max) L.push(["warn", `Limite d'absents atteinte le ${drD(d.day, true)} : ${d.n} déjà (limite ${max}).`]); }
    if (r.kind === "conge") { const y = (r.from || "").slice(0, 4); const n = ES_REQS().filter((x) => x.memberId === r.memberId && x.kind === "conge" && x.status === "ok" && (x.from || "").startsWith(y) && x.id !== r.id).reduce((a, x) => a + drDays(x), 0); L.push(["neu", n ? `${firstName(r.name)} a déjà ${esPl(n, "jour")} de congé accepté${n > 1 ? "s" : ""} en ${y}.` : `Premier congé de ${firstName(r.name)} en ${y}.`]); }
  }
  if (r.kind === "echange" && r.shift && r.peer) {
    const pSid = r.peer.staffId || drSid(r.peer.id); const busy = pSid ? rhShiftsOf(pSid, r.shift.day, r.shift.day).filter((x) => (!r.shift2 || x.id !== r.shift2.id) && drOverlap(x, r.shift)) : [];
    if (busy.length && r.status === "attente") L.push(["warn", `${firstName(r.peer.name)} travaille déjà ce créneau (${busy.map((x) => `${x.start}–${x.end}`).join(", ")}).`]);
  }
  if (drDocLate(r)) L.push([r.docDue && r.docDue < Date.now() ? "bad" : "warn", `Justificatif pas encore reçu${r.docDue ? ` (attendu avant le ${drD(dayKey(new Date(r.docDue)))} ${hm(r.docDue)})` : ""}.`]);
  return L.length ? `<div class="dr-chk">${L.map(([l, t]) => `<p class="${l}">${ico(l === "neu" ? "users" : l === "bad" ? "alert" : "clock")}<span>${esc(drDot(t))}</span></p>`).join("")}</div>` : "";
}

/* ═══════════════════════════ the detail sheet ═══════════════════════════ */
function drDetail(id) {
  const r = ES_REQS().find((x) => x.id === id); if (!r) { toast("Cette demande n'existe plus.", "err"); return; }
  const k = drKind(r.kind); const mine = r.memberId === S.me.id; const boss = drIsBoss(); const mgr = esIsMgr(); const act = drCanAct(r);
  const canSeeDocs = mine || boss || drReaders(r).includes(S.me.id) || mgr;
  const shLeft = drIsLeave(r) && r.status === "ok" && mgr ? drShiftsOf(r) : [];
  const hist = (r.hist || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  openSheet(`<div class="es-sh dr-sh dr-det k-${esc(r.kind)}"><div class="es-shh"><span class="h2">${esc(k[2])}</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <div class="dr-dh">${drAva(r.memberId, 48)}<span><b>${esc(r.name || "")}</b><em>${esc(drDates(r))}${drIsLeave(r) && r.rep !== "week" ? ` · ${esPl(drDays(r), "jour")}` : ""}</em></span>${drPill(r)}</div>
    ${drPath(r)}
    ${r.kind === "echange" ? `<div class="dr-swap">${drSwapHTML(r)}</div>` : ""}
    ${r.reason || r.note ? `<div class="dr-note">${r.reason ? `<b>${esc(r.reason)}</b>` : ""}${r.note ? `<span>« ${esc(r.note)} »</span>` : ""}</div>` : ""}
    ${!mine || mgr ? drImpactHTML(r) : drFlags(r)}
    ${canSeeDocs && (r.docNeed && r.docNeed !== "none" || (r.docs || []).length) ? `<span class="lbl">Justificatifs</span><div class="dr-docs">
      ${(r.docs || []).map((d) => `<div class="dr-doc"><span class="dr-dth">${ico(drDocIco(d.type))}</span><span class="tx"><b>${esc(d.name)}</b><em>${drKo(d.size || 0)} · ${esc(drD(dayKey(new Date(d.at || r.at))))}</em></span><button class="btn soft sm" data-act="drDocView" data-id="${esc(r.id)}" data-v="${esc(d.id)}">Voir</button>${mine && r.status !== "annule" || boss ? `<button class="iconbtn" data-act="drDocDel" data-id="${esc(r.id)}" data-v="${esc(d.id)}" aria-label="Retirer">${ico("trash")}</button>` : ""}</div>`).join("") || `<p class="dr-empty">${r.docNeed === "required" ? "Aucun justificatif pour l'instant." : "Aucun justificatif."}</p>`}
      ${(mine || mgr) && !["annule", "refus"].includes(r.status) ? `<div class="dr-dadd"><button class="btn soft sm" data-act="drDocAdd" data-id="${esc(r.id)}" data-v="cam">${ico("camera")}Photo</button><button class="btn soft sm" data-act="drDocAdd" data-id="${esc(r.id)}">${ico("drClip")}Fichier ou PDF</button></div>` : ""}
      <p class="dr-fine">Visible seulement par ${mine ? "vous" : esc(firstName(r.name))}, les gérants et les personnes qui valident.</p></div>` : ""}
    <span class="lbl">Historique</span><ol class="dr-hist">${hist.map((h) => `<li class="a-${esc(h.a)}"><i></i><span><b>${h.a === "swap" || h.a === "auto" ? "" : esc(firstName(h.n) || "Quelqu'un") + " "}${esc(DR_HIST[h.a] || h.a)}${h.t && !["ok", "refus", "peer_ok", "peer_refus", "force"].includes(h.a) ? ` · ${esc(h.t)}` : ""}</b>${h.t && ["ok", "refus", "peer_ok", "peer_refus", "force"].includes(h.a) ? `<em>« ${esc(h.t)} »</em>` : ""}<em class="mono">${esc(drD(dayKey(new Date(h.at)), true))} · ${hm(h.at)}</em></span></li>`).join("") || `<li><i></i><span><b>Envoyée</b><em class="mono">${esc(drD(dayKey(new Date(r.at || Date.now())), true))}</em></span></li>`}</ol>
    <div class="dr-acts">
      ${act ? `<div class="hstack dr-decb"><button class="btn soft" data-act="drDecide" data-id="${esc(r.id)}" data-v="refus">${ico("x")}Refuser</button><button class="btn acc" data-act="drDecide" data-id="${esc(r.id)}" data-v="ok">${ico("check")}${drStage(r).t === "peer" ? "J'accepte l'échange" : "Accepter"}</button></div>` : ""}
      ${shLeft.length ? `<button class="btn soft block" data-act="drFree" data-id="${esc(r.id)}">${ico("drCal")}Retirer ses ${esPl(shLeft.length, "service")} du planning</button>` : ""}
      ${(r.freed || []).length && mgr ? `<button class="btn ghost block" data-act="drRestore" data-id="${esc(r.id)}">${ico("drHist")}Remettre les ${esPl(r.freed.length, "service")} au planning</button>` : ""}
      ${(mine || boss) && (r.status === "attente" || (r.status === "ok" && drEnd(r) >= drToday() && r.kind !== "echange")) ? `<button class="btn ghost block dr-cancel" data-act="drCancel" data-id="${esc(r.id)}">${r.status === "ok" ? "Annuler cette absence" : "Annuler la demande"}</button>` : ""}
    </div></div>`);
}

/* ═══════════════════════════ pages ═══════════════════════════ */
function drKindGrid() {
  return `<div class="es-rqe big dr-kgrid st" style="--i:2">${drKinds().map(([kk, i, t]) => { const k = drK(kk); const h = kk === "maladie" ? (k.doc === "required" ? `Arrêt sous ${drDocHTx(k.docH)}` : "Prévenir au plus vite") : kk === "echange" ? (+k.notice ? `${drNoticeTx(+k.notice)} avant` : "Avec un collègue") : +k.notice ? `${drNoticeTx(+k.notice)} avant` : "Sans délai"; return `<button class="es-rqk k-${kk}" data-act="esReqNew" data-v="${kk}">${ico(i)}<span>${esc(t)}</span><em>${esc(h)}</em></button>`; }).join("")}</div>`;
}
function drYearTot(mid) { const y = drToday().slice(0, 4); const T = { conge: 0, maladie: 0, absence: 0, echange: 0, dispo: 0 }; ES_REQS().filter((r) => r.memberId === mid && r.status === "ok" && (r.from || "").startsWith(y)).forEach((r) => { T[r.kind] = (T[r.kind] || 0) + (DR_LEAVE.includes(r.kind) ? drDays(r) : 1); }); return T; }
VIEWS.moiDemandes = {
  render() {
    const mine = drMyReqs(); const todo = drTodo(); const late = mine.filter(drDocLate); const T = drYearTot(S.me.id);
    const open = mine.filter((r) => r.status === "attente" || (r.status === "ok" && drEnd(r) >= drToday())), old = mine.filter((r) => !open.includes(r));
    return `<div class="inner narrow es-rqp dr-page">${topBar("Mes demandes")}
      ${todo.length ? `<span class="lbl st" style="--i:1">À vous de répondre · ${todo.length}</span><section class="glass es-rql pad st dr-todol" style="--i:1">${todo.map((r) => drRow(r, { who: true, act: true })).join("")}</section>` : ""}
      ${late.map((r) => `<button class="dr-todo warn st" style="--i:1" data-act="drOpen" data-id="${esc(r.id)}"><span class="es-rqi">${ico("drClip")}</span><span><b>Justificatif à envoyer</b><em>${esc(drKind(r.kind)[2])} ${esc(drDates(r))}${r.docDue ? ` · avant le ${esc(drD(dayKey(new Date(r.docDue))))} ${hm(r.docDue)}` : ""}</em></span>${ico("chev")}</button>`).join("")}
      ${drKindGrid()}
      <div class="dr-tots st" style="--i:3"><span><b class="mono">${T.conge}</b>jour${T.conge > 1 ? "s" : ""} de congé</span><span><b class="mono">${T.maladie}</b>jour${T.maladie > 1 ? "s" : ""} d'arrêt</span><span><b class="mono">${T.absence}</b>absence${T.absence > 1 ? "s" : ""}</span><span><b class="mono">${T.echange}</b>échange${T.echange > 1 ? "s" : ""}</span><em>en ${drToday().slice(0, 4)}, acceptés</em></div>
      ${open.length ? `<span class="lbl st" style="--i:4">En cours et à venir</span><section class="glass es-rql pad st" style="--i:4">${open.map((r) => drRow(r)).join("")}</section>` : ""}
      ${old.length ? `<span class="lbl st" style="--i:5">Historique</span><section class="glass es-rql pad st" style="--i:5">${old.slice(0, 40).map((r) => drRow(r)).join("")}</section>` : ""}
      ${!mine.length ? `<div class="glass empty st" style="--i:4"><div class="ic">${ico("esSun")}</div><b>Aucune demande</b>Un congé, un arrêt, une absence, un échange : tout passe par ici, et vous suivez la réponse.</div>` : ""}</div>`;
  },
};
VIEWS.esDemandes = {
  render() {
    if (!esIsMgr()) return VIEWS.noaccess ? VIEWS.noaccess.render({ route: "esDemandes" }) : "";
    const boss = drIsBoss(); if (DR.tab === "cfg" && !boss) DR.tab = "todo";
    const all = ES_REQS(); const pend = all.filter((r) => r.status === "attente").sort((a, b) => (drCanAct(b) ? 1 : 0) - (drCanAct(a) ? 1 : 0) || (a.from || "").localeCompare(b.from || ""));
    const late = all.filter((r) => drDocLate(r) && r.status !== "attente");
    const tabs = [["todo", `À traiter${pend.length ? ` · ${pend.length}` : ""}`], ["hist", "Historique"], ["cal", "Absences"], ...(boss ? [["cfg", "Réglages"]] : [])];
    let body = "";
    if (DR.tab === "todo") {
      body = `${pend.length ? `<section class="glass es-rql pad st" style="--i:3">${pend.map((r) => drRow(r, { who: true, act: true })).join("")}</section>` : `<div class="glass empty st" style="--i:3"><div class="ic">${ico("esInbox")}</div><b>Rien à traiter</b>Les demandes de l'équipe arrivent ici, et sur votre téléphone si les notifications sont activées.</div>`}
        ${late.length ? `<span class="lbl st" style="--i:4">Justificatifs attendus</span><section class="glass es-rql pad st" style="--i:4">${late.map((r) => drRow(r, { who: true })).join("")}</section>` : ""}`;
    } else if (DR.tab === "hist") body = drHistView(all);
    else if (DR.tab === "cal") body = drCalView(all);
    else body = drCfgView();
    return `<div class="inner es-rqp dr-page dr-mgr${DR.tab === "cfg" ? " narrow" : ""}">${topBar("Demandes de l'équipe", { right: `<button class="btn soft sm" data-act="drForWho">${ico("plus")}<span>Saisir</span></button>` })}
      <div class="seg dr-tabs st" style="--i:1" role="tablist">${tabs.map(([k, t]) => `<button class="${DR.tab === k ? "on" : ""}" data-act="drTab" data-v="${k}" role="tab" aria-selected="${DR.tab === k}">${esc(t)}</button>`).join("")}</div>
      ${DR.tab === "todo" ? `<p class="sub st" style="--i:2">Chaque demande suit le circuit choisi dans Réglages. Votre réponse arrive aussitôt chez la personne.</p>` : ""}
      ${body}</div>`;
  },
  after(v) {
    $$("[data-drn]", v).forEach((el) => el.addEventListener("change", () => { const [kind, f] = el.dataset.drn.split("|"); const C = drC(); const n = Math.max(0, Math.min(365, parseInt(el.value, 10) || 0)); if (kind === "g") C[f] = n; else C.k[kind][f] = n; DR.cfgDirty = true; SFX.tick(); rerender(); }));
  },
};
function drHistView(all) {
  const ppl = [...new Map(all.map((r) => [r.memberId, r.name])).entries()].filter(([id]) => id).sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));
  const list = all.filter((r) => (DR.hk === "all" || r.kind === DR.hk) && (DR.hp === "all" || r.memberId === DR.hp)).sort((a, b) => (b.from || "").localeCompare(a.from || "") || (b.at || 0) - (a.at || 0));
  const y = drToday().slice(0, 4);
  const tot = ppl.map(([id, n]) => ({ id, n, T: drYearTot(id) })).filter((x) => Object.values(x.T).some(Boolean));
  return `<div class="dr-filt st" style="--i:3"><button class="chip${DR.hk === "all" ? " on" : ""}" data-act="drHk" data-v="all">Tout</button>${ES_REQ.map(([k, , t]) => `<button class="chip${DR.hk === k ? " on" : ""}" data-act="drHk" data-v="${k}">${esc(t)}</button>`).join("")}</div>
    <div class="dr-filt ppl st" style="--i:3"><button class="chip${DR.hp === "all" ? " on" : ""}" data-act="drHp" data-v="all">Toute l'équipe</button>${ppl.map(([id, n]) => `<button class="chip${DR.hp === id ? " on" : ""}" data-act="drHp" data-v="${esc(id)}">${esc(firstName(n))}</button>`).join("")}</div>
    <div class="dr-hcols"><div>${list.length ? `<section class="glass es-rql pad st" style="--i:4">${list.slice(0, 80).map((r) => drRow(r, { who: true })).join("")}</section>` : `<div class="glass empty st" style="--i:4"><div class="ic">${ico("drHist")}</div><b>Rien ici</b>Changez de filtre.</div>`}</div>
    ${tot.length ? `<section class="glass dr-totc st" style="--i:5"><span class="lbl">Compteurs ${y} · acceptés</span><table class="dr-tot"><thead><tr><th></th><th>Congés</th><th>Arrêts</th><th>Absences</th><th>Échanges</th></tr></thead><tbody>${tot.map((x) => `<tr><td>${drAva(x.id, 26)}<span>${esc(firstName(x.n))}</span></td><td class="mono">${x.T.conge ? x.T.conge + " j" : "–"}</td><td class="mono">${x.T.maladie ? x.T.maladie + " j" : "–"}</td><td class="mono">${x.T.absence || "–"}</td><td class="mono">${x.T.echange || "–"}</td></tr>`).join("")}</tbody></table><button class="btn ghost sm" data-act="drCsv">${ico("download")}Exporter en tableur (CSV)</button></section>` : ""}</div>`;
}
/* who is away over the next weeks: the planning seen from the requests */
function drCalView(all) {
  const t = drToday(); const days = []; for (let i = 0; i < 42; i++) days.push(addDays(t, i)); const max = +drCfg().maxOff;
  const rows = days.map((d) => ({ d, l: all.filter((r) => r.kind !== "echange" && ["ok", "attente"].includes(r.status) && drCovers(r, d)) })).filter((x) => x.l.length);
  return `<p class="sub st" style="--i:2">Les 6 prochaines semaines : congés, arrêts, absences et indisponibilités${max ? ` · limite de ${max} absent${max > 1 ? "s" : ""} en même temps` : ""}. En pointillé : demandé, pas encore accepté.</p>
    ${rows.length ? `<div class="dr-cal">${rows.map((x, i) => { const off = new Set(x.l.filter((r) => DR_LEAVE.includes(r.kind)).map((r) => r.memberId)).size; return `<section class="glass dr-cd st${max && off >= max ? " full" : ""}" style="--i:${3 + Math.min(i, 10)}"><div class="dr-cdd"><span>${esc(drD(x.d, true).split(" ")[0])}</span><b class="mono">${parseDay(x.d).getDate()}</b><em>${esc(ES_MS[parseDay(x.d).getMonth()])}</em></div><div class="dr-cdl">${x.l.map((r) => `<button class="dr-pm k-${esc(r.kind)}${r.status === "attente" ? " wait" : ""}" data-act="drOpen" data-id="${esc(r.id)}">${drAva(r.memberId, 22)}<span>${esc(firstName(r.name))} · ${esc(drShort(r))}</span></button>`).join("")}</div>${max && off >= max ? `<span class="pill warn">${off}/${max}</span>` : ""}</section>`; }).join("")}</div>`
      : `<div class="glass empty st" style="--i:3"><div class="ic">${ico("drCal")}</div><b>Toute l'équipe est là</b>Aucune absence prévue dans les 6 semaines.</div>`}
    ${VIEWS.planning ? `<button class="btn soft block st" style="--i:14" data-go="planning">${ico("cal")}Ouvrir le planning</button>` : ""}`;
}

/* ───────── Réglages ───────── */
function drC() { if (!DR.C) DR.C = JSON.parse(JSON.stringify(drCfg())); return DR.C; }
function drCfgSum(kk, k) {
  if (k.on === false) return "Désactivé : personne ne peut en faire la demande";
  const p = []; if (kk !== "maladie") p.push(+k.notice ? `${drNoticeTx(+k.notice)} à l'avance${k.strict ? ", strict" : ", souple"}` : "sans délai");
  if (k.info) p.push("simple information"); else { const st = (k.steps || []).map((s) => drWhoLabel(s.who).replace(/ \((gérant|chef)\)$/, "")); if (kk === "echange" && k.peer) st.unshift("le collègue"); p.push(st.length ? st.join(" puis ") : "accepté tout de suite"); }
  if (k.doc === "required") p.push(`justificatif sous ${drDocHTx(k.docH)}`); else if (k.doc === "optional") p.push("justificatif possible");
  return p.join(" · ");
}
function drCfgView() {
  const C = drC(); const M = (S.members || []).filter((m) => m.role !== "kiosk" && m.name).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const whoOpts = [["gerant", "Un gérant"], ["chef", "Un chef"], ...M.map((m) => ["m:" + m.id, `${m.name}${m.role === "gerant" ? " · gérant" : m.role === "chef" ? " · chef" : ""}`])];
  const cards = ES_REQ.map(([kk, ic, t], ci) => {
    const k = C.k[kk]; const open = DR.open === kk;
    const step = (s, i) => `<div class="dr-step"><span class="dr-sn mono">${i + 1}</span><span class="tx"><b>${esc(drWhoLabel(s.who))}</b><em>${s.who === "gerant" ? "N'importe quel gérant" : s.who === "chef" ? "N'importe quel chef" : "Cette personne seulement"}</em></span>
      ${i > 0 ? `<button class="iconbtn" data-act="drCStepUp" data-id="${kk}" data-v="${i}" aria-label="Monter">${ico("up")}</button>` : ""}<button class="iconbtn" data-act="drCStepDel" data-id="${kk}" data-v="${i}" aria-label="Retirer">${ico("trash")}</button></div>`;
    return `<section class="glass dr-cc st${open ? " open" : ""}${k.on === false ? " off" : ""}" style="--i:${3 + ci}">
      <div class="dr-cch"><button class="dr-cct" data-act="drCOpen" data-v="${kk}" aria-expanded="${open}"><span class="es-rqi k-${kk}">${ico(ic)}</span><span class="tx"><b>${esc(t)}</b><em>${esc(drCfgSum(kk, k))}</em></span>${ico("down")}</button>
        <button class="dr-swb" data-act="drCOn" data-id="${kk}" role="switch" aria-checked="${k.on !== false}" aria-label="${esc(t)} activé">${drSw(k.on !== false)}</button></div>
      ${open && k.on !== false ? `<div class="dr-ccb">
        ${kk !== "maladie" ? `<div class="dr-f"><span class="lbl">Délai minimum pour la demander</span><div class="dr-chips">${DR_NOTICE.map(([n, l]) => `<button class="chip${+k.notice === n ? " on" : ""}" data-act="drCSet" data-id="${kk}" data-v="notice|${n}">${l}</button>`).join("")}<label class="dr-num"><input class="input" type="number" min="0" max="365" inputmode="numeric" value="${+k.notice || 0}" data-drn="${kk}|notice" aria-label="Délai en jours"><span>jours</span></label></div>
          ${+k.notice ? `<div class="seg dr-seg">${[[1, "Bloquer si c'est trop tard"], [0, "Laisser passer, mais signaler"]].map(([v, l]) => `<button class="${!!k.strict === !!v ? "on" : ""}" data-act="drCSet" data-id="${kk}" data-v="strict|${v}">${l}</button>`).join("")}</div><p class="dr-fine">${k.strict ? `Impossible d'envoyer ${esc(drKind(kk)[3])} moins de ${esc(drNoticeTx(+k.notice))} avant : l'app propose la première date possible.` : `La demande part quand même, marquée « hors délai » pour celui qui valide.`}</p>` : ""}</div>` : ""}
        ${kk === "maladie" ? `<button class="dr-li" data-act="drCTog" data-id="${kk}" data-v="info" role="switch" aria-checked="${!!k.info}"><span class="tx"><b>Pris en compte sans validation</b><em>${k.info ? "Un arrêt ne se refuse pas : il est enregistré tout de suite, les personnes ci-dessous sont prévenues" : "L'arrêt suit le circuit de validation"}</em></span>${drSw(k.info)}</button>` : ""}
        ${kk === "echange" ? `<button class="dr-li" data-act="drCTog" data-id="${kk}" data-v="peer" role="switch" aria-checked="${!!k.peer}"><span class="tx"><b>Le collègue accepte d'abord</b><em>${k.peer ? "Il reçoit la proposition et dit oui ou non, puis le circuit valide" : "Le circuit décide directement"}</em></span>${drSw(k.peer)}</button>` : ""}
        <div class="dr-f"><span class="lbl">${k.info ? "Qui est prévenu" : "Qui valide, dans l'ordre"}</span>
          <div class="dr-steps">${(k.steps || []).map(step).join("") || `<p class="dr-empty">${k.info ? "Personne." : "Personne : la demande est acceptée dès l'envoi."}</p>`}</div>
          ${(k.steps || []).length < 4 ? `<label class="dr-add"><span>${ico("plus")}${k.info ? "Prévenir aussi" : "Ajouter une étape"}</span><select class="input" data-act-change="drCStepAdd" data-id="${kk}"><option value="">Choisir…</option>${whoOpts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label>` : ""}
          ${!k.info ? `<p class="dr-fine">Chaque étape reçoit une notification à son tour. Si une étape refuse, la demande s'arrête là.${C.boss !== false ? " Un gérant peut toujours valider directement." : ""}</p>` : ""}</div>
        ${!k.info ? `<div class="dr-f"><span class="lbl">Prévenir aussi (pour information)</span><div class="dr-chips">${M.map((m) => `<button class="chip${(k.cc || []).includes(m.id) ? " on" : ""}" data-act="drCCc" data-id="${kk}" data-v="${esc(m.id)}">${esc(firstName(m.name))}</button>`).join("")}</div></div>` : ""}
        ${kk !== "echange" ? `<div class="dr-f"><span class="lbl">Justificatif</span><div class="seg dr-seg">${[["none", "Aucun"], ["optional", "Possible"], ["required", "Obligatoire"]].map(([v, l]) => `<button class="${k.doc === v ? "on" : ""}" data-act="drCSet" data-id="${kk}" data-v="doc|${v}">${l}</button>`).join("")}</div>
          ${k.doc === "required" ? `<div class="dr-chips"><span class="dr-cl">À envoyer sous</span>${DR_DOCH.map(([h, l]) => `<button class="chip${+k.docH === h ? " on" : ""}" data-act="drCSet" data-id="${kk}" data-v="docH|${h}">${l}</button>`).join("")}</div><p class="dr-fine">Photo ou PDF, envoyé depuis le téléphone. Passé le délai, la demande est marquée « justificatif en retard ».</p>` : ""}</div>` : ""}
        ${["conge", "absence", "dispo"].includes(kk) ? `<div class="dr-f"><span class="lbl">Durée maximum d'affilée</span><div class="dr-chips">${DR_MAX.map(([n, l]) => `<button class="chip${+k.max === n ? " on" : ""}" data-act="drCSet" data-id="${kk}" data-v="max|${n}">${l}</button>`).join("")}</div></div>
          <button class="dr-li" data-act="drCTog" data-id="${kk}" data-v="half" role="switch" aria-checked="${!!k.half}"><span class="tx"><b>Midi ou soir seulement</b><em>${k.half ? "On peut choisir la journée, le midi ou le soir" : "Toujours la journée entière"}</em></span>${drSw(k.half)}</button>` : ""}
        ${kk === "dispo" ? `<button class="dr-li" data-act="drCTog" data-id="${kk}" data-v="rep" role="switch" aria-checked="${!!k.rep}"><span class="tx"><b>Chaque semaine</b><em>${k.rep ? "Une indispo peut se répéter (tous les lundis midi…)" : "Une date à la fois"}</em></span>${drSw(k.rep)}</button>` : ""}
      </div>` : ""}</section>`;
  }).join("");
  const blk = (C.blackout || []).map((b, i) => `<div class="dr-step"><span class="es-rqi k-dispo">${ico("lock")}</span><span class="tx"><b>${esc(b.t || "Période bloquée")}</b><em>du ${esc(drD(b.from))} au ${esc(drD(b.to || b.from))} · ${esc((b.kinds && b.kinds.length ? b.kinds.map((x) => drKind(x)[2].toLowerCase()) : ["tout"]).join(", "))} · ${b.strict ? "bloqué" : "signalé"}</em></span><button class="iconbtn" data-act="drCBlkDel" data-v="${i}" aria-label="Retirer">${ico("trash")}</button></div>`).join("");
  return `<p class="sub st" style="--i:2">Tout se règle ici, type par type : le délai, qui valide et dans quel ordre, les justificatifs. L'équipe voit les règles au moment de demander.</p>
    ${cards}
    <section class="glass dr-cc open st" style="--i:9"><div class="dr-ccb">
      <div class="dr-f"><span class="lbl">Périodes bloquées</span><div class="dr-steps">${blk || `<p class="dr-empty">Aucune. Par exemple : pas de congé en août, ni pendant les fêtes.</p>`}</div><button class="btn soft sm" data-act="drCBlkNew">${ico("plus")}Ajouter une période</button></div>
      <div class="dr-f"><span class="lbl">Absents en même temps, au plus</span><div class="dr-chips">${[0, 1, 2, 3, 4, 5].map((n) => `<button class="chip${+C.maxOff === n ? " on" : ""}" data-act="drCG" data-v="maxOff|${n}">${n ? n : "Sans limite"}</button>`).join("")}</div><p class="dr-fine">Au-delà, la demande est signalée à celui qui valide, et la personne est prévenue au moment de demander.</p></div>
      <button class="dr-li" data-act="drCG" data-v="boss|${C.boss === false ? 1 : 0}" role="switch" aria-checked="${C.boss !== false}"><span class="tx"><b>Un gérant peut toujours trancher</b><em>${C.boss !== false ? "Il valide ou refuse à n'importe quelle étape" : "Chaque étape répond à son tour, sans raccourci"}</em></span>${drSw(C.boss !== false)}</button>
    </div></section>
    ${DR.cfgDirty ? `<div class="dr-save"><button class="btn acc block" data-act="drCSave">${ico("check")}Enregistrer les réglages</button><button class="btn ghost sm" data-act="drCReset">Annuler les changements</button></div>` : ""}`;
}
function drBlkSheet() {
  const B = DR.B; openSheet(`<div class="es-sh dr-sh"><div class="es-shh"><span class="h2">Période bloquée</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <label class="field"><span class="lbl">Nom</span><input class="input" id="drBt" maxlength="40" value="${esc(B.t)}" placeholder="Fêtes de fin d'année"></label>
    <div class="grid2"><label class="field"><span class="lbl">Du</span><input class="input" type="date" id="drBf" value="${esc(B.from)}"></label><label class="field"><span class="lbl">Au</span><input class="input" type="date" id="drBto" value="${esc(B.to)}"></label></div>
    <span class="lbl">Pour</span><div class="dr-chips">${ES_REQ.filter(([k]) => k !== "maladie").map(([k, , t]) => `<button class="chip${B.kinds.includes(k) ? " on" : ""}" data-act="drBK" data-v="${k}">${esc(t)}</button>`).join("")}</div>
    <div class="seg dr-seg">${[[1, "Bloquer"], [0, "Signaler seulement"]].map(([v, l]) => `<button class="${!!B.strict === !!v ? "on" : ""}" data-act="drBS" data-v="${v}">${l}</button>`).join("")}</div>
    <button class="btn acc block" data-act="drBAdd">${ico("check")}Ajouter</button></div>`);
}
const drBRead = () => { const B = DR.B; if (!B) return; const g = (i) => { const el = $("#" + i); return el ? el.value : null; }; B.t = g("drBt") ?? B.t; B.from = g("drBf") ?? B.from; B.to = g("drBto") ?? B.to; };

/* manager enters a request for someone (a phone call at 7 am: « je suis malade ») */
function drForWhoSheet() {
  const ppl = (typeof rhPeople === "function" ? rhPeople() : []).filter((p) => p.memberId);
  openSheet(`<div class="es-sh dr-sh"><div class="es-shh"><span class="h2">Saisir pour quelqu'un</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
    <p class="sub">Un appel le matin, un arrêt reçu par message : enregistrez-le à sa place. La personne est prévenue.</p>
    <div class="dr-ppl big">${ppl.map((p) => `<button class="dr-pc" data-act="drForPick" data-v="${esc(p.memberId)}">${rhAva(p, 40)}<span>${esc(rhFirst(p))}</span></button>`).join("") || `<p class="dr-empty">Pas encore d'équipe.</p>`}</div></div>`);
}

/* ───────── CSV ───────── */
function drCsv() {
  const q = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`; const st = { attente: "En attente", ok: "Acceptée", refus: "Refusée", annule: "Annulée" };
  const rows = [["Personne", "Type", "Du", "Au", "Créneau", "Jours", "Statut", "Hors délai", "Motif", "Note", "Justificatifs", "Demandée le", "Réponse de", "Commentaire"]];
  ES_REQS().slice().sort((a, b) => (a.from || "").localeCompare(b.from || "")).forEach((r) => rows.push([r.name, drKind(r.kind)[2], r.from, drEnd(r), r.slot || "jour", drIsLeave(r) ? drDays(r) : "", st[r.status] || r.status, r.late ? "oui" : "", r.reason, r.note, (r.docs || []).length, new Date(r.at || 0).toLocaleDateString("fr-FR"), r.answeredByName || "", r.answer || ""]));
  const blob = new Blob(["﻿" + rows.map((l) => l.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `demandes-${(S.resto && S.resto.name || "equipe").replace(/[^\w-]+/g, "-").toLowerCase()}-${drToday()}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  SFX.ok(); toast("Tableau téléchargé");
}

/* ═══════════════════════════ actions ═══════════════════════════ */
document.addEventListener("change", (e) => {
  const el = e.target.closest && e.target.closest("[data-act-change]"); if (!el) return;
  const H = ACT[el.dataset.actChange]; if (H) { try { H(el, el.dataset.id, el.value, e); } catch (x) { console.warn(x); } }
});
Object.assign(ACT, {
  esReqNew: (a, id, v) => { if (!drKinds().length) { toast("Les demandes sont désactivées par le gérant.", "err"); return; } DR.F = drNewF(v, id && /^\d{4}-\d\d-\d\d$/.test(id) ? id : ""); SFX.tap(); drSheet(); },
  drKindF: (a, id, v) => { const F = DR.F; if (!F) return; drRead(); const n = drNewF(v, F.kind === "echange" ? "" : F.from, F.forMid); Object.assign(n, { note: F.note, docs: F.docs, okNow: F.okNow }); if (v !== "echange" && F.kind !== "echange" && F.to >= n.from) n.to = F.to; DR.F = n; SFX.tick(); drSheet(); },
  drSlotF: (a, id, v) => { drRead(); DR.F.slot = v; if (v !== "jour" && !DR.F.rep && DR.F.kind === "absence") DR.F.to = DR.F.from; SFX.tick(); drSheet(); },
  drRepF: () => { drRead(); DR.F.rep = !DR.F.rep; if (DR.F.rep) { DR.F.to = DR.F.from; if (!DR.F.until || DR.F.until <= DR.F.from) DR.F.until = addDays(DR.F.from, 56); } SFX.tick(); drSheet(); },
  drReasonF: (a, id, v) => { drRead(); DR.F.reason = DR.F.reason === v ? "" : v; SFX.tick(); drSheet(); },
  drShiftF: (a, id, v) => { drRead(); DR.F.shift = v; DR.F.shift2 = ""; SFX.tick(); drSheet(); },
  drPeerF: (a, id, v) => { drRead(); DR.F.peer = DR.F.peer === v ? "" : v; DR.F.shift2 = ""; SFX.tick(); drSheet(); },
  drShift2F: (a, id, v) => { drRead(); DR.F.shift2 = v || ""; SFX.tick(); drSheet(); },
  drLaterF: () => { drRead(); DR.F.later = !DR.F.later; SFX.tick(); drSheet(); },
  drOkNowF: () => { drRead(); DR.F.okNow = !DR.F.okNow; SFX.tick(); drSheet(); },
  drDocAddF: (a, id, v) => { drRead(); drPickFile(async (f) => { try { const d = await drReadFile(f); DR.F.docs = [...(DR.F.docs || []), d]; DR.F.later = false; SFX.ok(); drSheet(); } catch (e) { SFX.err(); toast(e && e.message === "big" ? "PDF trop lourd (700 Ko au plus) : prenez-le plutôt en photo." : "Fichier illisible, réessayez avec une photo.", "err"); } }, v === "cam"); },
  drDocDropF: (a, id, v) => { drRead(); DR.F.docs.splice(+v, 1); SFX.close(); drSheet(); },
  drSend: (a) => drSend(a),
  drForWho: () => { SFX.tap(); drForWhoSheet(); },
  drForPick: (a, id, v) => { DR.F = drNewF("maladie", drToday(), v); SFX.tap(); drSheet(); },
  drOpen: (a, id) => { SFX.tap(); drDetail(id); },
  drDecide: (a, id, v) => { const r = ES_REQS().find((x) => x.id === id); if (!r || !drCanAct(r)) { toast("Cette demande a déjà une réponse.", "info"); return; } SFX.tap(); DR.dec = null; drDecideSheet(r, v); },
  drDecFree: () => { if (!DR.dec) return; DR.dec.free = !DR.dec.free; const r = ES_REQS().find((x) => x.id === DR.dec.id); SFX.tick(); if (r) drDecideSheet(r, DR.dec.v); },
  drDecGo: async (a) => {
    const D = DR.dec; if (!D || DR.busy) return; const r = ES_REQS().find((x) => x.id === D.id); if (!r || !drCanAct(r)) { closeSheet(); return; }
    const c = ($("#drDecC") || {}).value || ""; if (D.v !== "ok" && !c.trim() && drStage(r).t !== "peer") { SFX.err(); toast("Dites en un mot pourquoi : la personne le lira.", "err"); const t = $("#drDecC"); if (t) t.focus(); return; }
    DR.busy = true; a.disabled = true;
    try { const res = await drApply(r, D.v === "ok", c.trim().slice(0, 200), { free: D.free }); closeSheet(); D.v === "ok" ? (SFX.ok(), buzz(10)) : SFX.close(); toast(D.v === "ok" ? (res && res.final ? `Accepté pour ${firstName(r.name)}` : `Accepté : la demande passe à ${(drStage(res.nx) || {}).label || "la suite"}`) : `Refusé pour ${firstName(r.name)}`); }
    catch (e) { console.warn(e); a.disabled = false; } finally { DR.busy = false; DR.dec = null; }
  },
  drCancel: async (a, id) => {
    const r = ES_REQS().find((x) => x.id === id); if (!r) return; if (a.dataset.sure !== "1") { a.dataset.sure = "1"; a.classList.add("sure"); a.textContent = "Toucher encore pour confirmer"; SFX.tick(); setTimeout(() => { if (a.isConnected) { a.dataset.sure = ""; a.classList.remove("sure"); a.textContent = r.status === "ok" ? "Annuler cette absence" : "Annuler la demande"; } }, 3500); return; }
    const now = Date.now(); await safe(DB.update("esRequests", id, { status: "annule", cancelledAt: now, cancelledBy: S.me.id, hist: [...(r.hist || []), { at: now, by: S.me.id, n: S.me.name || "", a: "annule" }] }));
    if ((r.freed || []).length && esIsMgr()) await drRestore({ ...r, hist: [...(r.hist || []), { at: now, by: S.me.id, n: S.me.name || "", a: "annule" }] });
    const g = drStage(r); drNotify(r.memberId === S.me.id ? [...(g ? g.ids : []), ...(r.status === "ok" ? [...drWhoIds("gerant"), ...(r.steps || []).flatMap((s) => drWhoIds(s.who))] : []), ...(r.peer ? [r.peer.id] : [])] : [r.memberId], `Annulée : ${drWhoTx(r)}`, `${S.me.name || ""}${(r.freed || []).length ? " · services remis au planning" : ""}`);
    closeSheet(); SFX.close(); toast("Demande annulée"); logEvent("request", `a annulé ${r.memberId === S.me.id ? "sa demande" : `la demande de ${firstName(r.name)}`} (${drKind(r.kind)[2].toLowerCase()} ${drDates(r)})`);
  },
  drFree: async (a, id) => { const r = ES_REQS().find((x) => x.id === id); if (!r || !esIsMgr()) return; a.disabled = true; await drFree(r); SFX.ok(); closeSheet(); },
  drRestore: async (a, id) => { const r = ES_REQS().find((x) => x.id === id); if (!r || !esIsMgr()) return; a.disabled = true; await drRestore(r); SFX.ok(); closeSheet(); },
  drDocAdd: (a, id, v) => {
    const r = ES_REQS().find((x) => x.id === id); if (!r) return;
    drPickFile(async (f) => {
      try { toast("Envoi du justificatif…", "info"); const d = await drReadFile(f); const meta = await drDocSave(r, d); const cur = ES_REQS().find((x) => x.id === id) || r;
        await safe(DB.update("esRequests", id, { docs: [...(cur.docs || []), meta], docDue: null, hist: [...(cur.hist || []), { at: Date.now(), by: S.me.id, n: S.me.name || "", a: "doc", t: d.name }] }));
        drNotify([...drReaders(r), r.memberId], `Justificatif reçu : ${drWhoTx(r)}`, d.name); SFX.ok(); toast("Justificatif envoyé"); setTimeout(() => drDetail(id), 60);
      } catch (e) { SFX.err(); toast(e && e.message === "big" ? "PDF trop lourd (700 Ko au plus) : prenez-le plutôt en photo." : "Le justificatif n'est pas parti, réessayez.", "err"); }
    }, v === "cam");
  },
  drDocDel: async (a, id, v) => {
    const r = ES_REQS().find((x) => x.id === id); if (!r) return; if (a.dataset.sure !== "1") { a.dataset.sure = "1"; a.classList.add("sure"); SFX.tick(); toast("Touchez encore la corbeille pour retirer ce fichier", "info"); return; }
    await DB.del("rhDocs", v).catch(() => {}); delete DR.cache[v];
    const docs = (r.docs || []).filter((d) => d.id !== v); await safe(DB.update("esRequests", id, { docs, hist: [...(r.hist || []), { at: Date.now(), by: S.me.id, n: S.me.name || "", a: "undoc" }], ...(r.docNeed === "required" && !docs.length ? { docDue: Date.now() + (+drK(r.kind).docH || 48) * 36e5 } : {}) }));
    SFX.close(); setTimeout(() => drDetail(id), 60);
  },
  drDocView: async (a, id, v) => {
    a.disabled = true; const d = await drDocGet(v); a.disabled = false;
    if (!d || !d.data) { SFX.err(); toast("Ce fichier n'est pas accessible.", "err"); return; }
    const pdf = d.type === "application/pdf"; let url = d.data;
    if (pdf) { try { const b = await (await fetch(d.data)).blob(); url = URL.createObjectURL(b); } catch (e) {} }
    openSheet(`<div class="es-sh dr-sh dr-view"><div class="es-shh"><span class="h2">${esc(d.name || "Justificatif")}</span><button class="iconbtn" data-act="drOpen" data-id="${esc(id)}" aria-label="Retour">${ico("back")}</button></div>
      ${pdf ? `<iframe class="dr-pdf" src="${esc(url)}" title="${esc(d.name || "PDF")}"></iframe>` : `<img class="dr-img" src="${d.data}" alt="${esc(d.name || "Justificatif")}">`}
      <a class="btn soft block" href="${esc(url)}" download="${esc(d.name || "justificatif")}" target="_blank" rel="noopener">${ico("download")}Télécharger</a></div>`);
  },
  drTab: (a, id, v) => { if (DR.tab === "cfg" && v !== "cfg" && DR.cfgDirty) { DR.C = null; DR.cfgDirty = false; } DR.tab = v; SFX.tick(); rerender(); },
  drHk: (a, id, v) => { DR.hk = v; SFX.tick(); rerender(); },
  drHp: (a, id, v) => { DR.hp = v; SFX.tick(); rerender(); },
  drCsv: () => drCsv(),
  /* Réglages */
  drCOpen: (a, id, v) => { DR.open = DR.open === v ? null : v; SFX.tick(); rerender(); },
  drCOn: (a, id) => { const k = drC().k[id]; k.on = k.on === false; DR.cfgDirty = true; SFX.tick(); buzz(5); rerender(); },
  drCSet: (a, id, v) => { const [f, x] = String(v).split("|"); const k = drC().k[id]; k[f] = f === "doc" ? x : f === "strict" ? x === "1" : +x; DR.cfgDirty = true; SFX.tick(); rerender(); },
  drCTog: (a, id, v) => { const k = drC().k[id]; k[v] = !k[v]; DR.cfgDirty = true; SFX.tick(); rerender(); },
  drCCc: (a, id, v) => { const k = drC().k[id]; const l = new Set(k.cc || []); l.has(v) ? l.delete(v) : l.add(v); k.cc = [...l]; DR.cfgDirty = true; SFX.tick(); rerender(); },
  drCStepAdd: (el, id, v) => { if (!v) return; const k = drC().k[id]; k.steps = [...(k.steps || []), { who: v }].slice(0, 4); DR.cfgDirty = true; SFX.tick(); rerender(); },
  drCStepDel: (a, id, v) => { const k = drC().k[id]; k.steps = (k.steps || []).filter((s, i) => i !== +v); DR.cfgDirty = true; SFX.close(); rerender(); },
  drCStepUp: (a, id, v) => { const k = drC().k[id]; const l = (k.steps || []).slice(); const i = +v; if (i > 0) { [l[i - 1], l[i]] = [l[i], l[i - 1]]; k.steps = l; DR.cfgDirty = true; } SFX.tick(); rerender(); },
  drCG: (a, id, v) => { const [f, x] = String(v).split("|"); drC()[f] = f === "boss" ? x === "1" : +x; DR.cfgDirty = true; SFX.tick(); rerender(); },
  drCBlkNew: () => { const y = drToday().slice(0, 4); DR.B = { t: "", from: `${y}-08-01`, to: `${y}-08-31`, kinds: ["conge"], strict: true }; SFX.tap(); drBlkSheet(); },
  drBK: (a, id, v) => { drBRead(); const l = new Set(DR.B.kinds); l.has(v) ? l.delete(v) : l.add(v); DR.B.kinds = [...l]; SFX.tick(); drBlkSheet(); },
  drBS: (a, id, v) => { drBRead(); DR.B.strict = v === "1"; SFX.tick(); drBlkSheet(); },
  drBAdd: () => { drBRead(); const B = DR.B; if (!B.from) { toast("Choisissez les dates.", "err"); return; } if (B.to && B.to < B.from) [B.from, B.to] = [B.to, B.from]; const C = drC(); C.blackout = [...(C.blackout || []), { t: B.t.trim().slice(0, 40), from: B.from, to: B.to || B.from, kinds: B.kinds, strict: !!B.strict }]; DR.cfgDirty = true; DR.B = null; closeSheet(); SFX.ok(); rerender(); },
  drCBlkDel: (a, id, v) => { const C = drC(); C.blackout = (C.blackout || []).filter((b, i) => i !== +v); DR.cfgDirty = true; SFX.close(); rerender(); },
  drCReset: () => { DR.C = null; DR.cfgDirty = false; SFX.close(); rerender(); },
  drCSave: async (a) => {
    if (!drIsBoss()) { toast("Seul un gérant change ces réglages.", "err"); return; }
    const C = drC(); const k = {}; ES_REQ.forEach(([id]) => { const x = C.k[id]; k[id] = { on: x.on !== false, notice: Math.max(0, Math.min(365, +x.notice || 0)), strict: !!x.strict, steps: (x.steps || []).map((s) => ({ who: s.who })).slice(0, 4), cc: (x.cc || []).slice(0, 20), doc: x.doc || "none", docH: +x.docH || 48, max: +x.max || 0, half: !!x.half, rep: !!x.rep, peer: !!x.peer, info: !!x.info }; });
    const doc = { k, blackout: (C.blackout || []).slice(0, 20), maxOff: +C.maxOff || 0, boss: C.boss !== false, at: Date.now(), by: S.me.id };
    a.disabled = true; await safe(DB.update("restos", S.rid, { drCfg: doc })); if (S.resto) S.resto.drCfg = doc;
    DR.C = null; DR.cfgDirty = false; SFX.done ? SFX.done() : SFX.ok(); toast("Réglages enregistrés : ils s'appliquent aux nouvelles demandes"); logEvent("settings", "a changé les règles des demandes RH"); rerender();
  },
});

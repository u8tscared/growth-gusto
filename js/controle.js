/* Growth Gusto — area: controle (prefix « ct »)
   1. « Contrôle sanitaire » (route controle, ctVue, ctDossier): one calm screen to hand to the DDPP inspector, a period, eight tiles
      (températures, traçabilité, réceptions, nettoyage, obligations, formation, allergènes, PMS) that open read-only views of the data
      the other areas already keep in S, and « Exporter le dossier complet »: one A4 document (cover, sommaire, every section, photos)
      printed with window.print (« Enregistrer en PDF »). « Mode inspecteur » locks the app on these screens until a code or a long press.
   2. PMS generator (route pms): ~15 questions prefilled from the restaurant's data, then a full Plan de Maîtrise Sanitaire in French
      (Paquet Hygiène, GBPH restaurateur), editable section by section, saved in restos/{rid}/docs/pms, printable.
   3. Rappel de lot (route rappel): a supplier lot number or a product name → receptions, lots, recipes and services that used it,
      what to throw away, « Bloquer ces produits » (lots marked lost, reason « Rappel fournisseur ») and a printable fiche de retrait.
   Collections written: docs (doc "pms"), trainings, recalls, lots (status lost), events.
   Globals: ctInspOn() → bool, ctPmsDoc() → the PMS doc or null, ctRecallFind(q) → recall result (used by the views). */
"use strict";

TAB_OF.controle = "more"; TAB_OF.ctVue = "more"; TAB_OF.ctDossier = "more"; TAB_OF.pms = "more"; TAB_OF.rappel = "more";
Object.assign(IC, {
  ctBadge: ["f:M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z", "r:4.5,3.5,15,17.5,2", "M9 3.5V2.75h6v.75", "m8.75 12.5 2.25 2.25 4.25-4.5", "M8.5 18h7"],
  ctRecall: ["f:M12 3.5 21 19H3z", "M10.3 4.5a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3z", "M12 9.5v4.25", "M12 16.75h.01"],
  ctGrad: ["f:M12 4 2.5 9 12 14l9.5-5z", "M12 4 2.5 9 12 14l9.5-5z", "M6 11v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3V11", "M21.5 9v5"],
  ctWheat: ["M12 21V9", "f:M12 9c-2.5-.3-4-2-4-4.5C10.5 4.8 12 6.5 12 9z", "M12 9c-2.5-.3-4-2-4-4.5C10.5 4.8 12 6.5 12 9z", "M12 9c2.5-.3 4-2 4-4.5-2.5.3-4 2-4 4.5z", "M12 13.5c-2.5-.3-4-2-4-4.5 2.5.3 4 2 4 4.5z", "M12 13.5c2.5-.3 4-2 4-4.5-2.5.3-4 2-4 4.5z", "M12 18c-2.5-.3-4-2-4-4.5 2.5.3 4 2 4 4.5z", "M12 18c2.5-.3 4-2 4-4.5-2.5.3-4 2-4 4.5z"],
  ctDoc: ["f:M6 2.75h8.5L19 7.25V20a1.25 1.25 0 0 1-1.25 1.25H6A1.25 1.25 0 0 1 4.75 20V4A1.25 1.25 0 0 1 6 2.75z", "M14.5 2.75H6A1.25 1.25 0 0 0 4.75 4v16A1.25 1.25 0 0 0 6 21.25h11.75A1.25 1.25 0 0 0 19 20V7.25z", "M14.5 2.75v4.5H19", "M8.5 12h7", "M8.5 15.5h7", "M8.5 8.5h3"],
  ctBlock: ["c:12,12,8.75", "f:M12 3.25a8.75 8.75 0 1 1 0 17.5 8.75 8.75 0 0 1 0-17.5z", "m5.8 5.8 12.4 12.4"],
});

/* ───────────────────────── small helpers ───────────────────────── */
const CT = { insp: false, pin: "", watched: null, seeded: {}, holdT: 0 };
S.ctDocs = S.ctDocs || {}; S.trainings = S.trainings || []; S.recalls = S.recalls || [];
const ctNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const ctLotKey = (s) => String(s || "").toUpperCase().replace(/[\s\-_.\/]/g, "");
const ctFull = (k) => { const d = parseDay(k); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "–"; };
const ctDayOf = (ts) => dayKey(new Date(ts));
const ctLong = (k) => { const d = parseDay(k); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "–"; };
const ctPl = (n, s, p) => `${n} ${n > 1 ? p || s + "s" : s}`;
const ctPic = (id, url) => (typeof photoUrl === "function" ? (id && photoUrl(id)) || photoUrl(url) : url || "");
const ctSlot = (s) => (s === "soir" ? "soir" : "midi");
const ctRange = (f) => (f && f.min != null && f.max != null ? `${fmt(f.min, 0)} à ${fmt(f.max, 0)} °C` : "");
const ctQty = (q, u) => (q == null || q === "" ? "" : typeof regQty === "function" ? regQty(q, u) : `${String(q).replace(".", ",")} ${u || ""}`.trim());
const ctIsRecipe = (n) => (typeof noteKind === "function" ? noteKind(n) === "Recettes" : n.cat === "Recettes") && !n.archived;
const ctAdmin = () => { try { return typeof PERMS === "undefined" || PERMS.isAdmin(); } catch (e) { return true; } };
const ctCan = (k) => { try { return typeof PERMS === "undefined" || PERMS.can(k); } catch (e) { return true; } };
const ctWell = (ic, tone = "vi") => `<span class="ct-well w-${tone}">${ico(ic)}</span>`;
const ctHash = (s) => { let h = 5381; for (const c of String(s)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return "h" + h.toString(36); };
function ctInspOn() { return !!CT.insp; }

/* own subscriptions (once per restaurant): the PMS doc, staff trainings, recalls */
function ctWatch() {
  if (!S.rid || CT.watched === S.rid) return; CT.watched = S.rid;
  S.ctDocs = {}; S.trainings = []; S.recalls = [];
  const live = () => { if (["controle", "ctVue", "ctDossier", "pms", "rappel"].includes(S.route)) refresh(); };
  DB.watch("docs", {}, (rows) => { S.ctDocs = Object.fromEntries(rows.map((r) => [r.id, r])); live(); });
  DB.watch("trainings", {}, (rows) => { S.trainings = rows.sort((a, b) => String(b.day || "").localeCompare(String(a.day || ""))); live(); });
  DB.watch("recalls", { order: "at", dir: "desc", limit: 200 }, (rows) => { S.recalls = rows; live(); });
  if (DB.mode === "demo") setTimeout(ctSeedDemo, 30);
}
const ctPmsDoc = () => (S.ctDocs && S.ctDocs.pms && Array.isArray(S.ctDocs.pms.sections) ? S.ctDocs.pms : null);

/* demo: believable trainings and a PMS already written from the restaurant's own data */
function ctSeedDemo() {
  if (DB.mode !== "demo" || CT.seeded[S.rid]) return; CT.seeded[S.rid] = true;
  const has = (col) => Object.keys(DB.local[DB.path(col)] || {}).length > 0;
  const t = dayKey(), y = (n) => addDays(t, -n);
  if (!has("trainings")) {
    const staff = (S.staff || []); const sid = (mid) => (staff.find((s) => s.memberId === mid) || {}).id || "";
    [["demo-camille", "Camille Laurent", "haccp", y(980), "CCI Charente-Maritime", 14],
     ["demo-thomas", "Thomas Girard", "haccp", y(1460), "AFPA La Rochelle", 14],
     ["demo-thomas", "Thomas Girard", "allergenes", y(220), "Formation interne", 3],
     ["demo-ines", "Inès Benali", "haccp", y(610), "CCI Charente-Maritime", 14],
     ["demo-lucas", "Lucas Petit", "interne", y(150), "Thomas Girard", 2],
     ["demo-sarah", "Sarah Lemoine", "allergenes", y(220), "Formation interne", 3],
     ["demo-hugo", "Hugo Martin", "interne", y(40), "Thomas Girard", 1]]
      .forEach(([mid, name, kind, day, provider, hours], i) => DB.add("trainings", { staffId: sid(mid), memberId: mid, name, kind, day, provider, hours, at: Date.now() - i, by: "Camille Laurent" }).catch(() => {}));
  }
  /* the demo keeps two weeks of cleaning logs: complete the month so a 30-day dossier reads like a real kitchen */
  const logs = Object.values(DB.local[DB.path("choreLogs")] || {});
  if (S.chores.length && logs.length && !logs.some((g) => g.day && g.day < y(15))) {
    let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const team = (S.members || []).filter((m) => m.role !== "gerant"); const at = (k, h) => { const d = parseDay(k); d.setHours(h, Math.floor(rnd() * 50)); return d.getTime(); };
    for (let i = 15; i <= 31; i++) { const day = y(i); const wd = parseDay(day).getDay(); S.chores.forEach((c) => {
      if (c.freq === "semaine" && c.wday != null && c.wday !== wd) return; if (c.freq === "mois") return; if (rnd() < 0.06) return;
      (c.freq === "service" ? [15, 23] : [c.moment === "matin" ? 10 : 22]).forEach((h) => { const m = team[Math.floor(rnd() * team.length)] || {}; DB.add("choreLogs", { choreId: c.id, at: at(day, h), day, uid: m.id || "", by: m.name || "" }).catch(() => {}); });
    }); }
  }
  if (!has("docs")) {
    const A = ctPmsDefaults(); const now = Date.now();
    DB.set("docs", "pms", { kind: "pms", answers: A, sections: ctPmsBuild(A), version: 1, generatedAt: now - 9 * 864e5, generatedBy: "Camille Laurent", updatedAt: now - 9 * 864e5, updatedBy: "Camille Laurent" }).catch(() => {});
  }
}

/* ───────────────────────── period ───────────────────────── */
const CT_PER = [["7", "7 j"], ["30", "30 j"], ["90", "3 mois"], ["custom", "Dates"]];
function ctPeriod() {
  const t = dayKey(); const P = (S.ui.ctP ||= { mode: "30" });
  const n = { 7: 7, 30: 30, 90: 90 }[P.mode]; if (n) return { mode: P.mode, from: addDays(t, -(n - 1)), to: t };
  let from = P.from || addDays(t, -29), to = P.to || t; if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -366)) from = addDays(to, -366);
  return { mode: "custom", from, to };
}
const ctIn = (ts, P) => { if (!ts) return false; const k = ctDayOf(ts); return k >= P.from && k <= P.to; };
const ctDays = (P) => { const out = []; for (let k = P.from, g = 0; k <= P.to && g < 400; k = addDays(k, 1), g++) out.push(k); return out; };
const ctPerTx = (P) => `du ${ctFull(P.from)} au ${ctFull(P.to)}`;
function ctStartDay() {
  if (typeof regStartDay === "function") { try { return regStartDay(); } catch (e) {} }
  const ts = [S.resto?.createdAt, ...S.readings.map((r) => r.at), ...S.receptions.map((r) => r.at)].filter(Boolean);
  return ts.length ? ctDayOf(Math.min(...ts)) : dayKey();
}

/* ───────────────────────── data, per section ───────────────────────── */
function ctTempData(P) {
  const start = ctStartDay(); const eff = { from: P.from < start ? start : P.from, to: P.to };
  const days = eff.from <= eff.to ? ctDays(eff) : []; const today = dayKey();
  const due = (d, slot) => d < today || (d === today && (slot === "midi" || slotNow() === "soir"));
  const fr = S.fridges.slice();
  const rd = S.readings.filter((r) => r.day >= P.from && r.day <= P.to);
  const exp = days.reduce((n, d) => n + fr.length * ["midi", "soir"].filter((s) => due(d, s)).length, 0);
  const done = new Set(rd.filter((r) => fr.some((f) => f.id === r.fridgeId) && days.includes(r.day) && due(r.day, ctSlot(r.slot))).map((r) => r.day + r.fridgeId + ctSlot(r.slot))).size;
  const bad = rd.filter((r) => !r.ok).sort((a, b) => b.at - a.at);
  const per = fr.map((f) => { const R = rd.filter((r) => r.fridgeId === f.id); const v = R.map((r) => num(r.value)).filter((x) => x != null);
    return { f, n: R.length, bad: R.filter((r) => !r.ok).length, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, last: R.slice().sort((a, b) => b.at - a.at)[0] || null }; });
  const pics = rd.map((r) => ({ at: r.at, url: ctPic(r.photoId, r.photoUrl), t: `${(fr.find((f) => f.id === r.fridgeId) || {}).name || r.fname || "Enceinte"} · ${fmt(num(r.value))} °C`, nc: !r.ok, uid: r.uid })).filter((x) => x.url).sort((a, b) => b.at - a.at);
  return { days, allDays: ctDays(P), due, fr, rd, exp, done, bad, per, pics, conf: rd.length ? Math.round((rd.filter((r) => r.ok).length / rd.length) * 1000) / 10 : null, rate: exp ? Math.round((Math.min(done, exp) / exp) * 100) : null };
}
const ctLineRes = (L) => !L.refused && (!!L.reserve || L.ok === false);
const ctLineTx = (L) => (L.refused ? "Refusé" : ctLineRes(L) ? "Réserve" : "Conforme");
const ctLineSt = (L) => (L.refused ? "bad" : ctLineRes(L) ? "warn" : "ok");
const ctLineWhy = (L) => (L.refused || ctLineRes(L) ? String(L.reason || (typeof L.reserve === "string" ? L.reserve : "") || "").trim() : "");
function ctRecData(P) {
  const recs = S.receptions.filter((rc) => ctIn(rc.at, P)).sort((a, b) => b.at - a.at);
  const lines = recs.flatMap((rc) => (rc.lines || []).map((L) => ({ rc, L })));
  const pics = lines.map(({ rc, L }) => ({ at: rc.at, url: ctPic(L.photoId, L.photoUrl), t: `${rc.supplier || "Réception"} · ${L.name}`, nc: !!L.refused, uid: rc.uid })).filter((x) => x.url);
  return { recs, lines, pics, refused: lines.filter((x) => x.L.refused).length, reserves: lines.filter((x) => ctLineRes(x.L)).length, hot: lines.filter((x) => x.L.temp != null && x.L.tmax != null && x.L.temp > x.L.tmax).length };
}
function ctTraceData(P) {
  const live = S.lots.filter((l) => !l.test && (l.status === "in" || l.status === "opened"));
  const over = live.filter((l) => (daysUntil(dlcOf(l)) ?? 99) < 0);
  const opened = S.lots.filter((l) => !l.test && ctIn(l.openedAt, P)).sort((a, b) => b.openedAt - a.openedAt);
  const lost = S.lots.filter((l) => !l.test && l.status === "lost" && ctIn(l.outAt, P)).sort((a, b) => b.outAt - a.outAt);
  const made = S.lots.filter((l) => !l.test && ctIn(l.createdAt, P));
  const noLot = live.filter((l) => !String(l.lot || "").trim());
  return { live, over, opened, lost, made, noLot };
}
function ctCleanData(P) {
  const logs = S.choreLogs.filter((g) => (g.day ? g.day >= P.from && g.day <= P.to : ctIn(g.at, P)));
  if (typeof regChoreStats === "function") {
    try { const start = ctStartDay(); const r = regChoreStats(P, logs, { from: P.from < start ? start : P.from, to: P.to }); return { chores: r.chores, rate: r.cExp ? Math.round((r.cDone / r.cExp) * 100) : null, exp: r.cExp, done: r.cDone, logs }; } catch (e) {}
  }
  const chores = S.chores.map((c) => { const L = logs.filter((g) => g.choreId === c.id); return { c, freqTx: c.freq || "", expN: 0, doneN: L.length, rate: null, last: L.reduce((m, g) => Math.max(m, g.at || 0), 0), who: "" }; });
  return { chores, rate: null, exp: 0, done: logs.length, logs };
}
function ctOblData() {
  if (typeof oblReportRows === "function") { try { return oblReportRows(); } catch (e) {} }
  return (S.obligations || []).filter((o) => !o.archived).map((o) => ({ o, name: o.name, catT: "", freqTx: o.everyMonths ? `Tous les ${o.everyMonths} mois` : "", lastDone: o.lastDone, provider: o.provider || "", nextDue: o.nextDue, st: !o.nextDue ? "unk" : daysUntil(o.nextDue) < 0 ? "late" : daysUntil(o.nextDue) <= 30 ? "soon" : "ok", files: 0 }));
}
const CT_TRS = { haccp: "HACCP 14 h", allergenes: "Allergènes", interne: "Formation interne", secours: "Secourisme", permis: "Permis d'exploitation", autre: "Formation" };
const CT_TRAIN = { haccp: "Hygiène alimentaire HACCP (14 h)", allergenes: "Allergènes", interne: "Formation interne aux bonnes pratiques", secours: "Sauveteur secouriste du travail", permis: "Permis d'exploitation", autre: "Autre formation" };
function ctPeople() {
  const st = (S.staff || []).filter((s) => s.active !== false && !s.end);
  const base = st.length ? st.map((s) => ({ id: s.id, memberId: s.memberId || "", name: s.name, role: s.role || "" })) : (S.members || []).map((m) => ({ id: "", memberId: m.id, name: m.name || "Membre", role: ROLES[m.role] || "" }));
  return base.map((p) => ({ ...p, tr: S.trainings.filter((t) => (p.id && t.staffId === p.id) || (p.memberId && t.memberId === p.memberId) || (!t.staffId && !t.memberId && ctNorm(t.name) === ctNorm(p.name))) }));
}
function ctFormData() {
  const people = ctPeople(); const A = (ctPmsDoc() || {}).answers || {};
  const haccp = people.filter((p) => p.tr.some((t) => t.kind === "haccp"));
  const resp = A.respName ? { name: A.respName, how: { "14h": "Formation HACCP 14 h", diplome: "Diplôme de cuisine (dispense)", exp: "3 ans d'expérience comme gérant (dispense)", non: "Formation à prévoir" }[A.resp] || "", ok: A.resp && A.resp !== "non" } : haccp[0] ? { name: haccp[0].name, how: "Formation HACCP 14 h", ok: true } : null;
  return { people, haccp, resp, trained: people.filter((p) => p.tr.length).length };
}
function ctAlgData() {
  const R = S.notes.filter(ctIsRecipe).map((n) => { let a = null; if (typeof recipeAllergens === "function") { try { a = recipeAllergens(n); } catch (e) {} } return { n, a: [...new Set(Array.isArray(a) ? a : n.allergens || [])] }; })
    .sort((x, y) => String(x.n.title || "").localeCompare(String(y.n.title || ""), "fr"));
  return { R, carte: R.filter((x) => x.n.carte).length };
}

/* ───────────────────────── tiles ───────────────────────── */
const CT_SECTIONS = [
  ["temp", "Relevés de températures", "therm", "vi"], ["trace", "Traçabilité & étiquettes", "tag", "sa"], ["rec", "Réceptions", "truck", "to"], ["clean", "Nettoyage", "spray", "sk"],
  ["obl", "Obligations", "calcheck", "sa"], ["form", "Formation du personnel", "ctGrad", "vi"], ["alg", "Allergènes", "ctWheat", "to"], ["pms", "Plan de maîtrise sanitaire", "ctDoc", "sk"],
];
function ctTile(k, P) {
  let v = "–", sub = "", tone = "";
  if (k === "temp") { const D = ctTempData(P); v = D.exp ? `${Math.min(D.done, D.exp)}<small>/${D.exp}</small>` : `${D.rd.length}`; sub = D.bad.length ? `${ctPl(D.bad.length, "écart")} corrigé${D.bad.length > 1 ? "s" : ""}` : D.rd.length ? "Tout est conforme" : "Aucun relevé"; tone = D.rate != null && D.rate < 90 ? "warn" : ""; }
  if (k === "trace") { const D = ctTraceData(P); v = `${D.live.length}`; sub = D.over.length ? `${ctPl(D.over.length, "DLC dépassée", "DLC dépassées")}` : "produits suivis, DLC à jour"; tone = D.over.length ? "bad" : ""; }
  if (k === "rec") { const D = ctRecData(P); v = `${D.recs.length}`; sub = `${ctPl(D.recs.length, "livraison")}${D.refused ? ` · ${D.refused} refus` : D.reserves ? ` · ${ctPl(D.reserves, "réserve")}` : " contrôlées"}`; }
  if (k === "clean") { const D = ctCleanData(P); v = D.rate != null ? `${D.rate}<small> %</small>` : `${D.done}`; sub = D.rate != null ? "des tâches faites" : S.chores.length ? "tâches cochées" : "Plan à créer"; tone = D.rate != null && D.rate < 80 ? "warn" : ""; }
  if (k === "obl") { const R = ctOblData(); const late = R.filter((x) => x.st === "late").length; const okN = R.filter((x) => x.st === "ok" || x.st === "soon").length; v = R.length ? `${okN}<small>/${R.length}</small>` : "–"; sub = late ? `${late} en retard` : R.length ? "contrôles à jour" : "À renseigner"; tone = late ? "bad" : ""; }
  if (k === "form") { const D = ctFormData(); v = D.people.length ? `${D.trained}<small>/${D.people.length}</small>` : "–"; sub = D.resp && D.resp.ok ? "Responsable formé" : "personnes formées"; tone = D.resp && !D.resp.ok ? "warn" : ""; }
  if (k === "alg") { const D = ctAlgData(); v = `${D.R.length}`; sub = D.R.length ? "plats renseignés" : "Fiches à créer"; }
  if (k === "pms") { const d = ctPmsDoc(); v = d ? "À jour" : "À rédiger"; sub = d ? `mis à jour le ${shortDate(ctDayOf(d.updatedAt || d.generatedAt))}` : "en 5 minutes"; tone = d ? "" : "warn"; }
  return { v, sub, tone };
}

/* ───────────────────────── inspector mode ───────────────────────── */
const CT_OK = new Set(["controle", "ctVue", "ctDossier", "pms", "locked"]);
function ctInspLoad() { try { const x = JSON.parse(localStorage.getItem("gg-ct-insp") || "null"); if (x && x.on && (!x.rid || !S.rid || x.rid === S.rid)) { CT.insp = true; CT.pin = x.pin || ""; } } catch (e) {} ctInspClass(); }
function ctInspSave() { try { if (CT.insp) localStorage.setItem("gg-ct-insp", JSON.stringify({ on: true, rid: S.rid, pin: CT.pin, at: Date.now() })); else localStorage.removeItem("gg-ct-insp"); } catch (e) {} }
function ctInspClass() { document.documentElement.classList.toggle("ct-insp", !!CT.insp); }
/* navigation is locked to the dossier while the inspector holds the phone */
(function ctGuard() {
  const g0 = go;
  go = function (route, params = {}, o = {}) {
    if (CT.insp && !CT_OK.has(route)) { if (S.route === "controle") { SFX.err && SFX.err(); return; } route = "controle"; params = {}; o = { ...o, replace: true }; }
    return g0(route, params, o);
  };
})();
window.addEventListener("gg:ready", () => { ctInspLoad(); if (CT.insp) setTimeout(() => { S.history = []; go("controle", {}, { replace: true }); renderChrome(); }, 60); });
function ctInspBar() {
  return `<div class="ct-ib st" style="--i:0"><span class="ct-ibl">${ico("lock")}<span><b>Mode inspecteur</b><em>${esc(S.resto?.name || "")}</em></span></span>
    <button class="ct-quit${CT.pin ? "" : " hold"}" id="ctQuit" ${CT.pin ? `data-act="ctQuitPin"` : ""} aria-label="${CT.pin ? "Quitter le mode inspecteur" : "Maintenir pour quitter le mode inspecteur"}"><i></i><span>${CT.pin ? "Quitter" : "Maintenir pour quitter"}</span></button></div>`;
}
function ctHoldBind(v) {
  const b = $("#ctQuit", v); if (!b || CT.pin) return;
  const stop = () => { clearTimeout(CT.holdT); b.classList.remove("on"); };
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.classList.add("on"); buzz(6); CT.holdT = setTimeout(() => { stop(); ctInspOff(); }, 1600); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
  b.addEventListener("contextmenu", (e) => e.preventDefault());
}
function ctInspOff() { CT.insp = false; CT.pin = ""; ctInspSave(); ctInspClass(); SFX.done(); buzz([10, 30, 10]); toast("Mode inspecteur désactivé"); closeSheet(true); rerender(); renderChrome(); }

/* ───────────────────────── views: controle ───────────────────────── */
function ctPerHtml(P, light) {
  const ix = CT_PER.findIndex((x) => x[0] === P.mode); const t = dayKey();
  return `<div class="ct-seg${light ? " lt" : ""}" role="tablist" aria-label="Période"><span class="ct-knob" style="transform:translateX(${ix * 100}%)"></span>${CT_PER.map(([k, tx]) => `<button role="tab" aria-selected="${P.mode === k}" class="${P.mode === k ? "on" : ""}" data-act="ctPer" data-v="${k}">${tx}</button>`).join("")}</div>
    ${P.mode === "custom" ? `<div class="ct-dates"><label><span>Du</span><input type="date" class="input" id="ctFrom" max="${t}" value="${P.from}"></label><label><span>Au</span><input type="date" class="input" id="ctTo" max="${t}" value="${P.to}"></label></div>` : ""}`;
}
function ctDateBind(v) {
  const on = () => { const a = $("#ctFrom", v), b = $("#ctTo", v); if (!a || !b || !a.value || !b.value) return; S.ui.ctP = { mode: "custom", from: a.value, to: b.value }; a.blur(); b.blur(); SFX.tick(); setTimeout(rerender, 30); };
  $$("#ctFrom,#ctTo", v).forEach((i) => i.addEventListener("change", on));
}
VIEWS.controle = {
  get hideTabs() { return CT.insp; },
  render() {
    ctWatch(); const P = ctPeriod(); const insp = CT.insp; const nDays = ctDays(P).length;
    const tiles = CT_SECTIONS.map(([k, t, ic, w], i) => { const x = ctTile(k, P); return `<button class="ct-tile st ${x.tone}" style="--i:${i + 2}" data-go="ctVue" data-id="${k}">${ctWell(ic, w)}<span class="ct-tt">${t}</span><b class="ct-tv">${x.v}</b><em class="ct-ts">${x.sub}</em></button>`; }).join("");
    const tools = insp ? "" : `<div class="ct-tools">
      <button class="ct-tool st" style="--i:11" data-act="ctInspAsk">${ctWell("lock", "ink")}<span class="tx"><b>Mode inspecteur</b><em>Confiez le téléphone : seul ce dossier reste visible.</em></span>${ico("chev")}</button>
      <button class="ct-tool st" style="--i:12" data-go="rappel">${ctWell("ctRecall", "to")}<span class="tx"><b>Rappel de lot</b><em>Un fournisseur rappelle un produit ? Retrouvez-le partout.</em></span>${ico("chev")}</button>
      <button class="ct-tool st" style="--i:13" data-go="pms">${ctWell("ctDoc", "sk")}<span class="tx"><b>${ctPmsDoc() ? "Plan de maîtrise sanitaire" : "Rédiger mon PMS"}</b><em>${ctPmsDoc() ? "Lire, modifier ou imprimer votre PMS." : "15 questions, et votre PMS est prêt."}</em></span>${ico("chev")}</button></div>`;
    return `<div class="inner wide ct">${insp ? ctInspBar() : topBar("Contrôle sanitaire")}
      <section class="ct-hero wall st" style="--i:1">
        <div class="ct-hk">${insp ? "Bienvenue" : esc(S.resto?.name || "Votre restaurant")}</div>
        <h1 class="ct-ht">${insp ? `Dossier sanitaire<br>${esc(S.resto?.name || "")}` : "Tout votre dossier, prêt pour le contrôle."}</h1>
        ${ctPerHtml(P, true)}
        <div class="ct-hf"><span>${ctPerTx(P)} · ${ctPl(nDays, "jour")}</span><button class="ct-exp" data-go="ctDossier">${ico("printer")}Exporter le dossier complet</button></div>
      </section>
      <div class="ct-grid">${tiles}</div>${tools}</div>`;
  },
  after(v) { ctDateBind(v); ctHoldBind(v); },
};

/* ───────────────────────── views: one section, read-only ───────────────────────── */
const ctKpi = (lbl, v, sub, tone = "") => `<div class="ct-kpi ${tone}"><span>${lbl}</span><b>${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
const ctEmpty = (ic, t, s) => `<div class="glass ct-empty st" style="--i:3">${ctWell(ic, "vi")}<b>${t}</b>${s ? `<span>${s}</span>` : ""}</div>`;
const ctPics = (pics) => pics.length ? `<div class="glass pad st ct-card" style="--i:6"><h3 class="h3">Photos jointes</h3><div class="ct-pics">${pics.slice(0, 24).map((x) => `<figure class="${x.nc ? "nc" : ""}"><img src="${esc(x.url)}" alt="" loading="lazy"><figcaption><b>${esc(x.t)}</b>${shortDate(ctDayOf(x.at))} ${hm(x.at)} · ${esc(firstName(nameOf(x.uid)))}</figcaption></figure>`).join("")}</div></div>` : "";
function ctVueTemp(P) {
  const D = ctTempData(P);
  if (!D.fr.length) return ctEmpty("therm", "Aucune enceinte froide", "Les frigos se déclarent dans l'onglet Frigos.");
  const cell = (d, f, s) => { const r = D.rd.find((x) => x.day === d && x.fridgeId === f.id && ctSlot(x.slot) === s); return r ? `<i class="${r.ok ? "g" : "r"}" title="${shortDate(d)} ${s} : ${fmt(num(r.value))} °C"></i>` : D.days.includes(d) && D.due(d, s) ? `<i class="m" title="${shortDate(d)} ${s} : manquant"></i>` : `<i class="p"></i>`; };
  const strip = (f) => `<div class="ct-strip" style="--n:${D.allDays.length}">${D.allDays.map((d) => `<span>${cell(d, f, "midi")}${cell(d, f, "soir")}</span>`).join("")}</div>`;
  const per = D.per.map((x, i) => `<div class="glass ct-fr st" style="--i:${i + 3}"><div class="ct-frh"><div><b>${esc(x.f.name)}</b><em>${ctRange(x.f) || "Seuil non défini"}</em></div>${x.last ? `<span class="ct-lcd${x.last.ok ? "" : " bad"}">${fmt(num(x.last.value))}°</span>` : ""}</div>
      <div class="ct-frs"><span><em>Min</em><b>${x.min != null ? fmt(x.min) : "–"}</b></span><span><em>Moyenne</em><b>${x.avg != null ? fmt(x.avg) : "–"}</b></span><span><em>Max</em><b>${x.max != null ? fmt(x.max) : "–"}</b></span><span><em>Relevés</em><b>${x.n}</b></span></div>${strip(x.f)}</div>`).join("");
  const nc = D.bad.length ? `<div class="glass pad st ct-card" style="--i:7"><h3 class="h3">Écarts et actions correctives</h3><div class="ct-list">${D.bad.map((r) => `<div class="ct-li"><span class="ct-v bad">${fmt(num(r.value))} °C</span><div class="tx"><b>${esc((D.fr.find((f) => f.id === r.fridgeId) || {}).name || r.fname || "Enceinte")} · ${ctSlot(r.slot)}</b><em>${esc(r.action || "Action non renseignée")}</em></div><span class="ct-when">${shortDate(r.day)}<small>${esc(firstName(nameOf(r.uid)))}</small></span></div>`).join("")}</div></div>` : `<div class="ct-okline st" style="--i:7">Aucun écart de température sur la période.</div>`;
  return `<div class="ct-kpis st" style="--i:2">${ctKpi("Relevés faits", D.exp ? `${Math.min(D.done, D.exp)} / ${D.exp}` : D.rd.length, D.rate != null ? `${D.rate} % des relevés attendus` : "", D.rate != null && D.rate < 90 ? "warn" : "")}${ctKpi("Conformité", D.conf != null ? `${fmt(D.conf, 1)} %` : "–", "relevés dans le seuil")}${ctKpi("Écarts", D.bad.length, D.bad.length ? "tous avec action" : "aucun", D.bad.length ? "warn" : "")}</div>
    <div class="ct-legend st" style="--i:2"><span><i class="g"></i>Conforme</span><span><i class="r"></i>Hors seuil</span><span><i class="m"></i>Manquant</span><em>midi / soir, un jour par colonne</em></div>
    <div class="ct-frgrid">${per}</div>${nc}${ctPics(D.pics)}`;
}
function ctVueRec(P) {
  const D = ctRecData(P);
  if (!D.recs.length) return ctEmpty("truck", "Aucune réception sur la période", "Chaque livraison contrôlée dans l'app apparaît ici.");
  const rows = D.recs.map((rc, i) => { const L = rc.lines || []; const bad = L.filter((x) => x.refused).length, res = L.filter(ctLineRes).length;
    return `<div class="glass ct-rc st" style="--i:${Math.min(i + 3, 12)}"><div class="ct-rch"><div><b>${esc(rc.supplier || "Livraison")}</b><em>${ctFull(ctDayOf(rc.at))} à ${hm(rc.at)}${rc.bl ? ` · BL ${esc(String(rc.bl).replace(/^BL[\s:°n.-]*/i, ""))}` : ""} · ${esc(firstName(nameOf(rc.uid)))}</em></div>${bad ? `<span class="pill bad">${bad} refus</span>` : res ? `<span class="pill warn">${ctPl(res, "réserve")}</span>` : ""}</div>
      <div class="ct-lines">${L.map((x) => `<div class="ct-ln ${ctLineSt(x)}"><span class="nm">${esc(x.name)}${ctLineWhy(x) ? `<small>${esc(ctLineTx(x))} : ${esc(ctLineWhy(x))}</small>` : x.refused ? `<small>Refusé</small>` : ""}</span><span class="lt">${x.lot ? `Lot ${esc(x.lot)}` : "Sans lot"}${x.dlc ? ` · DLC ${shortDate(x.dlc)}` : ""}</span><span class="tp${x.temp != null && x.tmax != null && x.temp > x.tmax ? " bad" : ""}">${x.temp != null ? `${fmt(x.temp)} °C` : "–"}</span></div>`).join("")}</div></div>`; }).join("");
  return `<div class="ct-kpis st" style="--i:2">${ctKpi("Livraisons", D.recs.length, ctPl(D.lines.length, "produit"))}${ctKpi("Refusés", D.refused, "repartis avec le livreur", D.refused ? "warn" : "")}${ctKpi("Réserves", D.reserves, "acceptés avec réserve")}</div>${rows}${ctPics(D.pics)}`;
}
function ctVueTrace(P) {
  const D = ctTraceData(P);
  const byF = {}; D.live.forEach((l) => (byF[l.fridgeId || ""] ||= []).push(l));
  const lotRow = (l) => { const mz = ctLotKey(l.lot) === "MAISON" || /maison/i.test(l.supplier || ""); return `<div class="ct-li"><div class="tx"><b>${esc(l.name)}</b><em>${mz ? "Préparation maison" : `${l.lot ? `Lot ${esc(l.lot)}` : "Sans n° de lot"}${l.supplier ? ` · ${esc(l.supplier)}` : ""}`}${l.status === "opened" ? " · ouvert" : ""}</em></div>${dlcPill(dlcOf(l))}</div>`; };
  const live = Object.entries(byF).sort((a, b) => fridgeName(a[0]).localeCompare(fridgeName(b[0]), "fr")).map(([fid, L], i) => `<div class="glass pad st ct-card" style="--i:${i + 3}"><h3 class="h3">${esc(fid ? fridgeName(fid) : "Sans emplacement")}<span class="ct-n">${L.length}</span></h3><div class="ct-list">${L.sort((a, b) => String(dlcOf(a) || "9").localeCompare(String(dlcOf(b) || "9"))).map(lotRow).join("")}</div></div>`).join("");
  const opened = D.opened.length ? `<div class="glass pad st ct-card" style="--i:8"><h3 class="h3">Produits ouverts sur la période<span class="ct-n">${D.opened.length}</span></h3><div class="ct-list">${D.opened.slice(0, 60).map((l) => `<div class="ct-li"><div class="tx"><b>${esc(l.name)}</b><em>Ouvert le ${shortDate(ctDayOf(l.openedAt))} par ${esc(firstName(nameOf(l.openedBy)))}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</em></div><span class="ct-when">à consommer<small>avant le ${l.dlcOpen ? shortDate(l.dlcOpen) : "–"}</small></span></div>`).join("")}</div></div>` : "";
  const lost = D.lost.length ? `<div class="glass pad st ct-card" style="--i:9"><h3 class="h3">Produits jetés<span class="ct-n">${D.lost.length}</span></h3><div class="ct-list">${D.lost.slice(0, 60).map((l) => `<div class="ct-li"><div class="tx"><b>${esc(l.name)}</b><em>${esc(l.lostReason || "Motif non précisé")}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</em></div><span class="ct-when">${shortDate(ctDayOf(l.outAt))}<small>${esc(firstName(nameOf(l.outBy)))}</small></span></div>`).join("")}</div></div>` : "";
  return `<div class="ct-kpis st" style="--i:2">${ctKpi("En stock", D.live.length, "produits étiquetés")}${ctKpi("DLC dépassées", D.over.length, D.over.length ? "à retirer" : "aucune", D.over.length ? "bad" : "")}${ctKpi("Étiquettes", D.made.length, "créées sur la période")}</div>${live || ctEmpty("tag", "Aucun produit en stock", "")}${opened}${lost}`;
}
function ctVueClean(P) {
  const D = ctCleanData(P);
  if (!S.chores.length) return ctEmpty("spray", "Pas encore de plan de nettoyage", "Le plan se crée dans Planning ménage.");
  const rows = D.chores.slice().sort((a, b) => String(a.c.zone || "").localeCompare(String(b.c.zone || ""), "fr") || a.c.name.localeCompare(b.c.name, "fr")).map((x) => `<div class="ct-li"><div class="tx"><b>${esc(x.c.name)}</b><em>${esc([x.c.zone, x.freqTx].filter(Boolean).join(" · "))}${x.last ? ` · dernière fois le ${shortDate(ctDayOf(x.last))}` : ""}</em></div>${x.rate != null ? `<span class="ct-rate ${x.rate >= 95 ? "" : x.rate >= 80 ? "warn" : "bad"}"><b>${x.rate} %</b><i style="--p:${x.rate}%"></i></span>` : `<span class="ct-when">${x.doneN}<small>fait${x.doneN > 1 ? "s" : ""}</small></span>`}</div>`).join("");
  return `<div class="ct-kpis st" style="--i:2">${ctKpi("Réalisé", D.rate != null ? `${D.rate} %` : "–", D.exp ? `${D.done} / ${D.exp} tâches` : "", D.rate != null && D.rate < 80 ? "warn" : "")}${ctKpi("Tâches au plan", S.chores.length, "")}${ctKpi("Cochées", D.logs.length, "sur la période")}</div>
    <div class="glass pad st ct-card" style="--i:3"><h3 class="h3">Plan de nettoyage et de désinfection</h3><div class="ct-list">${rows}</div></div>`;
}
function ctVueObl() {
  const R = ctOblData();
  if (!R.length) return ctEmpty("calcheck", "Aucune obligation suivie", "Extincteurs, nuisibles, hotte… se suivent dans Obligations.");
  const stc = { late: "bad", soon: "warn", ok: "", unk: "neu" }, stT = { late: "En retard", soon: "Bientôt", ok: "À jour", unk: "Date à noter" };
  const c = (k) => R.filter((x) => x.st === k).length;
  return `<div class="ct-kpis st" style="--i:1">${ctKpi("À jour", c("ok") + c("soon"), `sur ${R.length} contrôles`)}${ctKpi("En retard", c("late"), c("late") ? "à programmer" : "aucun", c("late") ? "bad" : "")}${ctKpi("Bientôt", c("soon"), "dans le mois")}</div>
    <div class="glass pad st ct-card" style="--i:2"><div class="ct-list">${R.map((x) => `<div class="ct-li"><div class="tx"><b>${esc(x.name)}</b><em>${[x.provider, x.lastDone ? `fait le ${ctFull(x.lastDone)}` : "", x.nextDue ? `prochain le ${ctFull(x.nextDue)}` : ""].filter(Boolean).map(esc).join(" · ")}</em></div>${x.st === "ok" ? `<span class="ct-when">${esc(x.freqTx || "")}</span>` : `<span class="pill ${stc[x.st]}">${stT[x.st]}</span>`}</div>`).join("")}</div></div>`;
}
function ctVueForm() {
  const D = ctFormData(); const edit = !CT.insp && ctAdmin();
  const resp = D.resp ? `<div class="glass ct-resp st" style="--i:2">${ctWell("ctGrad", D.resp.ok ? "vi" : "sa")}<div class="tx"><em>Responsable hygiène</em><b>${esc(D.resp.name)}</b><span>${esc(D.resp.how)}</span></div></div>` : "";
  const people = D.people.length ? `<div class="glass pad st ct-card" style="--i:3"><h3 class="h3">L'équipe<span class="ct-n">${D.people.length}</span></h3><div class="ct-list">${D.people.map((p) => `<div class="ct-li ct-pp"><div class="tx"><b>${esc(p.name)}</b><em>${esc(p.role)}</em>${p.tr.length ? `<span class="ct-trs">${p.tr.map((t) => `<span class="ct-tr${t.kind === "haccp" ? " h" : ""}">${esc(t.kind === "autre" && t.label ? t.label : CT_TRS[t.kind] || t.label || "Formation")}${t.day ? ` · ${t.day.slice(0, 4)}` : ""}</span>`).join("")}</span>` : `<span class="ct-trs"><span class="ct-tr no">Aucune formation notée</span></span>`}</div>${edit ? `<button class="iconbtn" data-act="ctTrAdd" data-id="${esc(p.id || p.memberId)}" aria-label="Ajouter une formation pour ${esc(p.name)}">${ico("plus")}</button>` : ""}</div>`).join("")}</div></div>` : ctEmpty("users", "Aucune personne dans l'équipe", "");
  return `<div class="ct-kpis st" style="--i:1">${ctKpi("Formés", `${D.trained} / ${D.people.length}`, "au moins une formation")}${ctKpi("HACCP 14 h", D.haccp.length, "personnes")}${ctKpi("Responsable", D.resp && D.resp.ok ? "Formé" : "À former", "", D.resp && D.resp.ok ? "" : "warn")}</div>${resp}${people}${edit ? `<button class="btn soft block st" style="--i:4" data-act="ctTrAdd">${ico("plus")}Noter une formation</button>` : ""}`;
}
function ctVueAlg() {
  const D = ctAlgData();
  if (!D.R.length) return ctEmpty("ctWheat", "Aucune fiche recette", "Les allergènes se renseignent dans Recettes & allergènes.");
  return `<div class="ct-kpis st" style="--i:2">${ctKpi("Plats", D.R.length, "avec leurs allergènes")}${ctKpi("Sans allergène", D.R.filter((x) => !x.a.length).length, "déclaré")}${ctKpi("Allergènes", 14, "réglementés (UE 1169/2011)")}</div>
    <div class="glass pad st ct-card" style="--i:3"><div class="ct-list">${D.R.map(({ n, a }) => `<div class="ct-li ct-al"><div class="tx"><b>${esc(n.title || "Sans titre")}</b><span class="ct-als">${a.length ? a.map((id) => `<span class="ct-alc">${esc((typeof allergenOf === "function" && allergenOf(id)?.t) || id)}</span>`).join("") : `<span class="ct-alc no">Aucun allergène</span>`}</span></div></div>`).join("")}</div></div>`;
}
function ctVuePms() {
  const d = ctPmsDoc();
  if (!d) return `${ctEmpty("ctDoc", "Plan de maîtrise sanitaire à rédiger", CT.insp ? "" : "15 questions, et Gusto rédige votre PMS.")}${CT.insp ? "" : `<button class="btn acc block st" style="--i:4" data-go="pms">${ico("sparkle")}Rédiger mon PMS</button>`}`;
  return `<div class="glass ct-pmscard st" style="--i:2">${ctWell("ctDoc", "sk")}<div class="tx"><b>Plan de maîtrise sanitaire</b><em>Mis à jour le ${ctFull(ctDayOf(d.updatedAt || d.generatedAt))}${d.updatedBy ? ` par ${esc(firstName(d.updatedBy))}` : ""}</em></div></div>
    <div class="glass pad st ct-card" style="--i:3"><div class="ct-list">${d.sections.map((s, i) => `<div class="ct-li tap" data-go="pms" role="button" tabindex="0"><span class="ct-num">${i + 1}</span><div class="tx"><b>${esc(s.title)}</b></div>${ico("chev")}</div>`).join("")}</div></div>
    <button class="btn acc block st" style="--i:4" data-go="pms">${ico("ctDoc")}Lire le PMS</button>`;
}
VIEWS.ctVue = {
  nav: "controle",
  get hideTabs() { return CT.insp; },
  render(p) {
    ctWatch(); const k = (p && p.id) || "temp"; const sec = CT_SECTIONS.find((x) => x[0] === k) || CT_SECTIONS[0]; const P = ctPeriod();
    const noPer = ["obl", "form", "alg", "pms"].includes(k);
    const body = { temp: ctVueTemp, rec: ctVueRec, trace: ctVueTrace, clean: ctVueClean, obl: ctVueObl, form: ctVueForm, alg: ctVueAlg, pms: ctVuePms }[sec[0]](P);
    return `<div class="inner wide ct ct-vue">${CT.insp ? ctInspBar() : ""}${topBar(sec[1], { right: k === "pms" ? "" : `<button class="btn soft sm" data-act="ctPrintSec" data-v="${k}">${ico("printer")}<span class="ct-hide-s">Imprimer</span></button>` })}
      ${noPer ? "" : `<div class="ct-vper st" style="--i:1">${ctPerHtml(P, false)}<span class="ct-pertx">${ctPerTx(P)}</span></div>`}${body}</div>`;
  },
  after(v) { ctDateBind(v); ctHoldBind(v); },
};

/* ───────────────────────── printing (A4, « Enregistrer au format PDF ») ─────────────────────────
   The document is copied into #ctPrint (a direct child of body); html.ct-printing hides everything else in print (css/controle.css). */
function ctPrint(html, title) {
  let root = $("#ctPrint"); if (!root) { root = document.createElement("div"); root.id = "ctPrint"; document.body.appendChild(root); }
  root.innerHTML = typeof photoFix === "function" ? photoFix(html) : html; if (typeof photoFixDom === "function") photoFixDom(root);
  SFX.tap(); buzz(8); const t = document.title; document.title = String(title || "Dossier sanitaire").replace(/[\/\\:]/g, "-");
  document.documentElement.classList.add("ct-printing");
  setTimeout(() => { try { window.print(); } catch (e) { toast("Impression impossible sur cet appareil.", "err"); } document.title = t; }, 80);
}
window.addEventListener("afterprint", () => { if (!document.documentElement.classList.contains("ct-printing")) return; setTimeout(() => { document.documentElement.classList.remove("ct-printing"); const r = $("#ctPrint"); if (r) r.innerHTML = ""; }, 300); });
const ctSc = (html) => `<div class="ct-sc">${html}</div>`;
const ctT = (head, rows, cls = "") => ctSc(`<table class="rp-t ${cls}"><thead><tr>${head.map((h) => `<th${/^(T°|Relevé|Valeur|Taux|Réalisé)/.test(h) ? ` class="r"` : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`);
const ctDocHead = (kicker, P) => `<header class="rp-head"><div class="rp-brand"><span class="rp-mk">${typeof appIcon === "function" ? appIcon(36) : ""}</span><div><b>${esc(S.resto?.name || "Restaurant")}</b><em>${esc(kicker)}</em></div></div>${P ? `<div class="rp-per"><span>Période</span><b>${ctPerTx(P)}</b></div>` : ""}</header>`;
const ctDocFoot = () => `<footer class="rp-foot"><div>Document établi le ${ctFull(dayKey())} à ${hm(Date.now())} par ${esc(nameOf(S.me.id))} avec Growth Gusto. Chaque enregistrement est daté et attribué à la personne qui l'a saisi ; une correction ne l'efface jamais.</div><div class="rp-sign"><span>Visa du responsable</span><i></i></div></footer>`;

function ctDocTemp(P) {
  const D = ctTempData(P);
  if (!D.fr.length) return `<p class="rp-empty">Aucune enceinte froide déclarée.</p>`;
  const cell = (day, f, slot) => { const rs = D.rd.filter((r) => r.day === day && r.fridgeId === f.id && ctSlot(r.slot) === slot); if (!rs.length) return D.days.includes(day) && D.due(day, slot) ? `<td class="miss">—</td>` : `<td class="todo"></td>`; return `<td>${rs.map((r) => `<span class="${r.ok ? "" : "nc"}">${fmt(num(r.value))}${r.ok ? "" : "*"}</span>`).join(" / ")}<i>${rs.map((r) => esc(initials(nameOf(r.uid)))).join(" ")}</i></td>`; };
  const days = D.allDays.slice().reverse();
  const grid = ctSc(`<table class="rp-t rp-temps"><thead><tr><th rowspan="2">Date</th>${D.fr.map((f) => `<th colspan="2">${esc(f.name)}<small>${esc(ctRange(f))}</small></th>`).join("")}</tr><tr>${D.fr.map(() => `<th>Midi</th><th>Soir</th>`).join("")}</tr></thead><tbody>${days.map((d) => `<tr><td class="nw">${esc(DAYS[parseDay(d).getDay()].slice(0, 3))}. ${shortDate(d)}</td>${D.fr.map((f) => cell(d, f, "midi") + cell(d, f, "soir")).join("")}</tr>`).join("")}</tbody></table>`);
  const nc = D.bad.length ? ctT(["Date", "Heure", "Enceinte", "Relevé", "Seuil", "Action corrective", "Par"], D.bad.slice().reverse().map((r) => `<tr><td class="nw">${ctFull(r.day)}</td><td class="nw">${hm(r.at)}</td><td>${esc((D.fr.find((f) => f.id === r.fridgeId) || {}).name || r.fname || "–")}</td><td class="r nc nw">${fmt(num(r.value))} °C</td><td class="nw">${esc(ctRange(D.fr.find((f) => f.id === r.fridgeId)))}</td><td>${esc(r.action || "Non renseignée")}</td><td>${esc(nameOf(r.uid))}</td></tr>`)) : `<p class="rp-ok">Aucune non-conformité de température sur la période.</p>`;
  return `<div class="rp-kpis">${[["Relevés faits", D.exp ? `${Math.min(D.done, D.exp)} / ${D.exp}` : D.rd.length, D.rate != null ? `${D.rate} % des relevés attendus` : ""], ["Conformité", D.conf != null ? `${fmt(D.conf, 1)} %` : "–", "relevés dans le seuil"], ["Hors seuil", D.bad.length, "avec action corrective"], ["Enceintes", D.fr.length, "suivies matin et soir"]].map(([a, b, c]) => `<div class="rp-kpi"><span>${a}</span><b>${b}</b><em>${c}</em></div>`).join("")}</div>
    <h3>Relevés par jour</h3><p class="rp-note">Deux relevés par jour et par enceinte, en °C. * hors seuil · « — » relevé manquant. Initiales : personne ayant relevé.</p>${grid}
    <h3>Non-conformités et actions correctives</h3>${nc}`;
}
function ctDocRec(P) {
  const D = ctRecData(P); if (!D.lines.length) return `<p class="rp-empty">Aucune réception sur la période.</p>`;
  return `<p class="rp-note">${ctPl(D.recs.length, "livraison")}, ${ctPl(D.lines.length, "produit")} contrôlé${D.lines.length > 1 ? "s" : ""} (température, DLC, lot, emballage) · ${D.refused} refus · ${ctPl(D.reserves, "réserve")}. Un produit refusé repart avec le livreur.</p>
    ${ctT(["Date", "Fournisseur", "Produit", "Lot", "DLC", "T° reçue", "Décision", "Par"], D.lines.slice().reverse().map(({ rc, L }) => `<tr class="${L.refused ? "row-nc" : ""}"><td class="nw">${shortDate(ctDayOf(rc.at))} ${hm(rc.at)}</td><td>${esc(rc.supplier || "–")}${rc.bl ? `<small>BL ${esc(String(rc.bl).replace(/^BL[\s:°n.-]*/i, ""))}</small>` : ""}</td><td>${esc(L.name)}${L.sanitary ? `<small>Estampille ${esc(L.sanitary)}</small>` : ""}</td><td class="mono">${esc(L.lot || "–")}</td><td class="nw">${L.dlc ? ctFull(L.dlc) : "–"}</td><td class="r nw ${L.temp != null && L.tmax != null && L.temp > L.tmax ? "nc" : ""}">${L.temp != null ? `${fmt(L.temp)} °C` : "–"}</td><td><span class="rp-st ${ctLineSt(L)}">${ctLineTx(L)}</span>${ctLineWhy(L) ? `<small>${esc(ctLineWhy(L))}</small>` : ""}</td><td>${esc(firstName(nameOf(rc.uid)))}</td></tr>`))}`;
}
function ctDocTrace(P) {
  const D = ctTraceData(P);
  const live = D.live.length ? ctT(["Produit", "Lot · fournisseur", "Emplacement", "Reçu / fabriqué", "DLC", "Statut"], D.live.slice().sort((a, b) => String(dlcOf(a) || "9").localeCompare(String(dlcOf(b) || "9"))).map((l) => { const over = (daysUntil(dlcOf(l)) ?? 99) < 0; return `<tr class="${over ? "row-nc" : ""}"><td>${esc(l.name)}</td><td><span class="mono">${esc(l.lot || "–")}</span>${l.supplier ? `<small>${esc(l.supplier)}</small>` : ""}</td><td>${esc(fridgeName(l.fridgeId))}</td><td class="nw">${l.createdAt ? shortDate(ctDayOf(l.createdAt)) : "–"}</td><td class="nw">${dlcOf(l) ? ctFull(dlcOf(l)) : "–"}</td><td class="nw"><span class="rp-st ${over ? "bad" : l.status === "opened" ? "acc" : "ok"}">${over ? "DLC dépassée" : l.status === "opened" ? "Ouvert" : "En stock"}</span></td></tr>`; })) : `<p class="rp-empty">Aucun produit en stock.</p>`;
  const moved = [...D.opened.map((l) => ({ l, at: l.openedAt, k: "Ouverture", tx: `à consommer avant le ${l.dlcOpen ? ctFull(l.dlcOpen) : "–"}`, by: l.openedBy })), ...D.lost.map((l) => ({ l, at: l.outAt, k: "Jeté", tx: l.lostReason || "Motif non précisé", by: l.outBy, nc: true }))].sort((a, b) => a.at - b.at);
  const mv = moved.length ? ctT(["Date", "Produit", "Lot", "Mouvement", "Détail", "Par"], moved.map((x) => `<tr class="${x.nc ? "row-nc" : ""}"><td class="nw">${shortDate(ctDayOf(x.at))} ${hm(x.at)}</td><td>${esc(x.l.name)}</td><td class="mono">${esc(x.l.lot || "–")}</td><td>${x.k}</td><td>${esc(x.tx)}</td><td>${esc(firstName(nameOf(x.by)))}</td></tr>`)) : `<p class="rp-empty">Aucun produit ouvert ou jeté sur la période.</p>`;
  return `<p class="rp-note">Chaque produit entré en stock porte une étiquette (nom, lot, DLC, code) qui le relie à sa livraison. ${ctPl(D.made.length, "étiquette")} créée${D.made.length > 1 ? "s" : ""} sur la période.</p><h3>Produits en stock le ${ctFull(dayKey())}</h3>${live}<h3>Ouvertures et pertes sur la période</h3>${mv}`;
}
function ctDocClean(P) {
  const D = ctCleanData(P); if (!S.chores.length) return `<p class="rp-empty">Aucun plan de nettoyage déclaré.</p>`;
  return `<p class="rp-note">Tâches du plan et réalisation sur la période${D.rate != null ? ` : ${D.rate} % des tâches prévues ont été faites (${D.done} / ${D.exp})` : ""}. Chaque tâche est cochée par la personne qui l'a faite.</p>
    ${ctT(["Tâche", "Zone", "Fréquence", "Réalisé", "Taux", "Dernière fois"], D.chores.map((x) => `<tr class="${x.rate != null && x.rate < 80 ? "row-nc" : ""}"><td>${esc(x.c.name)}</td><td>${esc(x.c.zone || "–")}</td><td class="nw">${esc(x.freqTx || "")}</td><td class="r nw">${x.expN ? `${x.doneN} / ${x.expN}` : x.doneN}</td><td class="r nw">${x.rate != null ? `<span class="rp-st ${x.rate >= 95 ? "ok" : x.rate >= 80 ? "warn" : "bad"}">${x.rate} %</span>` : "–"}</td><td class="nw">${x.last ? `${shortDate(ctDayOf(x.last))} ${hm(x.last)}` : "Jamais"}</td></tr>`))}`;
}
function ctDocObl() {
  const R = ctOblData(); if (!R.length) return `<p class="rp-empty">Aucune obligation suivie dans l'application.</p>`;
  const stT = { late: ["bad", "En retard"], soon: ["warn", "À prévoir"], ok: ["ok", "À jour"], unk: ["neu", "Date à renseigner"] };
  return ctT(["Contrôle", "Fréquence", "Dernier passage", "Prestataire", "Prochaine échéance", "Statut"], R.map((x) => `<tr class="${x.st === "late" ? "row-nc" : ""}"><td>${esc(x.name)}${x.catT ? `<small>${esc(x.catT)}</small>` : ""}</td><td class="nw">${esc(x.freqTx || "–")}</td><td class="nw">${x.lastDone ? ctFull(x.lastDone) : "–"}</td><td>${esc(x.provider || "–")}</td><td class="nw">${x.nextDue ? ctFull(x.nextDue) : "–"}</td><td class="nw"><span class="rp-st ${stT[x.st][0]}">${stT[x.st][1]}</span></td></tr>`));
}
function ctDocForm() {
  const D = ctFormData();
  const resp = D.resp ? `<p class="${D.resp.ok ? "rp-ok" : "rp-empty"}">Responsable hygiène : ${esc(D.resp.name)} · ${esc(D.resp.how)}</p>` : `<p class="rp-empty">Responsable hygiène non renseigné.</p>`;
  return `${resp}<p class="rp-note">Au moins une personne de l'établissement doit justifier d'une formation en hygiène alimentaire de 14 h (décret 2011-731), ou d'un diplôme ou d'une expérience qui en dispense. L'équipe est formée aux bonnes pratiques à son arrivée.</p>
    ${D.people.length ? ctT(["Personne", "Poste", "Formations", "Date", "Organisme"], D.people.map((p) => p.tr.length ? p.tr.map((t, i) => `<tr${i ? ` class="rp-cont"` : ""}><td>${i ? "" : esc(p.name)}</td><td>${i ? "" : esc(p.role || "–")}</td><td>${esc(t.kind === "autre" && t.label ? t.label : CT_TRAIN[t.kind] || t.label || "Formation")}${t.hours ? `<small>${t.hours} h</small>` : ""}</td><td class="nw">${t.day ? ctFull(t.day) : "–"}</td><td>${esc(t.provider || "–")}</td></tr>`).join("") : `<tr><td>${esc(p.name)}</td><td>${esc(p.role || "–")}</td><td colspan="3"><small>Aucune formation enregistrée</small></td></tr>`)) : `<p class="rp-empty">Aucune personne enregistrée.</p>`}`;
}
function ctDocAlg() {
  const D = ctAlgData(); if (!D.R.length || typeof ALLERGENS === "undefined") return `<p class="rp-empty">Aucune fiche recette enregistrée.</p>`;
  const S2 = { gluten: "Gluten", crustaces: "Crustacés", oeufs: "Œufs", poissons: "Poissons", arachides: "Arachides", soja: "Soja", lait: "Lait", fruitscoque: "Fruits à coque", celeri: "Céleri", moutarde: "Moutarde", sesame: "Sésame", sulfites: "Sulfites", lupin: "Lupin", mollusques: "Mollusques" };
  return `<p class="rp-note">Les 14 allergènes à déclarer (règlement UE 1169/2011, décret 2015-447), pour chaque plat, y compris ceux apportés par les produits et sous-recettes. Ce tableau est présenté au client qui le demande.</p>
    ${ctSc(`<table class="rp-t rp-alg"><thead><tr><th>Plat</th>${ALLERGENS.map((x) => `<th class="v"><span>${esc(S2[x.id] || x.t)}</span></th>`).join("")}</tr></thead><tbody>${D.R.map(({ n, a }) => `<tr><td>${esc(n.title || "Sans titre")}</td>${ALLERGENS.map((x) => `<td class="c${a.includes(x.id) ? " on" : ""}">${a.includes(x.id) ? "●" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`)}`;
}
function ctDocPms() { const d = ctPmsDoc(); if (!d) return `<p class="rp-empty">Le plan de maîtrise sanitaire n'a pas encore été rédigé dans l'application.</p>`; return `<p class="rp-note">Version du ${ctFull(ctDayOf(d.updatedAt || d.generatedAt))}${d.updatedBy ? `, mise à jour par ${esc(d.updatedBy)}` : ""}.</p>${d.sections.map((s, i) => `<div class="ct-pmsd"><h3>${8}.${i + 1} ${esc(s.title)}</h3>${ctMd(s.text)}</div>`).join("")}`; }
const CT_DOC = [
  ["temp", "Températures des enceintes froides", "Relevés midi et soir, écarts et actions correctives", ctDocTemp],
  ["rec", "Réceptions des marchandises", "Contrôle à la livraison : température, DLC, lot", ctDocRec],
  ["trace", "Traçabilité et étiquetage", "Produits en stock, ouvertures, pertes", ctDocTrace],
  ["clean", "Plan de nettoyage et de désinfection", "Tâches prévues et réalisées", ctDocClean],
  ["obl", "Obligations et contrôles périodiques", "Extincteurs, nuisibles, hotte, installations", ctDocObl],
  ["form", "Formation du personnel", "Responsable hygiène et formations de l'équipe", ctDocForm],
  ["alg", "Allergènes", "Les 14 allergènes de chaque plat", ctDocAlg],
  ["pms", "Plan de maîtrise sanitaire", "BPH, plan HACCP, traçabilité, non-conformités, retrait", ctDocPms],
];
function ctDocHtml(P, only) {
  const T = ctTempData(P), R = ctRecData(P), C = ctCleanData(P), O = ctOblData(), F = ctFormData();
  const secs = CT_DOC.map((x, i) => ({ k: x[0], n: i + 1, t: x[1], s: x[2], fn: x[3] })).filter((x) => !only || x.k === only);
  const pics = only && only !== "temp" && only !== "rec" ? [] : [...(only === "rec" ? [] : T.pics), ...(only === "temp" ? [] : R.pics)].sort((a, b) => a.at - b.at);
  const picsHtml = pics.length ? `<section class="ct-pb"><h2><span>${only ? "+" : secs.length + 1}</span>Annexe : photos des relevés et réceptions</h2><p class="rp-note">${pics.length > 36 ? `Les 36 dernières sur ${pics.length}. ` : ""}Photo prise au moment de la saisie.</p><div class="rp-pics">${pics.slice(-36).map((x) => `<figure class="${x.nc ? "nc" : ""}"><img src="${esc(x.url)}" alt=""><figcaption><b>${esc(x.t)}</b>${shortDate(ctDayOf(x.at))} ${hm(x.at)} · ${esc(firstName(nameOf(x.uid)))}</figcaption></figure>`).join("")}</div></section>` : "";
  const body = secs.map((x, i) => `<section class="${i || !only ? "ct-pb" : ""}" id="ctd-${x.k}"><h2><span>${only ? "" : x.n}</span>${x.t}</h2>${x.fn(P)}</section>`).join("");
  if (only) return `<article class="rp-paper ct-doc">${ctDocHead("Contrôle sanitaire", x0(only) ? null : P)}${body}${picsHtml}${ctDocFoot()}</article>`;
  const late = O.filter((x) => x.st === "late").length; const pms = ctPmsDoc();
  const cover = `<section class="ct-cover"><div class="ct-cvt">${typeof appIcon === "function" ? appIcon(44) : ""}<span>Dossier de contrôle sanitaire</span></div>
    <h1>${esc(S.resto?.name || "Restaurant")}</h1>${S.resto?.address ? `<p class="ct-cva">${esc(S.resto.address)}</p>` : ""}
    <div class="ct-cvp"><span>Période contrôlée</span><b>${ctPerTx(P)}</b></div>
    <div class="ct-cvk">${[["Relevés de température", T.exp ? `${T.rate} %` : "–", `${Math.min(T.done, T.exp)} / ${T.exp} faits · ${T.bad.length} écart${T.bad.length > 1 ? "s" : ""}`], ["Réceptions contrôlées", R.recs.length, `${R.lines.length} produits · ${R.refused} refus`], ["Plan de nettoyage", C.rate != null ? `${C.rate} %` : "–", "des tâches prévues faites"], ["Contrôles obligatoires", O.length ? `${O.length - late} / ${O.length}` : "–", late ? `${late} en retard` : "à jour"], ["Personnel formé", F.people.length ? `${F.trained} / ${F.people.length}` : "–", F.resp && F.resp.ok ? "responsable formé HACCP" : "responsable à former"], ["Plan de maîtrise sanitaire", pms ? "Rédigé" : "À rédiger", pms ? `mis à jour le ${ctFull(ctDayOf(pms.updatedAt || pms.generatedAt))}` : ""]].map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><em>${c}</em></div>`).join("")}</div>
    <div class="ct-cvf"><span>Établi le ${ctLong(dayKey())} par ${esc(nameOf(S.me.id))}</span><span>Registre tenu dans Growth Gusto depuis le ${ctFull(ctStartDay())}</span></div></section>`;
  const toc = `<section class="ct-pb ct-toc"><h2 class="ct-toch">Sommaire</h2><ol>${secs.map((x) => `<li><b>${x.n}</b><span><strong>${x.t}</strong><em>${x.s}</em></span></li>`).join("")}${pics.length ? `<li><b>${secs.length + 1}</b><span><strong>Annexe : photos</strong><em>${ctPl(pics.length, "photo")} prise${pics.length > 1 ? "s" : ""} au moment des relevés et réceptions</em></span></li>` : ""}</ol>
    <p class="rp-note">Toutes les données de ce dossier sont enregistrées au fil de l'eau dans l'application par l'équipe, datées et signées par la personne connectée. Les originaux (photos, rapports de prestataires, bons de livraison) sont consultables sur place.</p></section>`;
  return `<article class="rp-paper ct-doc">${cover}${toc}${body}${picsHtml}${ctDocFoot()}</article>`;
}
const x0 = (k) => ["obl", "form", "alg", "pms"].includes(k);
VIEWS.ctDossier = {
  nav: "controle",
  get hideTabs() { return CT.insp; },
  render() {
    ctWatch(); const P = ctPeriod();
    return `<div class="inner wide ct ct-dos">${CT.insp ? ctInspBar() : ""}${topBar("Dossier complet", { right: `<button class="btn acc sm ct-dk" data-act="ctPrintAll">${ico("printer")}Imprimer · PDF</button>` })}
      <div class="ct-vper st" style="--i:1">${ctPerHtml(P, false)}<span class="ct-pertx">Pour un PDF : « Enregistrer au format PDF » dans la fenêtre d'impression.</span></div>
      <div class="ct-docwrap st" style="--i:2">${ctDocHtml(P)}</div>
      <div class="ctabar ct-cta"><button class="btn acc block" data-act="ctPrintAll">${ico("printer")}Imprimer ou enregistrer en PDF</button></div></div>`;
  },
  after(v) { ctDateBind(v); ctHoldBind(v); },
};

/* ───────────────────────── tiny markup for PMS sections ─────────────────────────
   « ## Titre » sous-titre · « - texte » liste · « | a | b » tableau (1re ligne = en-tête) · « > texte » encadré · **gras** */
function ctMd(text) {
  const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out = []; let ul = null, tb = null, p = [];
  const flush = () => { if (p.length) { out.push(`<p>${inl(p.join(" "))}</p>`); p = []; } if (ul) { out.push(`<ul>${ul.map((x) => `<li>${inl(x)}</li>`).join("")}</ul>`); ul = null; } if (tb) { const [h, ...r] = tb; out.push(`<div class="ct-sc"><table class="rp-t ct-mdt"><thead><tr>${h.map((c) => `<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${r.map((row) => `<tr>${h.map((_, i) => `<td>${inl(row[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`); tb = null; } };
  String(text || "").split("\n").forEach((raw) => {
    const l = raw.trim();
    if (!l) return flush();
    if (l.startsWith("## ")) { flush(); out.push(`<h4>${inl(l.slice(3))}</h4>`); return; }
    if (l.startsWith("> ")) { flush(); out.push(`<p class="ct-call">${inl(l.slice(2))}</p>`); return; }
    if (/^[-•] /.test(l)) { if (p.length || tb) { const u = ul; ul = null; flush(); ul = u; } (ul ||= []).push(l.slice(2)); return; }
    if (l.startsWith("|")) { if (p.length || ul) flush(); (tb ||= []).push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); return; }
    if (ul || tb) flush(); p.push(l);
  });
  flush(); return out.join("");
}

/* ───────────────────────── PMS: questions ───────────────────────── */
const CT_Q = [
  { k: "type", t: "Quel type de restaurant ?", kind: "one", o: [["bistrot", "Bistrot, brasserie"], ["trad", "Cuisine traditionnelle"], ["gastro", "Gastronomique"], ["pizza", "Pizzeria"], ["rapide", "Restauration rapide"], ["creperie", "Crêperie"], ["monde", "Cuisine du monde"], ["traiteur", "Traiteur"]] },
  { k: "couverts", t: "Combien de couverts par jour ?", kind: "one", o: [["<50", "Moins de 50"], ["50-150", "50 à 150"], ["150-300", "150 à 300"], [">300", "Plus de 300"]] },
  { k: "equipe", t: "Combien de personnes en cuisine ?", kind: "one", o: [["1-2", "1 ou 2"], ["3-5", "3 à 5"], ["6-10", "6 à 10"], [">10", "Plus de 10"]] },
  { k: "prod", t: "Comment cuisinez-vous ?", s: "Plusieurs choix possibles.", kind: "multi", o: [["jour", "Cuisiné le jour même"], ["avance", "Préparé à l'avance (J+1, J+2…)"], ["froide", "On cuit, on refroidit, on réchauffe"], ["chaude", "Maintien au chaud pendant le service"], ["sousvide", "Sous vide"], ["congel", "Congélation de nos produits"]] },
  { k: "froid", t: "Vos frigos et congélateurs", s: "Repris de l'app. Ils se modifient dans Frigos.", kind: "fridges" },
  { k: "equip", t: "Vos autres équipements", kind: "multi", o: [["sonde", "Thermomètre à sonde"], ["cellule", "Cellule de refroidissement"], ["sousvide", "Machine sous vide"], ["lv", "Lave-vaisselle"], ["friteuse", "Friteuse"], ["trancheuse", "Trancheuse"], ["hotte", "Hotte d'extraction"]] },
  { k: "sensibles", t: "Servez-vous des produits sensibles ?", s: "Ils ont des règles à part dans le PMS.", kind: "multi", o: [["hache", "Viande hachée, tartare"], ["oeufscrus", "Œufs crus (mayonnaise, mousse…)"], ["crus", "Poisson cru, huîtres, coquillages"], ["volaille", "Volailles"], ["patisserie", "Pâtisseries à la crème"], ["laitcru", "Fromages au lait cru"], ["riz", "Riz ou pâtes cuits à l'avance"]] },
  { k: "vente", t: "Sur place, à emporter, livraison ?", kind: "multi", o: [["place", "Sur place"], ["emporter", "Vente à emporter"], ["livraison", "Livraison par nos soins"], ["plateforme", "Livraison par une plateforme"]] },
  { k: "fournisseurs", t: "Vos fournisseurs principaux", s: "Repris de vos réceptions. Séparez-les par des virgules.", kind: "text", ph: "Metro, Boucherie Durand…" },
  { k: "eau", t: "D'où vient votre eau ?", kind: "one", o: [["reseau", "Réseau public (eau de ville)"], ["prive", "Puits ou forage privé"]] },
  { k: "nuis", t: "Qui s'occupe des nuisibles ?", kind: "one", o: [["presta", "Un prestataire sous contrat"], ["interne", "Nous-mêmes"]], x: { k: "nuisName", ph: "Nom du prestataire", when: "presta" } },
  { k: "resp", t: "Le responsable est-il formé à l'hygiène ?", kind: "one", o: [["14h", "Oui, formation HACCP 14 h"], ["diplome", "Diplôme de cuisine (CAP, bac pro…)"], ["exp", "3 ans comme gérant d'un commerce alimentaire"], ["non", "Pas encore"]], x: { k: "respName", ph: "Nom du responsable" } },
  { k: "tenue", t: "Qui lave les tenues de cuisine ?", kind: "one", o: [["presta", "Une blanchisserie"], ["place", "Lavées sur place"], ["salaries", "Chaque salarié chez lui"]] },
  { k: "dechets", t: "Vos déchets", kind: "multi", o: [["tri", "Tri sélectif"], ["huiles", "Huiles de friture collectées"], ["bio", "Biodéchets collectés"], ["local", "Local ou bacs dédiés"]] },
  { k: "desinf", t: "Quel produit pour désinfecter ?", s: "Le nom du produit, ou laissez le texte proposé.", kind: "text", ph: "Détergent-désinfectant contact alimentaire (norme EN 1276)" },
  { k: "alg", t: "Comment informez-vous sur les allergènes ?", kind: "one", o: [["app", "Fiche allergènes de chaque plat"], ["carte", "Mention sur la carte ou l'ardoise"], ["affiche", "Affiche « demandez-nous »"], ["tous", "Plusieurs de ces moyens"]] },
];
function ctPmsDefaults() {
  const nm = S.products.map((p) => ctNorm(p.name)).concat(S.notes.filter(ctIsRecipe).map((n) => ctNorm(n.title))).join(" | ");
  const sens = []; if (/hach|tartare/.test(nm)) sens.push("hache"); if (/mayonnaise|tiramisu|mousse au chocolat/.test(nm)) sens.push("oeufscrus"); if (/huitre|claire|coquill|moule|sushi|saumon cru|tartare de (thon|saumon)|ceviche/.test(nm)) sens.push("crus"); if (/poulet|volaille|canard|dinde|pintade/.test(nm)) sens.push("volaille"); if (/patissiere|chou a la creme|eclair|chantilly/.test(nm)) sens.push("patisserie"); if (/lait cru|camembert|reblochon|roquefort/.test(nm)) sens.push("laitcru");
  const sup = [...new Set([...S.receptions.map((r) => r.supplier), ...S.products.map((p) => p.supplier)].filter((s) => s && !/maison/i.test(s)))].slice(0, 8);
  const nuis = (S.obligations || []).find((o) => o.key === "nuisibles" && !o.archived);
  const owner = (S.members || []).find((m) => m.role === "gerant");
  const tk = (S.tickets || []).filter((t) => t.covers); const cov = tk.length ? tk.reduce((s, t) => s + t.covers, 0) / tk.length : null;
  const cooks = (S.staff || []).filter((s) => s.active !== false && /cuisine|second|chef|commis|plonge/i.test(`${s.post || ""} ${s.role || ""}`)).length || (S.members || []).length;
  const ty = String(S.resto?.type || "").toLowerCase(); const type = CT_Q[0].o.some((o) => o[0] === ty) ? ty : /brasserie|bistro/.test(ty) ? "bistrot" : /pizz/.test(ty) ? "pizza" : "trad";
  const hasCh = (re) => S.chores.some((c) => re.test(ctNorm(c.name)));
  const equip = ["sonde", "lv"]; if ((S.obligations || []).some((o) => o.key === "hotte") || hasCh(/hotte/)) equip.push("hotte"); if (hasCh(/trancheuse/) || /jambon|saucisson/.test(nm)) equip.push("trancheuse"); if (/frite/.test(nm)) equip.push("friteuse");
  return {
    type, couverts: cov == null ? "50-150" : cov < 50 ? "<50" : cov < 150 ? "50-150" : cov < 300 ? "150-300" : ">300",
    equipe: cooks <= 2 ? "1-2" : cooks <= 5 ? "3-5" : cooks <= 10 ? "6-10" : ">10",
    prod: S.notes.some((n) => /refroid|lendemain|rechauff/.test(ctNorm(`${n.body} ${(n.steps || []).join(" ")}`))) ? ["jour", "avance", "froide"] : ["jour"],
    equip, sensibles: sens, vente: ["place"], fournisseurs: sup.join(", "), eau: "reseau",
    nuis: nuis || !S.resto ? "presta" : "interne", nuisName: nuis ? nuis.provider || "" : "",
    resp: "14h", respName: (owner && owner.name) || S.me.name || "", tenue: "place", dechets: equip.includes("friteuse") ? ["tri", "huiles"] : ["tri"], desinf: "", alg: S.notes.some((n) => ctIsRecipe(n) && (n.allergens || []).length) ? "app" : "carte",
  };
}

/* ───────────────────────── PMS: the document ─────────────────────────
   Structure of a PMS (Paquet Hygiène: règlements CE 178/2002, 852/2004, 853/2004; arrêté du 21 décembre 2009; GBPH du restaurateur):
   présentation · bonnes pratiques d'hygiène (prérequis) · plan HACCP · traçabilité · non-conformités · retrait / rappel · enregistrements. */
function ctPmsBuild(A) {
  const has = (k, v) => (Array.isArray(A[k]) ? A[k].includes(v) : A[k] === v);
  const lab = (k, v) => ((CT_Q.find((q) => q.k === k) || {}).o || []).find((o) => o[0] === v)?.[1] || "";
  const labs = (k) => (A[k] || []).map((v) => lab(k, v)).filter(Boolean);
  const nm = S.resto?.name || "L'établissement";
  const PH = { type: { bistrot: "bistrot, brasserie", trad: "restaurant traditionnel", gastro: "restaurant gastronomique", pizza: "pizzeria", rapide: "restauration rapide", creperie: "crêperie", monde: "cuisine du monde", traiteur: "traiteur" },
    couverts: { "<50": "moins de 50 couverts par jour", "50-150": "50 à 150 couverts par jour", "150-300": "150 à 300 couverts par jour", ">300": "plus de 300 couverts par jour" },
    equipe: { "1-2": "1 ou 2 personnes en cuisine", "3-5": "3 à 5 personnes en cuisine", "6-10": "6 à 10 personnes en cuisine", ">10": "plus de 10 personnes en cuisine" },
    prod: { jour: "cuisine du jour", avance: "préparations à l'avance (J+1, J+2)", froide: "liaison froide (cuisson, refroidissement rapide, remise en température)", chaude: "maintien au chaud pendant le service", sousvide: "cuisson ou conditionnement sous vide", congel: "congélation de produits préparés sur place" },
    vente: { place: "sur place", emporter: "vente à emporter", livraison: "livraison par l'établissement", plateforme: "livraison par une plateforme" } };
  const ph = (k) => PH[k][A[k]] || ""; const phs = (k) => (A[k] || []).map((v) => PH[k][v]).filter(Boolean);
  const resp = A.respName || "le gérant";
  const avance = has("prod", "avance") || has("prod", "froide");
  const fr = S.fridges.map((f) => `| ${f.name} | ${f.min != null && f.max != null ? `${fmt(f.min, 0)} à ${fmt(f.max, 0)} °C` : "à définir"} | 2 fois par jour (midi et soir) |`);
  const chores = S.chores.map((c) => { let fq = c.freq || ""; if (typeof regFreqTx === "function") { try { fq = regFreqTx(c); } catch (e) {} } return `| ${c.name} | ${c.zone || "–"} | ${fq} |`; });
  const desinf = A.desinf || "Détergent-désinfectant pour surfaces au contact des denrées (norme EN 1276)";
  const sec = [];
  sec.push({ id: "pres", title: "Présentation de l'établissement", text: [
    `**${nm}**${S.resto?.address ? `, ${S.resto.address}` : ""}.`,
    `Activité : ${ph("type") || "restauration commerciale"}${ph("couverts") ? `, ${ph("couverts")}` : ""}${ph("equipe") ? `, ${ph("equipe")}` : ""}. ${phs("vente").length ? `Mode de vente : ${phs("vente").join(", ")}.` : ""}`,
    `Production : ${phs("prod").join(", ") || "cuisine du jour"}.`,
    "",
    `Responsable de la sécurité sanitaire des aliments : **${resp}** (${({ "14h": "formation en hygiène alimentaire de 14 h", diplome: "diplôme de cuisine qui dispense de la formation", exp: "expérience de 3 ans qui dispense de la formation", non: "formation de 14 h à suivre" })[A.resp] || "formation à préciser"}).`,
    "",
    "## Objet du document",
    "Ce plan de maîtrise sanitaire (PMS) décrit les mesures prises par l'établissement pour assurer l'hygiène et la sécurité sanitaire de ses productions vis-à-vis des dangers biologiques, physiques, chimiques et allergènes. Il est tenu à la disposition des services de contrôle (DDPP).",
    "## Références",
    "- Règlement (CE) n° 178/2002 : principes généraux de la législation alimentaire, traçabilité, retrait et rappel.",
    "- Règlement (CE) n° 852/2004 : hygiène des denrées alimentaires, procédures fondées sur les principes HACCP.",
    "- Règlement (CE) n° 853/2004 : règles spécifiques aux denrées d'origine animale.",
    "- Règlement (UE) n° 1169/2011 et décret n° 2015-447 : information sur les allergènes.",
    "- Arrêté du 21 décembre 2009 : températures de conservation et règles sanitaires du commerce de détail.",
    "- Décret n° 2011-731 : formation en hygiène alimentaire en restauration commerciale.",
    "- Guide de bonnes pratiques d'hygiène et d'application des principes HACCP « Restaurateur ».",
    "## Organisation",
    `Les enregistrements (relevés de température, réceptions, étiquettes, nettoyage, contrôles périodiques) sont tenus dans l'application Growth Gusto par l'équipe, au moment où les tâches sont faites. Le PMS est relu au moins une fois par an et à chaque changement de carte, d'équipement ou d'organisation.`,
  ].join("\n") });
  sec.push({ id: "bph", title: "Bonnes pratiques d'hygiène", text: [
    "Les bonnes pratiques d'hygiène (BPH) sont les prérequis qui maîtrisent les dangers au quotidien.",
    "## Personnel",
    "- Lavage des mains à l'eau tiède et au savon bactéricide, essuie-mains à usage unique : à la prise de poste, après une pause, après les toilettes, après avoir touché des déchets, des emballages ou des produits crus.",
    `- Tenue propre et réservée à la cuisine : veste, tablier, coiffe, chaussures de sécurité. ${({ presta: "Les tenues sont lavées par une blanchisserie.", place: "Les tenues sont lavées sur place, à 60 °C minimum.", salaries: "Les tenues sont lavées par chaque salarié, à 60 °C minimum, et transportées dans un sac propre." })[A.tenue] || ""}`,
    "- Ongles courts, sans vernis, pas de bijoux en production. Toute plaie est protégée par un pansement et un gant.",
    "- Toute personne malade (diarrhée, vomissements, fièvre, infection de la peau) le signale au responsable, qui l'écarte de la manipulation des denrées.",
    "- Chaque nouvel arrivant est formé aux bonnes pratiques et aux procédures de l'établissement avant de manipuler les denrées.",
    "## Locaux et marche en avant",
    "- Le principe de la marche en avant est respecté dans le temps ou dans l'espace : réception, stockage, préparations froides et chaudes, service, puis plonge et déchets, sans croisement entre le propre et le sale.",
    "- Les emballages extérieurs (cartons, cagettes) ne rentrent pas en zone de production.",
    "- Les produits crus et les produits cuits ou prêts à consommer sont séparés (enceintes, étagères ou contenants fermés et identifiés).",
    "- Les locaux et équipements sont maintenus en bon état ; les réparations sont faites sans délai.",
    "## Nettoyage et désinfection",
    `Produit utilisé : ${desinf}. Les produits sont rangés à l'écart des denrées, dans leur emballage d'origine, et utilisés selon la fiche technique (dilution, temps de contact, rinçage).`,
    chores.length ? `Plan de nettoyage (${ctPl(chores.length, "tâche")}, tenu et coché dans l'application) :` : "Le plan de nettoyage est tenu dans l'application : chaque tâche, sa zone, sa fréquence et la personne qui l'a faite.",
    ...(chores.length ? ["", "| Tâche | Zone | Fréquence |", ...chores, ""] : []),
    has("equip", "lv") ? "La vaisselle et les ustensiles sont lavés au lave-vaisselle (lavage à 55-65 °C, rinçage à 80-90 °C)." : "La vaisselle est lavée à l'eau chaude avec un détergent, puis rincée et séchée à l'air.",
    "## Lutte contre les nuisibles",
    A.nuis === "presta" ? `Un contrat est passé avec ${A.nuisName ? `**${A.nuisName}**` : "un prestataire spécialisé"} (dératisation, désinsectisation). Le plan de pose des appâts et les rapports de passage sont conservés ; les passages sont suivis dans l'application (Obligations).` : "La lutte est assurée en interne : pièges et appâts placés hors des zones de production selon un plan, contrôlés chaque mois ; les contrôles sont notés dans l'application.",
    "- Moustiquaires aux ouvertures, portes fermées, aucune denrée stockée au sol, poubelles fermées et vidées chaque jour.",
    "## Approvisionnement en eau",
    A.eau === "prive" ? "L'eau provient d'un puits ou forage privé : elle fait l'objet d'une autorisation préfectorale et d'analyses régulières de potabilité, conservées avec ce plan." : "L'eau utilisée provient du réseau public d'eau potable. La glace est fabriquée avec cette eau, dans une machine nettoyée selon le plan de nettoyage.",
    "## Maîtrise des températures",
    "Températures de conservation appliquées (arrêté du 21 décembre 2009) :",
    "",
    "| Denrée | Température maximale |",
    "| Plats cuisinés à l'avance, préparations réfrigérées | 0 à +3 °C |",
    "| Viandes hachées, préparations de viandes hachées | +2 °C |",
    "| Poissons, crustacés et produits de la pêche frais | 0 à +2 °C (glace fondante) |",
    "| Abats, volailles et lapins découpés | +3 °C |",
    "| Préparations de viandes | +4 °C |",
    "| Viandes, produits laitiers frais, crèmes, desserts | +4 °C |",
    "| Surgelés, glaces | -18 °C |",
    "",
    fr.length ? "Enceintes froides de l'établissement, relevées dans l'application :" : "Les enceintes froides sont relevées deux fois par jour dans l'application.",
    ...(fr.length ? ["", "| Enceinte | Plage de consigne | Relevé |", ...fr, ""] : []),
    has("equip", "sonde") ? "Un thermomètre à sonde, désinfecté avant chaque usage, sert aux contrôles à cœur (réception, cuisson, refroidissement)." : "> Prévoir un thermomètre à sonde pour les contrôles à cœur.",
    "## Réception des marchandises",
    `Fournisseurs principaux : ${A.fournisseurs || "à compléter"}. Chaque livraison est contrôlée et enregistrée dans l'application : température des produits réfrigérés et surgelés, DLC, intégrité des emballages, numéro de lot, estampille sanitaire pour les produits d'origine animale. Un produit non conforme est refusé et repart avec le livreur.`,
    "## Stockage, étiquetage et DLC",
    "- Les produits sont rangés aussitôt après réception, en respectant le premier entré, premier sorti.",
    "- Tout produit déconditionné, ouvert ou fabriqué sur place porte une étiquette : nom, date de fabrication ou d'ouverture, DLC, numéro de lot.",
    `- Préparations faites sur place : DLC de 3 jours maximum (J+3) sauf validation${avance ? " ; un produit ouvert est utilisé dans les délais indiqués par le fabricant" : ""}.`,
    "- Un produit dont la DLC est dépassée est jeté et la perte est notée dans l'application.",
    "## Déchets",
    `${labs("dechets").join(", ") || "Poubelles à commande non manuelle"}. Les poubelles de cuisine sont munies de couvercles à commande non manuelle et vidées au moins une fois par jour.${has("dechets", "huiles") ? " Les huiles de friture usagées sont stockées en bidons fermés et collectées par une entreprise agréée." : ""}`,
    "## Allergènes",
    `Les 14 allergènes réglementaires sont identifiés pour chaque plat (fiches recettes de l'application). Information du client : ${lab("alg", A.alg).toLowerCase() || "sur demande"}. Les préparations sans allergène sont réalisées avec du matériel propre et à l'écart des autres préparations ; toute modification de recette entraîne la mise à jour de la fiche.`,
  ].join("\n") });
  /* HACCP: hazard analysis and CCP table, built from the answers */
  const ccp = [
    ["Réception des produits frais et surgelés", "Multiplication de bactéries (Listeria, salmonelles), produits altérés", "Produits frais à la température réglementaire, surgelés à -18 °C (tolérance -15 °C), DLC non dépassée, emballage intact", "Contrôle de chaque livraison (sonde, étiquette)", "Refus du produit, information du fournisseur", "Réception dans l'application"],
    ["Stockage au froid", "Multiplication bactérienne", "Enceintes positives dans leur plage (0 à +4 °C), négatives à -18 °C", "Relevé 2 fois par jour", "Transfert des denrées, réglage, technicien ; destruction si la température a dépassé le seuil trop longtemps", "Relevés de température"],
    ["Cuisson", "Survie de bactéries pathogènes", "+63 °C à cœur minimum (+70 °C recommandé pour volailles et viande hachée)", "Sonde à cœur sur les cuissons à risque", "Prolonger la cuisson", "Fiche process du plat"],
  ];
  if (avance) ccp.push(["Refroidissement rapide", "Germination des spores (Clostridium perfringens, Bacillus cereus)", "De +63 °C à +10 °C en moins de 2 h, puis stockage entre 0 et +3 °C", `Sonde en fin de refroidissement${has("equip", "cellule") ? " (cellule de refroidissement)" : ""}`, "Au-delà de 2 h : destruction de la préparation", "Fiche process, étiquette de la préparation"]);
  if (has("prod", "froide") || avance) ccp.push(["Remise en température", "Multiplication bactérienne", "+63 °C à cœur en moins d'1 h, une seule remise en température", "Sonde à cœur", "Poursuivre la chauffe ; au-delà d'1 h, destruction", "Fiche process"]);
  if (has("prod", "chaude")) ccp.push(["Maintien au chaud", "Multiplication bactérienne", "+63 °C minimum pendant tout le service", "Contrôle au début et en cours de service", "Remise en température immédiate ou destruction ; les restes ne sont pas resservis le lendemain", "Fiche process"]);
  if (has("sensibles", "hache")) ccp.push(["Viande hachée, tartare", "E. coli STEC, salmonelles", "Stockage à +2 °C, hachage à la demande, service immédiat", "Contrôle à réception et au stockage", "Destruction en cas de doute", "Réception, étiquette"]);
  if (has("sensibles", "oeufscrus")) ccp.push(["Préparations aux œufs crus", "Salmonelles", "Œufs extra-frais ou ovoproduits pasteurisés ; préparation conservée à +4 °C et consommée le jour même", "Contrôle des œufs à réception, étiquette de la préparation", "Destruction des préparations du jour non consommées", "Étiquette"]);
  if (has("sensibles", "crus")) ccp.push(["Poisson cru, coquillages", "Parasites (Anisakis), norovirus, toxines", "Poisson cru congelé à -20 °C pendant 24 h au moins (sauf attestation du fournisseur) ; coquillages vivants, étiquette sanitaire conservée 60 jours", "Contrôle à réception, étiquette de congélation", "Refus ou destruction", "Réception, étiquettes sanitaires"]);
  if (has("vente", "livraison") || has("vente", "plateforme") || has("vente", "emporter")) ccp.push(["Vente à emporter et livraison", "Multiplication bactérienne pendant le transport", "Plats froids à +3 °C maximum, plats chauds à +63 °C minimum ; contenants fermés et étiquetés (allergènes)", "Contrôle de la température au départ", "Préparation refaite ou non livrée", "Bon de commande"]);
  sec.push({ id: "haccp", title: "Plan HACCP", text: [
    "Le plan HACCP applique les 7 principes du Codex Alimentarius : analyser les dangers, déterminer les points critiques (CCP), fixer leurs limites critiques, les surveiller, prévoir les actions correctives, vérifier le système et tenir les enregistrements.",
    "## Diagramme de fabrication général",
    `- Réception → stockage (froid positif, froid négatif, réserve sèche) → déconditionnement → préparations froides et préparations chaudes (cuisson)${avance ? " → refroidissement rapide → stockage → remise en température" : ""}${has("prod", "chaude") ? " → maintien au chaud" : ""} → dressage → service${has("vente", "emporter") || has("vente", "livraison") || has("vente", "plateforme") ? " → emballage et transport" : ""}.`,
    "- Le diagramme détaillé de chaque plat (fiche process HACCP) est tenu dans l'application, avec la fiche recette.",
    "## Analyse des dangers",
    "| Danger | Origine | Mesures de maîtrise |",
    "| Biologique (bactéries, virus, parasites) | Matières premières, personnel, températures non maîtrisées | Réception contrôlée, chaîne du froid, cuisson, hygiène du personnel |",
    "| Physique (verre, métal, os, plastique) | Emballages, matériel, personnel | Déconditionnement hors production, matériel en bon état, tenue adaptée |",
    "| Chimique (produits d'entretien, huiles) | Nettoyage, friture | Produits rangés à part, rinçage, huiles changées selon contrôle |",
    "| Allergènes | Recettes, contaminations croisées | Fiches allergènes, préparations séparées, information du client |",
    "## Points critiques pour la maîtrise (CCP)",
    "",
    "| Étape | Danger | Limite critique | Surveillance | Action corrective | Enregistrement |",
    ...ccp.map((r) => `| ${r.join(" | ")} |`),
    "",
    "## Vérification",
    `${resp} vérifie chaque semaine que les enregistrements sont complets (relevés, réceptions, nettoyage) et que les actions correctives ont été faites. Le plan est revu au moins une fois par an.`,
  ].join("\n") });
  sec.push({ id: "trace", title: "Traçabilité", text: [
    "Conformément à l'article 18 du règlement (CE) n° 178/2002, l'établissement sait identifier ses fournisseurs (traçabilité amont) et, pour la vente à emporter, ses éventuels clients professionnels.",
    "- Chaque réception est enregistrée dans l'application : fournisseur, date, numéro de bon de livraison, produits, numéros de lot, DLC et températures.",
    "- Chaque produit mis en stock reçoit une étiquette avec un code qui le relie à sa livraison et à son lot fournisseur.",
    "- Les ouvertures, les sorties, les pertes et les déplacements entre enceintes sont enregistrés, avec la personne et l'heure.",
    "- Les recettes indiquent les produits utilisés : en cas d'alerte, la fonction « Rappel de lot » retrouve les plats et les services concernés.",
    has("sensibles", "crus") ? "- Les étiquettes sanitaires des coquillages sont conservées 60 jours, avec la date de consommation du lot." : "",
    "## Durée de conservation des documents",
    "- Produits très périssables (DLC de moins de 3 mois) : 6 mois après la date de livraison.",
    "- Produits avec une date de durabilité minimale : durée de vie du produit + 6 mois.",
    "- Produits sans date : 5 ans.",
    "Les bons de livraison et factures sont conservés au moins aussi longtemps ; les enregistrements de l'application le restent sans limite.",
  ].filter(Boolean).join("\n") });
  sec.push({ id: "nc", title: "Gestion des non-conformités", text: [
    "Toute non-conformité est corrigée immédiatement, enregistrée avec l'action corrective et analysée pour éviter qu'elle se reproduise.",
    "",
    "| Situation | Action immédiate | Enregistrement |",
    "| Enceinte froide hors seuil | Contrôler à la sonde la température des produits, les transférer dans une autre enceinte, régler ou appeler le frigoriste ; jeter les produits sensibles restés trop longtemps hors seuil | Relevé avec action corrective |",
    "| Livraison non conforme (température, DLC, emballage) | Refus du produit, reprise par le livreur, information du fournisseur | Réception : produit refusé et motif |",
    "| DLC dépassée en stock | Retrait et destruction | Produit noté jeté avec le motif |",
    "| Cuisson ou remise en température insuffisante | Prolonger la cuisson ; au-delà du délai, destruction | Fiche process |",
    "| Refroidissement trop long | Destruction de la préparation | Fiche process |",
    "| Présence de nuisibles | Nettoyage, protection des denrées, appel du prestataire | Obligations : passage du prestataire |",
    "| Corps étranger, produit suspect | Isolement du produit, information du fournisseur | Photo et note |",
    "| Plainte d'un client, suspicion d'intoxication | Recueillir les informations, conserver les restes et plats témoins éventuels au froid, prévenir l'ARS ou la DDPP | Note datée, fiche de retrait si besoin |",
    "",
    "Une toxi-infection alimentaire collective (au moins 2 cas avec des symptômes similaires, rapportés à une même origine alimentaire) est obligatoirement déclarée à l'ARS ou à la DDPP.",
  ].join("\n") });
  sec.push({ id: "rappel", title: "Procédures de retrait et de rappel", text: [
    "En application de l'article 19 du règlement (CE) n° 178/2002, dès que l'établissement a connaissance qu'un produit ne répond pas aux exigences de sécurité, il le retire et, si le produit a pu atteindre le consommateur, il en informe les autorités.",
    "## Déclenchement",
    "- Alerte d'un fournisseur, avis de rappel publié sur RappelConso (rappel.conso.gouv.fr), information de la DDPP, ou non-conformité constatée sur place.",
    "## Étapes",
    "- 1. Identifier les lots concernés : dans l'application, « Rappel de lot » recherche le numéro de lot ou le nom du produit dans les réceptions, le stock, les recettes et les services.",
    "- 2. Bloquer : les produits concernés sont isolés, identifiés « NE PAS UTILISER » et notés bloqués dans l'application (motif « Rappel fournisseur »).",
    "- 3. Retirer : destruction ou retour au fournisseur selon ses instructions ; un bon de reprise ou une attestation de destruction est conservé.",
    "- 4. Évaluer : vérifier si le produit a été utilisé dans des plats déjà servis ou vendus.",
    `- 5. Informer : le fournisseur ; la DDPP si un produit dangereux a pu être consommé${has("vente", "emporter") || has("vente", "livraison") || has("vente", "plateforme") ? " ; les clients de la vente à emporter ou de la livraison concernés, par affichage ou message" : ""}.`,
    "- 6. Enregistrer : la fiche de retrait (produits, lots, quantités, destination, actions) est imprimée depuis l'application, signée et conservée avec ce plan.",
    "## Contacts",
    `- Responsable du retrait : ${resp}.`,
    `- Fournisseurs : ${A.fournisseurs || "voir les réceptions dans l'application"}.`,
    "- DDPP du département : coordonnées sur la page « services de l'État » de la préfecture.",
  ].join("\n") });
  sec.push({ id: "docs", title: "Enregistrements et documents", text: [
    "Documents tenus à la disposition des services de contrôle :",
    "",
    "| Document | Où le trouver |",
    "| Relevés de température des enceintes | Application : Relevés, Registre HACCP |",
    "| Contrôles à réception, bons de livraison | Application : Réception (photos des étiquettes) |",
    "| Étiquettes, ouvertures, pertes | Application : Scanner, Registre HACCP |",
    "| Plan de nettoyage et sa réalisation | Application : Planning ménage |",
    "| Fiches recettes, allergènes, process HACCP | Application : Recettes & allergènes |",
    "| Contrats et rapports des prestataires (nuisibles, hotte, extincteurs…) | Application : Obligations & contrôles |",
    "| Attestations de formation | Application : Contrôle sanitaire, Formation |",
    "| Fiches de retrait | Application : Rappel de lot |",
    "",
    "Le « Dossier de contrôle sanitaire » rassemble ces enregistrements sur la période demandée, en un seul document imprimable.",
  ].join("\n") });
  return sec;
}

/* ───────────────────────── PMS: views ───────────────────────── */
const ctPmsCanEdit = () => !CT.insp && (ctAdmin() || (typeof PERMS !== "undefined" && PERMS.cap && PERMS.cap("editSettings")));
function ctPmsWizard() {
  const W = S.ui.ctPw; const q = CT_Q[W.i]; const A = W.a; const n = CT_Q.length;
  let body = "";
  if (q.kind === "one" || q.kind === "multi") body = `<div class="ct-opts${q.o.length > 4 ? " two" : ""}">${q.o.map(([v, t]) => { const on = q.kind === "one" ? A[q.k] === v : (A[q.k] || []).includes(v); return `<button class="ct-opt${on ? " on" : ""}" data-act="ctPwPick" data-v="${esc(v)}" aria-pressed="${on}"><span class="ct-ck">${q.kind === "multi" ? ico("check") : "<i></i>"}</span>${esc(t)}</button>`; }).join("")}</div>`;
  if (q.kind === "text") body = `<textarea class="input ct-ta" id="ctPwText" rows="3" placeholder="${esc(q.ph || "")}">${esc(A[q.k] || "")}</textarea>`;
  if (q.kind === "fridges") body = S.fridges.length ? `<div class="ct-frl">${S.fridges.map((f) => `<div class="ct-frli">${ctWell("snow", "sk")}<b>${esc(f.name)}</b><span class="ct-lcd">${ctRange(f) || "–"}</span></div>`).join("")}</div>` : `<div class="ct-okline warn">Aucun frigo déclaré pour l'instant. Le PMS indiquera de les ajouter.</div>`;
  if (q.x && (!q.x.when || A[q.k] === q.x.when)) body += `<input class="input ct-x" id="ctPwX" placeholder="${esc(q.x.ph)}" value="${esc(A[q.x.k] || "")}" autocomplete="off">`;
  return `<div class="inner narrow ct ct-pw">${topBar("Mon PMS", { right: `<span class="ct-pwn">${W.i + 1} / ${n}</span>` })}
    <div class="ct-pwbar st" style="--i:1"><i style="width:${Math.round(((W.i + 1) / n) * 100)}%"></i></div>
    <div class="ct-pwq ${W.anim || ""}" key="${W.i}"><h2 class="ct-pwt">${esc(q.t)}</h2>${q.s ? `<p class="sub">${esc(q.s)}</p>` : ""}${body}</div>
    <div class="ctabar ct-pwnav">${W.i ? `<button class="btn soft" data-act="ctPwNav" data-v="-1" aria-label="Question précédente">${ico("back")}</button>` : ""}<button class="btn acc" data-act="ctPwNav" data-v="1">${W.i === n - 1 ? `${ico("sparkle")}Rédiger mon PMS` : "Suivant"}</button></div></div>`;
}
function ctPmsDocHtml(d, print) {
  return `<article class="rp-paper ct-doc ct-pmsdoc">${ctDocHead("Plan de maîtrise sanitaire")}
    <h1>Plan de maîtrise sanitaire</h1><p class="rp-note">${esc(S.resto?.name || "")} · version du ${ctFull(ctDayOf(d.updatedAt || d.generatedAt))}${d.updatedBy ? `, par ${esc(d.updatedBy)}` : ""}</p>
    ${print ? `<ol class="ct-ptoc">${d.sections.map((s, i) => `<li><b>${i + 1}</b>${esc(s.title)}</li>`).join("")}</ol>` : ""}
    ${d.sections.map((s, i) => `<section class="${print && i ? "ct-pb" : ""}" id="pms-${esc(s.id)}"><h2><span>${i + 1}</span>${esc(s.title)}${!print && ctPmsCanEdit() ? `<button class="ct-edit" data-act="ctPmsEdit" data-v="${i}" aria-label="Modifier « ${esc(s.title)} »">${ico("edit")}Modifier</button>` : ""}</h2>${ctMd(s.text)}</section>`).join("")}${ctDocFoot()}</article>`;
}
VIEWS.pms = {
  nav: "controle",
  get hideTabs() { return CT.insp || !!S.ui.ctPw; },
  get live() { return !S.ui.ctPw; },
  render() {
    ctWatch(); const d = ctPmsDoc();
    if (S.ui.ctPw && !CT.insp) return ctPmsWizard();
    if (!d) return `<div class="inner narrow ct">${CT.insp ? ctInspBar() : ""}${topBar("Plan de maîtrise sanitaire")}
      <section class="ct-hero wall st" style="--i:1"><div class="ct-hk">Plan de maîtrise sanitaire</div><h1 class="ct-ht">Votre PMS, rédigé pour vous.</h1><p class="ct-hp">15 questions simples. Gusto reprend vos frigos, vos fournisseurs et votre plan de nettoyage, et rédige un PMS complet : bonnes pratiques, plan HACCP, traçabilité, retrait et rappel.</p>
      ${CT.insp ? "" : `<div class="ct-hf"><span>5 minutes environ</span><button class="ct-exp" data-act="ctPwStart">${ico("sparkle")}Commencer</button></div>`}</section></div>`;
    const edit = ctPmsCanEdit();
    return `<div class="inner wide ct ct-pms">${CT.insp ? ctInspBar() : ""}${topBar("Plan de maîtrise sanitaire", { right: `<button class="btn acc sm ct-dk" data-act="ctPmsPrint">${ico("printer")}Imprimer · PDF</button>` })}
      ${edit ? `<div class="ct-pmsbar st" style="--i:1"><span>${ctWell("ctDoc", "sk")}<span class="tx"><b>${ctPl(d.sections.length, "section")}</b><em>Mis à jour le ${ctFull(ctDayOf(d.updatedAt || d.generatedAt))}</em></span></span><button class="btn soft sm" data-act="ctPwStart">${ico("sparkle")}Refaire le questionnaire</button></div>` : ""}
      <div class="ct-docwrap st" style="--i:2">${ctPmsDocHtml(d)}</div>
      <div class="ctabar ct-cta"><button class="btn acc block" data-act="ctPmsPrint">${ico("printer")}Imprimer ou enregistrer en PDF</button></div></div>`;
  },
  after(v) {
    ctHoldBind(v);
    const W = S.ui.ctPw; if (!W) return;
    const t = $("#ctPwText", v), x = $("#ctPwX", v); const q = CT_Q[W.i];
    if (t) t.addEventListener("input", () => { W.a[q.k] = t.value; });
    if (x) x.addEventListener("input", () => { W.a[q.x.k] = x.value; });
    W.anim = "";
  },
};
function ctPmsEditSheet(i) {
  const d = ctPmsDoc(); const s = d && d.sections[i]; if (!s) return;
  openSheet(`<div class="ct-sh"><div class="h2" style="font-size:21px">${esc(s.title)}</div>
    <textarea class="input ct-edta" id="ctEdTx" rows="14" spellcheck="true">${esc(s.text)}</textarea>
    <p class="ct-hint">« ## » sous-titre · « - » liste · « | » tableau · **gras**</p>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="ctPmsSave" data-v="${i}">${ico("check")}Enregistrer</button></div></div>`);
}
async function ctPmsWrite(patch) {
  const d = ctPmsDoc() || { kind: "pms", version: 0 }; const now = Date.now();
  const doc = { ...d, ...patch, updatedAt: now, updatedBy: S.me.name || nameOf(S.me.id) }; delete doc.id;
  await safe(DB.set("docs", "pms", doc)); S.ctDocs.pms = { id: "pms", ...doc }; return doc;
}

/* ───────────────────────── rappel de lot ───────────────────────── */
function ctRecallFind(q) {
  const nq = ctNorm(q), lq = ctLotKey(q); if (nq.length < 2) return null;
  const isLot = (v) => !!v && lq.length >= 2 && ctLotKey(v).includes(lq) && ctLotKey(v) !== "MAISON";
  const isName = (v) => nq.length >= 3 && ctNorm(v).includes(nq);
  const G = {}; const keyOf = (lot, name) => (lot && ctLotKey(lot) !== "MAISON" ? "L:" + ctLotKey(lot) : "N:" + ctNorm(name));
  const grp = (lot, name, sup) => { const k = keyOf(lot, name); return (G[k] ||= { k, lot: lot && ctLotKey(lot) !== "MAISON" ? lot : "", names: new Set(), sup: new Set(), recs: [], lots: [] }), G[k].names.add(name), sup && G[k].sup.add(sup), G[k]; };
  S.receptions.forEach((rc) => (rc.lines || []).forEach((L) => { if (isLot(L.lot) || isName(L.name)) grp(L.lot, L.name, rc.supplier).recs.push({ rc, L }); }));
  S.lots.forEach((l) => { if (l.test || l.status === "merged") return; if (isLot(l.lot) || isLot(l.code) || (isName(l.name) && !/maison/i.test(l.supplier || "") && ctLotKey(l.lot) !== "MAISON")) grp(l.lot, l.name, l.supplier).lots.push(l); });
  const groups = Object.values(G).map((g) => ({ ...g, names: [...g.names], sup: [...g.sup], since: Math.min(...g.recs.map((x) => x.rc.at), ...g.lots.map((l) => l.createdAt || Infinity)) }))
    .sort((a, b) => b.since - a.since);
  return { q, groups };
}
function ctRecallScope(R) {
  const sel = S.ui.ctRcSel; const G = R.groups.filter((g) => !sel || sel.includes(g.k));
  const pids = new Set(), names = new Set(); G.forEach((g) => { g.recs.forEach(({ L }) => { if (L.productId) pids.add(L.productId); names.add(ctNorm(L.name)); }); g.lots.forEach((l) => { if (l.productId) pids.add(l.productId); names.add(ctNorm(l.name)); }); });
  const since = Math.min(...G.map((g) => g.since).filter(isFinite), Date.now());
  const uses = (n, ids) => (n.ingredients || []).some((g) => (g.productId && pids.has(g.productId)) || (g.noteId && ids.has(g.noteId)) || (g.name && names.has(ctNorm(g.name))));
  const R1 = S.notes.filter((n) => ctIsRecipe(n) && uses(n, new Set())); const ids = new Set(R1.map((n) => n.id));
  const R2 = S.notes.filter((n) => ctIsRecipe(n) && !ids.has(n.id) && uses(n, ids)); R2.forEach((n) => ids.add(n.id));
  const recipes = [...R1, ...R2];
  const titles = recipes.map((n) => ctNorm(n.title)).filter(Boolean);
  /* homemade preparations made after the delivery, named after a recipe that uses the product */
  const made = S.lots.filter((l) => !l.test && l.status !== "merged" && (l.createdAt || 0) >= since && (/maison/i.test(l.supplier || "") || ctLotKey(l.lot) === "MAISON") && titles.some((t) => ctNorm(l.name).startsWith(t.split(" ").slice(0, 3).join(" "))));
  const sold = {}; (S.tickets || []).forEach((t) => { if (!t.date || t.date < ctDayOf(since)) return; (t.lines || []).forEach((L) => { const n = recipes.find((r) => r.id === L.noteId || ctNorm(r.title) === ctNorm(L.libelle)); if (!n) return; const s = (sold[t.date] ||= { day: t.date, n: 0, dishes: new Set() }); s.n += +L.quantite || 0; s.dishes.add(n.title); }); });
  const used = (S.moves || []).filter((m) => !m.cancelled && m.kind === "recette" && (m.at || 0) >= since && (pids.has(m.productId) || names.has(ctNorm(m.name))));
  const svc = (S.moves || []).filter((m) => !m.cancelled && m.kind === "transfert" && (m.at || 0) >= since && G.some((g) => g.lots.some((l) => l.id === m.lotId || l.id === m.ref)));
  const lots = G.flatMap((g) => g.lots); const live = (l) => l.status === "in" || l.status === "opened";
  const toPull = [...lots.filter(live), ...made.filter(live).map((l) => ({ ...l, maison: true }))];
  return { G, since, recipes, made, services: Object.values(sold).sort((a, b) => b.day.localeCompare(a.day)).map((s) => ({ ...s, dishes: [...s.dishes] })), used, svc, toPull, gone: [...lots, ...made].filter((l) => !live(l)) };
}
function ctRecallRows(X) {
  return X.toPull.map((l) => ({ id: l.id, name: l.name, lot: l.lot || "", supplier: l.supplier || "", dlc: dlcOf(l) || "", qty: ctQty(l.qty, l.unit), fridge: fridgeName(l.fridgeId), at: l.createdAt || 0, maison: !!l.maison }));
}
function ctFicheHtml(F) {
  const rows = F.rows || [];
  const box = (t) => `<li><i></i>${t}</li>`;
  return `<article class="rp-paper ct-doc ct-fiche">${ctDocHead("Fiche de retrait · rappel de produits")}
    <h1>Fiche de retrait de produits</h1>
    <div class="ct-fgrid"><div><span>Date</span><b>${ctFull(ctDayOf(F.at || Date.now()))} à ${hm(F.at || Date.now())}</b></div><div><span>Motif</span><b>Rappel fournisseur${F.ref ? ` · ${esc(F.ref)}` : ""}</b></div><div><span>Recherche</span><b>${esc(F.q || "–")}</b></div><div><span>Responsable</span><b>${esc(F.by || nameOf(S.me.id))}</b></div></div>
    <h3>Produits retirés</h3>${rows.length ? ctT(["Produit", "Fournisseur", "N° de lot", "DLC", "Reçu le", "Quantité", "Emplacement", "Destination"], rows.map((r) => `<tr><td>${esc(r.name)}${r.maison ? "<small>Préparation maison</small>" : ""}</td><td>${esc(r.supplier || "–")}</td><td class="mono">${esc(r.maison || ctLotKey(r.lot) === "MAISON" ? "–" : r.lot || "–")}</td><td class="nw">${r.dlc ? ctFull(r.dlc) : "–"}</td><td class="nw">${r.at ? ctFull(ctDayOf(r.at)) : "–"}</td><td class="nw">${esc(r.qty || "–")}</td><td>${esc(r.fridge || "–")}</td><td>${esc(F.dest === "retour" ? "Retour fournisseur" : F.dest === "destruction" ? "Destruction" : "")}</td></tr>`)) : `<p class="rp-ok">Aucun produit en stock au moment du retrait.</p>`}
    <h3>Livraisons concernées</h3>${(F.recs || []).length ? ctT(["Date", "Fournisseur", "BL", "Produit", "Lot", "Quantité"], F.recs.map((r) => `<tr><td class="nw">${ctFull(ctDayOf(r.at))}</td><td>${esc(r.supplier || "–")}</td><td>${esc(r.bl || "–")}</td><td>${esc(r.name)}</td><td class="mono">${esc(r.lot || "–")}</td><td class="nw">${esc(r.qty || "–")}</td></tr>`)) : `<p class="rp-empty">Aucune livraison enregistrée.</p>`}
    <h3>Utilisation avant le retrait</h3>${(F.recipes || []).length ? `<p>Plats préparés avec ce produit : <b>${F.recipes.map(esc).join(", ")}</b>.</p>` : `<p class="rp-empty">Aucune recette enregistrée n'utilise ce produit.</p>`}
    ${(F.services || []).length ? `<p>Services concernés depuis la livraison : ${F.services.map((s) => `${shortDate(s.day)} (${s.n} vendu${s.n > 1 ? "s" : ""})`).join(", ")}.</p>` : ""}
    <h3>Actions</h3><ul class="ct-chk">${box("Produits isolés et identifiés « NE PAS UTILISER »")}${box(`Produits ${F.dest === "retour" ? "rendus au fournisseur (bon de reprise joint)" : "détruits (attestation jointe)"}`)}${box("Fournisseur informé")}${box("Plats et préparations concernés retirés de la vente")}${box("DDPP informée si un produit dangereux a pu être consommé")}${box("Clients informés si nécessaire (vente à emporter, livraison)")}</ul>
    ${ctDocFoot()}</article>`;
}
function ctFicheData(R, X, extra = {}) {
  return { q: R ? R.q : "", at: Date.now(), by: S.me.name || nameOf(S.me.id), rows: ctRecallRows(X), recipes: X.recipes.map((n) => n.title), services: X.services.slice(0, 30).map((s) => ({ day: s.day, n: s.n })),
    recs: X.G.flatMap((g) => g.recs.map(({ rc, L }) => ({ at: rc.at, supplier: rc.supplier || "", bl: String(rc.bl || "").replace(/^BL[\s:°n.-]*/i, ""), name: L.name, lot: L.lot || "", qty: ctQty(L.qty, L.unit) }))), ...extra };
}
function ctRcResults() {
  const q = S.ui.ctRcQ || ""; const R = ctRecallFind(q);
  if (!R) return ctRcIdle();
  if (!R.groups.length) return `<div class="glass ct-empty st" style="--i:2">${ctWell("search", "vi")}<b>Rien trouvé pour « ${esc(q)} »</b><span>Essayez le numéro de lot tel qu'il est sur l'étiquette, ou une partie du nom.</span></div>`;
  if (S.ui.ctRcSel && !S.ui.ctRcSel.some((k) => R.groups.some((g) => g.k === k))) S.ui.ctRcSel = null;
  const X = ctRecallScope(R); const sel = S.ui.ctRcSel; const canBlock = ctCan("scan") && !CT.insp;
  const chips = R.groups.length > 1 ? `<div class="ct-rcg st" style="--i:2"><button class="chip${!sel ? " on" : ""}" data-act="ctRcSel" data-v="">Tous · ${R.groups.length}</button>${R.groups.map((g) => `<button class="chip${sel && sel.includes(g.k) ? " on" : ""}" data-act="ctRcSel" data-v="${esc(g.k)}">${g.lot ? `Lot ${esc(g.lot)}` : esc(g.names[0])}</button>`).join("")}</div>` : "";
  const n = X.toPull.length;
  const hero = `<div class="ct-rch2 ${n ? "bad" : "ok"} st" style="--i:3"><span class="ct-big">${n}</span><div><b>${n ? `produit${n > 1 ? "s" : ""} à retirer` : "Rien en stock"}</b><em>${X.G.map((g) => `${esc(g.names[0])}${g.lot ? ` · lot ${esc(g.lot)}` : ""}${g.sup.length ? ` · ${esc(g.sup[0])}` : ""}`).slice(0, 3).join("<br>")}</em></div></div>`;
  const pull = n ? `<div class="glass pad st ct-card" style="--i:4"><h3 class="h3">À retirer maintenant</h3><div class="ct-list">${X.toPull.map((l) => `<div class="ct-li"><span class="ct-rcic">${ico("ctBlock")}</span><div class="tx"><b>${esc(l.name)}</b><em>${esc(fridgeName(l.fridgeId))}${l.qty != null ? ` · ${esc(ctQty(l.qty, l.unit))}` : ""}${l.lot && ctLotKey(l.lot) !== "MAISON" ? ` · lot ${esc(l.lot)}` : ""}${l.maison ? " · préparation maison" : ""}</em></div>${dlcPill(dlcOf(l))}</div>`).join("")}</div>
      ${canBlock ? `<button class="btn ct-block block" data-act="ctRcBlock">${ico("ctBlock")}Bloquer ces produits</button>` : ""}</div>` : "";
  const recs = X.G.flatMap((g) => g.recs).sort((a, b) => b.rc.at - a.rc.at);
  const recH = recs.length ? `<div class="glass pad st ct-card" style="--i:5"><h3 class="h3">Livraisons<span class="ct-n">${recs.length}</span></h3><div class="ct-list">${recs.map(({ rc, L }) => `<div class="ct-li"><div class="tx"><b>${esc(L.name)}</b><em>${esc(rc.supplier || "Livraison")}${rc.bl ? ` · BL ${esc(String(rc.bl).replace(/^BL[\s:°n.-]*/i, ""))}` : ""}${L.lot ? ` · lot ${esc(L.lot)}` : ""}${L.qty != null ? ` · ${esc(ctQty(L.qty, L.unit))}` : ""}</em></div><span class="ct-when">${shortDate(ctDayOf(rc.at))}<small>${L.refused ? "refusé" : "reçu"}</small></span></div>`).join("")}</div></div>` : "";
  const gone = X.gone.length ? `<div class="glass pad st ct-card" style="--i:6"><h3 class="h3">Déjà sortis du stock<span class="ct-n">${X.gone.length}</span></h3><div class="ct-list">${X.gone.map((l) => `<div class="ct-li"><div class="tx"><b>${esc(l.name)}</b><em>${l.status === "lost" ? `Jeté${l.lostReason ? ` · ${esc(l.lostReason)}` : ""}` : "Utilisé"}${l.outAt ? ` le ${shortDate(ctDayOf(l.outAt))}` : ""}</em></div></div>`).join("")}</div></div>` : "";
  const rcp = X.recipes.length ? `<div class="glass pad st ct-card" style="--i:7"><h3 class="h3">Plats qui l'utilisent<span class="ct-n">${X.recipes.length}</span></h3><div class="ct-list">${X.recipes.map((r) => `<div class="ct-li tap" data-go="note" data-id="${esc(r.id)}" role="button" tabindex="0"><span class="ct-rcic v">${ico("book")}</span><div class="tx"><b>${esc(r.title)}</b></div>${ico("chev")}</div>`).join("")}</div></div>` : "";
  const sv = X.services.length ? `<div class="glass pad st ct-card" style="--i:8"><h3 class="h3">Services depuis la livraison</h3><div class="ct-svc">${X.services.slice(0, 21).map((s) => `<span><b>${shortDate(s.day)}</b><em>${s.n} vendu${s.n > 1 ? "s" : ""}</em></span>`).join("")}</div><p class="ct-hint">${X.services.reduce((a, s) => a + s.n, 0)} plats servis contenant ce produit, d'après les tickets Z.</p></div>` : "";
  return `${chips}${hero}${pull}${recH}${rcp}${sv}${gone}<button class="btn soft block st" style="--i:9" data-act="ctRcFiche">${ico("printer")}Fiche de retrait</button>`;
}
function ctRcIdle() {
  const seen = new Set(); const recent = [];
  S.receptions.slice().sort((a, b) => b.at - a.at).forEach((rc) => (rc.lines || []).forEach((L) => { const k = ctLotKey(L.lot); if (!k || k === "MAISON" || seen.has(k) || recent.length >= 8) return; seen.add(k); recent.push({ L, rc }); }));
  const hist = S.recalls.length ? `<div class="glass pad st ct-card" style="--i:4"><h3 class="h3">Retraits enregistrés</h3><div class="ct-list">${S.recalls.slice(0, 20).map((r) => `<div class="ct-li tap" data-act="ctRcOld" data-id="${esc(r.id)}" role="button" tabindex="0"><span class="ct-rcic">${ico("ctBlock")}</span><div class="tx"><b>${esc(r.title || r.q || "Rappel")}</b><em>${ctPl((r.rows || []).length, "produit")} · ${esc(r.dest === "retour" ? "rendus" : "détruits")}${r.ref ? ` · ${esc(r.ref)}` : ""}</em></div><span class="ct-when">${shortDate(ctDayOf(r.at))}<small>${esc(firstName(r.by || ""))}</small></span></div>`).join("")}</div></div>` : "";
  return `${recent.length ? `<div class="ct-rcrec st" style="--i:2"><span class="lbl">Lots reçus récemment</span><div class="ct-rcg">${recent.map(({ L, rc }) => `<button class="chip" data-act="ctRcTry" data-v="${esc(L.lot)}"><span class="mono">${esc(L.lot)}</span><em>${esc(L.name)}</em></button>`).join("")}</div></div>` : ""}
    <div class="ct-how st" style="--i:3">${[["search", "Cherchez le lot", "ou le nom du produit"], ["ctBlock", "Bloquez", "tout ce qui est en stock"], ["printer", "Imprimez", "la fiche de retrait"]].map(([ic, a, b], i) => `<div>${ctWell(ic, ["vi", "to", "sk"][i])}<b>${a}</b><em>${b}</em></div>`).join("")}</div>${hist}`;
}
VIEWS.rappel = {
  nav: "rappel",
  render() {
    ctWatch(); const q = S.ui.ctRcQ || "";
    return `<div class="inner narrow ct ct-rc">${topBar("Rappel de lot")}
      ${q ? "" : `<div class="ct-rcwhy st" style="--i:0"><b>À quoi ça sert ?</b><p>Votre fournisseur vous écrit : « les crevettes, lots X, Y et Z, sont rappelées, rupture de la chaîne du froid ». Tapez le numéro de lot ou le produit : l'app retrouve quand vous l'avez reçu, ce qui reste en stock et les étiquettes concernées, vous bloquez tout en un geste et vous imprimez la fiche de retrait pour le contrôle.</p></div>`}
      <label class="ct-search st" style="--i:1">${ico("search")}<input id="ctRcIn" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="N° de lot ou produit" value="${esc(q)}" aria-label="Numéro de lot ou nom du produit">${q ? `<button class="ct-clr" data-act="ctRcClear" aria-label="Effacer">${ico("x")}</button>` : ""}</label>
      <div id="ctRcRes" class="ct-rcres">${ctRcResults()}</div></div>`;
  },
  after(v) {
    const i = $("#ctRcIn", v); if (!i) return;
    const paint = debounce(() => { const r = $("#ctRcRes"); if (!r) return; r.innerHTML = photoFix(ctRcResults()); const lbl = i.parentElement; const has = !!i.value; let c = $(".ct-clr", lbl); if (has && !c) lbl.insertAdjacentHTML("beforeend", `<button class="ct-clr" data-act="ctRcClear" aria-label="Effacer">${ico("x")}</button>`); if (!has && c) c.remove(); }, 160);
    i.addEventListener("input", () => { S.ui.ctRcQ = i.value; S.ui.ctRcSel = null; paint(); });
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } });
  },
};

/* ───────────────────────── sheets ───────────────────────── */
function ctPinSheet(mode) {
  S.ui.ctPin = { mode, v: "" };
  const dots = `<div class="ct-dots" id="ctDots">${[0, 1, 2, 3].map(() => "<i></i>").join("")}</div>`;
  const pad = `<div class="keypad ct-kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="ctPinKey" data-v="${d}">${d}</button>`).join("")}<button data-act="ctPinKey" data-v="c" aria-label="Effacer">${ico("back")}</button><button data-act="ctPinKey" data-v="0">0</button><span></span></div>`;
  if (mode === "set") openSheet(`<div class="ct-sh ct-insh">${ctWell("lock", "ink")}<div class="h2" style="font-size:22px">Mode inspecteur</div><p class="sub">Seul le dossier sanitaire reste visible. Les chiffres, l'équipe et les réglages sont cachés.</p>
    <span class="lbl">Code pour sortir (facultatif)</span>${dots}${pad}
    <div class="grid2"><button class="btn soft" data-act="ctInspGo" data-v="nopin">Sans code</button><button class="btn acc" data-act="ctInspGo" id="ctInspOk" disabled>${ico("lock")}Activer</button></div>
    <p class="ct-hint">Sans code : maintenez « Quitter » 2 secondes pour sortir.</p></div>`);
  else openSheet(`<div class="ct-sh ct-insh">${ctWell("lock", "ink")}<div class="h2" style="font-size:22px">Code de sortie</div><p class="sub">Le code choisi en activant le mode inspecteur.</p>${dots}${pad}</div>`);
}
function ctTrSheet(pid) {
  const P = ctPeople(); const cur = P.find((p) => p.id === pid || p.memberId === pid) || P[0];
  S.ui.ctTr = { who: cur ? cur.id || cur.memberId : "", kind: "haccp", day: dayKey(), provider: "", label: "" };
  const T = S.ui.ctTr;
  openSheet(`<div class="ct-sh"><div class="h2" style="font-size:21px">Noter une formation</div>
    <label class="field"><span>Personne</span><select class="input" id="ctTrWho">${P.map((p) => `<option value="${esc(p.id || p.memberId)}"${(p.id || p.memberId) === T.who ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <div class="field"><span>Formation</span><div class="ct-rcg" id="ctTrK">${Object.entries(CT_TRAIN).map(([k, t]) => `<button class="chip${k === T.kind ? " on" : ""}" data-act="ctTrKind" data-v="${k}">${esc(t.replace(" aux bonnes pratiques", ""))}</button>`).join("")}</div></div>
    <label class="field" id="ctTrLw" hidden><span>Intitulé</span><input class="input" id="ctTrLabel" placeholder="Nom de la formation"></label>
    <div class="grid2"><label class="field"><span>Date</span><input class="input" type="date" id="ctTrDay" max="${dayKey()}" value="${T.day}"></label><label class="field"><span>Organisme</span><input class="input" id="ctTrProv" placeholder="CCI, AFPA…" autocomplete="off"></label></div>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn acc" data-act="ctTrSave">${ico("check")}Enregistrer</button></div></div>`);
}
function ctBlockSheet() {
  const R = ctRecallFind(S.ui.ctRcQ || ""); if (!R) return; const X = ctRecallScope(R); if (!X.toPull.length) return;
  S.ui.ctRcDest = S.ui.ctRcDest || "destruction";
  openSheet(`<div class="ct-sh"><div class="h2" style="font-size:22px">Bloquer ${ctPl(X.toPull.length, "produit")} ?</div>
    <p class="sub">Ils sortent du stock, notés jetés pour « Rappel fournisseur ». Rien n'est effacé du registre.</p>
    <div class="ct-blist">${X.toPull.map((l) => `<span>${esc(l.name)}<em>${esc(fridgeName(l.fridgeId))}</em></span>`).join("")}</div>
    <div class="seg ct-dest" id="ctDest"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${S.ui.ctRcDest === "retour" ? 100 : 0}%)"></span><button class="${S.ui.ctRcDest !== "retour" ? "on" : ""}" data-act="ctRcDest" data-v="destruction">Détruits</button><button class="${S.ui.ctRcDest === "retour" ? "on" : ""}" data-act="ctRcDest" data-v="retour">Rendus au fournisseur</button></div>
    <label class="field"><span>Référence du rappel (facultatif)</span><input class="input" id="ctRcRef" placeholder="Ex. RappelConso n° 2026-11-0123" autocomplete="off"></label>
    <div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn ct-block" data-act="ctRcBlockGo">${ico("ctBlock")}Bloquer</button></div></div>`);
}

/* ───────────────────────── actions ───────────────────────── */
let ctBusy = false;
Object.assign(ACT, {
  ctPer: (a, id, v) => {
    const P = ctPeriod(); S.ui.ctP = { mode: v, from: P.from, to: P.to };
    const seg = a.closest(".ct-seg"); if (seg) { $$("button", seg).forEach((b) => { b.classList.toggle("on", b === a); b.setAttribute("aria-selected", String(b === a)); }); const k = $(".ct-knob", seg); if (k) k.style.transform = `translateX(${CT_PER.findIndex((x) => x[0] === v) * 100}%)`; }
    SFX.tick(); buzz(4); setTimeout(rerender, 200);
  },
  ctInspAsk: () => { SFX.tap(); ctPinSheet("set"); },
  ctInspGo: (a, id, v) => {
    const P = S.ui.ctPin || {}; if (v !== "nopin" && (P.v || "").length !== 4) return;
    CT.insp = true; CT.pin = v === "nopin" ? "" : ctHash(P.v); ctInspSave(); ctInspClass(); S.ui.ctPin = null;
    closeSheet(true); S.history = []; SFX.done(); buzz([10, 40, 10]); if (typeof burst === "function") burst();
    if (S.route !== "controle") go("controle", {}, { replace: true }); else { rerender(); renderChrome(); }
    toast("Mode inspecteur activé");
  },
  ctQuitPin: () => { SFX.tap(); ctPinSheet("exit"); },
  ctPinKey: (a, id, v) => {
    const P = S.ui.ctPin; if (!P) return;
    if (v === "c") P.v = P.v.slice(0, -1); else if (P.v.length < 4) P.v += v;
    SFX.tick(); buzz(3);
    $$("#ctDots i").forEach((d, i) => d.classList.toggle("on", i < P.v.length));
    if (P.mode === "set") { const ok = $("#ctInspOk"); if (ok) ok.disabled = P.v.length !== 4; return; }
    if (P.v.length === 4) {
      if (ctHash(P.v) === CT.pin) { S.ui.ctPin = null; ctInspOff(); return; }
      SFX.err(); buzz([30, 40, 30]); const d = $("#ctDots"); if (d) { d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake"); } setTimeout(() => { P.v = ""; $$("#ctDots i").forEach((x) => x.classList.remove("on")); }, 380);
    }
  },
  ctPrintSec: (a, id, v) => { const P = ctPeriod(); const s = CT_DOC.find((x) => x[0] === v); ctPrint(ctDocHtml(P, v), `${s ? s[1] : "Contrôle"} - ${S.resto?.name || ""} - ${ctPerTx(P)}`); },
  ctPrintAll: () => { const P = ctPeriod(); ctPrint(ctDocHtml(P), `Dossier sanitaire - ${S.resto?.name || ""} - ${ctPerTx(P)}`); },
  ctPmsPrint: () => { const d = ctPmsDoc(); if (!d) return; ctPrint(ctPmsDocHtml(d, true), `Plan de maitrise sanitaire - ${S.resto?.name || ""}`); },
  ctPwStart: () => { if (!ctPmsCanEdit()) { toast("Le PMS se rédige par le gérant.", "err"); return; } const d = ctPmsDoc(); S.ui.ctPw = { i: 0, a: { ...ctPmsDefaults(), ...((d && d.answers) || {}) }, anim: "fwd" }; SFX.tap(); if (S.route !== "pms") go("pms"); else { rerender(); renderChrome(); } },
  ctPwPick: (a, id, v) => {
    const W = S.ui.ctPw; if (!W) return; const q = CT_Q[W.i];
    if (q.kind === "one") W.a[q.k] = v; else { const L = new Set(W.a[q.k] || []); if (L.has(v)) L.delete(v); else L.add(v); if (q.k === "vente" && v !== "place" && !L.size) L.add("place"); W.a[q.k] = [...L]; }
    SFX.tick(); buzz(4); rerender();
    if (q.kind === "one" && !q.x) setTimeout(() => { if (S.ui.ctPw === W && CT_Q[W.i] === q) ACT.ctPwNav(null, null, "1"); }, 260);
  },
  ctPwNav: async (a, id, v) => {
    const W = S.ui.ctPw; if (!W) return; const d = +v;
    if (d > 0 && W.i === CT_Q.length - 1) {
      if (ctBusy) return; ctBusy = true;
      try {
        const old = ctPmsDoc(); const fresh = ctPmsBuild(W.a);
        const sections = fresh.map((s) => { const o = old && old.sections.find((x) => x.id === s.id && x.edited); return o || s; });
        await ctPmsWrite({ kind: "pms", answers: W.a, sections, version: ((old && old.version) || 0) + 1, generatedAt: Date.now(), generatedBy: S.me.name || nameOf(S.me.id) });
        await logEvent("note", "a rédigé le plan de maîtrise sanitaire");
        S.ui.ctPw = null; SFX.done(); buzz([10, 40, 10]); if (typeof burst === "function") burst(); toast("Votre PMS est prêt"); rerender(); renderChrome();
        const vv = $("#viewport .view:not(.leave)"); vv && vv.scrollTo({ top: 0 });
      } catch (e) { console.warn(e); } finally { ctBusy = false; }
      return;
    }
    if (d < 0 && W.i === 0) return;
    W.i = Math.max(0, Math.min(CT_Q.length - 1, W.i + d)); W.anim = d > 0 ? "fwd" : "bwd"; SFX.tap(); rerender();
  },
  ctPmsEdit: (a, id, v) => { if (!ctPmsCanEdit()) return; SFX.tap(); ctPmsEditSheet(+v); },
  ctPmsSave: async (a, id, v) => {
    const d = ctPmsDoc(); const t = $("#ctEdTx"); if (!d || !t) return; const i = +v;
    const sections = d.sections.map((s, k) => (k === i ? { ...s, text: t.value, edited: true } : s));
    a.setAttribute("disabled", ""); await ctPmsWrite({ sections }).catch(() => {}); closeSheet(); SFX.ok(); toast("Section enregistrée"); rerender();
  },
  ctTrAdd: (a, id) => { if (CT.insp || !ctAdmin()) return; SFX.tap(); ctTrSheet(id); },
  ctTrKind: (a, id, v) => { const T = S.ui.ctTr; if (!T) return; T.kind = v; $$("#ctTrK .chip").forEach((b) => b.classList.toggle("on", b === a)); const w = $("#ctTrLw"); if (w) w.hidden = v !== "autre"; SFX.tick(); },
  ctTrSave: async (a) => {
    const T = S.ui.ctTr; if (!T) return; const who = ($("#ctTrWho") || {}).value || T.who; const p = ctPeople().find((x) => (x.id || x.memberId) === who);
    if (!p) { toast("Choisissez une personne.", "err"); return; }
    const label = (($("#ctTrLabel") || {}).value || "").trim(); if (T.kind === "autre" && !label) { toast("Donnez un nom à la formation.", "err"); return; }
    a.setAttribute("disabled", "");
    await safe(DB.add("trainings", { staffId: p.id || "", memberId: p.memberId || "", name: p.name, kind: T.kind, ...(label ? { label } : {}), day: ($("#ctTrDay") || {}).value || dayKey(), provider: (($("#ctTrProv") || {}).value || "").trim(), hours: T.kind === "haccp" ? 14 : null, at: Date.now(), by: S.me.name || nameOf(S.me.id) })).catch(() => {});
    await logEvent("team", `a noté la formation « ${label || CT_TRAIN[T.kind]} » de ${p.name}`);
    S.ui.ctTr = null; closeSheet(); SFX.ok(); toast("Formation enregistrée");
  },
  ctRcTry: (a, id, v) => { S.ui.ctRcQ = v; S.ui.ctRcSel = null; SFX.tick(); rerender(); },
  ctRcClear: () => { S.ui.ctRcQ = ""; S.ui.ctRcSel = null; SFX.close(); rerender(); setTimeout(() => { const i = $("#ctRcIn"); i && i.focus(); }, 60); },
  ctRcSel: (a, id, v) => { S.ui.ctRcSel = v ? [v] : null; SFX.tick(); buzz(4); const r = $("#ctRcRes"); if (r) r.innerHTML = photoFix(ctRcResults()); },
  ctRcBlock: () => { if (!ctCan("scan") || CT.insp) return; SFX.tap(); ctBlockSheet(); },
  ctRcDest: (a, id, v) => { S.ui.ctRcDest = v; const seg = $("#ctDest"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${v === "retour" ? 100 : 0}%)`; } SFX.tick(); },
  ctRcBlockGo: async (a) => {
    if (ctBusy) return; const R = ctRecallFind(S.ui.ctRcQ || ""); if (!R) return; const X = ctRecallScope(R); if (!X.toPull.length) return closeSheet();
    ctBusy = true; a.setAttribute("disabled", "");
    try {
      const now = Date.now(); const ref = (($("#ctRcRef") || {}).value || "").trim(); const dest = S.ui.ctRcDest || "destruction";
      const F = ctFicheData(R, X, { at: now, ref, dest });
      const title = X.G.map((g) => `${g.names[0]}${g.lot ? ` · lot ${g.lot}` : ""}`).slice(0, 2).join(", ");
      const rid = await safe(DB.add("recalls", { ...F, title, uid: S.me.id }));
      for (const l of X.toPull) {
        await DB.update("lots", l.id, { status: "lost", outAt: now, outBy: S.me.id, lostReason: "Rappel fournisseur", recallId: rid || "", recallRef: ref, recallDest: dest }).catch(() => {});
        await DB.add("events", { type: "lost", text: `a jeté ${l.name} · Rappel fournisseur`, at: now, uid: S.me.id, ref: l.id }).catch(() => {});
      }
      await logEvent("lot", `a bloqué ${ctPl(X.toPull.length, "produit")} : rappel fournisseur ${title}${ref ? ` (${ref})` : ""}`, { ref: rid || "" });
      closeSheet(); SFX.done(); buzz([10, 40, 10]); toast(`${ctPl(X.toPull.length, "produit")} bloqué${X.toPull.length > 1 ? "s" : ""}`);
      S.ui.ctRcLast = rid; setTimeout(() => { const f = S.recalls.find((x) => x.id === rid) || { ...F, id: rid }; openSheet(`<div class="ct-sh ct-done">${ctWell("ctBlock", "to")}<div class="h2" style="font-size:22px">Produits bloqués</div><p class="sub">Isolez-les avec la mention « NE PAS UTILISER », puis imprimez la fiche de retrait.</p><button class="btn acc block" data-act="ctRcOld" data-id="${esc(f.id)}">${ico("printer")}Imprimer la fiche de retrait</button><button class="btn ghost block" data-act="sheetClose">Plus tard</button></div>`); }, 380);
    } catch (e) { console.warn(e); } finally { ctBusy = false; }
  },
  ctRcFiche: () => { const R = ctRecallFind(S.ui.ctRcQ || ""); if (!R) return; const X = ctRecallScope(R); ctPrint(ctFicheHtml(ctFicheData(R, X)), `Fiche de retrait - ${S.resto?.name || ""} - ${R.q}`); },
  ctRcOld: (a, id) => { const f = S.recalls.find((x) => x.id === id); if (!f) return; closeSheet(true); ctPrint(ctFicheHtml(f), `Fiche de retrait - ${S.resto?.name || ""} - ${f.q || ""}`); },
});

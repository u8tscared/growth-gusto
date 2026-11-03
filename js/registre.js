/* Growth Gusto — area: registre
   Le registre sanitaire : chronologie de tout ce qui s'est passé (relevés, réceptions, ouvertures, ménage, corrections),
   tableau triable sur ordinateur, rapport A4 imprimable pour un contrôle sanitaire (DDPP), export CSV, purge des photos. */

TAB_OF.regReport = "more";
Object.assign(IC, {
  file: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M8 13h8", "M8 17h5", "f:M6 3h8v4h5v13H5z"],
  sortud: ["m7 15 5 5 5-5", "m7 9 5-5 5 5"],
});

const REG_K = {
  temp: { t: "Températures", s: "Relevé", ic: "therm", c: "#1F7AE0" },
  rec: { t: "Réceptions", s: "Réception", ic: "truck", c: "#E0752F" },
  trace: { t: "Traçabilité", s: "Traçabilité", ic: "box", c: "#4A1FE6" },
  clean: { t: "Ménage", s: "Ménage", ic: "spray", c: "#0B9B6A" },
  other: { t: "Équipe", s: "Équipe", ic: "users", c: "#5A6386" },
};
const REG_F = [["all", "Tout"], ["nc", "Non-conformités"], ["corr", "Corrections"], ["temp", "Températures"], ["rec", "Réceptions"], ["trace", "Traçabilité"], ["clean", "Ménage"]];
const REG_FREQ = { jour: "Chaque jour", semaine: "Chaque semaine", mois: "Chaque mois" };
const REG_PHOTO_DAYS = 183;

const regNum = (v, d = 1) => (v == null || v === "" || isNaN(v) ? "" : fmt(v, d));
const regDay = (ts) => dayKey(new Date(ts));
const regLong = (k, year = true) => { const d = parseDay(k); return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}` : "–"; };
const regFull = (k) => { const d = parseDay(k); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "–"; };
const regDayLabel = (k) => { const t = dayKey(); const y = addDays(t, -1); const same = k.slice(0, 4) === t.slice(0, 4); return k === t ? `Aujourd'hui · ${regLong(k, false)}` : k === y ? `Hier · ${regLong(k, false)}` : regLong(k, !same); };
const regCap = (s) => { s = String(s || "").replace(/^a /, ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const regRange = (f) => (f && f.min != null && f.max != null ? `${fmt(f.min, 0)} à ${fmt(f.max, 0)} °C` : "");
const regPic = (id, url) => (typeof photoUrl === "function" ? (id && photoUrl(id)) || photoUrl(url) : url || "");
const regPhotoStore = () => S.cap.assets || (typeof PHOTOS !== "undefined" ? PHOTOS : null);
/* reception line decision: refused first, then reserve (explicit flag, or a failed check accepted before the flag existed) */
const regLineRes = (L) => !L.refused && (!!L.reserve || L.ok === false);
const regLineSt = (L) => (L.refused ? "bad" : regLineRes(L) ? "warn" : "ok");
const regLineTx = (L) => (L.refused ? "Refusé" : regLineRes(L) ? "Avec réserve" : "Conforme");
const REG_TYPES = { frais: "Frais", ultra: "Ultra-frais", surg: "Surgelé", sec: "Sec" };
const regLineWhy = (L) => (L.refused || regLineRes(L) ? String(L.reason || (typeof L.reserve === "string" ? L.reserve : "") || "").trim() : "");
const regBl = (bl) => String(bl || "").trim().replace(/^BL[\s:°n.-]*(?=\S)/i, "");
const regSlot = (s) => (s === "soir" ? "soir" : "midi");
/* Versions of a corrected reading, oldest first: prev[] snapshots then the current state. Each step i≥1 is one correction. */
function regVersions(r) {
  const prev = Array.isArray(r.prev) ? r.prev.filter(Boolean) : [];
  if (!prev.length) return [];
  return [...prev, { value: r.value, slot: r.slot, ok: r.ok, action: r.action || "", at: r.editedAt || r.at, uid: r.editedBy || r.uid, why: r.editReason || "" }];
}
function regFixes(r) {
  const V = regVersions(r); const out = [];
  for (let i = 1; i < V.length; i++) {
    const a = V[i - 1], b = V[i]; const parts = [];
    if (num(a.value) !== num(b.value)) parts.push(`${regNum(num(a.value))} → ${regNum(num(b.value))} °C`);
    if (regSlot(a.slot || r.slot) !== regSlot(b.slot || r.slot)) parts.push(`${regSlot(a.slot || r.slot)} → ${regSlot(b.slot || r.slot)}`);
    if (!parts.length) parts.push(`${regNum(num(b.value))} °C`);
    out.push({ from: a, to: b, at: b.at || r.editedAt || r.at, uid: b.uid || r.editedBy, why: b.why || "", tx: parts.join(" · "), n: i });
  }
  return out;
}

/* Toutes les entrées du registre, à partir des données structurées (plus fiables que le texte des événements). */
function regEntries() {
  const E = [];
  S.readings.forEach((r) => {
    const f = S.fridges.find((x) => x.id === r.fridgeId); const rg = regRange(f); const fx = regFixes(r); const last = fx[fx.length - 1];
    const slot = regSlot(r.slot); const fixTx = last ? `Corrigé${fx.length > 1 ? ` ${fx.length} fois` : ""} : ${last.tx}, par ${firstName(nameOf(last.uid))} le ${shortDate(regDay(last.at))} à ${hm(last.at)}${last.why ? ` (${last.why})` : ""}` : "";
    const ncTx = r.ok ? "" : `Hors seuil${rg ? ` (${rg})` : ""} · ${r.action ? `Action : ${r.action}` : "action corrective non renseignée"}`;
    E.push({ id: "r" + r.id, at: r.at, kind: "temp", uid: r.uid,
      what: `${fridgeName(r.fridgeId)} · relevé du ${slot}`,
      detail: [r.ok ? (rg ? `Seuil ${rg}` : "") : ncTx, fixTx].filter(Boolean).join(" · "), miss: !r.ok && !r.action,
      val: num(r.value), valTx: `${regNum(num(r.value))} °C`, st: r.ok ? (fx.length ? "warn" : "ok") : "bad", stTx: r.ok ? (fx.length ? "Corrigé" : "Conforme") : "Non conforme", nc: !r.ok, fixed: !!fx.length,
      csv: [[`Relevé ${slot}`, fridgeName(r.fridgeId), regNum(num(r.value)), r.ok ? "oui" : "non", r.ok ? "" : r.action || "Non renseignée", fx.map((x) => `${regFull(regDay(x.at))} ${hm(x.at)} ${nameOf(x.uid)} : ${x.tx}${x.why ? ` (${x.why})` : ""}`).join(" | ")]] });
    fx.forEach((x) => E.push({ id: `f${r.id}-${x.n}`, at: x.at, kind: "temp", uid: x.uid, what: `Correction · ${fridgeName(r.fridgeId)}`,
      detail: `Relevé du ${regSlot(x.from.slot || r.slot)} du ${shortDate(r.day || regDay(r.at))} : ${x.tx}${x.why ? ` · Motif : ${x.why}` : " · Motif non précisé"}`,
      val: num(x.to.value), valTx: `${regNum(num(x.to.value))} °C`, oldTx: x.from.value != null && num(x.from.value) !== num(x.to.value) ? `${regNum(num(x.from.value))} °C` : "", st: "warn", stTx: "Correction", fix: true,
      csv: [["Correction", `${fridgeName(r.fridgeId)} · relevé du ${regSlot(x.from.slot || r.slot)} du ${regFull(r.day || regDay(r.at))} · ${x.tx}`, regNum(num(x.to.value)), x.to.ok === false ? "non" : "oui", x.why || "Motif non précisé", x.tx]] }));
  });
  S.receptions.forEach((rc) => {
    const L = rc.lines || []; const refused = L.filter((x) => x.refused); const res = L.filter(regLineRes);
    const st = refused.length ? "bad" : res.length ? "warn" : "ok";
    E.push({ id: "c" + rc.id, at: rc.at, kind: "rec", uid: rc.uid,
      what: `${rc.supplier || "Livraison"}${regBl(rc.bl) ? ` · BL ${regBl(rc.bl)}` : ""}`,
      detail: L.map((x) => `${x.name}${x.temp != null ? ` ${regNum(x.temp)} °C` : ""}${x.dlc ? ` · DLC ${shortDate(x.dlc)}` : ""}${x.refused ? ` · refusé${regLineWhy(x) ? ` (${regLineWhy(x).toLowerCase()})` : ""}` : regLineRes(x) ? ` · réserve${regLineWhy(x) ? ` (${regLineWhy(x).toLowerCase()})` : ""}` : ""}`).join(" ; ") || "Aucun produit",
      val: L.length, valTx: `${L.length} produit${L.length > 1 ? "s" : ""}`, st,
      stTx: refused.length ? `${refused.length} refusé${refused.length > 1 ? "s" : ""}` : res.length ? `${res.length} réserve${res.length > 1 ? "s" : ""}` : "Conforme",
      nc: st !== "ok", photoUrl: (() => { const x = L.find((y) => y.photoId || y.photoUrl); return x ? regPic(x.photoId, x.photoUrl) : ""; })(),
      csv: L.length ? L.map((x) => ["Réception", `${rc.supplier || ""}${regBl(rc.bl) ? ` · BL ${regBl(rc.bl)}` : ""} · ${x.name} · lot ${x.lot || "-"} · DLC ${x.dlc ? regFull(x.dlc) : "-"}`, regNum(x.temp), x.refused ? "refusé" : regLineRes(x) ? "réserve" : "oui", x.refused ? `Refusé, reparti avec le livreur${regLineWhy(x) ? ` : ${regLineWhy(x)}` : ""}` : regLineRes(x) ? `Accepté avec réserve${regLineWhy(x) ? ` : ${regLineWhy(x)}` : ""}` : "", ""]) : [["Réception", rc.supplier || "", "", "", "", ""]] });
  });
  S.lots.forEach((l) => {
    const lot = l.lot ? ` · lot ${l.lot}` : "";
    if (!l.receptionId && l.createdAt) E.push({ id: "n" + l.id, at: l.createdAt, kind: "trace", uid: l.uid, what: `Entrée · ${l.name}`, detail: `${fridgeName(l.fridgeId)}${lot}${l.dlc ? ` · DLC ${shortDate(l.dlc)}` : ""}`, valTx: "", st: null, stTx: "", csv: [["Entrée", `${l.name}${lot}`, "", "", "", ""]] });
    if (l.openedAt) E.push({ id: "o" + l.id, at: l.openedAt, kind: "trace", uid: l.openedBy, what: `Ouverture · ${l.name}`, detail: `À consommer avant le ${l.dlcOpen ? shortDate(l.dlcOpen) : "–"}${lot}${l.supplier ? ` · ${l.supplier}` : ""}`, valTx: "", st: "acc", stTx: "Ouvert", photoUrl: regPic(l.openPhotoId, l.openPhotoUrl), csv: [["Ouverture", `${l.name}${lot} · DLC ouverte ${l.dlcOpen ? regFull(l.dlcOpen) : "-"}`, "", "", "", ""]] });
    if (l.outAt) { const lost = l.status === "lost"; E.push({ id: "x" + l.id, at: l.outAt, kind: "trace", uid: l.outBy, what: `${lost ? "Jeté" : "Sortie"} · ${l.name}`, detail: `${lost && l.lostReason ? `${l.lostReason} · ` : ""}${fridgeName(l.fridgeId)}${lot}${l.qty ? ` · ${l.qty} ${l.unit || ""}` : ""}`, valTx: "", st: lost ? "bad" : "neu", stTx: lost ? "Jeté" : "Sorti", nc: lost, csv: [[lost ? "Perte" : "Sortie", `${l.name}${lot}`, "", lost ? "non" : "", lost ? `Produit jeté${l.lostReason ? ` : ${l.lostReason}` : ""}` : "", ""]] }); }
  });
  S.choreLogs.forEach((g) => {
    const c = S.chores.find((x) => x.id === g.choreId);
    E.push({ id: "m" + g.id, at: g.at, kind: "clean", uid: g.uid, what: c ? c.name : "Tâche supprimée", detail: c ? `${c.zone || ""}${c.zone ? " · " : ""}${REG_FREQ[c.freq] || ""}` : "", valTx: "", st: "ok", stTx: "Fait", csv: [["Ménage", `${c ? c.name : "Tâche supprimée"}${c?.zone ? ` · ${c.zone}` : ""}`, "", "oui", "", ""]] });
  });
  const skip = { reception: 1, open: 1, out: 1, lost: 1, chore: 1 };
  S.events.forEach((e) => {
    const text = String(e.text || "");
    /* an undone action is never hidden: the original entry stays, struck through, with who cancelled it and when */
    if (e.cancelled) {
      const kind = e.type === "reading" || e.type === "fridge" ? "temp" : e.type === "chore" ? "clean" : e.type === "reception" ? "rec" : e.type === "note" || e.type === "ticket" || e.type === "team" ? "other" : "trace";
      E.push({ id: "e" + e.id, at: e.at, kind, uid: e.uid, what: (() => { const L = { open: "Ouverture", out: "Sortie", lost: "Jeté" }[e.type]; const l = L && S.lots.find((x) => x.id === e.ref); return l ? `${L} · ${l.name}` : `${firstName(nameOf(e.uid)) || "Quelqu'un"} ${text}`; })(), cx: true,
        detail: `Annulé${e.cancelledBy ? ` par ${firstName(nameOf(e.cancelledBy))}` : ""}${e.cancelledAt ? ` le ${shortDate(regDay(e.cancelledAt))} à ${hm(e.cancelledAt)}` : ""}`,
        valTx: "", st: "neu", stTx: "Annulé", fix: true, csv: [["Annulé", regCap(text), "", "", "", `Annulé${e.cancelledBy ? ` par ${nameOf(e.cancelledBy)}` : ""}${e.cancelledAt ? ` le ${regFull(regDay(e.cancelledAt))} à ${hm(e.cancelledAt)}` : ""}`]] });
      return;
    }
    if (e.undoOf != null && e.undoOf !== false) {
      E.push({ id: "e" + e.id, at: e.at, kind: e.type === "reading" ? "temp" : "trace", uid: e.uid, what: regCap(text.replace(/^a annulé/, "annulation :")), detail: "L'entrée d'origine reste barrée dans le registre.", valTx: "", st: "warn", stTx: "Annulation", fix: true, csv: [["Annulation", regCap(text), "", "", "", ""]] });
      return;
    }
    if (skip[e.type]) return;
    let kind = e.type === "lot" ? "trace" : e.type === "fridge" ? "temp" : "other"; let fix = false;
    if (e.type === "reading") {
      /* new readings and corrections are read from the readings themselves; deletions, cancellations and restorations only exist as events */
      if (!/^a (supprimé|annulé|restauré)/.test(text)) return;
      kind = "temp"; fix = true;
    }
    const who = firstName(nameOf(e.uid)) || "Quelqu'un";
    E.push({ id: "e" + e.id, at: e.at, kind, uid: e.uid, what: fix ? regCap(text.replace(/^a supprimé/, "suppression :").replace(/^a annulé/, "annulation :").replace(/^a restauré/, "restauration :")) : `${who} ${text}`, detail: "", valTx: "", st: fix ? "warn" : null, stTx: fix ? "Correction" : "", fix, photoUrl: regPic(e.photoId, e.photoUrl),
      csv: [[fix ? "Correction" : REG_K[kind].s, regCap(text), "", "", "", ""]] });
  });
  E.forEach((x) => { x.day = regDay(x.at); x.who = nameOf(x.uid); x.hay = `${x.what} ${x.detail} ${x.valTx} ${x.stTx} ${x.who} ${REG_K[x.kind].t}`.toLowerCase(); });
  return E.filter((x) => x.at).sort((a, b) => b.at - a.at);
}

function regFiltered(all) {
  return regMatch(all, S.regFilter || "all");
}
const regIs = (x, f) => (f === "all" ? true : f === "nc" ? x.nc : f === "corr" ? x.fix || x.fixed : x.kind === f);
function regMatch(all, f) {
  const q = (S.ui.regQ || "").trim().toLowerCase(); const W = q ? q.split(/\s+/) : [];
  return all.filter((x) => regIs(x, f) && W.every((w) => x.hay.includes(w)));
}

const regPill = (x) => (x.st ? `<span class="pill ${x.st}">${x.st === "bad" ? `<span class="dot"></span>` : x.fix || x.fixed ? ico("edit") : ""}${esc(x.stTx)}</span>` : "");
const regKic = (k) => `<span class="rg-k" style="--k:${REG_K[k].c}">${ico(REG_K[k].ic)}</span>`;
const regRowCls = (x) => (x.nc ? "nc" : x.fix || x.fixed ? "fx" : "") + (x.cx ? " cx" : "");
const regThumb = (x) => (x.photoUrl ? `<a class="thumb" href="${esc(x.photoUrl)}" target="_blank" rel="noopener" aria-label="Voir la photo"><img src="${esc(x.photoUrl)}" alt="" loading="lazy"></a>` : "");
const regVal = (x) => (x.kind === "temp" && x.valTx ? `${x.oldTx ? `<s class="mono">${esc(x.oldTx)}</s>` : ""}<b class="mono ${x.st === "bad" ? "bad" : ""}">${esc(x.valTx)}</b>` : "");
const regDetail = (x) => (x.detail ? `<em${x.miss ? ` class="miss"` : ""}>${esc(x.detail)}</em>` : "");

function regListHtml(all) {
  const rows = regFiltered(all);
  if (!all.length) return `<div class="glass empty"><div class="ic">${ico("shield")}</div><b>Le registre est vide</b>Il se remplit tout seul : chaque relevé, réception, ouverture ou tâche de ménage y est noté avec la date, l'heure et la personne.</div>`;
  if (!rows.length) return `<div class="glass empty"><div class="ic">${ico("search")}</div><b>Aucun résultat</b>${S.ui.regQ ? `Rien ne correspond à « ${esc(S.ui.regQ)} »${(S.regFilter || "all") !== "all" ? " dans cette catégorie" : ""}.` : "Rien dans cette catégorie pour l'instant."}${S.ui.regQ || (S.regFilter || "all") !== "all" ? `<div style="margin-top:14px"><button class="btn soft" data-act="regReset">Tout afficher</button></div>` : ""}</div>`;
  const N = S.ui.regN || 80;
  /* phone / tablet: timeline grouped by day; each day is its own section so its sticky header scrolls away with it */
  const perDay = {}; rows.forEach((x) => (perDay[x.day] = (perDay[x.day] || 0) + 1));
  let tl = ""; let cur = null;
  rows.slice(0, N).forEach((x) => {
    if (x.day !== cur) { if (cur) tl += `</div></section>`; cur = x.day; tl += `<section class="rg-day"><div class="rg-dh"><span>${esc(regDayLabel(x.day))}</span><em>${perDay[x.day]}</em></div><div class="glass rg-grp">`; }
    const v = regVal(x); const pill = x.kind === "temp" && x.st === "ok" ? "" : regPill(x);
    tl += `<div class="rg-it ${regRowCls(x)}">${regKic(x.kind)}<div class="tx"><b>${esc(x.what)}</b>${regDetail(x)}<span class="rg-who">${avatar(x.uid, true)}${esc(firstName(x.who) || x.who)} · <span class="mono">${hm(x.at)}</span></span></div>${v || pill || x.photoUrl ? `<div class="rg-v">${v}${pill}${regThumb(x)}</div>` : ""}</div>`;
  });
  if (cur) tl += `</div></section>`;
  /* desktop: sortable table */
  const so = S.ui.regSort || { k: "at", d: -1 };
  const key = { at: (x) => x.at, kind: (x) => REG_K[x.kind].t, what: (x) => x.what.toLowerCase(), val: (x) => (x.kind === "temp" && x.val != null ? x.val : null), st: (x) => ({ bad: 0, warn: 1, acc: 2, neu: 3, ok: 4 }[x.st] ?? 5), who: (x) => x.who.toLowerCase() }[so.k] || ((x) => x.at);
  /* entries without a value always go last, whatever the direction */
  const sorted = rows.slice().sort((a, b) => { const A = key(a), B = key(b); if (A == null || B == null) return A == null && B == null ? b.at - a.at : A == null ? 1 : -1; return A > B ? so.d : A < B ? -so.d : b.at - a.at; }).slice(0, N);
  const th = (k, t, cls = "") => `<th class="${cls}" aria-sort="${so.k === k ? (so.d > 0 ? "ascending" : "descending") : "none"}"><button data-act="regSort" data-v="${k}" class="${so.k === k ? "on" : ""}">${t}${so.k === k ? ico("down", so.d > 0 ? "up" : "") : ico("sortud", "dim")}</button></th>`;
  let tb = ""; let d0 = null;
  sorted.forEach((x) => {
    if (so.k === "at" && x.day !== d0) { d0 = x.day; tb += `<tr class="rg-tday"><td colspan="7"><span>${esc(regDayLabel(x.day))}</span><em>${perDay[x.day]}</em></td></tr>`; }
    tb += `<tr class="${regRowCls(x)}"><td class="mono nw">${so.k === "at" ? "" : `${shortDate(x.day)} `}${hm(x.at)}</td><td class="nw"><span class="rg-tk">${regKic(x.kind)}${REG_K[x.kind].s}</span></td><td class="rg-what"><b>${esc(x.what)}</b>${regDetail(x)}</td><td class="nw r rg-tv">${x.kind === "temp" ? regVal(x) : x.kind === "rec" ? `<span class="mono">${esc(x.valTx)}</span>` : ""}</td><td class="nw">${regPill(x)}</td><td class="nw"><span class="rg-who">${avatar(x.uid, true)}${esc(x.who)}</span></td><td class="nw ph">${regThumb(x)}</td></tr>`;
  });
  const more = rows.length > N ? `<button class="btn soft block rg-more" data-act="regMore">Afficher plus · encore ${rows.length - N}</button>` : "";
  return `<div class="rg-tl">${tl}</div><div class="glass rg-tw"><table class="rg-tbl"><thead><tr>${th("at", "Date")}${th("kind", "Type")}${th("what", "Détail")}${th("val", "Valeur", "r")}${th("st", "Statut")}${th("who", "Par")}<th aria-label="Photo"></th></tr></thead><tbody>${tb}</tbody></table></div>${more}`;
}

function regChips(all) { const f = S.regFilter || "all"; return REG_F.map(([k, t]) => `<button class="chip ${f === k ? "on" : ""}${k === "nc" ? " ncchip" : k === "corr" ? " fxchip" : ""}" data-act="regF" data-v="${k}" aria-pressed="${f === k}">${t}<span class="rg-n">${regMatch(all, k).length}</span></button>`).join(""); }
function regCountTx(all) { const n = regFiltered(all).length; return `${n} entrée${n > 1 ? "s" : ""}`; }
function regPaint() { const all = regEntries(); const el = $("#regList"); if (el) el.innerHTML = regListHtml(all); const c = $("#regCount"); if (c) c.textContent = regCountTx(all); const ch = $("#regChips"); if (ch) ch.innerHTML = regChips(all); }

VIEWS.registre = {
  render() {
    const all = regEntries(); const f = S.regFilter || "all";
    const exp = Math.max(1, S.fridges.length * 2);
    const cells = Array.from({ length: 30 }, (_, i) => { const k = addDays(dayKey(), i - 29); const rs = readingsFor(k); const n = new Set(rs.map((r) => r.fridgeId + r.slot)).size; const bad = rs.some((r) => !r.ok); const cls = !n ? "" : bad ? "r" : n >= exp ? "g" : "y"; return `<i class="${cls}" title="${shortDate(k)} · ${n}/${exp} relevés${bad ? " · hors seuil" : ""}"></i>`; }).join("");
    const rs30 = S.readings.filter((r) => daysUntil(r.day) >= -29);
    const conf = rs30.length ? Math.round((rs30.filter((r) => r.ok).length / rs30.length) * 1000) / 10 : null;
    const nc30 = all.filter((x) => x.nc && daysUntil(x.day) >= -29).length;
    return `<div class="inner rg">${topBar("Registre HACCP", { right: `<button class="btn soft sm" data-go="regReport">${ico("printer")}Rapport</button>` })}
      <div class="rg-top">
        <div class="glass pad st rg-heat" style="--i:1"><div class="row"><span class="lbl">Températures · 30 jours</span><span class="pill ${conf == null ? "neu" : conf >= 98 ? "ok" : conf >= 90 ? "warn" : "bad"}">${conf != null ? `${fmt(conf, 1)} % conformes` : "aucun relevé"}</span></div><div class="heat" style="margin-top:12px">${cells}</div><div class="rg-leg"><span><i class="g"></i>complet</span><span><i class="y"></i>incomplet</span><span><i class="r"></i>hors seuil</span><span class="rg-corr${nc30 ? " on" : ""}">${nc30 ? `${nc30} non-conformité${nc30 > 1 ? "s" : ""} en 30 j` : "Aucune non-conformité en 30 j"}</span></div></div>
        <button class="glass pad st rg-cta" style="--i:2" data-go="regReport"><span class="ic">${ico("file")}</span><span class="tx"><b>Rapport pour contrôle sanitaire</b><em>Températures, réceptions, traçabilité et ménage. À imprimer ou à exporter.</em></span>${ico("chev")}</button>
      </div>
      <div class="rg-bar st" style="--i:3"><label class="rg-q">${ico("search")}<input class="input" id="regQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Produit, frigo, personne…" value="${esc(S.ui.regQ || "")}" aria-label="Rechercher dans le registre"></label>
        <div class="chips" id="regChips">${regChips(all)}</div></div>
      <div class="rg-meta st" style="--i:4"><span class="sub" id="regCount">${regCountTx(all)}</span><span class="sub">Rien ne peut être effacé du registre</span></div>
      <div id="regList" class="st" style="--i:5">${regListHtml(all)}</div>
      <div class="glass pad st rg-photo" style="--i:6"><span class="ic">${ico("image")}</span><div class="tx"><b>Photos d'étiquettes et de livraisons</b><em>Les photos de plus de 6 mois sont supprimées. Les relevés et les traces écrites restent dans le registre.</em></div><button class="btn soft sm" data-act="purge">${ico("trash")}Vérifier</button></div>
    </div>`;
  },
  after(v) {
    const q = $("#regQ", v);
    if (q) q.addEventListener("input", debounce(() => { S.ui.regQ = q.value; S.ui.regN = 80; regPaint(); }, 120));
    regAutoPurge();
  },
};

/* ───────── rapport pour contrôle sanitaire ───────── */
function regPeriod() {
  const t = dayKey(); const P = (S.ui.regP ||= { mode: "30", from: addDays(t, -29), to: t });
  if (P.mode === "7") return { from: addDays(t, -6), to: t, mode: "7" };
  if (P.mode === "30") return { from: addDays(t, -29), to: t, mode: "30" };
  let from = P.from || addDays(t, -29), to = P.to || t; if (from > to) [from, to] = [to, from];
  if (regDaysOf({ from, to }).length > 366) from = addDays(to, -365);
  return { from, to, mode: "custom" };
}
const regIn = (ts, P) => { if (!ts) return false; const k = regDay(ts); return k >= P.from && k <= P.to; };
function regDaysOf(P) { const out = []; let k = P.from; let g = 0; while (k <= P.to && g++ < 400) { out.push(k); k = addDays(k, 1); } return out; }

/* First day the register was kept: days before it are not counted as missing records. */
function regStartDay() {
  const ts = [S.resto?.createdAt, ...S.readings.map((r) => r.at), ...S.receptions.map((r) => r.at), ...S.choreLogs.map((g) => g.at), ...S.lots.map((l) => l.createdAt)].filter(Boolean);
  return ts.length ? regDay(Math.min(...ts)) : dayKey();
}
function regReportData(P) {
  const start = regStartDay(); const eff = { from: P.from < start ? start : P.from, to: P.to };
  const days = eff.from <= eff.to ? regDaysOf(eff) : [];
  const fridges = S.fridges.slice();
  const rd = S.readings.filter((r) => r.day >= P.from && r.day <= P.to);
  /* today's evening reading is not due before the evening service */
  const today = dayKey(); const due = (d, slot) => d < today || (d === today && (slot === "midi" || slotNow() === "soir"));
  const exp = days.reduce((n, d) => n + fridges.length * ["midi", "soir"].filter((sl) => due(d, sl)).length, 0);
  const done = new Set(rd.filter((r) => fridges.some((f) => f.id === r.fridgeId) && days.includes(r.day) && due(r.day, regSlot(r.slot))).map((r) => r.day + r.fridgeId + regSlot(r.slot))).size;
  const fixes = rd.flatMap((r) => regFixes(r).map((x) => ({ r, ...x })))
    .concat(S.events.filter((e) => e.type === "reading" && /^a (supprimé|annulé|restauré)/.test(e.text || "") && regIn(e.at, P)).map((e) => ({ ev: e, at: e.at, uid: e.uid })))
    .sort((a, b) => a.at - b.at);
  const bad = rd.filter((r) => !r.ok).sort((a, b) => a.at - b.at);
  const recs = S.receptions.filter((rc) => regIn(rc.at, P)).sort((a, b) => a.at - b.at);
  const lines = recs.flatMap((rc) => (rc.lines || []).map((L) => ({ rc, L })));
  const opened = S.lots.filter((l) => regIn(l.openedAt, P) || (l.status === "lost" && regIn(l.outAt, P))).sort((a, b) => (a.openedAt || a.outAt) - (b.openedAt || b.outAt));
  const cancelled = S.events.filter((e) => e.cancelled && (e.type === "open" || e.type === "out" || e.type === "lost") && regIn(e.at, P)).sort((a, b) => a.at - b.at);
  const logs = S.choreLogs.filter((g) => (g.day ? g.day >= P.from && g.day <= P.to : regIn(g.at, P)));
  const bucket = (g, len) => Math.floor((parseDay(g.day || regDay(g.at)) - parseDay(eff.from)) / (len * 864e5));
  const chores = S.chores.map((c) => {
    const L = logs.filter((g) => g.choreId === c.id); const n = Math.max(1, days.length);
    const len = c.freq === "semaine" ? 7 : c.freq === "mois" ? 30 : 1;
    const expN = Math.max(1, Math.ceil(n / len)); const doneN = Math.min(expN, new Set(L.map((g) => bucket(g, len))).size);
    const last = L.reduce((m, g) => Math.max(m, g.at || 0), 0);
    return { c, expN, doneN, rate: Math.round((doneN / expN) * 100), last, who: [...new Set(L.map((g) => firstName(nameOf(g.uid))))].join(", ") };
  });
  const cExp = chores.reduce((s, x) => s + x.expN, 0), cDone = chores.reduce((s, x) => s + x.doneN, 0);
  return { days, start: eff.from, clipped: eff.from > P.from, fridges, rd, exp, done, bad, fixes, due, cancelled, recs, lines, opened, chores, cRate: cExp ? Math.round((cDone / cExp) * 100) : null,
    conf: rd.length ? Math.round((rd.filter((r) => r.ok).length / rd.length) * 1000) / 10 : null,
    refused: lines.filter((x) => x.L.refused).length, reserves: lines.filter((x) => regLineRes(x.L)).length };
}

function regReportHtml(P) {
  const D = regReportData(P); const now = Date.now();
  const cell = (day, f, slot) => {
    const rs = D.rd.filter((r) => r.day === day && r.fridgeId === f.id && regSlot(r.slot) === slot).sort((a, b) => a.at - b.at);
    if (!rs.length) return D.due(day, slot) ? `<td class="miss">—</td>` : `<td class="todo">à venir</td>`;
    return `<td>${rs.map((r) => `<span class="${r.ok ? "" : "nc"}">${regNum(num(r.value))}${r.ok ? "" : "*"}${regVersions(r).length ? `<sup>c</sup>` : ""}</span>`).join(" / ")}<i>${rs.map((r) => esc(initials(nameOf(r.uid)))).join(" ")}</i></td>`;
  };
  const kpi = (lbl, v, sub, cls = "") => `<div class="rp-kpi ${cls}"><span>${lbl}</span><b>${v}</b><em>${sub}</em></div>`;
  const tempTable = D.fridges.length ? `<div class="rp-sc"><table class="rp-t rp-temps"><thead><tr><th rowspan="2">Date</th>${D.fridges.map((f) => `<th colspan="2">${esc(f.name)}<small>${esc(regRange(f))}</small></th>`).join("")}</tr><tr>${D.fridges.map(() => `<th>Midi</th><th>Soir</th>`).join("")}</tr></thead><tbody>${D.days.map((d) => `<tr><td class="nw">${esc(DAYS[parseDay(d).getDay()].slice(0, 3))}. ${shortDate(d)}</td>${D.fridges.map((f) => cell(d, f, "midi") + cell(d, f, "soir")).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="rp-empty">Aucune enceinte froide déclarée.</p>`;
  const ncTable = D.bad.length ? `<div class="rp-sc"><table class="rp-t"><thead><tr><th>Date</th><th>Heure</th><th>Enceinte</th><th class="r">Relevé</th><th>Seuil</th><th>Action corrective</th><th>Par</th></tr></thead><tbody>${D.bad.map((r) => `<tr><td class="nw">${regFull(r.day)}</td><td class="nw">${hm(r.at)}</td><td>${esc(fridgeName(r.fridgeId))}</td><td class="r nc nw">${regNum(num(r.value))} °C</td><td class="nw">${esc(regRange(S.fridges.find((f) => f.id === r.fridgeId)))}</td><td>${esc(r.action || "Non renseignée")}</td><td>${esc(nameOf(r.uid))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="rp-ok">Aucune non-conformité de température sur la période.</p>`;
  const fixTable = D.fixes.length ? `<div class="rp-sc"><table class="rp-t"><thead><tr><th>Relevé concerné</th><th>Enceinte</th><th class="r">Avant</th><th class="r">Après</th><th>Corrigé le</th><th>Par</th><th>Motif</th></tr></thead><tbody>${D.fixes.map((x) => x.ev
    ? `<tr><td colspan="4">${esc(regCap(String(x.ev.text).replace(/^a /, "")))}</td><td class="nw">${regFull(regDay(x.at))} ${hm(x.at)}</td><td>${esc(nameOf(x.uid))}</td><td>–</td></tr>`
    : `<tr><td class="nw">${shortDate(x.r.day || regDay(x.r.at))} ${regSlot(x.from.slot || x.r.slot)}${regSlot(x.from.slot || x.r.slot) !== regSlot(x.to.slot || x.r.slot) ? ` → ${regSlot(x.to.slot)}` : ""}<small>relevé à ${hm(x.from.at || x.r.at)} par ${esc(firstName(nameOf(x.from.uid || x.r.uid)))}</small></td><td>${esc(fridgeName(x.r.fridgeId))}</td><td class="r nw"><s>${regNum(num(x.from.value))} °C</s></td><td class="r nw ${x.to.ok === false ? "nc" : ""}">${regNum(num(x.to.value))} °C</td><td class="nw">${regFull(regDay(x.at))} ${hm(x.at)}</td><td>${esc(nameOf(x.uid))}</td><td>${esc(x.why || "Non précisé")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="rp-ok">Aucune correction de relevé sur la période.</p>`;
  const recTable = D.lines.length ? `<div class="rp-sc"><table class="rp-t"><thead><tr><th>Date</th><th>Fournisseur</th><th>Produit</th><th>Lot</th><th>DLC</th><th class="r">T° reçue</th><th>Décision</th><th>Par</th></tr></thead>${D.lines.map(({ rc, L }, i) => { const first = i === 0 || D.lines[i - 1].rc !== rc; return `${first ? `${i ? "</tbody>" : ""}<tbody class="rp-grp">` : ""}<tr class="${L.refused ? "row-nc" : ""}${first ? " rp-g" : " rp-cont"}">${first ? `<td class="nw">${shortDate(regDay(rc.at))} ${hm(rc.at)}</td><td>${esc(rc.supplier || "–")}${regBl(rc.bl) ? `<small>BL ${esc(regBl(rc.bl))}</small>` : ""}</td>` : `<td></td><td></td>`}<td>${esc(L.name)}${L.qty ? `<small>${esc(L.qty)} ${esc(L.unit || "")}</small>` : ""}${L.type && REG_TYPES[L.type] ? `<small>${REG_TYPES[L.type]}</small>` : ""}${L.sanitary ? `<small class="nw">Estampille ${esc(L.sanitary)}</small>` : ""}${L.peche ? `<small>Pêche ${esc(L.peche)}</small>` : ""}</td><td class="mono">${esc(L.lot || "–")}</td><td class="nw">${L.dlc ? regFull(L.dlc) : "–"}</td><td class="r nw ${L.temp != null && L.tmax != null && L.temp > L.tmax ? "nc" : ""}">${L.temp != null ? `${regNum(L.temp)} °C` : "–"}${L.tmax != null ? `<small>max ${regNum(L.tmax, 0)} °C</small>` : ""}</td><td><span class="rp-st ${regLineSt(L)}">${regLineTx(L)}</span>${regLineWhy(L) ? `<small>${esc(regLineWhy(L))}</small>` : ""}</td><td>${first ? esc(firstName(nameOf(rc.uid))) : ""}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="rp-empty">Aucune réception sur la période.</p>`;
  const cxRows = D.cancelled.map((e) => { const l = S.lots.find((x) => x.id === e.ref); return `<tr class="row-cx"><td>${esc(l ? l.name : "–")}</td><td><span class="mono">${esc(l?.lot || "–")}</span></td><td colspan="4"><s>${esc(regCap(String(e.text || "").replace(/^a /, "")))} · ${shortDate(regDay(e.at))} ${hm(e.at)} · ${esc(firstName(nameOf(e.uid)))}</s><small>Annulé${e.cancelledBy ? ` par ${esc(firstName(nameOf(e.cancelledBy)))}` : ""}${e.cancelledAt ? ` le ${shortDate(regDay(e.cancelledAt))} à ${hm(e.cancelledAt)}` : ""}</small></td><td class="nw"><span class="rp-st neu">Annulé</span></td></tr>`; }).join("");
  const tLot = D.opened.length || D.cancelled.length ? `<div class="rp-sc"><table class="rp-t"><thead><tr><th>Produit</th><th>Lot · fournisseur</th><th>Reçu le</th><th>Ouvert le</th><th>À consommer avant</th><th>Sortie</th><th>Statut</th></tr></thead><tbody>${D.opened.map((l) => { const over = l.status === "opened" && l.dlcOpen && daysUntil(l.dlcOpen) < 0; const st = l.status === "lost" ? ["bad", "Jeté"] : l.status === "out" ? ["ok", "Utilisé"] : over ? ["bad", "DLC dépassée"] : ["acc", "En cours"]; return `<tr class="${st[0] === "bad" ? "row-nc" : ""}"><td>${esc(l.name)}</td><td><span class="mono">${esc(l.lot || "–")}</span>${l.supplier ? `<small>${esc(l.supplier)}</small>` : ""}</td><td class="nw">${l.createdAt ? shortDate(regDay(l.createdAt)) : "–"}</td><td class="nw">${l.openedAt ? `${shortDate(regDay(l.openedAt))} ${hm(l.openedAt)}<small>${esc(firstName(nameOf(l.openedBy)))}</small>` : "–"}</td><td class="nw">${l.dlcOpen ? regFull(l.dlcOpen) : l.dlc ? regFull(l.dlc) : "–"}</td><td class="nw">${l.outAt ? `${shortDate(regDay(l.outAt))} ${hm(l.outAt)}<small>${esc(firstName(nameOf(l.outBy)))}</small>` : "–"}</td><td class="nw"><span class="rp-st ${st[0]}">${st[1]}</span>${l.status === "lost" && l.lostReason ? `<small>${esc(l.lostReason)}</small>` : ""}</td></tr>`; }).join("")}${cxRows}</tbody></table></div>` : `<p class="rp-empty">Aucun produit ouvert ou jeté sur la période.</p>`;
  const tClean = D.chores.length ? `<div class="rp-sc"><table class="rp-t"><thead><tr><th>Tâche</th><th>Zone</th><th>Fréquence</th><th class="r">Réalisé</th><th class="r">Taux</th><th>Dernière fois</th><th>Par</th></tr></thead><tbody>${D.chores.map((x) => `<tr class="${x.rate < 80 ? "row-nc" : ""}"><td>${esc(x.c.name)}</td><td>${esc(x.c.zone || "–")}</td><td class="nw">${REG_FREQ[x.c.freq] || "–"}</td><td class="r nw">${x.doneN} / ${x.expN}</td><td class="r nw"><span class="rp-st ${x.rate >= 95 ? "ok" : x.rate >= 80 ? "warn" : "bad"}">${x.rate} %</span></td><td class="nw">${x.last ? `${shortDate(regDay(x.last))} ${hm(x.last)}` : "Jamais"}</td><td>${esc(x.who || "–")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="rp-empty">Aucun plan de nettoyage déclaré.</p>`;
  return `<article class="rp-paper" id="rpPaper">
    <header class="rp-head"><div class="rp-brand"><span class="rp-mk">${logoMark()}</span><div><b>${esc(S.resto?.name || "Restaurant")}</b><em>Registre sanitaire · plan de maîtrise sanitaire (HACCP)</em></div></div>
      <div class="rp-per"><span>Période contrôlée</span><b>du ${regFull(P.from)} au ${regFull(P.to)}</b><em>${D.clipped ? `registre tenu depuis le ${regFull(D.start)}` : `${D.days.length} jour${D.days.length > 1 ? "s" : ""}`}</em></div></header>
    <h1>Rapport pour contrôle sanitaire</h1>
    <div class="rp-kpis">${kpi("Relevés de température", `${D.done} / ${D.exp}`, D.exp ? `${Math.round((D.done / D.exp) * 100)} % des relevés attendus` : "–", D.exp && D.done < D.exp ? "warn" : "")}${kpi("Conformité températures", D.conf != null ? `${fmt(D.conf, 1)} %` : "–", `${D.bad.length} hors seuil · ${D.fixes.length} correction${D.fixes.length > 1 ? "s" : ""}`, D.bad.length ? "bad" : "")}${kpi("Réceptions", `${D.recs.length}`, `${D.lines.length} produit${D.lines.length > 1 ? "s" : ""} · ${D.refused} refus · ${D.reserves} réserve${D.reserves > 1 ? "s" : ""}`, D.refused ? "warn" : "")}${kpi("Plan de nettoyage", D.cRate != null ? `${D.cRate} %` : "–", "des tâches prévues réalisées", D.cRate != null && D.cRate < 80 ? "warn" : "")}</div>
    <section><h2><span>1</span>Températures des enceintes froides</h2><p class="rp-note">Deux relevés par jour et par enceinte (midi et soir), en °C. * hors seuil · <sup>c</sup> valeur corrigée (détail plus bas) · « — » relevé manquant. Initiales : personne ayant relevé.${D.clipped ? ` Registre tenu dans l'application depuis le ${regFull(D.start)}.` : ""}</p>${tempTable}
      <h3>Non-conformités et actions correctives</h3>${ncTable}
      <h3>Corrections de relevés</h3><p class="rp-note">Un relevé corrigé n'est jamais effacé : la valeur d'origine, l'auteur, la date et le motif de chaque correction sont conservés.</p>${fixTable}</section>
    <section><h2><span>2</span>Réceptions des marchandises</h2><p class="rp-note">Contrôle à réception : température, DLC, numéro de lot. Un produit refusé repart avec le livreur et n'entre pas en stock.</p>${recTable}</section>
    <section class="${D.opened.length <= 18 ? "rp-keep" : ""}"><h2><span>3</span>Traçabilité des produits ouverts</h2><p class="rp-note">Produits entamés pendant la période, avec la date limite après ouverture, et produits jetés. Une action annulée reste visible, barrée.</p>${tLot}</section>
    <section class="${D.chores.length <= 18 ? "rp-keep" : ""}"><h2><span>4</span>Plan de nettoyage et de désinfection</h2><p class="rp-note">Tâches prévues et réalisées sur la période. En dessous de 80 %, la ligne est signalée.</p>${tClean}</section>
    <footer class="rp-foot"><div>Document généré le ${regFull(dayKey())} à ${hm(now)} par ${esc(nameOf(S.me.id))} avec Growth Gusto. Chaque enregistrement est daté et attribué à la personne connectée au moment de la saisie.</div><div class="rp-sign"><span>Visa du responsable</span><i></i></div></footer>
  </article>`;
}

VIEWS.regReport = {
  render() {
    const P = regPeriod(); const t = dayKey();
    const seg = [["7", "7 jours"], ["30", "30 jours"], ["custom", "Dates"]]; const ix = seg.findIndex((s) => s[0] === P.mode);
    return `<div class="inner rg rp">${topBar("Rapport sanitaire", { right: `<button class="btn soft sm rg-dk" data-act="regCsv">${ico("download")}CSV</button><button class="btn acc sm rg-dk" data-act="regPrint">${ico("printer")}Imprimer</button>` })}
      <div class="glass pad st rp-tools" style="--i:1"><span class="lbl">Période</span>
        <div class="seg" id="rpSeg"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${ix * 100}%)"></span>${seg.map(([k, tx]) => `<button class="${P.mode === k ? "on" : ""}" data-act="regPer" data-v="${k}">${tx}</button>`).join("")}</div>
        ${P.mode === "custom" ? `<div class="grid2"><label class="field"><span>Du</span><input class="input" type="date" id="rpFrom" max="${t}" value="${P.from}"></label><label class="field"><span>Au</span><input class="input" type="date" id="rpTo" max="${t}" value="${P.to}"></label></div>` : ""}
        <p class="note" style="margin:0">L'aperçu ci-dessous est ce qui sera imprimé, au format A4. Pour un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</p></div>
      <div class="rp-wrap st" style="--i:2">${regReportHtml(P)}</div>
      <div class="ctabar grid2 rp-cta"><button class="btn soft" data-act="regCsv">${ico("download")}CSV</button><button class="btn acc" data-act="regPrint">${ico("printer")}Imprimer</button></div>
    </div>`;
  },
  after(v) {
    const on = () => { const a = $("#rpFrom", v), b = $("#rpTo", v); if (!a || !b || !a.value || !b.value) return; S.ui.regP = { mode: "custom", from: a.value, to: b.value }; a.blur(); b.blur(); SFX.tick(); setTimeout(rerender, 30); };
    $$("#rpFrom,#rpTo", v).forEach((i) => i.addEventListener("change", on));
  },
};

/* CSV: core's saveCsv when the downloads capability exists, otherwise a plain browser download. */
async function regSaveCsv(name, rows) {
  if (S.cap.downloads) return saveCsv(name, rows);
  const csv = "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
  try { const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); SFX.ok(); toast("Fichier prêt"); }
  catch (e) { toast("Export impossible.", "err"); }
}

/* Photos older than 6 months: shared assets when available, plus photos stored inside local records (standalone). */
let regPurged = null;
function regAutoPurge() { if (regPurged === S.rid || !S.rid) return; regPurged = S.rid; setTimeout(() => regPurge(true).catch(() => {}), 1500); }
async function regPurge(silent) {
  const lim = Date.now() - REG_PHOTO_DAYS * 864e5; let n = 0;
  const store = regPhotoStore();
  if (store) {
    try { const { assets } = await store.list(); const old = (assets || []).filter((x) => { const t = new Date(x.createdAt || x.at || 0).getTime(); return t && t < lim; }); for (const x of old) { await store.delete(x.id); n++; } }
    catch (e) { if (!silent) toast(S.cap.assets ? "Suppression impossible : seuls les éditeurs peuvent gérer les photos." : "Suppression impossible sur cet appareil.", "err"); return -1; }
  }
  if (DB.mode === "local") {
    const isPic = (u) => typeof u === "string" && /^(data|blob):/.test(u);
    const scan = (col, tsOf, fix) => { const rows = DB.local[DB.path(col)] || {}; for (const [id, d] of Object.entries(rows)) { const ts = tsOf(d); if (!ts || ts >= lim) continue; const p = fix(d); if (p) { n += p.n; delete p.n; DB.update(col, id, p); } } };
    scan("events", (d) => d.at, (d) => (isPic(d.photoUrl) ? { photoUrl: "", n: 1 } : null));
    scan("lots", (d) => d.createdAt, (d) => { let k = 0; const p = {}; if (isPic(d.photoUrl)) { p.photoUrl = ""; k++; } if (isPic(d.openPhotoUrl)) { p.openPhotoUrl = ""; k++; } return k ? { ...p, n: k } : null; });
    scan("receptions", (d) => d.at, (d) => { let k = 0; const lines = (d.lines || []).map((L) => (isPic(L.photoUrl) ? (k++, { ...L, photoUrl: "" }) : L)); return k ? { lines, n: k } : null; });
  }
  if (!silent) { if (n) { toast(`${n} photo${n > 1 ? "s" : ""} de plus de 6 mois supprimée${n > 1 ? "s" : ""}`); SFX.ok(); } else toast("Aucune photo de plus de 6 mois"); }
  return n;
}

Object.assign(ACT, {
  regF: (a, id, v) => { S.regFilter = v; S.ui.regN = 80; SFX.tick(); buzz(4); rerender(); },
  regSort: (a, id, v) => { const so = S.ui.regSort || { k: "at", d: -1 }; S.ui.regSort = so.k === v ? { k: v, d: -so.d } : { k: v, d: v === "at" || v === "val" ? -1 : 1 }; SFX.tick(); regPaint(); },
  regReset: () => { S.regFilter = "all"; S.ui.regQ = ""; S.ui.regN = 80; SFX.tick(); rerender(); },
  regMore: () => { S.ui.regN = (S.ui.regN || 80) + 120; SFX.tap(); regPaint(); },
  regPer: (a, id, v) => {
    const P = regPeriod(); S.ui.regP = { mode: v, from: P.from, to: P.to };
    const seg = $("#rpSeg"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${["7", "30", "custom"].indexOf(v) * 100}%)`; }
    SFX.tick(); setTimeout(rerender, 220);
  },
  regPrint: () => { SFX.tap(); buzz(8); const P = regPeriod(); const t = document.title; document.title = `Rapport sanitaire ${S.resto?.name || ""} du ${regFull(P.from)} au ${regFull(P.to)}`.replace(/\//g, "-"); setTimeout(() => { window.print(); document.title = t; }, 60); },
  regCsv: async () => {
    const P = regPeriod();
    const rows = [["Date", "Heure", "Catégorie", "Détail", "Valeur (°C)", "Conforme", "Action corrective / motif", "Correction (avant → après)", "Auteur"]];
    regEntries().filter((x) => x.day >= P.from && x.day <= P.to).sort((a, b) => a.at - b.at).forEach((x) => (x.csv || []).forEach((c) => rows.push([regFull(x.day), hm(x.at), c[0], c[1], c[2], c[3], c[4], c[5] || "", x.who])));
    await regSaveCsv(`registre-haccp-${P.from}_${P.to}.csv`, rows);
  },
  exportReg: () => ACT.regCsv(),
  purge: async (a) => { a.setAttribute("disabled", ""); await regPurge(false); a.removeAttribute("disabled"); },
});

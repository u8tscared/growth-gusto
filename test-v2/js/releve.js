/* Growth Gusto — area: releve (relevés, frigos, frigo detail) */

/* ───────────────────────── equipment types ───────────────────────── */
Object.assign(IC, {
  fridge: ["r:5,2,14,20,2.5", "M5 10h14", "M9 5.5v2", "M9 13v3", "f:M5 10h14v10H5z"],
  coldroom: ["M3 21h18", "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17", "M15.5 11v3", "M8.5 6.5h4", "f:M6 4h12v17H6z"],
  saladette: ["r:2,10,20,10,2", "M2 15h20", "M5 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3", "M13 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3", "M7 18h.01", "M17 18h.01", "f:M5 7h6v3H5zM13 7h6v3h-6z"],
  wine: ["M8 22h8", "M12 15v7", "M7 2h10l-.6 7.5a4.4 4.4 0 0 1-8.8 0z", "M7.5 7h9", "f:M7.4 7h9.2l-.2 2.5a4.4 4.4 0 0 1-8.8 0z"],
  vitrine: ["M2 21h20", "M4 21v-7h16v7", "M4 14 6.5 5h11L20 14", "M8 17.5h8", "f:M4 14h16v7H4z"],
  order: ["m3 8 4-4 4 4", "M7 4v16", "m21 16-4 4-4-4", "M17 20V4"],
  up: ["m18 15-6-6-6 6"],
});
const REL_TYPES = [
  { k: "frigo", pl: "Frigos", n: "Frigo", s: "Frigo", ic: "fridge", min: 0, max: 4, t: 3, hint: "Froid positif : entre 0 et 4 °C." },
  { k: "cfp", pl: "Chambres froides positives", n: "Chambre froide positive", s: "Chambre froide", ic: "coldroom", min: 0, max: 4, t: 2, hint: "Chambre froide : le stock, entre 0 et 4 °C (visez 0 à 2 °C). Les produits en partent pour la mise en place et y reviennent après le service." },
  { k: "service", pl: "Frigos de service", n: "Frigo de service (sous le plan de travail)", s: "Frigo de service", ic: "svcCounter", min: 0, max: 4, t: 3, svc: 8, hint: "Frigo sous le plan de travail : 3 à 4 °C au repos. Pendant le service, une montée due aux ouvertures est notée comme pic de service, jusqu'au seuil toléré." },
  { k: "congel", pl: "Congélateurs", n: "Congélateur / chambre froide négative", s: "Congélateur", ic: "snow", min: -40, max: -15, t: -18, hint: "Congélateur ou chambre froide négative : visez -18 °C ou moins, alerte au-dessus de -15 °C." },
  { k: "saladette", pl: "Saladettes", n: "Saladette", s: "Saladette", ic: "saladette", min: 0, max: 4, t: 3, hint: "Saladette : entre 0 et 4 °C." },
  { k: "cave", pl: "Caves à vin / boissons", n: "Cave à vin / boissons", s: "Cave à boissons", ic: "wine", min: 2, max: 8, t: 5, hint: "Boissons : entre 2 et 8 °C." },
  { k: "vitrine", pl: "Vitrines", n: "Vitrine", s: "Vitrine", ic: "vitrine", min: 0, max: 4, t: 3, hint: "Vitrine réfrigérée : entre 0 et 4 °C." },
];
/* type of an equipment; older fridges have none, so infer it from the name */
function relTypeOf(f) {
  if (f && f.type && REL_TYPES.find((t) => t.k === f.type)) return REL_TYPES.find((t) => t.k === f.type);
  const n = (f?.name || "").toLowerCase();
  const k = /cong[eé]l|surg[eé]l|n[eé]gativ/.test(n) || (f && f.max <= -10) ? "congel" : /chambre froide/.test(n) ? "cfp" : /service|plan de travail|sous[- ]plan|comptoir|passe\b/.test(n) ? "service" : /saladette/.test(n) ? "saladette" : /cave|vin|boisson/.test(n) ? "cave" : /vitrine/.test(n) ? "vitrine" : "frigo";
  return REL_TYPES.find((t) => t.k === k);
}
const relIco = (f) => ico(relTypeOf(f).ic);
/* roles: the chambre froide holds the stock; service fridges (under the worktop, saladettes) hold the mise en place */
const relIsService = (f) => !!f && f.role !== "stock" && (f.role === "service" || ["service", "saladette"].includes(relTypeOf(f).k));
const relSvcMax = (f) => (relIsService(f) ? (f.svcMax != null ? f.svcMax : 8) : null);
/* a mid-service peak: above the rest threshold but within what the service tolerates, and recorded as such */
const relPeakOk = (f, t, ctx) => ctx === "service" && relSvcMax(f) != null && t > f.max && t <= relSvcMax(f);
/* is a service on in this fridge right now? (products put there for the mise en place in the last 12 h) */
const relSvcOn = (fid) => activeLots().some((l) => l.fridgeId === fid && l.svcAt && Date.now() - l.svcAt < 432e5);
function relCtxOf(key, f) {
  key = String(key || ""); const c = S.ui.relCtx || (S.ui.relCtx = {});
  if (key.startsWith("s-")) return "service";
  if (key.startsWith("e-")) { if (c[key] != null) return c[key]; const r = S.readings.find((x) => x.id === key.slice(2)); return (r && r.ctx) || ""; }
  if (c[key] != null) return c[key];
  return relIsService(f) && relSvcOn(f.id) ? "service" : "";
}
/* a recorded reading is fine when in range, or a peak explained by the service */
const relROk = (f, r) => !!r && (relIn(f, r.value) || (r.ctx === "service" && relPeakOk(f, r.value, "service")));

/* ───────────────────────── helpers ───────────────────────── */
const relFr = (id) => S.fridges.find((f) => f.id === id);
const relDeg = (n) => fmt(n, n % 1 ? 1 : 0);
const relRange = (f) => `${relDeg(f.min)} à ${relDeg(f.max)} °C`;
const relBetween = (f) => `entre ${relDeg(f.min)} et ${relDeg(f.max)} °C`;
const relShort = (s, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/* tap guard: a button runs its action once, even on a double tap */
function relOnce(a, ms = 900) { if (!a || a.tagName !== "BUTTON") return true; if (a.dataset.busy) return false; a.dataset.busy = "1"; setTimeout(() => { delete a.dataset.busy; }, ms); return true; }
/* values the cook really set (stepper, slider), as opposed to the pre-filled suggestion */
/* scoped to the current round (day + créneau): a value set at noon never counts as measured in the evening */
function relTouched() {
  const k = dayKey() + "|" + S.slot;
  if (S.ui.relTouchedK !== k || !S.ui.relTouched) {
    if (S.ui.relTouchedK && S.ui.relTouchedK !== k) S.fridges.forEach((f) => { delete S.temp[f.id]; });
    S.ui.relTouchedK = k; S.ui.relTouched = new Set();
  }
  return S.ui.relTouched;
}
const relIn = (f, t) => t >= f.min && t <= f.max;
const relSlotName = (s) => (s === "soir" ? "soir" : "midi");
const relSlotCap = (s) => (s === "soir" ? "Soir" : "Midi");
function relAgo(ts) {
  if (!ts) return "jamais";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24); return d === 1 ? "hier" : `il y a ${d} j`;
}
function relDayLabel(k) {
  const d = daysUntil(k); if (d === 0) return "Aujourd'hui"; if (d === -1) return "Hier";
  const dt = parseDay(k); return `${DAYS[dt.getDay()].replace(/^./, (c) => c.toUpperCase())} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}
/* starting value of the stepper. Only a value set this round is a measurement; otherwise start from the last
   in-range reading or the type's target, never from a bad value (no « Valider 7,3 °C » waiting to be tapped) */
function relSuggest(f) {
  if (relTouched().has(f.id) && S.temp[f.id] != null) return S.temp[f.id];
  const last = S.readings.find((x) => x.fridgeId === f.id);
  if (last && relIn(f, last.value)) return last.value;
  const ty = relTypeOf(f); return relIn(f, ty.t) ? ty.t : Math.round(((f.min + f.max) / 2) * 10) / 10;
}
/* key is a fridge id (new reading) or "e-<readingId>" (correction) */
function relFridgeForKey(key) {
  if (String(key).startsWith("s-")) return relFr(key.slice(2));
  if (String(key).startsWith("e-")) { const r = S.readings.find((x) => x.id === key.slice(2)); return r ? relFr(r.fridgeId) : null; }
  return relFr(key);
}
function relScale(f) {
  let lo, hi;
  if (f.max <= 0) { lo = Math.min(-30, Math.floor(f.min)); hi = Math.max(0, Math.ceil(f.max + 6)); }
  else { lo = Math.min(-2, Math.floor(f.min - 2)); hi = Math.max(8, Math.ceil(f.max + 4)); }
  const pos = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  const a = pos(f.min), b = pos(f.max);
  const bg = `linear-gradient(90deg,#9EC5FF 0%,#6FD9A3 ${Math.max(0, a - 4)}%,#6FD9A3 ${b}%,#F6B93B ${Math.min(100, b + 10)}%,#EF5A3C 100%)`;
  return { lo, hi, pos, bg };
}
/* can this pending fridge be signed by « Tout est conforme » ? only with a value set this round (stepper or slider):
   a previous reading is never re-signed as today's measurement */
function relBulkOk(f) {
  return relTouched().has(f.id) && S.temp[f.id] != null && relIn(f, S.temp[f.id]);
}
/* « Tout est conforme » appears once two fridges have a measured, in-range value for this round */
function relAllBtn(pending) { return pending.filter(relBulkOk).length >= 2 ? `<button class="btn soft block rel-all" data-act="relAll">${ico("sparkle")}Tout est conforme</button>` : ""; }
function relSyncAll() {
  const w = $("#viewport .view:not(.leave) #relAllW"); if (!w) return;
  const rs = readingsFor(dayKey(), S.slot); const html = relAllBtn(S.fridges.filter((f) => !rs.find((r) => r.fridgeId === f.id)));
  if (!!w.firstElementChild !== !!html) { w.innerHTML = html; if (html) w.firstElementChild.classList.add("rel-pop"); }
}
function relState(f, t, key) {
  if (key != null && relPeakOk(f, t, relCtxOf(key, f))) return `<span class="rel-st warn">${ico("clock")}Pic de service · toléré jusqu'à ${relDeg(relSvcMax(f))} °C</span>`;
  if (!relIn(f, t)) return `<span class="rel-st bad">${ico("alert")}${t > f.max ? "Trop chaud" : "Trop froid"} · ${relRange(f)}</span>`;
  const ty = relTypeOf(f); if (ty.k === "congel" && t > ty.t) return `<span class="rel-st warn">${ico("alert")}Toléré · visez ${ty.t} °C</span>`;
  return `<span class="rel-st ok">${ico("check")}Dans le seuil</span>`;
}
/* the big stepper + slider (shared by new readings and corrections) */
function relDial(key, f, t) {
  const { lo, hi, pos, bg } = relScale(f); const bad = !relIn(f, t), peak = bad && relPeakOk(f, t, relCtxOf(key, f));
  return `<div class="big"><button class="step" data-step="-1" data-id="${key}" aria-label="Moins 0,1 degré">${ico("minus")}</button><div class="rel-vw"><div class="v" id="tv-${key}" style="color:${peak ? "var(--warn)" : bad ? "var(--bad)" : "inherit"}">${fmt(t)}<small>°C</small></div><div id="ts-${key}">${relState(f, t, key)}</div></div><button class="step" data-step="1" data-id="${key}" aria-label="Plus 0,1 degré">${ico("plus")}</button></div>
    <div><div class="scale" data-scale="${key}" data-lo="${lo}" data-hi="${hi}" style="background:${bg}"><span class="safe" style="left:${pos(f.min)}%;right:${100 - pos(f.max)}%"></span><i id="tk-${key}" style="left:${pos(t)}%" data-lo="${lo}" data-hi="${hi}"></i></div><div class="scale-l rel-sl"><span style="left:0">${lo}°</span>${pos(f.min) > 9 ? `<span class="c" style="left:${pos(f.min)}%">${relDeg(f.min)}°</span>` : ""}${pos(f.max) < 91 ? `<span class="c" style="left:${pos(f.max)}%">${relDeg(f.max)}°</span>` : ""}<span style="right:0">${hi}°</span></div></div>`;
}
/* optional photo on a reading (display, thermometer…): never required, one tap, kept with the reading */
const relPhOf = (key) => (S.ui.relPh || {})[key];
const relPhSrc = (r) => (r && ((r.photoId && typeof photoUrl === "function" && photoUrl(r.photoId)) || (typeof photoUrl === "function" ? photoUrl(r.photoUrl) : r.photoUrl))) || "";
function relPhHtml(key) {
  const p = relPhOf(key);
  if (p && p.busy) return `<div class="rel-ph" id="ph-${key}"><span class="rel-phb busy"><i class="rel-spin"></i>Photo…</span></div>`;
  if (p && p.src) return `<div class="rel-ph has" id="ph-${key}"><img src="${esc(p.src)}" alt="Photo du relevé"><span class="rel-pht">Photo jointe</span><button class="iconbtn" data-act="relPhotoRm" data-id="${key}" aria-label="Retirer la photo">${ico("x")}</button></div>`;
  return `<div class="rel-ph" id="ph-${key}"><button class="rel-phb" data-act="relPhoto" data-id="${key}">${ico("camera")}Ajouter une photo<small>facultatif</small></button></div>`;
}
function relPhSync(key) { const w = $(`#ph-${key}`); if (w) w.outerHTML = relPhHtml(key); }
function relPhThumb(r) { const src = relPhSrc(r); return src ? `<img class="rel-phs" src="${esc(src)}"${r.photoId ? ` data-photo="${esc(r.photoId)}"` : ""} alt="Photo">` : ""; }
function relFixedPill(r) { return r.editedAt ? `<span class="pill warn rel-fx" title="Corrigé">${ico("edit")}<span class="rel-fxt">corrigé</span></span>` : ""; }
function relFixedLine(r) { return r.editedAt ? `corrigé par ${esc(firstName(nameOf(r.editedBy)))} · ${when(r.editedAt)}` : ""; }
function relRing(done, exp, size = 58) {
  const R = size / 2 - 5, C = 2 * Math.PI * R, p = exp ? done / exp : 0; const prev = S.ui.relRingPrev ?? p;
  S.ui.relRingTo = p; S.ui.relRingC = C;
  return `<span class="rel-ring ${done >= exp && exp ? "full" : ""}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${R}" class="tr"/><circle cx="${size / 2}" cy="${size / 2}" r="${R}" class="pr" id="relRing" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - prev)}"/></svg><b class="mono">${done >= exp && exp ? ico("check") : `${done}<small>/${exp}</small>`}</b></span>`;
}

/* ───────────────────────── Relevés ───────────────────────── */
VIEWS.releve = {
  render() {
    const day = dayKey(), slot = S.slot;
    if (!S.fridges.length) return `<div class="inner narrow">${topBar("Relevé des frigos")}<div class="glass st empty" style="--i:1"><div class="ic">${ico("snow")}</div><b>Aucun frigo</b>Ajoutez vos frigos et chambres froides avec leurs seuils.<div style="margin-top:14px"><button class="btn acc" data-act="fridgeEdit">Ajouter un frigo</button></div></div></div>`;
    const rs = readingsFor(day, slot);
    const pending = S.fridges.filter((f) => !rs.find((r) => r.fridgeId === f.id));
    if (S.open == null || rs.find((r) => r.fridgeId === S.open)) S.open = pending[0]?.id || null;
    const just = S.ui.relJust || new Set();
    const cards = S.fridges.map((f, i) => {
      const r = rs.find((x) => x.fridgeId === f.id);
      if (r) {
        const drew = just.has(f.id);
        return `<div class="glass fr done st ${drew ? "rel-in" : ""}" style="--i:${i + 3}" data-fr="${f.id}" data-act="relEdit" data-id="${r.id}" role="button" tabindex="0" aria-label="Modifier le relevé ${esc(f.name)}"><div class="head"><span class="ic ${r.ok ? (r.peak ? "warn" : "ok") : "bad"}">${relIco(f)}</span><div style="flex:1;min-width:0"><div class="rel-nm"><b class="h3 rel-ell">${esc(f.name)}</b>${relFixedPill(r)}</div><div class="who">${avatar(r.uid, true)}<span class="rel-ell">${esc(firstName(nameOf(r.uid)))} · ${hm(r.at)}${r.ok ? (r.peak ? ` · <span style="color:var(--warn)">pic de service</span>` : r.ctx === "service" ? " · en service" : "") : ` · <span style="color:var(--bad)">${esc(r.action || "hors seuil")}</span>`}</span>${relFixedPill(r).replace('rel-fx"', 'rel-fx rel-fx-m"')}</div></div>${relPhThumb(r)}<span class="t" style="color:${r.ok ? (r.peak ? "var(--warn)" : "var(--ok)") : "var(--bad)"}">${fmt(r.value)}°</span>${r.ok ? `<span class="check ${drew ? "draw" : ""}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : `<span class="check ${drew ? "draw" : ""}" style="background:var(--bad);box-shadow:0 6px 14px -6px rgba(212,42,72,.6)">${ico("alert").replace('class="ico ', 'style="width:15px;height:15px;color:#fff" class="ico ')}</span>`}</div></div>`;
      }
      const last = S.readings.find((x) => x.fridgeId === f.id);
      const t = relSuggest(f); S.temp[f.id] = t; const isOpen = S.open === f.id;
      return `<div class="glass fr ${isOpen ? "open" : ""} st" style="--i:${i + 3}" data-fr="${f.id}"><div class="head" data-act="frOpen" data-id="${f.id}" role="button" tabindex="0" aria-expanded="${isOpen}"><span class="ic">${relIco(f)}</span><div style="flex:1;min-width:0"><b class="h3 rel-ell" style="display:block">${esc(f.name)}</b><div class="who"><span class="rel-ell">Seuil ${relRange(f)}${last ? ` · dernier ${fmt(last.value)}°` : " · premier relevé"}</span></div></div><span class="pend"></span></div>
        <div class="dial"><div><div class="dz">${relDial(f.id, f, t)}${relIsService(f) ? relCtxHtml(f.id, f) : ""}
          ${relPhHtml(f.id)}
          <button class="btn acc block" data-act="saveReading" data-id="${f.id}">${ico("check")}<span data-tlv="${f.id}" data-pre="Valider">Valider ${fmt(t)} °C</span></button>
        </div></div></div></div>`;
    }).join("");
    const done = S.fridges.length - pending.length, exp = S.fridges.length, full = !pending.length;
    const celeb = S.ui.relCeleb; S.ui.relCeleb = false;
    const sum = full
      ? `<div class="glass pad rel-sum full st ${celeb ? "celeb" : ""}" style="--i:2"><div class="rel-sumrow">${relRing(done, exp)}<div class="rel-sumtx"><b class="h3">Relevé du ${relSlotName(slot)} terminé</b><div class="sub">${exp} frigo${exp > 1 ? "s" : ""} signé${exp > 1 ? "s" : ""}${rs.some((r) => !r.ok) ? ` · <span style="color:var(--bad)">${rs.filter((r) => !r.ok).length} hors seuil</span>` : ", tout est conforme"}. Touchez un frigo pour le corriger.</div></div></div>${slot === "midi" && readingsFor(day, "soir").length < exp ? `<button class="btn soft block" data-act="slot" data-v="soir">Passer au relevé du soir${ico("chev")}</button>` : ""}</div>`
      : `<div class="glass pad rel-sum st" style="--i:2"><div class="rel-sumrow">${relRing(done, exp)}<div class="rel-sumtx"><b class="h3">${done ? `${done} relevé${done > 1 ? "s" : ""} sur ${exp}` : `${exp} frigo${exp > 1 ? "s" : ""} à relever`}</b><div class="sub rel-ell">Reste : ${pending.map((f) => esc(f.name)).join(", ")}</div></div></div><div id="relAllW" class="rel-allw">${relAllBtn(pending)}</div></div>`;
    return `<div class="inner rel-page">${topBar("Relevé des frigos")}
      <div class="seg st" style="--i:1" id="slotSeg"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${slot === "soir" ? "100%" : "0"})"></span><button class="${slot === "midi" ? "on" : ""}" data-act="slot" data-v="midi">Midi</button><button class="${slot === "soir" ? "on" : ""}" data-act="slot" data-v="soir">Soir</button></div>
      ${sum}
      <div class="rel-grid">${cards}</div>
      <p class="note st" style="--i:9;text-align:center">Chaque relevé est daté et signé par la personne connectée. Une correction garde l'ancienne valeur dans le registre.</p></div>`;
  },
  after(v) {
    S.ui.relJust = null;
    const ring = $("#relRing", v); const to = S.ui.relRingTo;
    if (ring && to != null) { requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = S.ui.relRingC * (1 - to); })); S.ui.relRingPrev = to; }
    if (S.ui.relScroll) { const el = $(`.fr[data-fr="${S.ui.relScroll}"]`, v); S.ui.relScroll = null; el && setTimeout(() => { relScrollToCard(v, el, null, 0); if (typeof toastAvoid === "function") toastAvoid(el); }, 30); }
  },
};

/* ───────────────────────── Frigos list ───────────────────────── */
VIEWS.frigos = {
  render() {
    const lots = activeLots();
    const card = (f, i) => {
      const last = S.readings.find((r) => r.fridgeId === f.id); const fl = lots.filter((l) => l.fridgeId === f.id).sort((a, b) => (dlcOf(a) || "9").localeCompare(dlcOf(b) || "9"));
      const ok = last ? relROk(f, last) : null; const late = last && Date.now() - last.at > 864e5;
      const lateN = fl.filter((l) => (daysUntil(dlcOf(l)) ?? 9) < 0).length;
      const sv = relIsService(f) ? fl.filter((l) => l.svcAt) : []; const svOld = sv.length ? Math.max(...sv.map(svcMin)) : null;
      const st = ok == null ? "none" : !ok ? "bad" : late ? "late" : "ok";
      const stTx = { none: "Jamais relevé", bad: "Hors seuil", late: "En retard", ok: "Conforme" }[st];
      return `<div class="glass pad st rel-fcard" style="--i:${Math.min(i + 1, 12)}" data-go="frigo" data-id="${f.id}" role="button" tabindex="0" aria-label="${esc(f.name)} · ${stTx}"><div class="rel-fhd"><span class="rel-lcd ${st}"><b>${last ? `${fmt(last.value)}°` : "--,-"}</b><small>${last ? relAgo(last.at) : "jamais"}</small></span><div style="min-width:0;flex:1"><b class="h3 rel-ell" style="display:block">${esc(f.name)}</b><div class="rel-meta"><span class="rel-dot ${st}"></span><span>${stTx}</span><span class="rel-sep">·</span><span class="rel-ell">${fl.length ? `${fl.length} produit${fl.length > 1 ? "s" : ""}` : relRange(f)}</span></div></div><i class="rel-hdl"></i></div>${sv.length ? `<div class="rel-next svc"><span class="rel-ell">Mise en place · <b>${sv.length} produit${sv.length > 1 ? "s" : ""}</b></span><span class="pill ${svcTone(svOld)}">${ico("clock")}${svcDur(svOld)}</span></div>` : ""}${fl.length ? `<div class="rel-top">${fl.slice(0, 4).map((l) => `<span class="rel-tc ${relUrg(l)}"><i></i>${esc(relShort(l.name, 18))}${l.qty ? `<em class="mono">${esc(lbQty(l))}</em>` : ""}</span>`).join("")}${fl.length > 4 ? `<span class="rel-tc more">+${fl.length - 4}</span>` : ""}</div>${lateN ? `<div class="rel-falert"><span class="pill bad"><span class="dot"></span>${lateN} DLC dépassée${lateN > 1 ? "s" : ""}</span></div>` : ""}` : `<div class="rel-next none"><span class="rel-ell">Vide · touchez pour voir l'historique</span></div>`}</div>`;
    };
    const groups = []; S.fridges.forEach((f) => { const ty = relTypeOf(f); let g = groups.find((x) => x.ty.k === ty.k); if (!g) groups.push((g = { ty, fs: [] })); g.fs.push(f); });
    let n = 0;
    /* headers only help when they actually group things: not 6 headers for 6 fridges */
    const list = groups.length > 1 && groups.length <= Math.ceil(S.fridges.length / 2)
      ? groups.map((g) => `<div class="rel-grp"><div class="rel-grph st" style="--i:${n + 1}">${ico(g.ty.ic)}<span>${esc(g.ty.pl)}</span><em>${g.fs.length}</em></div><div class="fgrid">${g.fs.map((f) => card(f, ++n)).join("")}</div></div>`).join("")
      : `<div class="fgrid">${S.fridges.map((f) => card(f, ++n)).join("")}</div>`;
    return `<div class="inner wide">${topBar("Frigos", { noBack: true, right: `${S.fridges.length > 1 ? `<button class="iconbtn" data-act="fridgeOrder" aria-label="Réorganiser">${ico("order")}</button>` : ""}<button class="btn soft sm" data-act="fridgeEdit">${ico("plus")}Ajouter</button>` })}
      ${S.fridges.length ? relSvcBanner() : ""}
      ${S.fridges.length ? `<div class="rel-ovh st" style="--i:1"><b class="h3">Que contient chaque frigo ?</b><span class="sub">${lots.length} produit${lots.length > 1 ? "s" : ""}${(() => { const n = lots.filter((l) => (daysUntil(dlcOf(l)) ?? 9) <= 0).length; return n ? ` · <span style="color:var(--bad)">${n} à traiter aujourd'hui</span>` : ""; })()}</span></div>` : ""}
      ${S.fridges.length ? list : `<div class="glass empty st" style="--i:1"><div class="ic">${ico("snow")}</div><b>Aucun frigo</b>Ajoutez vos frigos et chambres froides.</div>`}
      <div class="glass pad st" style="--i:8"><div class="row"><span class="lbl">Tous les produits en frigo</span><span class="sub">${lots.length}</span></div>${lotList(lots.sort((a, b) => (dlcOf(a) || "9").localeCompare(dlcOf(b) || "9")).slice(0, 30), true)}</div></div>`;
  },
};
/* "6 pièces", "3 cartons" — abbreviations (kg, L, g) stay as they are */
function relUnit(q, u) { u = u || ""; return q > 1 && /^[a-zà-ÿ]{4,}$/i.test(u) && !/[sx]$/.test(u) ? u + "s" : u; }
function lotList(lots, showFridge) {
  if (!lots.length) return `<div class="empty" style="padding:16px 0 4px">Aucun produit. Ils arrivent ici à chaque réception, ou en scannant une étiquette.</div>`;
  return `<div style="margin-top:4px">${lots.map((l, i) => `<div class="li tap" data-act="lot" data-id="${l.id}" role="button" tabindex="0" aria-label="${esc(l.name)}${dlcOf(l) ? ` · DLC ${shortDate(dlcOf(l))}` : ""}"><span class="rank ${(daysUntil(dlcOf(l)) ?? 9) <= 1 ? "hot" : ""}">${i + 1}</span><div class="tx"><b>${esc(l.name)}${l.qty ? ` · ${fmt(num(l.qty), num(l.qty) % 1 ? 2 : 0)} ${esc(relUnit(num(l.qty), l.unit))}` : ""}</b><em>${l.status === "opened" ? `Ouvert le ${shortDate(dayKey(new Date(l.openedAt)))} par ${esc(firstName(nameOf(l.openedBy)))}` : `Entré le ${shortDate(dayKey(new Date(l.createdAt)))}`}${showFridge ? ` · ${esc(fridgeName(l.fridgeId))}` : ""}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</em></div>${dlcPill(dlcOf(l))}</div>`).join("")}</div>`;
}

/* ───────────────────────── Frigo detail ───────────────────────── */
function relHistory(f) {
  const all = S.readings.filter((r) => r.fridgeId === f.id);
  if (!all.length) return `<div class="empty" style="padding:16px 0 4px">Aucun relevé pour l'instant.</div>`;
  const days = [...new Set(all.map((r) => r.day))].sort().reverse(); const n = S.ui.relDays || 7; const shown = days.slice(0, n);
  return shown.map((k) => {
    const rows = all.filter((r) => r.day === k).sort((a, b) => (a.slot === b.slot ? a.at - b.at : a.slot === "midi" ? -1 : 1));
    return `<div class="rel-day"><div class="rel-dayh"><span>${relDayLabel(k)}</span><span>${shortDate(k)}</span></div>${rows.map((r) => `<div class="li tap rel-row" role="button" tabindex="0" data-act="relEdit" data-id="${r.id}"><span class="rel-slot ${r.slot}">${relSlotCap(r.slot)}</span><div class="tx"><b>${avatar(r.uid, true)} ${esc(firstName(nameOf(r.uid)))} · ${hm(r.at)}</b><em>${r.ok ? "" : `<span style="color:var(--bad)">${esc(r.action || "Hors seuil")}</span>${r.editedAt ? " · " : ""}`}${r.ok && r.peak ? `<span style="color:var(--warn)">Pic pendant le service</span>${r.editedAt ? " · " : ""}` : ""}${relFixedLine(r)}${r.ok && !r.editedAt && !r.peak ? (r.ctx === "service" ? "Conforme · pendant le service" : "Conforme") : ""}</em></div>${relFixedPill(r)}<span class="mono rel-v" style="color:${r.ok ? (r.peak ? "var(--warn)" : "var(--ink)") : "var(--bad)"}">${fmt(r.value)}°</span><span class="rel-chev">${ico("chev")}</span></div>`).join("")}</div>`;
  }).join("") + (days.length > n ? `<button class="btn ghost block" data-act="relMore">Voir les jours précédents</button>` : "");
}
/* allergens of a stored product: its own, its product's, or guessed from the name (to keep families apart on the shelves) */
const REL_AL_ORDER = ["mollusques", "crustaces", "poissons", "oeufs", "lait", "gluten", "fruitscoque", "arachides", "soja", "sesame", "celeri", "moutarde", "sulfites", "lupin"];
const REL_AL_GUESS = [["mollusques", /hu[iî]tre|moule|coquill|saint[- ]jacques|st[- ]jacques|calamar|seiche|poulpe|bulot|palourde|praire|couteaux?\b|bigorneau/], ["crustaces", /crevette|homard|langoust|crabe|tourteau|[ée]crevisse|gambas|araign[ée]e de mer/], ["poissons", /saumon|thon|cabillaud|\bbar\b|dorade|daurade|truite|anchois|sardine|poisson|merlu|sole\b|turbot|maquereau|colin|lotte|haddock|morue/], ["oeufs", /[œo]e?ufs?\b|mayonnaise|meringue/], ["lait", /\blait|cr[èe]me|beurre|fromage|yaourt|comt[ée]|parmesan|mozzarella|ch[èe]vre|brebis|mascarpone|ricotta|emmental|roquefort|burrata|camembert|brie\b|reblochon|feta/], ["gluten", /farine|\bpains?\b|p[âa]te feuillet|p[âa]te bris|brioche|biscuit|semoule|chapelure|\bbl[ée]\b|seigle|orge|p[âa]tes\b/], ["fruitscoque", /\bnoix|noisette|amande|pistache|cajou|p[ée]can/], ["arachides", /cacahu|arachide/], ["soja", /\bsoja|tofu/], ["sesame", /s[ée]same|tahin/], ["celeri", /c[ée]leri/], ["moutarde", /moutarde/], ["sulfites", /vinaigre|\bvin\b/]];
function relAllergens(l) {
  const own = l.allergens && l.allergens.length ? l.allergens : (S.products.find((p) => p.id === l.productId) || {}).allergens;
  if (own && own.length) return own.filter((a) => typeof allergenOf !== "function" || allergenOf(a));
  const n = (l.name || "").toLowerCase(); return REL_AL_GUESS.filter(([, re]) => re.test(n)).map(([k]) => k);
}
const relAlName = (k) => (typeof allergenOf === "function" && allergenOf(k) ? allergenOf(k).t : k);
const relUrg = (l) => { const d = daysUntil(dlcOf(l)); return d == null ? "neu" : d <= 0 ? "bad" : d <= 2 ? "warn" : "ok"; };

/* one product tile: name, quantity, DLC, time out of the cold room, allergens, and one tap to move, open or throw away */
function relTile(l, isSvc) {
  const u = relUrg(l); const al = relAllergens(l); const d = daysUntil(dlcOf(l));
  const dl = d == null ? "Sans DLC" : d < 0 ? `DLC dépassée` : d === 0 ? "DLC aujourd'hui" : d === 1 ? "DLC demain" : `DLC ${shortDate(dlcOf(l))}`;
  const mv = isSvc ? `<button class="rel-ta" data-act="svcBackOne" data-id="${l.id}" aria-label="Remettre en chambre froide">${ico("svcBack")}<span>Remettre</span></button>` : `<button class="rel-ta" data-act="lotMoveAsk" data-id="${l.id}" aria-label="Déplacer">${ico("move")}<span>Déplacer</span></button>`;
  const op = l.status === "in" ? `<button class="rel-ta" data-act="lotOpen" data-id="${l.id}" aria-label="Ouvrir">${ico("scissors")}<span>Ouvrir</span></button>` : `<button class="rel-ta" data-act="lotOut" data-id="${l.id}" aria-label="Utilisé">${ico("lbDone")}<span>Utilisé</span></button>`;
  return `<div class="rel-tile u-${u}" data-act="lot" data-id="${l.id}" data-q="${esc(((l.name || "") + " " + (l.lot || "") + " " + al.map(relAlName).join(" ")).toLowerCase())}" role="button" tabindex="0" aria-label="${esc(l.name)} · ${esc(dl)}">
    <div class="rel-tt"><b>${esc(l.name)}</b>${l.qty ? `<span class="mono">${fmt(num(l.qty), num(l.qty) % 1 ? (Math.round(num(l.qty) * 10) === num(l.qty) * 10 ? 1 : 2) : 0)}<small>${esc(relUnit(num(l.qty), l.unit))}</small></span>` : ""}</div>
    <div class="rel-tm"><span class="rel-dl ${u}"><i></i>${dl}</span>${l.status === "opened" ? `<span class="rel-op">ouvert</span>` : ""}${isSvc && l.svcAt ? svcDwellPill(l) : ""}</div>
    ${al.length ? `<div class="rel-tal">${al.slice(0, 3).map((a) => `<span>${esc(relAlName(a))}</span>`).join("")}${al.length > 3 ? `<span>+${al.length - 3}</span>` : ""}</div>` : ""}
    <div class="rel-tas">${mv}${op}<button class="rel-ta bad" data-act="lotLost" data-id="${l.id}" aria-label="Jeter">${ico("trash")}<span>Jeter</span></button></div></div>`;
}
function relContent(f, lots, isSvc) {
  if (!lots.length) return `<div class="glass empty st" style="--i:4"><div class="ic">${relIco(f)}</div><b>${isSvc ? "Rien en frigo de service" : "Ce frigo est vide"}</b>${isSvc ? "En début de service, sortez ce qu'il faut de la chambre froide : chaque produit s'affiche ici avec son temps passé hors du froid." : "Les produits arrivent ici à chaque réception, ou quand vous scannez une étiquette et choisissez « Déplacer »."}<div class="hstack" style="justify-content:center;margin-top:14px;flex-wrap:wrap">${isSvc ? `<button class="btn soft" data-go="service" data-id="mep">${ico("svcGo")}Mise en place</button>` : `<button class="btn soft" data-go="reception" data-fresh="1">${ico("truck")}Réception</button>`}<button class="btn soft" data-go="scan">${ico("scan")}Scanner</button></div></div>`;
  const hasAl = lots.some((l) => relAllergens(l).length); const mode = hasAl && S.ui.relGrp === "al" ? "al" : "dlc";
  let groups;
  if (mode === "al") {
    const by = new Map(); lots.forEach((l) => { const al = relAllergens(l); const k = REL_AL_ORDER.find((x) => al.includes(x)) || (al[0] || ""); if (!by.has(k)) by.set(k, []); by.get(k).push(l); });
    groups = [...by.entries()].sort((a, b) => (a[0] ? REL_AL_ORDER.indexOf(a[0]) : 99) - (b[0] ? REL_AL_ORDER.indexOf(b[0]) : 99)).map(([k, ls]) => ({ t: k ? relAlName(k) : "Sans allergène majeur", tone: k ? "al" : "", ls }));
  } else {
    const g = { bad: [], warn: [], ok: [], neu: [] }; lots.forEach((l) => g[relUrg(l)].push(l));
    groups = [["bad", "À utiliser en premier"], ["warn", "Dans les 2 jours"], ["ok", "Plus tard"], ["neu", "Sans DLC"]].filter(([k]) => g[k].length).map(([k, t]) => ({ t, tone: k, ls: g[k] }));
  }
  const fams = new Set(lots.map((l) => REL_AL_ORDER.find((x) => relAllergens(l).includes(x))).filter(Boolean));
  const late = lots.filter((l) => (daysUntil(dlcOf(l)) ?? 9) < 0).length;
  return `${lots.length > 5 ? `<div class="rel-find st" style="--i:4">${ico("search")}<input class="input" id="relFind" placeholder="Chercher dans ${esc(relShort(f.name, 20))}…" autocomplete="off" aria-label="Chercher un produit"></div>` : ""}
    ${late ? `<div class="rel-alerts st" style="--i:4"><span class="pill bad"><span class="dot"></span>${late} DLC dépassée${late > 1 ? "s" : ""} : à jeter ou à vérifier</span></div>` : ""}
    ${hasAl ? `<div class="chips rel-grpc st" style="--i:4"><button class="chip ${mode === "dlc" ? "on" : ""}" data-act="relGrp" data-v="dlc">Par DLC</button><button class="chip ${mode === "al" ? "on" : ""}" data-act="relGrp" data-v="al">Par allergène${fams.size > 1 ? `<em>${fams.size}</em>` : ""}</button></div>` : ""}
    ${mode === "al" && fams.size > 1 ? `<p class="rel-alnote st" style="--i:4">${ico("alert")}<span>Rangez chaque famille à part, sur son étage ou dans son bac : pas d'huîtres contre les œufs, pas de crème au-dessus du poisson.</span></p>` : ""}
    ${groups.map((g, i) => `<div class="rel-tg st" style="--i:${Math.min(5 + i, 10)}"><div class="rel-tgh ${g.tone}"><span>${esc(g.t)}</span><em>${g.ls.length}</em></div><div class="rel-tiles">${g.ls.map((l) => relTile(l, isSvc)).join("")}</div></div>`).join("")}
    <p class="rel-nofind" id="relNoFind" hidden>Aucun produit ne correspond.</p>`;
}

/* merged history of a fridge: temperatures, entries, exits, transfers and corrections */
function relEvents(f) {
  const id = f.id, E = [];
  S.readings.filter((r) => r.fridgeId === id).forEach((r) => {
    const vers = [...(r.prev || []), { value: r.value, at: r.editedAt || r.at, uid: r.editedBy || r.uid, why: r.editReason || "" }];
    const first = vers[0]; const ok = relROk(f, r);
    E.push({ at: r.at, k: "temp", ic: "therm", tone: ok ? (r.peak ? "warn" : "ok") : "bad", t: `${fmt(r.value)} °C · ${r.mid ? "pendant le service" : relSlotName(r.slot)}`, s: `${firstName(nameOf(r.uid))}${ok ? (r.peak ? " · pic de service" : "") : ` · ${r.action || "hors seuil"}`}${r.editedAt ? ` · corrigé (avant ${fmt(first.value)} °C)` : ""}`, act: `data-act="relEdit" data-id="${r.id}"`, ph: relPhThumb(r) });
    for (let j = 1; j < vers.length; j++) E.push({ at: vers[j].at, k: "fix", ic: "edit", tone: "warn", t: `Correction · ${fmt(vers[j - 1].value)} → ${fmt(vers[j].value)} °C`, s: `${firstName(nameOf(vers[j].uid))} · relevé du ${relSlotName(r.slot)} ${shortDate(r.day)}${vers[j].why ? ` · ${vers[j].why}` : ""}`, act: `data-act="relEdit" data-id="${r.id}"` });
  });
  const mv = (S.moves || []).filter((m) => m.kind === "transfert" && !m.cancelled);
  mv.filter((m) => m.fridgeId === id || m.toFridgeId === id).forEach((m) => {
    const out = m.fridgeId === id; const q = m.moved != null ? svcQtyTx(m.moved, m.unit) + " · " : "";
    E.push({ at: m.at, k: "move", ic: out ? "out" : "into", tone: m.dir === "mep" ? "svc" : m.dir === "ret" ? "cold" : "", t: `${out ? (m.dir === "mep" ? "Mise en place" : "Sorti") : m.dir === "ret" ? "Retour du service" : "Arrivé"} · ${m.name}`, s: `${q}${out ? `vers ${fridgeName(m.toFridgeId)}` : `de ${fridgeName(m.fridgeId)}`} · ${firstName(nameOf(m.uid))}${m.used ? ` · ${svcQtyTx(m.used, m.usedUnit || m.unit)} utilisé${m.used > 1 ? "s" : ""}` : ""}`, act: `data-act="lot" data-id="${m.lotId}"` });
  });
  const firstMove = {}; mv.slice().sort((a, b) => a.at - b.at).forEach((m) => { if (!firstMove[m.lotId]) firstMove[m.lotId] = m; });
  S.lots.forEach((l) => {
    if (l.cancelled) return;
    const entry = l.parentLotId ? null : firstMove[l.id] ? firstMove[l.id].fridgeId : l.fridgeId;
    if (entry === id && l.createdAt) E.push({ at: l.createdAt, k: "move", ic: "truck", tone: "ok", t: `Entrée · ${l.name}`, s: `${[lbQty(l), l.supplier, l.lot ? `lot ${l.lot}` : ""].filter(Boolean).join(" · ")}${l.receivedTemp != null && l.receivedTemp !== "" ? ` · ${fmt(num(l.receivedTemp))} °C à réception` : ""}`, act: `data-act="lot" data-id="${l.id}"` });
    if (l.fridgeId === id && l.openedAt) E.push({ at: l.openedAt, k: "move", ic: "scissors", tone: "warn", t: `Ouvert · ${l.name}`, s: `${firstName(nameOf(l.openedBy))}${l.dlcOpen ? ` · à consommer avant le ${shortDate(l.dlcOpen)}` : ""}`, act: `data-act="lot" data-id="${l.id}"` });
    if (l.fridgeId === id && l.outAt && (l.status === "out" || l.status === "lost")) E.push({ at: l.outAt, k: "move", ic: l.status === "lost" ? "trash" : "lbDone", tone: l.status === "lost" ? "bad" : "", t: `${l.status === "lost" ? "Jeté" : l.usedInService ? "Utilisé en service" : "Utilisé"} · ${l.name}`, s: `${firstName(nameOf(l.outBy))}${l.lostReason ? ` · ${l.lostReason}` : ""}${lbQty(l) ? ` · ${lbQty(l)}` : ""}`, act: `data-act="lot" data-id="${l.id}"` });
  });
  return E.sort((a, b) => b.at - a.at);
}
function relTimeline(f) {
  const flt = S.ui.relHf || "all"; const all = relEvents(f); const E = all.filter((e) => flt === "all" || e.k === flt);
  const cnt = (k) => all.filter((e) => e.k === k).length;
  const chips = [["all", "Tout", all.length], ["temp", "Températures", cnt("temp")], ["move", "Entrées · sorties", cnt("move")], ["fix", "Corrections", cnt("fix")]].filter(([k, , n]) => k === "all" || n);
  const days = [...new Set(E.map((e) => dayKey(new Date(e.at))))].sort().reverse(); const n = S.ui.relDays || 7; const shown = days.slice(0, n);
  const curve = flt === "all" || flt === "temp" ? `<div class="glass pad st" style="--i:4"><div class="row"><span class="lbl">7 derniers jours</span><span class="sub" style="font-size:12px">Seuil ${relRange(f)}</span></div><div class="rel-chart" id="relChart" data-id="${f.id}"></div><div class="rel-legend"><span><i class="m"></i>Midi</span><span><i class="s"></i>Soir</span>${relIsService(f) ? `<span><i class="p"></i>Pic de service</span>` : ""}<span><i class="x"></i>Hors seuil</span></div></div>` : "";
  return `<div class="chips rel-hf st" style="--i:4">${chips.map(([k, t, c]) => `<button class="chip ${flt === k ? "on" : ""}" data-act="relHf" data-v="${k}">${t}<em>${c}</em></button>`).join("")}</div>${curve}
    <div class="glass pad st" style="--i:5">${E.length ? shown.map((k) => `<div class="rel-day"><div class="rel-dayh"><span>${relDayLabel(k)}</span><span>${shortDate(k)}</span></div>${E.filter((e) => dayKey(new Date(e.at)) === k).map((e) => `<div class="li tap rel-hev" role="button" tabindex="0" ${e.act}><span class="rel-evi ${e.tone}">${ico(e.ic)}</span><div class="tx"><b>${esc(e.t)}</b><em>${esc(e.s)}</em></div>${e.ph || ""}<span class="rel-evt mono">${hm(e.at)}</span></div>`).join("")}</div>`).join("") + (days.length > n ? `<button class="btn ghost block" data-act="relMore">Voir les jours précédents</button>` : "")
      : `<div class="empty" style="padding:16px 0 4px">${flt === "all" ? "Rien pour l'instant. Les relevés, entrées, sorties et corrections de ce frigo s'afficheront ici." : "Rien de ce type pour ce frigo."}</div>`}</div>`;
}
VIEWS.frigo = {
  render({ id }) {
    const f = relFr(id); if (!f) return `<div class="inner narrow">${topBar("Frigo")}<div class="glass empty">Ce frigo n'existe plus.</div></div>`;
    const last = S.readings.find((r) => r.fridgeId === id); const ok = last ? relROk(f, last) : null; const isSvc = relIsService(f);
    const lots = activeLots().filter((l) => l.fridgeId === id).sort((a, b) => (dlcOf(a) || "9").localeCompare(dlcOf(b) || "9"));
    if (S.ui.relDaysFor !== id) { S.ui.relDaysFor = id; S.ui.relDays = 7; S.ui.relTab = "in"; S.ui.relHf = "all"; }
    const tab = S.ui.relTab === "hist" ? "hist" : "in";
    const head = `<div class="glass pad st rel-fhead" style="--i:1"><div class="row" style="align-items:flex-start"><div><span class="lbl">Dernier relevé</span><div class="mono rel-fbig" style="color:${ok === false ? "var(--bad)" : last && last.peak ? "var(--warn)" : "inherit"}">${last ? fmt(last.value) : "–"}<span>°C</span></div><div class="sub">${last ? `${relAgo(last.at)} · ${last.mid ? "pendant le service" : relSlotName(last.slot)} · ${esc(firstName(nameOf(last.uid)))}` : "Jamais relevé"}</div><div class="sub" style="font-size:12px;margin-top:2px">${esc(relTypeOf(f).s)} · seuil ${relRange(f)}${isSvc ? ` · en service jusqu'à ${relDeg(relSvcMax(f))} °C` : ""}</div></div>${ok == null ? `<span class="pill neu">Pas de relevé</span>` : ok && last.peak ? `<span class="pill warn"><span class="dot"></span>Pic de service</span>` : ok ? `<span class="pill ok"><span class="dot"></span>Conforme</span>` : `<span class="pill bad"><span class="dot"></span>Hors seuil</span>`}</div>
      <div class="grid2" style="margin-top:14px"><button class="btn soft" data-act="relGoRead" data-id="${f.id}">${ico("therm")}Relever</button><button class="btn soft" data-go="scan">${ico("scan")}Scanner</button></div></div>`;
    const seg = `<div class="seg st rel-ftab" style="--i:3"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "hist" ? "100%" : "0"})"></span><button class="${tab === "in" ? "on" : ""}" data-act="relTab" data-v="in">${ico("box")}Contenu<em>${lots.length}</em></button><button class="${tab === "hist" ? "on" : ""}" data-act="relTab" data-v="hist">${ico("clock")}Historique</button></div>`;
    const side = `${head}${isSvc ? relSvcCard(f, lots) : relMepCard(f, lots)}`;
    const mini = `<button class="rel-fmini st" style="--i:2" data-act="relGoRead" data-id="${f.id}"><span class="mono" style="color:${ok === false ? "var(--bad)" : last && last.peak ? "var(--warn)" : "inherit"}">${last ? fmt(last.value) + "°" : "–"}</span><span class="tx"><b>${ok == null ? "Pas encore relevé" : ok && last.peak ? "Pic de service" : ok ? "Conforme" : "Hors seuil"}</b><em>${last ? relAgo(last.at) : ""} · seuil ${relRange(f)}</em></span><span class="rel-fmb">${ico("therm")}Relever</span></button>`;
    const main = `${mini}${seg}<div class="rel-fbody">${tab === "in" ? relContent(f, lots, isSvc) : relTimeline(f)}</div>`;
    return `<div class="inner wide">${topBar(esc(f.name), { right: `<button class="iconbtn" data-act="fridgeEdit" data-id="${f.id}" aria-label="Modifier">${ico("edit")}</button>` })}
      <div class="cols rel-fcols"><div class="rel-fmain">${main}</div><div class="rel-fside">${side}</div></div></div>`;
  },
  after(v) { const el = $("#relChart", v); if (el) { relDrawChart(el, relFr(el.dataset.id)); } },
};
Object.assign(ACT, {
  relTab: (a, id, v) => {
    if (S.ui.relTab === v) return; S.ui.relTab = v; SFX.tick(); buzz(5);
    const seg = a.closest(".seg"); if (seg) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${v === "hist" ? "100%" : "0"})`; }
    setTimeout(rerender, 180);
  },
  relHf: (a, id, v) => { S.ui.relHf = v; S.ui.relDays = 7; SFX.tick(); rerender(); },
  relGrp: (a, id, v) => { S.ui.relGrp = v; SFX.tick(); rerender(); },
});
document.addEventListener("input", (e) => {
  if (!e.target || e.target.id !== "relFind") return; const q = e.target.value.trim().toLowerCase(); const v = $("#viewport .view:not(.leave)"); if (!v) return;
  $$(".rel-tile", v).forEach((t) => { t.hidden = !!q && !t.dataset.q.includes(q); });
  $$(".rel-tg", v).forEach((g) => { g.hidden = !$$(".rel-tile", g).some((t) => !t.hidden); });
  const nf = $("#relNoFind", v); if (nf) nf.hidden = !q || $$(".rel-tile", v).some((t) => !t.hidden);
});

/* 7-day chart, drawn at the real pixel width so text stays crisp */
function relDrawChart(el, f) {
  if (!f) return;
  const W = Math.max(260, Math.round(el.clientWidth || 320)), H = W < 500 ? 190 : 220, padL = 30, padR = 8, padT = 12, padB = 34;
  const today = dayKey(); const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const pts = [];
  days.forEach((k, di) => ["midi", "soir"].forEach((s) => { const r = S.readings.find((x) => x.fridgeId === f.id && x.day === k && x.slot === s); if (r) pts.push({ r, di, s }); }));
  const vals = pts.map((p) => p.r.value);
  let lo = Math.floor(Math.min(f.min - 1, ...vals)), hi = Math.ceil(Math.max(f.max + 1, ...vals));
  const span = hi - lo; const stepY = span <= 6 ? 1 : span <= 14 ? 2 : span <= 30 ? 5 : 10;
  lo = Math.floor(lo / stepY) * stepY; hi = Math.ceil(hi / stepY) * stepY;
  const cw = (W - padL - padR) / 7;
  const x = (di, s) => padL + cw * di + cw * (s === "midi" ? 0.32 : 0.68);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  let g = "";
  days.forEach((k, di) => { if (di % 2 === 0) g += `<rect x="${padL + cw * di}" y="${padT}" width="${cw}" height="${H - padT - padB}" class="col"/>`; });
  for (let v = lo; v <= hi; v += stepY) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${padL - 7}" y="${y(v) + 3.5}" text-anchor="end" class="yl">${v}°</text>`;
  g += `<rect x="${padL}" y="${y(f.max)}" width="${W - padL - padR}" height="${y(f.min) - y(f.max)}" class="band"/><line x1="${padL}" x2="${W - padR}" y1="${y(f.max)}" y2="${y(f.max)}" class="th"/><line x1="${padL}" x2="${W - padR}" y1="${y(f.min)}" y2="${y(f.min)}" class="th"/>`;
  days.forEach((k, di) => { const d = parseDay(k); const isT = k === today; g += `<text x="${padL + cw * di + cw / 2}" y="${H - 17}" text-anchor="middle" class="xl ${isT ? "t" : ""}">${isT ? "auj." : DAYS[d.getDay()].slice(0, 3) + "."}</text><text x="${padL + cw * di + cw / 2}" y="${H - 4}" text-anchor="middle" class="xd ${isT ? "t" : ""}">${d.getDate()}</text>`; });
  let line = "";
  /* the line breaks over a missing day, so a gap never looks like a measured trend */
  const slotIx = (p) => p.di * 2 + (p.s === "soir" ? 1 : 0);
  if (pts.length >= 2) line = `<path class="rel-ln" pathLength="1" d="${pts.map((p, i) => `${!i || slotIx(p) - slotIx(pts[i - 1]) > 2 ? "M" : "L"}${x(p.di, p.s).toFixed(1)} ${y(p.r.value).toFixed(1)}`).join(" ")}"/>`;
  const dots = pts.map((p, i) => { const bad = !relROk(f, p.r); return `<circle class="rel-pt ${p.s} ${bad ? "bad" : p.r.peak ? "pk" : ""}" style="--d:${i * 40}ms" cx="${x(p.di, p.s).toFixed(1)}" cy="${y(p.r.value).toFixed(1)}" r="${bad ? 5.5 : 4.5}"/>`; }).join("");
  const anim = S.ui.relChartSeen !== f.id; S.ui.relChartSeen = f.id;
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="${anim ? "anim" : ""}" role="img" aria-label="Températures de ${esc(f.name)} sur 7 jours, ${pts.length} relevés">${g}<line class="cross" id="relCross" y1="${padT}" y2="${H - padB}" x1="0" x2="0" opacity="0"/>${line}${dots}</svg><div class="rel-tip" id="relTip"></div>${pts.length ? "" : `<div class="rel-nodata">Aucun relevé cette semaine</div>`}`;
  const svg = $("svg", el), tip = $("#relTip", el), cross = $("#relCross", el);
  const hide = () => { tip.classList.remove("on"); cross.setAttribute("opacity", 0); $$(".rel-pt.hi", svg).forEach((c) => c.classList.remove("hi")); };
  const show = (ev) => {
    if (!pts.length) return; const bx = svg.getBoundingClientRect(); const px = ev.clientX - bx.left;
    let best = null, bd = 1e9; pts.forEach((p) => { const d = Math.abs(x(p.di, p.s) - px); if (d < bd) { bd = d; best = p; } });
    if (!best || bd > cw) { hide(); return; }
    const cx = x(best.di, best.s), cy = y(best.r.value), bad = !relROk(f, best.r);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", 1);
    $$(".rel-pt", svg).forEach((c) => c.classList.toggle("hi", c.getAttribute("cx") === cx.toFixed(1) && c.getAttribute("cy") === cy.toFixed(1)));
    tip.innerHTML = `<b class="mono" style="color:${bad ? "#FF8DA0" : "#fff"}">${fmt(best.r.value)} °C</b><span>${relSlotCap(best.s)} · ${shortDate(best.r.day)} · ${esc(firstName(nameOf(best.r.uid)))}${best.r.peak ? " · pic de service" : ""}${best.r.editedAt ? " · corrigé" : ""}</span>`;
    tip.classList.add("on"); const tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(W - tw, cx - tw / 2)) + "px"; const th = tip.offsetHeight; tip.style.top = (cy - th - 12 >= -6 ? cy - th - 12 : cy + 14) + "px";
  };
  svg.addEventListener("pointermove", show); svg.addEventListener("pointerdown", show); svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
}
window.addEventListener("resize", debounce(() => { const el = $("#viewport .view:not(.leave) #relChart"); if (el) relDrawChart(el, relFr(el.dataset.id)); }, 150));

/* ───────────────────────── stepper long-press + slider ───────────────────────── */
let holdT = null, holdI = null;
function stepTemp(id, dir) { setTemp(id, Math.round(((S.temp[id] ?? 3) + dir * 0.1) * 10) / 10); }
function setTemp(id, t) {
  const f = relFridgeForKey(id); if (!f) return; if (S.temp[id] === t) return;
  S.temp[id] = t; relTouched().add(id);
  const v = $("#tv-" + id); if (v) { v.innerHTML = `${fmt(t)}<small>°C</small>`; v.style.color = relIn(f, t) ? "" : relPeakOk(f, t, relCtxOf(id, f)) ? "var(--warn)" : "var(--bad)"; v.classList.remove("bump"); void v.offsetWidth; v.classList.add("bump"); }
  const st = $("#ts-" + id); if (st) st.innerHTML = relState(f, t, id);
  const k = $("#tk-" + id); if (k) { const lo = +k.dataset.lo, hi = +k.dataset.hi; k.style.left = Math.max(0, Math.min(100, ((t - lo) / (hi - lo)) * 100)) + "%"; }
  $$(`[data-tlv="${id}"]`).forEach((b) => { b.textContent = `${b.dataset.pre} ${fmt(t)} °C`; });
  if (S.route === "releve") relSyncAll();
  SFX.tick(); buzz(4);
}
/* Touch: nothing changes on finger-down, so a scroll that starts on a stepper or on the scale never edits a temperature.
   Scale: a horizontal drag (or a tap) moves it, a vertical move hands over to page scrolling (touch-action:pan-y).
   Stepper: a tap steps once on release; holding still 380 ms repeats; any scroll cancels. Mouse/pen keep the instant behaviour. */
let relPD = null;
const relHoldClear = () => { clearTimeout(holdT); clearTimeout(holdI); };
document.addEventListener("pointerdown", (e) => {
  SFX.init();
  const touch = e.pointerType === "touch";
  const sc = e.target.closest("[data-scale]");
  if (sc) {
    const id = sc.dataset.scale, lo = +sc.dataset.lo, hi = +sc.dataset.hi; const r = sc.getBoundingClientRect();
    const at = (x) => setTemp(id, Math.round((lo + Math.max(0, Math.min(1, (x - r.left) / r.width)) * (hi - lo)) * 10) / 10);
    const k = $("#tk-" + id); const x0 = e.clientX, y0 = e.clientY; let on = !touch, dead = false;
    if (!touch) { e.preventDefault(); at(e.clientX); k && (k.style.transition = "none"); }
    const mv = (ev) => {
      if (dead) return;
      if (!on) { const dx = Math.abs(ev.clientX - x0), dy = Math.abs(ev.clientY - y0); if (dy > 8 && dy >= dx) { dead = true; return; } if (dx > 6 && dx > dy) { on = true; k && (k.style.transition = "none"); } else return; }
      at(ev.clientX);
    };
    const up = (ev) => { off(); if (touch && !dead && ev.type === "pointerup" && !on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) at(ev.clientX); k && (k.style.transition = ""); };
    const off = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up); return;
  }
  const s = e.target.closest(".step[data-step][data-id]"); if (!s) return;
  const id = s.dataset.id, dir = +s.dataset.step;
  let n = 0; const tick = () => { n++; stepTemp(id, dir); holdI = setTimeout(tick, n < 10 ? 90 : n < 30 ? 45 : 22); };
  relHoldClear();
  if (!touch) { e.preventDefault(); stepTemp(id, dir); n = 1; holdT = setTimeout(tick, 380); return; }
  relPD = { id, dir, x: e.clientX, y: e.clientY, el: s, held: () => n > 0 };
  holdT = setTimeout(() => { if (relPD) tick(); }, 380);
});
document.addEventListener("pointermove", (e) => { if (relPD && Math.hypot(e.clientX - relPD.x, e.clientY - relPD.y) > 10) { relPD = null; relHoldClear(); } }, true);
document.addEventListener("pointerup", (e) => { const p = relPD; relPD = null; relHoldClear(); if (p && !p.held() && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 10) stepTemp(p.id, p.dir); }, true);
document.addEventListener("pointercancel", () => { relPD = null; relHoldClear(); }, true);
document.addEventListener("pointerleave", (e) => { if (e.target.matches && e.target.matches("[data-step]")) { relPD = null; relHoldClear(); } }, true);
window.addEventListener("blur", () => { clearTimeout(holdT); clearTimeout(holdI); });

/* ───────────────────────── commit, advance, undo ───────────────────────── */
function relCorrSheet(f, t, act, id) {
  const back = act === "corr" ? `data-act="sheetClose"` : `data-act="relFixBack" data-id="${id}"`;
  openSheet(`<div style="text-align:center"><span class="ic bad rel-bigic">${ico("alert")}</span><div class="h2" style="margin-top:10px;font-size:21px">${fmt(t)} °C : ${t > f.max ? "trop chaud" : "trop froid"}</div><p class="sub" style="margin:4px 0 0">${esc(f.name)} doit être ${relBetween(f)}. Qu'avez-vous fait ?</p></div>
    ${(act === "corr" || act === "relFixCorr") && relIsService(f) && t > f.max && t <= relSvcMax(f) ? `<button class="rel-act rel-svcopt" data-act="${act === "corr" ? "corrSvc" : "relFixSvc"}" data-id="${id}"><span class="tx"><b>C'est le coup de feu</b><em>Portes souvent ouvertes pendant le service : noté comme pic, toléré jusqu'à ${relDeg(relSvcMax(f))} °C</em></span>${ico("chev")}</button>` : ""}
    <div class="rel-acts">${ACTIONS.map((x) => `<button class="rel-act" data-act="${act}" data-v="${esc(x)}" data-id="${id}">${esc(x)}${ico("chev")}</button>`).join("")}</div>
    <div class="rel-other"><input class="input" id="relActTx" placeholder="Autre action…" autocomplete="off" maxlength="120" aria-label="Autre action corrective"><button class="btn acc" data-act="${act}" data-v="__other" data-id="${id}" aria-label="Valider cette action">${ico("check")}</button></div>
    <button class="btn ghost block" ${back}>${ico("therm")}Changer la température</button>`);
  SFX.err(); buzz([20, 40, 20]);
}
/* the corrective action picked on the sheet (a preset, or the free text) */
function relPickedAction(v) {
  if (v !== "__other") return v;
  const el = $("#relActTx"); const tx = (el && el.value || "").trim();
  if (!tx) { SFX.err(); toast("Décrivez l'action menée.", "err"); el && el.focus(); return null; }
  return tx;
}
function relSetUndo(u, msg) {
  S.ui.relUndo = { ...u, exp: Date.now() + 4200 };
  toastUndo(msg); const b = $("#toastTx button"); if (b) b.dataset.act = "relUndo";
}
function relSlotComplete(day, slot) { return S.fridges.every((fr) => readingsFor(day, slot).find((r) => r.fridgeId === fr.id)); }
function relCelebrate() { S.ui.relCeleb = true; SFX.done(); buzz([12, 40, 12]); setTimeout(() => burst(), 120); }

const relDoneNow = (id) => readingsFor(dayKey(), S.slot).some((r) => r.fridgeId === id);
async function commitReading(id, t, ok, action, extra = {}) {
  const f = relFr(id); const day = dayKey(), slot = S.slot;
  if (S.route === "releve") VIEWS.releve.live = false; /* keep the card on screen for its seal animation */
  let rid; const ph = relPhOf(id); if (ph && !ph.busy && (ph.photoId || ph.photoUrl)) { extra = { ...extra, ...(ph.photoId ? { photoId: ph.photoId } : {}), ...(ph.photoUrl ? { photoUrl: ph.photoUrl } : {}) }; }
  try { rid = await safe(DB.add("readings", { fridgeId: id, fname: f.name, value: t, slot, day, at: Date.now(), uid: S.me.id, ok, action, ...extra })); }
  catch (e) { VIEWS.releve.live = true; refresh(); return; }
  await logEvent("reading", `a relevé ${f.name} · ${fmt(t)} °C${ok ? (extra.peak ? ` · pic pendant le service (toléré jusqu'à ${relDeg(relSvcMax(f))} °C)` : extra.ctx === "service" ? " · pendant le service" : "") : ` · hors seuil${extra.ctx === "service" ? " pendant le service" : ""}, ${action.toLowerCase()}`}${extra.photoId || extra.photoUrl ? " · photo jointe" : ""}`, { ref: id, ...(extra.photoId ? { photoId: extra.photoId } : {}), ...(extra.photoUrl ? { photoUrl: extra.photoUrl } : {}) });
  if (S.ui.relPh) delete S.ui.relPh[id];
  delete S.temp[id]; relTouched().delete(id);
  const complete = relSlotComplete(day, slot);
  relAdvance(id);
  if (complete) { relCelebrate(); relSetUndo({ kind: "add", ids: [rid], fridgeId: id, value: t }, `Relevé du ${slot} terminé`); }
  else { SFX.ok(); buzz(12); relSetUndo({ kind: "add", ids: [rid], fridgeId: id, value: t }, `${extra.peak ? "Pic de service noté · " : relShort(f.name) + " · "}${fmt(t)} °C`); }
}
/* collapse the validated card, expand the next pending one, then re-render once the motion is over */
function relAdvance(doneId) {
  const rs = readingsFor(dayKey(), S.slot); const idx = S.fridges.findIndex((f) => f.id === doneId);
  const order = [...S.fridges.slice(idx + 1), ...S.fridges.slice(0, idx)];
  const next = order.find((f) => !rs.find((r) => r.fridgeId === f.id));
  S.open = next ? next.id : null; S.ui.relJust = new Set([doneId]);
  if (S.route !== "releve") { VIEWS.releve.live = true; return; }
  const view = $("#viewport .view:not(.leave)"); const cur = $(`.fr[data-fr="${doneId}"]`, view); const nx = next && $(`.fr[data-fr="${next.id}"]`, view);
  VIEWS.releve.live = false;
  let shrinkBy = 0; if (cur) { const d = $(".dial", cur); shrinkBy = d ? d.offsetHeight : 0; cur.classList.remove("open"); cur.classList.add("sealing"); }
  if (nx) {
    nx.classList.add("open");
    relScrollToCard(view, nx, cur, shrinkBy);
    if (typeof toastAvoid === "function") toastAvoid(nx);
  }
  clearTimeout(relAdvance._t);
  relAdvance._t = setTimeout(() => { VIEWS.releve.live = true; S.ui.relScroll = next ? next.id : null; if (S.route === "releve") rerender(); }, 560);
}

/* bring the next card (stepper + Valider) fully into the clear band: below the top bar, above the tab bar and the
   undo toast that sits right on top of it. Positions are predicted from the layout the cards are animating to. */
function relScrollToCard(view, nx, cur, shrinkBy) {
  const vr = view.getBoundingClientRect(), nr = nx.getBoundingClientRect();
  const curR = cur && cur.getBoundingClientRect();
  /* the collapsing card only moves the next one up when it sits in an earlier row (one column on phone, two on desktop) */
  const lift = curR && curR.top < nr.top - 4 ? shrinkBy : 0;
  const head = $(".head", nx), inner = $(".dial > div", nx);
  const h = (head ? head.offsetHeight : 60) + (inner ? inner.scrollHeight : 360) + 28;
  const H = window.innerHeight; let bottom = Math.min(vr.bottom, H);
  const tb = $("#tabbar"); if (tb && !tb.classList.contains("hide") && getComputedStyle(tb).display !== "none") bottom = Math.min(bottom, tb.getBoundingClientRect().top);
  const t = $("#toast"); const toastH = t ? Math.max(t.offsetHeight || 0, 56) : 56;
  bottom -= toastH + 22; /* the undo toast is shown right after this call */
  const tp = $(".top", view); const topEdge = Math.max(vr.top, tp && getComputedStyle(tp).position === "sticky" ? tp.getBoundingClientRect().bottom : vr.top) + 12;
  const top = nr.top - lift, end = top + h;
  let dy = 0;
  if (end > bottom) dy = end - bottom; /* lift it above the toast */
  if (top - dy < topEdge) dy = top - topEdge; /* but never past its own header */
  if (Math.abs(dy) > 4) view.scrollTo({ top: Math.max(0, view.scrollTop + dy), behavior: "smooth" });
}

Object.assign(ACT, {
  relPhoto: async (a, key) => {
    SFX.tap(); const [file] = await pickImage(); if (!file) return;
    const P = (S.ui.relPh ||= {}); P[key] = { busy: true }; relPhSync(key);
    try {
      const { blob, canvas } = await shrink(file, 1280, 0.8); const up = await upload(blob || file);
      let photoUrl = /^https?:/.test((up && up.url) || "") ? up.url : "";
      if (!up || !up.id) { if (DB.mode === "demo") photoUrl = up && up.url; else photoUrl = photoUrl || (() => { const k = Math.min(1, 560 / Math.max(canvas.width, canvas.height)); const c = document.createElement("canvas"); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k); c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.55); })(); }
      P[key] = { photoId: (up && up.id) || "", photoUrl, src: (up && up.url) || photoUrl }; SFX.ok(); buzz(8);
    } catch (e) { console.warn(e); delete P[key]; SFX.err(); toast("Photo illisible, réessayez.", "err"); }
    relPhSync(key);
  },
  relPhotoRm: (a, key) => { if (S.ui.relPh) delete S.ui.relPh[key]; SFX.tick(); relPhSync(key); },
  slot: (a, id, v) => { S.slot = v; S.open = null; S.ui.relRingPrev = null; SFX.tick(); rerender(); const vw = $("#viewport .view:not(.leave)"); vw && vw.scrollTo({ top: 0, behavior: "smooth" }); },
  frOpen: (a, id) => { S.open = S.open === id ? "__none" : id; SFX.tap(); $$(".fr[data-fr]").forEach((el) => el.classList.toggle("open", el.dataset.fr === S.open)); },
  saveReading: async (a, id) => {
    const f = relFr(id); const t = S.temp[id];
    if (!f || t == null || isNaN(t) || !relOnce(a)) return;
    if (relDoneNow(id)) { rerender(); return; }
    const ctx = relIsService(f) ? relCtxOf(id, f) : "";
    if (!relIn(f, t)) { if (relPeakOk(f, t, ctx)) { await commitReading(id, t, true, "", { ctx, peak: true }); return; } relCorrSheet(f, t, "corr", id); return; }
    await commitReading(id, t, true, "", ctx ? { ctx } : {});
  },
  corr: async (a, id, v) => { const act = relPickedAction(v); if (!act || !relOnce(a, 2000)) return; const f = relFr(id); if (!f || relDoneNow(id)) { closeSheet(true); return; } closeSheet(true); const ctx = relIsService(f) ? relCtxOf(id, f) : ""; await commitReading(id, S.temp[id], false, act, ctx ? { ctx } : {}); },
  /* « c'est le coup de feu » : the cook explains a service fridge peak instead of declaring a non-conformity */
  corrSvc: async (a, id) => { const f = relFr(id); if (!f || !relOnce(a, 2000)) return; if (relDoneNow(id)) { closeSheet(true); return; } (S.ui.relCtx ||= {})[id] = "service"; closeSheet(true); await commitReading(id, S.temp[id], true, "", { ctx: "service", peak: true }); },
  relFixSvc: async (a, rid) => {
    const r = S.readings.find((x) => x.id === rid); if (!r) return; const f = relFr(r.fridgeId); const t = S.temp["e-" + rid];
    if (!f || t == null || !relOnce(a, 2000)) return;
    await relApplyEdit(r, { value: t, ok: true, action: "", ctx: "service", peak: true }, S.ui.relWhy || "Pic pendant le service", `a corrigé ${f.name} · ${fmt(r.value)} → ${fmt(t)} °C, pic pendant le service (relevé du ${relSlotName(r.slot)} ${shortDate(r.day)})`, `Corrigé · ${fmt(t)} °C`);
  },
  relCtx: (a, key, v) => {
    const f = relFridgeForKey(key); if (!f) return; (S.ui.relCtx ||= {})[key] = v; SFX.tick(); buzz(4);
    const w = a.closest(".rel-ctx"); if (w) { $$("button", w).forEach((b) => { b.classList.toggle("on", b === a); b.setAttribute("aria-pressed", b === a); }); const k = $(".knob", w); if (k) k.style.transform = `translateX(${v === "service" ? "100%" : "0"})`; }
    const t = S.temp[key]; if (t == null) return; const st = $("#ts-" + key); if (st) st.innerHTML = relState(f, t, key);
    const tv = $("#tv-" + key); if (tv) tv.style.color = relIn(f, t) ? "" : relPeakOk(f, t, v) ? "var(--warn)" : "var(--bad)";
  },
  /* an extra reading taken in the middle of the service (frigo detail) */
  relSvcRead: (a, fid) => {
    const f = relFr(fid); if (!f) return; const key = "s-" + fid; const last = S.readings.find((x) => x.fridgeId === fid);
    if (S.temp[key] == null) S.temp[key] = last ? last.value : relTypeOf(f).t;
    openSheet(`<div class="row" style="justify-content:flex-start"><span class="ic warn">${relIco(f)}</span><div style="flex:1;min-width:0"><b class="h3 rel-ell" style="display:block">${esc(f.name)}</b><div class="sub">Relevé pendant le service · ${hm(Date.now())}</div></div></div>
      <div class="dz rel-fixdz">${relDial(key, f, S.temp[key])}</div>
      <p class="note" style="margin:0">Au repos ${relRange(f)}. Pendant le service, jusqu'à <b>${relDeg(relSvcMax(f))} °C</b> est noté comme pic, pas comme non-conformité. Au-delà, une action corrective est demandée.</p>
      <button class="btn acc block" data-act="relSvcSave" data-id="${fid}">${ico("check")}<span data-tlv="${key}" data-pre="Enregistrer">Enregistrer ${fmt(S.temp[key])} °C</span></button>`);
  },
  relSvcSave: async (a, fid) => {
    const f = relFr(fid); const key = "s-" + fid; const t = S.temp[key]; if (!f || t == null || !relOnce(a, 2000)) return;
    if (!relIn(f, t) && !relPeakOk(f, t, "service")) { relCorrSheet(f, t, "relSvcCorr", fid); return; }
    await relSvcCommit(f, t, true, "");
  },
  relSvcCorr: async (a, fid, v) => { const act = relPickedAction(v); const f = relFr(fid); if (!act || !f || !relOnce(a, 2000)) return; await relSvcCommit(f, S.temp["s-" + fid], false, act); },

  relUndo: async () => {
    const u = S.ui.relUndo; if (!u || Date.now() > u.exp) return; S.ui.relUndo = null; $("#toast").classList.remove("on");
    const f = relFr(u.fridgeId);
    if (u.kind === "add") {
      for (const id of u.ids) await DB.del("readings", id).catch(() => {});
      await logEvent("reading", u.ids.length > 1 ? `a annulé ${u.ids.length} relevés validés d'un coup` : `a annulé le relevé ${f ? f.name : ""} · ${fmt(u.value)} °C`, { ref: u.fridgeId });
      if (u.ids.length === 1) { S.open = u.fridgeId; S.temp[u.fridgeId] = u.value; relTouched().add(u.fridgeId); S.ui.relScroll = u.fridgeId; } else S.open = null;
    } else if (u.kind === "del") {
      await DB.set("readings", u.id, u.data).catch(() => {});
      await logEvent("reading", `a restauré le relevé ${f ? f.name : ""} · ${fmt(u.data.value)} °C`, { ref: u.fridgeId });
    } else if (u.kind === "edit") {
      await DB.set("readings", u.id, u.data).catch(() => {});
      await logEvent("reading", `a annulé la correction de ${f ? f.name : ""} · retour à ${fmt(u.data.value)} °C`, { ref: u.fridgeId });
    } else if (u.kind === "fridge") {
      await DB.set("fridges", u.id, u.data).catch(() => {});
      for (const l of u.lots || []) await DB.update("lots", l, { fridgeId: u.id }).catch(() => {});
      await logEvent("fridge", `a annulé la suppression de ${u.data.name}`, { ref: u.id });
      toast(`${relShort(u.data.name, 24)} est de retour`);
    }
    S.ui.relRingPrev = null; SFX.close(); buzz(6);
  },

  /* tout est conforme */
  relAll: () => {
    const rs = readingsFor(dayKey(), S.slot); const pend = S.fridges.filter((f) => !rs.find((r) => r.fridgeId === f.id));
    const okL = pend.filter(relBulkOk), badL = pend.filter((f) => !relBulkOk(f));
    SFX.tap();
    openSheet(`<div><div class="h2" style="font-size:21px">Tout est conforme ?</div><p class="sub" style="margin:4px 0 0">Seules les températures réglées pour ce relevé ${okL.length > 1 ? "seront signées" : "sera signée"} à votre nom pour le ${S.slot}.</p></div>
      <div class="rel-bulk">${okL.map((f) => `<div class="li"><span class="ic ok">${relIco(f)}</span><div class="tx"><b class="rel-ell">${esc(f.name)}</b><em>Seuil ${relRange(f)}</em></div><span class="mono rel-v">${fmt(relSuggest(f))}°</span></div>`).join("")}
      ${badL.map((f) => { const set = relTouched().has(f.id); return `<div class="li rel-skip"><span class="ic">${relIco(f)}</span><div class="tx"><b class="rel-ell">${esc(f.name)}</b><em>${set ? `<span style="color:var(--bad)">Hors seuil : à valider à part</span>` : "Pas encore mesuré : réglez sa température"}</em></div><span class="mono rel-v" style="color:var(--faint)">${set ? fmt(S.temp[f.id]) + "°" : "–"}</span></div>`; }).join("")}</div>
      ${okL.length ? `<button class="btn acc block" data-act="relAllOk">${ico("check")}Valider ${okL.length} relevé${okL.length > 1 ? "s" : ""}</button>` : `<p class="note">Aucun frigo ne peut être validé d'un coup.</p>`}<button class="btn ghost block" data-act="sheetClose">Annuler</button>`);
  },
  relAllOk: async (a) => {
    if (!relOnce(a, 3000)) return;
    const day = dayKey(), slot = S.slot; const rs = readingsFor(day, slot);
    const list = S.fridges.filter((f) => !rs.find((r) => r.fridgeId === f.id) && relBulkOk(f));
    if (!list.length) { closeSheet(true); return; }
    const vals = list.map((f) => relSuggest(f));
    const ids = [], now = Date.now();
    VIEWS.releve.live = false;
    try { for (const [i, f] of list.entries()) { ids.push(await safe(DB.add("readings", { fridgeId: f.id, fname: f.name, value: vals[i], slot, day, at: now + i, uid: S.me.id, ok: true, action: "" }))); delete S.temp[f.id]; relTouched().delete(f.id); } }
    finally { VIEWS.releve.live = true; }
    await logEvent("reading", `a validé ${list.length} relevé${list.length > 1 ? "s" : ""} conforme${list.length > 1 ? "s" : ""} (${slot}) : ${list.map((f, i) => `${f.name} ${fmt(vals[i])} °C`).join(", ")}`);
    closeSheet(true); S.open = null; S.ui.relJust = new Set(list.map((f) => f.id));
    { const left = S.fridges.find((f) => !list.includes(f) && !rs.find((r) => r.fridgeId === f.id)); S.ui.relScroll = left ? left.id : null; }
    if (relSlotComplete(day, slot)) { relCelebrate(); relSetUndo({ kind: "add", ids }, `Relevé du ${slot} terminé`); }
    else { SFX.ok(); buzz(12); relSetUndo({ kind: "add", ids }, `${list.length} relevé${list.length > 1 ? "s" : ""} validé${list.length > 1 ? "s" : ""}`); }
    rerender();
  },

  /* edit a validated reading */
  relEdit: (a, rid) => {
    const r = S.readings.find((x) => x.id === rid); if (!r) return; const f = relFr(r.fridgeId); if (!f) return;
    const other = r.slot === "midi" ? "soir" : "midi";
    const clash = S.readings.find((x) => x.id !== r.id && x.fridgeId === r.fridgeId && x.day === r.day && x.slot === other);
    const canDel = r.uid === S.me.id || ["gerant", "chef"].includes(myRole());
    const vers = [...(r.prev || []), { value: r.value, slot: r.slot, ok: r.ok, at: r.editedAt || r.at, uid: r.editedBy || r.uid, why: r.editReason || "", cur: true }];
    const multiSlot = new Set(vers.map((x) => x.slot || r.slot)).size > 1;
    SFX.tap();
    openSheet(`<div class="rel-eh"><span class="ic ${r.ok ? (r.peak ? "warn" : "ok") : "bad"}">${relIco(f)}</span><div style="flex:1;min-width:0"><b class="h3">${esc(f.name)}</b><div class="sub">Relevé du ${relSlotName(r.slot)} · ${relDayLabel(r.day).toLowerCase()}</div></div><span class="mono rel-ev" style="color:${r.ok ? "var(--ok)" : "var(--bad)"}">${fmt(r.value)}°</span></div>
      ${r.ok ? (r.peak ? `<div class="rel-warn pk">${ico("clock")}<span>Pic pendant le service · toléré jusqu'à ${relDeg(relSvcMax(f) ?? 8)} °C</span></div>` : "") : `<div class="rel-warn">${ico("alert")}<span>${esc(r.action || "Hors seuil")}</span></div>`}
      <div class="rel-opts">
        <button class="rel-opt" data-act="relFix" data-id="${r.id}"><span class="ic">${ico("therm")}</span><span class="tx"><b>Corriger la température</b><em>L'ancienne valeur reste dans l'historique</em></span>${ico("chev")}</button>
        <button class="rel-opt" data-act="relSlot" data-id="${r.id}" ${clash ? "disabled" : ""}><span class="ic">${ico("clock")}</span><span class="tx"><b>Passer au ${other}</b><em>${clash ? `Le relevé du ${other} existe déjà ce jour-là` : `Si ce relevé a été fait le ${other}`}</em></span>${ico("chev")}</button>
        <button class="rel-opt bad" data-act="relDel" data-id="${r.id}" ${canDel ? "" : "disabled"}><span class="ic bad">${ico("trash")}</span><span class="tx"><b>Supprimer le relevé</b><em>${canDel ? "Une confirmation vous sera demandée" : "Réservé au gérant, au chef ou à l'auteur"}</em></span>${ico("chev")}</button>
      </div>
      <div><span class="lbl">${vers.length > 1 ? `Historique · ${vers.length - 1} correction${vers.length > 2 ? "s" : ""}` : "Historique"}</span><div class="rel-hist">${vers.slice().reverse().map((x, i, arr) => `<div class="rel-hv ${x.cur ? "cur" : ""}"><span class="rel-hdot"></span><div class="tx"><b><span class="mono" style="${x.cur ? "" : "text-decoration:line-through;color:var(--muted)"}">${fmt(x.value)} °C</span>${multiSlot ? ` · ${relSlotName(x.slot || r.slot)}` : ""}</b><em>${i === arr.length - 1 ? "Relevé" : "Corrigé"} par ${esc(firstName(nameOf(x.uid)))} · ${when(x.at)}${x.why ? ` · ${esc(x.why)}` : ""}</em></div></div>`).join("")}</div></div>
      <button class="btn ghost block" data-act="sheetClose">Fermer</button>`);
  },
  relFix: (a, rid) => relFixOpen(rid, false),
  relFixBack: (a, rid) => relFixOpen(rid, true),
  relWhy: (a, id, v) => { S.ui.relWhy = S.ui.relWhy === v ? "" : v; $$(".rel-why .chip").forEach((c) => c.classList.toggle("on", c.dataset.v === S.ui.relWhy)); SFX.tick(); },
  relFixSave: async (a, rid) => {
    const r = S.readings.find((x) => x.id === rid); if (!r) return; const f = relFr(r.fridgeId); const t = S.temp["e-" + rid];
    if (!f || t == null || isNaN(t) || !relOnce(a, 2000)) return;
    const ctx = relIsService(f) ? relCtxOf("e-" + rid, f) : "";
    if (t === r.value && ctx === (r.ctx || "")) { closeSheet(); toast("Valeur inchangée"); return; }
    if (!relIn(f, t)) { if (relPeakOk(f, t, ctx)) { await relApplyEdit(r, { value: t, ok: true, action: "", ctx, peak: true }, S.ui.relWhy || "Pic pendant le service", `a corrigé ${f.name} · ${fmt(r.value)} → ${fmt(t)} °C, pic pendant le service (relevé du ${relSlotName(r.slot)} ${shortDate(r.day)})`, `Corrigé · ${fmt(t)} °C`); return; } relCorrSheet(f, t, "relFixCorr", rid); return; }
    await relApplyEdit(r, { value: t, ok: true, action: "", ctx, peak: false }, S.ui.relWhy, `a corrigé ${f.name} · ${fmt(r.value)} → ${fmt(t)} °C (relevé du ${relSlotName(r.slot)} ${shortDate(r.day)})`, `Corrigé · ${fmt(t)} °C`);
  },
  relFixCorr: async (a, rid, v) => {
    const r = S.readings.find((x) => x.id === rid); if (!r) return; const f = relFr(r.fridgeId); const t = S.temp["e-" + rid];
    v = relPickedAction(v); if (!f || !v || t == null || isNaN(t) || !relOnce(a, 2000)) return;
    await relApplyEdit(r, { value: t, ok: false, action: v }, S.ui.relWhy, `a corrigé ${f.name} · ${fmt(r.value)} → ${fmt(t)} °C, hors seuil, ${v.toLowerCase()} (relevé du ${relSlotName(r.slot)} ${shortDate(r.day)})`, `Corrigé · ${fmt(t)} °C`);
  },
  relSlot: async (a, rid) => {
    const r = S.readings.find((x) => x.id === rid); if (!r || a.disabled || !relOnce(a, 2000)) return; const f = relFr(r.fridgeId); if (!f) return; const other = r.slot === "midi" ? "soir" : "midi";
    if (S.readings.find((x) => x.id !== r.id && x.fridgeId === r.fridgeId && x.day === r.day && x.slot === other)) { SFX.err(); toast(`Le relevé du ${other} existe déjà`, "err"); return; }
    await relApplyEdit(r, { slot: other }, "Créneau corrigé", `a déplacé le relevé ${f.name} du ${r.slot} au ${other} (${shortDate(r.day)})`, `Passé au ${other}`);
  },
  relDel: (a, rid) => {
    const r = S.readings.find((x) => x.id === rid); if (!r || a.disabled) return; const f = relFr(r.fridgeId);
    openSheet(`<div style="text-align:center"><span class="ic bad" style="width:56px;height:56px;border-radius:20px;margin:0 auto">${ico("trash")}</span><div class="h2" style="margin-top:10px;font-size:21px">Supprimer ce relevé ?</div><p class="sub" style="margin:4px 0 0">${esc(f.name)} · ${fmt(r.value)} °C · ${relSlotName(r.slot)} ${shortDate(r.day)}. La suppression est notée dans le registre.</p></div>
      <div class="grid2"><button class="btn soft" data-act="relEdit" data-id="${rid}">Annuler</button><button class="btn danger" data-act="relDelOk" data-id="${rid}">Supprimer</button></div>`);
    buzz(10);
  },
  relDelOk: async (a, rid) => {
    const r = S.readings.find((x) => x.id === rid); if (!r || !relOnce(a, 2000)) return; const f = relFr(r.fridgeId); const { id, ...data } = r;
    await safe(DB.del("readings", rid));
    await logEvent("reading", `a supprimé le relevé ${f.name} · ${fmt(r.value)} °C (${r.slot} ${shortDate(r.day)})`, { ref: r.fridgeId });
    closeSheet(true); S.ui.relRingPrev = null; SFX.close(); buzz(10);
    if (r.day === dayKey() && r.slot === S.slot) { S.open = r.fridgeId; S.temp[r.fridgeId] = r.value; relTouched().add(r.fridgeId); }
    relSetUndo({ kind: "del", id: rid, data, fridgeId: r.fridgeId }, "Relevé supprimé");
  },
  relMore: () => { S.ui.relDays = (S.ui.relDays || 7) + 14; SFX.tap(); rerender(); },

  fridgeEdit: (a, id, v) => {
    const f = S.fridges.find((x) => x.id === id);
    const ty = f ? relTypeOf(f) : REL_TYPES.find((t) => t.k === v) || REL_TYPES[0];
    S.ui.fType = ty.k; S.ui.fEditId = f ? f.id : null;
    const name = f ? f.name : relDefaultName(ty);
    openSheet(`<div class="h2" style="font-size:20px">${f ? "Modifier l'équipement" : "Nouvel équipement"}</div>
      <div class="field"><span>Type</span><div class="rel-types">${REL_TYPES.map((t) => `<button class="rel-type ${t.k === ty.k ? "on" : ""}" data-act="fType" data-v="${t.k}" aria-pressed="${t.k === ty.k}">${ico(t.ic)}<b>${esc(t.s)}</b></button>`).join("")}</div></div>
      <label class="field"><span>Nom</span><input class="input" id="fName" value="${esc(name)}" placeholder="Chambre froide 3" autocomplete="off"></label>
      <div class="grid2"><label class="field"><span>Minimum °C</span><span class="rel-num"><input class="input mono" id="fMin" inputmode="decimal" autocomplete="off" value="${relDeg(f ? f.min : ty.min)}"><button type="button" class="rel-sign" data-act="fSign" data-v="fMin" aria-label="Changer le signe">±</button></span></label><label class="field"><span id="fMaxL">${ty.k === "congel" ? "Alerte au-dessus de °C" : "Maximum °C"}</span><span class="rel-num"><input class="input mono" id="fMax" inputmode="decimal" autocomplete="off" value="${relDeg(f ? f.max : ty.max)}"><button type="button" class="rel-sign" data-act="fSign" data-v="fMax" aria-label="Changer le signe">±</button></span></label></div>
      <p class="note" id="fHint" style="margin:-4px 0 0">${esc(ty.hint)}</p>
      <label class="field" id="fSvcW" ${["service", "saladette"].includes(ty.k) ? "" : "hidden"}><span>Toléré pendant le service jusqu'à °C</span><input class="input mono" id="fSvc" inputmode="decimal" autocomplete="off" value="${relDeg(f && f.svcMax != null ? f.svcMax : 8)}"></label>
      <button class="btn acc block" data-act="fridgeSave" data-id="${id || ""}">${ico("check")}Enregistrer</button>${f ? `<button class="btn ghost block" style="color:var(--bad)" data-act="fridgeDel" data-id="${id}">${ico("trash")}Supprimer cet équipement</button>` : ""}`);
  },
  fType: (a, id, v) => {
    const ty = REL_TYPES.find((t) => t.k === v); if (!ty) return; S.ui.fType = v;
    $$(".rel-type").forEach((b) => { b.classList.toggle("on", b.dataset.v === v); b.setAttribute("aria-pressed", b.dataset.v === v); });
    const nm = $("#fName"); const cur = nm.value.trim();
    if (!cur || (!S.ui.fEditId && relNameIsDefault(cur))) nm.value = relDefaultName(ty);
    $("#fMin").value = relDeg(ty.min); $("#fMax").value = relDeg(ty.max);
    $("#fMaxL").textContent = ty.k === "congel" ? "Alerte au-dessus de °C" : "Maximum °C"; $("#fHint").textContent = ty.hint;
    const sw = $("#fSvcW"); if (sw) sw.hidden = !["service", "saladette"].includes(ty.k);
    [$("#fMin"), $("#fMax")].forEach((el) => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
    SFX.tick(); buzz(4);
  },
  /* iOS decimal keypads have no minus key: freezers need one */
  fSign: (a, id, v) => {
    const el = $("#" + v); if (!el) return; const x = el.value.trim();
    el.value = x.startsWith("-") || x.startsWith("−") ? x.slice(1) : "-" + (x || "0");
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); SFX.tick(); buzz(4);
  },
  fridgeSave: async (a, id) => {
    const name = $("#fName").value.trim().replace(/\s+/g, " "), rd = (v) => num(String(v).replace("−", "-")), min = rd($("#fMin").value), max = rd($("#fMax").value), type = S.ui.fType || "frigo";
    const bad = (msg, el) => { SFX.err(); toast(msg, "err"); if (el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); } };
    if (!name) return bad("Donnez un nom à l'équipement.", $("#fName"));
    if (S.fridges.some((f) => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) return bad("Ce nom est déjà pris.", $("#fName"));
    if (min == null) return bad("Le minimum doit être un nombre, par exemple 0 ou -18.", $("#fMin"));
    if (max == null) return bad("Le maximum doit être un nombre, par exemple 4 ou -15.", $("#fMax"));
    if (min < -60 || min > 30 || max < -60 || max > 30) return bad("Les seuils doivent être entre -60 et 30 °C.", min < -60 || min > 30 ? $("#fMin") : $("#fMax"));
    if (min >= max) return bad("Le minimum doit être plus bas que le maximum.", $("#fMin"));
    const isSvc = ["service", "saladette"].includes(type); const sv = isSvc ? rd($("#fSvc").value) : null;
    if (isSvc && (sv == null || sv <= max || sv > 12)) return bad(`Le seuil toléré en service doit être entre ${relDeg(max)} et 12 °C.`, $("#fSvc"));
    if (!relOnce(a, 2000)) return;
    const lo = Math.round(min * 10) / 10, hi = Math.round(max * 10) / 10;
    try {
      if (id) {
        const f = relFr(id); if (!f) { closeSheet(true); return; }
        await safe(DB.update("fridges", id, { name, min: lo, max: hi, type, ...(isSvc ? { svcMax: Math.round(sv * 10) / 10 } : {}) }));
        if (f.name !== name || f.min !== lo || f.max !== hi || f.type !== type) await logEvent("fridge", `a modifié ${f.name}${f.name !== name ? ` → ${name}` : ""} · ${relTypeOf({ type }).s.toLowerCase()} · seuil ${relDeg(lo)} à ${relDeg(hi)} °C${f.min !== lo || f.max !== hi ? ` (avant ${relDeg(f.min)} à ${relDeg(f.max)} °C)` : ""}`, { ref: id });
      } else {
        const order = S.fridges.reduce((m, f) => Math.max(m, f.order ?? 0), -1) + 1;
        await safe(DB.add("fridges", { name, min: lo, max: hi, type, order, createdAt: Date.now(), ...(isSvc ? { svcMax: Math.round(sv * 10) / 10 } : {}) }));
        await logEvent("fridge", `a ajouté ${name} · seuil ${relDeg(lo)} à ${relDeg(hi)} °C`);
      }
    } catch (e) { return; }
    closeSheet(true); SFX.ok(); buzz(12); toast(id ? "Équipement mis à jour" : `Ajouté : ${relShort(name, 26)}`);
  },
  fridgeOrder: () => { openSheet(relOrderHtml()); },
  fMove: async (a, id, v) => {
    if (a.disabled) return;
    const arr = S.fridges.slice(); const i = arr.findIndex((f) => f.id === id), j = i + +v; if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    for (const [k, f] of arr.entries()) if (f.order !== k) await DB.update("fridges", f.id, { order: k }).catch(() => {});
    S.fridges = arr.map((f, k) => ({ ...f, order: k }));
    SFX.tick(); buzz(5);
    $("#sheetBody").innerHTML = relOrderHtml(); const el = $(`#sheetBody .rel-ord[data-fid="${id}"]`); if (el) el.classList.add("rel-moved");
  },
  fridgeDel: (a, id) => {
    const f = relFr(id); if (!f) return; const n = activeLots().filter((l) => l.fridgeId === id).length; const others = S.fridges.filter((x) => x.id !== id);
    const nr = S.readings.filter((r) => r.fridgeId === id).length;
    if (n && others.length && !others.some((x) => x.id === S.ui.relMoveTo)) S.ui.relMoveTo = (others.find((x) => relTypeOf(x).k === relTypeOf(f).k) || others[0]).id;
    openSheet(`<div style="text-align:center"><span class="ic bad rel-bigic">${ico("trash")}</span><div class="h2" style="margin-top:10px;font-size:21px">Supprimer ${esc(f.name)} ?</div><p class="sub" style="margin:4px 0 0">${nr > 1 ? `Ses ${nr} relevés restent dans le registre.` : nr ? "Son relevé reste dans le registre." : "Aucun relevé à conserver."}${n ? ` ${n} produit${n > 1 ? "s y sont" : " y est"} encore rangé${n > 1 ? "s" : ""}.` : ""}</p></div>
      ${n && others.length ? `<div class="field"><span>Déplacer ${n > 1 ? "les produits" : "le produit"} vers</span><div class="rel-mv">${others.map((x) => `<button class="chip ${x.id === S.ui.relMoveTo ? "on" : ""}" data-act="fMoveTo" data-v="${x.id}" data-id="${id}">${esc(x.name)}</button>`).join("")}</div></div>` : ""}
      <div class="grid2"><button class="btn soft" data-act="fridgeEdit" data-id="${id}">Annuler</button><button class="btn danger" data-act="fridgeDelOk" data-id="${id}">Supprimer</button></div>`);
    buzz(10);
  },
  fMoveTo: (a, id, v) => { S.ui.relMoveTo = v; $$(".rel-mv .chip").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); SFX.tick(); },
  fridgeDelOk: async (a, id) => {
    const f = relFr(id); if (!f || !relOnce(a, 2000)) return; const { id: _x, ...data } = f;
    const lots = activeLots().filter((l) => l.fridgeId === id); const to = relFr(S.ui.relMoveTo) && S.ui.relMoveTo !== id ? S.ui.relMoveTo : null;
    try { await safe(DB.del("fridges", id)); } catch (e) { return; }
    const moved = [];
    if (to) for (const l of lots) { await DB.update("lots", l.id, { fridgeId: to }).catch(() => {}); moved.push(l.id); }
    await logEvent("fridge", `a supprimé ${f.name}${moved.length ? ` · ${moved.length} produit${moved.length > 1 ? "s" : ""} déplacé${moved.length > 1 ? "s" : ""} vers ${fridgeName(to)}` : ""}`, { ref: id });
    delete S.temp[id]; if (S.open === id) S.open = null;
    closeSheet(true); SFX.close(); buzz(10);
    relSetUndo({ kind: "fridge", id, data, lots: moved, fridgeId: id }, `Supprimé : ${relShort(f.name, 22)}`);
    if (S.route === "frigo") goBack();
  },
  relGoRead: (a, id) => { SFX.tap(); S.slot = slotNow(); S.open = id; S.ui.relScroll = id; go("releve"); },
});

function relFixOpen(rid, keep) {
  const r = S.readings.find((x) => x.id === rid); if (!r) return; const f = relFr(r.fridgeId); if (!f) return; const key = "e-" + rid;
  if (!keep || S.temp[key] == null) { S.temp[key] = r.value; S.ui.relWhy = ""; }
  const t = S.temp[key];
  openSheet(`<div class="row" style="justify-content:flex-start"><button class="iconbtn" data-act="relEdit" data-id="${rid}" aria-label="Retour">${ico("back")}</button><div style="flex:1;min-width:0"><b class="h3 rel-ell" style="display:block">Corriger ${esc(f.name)}</b><div class="sub">Relevé du ${relSlotName(r.slot)} · avant ${fmt(r.value)} °C</div></div></div>
    <div class="dz rel-fixdz">${relDial(key, f, t)}${relIsService(f) ? relCtxHtml(key, f) : ""}</div>
    <div class="field"><span>Pourquoi ? (facultatif)</span><div class="rel-why">${["Faute de frappe", "Thermomètre mal lu", "Nouvelle mesure", "Mauvais frigo"].map((w) => `<button class="chip ${S.ui.relWhy === w ? "on" : ""}" data-act="relWhy" data-v="${w}">${w}</button>`).join("")}</div></div>
    <button class="btn acc block" data-act="relFixSave" data-id="${rid}">${ico("check")}<span data-tlv="${key}" data-pre="Enregistrer">Enregistrer ${fmt(t)} °C</span></button>`);
}
function relDefaultName(ty) {
  const names = new Set(S.fridges.map((f) => f.name.toLowerCase())); if (!names.has(ty.s.toLowerCase())) return ty.s;
  let i = 2; while (names.has(`${ty.s} ${i}`.toLowerCase())) i++; return `${ty.s} ${i}`;
}
const relNameIsDefault = (v) => REL_TYPES.some((t) => { const s = t.s.toLowerCase(); const x = v.toLowerCase(); return x === s || (x.startsWith(s + " ") && /^\d+$/.test(x.slice(s.length + 1))); });

/* write a correction with its audit trail: every superseded version is kept in prev[] */
async function relApplyEdit(r, patch, why, logText, msg) {
  const { id, ...before } = r;
  const snap = { value: r.value, slot: r.slot, ok: r.ok, action: r.action || "", at: r.editedAt || r.at, uid: r.editedBy || r.uid, why: r.editReason || "" };
  const upd = { ...patch, prev: [...(r.prev || []), snap], editedAt: Date.now(), editedBy: S.me.id, editReason: why || "" };
  await safe(DB.update("readings", id, upd));
  await logEvent("reading", logText, { ref: r.fridgeId });
  closeSheet(true); delete S.temp["e-" + id]; S.ui.relRingPrev = null;
  if (patch.ok === false) { SFX.err(); buzz([20, 40, 20]); } else { SFX.ok(); buzz(12); }
  if (patch.slot && S.route === "releve" && r.day === dayKey() && patch.slot === S.slot) { const after = S.readings.map((x) => (x.id === id ? { ...x, slot: patch.slot } : x)); if (S.fridges.every((fr) => after.find((x) => x.fridgeId === fr.id && x.day === r.day && x.slot === S.slot))) relCelebrate(); }
  relSetUndo({ kind: "edit", id, data: before, fridgeId: r.fridgeId }, msg);
}
function relOrderHtml() {
  const rows = S.fridges.map((f, i) => `<div class="li rel-ord" data-fid="${f.id}"><span class="ic">${relIco(f)}</span><div class="tx"><b class="rel-ell">${esc(f.name)}</b><em>${relRange(f)}</em></div><button class="iconbtn" data-act="fMove" data-id="${f.id}" data-v="-1" aria-label="Monter" ${i === 0 ? "disabled" : ""}>${ico("up")}</button><button class="iconbtn" data-act="fMove" data-id="${f.id}" data-v="1" aria-label="Descendre" ${i === S.fridges.length - 1 ? "disabled" : ""}>${ico("down")}</button><button class="iconbtn" data-act="fridgeEdit" data-id="${f.id}" aria-label="Modifier">${ico("edit")}</button></div>`).join("");
  return `<div><div class="h2" style="font-size:20px">Ordre des équipements</div><p class="sub" style="margin:4px 0 0">C'est l'ordre du relevé : suivez le sens de votre tournée.</p></div><div class="rel-ordl">${rows}</div><button class="btn soft block" data-act="sheetClose">Terminé</button>`;
}

/* ───────────────────────── service context on a reading ───────────────────────── */
function relCtxHtml(key, f) {
  const c = relCtxOf(key, f) === "service";
  return `<div class="rel-ctxw"><div class="seg rel-ctx" role="group" aria-label="Moment du relevé"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${c ? "100%" : "0"})"></span><button class="${c ? "" : "on"}" data-act="relCtx" data-id="${key}" data-v="" aria-pressed="${!c}">Au repos</button><button class="${c ? "on" : ""}" data-act="relCtx" data-id="${key}" data-v="service" aria-pressed="${c}">${ico("clock")}Pendant le service</button></div><p class="rel-ctxn">Pendant le service, jusqu'à ${relDeg(relSvcMax(f))} °C est noté comme pic de service.</p></div>`;
}
async function relSvcCommit(f, t, ok, action) {
  const peak = ok && !relIn(f, t);
  try { await safe(DB.add("readings", { fridgeId: f.id, fname: f.name, value: t, slot: slotNow(), day: dayKey(), at: Date.now(), uid: S.me.id, ok, action, ctx: "service", ...(peak ? { peak: true } : {}), mid: true })); } catch (e) { return; }
  await logEvent("reading", `a relevé ${f.name} pendant le service · ${fmt(t)} °C${peak ? " · pic toléré" : ok ? "" : ` · hors seuil, ${action.toLowerCase()}`}`, { ref: f.id });
  delete S.temp["s-" + f.id]; closeSheet(true);
  if (ok) { SFX.ok(); buzz(12); toast(peak ? `Pic de service noté · ${fmt(t)} °C` : `Relevé noté · ${fmt(t)} °C`); } else { SFX.err(); buzz([20, 40, 20]); toast(`Hors seuil noté · ${fmt(t)} °C`, "err"); }
}

/* ───────────────────────── service: frigos banner, frigo detail cards ───────────────────────── */
function relSvcBanner() {
  const fs = svcFridges();
  if (!fs.length) return `<div class="glass pad st rel-svcb none" style="--i:1"><div class="hstack"><span class="ic">${ico("svcCounter")}</span><div style="flex:1;min-width:0"><b class="h3">Frigos de service</b><div class="sub">Indiquez les frigos sous vos plans de travail : vous suivrez ce qui sort de la chambre froide pour le service, et ce qui y revient.</div></div></div><button class="btn soft block" style="margin-top:12px" data-act="fridgeEdit" data-v="service">${ico("plus")}Ajouter un frigo de service</button></div>`;
  const ls = svcInService(); const old = ls.length ? Math.max(...ls.map((l) => svcMin(l) || 0)) : null; const tone = svcTone(old);
  return `<div class="glass pad st rel-svcb ${ls.length ? tone : ""}" style="--i:1"><div class="hstack"><span class="ic ${ls.length && tone !== "ok" ? tone : ""}">${ico("svcCounter")}</span><div style="flex:1;min-width:0"><b class="h3">${ls.length ? `${ls.length} produit${ls.length > 1 ? "s" : ""} en service` : "Service"}</b><div class="sub">${ls.length ? `Depuis ${svcDur(old)} pour le plus ancien${old >= 240 ? " · à remettre au froid" : ""}` : "Rien en frigo de service. Préparez la mise en place."}</div></div></div>
    <div class="grid2" style="margin-top:12px"><button class="btn soft" data-go="service" data-id="mep">${ico("svcGo")}Mise en place</button><button class="btn ${ls.length ? "acc" : "soft"}" data-go="service" data-id="ret">${ico("svcBack")}Retour${ls.length ? ` (${ls.length})` : ""}</button></div></div>`;
}
function relSvcCard(f, lots) {
  const sv = lots.filter((l) => l.svcAt); const old = sv.length ? Math.max(...sv.map(svcMin)) : null;
  return `<div class="glass pad st rel-svcc" style="--i:3"><div class="row"><span class="lbl">Service</span>${old != null ? `<span class="pill ${svcTone(old)}">${ico("clock")}Depuis ${svcDur(old)}</span>` : ""}</div>
    <p class="note" style="margin:6px 0 12px">Au repos ${relRange(f)}. Pendant le service, jusqu'à ${relDeg(relSvcMax(f))} °C est toléré : ne laissez pas les produits trop longtemps, remettez-les au froid après le coup de feu.</p>
    <div class="grid2"><button class="btn soft" data-act="relSvcRead" data-id="${f.id}">${ico("therm")}Relevé en service</button>${lots.length ? `<button class="btn acc" data-act="svcAllBack" data-id="${f.id}">${ico("svcBack")}Tout remettre</button>` : `<button class="btn soft" data-go="service" data-id="mep">${ico("svcGo")}Mise en place</button>`}</div></div>`;
}
function relMepCard(f, lots) {
  if (!svcFridges().length || !lots.length) return "";
  return `<button class="btn soft block st rel-mepb" style="--i:3" data-act="relMepFrom" data-id="${f.id}">${ico("svcGo")}Mise en place depuis ce frigo</button>`;
}
/* contents of a fridge, each with its one-tap move: back to the cold room, or out for the service */
function relLotRows(lots, isSvc) {
  if (!lots.length) return `<div class="empty" style="padding:16px 0 4px">${isSvc ? "Rien ici pour l'instant. En début de service, sortez les produits de la chambre froide : ils s'affichent ici avec leur temps passé hors du froid." : "Aucun produit. Ils arrivent ici à chaque réception, ou en scannant une étiquette."}</div>`;
  const mep = svcTo();
  return `<div style="margin-top:4px">${lots.map((l, i) => `<div class="li tap rel-lrow" data-act="lot" data-id="${l.id}" role="button" tabindex="0" aria-label="${esc(l.name)}"><span class="rank ${(daysUntil(dlcOf(l)) ?? 9) <= 1 ? "hot" : ""}">${i + 1}</span><div class="tx"><b>${esc(l.name)}${l.qty ? ` · ${fmt(num(l.qty), num(l.qty) % 1 ? 2 : 0)} ${esc(relUnit(num(l.qty), l.unit))}` : ""}</b><em>${isSvc && l.svcAt ? `Sorti à ${hm(l.svcAt)} de ${esc(fridgeName(l.svcFrom))}` : l.status === "opened" ? `Ouvert le ${shortDate(dayKey(new Date(l.openedAt)))}` : `Entré le ${shortDate(dayKey(new Date(l.createdAt)))}`}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</em></div>${isSvc ? svcDwellPill(l) || dlcPill(dlcOf(l)) : dlcPill(dlcOf(l))}${isSvc ? `<button class="iconbtn rel-mv1" data-act="svcBackOne" data-id="${l.id}" aria-label="Remettre en chambre froide">${ico("svcBack")}</button>` : mep ? `<button class="iconbtn rel-mv1" data-act="svcMep" data-id="${l.id}" data-v="${mep}" aria-label="Mise en place">${ico("svcGo")}</button>` : `<button class="iconbtn rel-mv1" data-act="lotMoveAsk" data-id="${l.id}" aria-label="Déplacer">${ico("move")}</button>`}</div>`).join("")}</div>`;
}

/* ───────────────────────── Service: mise en place / retour ───────────────────────── */
const svcBackChoices = () => { const cf = svcStores().filter((f) => relTypeOf(f).k === "cfp"); return cf.length ? cf : svcStores(); };
NAV.splice(Math.max(0, NAV.findIndex((n) => n[0] === "frigos")) + 1, 0, ["service", "svcCounter", "Service"]);
TAB_OF.service = "frigos";
VIEWS.service = {
  nav: "service",
  render({ id } = {}) {
    const fs = svcFridges(), inS = svcInService();
    const tab = id === "mep" || id === "ret" ? id : S.ui.svcTab || (inS.length ? "ret" : "mep"); S.ui.svcTab = tab;
    const top = topBar("Service", { right: fs.length ? `<button class="btn soft sm" data-act="svcScanGo" data-v="${tab}">${ico("scan")}Scanner</button>` : "" });
    if (!fs.length) return `<div class="inner narrow">${top}<div class="glass empty st" style="--i:1"><div class="ic">${ico("svcCounter")}</div><b>Aucun frigo de service</b>En début de service, on sort une partie du stock de la chambre froide (par exemple 5 lanières d'huîtres sur 20) vers les frigos sous le plan de travail, puis on remet le reste au froid à la fin. Ajoutez vos frigos de service pour suivre tout ça en un scan.<div style="margin-top:14px"><button class="btn acc" data-act="fridgeEdit" data-v="service">${ico("plus")}Ajouter un frigo de service</button></div></div></div>`;
    const seg = `<div class="seg st rel-svcseg" style="--i:1"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "ret" ? "100%" : "0"})"></span><button class="${tab === "mep" ? "on" : ""}" data-act="svcTab" data-v="mep">${ico("svcGo")}Mise en place</button><button class="${tab === "ret" ? "on" : ""}" data-act="svcTab" data-v="ret">${ico("svcBack")}Retour${inS.length ? ` <em class="rel-svcn">${inS.length}</em>` : ""}</button></div>`;
    return `<div class="inner narrow rel-svc">${top}${seg}${tab === "mep" ? relMepHtml(fs, inS) : relRetHtml(inS)}</div>`;
  },
};
function relMepHtml(fs, inS) {
  const to = svcTo(); const from = S.ui.svcFrom && relFr(S.ui.svcFrom) && !relIsService(relFr(S.ui.svcFrom)) ? S.ui.svcFrom : "";
  const stores = svcStores().filter((f) => !from || f.id === from);
  const groups = stores.map((f) => ({ f, ls: activeLots().filter((l) => l.fridgeId === f.id).sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr")) })).filter((g) => g.ls.length);
  const n = groups.reduce((s, g) => s + g.ls.length, 0); let k = 3;
  return `<div class="glass pad st" style="--i:2"><span class="lbl">Vers</span><div class="chips svc-to" style="margin-top:8px">${fs.map((f) => `<button class="chip ${to === f.id ? "on" : ""}" data-act="svcTo" data-v="${f.id}">${relIco(f)}${esc(f.name)}</button>`).join("")}</div>
      ${inS.length ? `<button class="rel-svcin" data-act="svcTab" data-v="ret"><span>Déjà en service : <b>${inS.length} produit${inS.length > 1 ? "s" : ""}</b></span>${ico("chev")}</button>` : ""}</div>
    ${from ? `<div class="rel-svcf st" style="--i:2"><span>Depuis <b>${esc(fridgeName(from))}</b></span><button class="btn ghost sm" data-act="relMepFrom" data-id="">Tous les frigos</button></div>` : ""}
    ${n > 8 ? `<div class="st" style="--i:2"><input class="input" id="svcFind" placeholder="Chercher un produit…" autocomplete="off" aria-label="Chercher un produit"></div>` : ""}
    ${groups.length ? groups.map((g) => `<div class="glass pad st rel-svcg" style="--i:${Math.min(k++, 10)}"><div class="row"><span class="hstack" style="gap:8px;min-width:0"><span class="ic sm">${relIco(g.f)}</span><b class="h3 rel-ell">${esc(g.f.name)}</b></span><span class="sub">${g.ls.length}</span></div>
      ${g.ls.map((l) => `<div class="li tap rel-mrow" data-act="svcMep" data-id="${l.id}" data-v="${to}" data-q="${esc((l.name || "").toLowerCase())}" role="button" tabindex="0"><div class="tx"><b>${esc(l.name)}</b><em>${lbQty(l) ? esc(lbQty(l)) + " · " : ""}${dlcOf(l) ? `DLC ${shortDate(dlcOf(l))}` : "Sans DLC"}${l.lot ? ` · lot ${esc(l.lot)}` : ""}</em></div>${(daysUntil(dlcOf(l)) ?? 9) <= 1 ? dlcPill(dlcOf(l)) : ""}<span class="rel-go">${ico("svcGo")}</span></div>`).join("")}</div>`).join("")
      : `<div class="glass empty st" style="--i:3"><div class="ic">${ico("coldroom")}</div><b>Chambre froide vide</b>Les produits arrivent ici à chaque réception. Ensuite, touchez-en un ou scannez son étiquette pour le sortir.</div>`}
    <p class="note st" style="--i:11;text-align:center">Touchez un produit, choisissez combien en sortir. Le reste reste en chambre froide, avec la même étiquette et la même DLC.</p>`;
}
function relRetHtml(inS) {
  if (!inS.length) return `<div class="glass empty st" style="--i:2"><div class="ic" style="background:rgba(7,138,94,.1);color:var(--ok)">${ico("check")}</div><b>Tout est au froid</b>Aucun produit en frigo de service. En début de service, sortez ce qu'il vous faut : ils s'afficheront ici pour le retour.<div style="margin-top:14px"><button class="btn soft" data-act="svcTab" data-v="mep">${ico("svcGo")}Mise en place</button></div></div>`;
  const old = Math.max(...inS.map((l) => svcMin(l) || 0)); const tone = svcTone(old); const back = svcBackPref();
  const groups = svcFridges().map((f) => ({ f, ls: inS.filter((l) => l.fridgeId === f.id).sort((a, b) => (a.svcAt || 0) - (b.svcAt || 0)) })).filter((g) => g.ls.length);
  let k = 4;
  const row = (l) => {
    const have = svcNum(l); const left = S.ui.svcLeft && S.ui.svcLeft[l.id] != null ? S.ui.svcLeft[l.id] : have;
    return `<div class="rel-srow svc-row" data-row="${l.id}"><div class="rel-srh" data-act="lot" data-id="${l.id}" role="button" tabindex="0"><div class="tx"><b>${esc(l.name)}</b><em>Sorti à ${l.svcAt ? hm(l.svcAt) : "–"}${l.svcFrom ? ` de ${esc(fridgeName(l.svcFrom))}` : ""} · retour en ${esc(relShort(fridgeName(svcBackFor(l)), 20))}</em></div>${svcDwellPill(l)}</div>
      <div class="rel-srb">${have != null ? `<div class="rel-left"><button class="step" data-act="svcLeft" data-id="${l.id}" data-v="-1" aria-label="Moins">${ico("minus")}</button><label><input class="mono" data-svcleft="${l.id}" inputmode="decimal" autocomplete="off" value="${fmt(left, svcDec(left))}" aria-label="Reste de ${esc(l.name)}"><small>${esc(relUnit(left, l.unit))} rest${left > 1 ? "ent" : "e"}</small></label><button class="step" data-act="svcLeft" data-id="${l.id}" data-v="1" aria-label="Plus">${ico("plus")}</button></div>` : `<span class="sub" style="flex:1">Tout le lot</span>`}
      <button class="btn ${left === 0 ? "soft" : "acc"} sm rel-sback" data-act="svcBackOne" data-id="${l.id}">${left === 0 ? `${ico("lbDone")}Tout utilisé` : `${ico("svcBack")}Remettre`}</button></div></div>`;
  };
  return `<div class="glass pad st rel-svcsum ${tone}" style="--i:2"><div class="hstack"><span class="rel-svcbig ${tone}"><b class="mono">${inS.length}</b><small>produit${inS.length > 1 ? "s" : ""}</small></span><div style="flex:1;min-width:0"><b class="h3">En frigo de service</b><div class="sub">Le plus ancien depuis <b>${svcDur(old)}</b>.${old >= 240 ? " Remettez-les au froid : un produit ne doit pas rester longtemps au-dessus de 4 °C." : old >= 120 ? " Pensez au retour en chambre froide dès la fin du coup de feu." : " Réglez les restes, puis remettez tout au froid."}</div></div></div>
      <span class="lbl" style="display:block;margin-top:14px">Remettre dans</span><div class="chips svc-to" style="margin-top:8px"><button class="chip ${back === "orig" ? "on" : ""}" data-act="svcBackTo" data-v="orig">Son frigo d'origine</button>${svcBackChoices().map((f) => `<button class="chip ${back === f.id ? "on" : ""}" data-act="svcBackTo" data-v="${f.id}">${esc(f.name)}</button>`).join("")}</div></div>
    ${groups.map((g) => { const r = S.readings.find((x) => x.fridgeId === g.f.id); return `<div class="glass pad st rel-svcg" style="--i:${Math.min(k++, 10)}"><div class="row"><span class="hstack" style="gap:8px;min-width:0"><span class="ic sm">${relIco(g.f)}</span><b class="h3 rel-ell">${esc(g.f.name)}</b></span>${r ? `<span class="mono rel-svct" style="color:${relROk(g.f, r) ? (r.peak ? "var(--warn)" : "var(--ok)") : "var(--bad)"}">${fmt(r.value)}°<small>${relAgo(r.at)}</small></span>` : ""}</div>${g.ls.map(row).join("")}</div>`; }).join("")}
    <div class="ctabar"><button class="btn acc block lb-big" data-act="svcAllBack">${ico("svcBack")}Tout remettre en chambre froide (${inS.length})</button></div>
    <p class="note" style="text-align:center">Mettez le reste à 0 pour ce qui a été entièrement utilisé. Ce qui revient est regroupé avec le lot d'origine, avec sa traçabilité.</p>`;
}
Object.assign(ACT, {
  svcTab: (a, id, v) => {
    if (S.route !== "service") { go("service", { id: v }); return; }
    S.ui.svcTab = v; S.params = { id: v }; SFX.tick(); buzz(5);
    const seg = $("#viewport .view:not(.leave) .rel-svcseg"); if (seg && a.closest(".rel-svcseg")) { $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${v === "ret" ? "100%" : "0"})`; setTimeout(rerender, 200); }
    else { rerender(); const vw = $("#viewport .view:not(.leave)"); vw && vw.scrollTo({ top: 0, behavior: "smooth" }); }
  },
  svcScanGo: (a, id, v) => { LB.mode = "svc"; LB.batch = []; LB.seen = {}; svcSave({ dir: v === "ret" ? "ret" : "mep" }); SFX.tap(); go("scan"); },
  relMepFrom: (a, id) => { S.ui.svcFrom = id || ""; SFX.tap(); if (S.route === "service") rerender(); else go("service", { id: "mep" }); },
  svcLeft: (a, id, v) => {
    const l = svcGet(id); const have = svcNum(l); if (!l || have == null) return; S.ui.svcLeft = S.ui.svcLeft || {};
    const st = svcStepOf(l); const cur = S.ui.svcLeft[id] != null ? S.ui.svcLeft[id] : have;
    const n = Math.max(0, Math.min(have, Math.round((cur + +v * st) * 1000) / 1000)); S.ui.svcLeft[id] = n; SFX.tick(); buzz(4);
    const row = a.closest(".svc-row"); if (!row) return; const i = $("[data-svcleft]", row); if (i) { i.value = fmt(n, svcDec(n)); i.classList.remove("bump"); void i.offsetWidth; i.classList.add("bump"); }
    const sm = $(".rel-left small", row); if (sm) sm.textContent = `${relUnit(n, l.unit)} rest${n > 1 ? "ent" : "e"}`;
    relSyncBackBtn(row, n);
  },
});
function relSyncBackBtn(row, n) { const b = $(".rel-sback", row); if (!b) return; b.classList.toggle("acc", n !== 0); b.classList.toggle("soft", n === 0); b.innerHTML = n === 0 ? `${ico("lbDone")}Tout utilisé` : `${ico("svcBack")}Remettre`; }
document.addEventListener("input", (e) => {
  const t = e.target; if (!t) return;
  if (t.id === "svcFind") { const q = t.value.trim().toLowerCase(); $$("#viewport .view:not(.leave) .rel-mrow").forEach((r) => { r.hidden = !!q && !r.dataset.q.includes(q); }); $$("#viewport .view:not(.leave) .rel-svcg").forEach((g) => { g.hidden = !$$(".rel-mrow", g).some((r) => !r.hidden); }); }
  if (t.dataset && t.dataset.svcleft) { const row = t.closest(".svc-row"); const n = num(t.value); if (row && n != null) relSyncBackBtn(row, n); }
});
/* the dwell times tick: refresh the screens that show them once a minute */
setInterval(() => { if (S.ready && ["service", "frigo", "frigos"].includes(S.route) && !document.hidden) refresh(); }, 60000);

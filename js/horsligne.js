/* ───────────────────────── Hors ligne (js/horsligne.js) ─────────────────────────
   The Wi-Fi drops in the middle of service: orders, kitchen screen, temperatures, labels… keep working on this device and are sent
   the moment the network is back. Firestore already does the hard part (js/auth.js turns its offline cache on: every read is kept on the
   device, every write is queued, even across a restart). This file makes it reliable and visible:
   - NET.off also catches the Wi-Fi that is « connected » but reaches nothing (navigator.onLine lies there): a write that stays
     unacknowledged makes us ping the server; core DB.dbw then stops waiting 1.5 s per write.
   - every write joins a visible queue (core DB.dbw → NET.track) with a French label, kept across a restart (gg-netq);
   - a capsule above the tab bar: « Hors ligne · 3 en attente » → « Envoi 2/3 » → « Tout est à jour », each saved change flying into it;
   - its sheet (also Réglages › Hors ligne): what is waiting, what works without network, and « Tester une coupure » (a real Firestore
     disableNetwork with an account, a simulation in the demo) so a restaurant can try it before the day it happens;
   - coming back, Firestore's reconnect backoff is reset so the queue leaves at once instead of up to a minute later.
   Conflicts: an update only touches the fields it changes (two waiters on two tables never collide); the same field changed on two
   offline devices keeps the last one to reach the server. */

const HL_COLS = {
  readings: ["Relevé de température", "therm"], clientOrders: ["Commande", "receipt"], salleTabs: ["Table", "grid"], lots: ["Lot et étiquette", "qr"],
  products: ["Produit", "box"], counts: ["Inventaire", "list"], receptions: ["Réception", "truck"], events: ["Journal", "list"], notes: ["Fiche", "book"],
  chores: ["Tâche de ménage", "spray"], choreLogs: ["Ménage fait", "spray"], tickets: ["Ticket Z", "receipt"], moves: ["Mouvement de stock", "moves"],
  stockMoves: ["Mouvement de stock", "moves"], staff: ["Fiche salarié", "users"], shifts: ["Planning", "cal"], punches: ["Pointage", "clock"],
  obligations: ["Obligation", "calcheck"], oblLogs: ["Intervention", "calcheck"], feedback: ["Avis", "star"], expenses: ["Dépense", "euro"],
  invoices: ["Facture", "receipt"], prices: ["Prix d'achat", "euro"], fridges: ["Équipement froid", "snow"], members: ["Équipe", "users"],
  restos: ["Restaurant", "store"], consignes: ["Consigne", "sound"], resas: ["Réservation", "cal"], bookings: ["Réservation", "cal"],
};
const HL_WORKS = [["therm", "Relevés de température"], ["receipt", "Prise de commande"], ["grid", "Écran cuisine"], ["qr", "Étiquettes et lots"], ["truck", "Réceptions"],
  ["box", "Stock et inventaire"], ["spray", "Ménage"], ["shield", "Registre"], ["book", "Fiches recettes"], ["clock", "Pointeuse"]];
const HL_WAITS = ["Paiements en ligne", "E-mails et SMS aux clients", "Banque et Pennylane", "Commandes et réservations en ligne des clients", "Lecture automatique des factures"];

function hlLabel(m) {
  const d = (m && m.data) || {}; const base = HL_COLS[m.col] || ["Modification", "edit"];
  let det = "";
  try {
    if (m.col === "readings") det = [d.fname || (d.fridgeId && typeof fridgeName === "function" ? fridgeName(d.fridgeId) : ""), d.value != null && d.value !== "" ? `${String(d.value).replace(".", ",")} °C` : ""].filter(Boolean).join(" · ");
    else if (d.table != null && d.table !== "") det = "Table " + d.table;
    else det = d.name || d.title || d.label || d.text || d.fname || "";
  } catch (e) {}
  det = String(det || "").replace(/\s+/g, " ").slice(0, 48);
  const verb = m.op === "del" ? "supprimé" : m.op === "update" ? "modifié" : "";
  return { t: base[0], ic: base[1], det: det || verb };
}
const hlLS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

const NET = {
  q: [], n: 0, on: false, fs: null, mode: "", forced: false, probeBad: false, st: "on", last: +(hlLS.get("gg-net-last") || 0),
  batch: null, slow: false, doneT: 0, px: null, py: null,
  get off() { return this.forced || (typeof navigator !== "undefined" && navigator.onLine === false) || this.probeBad; },
  live() { return this.on && (this.mode === "db" || this.mode === "demo"); },

  /* ── queue ── */
  track(p, m) {
    const it = { k: ++this.n, col: m.col, op: m.op, at: Date.now(), quiet: m.col === "events", ...hlLabel(m) };
    this.q.push(it); this.save();
    const was = this.off;
    if (was) this.fly(); else setTimeout(() => { if (this.q.includes(it) && !this.off) { this.slow = true; this.startBatch(); this.paint(); } }, 1200);
    const stall = setTimeout(() => { if (this.q.includes(it) && navigator.onLine !== false && !this.forced) this.probe(); }, 4000);
    Promise.resolve(p).then(() => this.ack(it), () => this.ack(it, true)).finally(() => clearTimeout(stall));
    this.paint(was);
  },
  /* the demo has no server: its « coupure » keeps the changes in this same queue and lets them go on « Rétablir » */
  fake(m) { const it = { k: ++this.n, col: m.col, op: m.op, at: Date.now(), fake: true, quiet: m.col === "events", ...hlLabel(m) }; this.q.push(it); this.fly(); this.paint(true); },
  ack(it, err) {
    const i = this.q.indexOf(it); if (i < 0) return;
    this.q.splice(i, 1); this.save();
    if (!err) { this.last = Date.now(); hlLS.set("gg-net-last", String(this.last)); if (this.probeBad && !this.forced) { this.probeBad = false; } if (this.batch && !it.quiet) this.batch.sent++; }
    if (!this.q.length) this.finish(); else this.paint();
  },
  /* the automatic journal line written with each action (events) travels too, but is not counted twice for the person */
  vis() { return this.q.filter((x) => !x.quiet); },
  save() { if (this.mode !== "db") return; const keep = this.vis().filter((x) => !x.fake).slice(-60).map(({ col, op, at, t, ic, det }) => ({ col, op, at, t, ic, det })); hlLS.set("gg-netq", JSON.stringify(keep)); },
  startBatch() { const n = this.vis().length; if (!this.batch && n) this.batch = { total: n, sent: 0 }; else if (this.batch) this.batch.total = Math.max(this.batch.total, this.batch.sent + n); },
  finish() {
    const b = this.batch, shown = this.st === "sync" || this.st === "off";
    this.batch = null; this.slow = false;
    if (shown && !this.off) {
      this.doneN = b ? b.sent : 0; this.doneT = Date.now();
      try { SFX.done(); } catch (e) {} buzz([6, 40, 10]);
      clearTimeout(this._dt); this._dt = setTimeout(() => { this.doneT = 0; this.paint(); }, 2800);
    }
    this.paint();
  },

  /* ── network ── */
  start(fs) {
    if (this.on) return; this.on = true; this.fs = fs || null; this.mode = DB.mode;
    this.mount();
    window.addEventListener("offline", () => { this.paint(); this.sfxOff(); if (S.slow) refresh(); });
    window.addEventListener("online", () => { this.probe().then((ok) => { if (ok) this.back(); }); this.paint(); });
    document.addEventListener("pointerdown", (e) => { this.px = e.clientX; this.py = e.clientY; }, true);
    /* changes made before a restart that never reached the server: Firestore kept and resends them, we keep their labels */
    if (this.mode === "db" && fs) {
      let old = []; try { old = JSON.parse(hlLS.get("gg-netq") || "[]") || []; } catch (e) {}
      if (old.length) {
        old.forEach((o) => this.q.push({ ...o, k: ++this.n, old: true })); this.startBatch(); this.slow = true;
        try { fs.waitForPendingWrites().then(() => { this.q.filter((x) => x.old).forEach((x) => this.ack(x)); }).catch(() => {}); } catch (e) {}
      }
    }
    if (navigator.onLine !== false) this.probe();
    this.paint();
  },
  /* « connected » Wi-Fi that reaches nothing: one tiny no-store request (sw.js lets ?ggping through untouched) */
  probe() {
    if (this._pr) return this._pr;
    this._pr = (async () => {
      let ok = false;
      if (navigator.onLine !== false) {
        const ac = typeof AbortController === "function" ? new AbortController() : null; const t = setTimeout(() => { try { ac && ac.abort(); } catch (e) {} }, 4500);
        try { const r = await fetch("version.json?ggping=" + Date.now(), { cache: "no-store", ...(ac ? { signal: ac.signal } : {}) }); ok = !!r; } catch (e) { ok = false; }
        clearTimeout(t);
      }
      const was = this.probeBad; this.probeBad = !ok && navigator.onLine !== false;
      if (this.probeBad && !was) { this.sfxOff(); if (S.slow) refresh(); }
      if (was && !this.probeBad) this.back();
      clearTimeout(this._pt); if (this.probeBad) this._pt = setTimeout(() => this.probe(), 7000);
      this.paint(); return ok;
    })();
    this._pr.finally(() => { this._pr = null; });
    return this._pr;
  },
  /* the network is back: Firestore may sit in its reconnect backoff for up to a minute; a disable/enable reconnects at once */
  back() {
    if (this.forced || this.off) return;
    if (this.q.length) { this.startBatch(); try { SFX.tone(660, 0.09, "sine", 0.03); SFX.tone(990, 0.12, "sine", 0.026, 0.08); } catch (e) {} }
    if (this.fs && this.q.length && !this._kick) { this._kick = true; this.fs.disableNetwork().then(() => this.fs.enableNetwork()).catch(() => {}).finally(() => { this._kick = false; }); }
    if (S.slow) refresh();
    this.paint();
  },
  sfxOff() { try { SFX.tone(740, 0.1, "sine", 0.03, 0, 520); SFX.tone(440, 0.16, "sine", 0.024, 0.09, 330); } catch (e) {} buzz([10, 30, 10]); },

  /* « Tester une coupure »: with an account, Firestore really stops talking to the server (the device keeps working on its copy); in the
     demo, changes are only held in the queue. Back by itself after 10 minutes, so a forgotten test never cuts a restaurant off. */
  async cut() {
    if (this.forced) return; this.forced = true;
    if (this.fs) { try { await this.fs.disableNetwork(); } catch (e) {} }
    this.sfxOff(); clearTimeout(this._ft); this._ft = setTimeout(() => { if (this.forced) { this.restore(); toast("Fin du test : connexion rétablie"); } }, 10 * 60e3);
    if (S.slow) refresh(); this.paint();
  },
  async restore() {
    if (!this.forced) return; this.forced = false; clearTimeout(this._ft);
    if (this.fs) { try { await this.fs.enableNetwork(); } catch (e) {} }
    const fk = this.q.filter((x) => x.fake);
    if (fk.length) { this.startBatch(); this.paint(); const step = Math.max(110, Math.min(380, 1800 / fk.length)); fk.forEach((x, i) => setTimeout(() => this.ack(x), 500 + i * step)); }
    this.back(); this.paint();
  },

  /* ── capsule ── */
  mount() {
    if ($("#hlCap")) return;
    const c = document.createElement("button"); c.id = "hlCap"; c.className = "hl-cap"; c.type = "button"; c.setAttribute("data-act", "hlOpen"); c.setAttribute("aria-live", "polite");
    c.innerHTML = `<span class="hl-orb" aria-hidden="true">${hlCloud()}</span><span class="hl-tx"><b id="hlT"></b><i id="hlS"></i></span><span class="hl-n mono" id="hlN" aria-hidden="true"></span><span class="hl-bar" aria-hidden="true"><i id="hlBar"></i></span>`;
    document.body.appendChild(c);
    /* make way for a toast at the same spot */
    const t = $("#toast"); if (t && typeof MutationObserver === "function") new MutationObserver(() => c.classList.toggle("hush", t.classList.contains("on"))).observe(t, { attributes: true, attributeFilter: ["class"] });
  },
  state() {
    if (this.off) return "off";
    if (this.q.length && (this.slow || this.batch)) return "sync";
    if (this.doneT) return "done";
    return "on";
  },
  paint(bump) {
    const prev = this.st; this.st = this.state();
    const c = $("#hlCap"); if (c && this.live()) {
      const n = this.vis().length, st = this.st, show = st !== "on";
      c.classList.toggle("show", show); ["off", "sync", "done"].forEach((k) => c.classList.toggle(k, st === k)); c.classList.toggle("test", this.forced);
      const T = $("#hlT", c), Sb = $("#hlS", c), N = $("#hlN", c), B = $("#hlBar", c);
      if (st === "off") { T.textContent = this.forced ? "Coupure test" : "Hors ligne"; Sb.textContent = n ? `${n} en attente` : "Tout reste sur l'appareil"; }
      else if (st === "sync") { const b = this.batch || { total: n, sent: 0 }; T.textContent = "Envoi en cours"; Sb.textContent = b.total ? `${Math.min(b.sent + 1, b.total)} sur ${b.total}` : "Un instant"; B.style.transform = `scaleX(${b.total ? Math.max(0.06, b.sent / b.total) : 0})`; }
      else if (st === "done") { T.textContent = "Tout est à jour"; Sb.textContent = this.doneN ? `${this.doneN} modification${this.doneN > 1 ? "s" : ""} envoyée${this.doneN > 1 ? "s" : ""}` : "Synchronisé"; B.style.transform = "scaleX(1)"; }
      const nv = st === "off" && n ? String(n > 99 ? "99+" : n) : "";
      if (N.dataset.v !== nv) { N.dataset.v = nv; N.innerHTML = nv ? `<span class="${bump ? "roll" : ""}">${nv}</span>` : ""; c.classList.toggle("has-n", !!nv); }
      if (bump && st === "off") { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
      /* a long outage: after a few seconds the capsule folds to its cloud and counter, out of the way; any change unfolds it again */
      if (st !== prev || bump) { c.classList.remove("mini"); clearTimeout(this._mt); if (st === "off") this._mt = setTimeout(() => { if (this.st === "off") c.classList.add("mini"); }, 4500); }
      c.setAttribute("aria-label", `${T.textContent}. ${Sb.textContent}. Détails`);
    }
    if (prev !== this.st && prev === "off" && this.st !== "off" && !this.forced) { /* back online: a soft chime handled in back() */ }
    hlSheetPaint();
  },
  /* each change saved without network flies from the finger into the capsule */
  fly() {
    const c = $("#hlCap"); if (!c || !this.live() || !c.animate) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = c.getBoundingClientRect(); if (!r.width) return;
    const x0 = this.px != null ? this.px : innerWidth / 2, y0 = this.py != null ? this.py : innerHeight / 2;
    const x1 = r.left + 26, y1 = r.top + r.height / 2; const mx = (x0 + x1) / 2 + (x1 > x0 ? -40 : 40), my = Math.min(y0, y1) - 90;
    const o = document.createElement("span"); o.className = "hl-fly"; document.body.appendChild(o);
    const pt = (x, y, s, op = 1) => ({ transform: `translate(${x - 8}px,${y - 8}px) scale(${s})`, opacity: op });
    const a = o.animate([pt(x0, y0, 0.4, 0), pt(x0, y0 - 14, 1.15), pt(mx, my, 1), pt(x1, y1, 0.45, 0.9)], { duration: 720, easing: "cubic-bezier(.45,0,.25,1)" });
    a.onfinish = () => { o.remove(); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); try { SFX.tick(); } catch (e) {} };
  },
};

/* a cloud whose slash, arrow or sparkle shows through CSS (state classes on the capsule) */
function hlCloud() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path class="hl-c" d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"/><path class="hl-sl" d="M4 4l16 16"/><g class="hl-up"><path d="M12 16v-5.5"/><path d="M9.6 12.6 12 10.2l2.4 2.4"/></g><path class="hl-sp" d="M12 10.4l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z"/></svg>`;
}

/* ── sheet ── */
function hlScene() {
  return `<svg class="hl-scene" viewBox="0 0 320 132" aria-hidden="true">
    <defs><linearGradient id="hlG" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#7A4DFF"/><stop offset="1" stop-color="#4A1FE6"/></linearGradient></defs>
    <path id="hlPath" class="hl-line" d="M86 70 C 140 18, 196 18, 236 54"/>
    <g class="hl-gap"><circle cx="160" cy="31" r="11" class="hl-gapbg"/><path d="M155 26l10 10M165 26l-10 10"/></g>
    <g class="hl-pk">${[0, 1, 2].map((i) => `<circle r="4.5" fill="url(#hlG)"><animateMotion dur="1.4s" begin="${i * 0.46}s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .25 1"><mpath href="#hlPath"/></animateMotion></circle>`).join("")}</g>
    <g class="hl-dev"><rect x="44" y="52" width="46" height="74" rx="10" class="hl-devb"/><rect x="50" y="60" width="34" height="56" rx="5" class="hl-devs"/>
      <g class="hl-stack">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${55 + (i % 3) * 9}" y="${101 - Math.floor(i / 3) * 9}" width="7" height="7" rx="2.2" class="hl-blk" style="--j:${i}"/>`).join("")}</g></g>
    <g class="hl-cl"><path d="M232 104h56a17 17 0 0 0 2.6-33.8A26 26 0 0 0 240.6 64 20.5 20.5 0 0 0 232 104z" class="hl-clb"/><path class="hl-clsp" d="M262 74l2.6 6 6 2.6-6 2.6-2.6 6-2.6-6-6-2.6 6-2.6z"/></g>
  </svg>`;
}
function hlSheetHTML() {
  return `<div class="hl-sh" id="hlSh">
    <div class="hl-hero" id="hlHero">${hlScene()}</div>
    <div class="h2" id="hlH"></div><p class="sub" id="hlP"></p>
    <div class="hl-stats" id="hlStats"></div>
    <div id="hlList"></div>
    <div class="lbl hl-lbl">Continue sans réseau</div>
    <div class="hl-works">${HL_WORKS.map(([i, t], k) => `<span class="hl-w st" style="--i:${k}">${ico(i)}${t}</span>`).join("")}</div>
    <div class="lbl hl-lbl">Attend le retour du réseau</div>
    <div class="hl-waits">${HL_WAITS.map((t) => `<span>${t}</span>`).join("")}</div>
    <div class="hl-tip"><span class="ic">${ico("sparkle")}</span><p><b>Les autres appareils</b> reçoivent tout dès que celui-ci retrouve le réseau. Pendant une coupure, l'écran cuisine affiche aussitôt les commandes prises sur le même appareil. Astuce : un téléphone en 4G garde le service relié.</p></div>
    <div class="hl-tip hl-cli" style="margin-top:0"><span class="ic">${ico("users")}</span><p><b>Vos clients aussi sont rassurés.</b> Si leur réseau coupe pendant une commande au QR code, un paiement ou une réservation, un message leur dit de patienter, puis tout repart tout seul, sans jamais rien envoyer deux fois.</p></div>
    <a class="btn soft block" href="commande/?r=demo&amp;t=12&amp;coupure=1" target="_blank" rel="noopener">${ico("qr")}Voir ce que voit le client</a>
    <div id="hlAct"></div>
  </div>`;
}
function hlSheetPaint() {
  const sh = document.getElementById("hlSh"); if (!sh) return;
  const N = NET, st = N.live() ? N.st : "on", n = N.vis().length, cloud = DB.mode === "db", demo = DB.mode === "demo";
  sh.className = "hl-sh is-" + (st === "done" ? "on" : st) + (N.forced ? " is-test" : "");
  const H = { off: N.forced ? "Coupure test en cours" : "Hors ligne", sync: "Envoi en cours", on: "Tout est à jour", done: "Tout est à jour" }[st];
  const P = !cloud && !demo ? "Sans compte, tout est déjà enregistré sur cet appareil : l'app marche avec ou sans réseau."
    : st === "off" ? (n ? `${n} modification${n > 1 ? "s" : ""} gardée${n > 1 ? "s" : ""} sur cet appareil. ${n > 1 ? "Elles partiront" : "Elle partira"} toute${n > 1 ? "s" : ""} seule${n > 1 ? "s" : ""} au retour du réseau.` : "Continuez normalement : chaque relevé, commande ou étiquette est gardé ici et partira au retour du réseau.")
    : st === "sync" ? "Le réseau est revenu : vos modifications partent vers le serveur et les autres appareils."
    : "Si le Wi-Fi tombe en plein service, continuez : l'app garde tout sur l'appareil et envoie au retour du réseau.";
  $$(".hl-blk", sh).forEach((b, i) => b.classList.toggle("on", i < Math.min(n, 6)));
  $("#hlH", sh).textContent = H; $("#hlP", sh).textContent = P;
  const net = !cloud && !demo ? (navigator.onLine === false ? "Hors ligne" : "Connecté") : N.forced ? "Coupé" : st === "off" ? (navigator.onLine === false ? "Hors ligne" : "Sans internet") : "Connecté";
  const tile = (l, v, cls = "") => `<div class="hl-stat ${cls}"><span>${l}</span><b>${v}</b></div>`;
  $("#hlStats", sh).innerHTML = cloud || demo ? tile("Réseau", net, st === "off" ? "warn" : "") + tile("En attente", String(n)) + tile("Dernier envoi", N.last ? esc(when(N.last)) : "—")
    : tile("Réseau", net) + tile("Données", "Sur l'appareil");
  const groups = []; N.vis().forEach((x) => { const g = groups.find((y) => y.t === x.t && y.det === x.det); if (g) { g.c++; g.at = Math.max(g.at, x.at); } else groups.push({ ...x, c: 1 }); });
  $("#hlList", sh).innerHTML = groups.length ? `<div class="lbl hl-lbl">En attente d'envoi</div><div class="glass hl-q">${groups.slice(-12).reverse().map((g, i) => `<div class="hl-qi" style="--i:${i}"><span class="ic">${ico(g.ic)}</span><div class="tx"><b>${esc(g.t)}${g.c > 1 ? ` <i class="mono">×${g.c}</i>` : ""}</b><em>${esc([g.det, hm(g.at)].filter(Boolean).join(" · "))}</em></div><span class="hl-dot"></span></div>`).join("")}${groups.length > 12 ? `<p class="note hl-more">et ${groups.length - 12} autre${groups.length - 12 > 1 ? "s" : ""}</p>` : ""}</div>` : "";
  $("#hlAct", sh).innerHTML = (cloud || demo ? (N.forced ? `<button class="btn acc block" data-act="hlRestore">${ico("wifi")}Rétablir la connexion</button>` : `<button class="btn soft block" data-act="hlTest">${ico("wifi")}Tester une coupure</button><p class="note hl-note">${demo ? "Démo : faites un relevé ou une commande, puis rétablissez pour voir l'envoi." : "Coupe la synchro sur cet appareil seulement, jusqu'à ce que vous la rétablissiez (10 minutes au plus)."}</p>`) : "")
    + `<button class="btn ghost block" data-act="sheetClose">Fermer</button>`;
}
/* Réglages › Cet appareil (js/compte.js) */
function hlRow() {
  const N = NET, st = N.live() ? N.st : "on", n = N.vis().length;
  const em = DB.mode === "local" ? "L'app marche sans réseau" : st === "off" ? (n ? `Hors ligne · ${n} en attente` : "Hors ligne · tout est gardé ici") : st === "sync" ? "Envoi en cours" : "Continue même si le Wi-Fi tombe";
  return `<div class="li tap" data-act="hlOpen"><span class="ic w-sk">${ico("wifi")}</span><div class="tx"><b>Mode hors ligne</b><em>${esc(em)}</em></div>${ico("chev")}</div>`;
}

Object.assign(ACT, {
  hlOpen() { SFX.tap(); openSheet(hlSheetHTML()); hlSheetPaint(); },
  async hlTest() { buzz(8); await NET.cut(); toast("Coupure test : continuez, tout est gardé ici", "info"); },
  async hlRestore() { buzz(8); await NET.restore(); },
});

/* changes in the demo during a « coupure » join the queue (the demo never reaches core DB.dbw) */
["set", "update", "del"].forEach((op) => {
  const f = DB[op];
  DB[op] = function (col, id, data) { const r = f.apply(this, arguments); if (this.mode === "demo" && NET.forced) NET.fake({ col, id, op, data }); return r; };
});
/* the demo starts without js/auth.js's watchNet: switch the capsule on once the app knows its mode */
(function hlBoot() {
  if (NET.on) return;
  if (S.ready && DB.mode === "demo") return NET.start(null);
  setTimeout(hlBoot, 800);
})();

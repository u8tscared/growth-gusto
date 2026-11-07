// Tourne DANS la page (injecté par tools/sim/sim.js). simApply(D, P) transforme les données de la démo (DB.local, tout en mémoire)
// en un restaurant du profil P : nom, type, pack, sites, équipe, équipements, tables, volume, fonctionnalités coupées.
// Le résultat est écrit en mode « sur cet appareil » (localStorage gg-local) : rien ne part sur Internet, aucun compte réel.
window.simApply = function simApply(D, P) {
  const now = Date.now(), DAY = 864e5;
  const RID = "sim-" + P.id;
  const siteIds = P.sites.map((_, i) => (i === 0 ? RID : RID + "-" + (i + 1)));
  const src = ["demo", "demo2", "demo3"];
  /* 1) restaurants : demo → sim-<id>, demo2/demo3 → sites suivants, au-delà : copies de demo3 */
  const out = {};
  const mapRid = {};
  siteIds.forEach((sid, i) => { mapRid[sid] = src[Math.min(i, 2)]; });
  const deepClone = (x) => JSON.parse(JSON.stringify(x));
  out.restos = {};
  siteIds.forEach((sid, i) => {
    const base = deepClone(D.restos[mapRid[sid]] || D.restos.demo);
    delete base.demo;
    Object.assign(base, { name: P.sites[i], type: P.type, address: P.ville, covers: String(P.couverts), owner: "local", createdAt: now - (400 - i * 60) * DAY });
    out.restos[sid] = base;
    const pre = "restos/" + mapRid[sid] + "/";
    Object.keys(D).forEach((k) => { if (k.startsWith(pre)) out["restos/" + sid + "/" + k.slice(pre.length)] = deepClone(D[k]); });
  });
  const col = (sid, c) => (out["restos/" + sid + "/" + c] ||= {});
  /* 2) pack et essai */
  siteIds.forEach((sid) => {
    const r = out.restos[sid];
    if (P.plan === "essai") Object.assign(r, { plan: "essai", pack: P.pack, trialEnds: now + 9 * DAY });
    else if (P.plan === "expire") Object.assign(r, { plan: "essai", pack: P.pack, trialEnds: now - 40 * DAY });
    else Object.assign(r, { plan: P.plan, pack: P.plan, paidAt: now - 60 * DAY, paidUntil: null });
    if (P.sansModules.length) r.modsOff = P.sansModules.slice();
    /* journée du restaurant (js/journee.js) : bar ouvert la nuit, hôtel au petit-déjeuner, cantine fermée le week-end */
    if (P.day) r.day = { ...P.day };
    if (P.closed) r.alertCfg = { ...(r.alertCfg || {}), closed: P.closed.slice() };
  });
  /* 3) équipe : les 7 personnes de la démo deviennent celles du profil (même rôle si possible), le reste est créé */
  const demoIds = ["demo-camille", "demo-thomas", "demo-ines", "demo-lucas", "demo-sarah", "demo-hugo", "demo-jade"];
  siteIds.forEach((sid, si) => {
    const mem = col(sid, "members"), staff = col(sid, "staff"), shifts = col(sid, "shifts"), punches = col(sid, "punches");
    const team = si === 0 ? P.equipe : P.equipe.filter((_, i) => i === 0 || i % P.sites.length === si % P.sites.length);
    const have = Object.keys(mem);
    const keep = new Set();
    const tpl = (poste) => have.find((id) => mem[id] && mem[id].poste === poste && !keep.has(id)) || null;
    team.forEach(([name, role, poste], i) => {
      let id = i === 0 ? (mem["demo-camille"] ? "demo-camille" : have[0]) : tpl(poste) || have.find((x) => !keep.has(x) && x !== "demo-camille");
      if (!id || keep.has(id)) {
        /* nouvelle personne : copie d'un modèle du même poste (accès, planning, pointages) */
        const like = have.find((x) => mem[x] && mem[x].poste === poste) || have[1] || have[0];
        id = "sim-m" + si + "-" + i;
        mem[id] = { ...deepClone(mem[like]), name, role, poste, joinedAt: now - (30 + i) * DAY };
        const sLike = Object.keys(staff).find((s) => staff[s].memberId === like);
        if (sLike) {
          staff["s_" + id] = { ...deepClone(staff[sLike]), memberId: id, name, role: poste === "salle" ? "Serveur" : poste === "bar" ? "Barman" : poste === "plonge" ? "Plongeur" : "Commis" };
          Object.keys(shifts).forEach((k) => { if (shifts[k].staffId === sLike && (i % 3 === 0 || Math.random() < 0.6)) shifts[k + "x" + i] = { ...deepClone(shifts[k]), staffId: "s_" + id }; });
          Object.keys(punches).forEach((k) => { if (punches[k].staffId === sLike && i % 2 === 0) punches[k + "x" + i] = { ...deepClone(punches[k]), staffId: "s_" + id }; });
        }
      } else {
        Object.assign(mem[id], { name, role, poste });
        Object.keys(staff).forEach((s) => { if (staff[s].memberId === id) staff[s].name = name; });
      }
      keep.add(id);
    });
    /* accès de chacun selon son poste (préréglages de js/perms.js), pas ceux de la personne de la démo copiée */
    if (typeof pmPreset === "function") Object.keys(mem).forEach((id) => { const m = mem[id]; if (!keep.has(id) || m.role === "gerant") return; const p = pmPreset(m.role === "chef" ? "second" : m.poste); if (p) m.perms = p; else delete m.perms; });
    /* les personnes de la démo qui n'existent pas dans ce restaurant partent, avec leurs plannings et pointages */
    Object.keys(mem).forEach((id) => { if (!keep.has(id)) delete mem[id]; });
    const gone = new Set(Object.keys(staff).filter((s) => staff[s].memberId && !keep.has(staff[s].memberId)));
    gone.forEach((s) => delete staff[s]);
    Object.keys(shifts).forEach((k) => { if (gone.has(shifts[k].staffId)) delete shifts[k]; });
    Object.keys(punches).forEach((k) => { if (gone.has(punches[k].staffId)) delete punches[k]; });
    const req = col(sid, "esRequests"); Object.keys(req).forEach((k) => { if (!keep.has(req[k].memberId)) delete req[k]; });
    /* extras / saisonniers : fiches employé sans compte */
    for (let i = 0; i < (si === 0 ? P.extras : 0); i++) staff["sim-x" + i] = { name: "Extra " + (i + 1), role: "Extra", color: "#8a8fa8", contract: "Extra", weeklyHours: 0, hourlyGross: 12.1, chargesPct: 30, active: true, start: new Date(now - 20 * DAY).toISOString().slice(0, 10) };
  });
  /* 4) équipements */
  const kinds = { bar: ["cave", "cave", "frigo", "service", "congel", "cave"], boulangerie: ["vitrine", "vitrine", "cfp", "frigo", "congel"], foodtruck: ["saladette", "congel"] };
  siteIds.forEach((sid) => {
    const fr = col(sid, "fridges"), rd = col(sid, "readings");
    const ids = Object.keys(fr); const want = P.frigos;
    for (let i = ids.length; i < want; i++) {
      const b = ids[i % ids.length], nid = "sim-f" + i; const kind = (kinds[P.id] || [])[i] || ["frigo", "cfp", "congel", "saladette", "service"][i % 5];
      fr[nid] = { ...deepClone(fr[b]), name: { frigo: "Frigo", cfp: "Chambre froide", congel: "Congélateur", saladette: "Saladette", service: "Frigo de service", cave: "Cave à boissons", vitrine: "Vitrine" }[kind] + " " + (i + 1), type: kind, order: i, ...(kind === "congel" ? { min: -40, max: -15 } : kind === "cave" ? { min: 2, max: 8 } : {}) };
      Object.keys(rd).forEach((k) => { if (rd[k].fridgeId === b) { const v = deepClone(rd[k]); v.fridgeId = nid; if (kind === "congel") v.temp = -18 - Math.round(Math.random() * 3); rd[k + "f" + i] = v; } });
    }
    ids.slice(want).forEach((id) => { delete fr[id]; Object.keys(rd).forEach((k) => { if (rd[k].fridgeId === id) delete rd[k]; }); });
    if (kinds[P.id]) Object.keys(fr).forEach((id, i) => { const k = kinds[P.id][i]; if (k && fr[id].type !== k) { fr[id].type = k; if (k === "congel") Object.assign(fr[id], { min: -40, max: -15 }); if (k === "cave") Object.assign(fr[id], { min: 2, max: 8 }); } });
  });
  /* 5) tables et salle */
  siteIds.forEach((sid) => {
    const r = out.restos[sid]; r.resaCfg = r.resaCfg || null;
    if (r.resaCfg) {
      if (!P.tables) { r.resaCfg.tables = []; ["bookings", "salleTabs", "prise"].forEach((c) => delete out["restos/" + sid + "/" + c]); }
      else r.resaCfg.tables = Array.from({ length: P.tables }, (_, i) => ({ id: "st" + i, n: String(i + 1), seats: [2, 4, 4, 6, 2, 8][i % 6], zone: i < P.tables * 0.7 ? "salle" : "terrasse" }));
    }
  });
  /* 6) volume : plus de relevés, de mouvements, de commandes, de pointages */
  if (P.volume > 1) siteIds.slice(0, 1).forEach((sid) => {
    ["readings", "moves", "clientOrders", "bookings", "events", "waste", "punches", "expenses"].forEach((c) => {
      const m = out["restos/" + sid + "/" + c]; if (!m) return; const ks = Object.keys(m); const extra = Math.round(ks.length * (P.volume - 1));
      for (let i = 0; i < extra; i++) { const k = ks[i % ks.length]; const v = deepClone(m[k]); if (v.at) v.at -= (i % 7) * 60000 + 1000; m[k + "v" + i] = v; }
    });
  });
  if (P.volume < 1) siteIds.forEach((sid) => {
    ["readings", "moves", "tickets", "events", "bookings", "clientOrders"].forEach((c) => { const m = out["restos/" + sid + "/" + c]; if (!m) return; Object.keys(m).forEach((k, i) => { if (i % Math.round(1 / P.volume) !== 0) delete m[k]; }); });
  });
  /* 7) noms : la démo devient le profil partout dans les textes (événements, consignes, discussions) */
  let s = JSON.stringify(out);
  const rep = [["Le Bistrot Démo", P.sites[0]], ["Le Comptoir Démo", P.sites[1] || P.sites[0]], ["La Cantine du Port", P.sites[2] || P.sites[0]], ["Camille Laurent", P.equipe[0][0]], ["demo-camille", "local"]];
  rep.forEach(([a, b]) => { s = s.split(a).join(b); });
  return { data: JSON.parse(s), rid: RID, sites: siteIds };
};

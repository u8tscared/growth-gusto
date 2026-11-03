/* Growth Gusto — area: compte */
VIEWS.onboarding = {
  live: false,
  render() {
    const sug = S.ui.obFr || ["Chambre froide 1", "Chambre froide 2", "Frigo du bar"];
    S.ui.obFr = sug;
    return `<div class="inner narrow" style="min-height:100%;justify-content:center;padding-block:20px">
      <div class="st" style="--i:0;display:flex;justify-content:center">${appIcon(84)}</div>
      <div class="st" style="--i:1;text-align:center"><div class="title">Bienvenue sur Growth Gusto</div><p class="sub" style="margin:10px auto 0;max-width:36ch">Le registre sanitaire, les frigos et le stock de votre cuisine, dans votre poche.</p></div>
      ${banner()}
      <div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:14px">
        ${S.me.name ? "" : `<label class="field"><span>Votre prénom</span><input class="input" id="obMe" placeholder="Il signe chaque relevé" autocomplete="given-name"></label>`}
        <label class="field"><span>Nom du restaurant</span><input class="input" id="obName" placeholder="Ex. Chemin des Sarments" autocomplete="off"></label>
        <div class="field"><span>Vos frigos et chambres froides</span><div class="chips" style="flex-wrap:wrap">${["Chambre froide 1", "Chambre froide 2", "Frigo du bar", "Frigo pâtisserie", "Saladette", "Congélateur"].map((n) => `<button class="chip ${sug.includes(n) ? "on" : ""}" data-act="obToggle" data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div><span class="note">Vous pourrez en ajouter, renommer et régler les seuils ensuite.</span></div>
        <button class="btn acc block" data-act="obCreate">Créer mon restaurant</button>
      </div></div>`;
  },
};


VIEWS.equipe = {
  render() {
    const canManage = myRole() === "gerant";
    const m = [...S.members].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    return `<div class="inner narrow">${topBar("Équipe")}
      <div class="glass pad st" style="--i:1">${m.length ? m.map((x) => { const n = S.events.filter((e) => e.uid === x.id).length; return `<div class="li ${canManage ? "tap" : ""}" ${canManage ? `data-act="role" data-id="${x.id}"` : ""}>${avatar(x.id)}<div class="tx"><b>${esc(nameOf(x.id))}${x.id === S.me.id ? " (vous)" : ""}</b><em>${n} action${n > 1 ? "s" : ""} au registre · depuis ${x.joinedAt ? shortDate(dayKey(new Date(x.joinedAt))) : "–"}</em></div><span class="pill ${x.role === "gerant" ? "acc" : "neu"}">${ROLES[x.role] || "Équipe"}</span></div>`; }).join("") : `<div class="empty">${DB.mode === "local" ? "En mode démo, l'équipe n'est pas partagée." : "Personne pour l'instant."}</div>`}</div>
      <div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:10px"><div class="hstack"><span class="ic">${ico("plus")}</span><b class="h3">Ajouter quelqu'un</b></div>
        <p class="note" style="margin:0">1. Touchez <b>Partager</b> en haut de cette page.<br>2. Ajoutez la personne avec l'accès <b>« Peut modifier »</b>.<br>3. Dès qu'elle ouvre l'app, elle apparaît ici, et chacune de ses actions porte son nom.</p></div>
      <p class="note st" style="--i:3">Les rôles indiquent qui gère quoi. Le gérant peut changer le rôle de chacun.</p></div>`;
  },
};


VIEWS.reglages = {
  render() {
    return `<div class="inner narrow">${topBar("Réglages")}
      <div class="glass pad st" style="--i:1">${avatar(S.me.id)}<div class="h3" style="margin-top:8px">${esc(S.me.name || "Vous")}</div><div class="sub">${ROLES[myRole()]} · ${esc(S.resto?.name || "")}</div></div>
      <div class="glass pad st" style="--i:2">
        <div class="li tap" data-act="meRename"><span class="ic">${ico("users")}</span><div class="tx"><b>Votre prénom</b><em>${esc(S.me.name || "À renseigner, il signe vos relevés")}</em></div>${ico("chev")}</div>
        <div class="li tap" data-act="restoRename"><span class="ic">${ico("edit")}</span><div class="tx"><b>Nom du restaurant</b><em>${esc(S.resto?.name || "")}</em></div>${ico("chev")}</div>
        <div class="li tap" data-act="restoSwitch"><span class="ic">${ico("store")}</span><div class="tx"><b>Établissements</b><em>${S.restos.length} · changer ou en ajouter un</em></div>${ico("chev")}</div>
        <div class="li tap" data-act="sound"><span class="ic">${ico("sound")}</span><div class="tx"><b>Sons</b><em>${SFX.on ? "Activés" : "Coupés"}</em></div><span class="pill ${SFX.on ? "ok" : "neu"}">${SFX.on ? "Oui" : "Non"}</span></div>
        <div class="li tap" data-go="equipe"><span class="ic">${ico("users")}</span><div class="tx"><b>Équipe</b><em>${S.members.length} personne${S.members.length > 1 ? "s" : ""}</em></div>${ico("chev")}</div>
        <div class="li tap" data-go="imprimante"><span class="ic">${ico("printer")}</span><div class="tx"><b>Imprimante</b><em>${esc(S.resto?.printer || "À choisir")}</em></div>${ico("chev")}</div>
      </div>
      <div class="glass pad st" style="--i:3;display:flex;align-items:center;gap:14px">${appIcon(52)}<div><b class="h3">Growth Gusto</b><div class="sub">Version 1.0 · novembre 2026</div></div></div></div>`;
  },
};

VIEWS.more = {
  render() {
    const tiles = [["releve", "therm", "Relevés"], ["reception", "truck", "Réception"], ["registre", "shield", "Registre"], ["tickets", "receipt", "Tickets Z"], ["notes", "book", "Recettes"], ["menage", "spray", "Ménage"], ["equipe", "users", "Équipe"], ["imprimante", "printer", "Imprimante"], ["reglages", "sliders", "Réglages"]];
    return `<div class="inner narrow">${topBar("Tout Growth Gusto", { noBack: true })}<div class="st" style="--i:1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${tiles.map(([r, i, t]) => `<button class="glass" style="all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 6px;border-radius:22px;background:var(--glass);border:1px solid var(--edge);box-shadow:var(--sh);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);font-weight:800;font-size:13px" data-go="${r}" ${r === "reception" ? 'data-fresh="1"' : ""}><span class="ic" style="width:48px;height:48px;border-radius:16px">${ico(i)}</span>${t}</button>`).join("")}</div></div>`;
  },
};


Object.assign(ACT, {
  obToggle: (a, id, v) => { const n = a.dataset.n; const s = S.ui.obFr; const i = s.indexOf(n); i >= 0 ? s.splice(i, 1) : s.push(n); a.classList.toggle("on"); SFX.tick(); },
  obCreate: async () => {
    const name = ($("#obName").value || "").trim(); if (!name) { $("#obName").classList.add("shake"); setTimeout(() => $("#obName").classList.remove("shake"), 400); SFX.err(); $("#obName").focus(); return; }
    const me = $("#obMe") ? $("#obMe").value.trim() : ""; if ($("#obMe") && !me) { $("#obMe").classList.add("shake"); setTimeout(() => $("#obMe").classList.remove("shake"), 400); SFX.err(); $("#obMe").focus(); return; }
    if (me) { S.me.name = me; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), ...S.me }; try { localStorage.setItem("gg-name", me); } catch (e) {} }
    const rid = "r" + Date.now().toString(36); const prev = S.rid; S.rid = rid;
    try {
      await safe(DB.set("restos", rid, { name, createdAt: Date.now(), by: S.me.id }));
      attachedRid = null; memberChecked = true; attachResto();
      await DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now(), ...(S.me.name ? { name: S.me.name } : {}) });
      for (const [i, n] of S.ui.obFr.entries()) await DB.add("fridges", { name: n, min: n.includes("Congél") ? -25 : 0, max: n.includes("Congél") ? -18 : 4, order: i, createdAt: Date.now() });
      await logEvent("team", `a créé ${name}`);
      S.resto = { id: rid, name }; SFX.done(); burst(); S.history = []; go("home", {}, { replace: true });
    } catch (e) { S.rid = prev; }
  },
  restoSwitch: () => {
    openSheet(`<div class="h2" style="font-size:20px">Établissements</div>${S.restos.map((r) => `<div class="li tap" data-act="restoPick" data-id="${r.id}"><span class="ic">${ico("store")}</span><div class="tx"><b>${esc(r.name)}</b><em>${r.id === S.rid ? "Ouvert" : "Changer"}</em></div>${r.id === S.rid ? `<span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>` : ico("chev")}</div>`).join("")}
      <div class="hstack"><input class="input" id="newResto" placeholder="Nom du nouvel établissement" style="flex:1"><button class="btn acc sm" style="height:50px" data-act="restoAdd">Ajouter</button></div>`);
  },
  restoPick: (a, id) => { if (id === S.rid) { closeSheet(); return; } S.rid = id; S.resto = S.restos.find((r) => r.id === id); attachedRid = null; memberChecked = false; ["fridges", "readings", "lots", "products", "counts", "receptions", "events", "notes", "chores", "choreLogs", "tickets", "members"].forEach((k) => (S[k] = [])); attachResto(); closeSheet(); S.history = []; go("home", {}, { replace: true }); toast(`${S.resto.name}`); },
  restoAdd: async () => { const n = ($("#newResto").value || "").trim(); if (!n) return; const rid = "r" + Date.now().toString(36); await safe(DB.set("restos", rid, { name: n, createdAt: Date.now(), by: S.me.id })); if (!S.restos.find((r) => r.id === rid)) S.restos.push({ id: rid, name: n }); ACT.restoPick(null, rid); setTimeout(() => { DB.set("members", S.me.id, { role: "gerant", joinedAt: Date.now() }).catch(() => {}); }, 300); SFX.ok(); },
  restoRename: () => { openSheet(`<div class="h2" style="font-size:20px">Nom du restaurant</div><input class="input" id="rn" value="${esc(S.resto.name)}"><button class="btn acc block" data-act="restoRenameOk">Enregistrer</button>`); },
  meRename: () => { openSheet(`<div class="h2" style="font-size:20px">Votre prénom</div><input class="input" id="mn" value="${esc(S.me.name)}" autocomplete="given-name"><button class="btn acc block" data-act="meRenameOk">Enregistrer</button>`); },
  meRenameOk: async () => { const n = ($("#mn").value || "").trim(); if (!n) return; S.me.name = n; S.profiles[S.me.id] = { ...(S.profiles[S.me.id] || {}), name: n }; try { localStorage.setItem("gg-name", n); } catch (e) {} await DB.update("members", S.me.id, { name: n }).catch(() => DB.set("members", S.me.id, { role: myRole(), joinedAt: Date.now(), name: n }).catch(() => {})); closeSheet(true); SFX.ok(); renderChrome(); rerender(); },
  restoRenameOk: async () => { const n = ($("#rn").value || "").trim(); if (!n) return; await safe(DB.update("restos", S.rid, { name: n })); closeSheet(); SFX.ok(); toast("Nom mis à jour"); },
  role: (a, id) => { const m = S.members.find((x) => x.id === id); openSheet(`<div class="hstack">${avatar(id)}<div class="h2" style="font-size:20px">${esc(nameOf(id))}</div></div><div style="display:flex;flex-direction:column;gap:8px">${Object.entries(ROLES).map(([k, t]) => `<button class="chip ${m.role === k ? "on" : ""}" style="text-align:left;padding:13px 16px;border-radius:16px" data-act="roleSet" data-id="${id}" data-v="${k}">${t}</button>`).join("")}</div>`); },
  roleSet: async (a, id, v) => { await safe(DB.update("members", id, { role: v })); await logEvent("team", `a passé ${firstName(nameOf(id))} en ${ROLES[v]}`); closeSheet(true); SFX.ok(); },
});

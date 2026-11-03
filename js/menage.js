/* Growth Gusto — area: menage */
/* Temporary: moved here from notes.js until the rebuilt menage.js lands. */
function choresDue() {
  const now = Date.now(); const span = { jour: 0, semaine: 7, mois: 30 };
  return S.chores.filter((c) => { const last = S.choreLogs.find((l) => l.choreId === c.id); if (!last) return true; if (c.freq === "jour") return last.day !== dayKey(); return now - last.at > (span[c.freq] || 0) * 864e5 - 36e5; });
}
VIEWS.menage = {
  render() {
    const due = choresDue(); const done = S.chores.filter((c) => !due.includes(c));
    const row = (c, isDue, i) => { const last = S.choreLogs.find((l) => l.choreId === c.id); return `<div class="li tap" ${isDue ? `data-act="choreDo" data-id="${c.id}" role="button" tabindex="0" aria-label="Marquer « ${esc(c.name)} » comme fait"` : ""} style="min-height:56px">${isDue ? `<span class="pend" style="width:32px;height:32px;border-color:rgba(74,31,230,.45)"></span>` : `<span class="check ${S.ui.justChore === c.id ? "draw" : ""}" style="width:32px;height:32px"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>`}<div class="tx"><b>${esc(c.name)}</b><em>${esc(c.zone || "")} · ${c.freq === "jour" ? "chaque jour" : c.freq === "semaine" ? "chaque semaine" : "chaque mois"}${last ? ` · ${esc(firstName(nameOf(last.uid)))} ${when(last.at)}` : ""}</em></div><button class="iconbtn" style="width:36px;height:36px;box-shadow:none;background:transparent" data-act="choreEdit" data-id="${c.id}" aria-label="Modifier">${ico("chev")}</button></div>`; };
    return `<div class="inner narrow">${topBar("Planning ménage", { right: `<button class="btn soft sm" data-act="choreEdit">${ico("plus")}Tâche</button>` })}
      ${S.chores.length ? `<div class="glass pad st" style="--i:1"><div class="row"><span class="lbl">À faire</span><span class="pill ${due.length ? "acc" : "ok"}">${due.length ? due.length : "Tout est fait"}</span></div>${due.map((c, i) => row(c, true, i)).join("") || `<div class="empty" style="padding:14px 0 4px">Rien à faire pour l'instant.</div>`}</div>
      ${done.length ? `<div class="glass pad st" style="--i:2"><span class="lbl">Fait</span>${done.map((c, i) => row(c, false, i)).join("")}</div>` : ""}` : `<div class="glass empty st" style="--i:1"><div class="ic">${ico("spray")}</div><b>Aucune tâche</b>Créez le plan de nettoyage : plonge, plans de travail, chambres froides, sols…<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn acc" data-act="choreEdit">Ajouter une tâche</button><button class="btn soft" data-act="choreStarter">Plan type</button></div></div>`}</div>`;
  },
  after() { S.ui.justChore = null; },
};


Object.assign(ACT, {
  choreDo: async (a, id) => {
    const c = S.chores.find((x) => x.id === id); a.style.transform = "scale(.8)"; S.ui.justChore = id;
    const logId = await safe(DB.add("choreLogs", { choreId: id, at: Date.now(), day: dayKey(), uid: S.me.id }));
    S.ui.undo = { col: "choreLogs", id: logId }; toastUndo(`« ${c.name} » fait`);
    await logEvent("chore", `a fait « ${c.name} »`, { ref: id });
    SFX.ok(); buzz(10); if (choresDue().length === 0) { setTimeout(() => { SFX.done(); toast("Ménage du jour terminé"); }, 900); }
  },
  choreEdit: (a, id) => {
    const c = S.chores.find((x) => x.id === id) || { name: "", zone: "", freq: "jour" };
    openSheet(`<div class="h2" style="font-size:20px">${id ? "Modifier la tâche" : "Nouvelle tâche"}</div>
      <label class="field"><span>Tâche</span><input class="input" id="cName" value="${esc(c.name)}" placeholder="Désinfecter les plans de travail"></label>
      <label class="field"><span>Zone</span><input class="input" id="cZone" value="${esc(c.zone)}" placeholder="Cuisine"></label>
      <div class="seg" id="cFreq"><span class="knob" style="width:calc(33.33% - 3px);transform:translateX(${["jour", "semaine", "mois"].indexOf(c.freq) * 100}%)"></span>${[["jour", "Chaque jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([k, t]) => `<button class="${c.freq === k ? "on" : ""}" data-act="cFreq" data-v="${k}">${t}</button>`).join("")}</div>
      <button class="btn acc block" data-act="choreSave" data-id="${id || ""}">Enregistrer</button>${id ? `<button class="btn ghost block" style="color:var(--bad)" data-act="choreDel" data-id="${id}">Supprimer</button>` : ""}`);
    S.ui.cFreq = c.freq;
  },
  cFreq: (a, id, v) => { S.ui.cFreq = v; const seg = $("#cFreq"); $$("button", seg).forEach((b) => b.classList.toggle("on", b === a)); $(".knob", seg).style.transform = `translateX(${["jour", "semaine", "mois"].indexOf(v) * 100}%)`; SFX.tick(); },
  choreSave: async (a, id) => { const d = { name: $("#cName").value.trim(), zone: $("#cZone").value.trim(), freq: S.ui.cFreq || "jour" }; if (!d.name) { SFX.err(); return; } if (id) await safe(DB.update("chores", id, d)); else await safe(DB.add("chores", { ...d, createdAt: Date.now() })); closeSheet(true); SFX.ok(); },
  choreDel: (a, id) => { openSheet(`<div class="h2" style="font-size:20px">Supprimer cette tâche ?</div><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="choreDelOk" data-id="${id}">Supprimer</button></div>`); },
  choreDelOk: async (a, id) => { await safe(DB.del("chores", id)); closeSheet(true); },
  choreStarter: async () => {
    const L = [["Plans de travail désinfectés", "Cuisine", "jour"], ["Sols lavés", "Cuisine", "jour"], ["Plonge et éviers", "Plonge", "jour"], ["Poignées et interrupteurs", "Cuisine", "jour"], ["Poubelles vidées et lavées", "Cuisine", "jour"], ["Chambres froides nettoyées", "Chambres froides", "semaine"], ["Hotte et filtres", "Cuisine", "semaine"], ["Réserve sèche rangée", "Réserve", "semaine"], ["Dégivrage congélateur", "Congélateur", "mois"]];
    for (const [name, zone, freq] of L) await DB.add("chores", { name, zone, freq, createdAt: Date.now() }); SFX.ok(); toast("Plan de nettoyage créé");
  },

});

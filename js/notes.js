/* Growth Gusto — area: notes */
VIEWS.notes = {
  render() {
    const cats = ["Toutes", "Recettes", "Hygiène", "Procédures", "Notes"]; const q = S.noteQ.toLowerCase();
    const list = S.notes.filter((n) => (S.noteCat === "Toutes" || n.cat === S.noteCat) && (!q || (n.title + " " + n.body).toLowerCase().includes(q))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return `<div class="inner narrow">${topBar("Recettes & procédures", { right: `<button class="btn acc sm" data-go="note" data-id="new">${ico("plus")}Nouvelle</button>` })}
      <div class="hstack st" style="--i:1;position:relative"><span style="position:absolute;left:14px;color:var(--faint)">${ico("search")}</span><input class="input" id="noteQ" placeholder="Rechercher" value="${esc(S.noteQ)}" style="padding-left:44px"></div>
      <div class="chips st" style="--i:2">${cats.map((c) => `<button class="chip ${S.noteCat === c ? "on" : ""}" data-act="noteCat" data-v="${c}">${c}</button>`).join("")}</div>
      <div class="st" style="--i:3;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">${list.map((n) => `<div class="glass pad" style="cursor:pointer;display:flex;flex-direction:column;gap:6px;min-width:0" data-go="note" data-id="${n.id}"><span class="pill ${n.cat === "Hygiène" ? "ok" : n.cat === "Recettes" ? "acc" : "neu"}" style="align-self:flex-start">${esc(n.cat)}</span><b class="h3">${esc(n.title || "Sans titre")}</b><span class="note" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc((n.ingredients || []).length ? (n.ingredients || []).map((g) => g.name).join(", ") : n.body)}</span><span class="who">${avatar(n.uid, true)}${esc(firstName(nameOf(n.uid)))} · ${when(n.updatedAt || n.at)}</span></div>`).join("")}</div>
      ${list.length ? "" : `<div class="glass empty st" style="--i:4"><div class="ic">${ico("book")}</div><b>${S.notes.length ? "Aucun résultat" : "Rien d'écrit pour l'instant"}</b>Fiches recettes avec grammages, procédures d'hygiène, notes de l'équipe.</div>`}</div>`;
  },
  after(v) { const i = $("#noteQ", v); if (i) i.addEventListener("input", debounce(() => { S.noteQ = i.value; const st = v.scrollTop; v.classList.add("nost"); v.innerHTML = VIEWS.notes.render(); v.scrollTop = st; VIEWS.notes.after(v); const n = $("#noteQ", v); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200)); },
};
VIEWS.note = {
  live: false,
  render({ id }) {
    if (!S.ui.note || S.ui.note._id !== id) { const n = S.notes.find((x) => x.id === id); S.ui.note = n ? JSON.parse(JSON.stringify({ ...n, _id: id })) : { _id: id, title: "", cat: "Recettes", body: "", ingredients: [] }; }
    const N = S.ui.note; N.ingredients ||= [];
    return `<div class="inner narrow">${topBar(id === "new" ? "Nouvelle fiche" : "Modifier", { right: id !== "new" ? `<button class="iconbtn" data-act="noteDel" aria-label="Supprimer" style="color:var(--bad)">${ico("trash")}</button>` : "" })}
      <div class="glass pad st" style="--i:1;display:flex;flex-direction:column;gap:14px">
        <input class="input" data-bind="ui.note.title" value="${esc(N.title)}" placeholder="Titre, ex. Saumon gravlax" style="font-size:19px;font-weight:800;height:56px">
        <div class="chips">${["Recettes", "Hygiène", "Procédures", "Notes"].map((c) => `<button class="chip ${N.cat === c ? "on" : ""}" data-act="noteSetCat" data-v="${c}">${c}</button>`).join("")}</div>
        ${N.cat === "Recettes" ? `<div class="field"><span>Ingrédients</span>${N.ingredients.map((g, i) => `<div class="hstack" style="gap:6px"><input class="input" data-bind="ui.note.ingredients.${i}.name" value="${esc(g.name)}" placeholder="Saumon" style="flex:2"><input class="input mono" data-bind="ui.note.ingredients.${i}.qty" value="${esc(g.qty)}" placeholder="1000" style="flex:1"><input class="input" data-bind="ui.note.ingredients.${i}.unit" value="${esc(g.unit)}" placeholder="g" style="flex:.8"></div>`).join("")}<button class="btn ghost sm" data-act="ingAdd" style="align-self:flex-start">${ico("plus")}Ingrédient</button></div>` : ""}
        <label class="field"><span>${N.cat === "Recettes" ? "Étapes" : "Contenu"}</span><textarea class="input" data-bind="ui.note.body" placeholder="${N.cat === "Recettes" ? "1. Mélanger sucre, sel et baies roses…" : "Écrivez ici…"}">${esc(N.body)}</textarea></label>
      </div><button class="btn acc block st" style="--i:2" data-act="noteSave">${ico("check")}Enregistrer</button></div>`;
  },
};

function choresDue() {
  const now = Date.now(); const span = { jour: 0, semaine: 7, mois: 30 };
  return S.chores.filter((c) => { const last = S.choreLogs.find((l) => l.choreId === c.id); if (!last) return true; if (c.freq === "jour") return last.day !== dayKey(); return now - last.at > (span[c.freq] || 0) * 864e5 - 36e5; });
}

Object.assign(ACT, {
  noteCat: (a, id, v) => { S.noteCat = v; SFX.tick(); rerender(); },
  noteSetCat: (a, id, v) => { S.ui.note.cat = v; SFX.tick(); rerender(); },
  ingAdd: () => { S.ui.note.ingredients.push({ name: "", qty: "", unit: "g" }); rerender(); },
  noteSave: async () => {
    const N = S.ui.note; const id = N._id; const d = { title: N.title.trim(), cat: N.cat, body: N.body, ingredients: (N.ingredients || []).filter((g) => g.name.trim()), updatedAt: Date.now(), uid: S.me.id };
    if (!d.title) { SFX.err(); toast("Donnez un titre à la fiche.", "err"); return; }
    if (id === "new") { d.at = Date.now(); const nid = await safe(DB.add("notes", d)); await logEvent("note", `a créé la fiche « ${d.title} »`, { ref: nid }); } else { await safe(DB.update("notes", id, d)); await logEvent("note", `a modifié la fiche « ${d.title} »`, { ref: id }); }
    S.ui.note = null; SFX.ok(); toast("Fiche enregistrée"); goBack();
  },
  noteDel: () => { openSheet(`<div class="h2" style="font-size:20px">Supprimer cette fiche ?</div><p class="sub" style="margin:0">Elle disparaît pour toute l'équipe.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="noteDelOk">Supprimer</button></div>`); },
  noteDelOk: async () => { closeSheet(true); const id = S.ui.note._id; await safe(DB.del("notes", id)); S.ui.note = null; toast("Fiche supprimée"); goBack(); },

});

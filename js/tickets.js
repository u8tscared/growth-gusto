/* Growth Gusto — area: tickets */
VIEWS.tickets = {
  live: false,
  render() {
    const T = S.tz;
    const list = S.tickets.map((t) => `<div class="li tap" data-act="ticket" data-id="${t.id}"><span class="ic">${ico("receipt")}</span><div class="tx"><b>Ticket Z du ${t.date ? shortDate(t.date) : "?"}</b><em>${(t.lines || []).length} ligne${(t.lines || []).length > 1 ? "s" : ""} · par ${esc(firstName(nameOf(t.uid)))}</em></div><span class="mono" style="font-weight:700">${t.total != null ? fmt(t.total, 2) + " €" : "–"}</span></div>`).join("");
    const edit = T ? `<div class="glass pad st" style="--i:2;display:flex;flex-direction:column;gap:12px">
        <div class="thumbs">${T.urls.map((u) => `<span class="thumb ${T.busy ? "scan" : ""}"><img src="${esc(u)}" alt=""></span>`).join("")}</div>
        ${T.busy ? `<span class="note">Lecture du ticket… cela prend quelques secondes.</span>` : `
        ${T.err ? `<div class="banner">${ico("alert")}<span>${esc(T.err)}</span></div>` : ""}
        <div class="grid2"><label class="field"><span>Date</span><input class="input" type="date" data-bind="tz.date" value="${esc(T.date || "")}"></label><label class="field"><span>Total TTC (€)</span><input class="input mono" inputmode="decimal" data-bind="tz.total" value="${esc(T.total ?? "")}"></label></div>
        <div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Article</th><th class="n">Qté</th><th class="n">Montant</th></tr></thead><tbody>${(T.lines || []).map((l, i) => `<tr><td><input class="input" style="height:38px;font-size:13.5px" data-bind="tz.lines.${i}.libelle" value="${esc(l.libelle)}"></td><td class="n" style="width:70px"><input class="input mono" style="height:38px;font-size:13.5px;text-align:right" data-bind="tz.lines.${i}.quantite" value="${esc(l.quantite ?? "")}"></td><td class="n" style="width:96px"><input class="input mono" style="height:38px;font-size:13.5px;text-align:right" data-bind="tz.lines.${i}.montant" value="${esc(l.montant ?? "")}"></td></tr>`).join("")}</tbody></table></div>
        <button class="btn ghost sm" data-act="tzAddLine" style="align-self:flex-start">${ico("plus")}Ligne</button><div class="grid2"><button class="btn soft" data-act="tzCancel">Annuler</button><button class="btn acc" data-act="tzSave">${ico("check")}Enregistrer</button></div>`}
      </div>` : "";
    return `<div class="inner narrow">${topBar("Tickets de caisse")}
      ${!T ? `<div class="glass pad st" style="--i:1;display:flex;flex-direction:column;gap:12px"><div class="hstack"><span class="ic">${ico("camera")}</span><div><b class="h3">Scanner le ticket Z</b><div class="sub">Ticket long ? Prenez-le en plusieurs photos, dans l'ordre.</div></div></div>
        <button class="btn acc block" data-act="${S.cap.sample ? "tzPick" : "tzManual"}">${ico(S.cap.sample ? "camera" : "edit")}${S.cap.sample ? "Prendre les photos" : "Saisir le ticket"}</button></div>` : ""}
      ${edit}
      <div class="glass pad st" style="--i:3"><div class="row"><span class="lbl">Historique</span><span class="sub">${S.tickets.length}</span></div>${list || `<div class="empty" style="padding:16px 0 4px">Aucun ticket enregistré.</div>`}</div>
      </div>`;
  },
};


Object.assign(ACT, {
  tzPick: async () => {
    const files = await pickImage(true); if (!files.length) return;
    const shr = await Promise.all(files.slice(0, 6).map((f) => shrink(f, 1800, 0.85)));
    S.tz = { busy: true, urls: shr.map((s) => URL.createObjectURL(s.blob)), lines: [], date: dayKey(), total: "" }; rerender();
    const ups = Promise.all(shr.map((s) => upload(s.blob)));
    try {
      const r = await S.cap.sample.json(`Ces photos montrent, dans l'ordre, un ticket Z (clôture de caisse) d'un restaurant français, éventuellement en plusieurs morceaux qui se suivent. Extrais les ventes. Réponds uniquement en JSON : {"date":"AAAA-MM-JJ","total_ttc":nombre,"lignes":[{"libelle":"","quantite":nombre,"montant":nombre}]}. Une ligne par article ou famille vendue, sans les totaux, taxes ni moyens de paiement. Nombres avec un point décimal.`, { images: shr.map((s) => s.blob), modelTier: "complex" });
      S.tz.date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : dayKey(); S.tz.total = r.total_ttc != null ? String(r.total_ttc).replace(".", ",") : ""; S.tz.lines = (r.lignes || []).map((l) => ({ libelle: l.libelle || "", quantite: l.quantite ?? "", montant: l.montant != null ? String(l.montant).replace(".", ",") : "" }));
      SFX.ok();
    } catch (e) { S.tz.err = "Lecture automatique impossible. Vous pouvez saisir les lignes à la main ou reprendre les photos."; S.tz.lines = [{ libelle: "", quantite: "", montant: "" }]; SFX.err(); }
    S.tz.ups = await ups; S.tz.busy = false; rerender();
  },
  tzManual: () => { S.tz = { busy: false, urls: [], lines: [{ libelle: "", quantite: "", montant: "" }], date: dayKey(), total: "" }; rerender(); },
  tzAddLine: () => { S.tz.lines.push({ libelle: "", quantite: "", montant: "" }); rerender(); },
  tzCancel: () => { S.tz = null; rerender(); },
  tzSave: async () => { const T = S.tz; const id = await safe(DB.add("tickets", { date: T.date, total: num(T.total), lines: T.lines.filter((l) => l.libelle).map((l) => ({ libelle: l.libelle, quantite: num(l.quantite), montant: num(l.montant) })), photoIds: (T.ups || []).map((u) => u.id).filter(Boolean), at: Date.now(), uid: S.me.id })); await logEvent("ticket", `a enregistré le ticket Z du ${shortDate(T.date)}`, { ref: id }); S.tz = null; SFX.ok(); toast("Ticket Z enregistré"); rerender(); },
  ticket: (a, id) => { const t = S.tickets.find((x) => x.id === id); openSheet(`<div class="h2" style="font-size:20px">Ticket Z du ${shortDate(t.date)}</div><div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Article</th><th class="n">Qté</th><th class="n">Montant</th></tr></thead><tbody>${(t.lines || []).map((l) => `<tr><td>${esc(l.libelle)}</td><td class="n">${l.quantite ?? ""}</td><td class="n">${l.montant != null ? fmt(l.montant, 2) : ""}</td></tr>`).join("")}</tbody></table></div><div class="row"><b>Total</b><b class="mono">${t.total != null ? fmt(t.total, 2) + " €" : "–"}</b></div>`); },
});

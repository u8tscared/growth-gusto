/* Growth Gusto — area: registre */
VIEWS.registre = {
  render() {
    const f = S.regFilter; const types = { all: null, temp: ["reading"], rec: ["reception"], trace: ["lot", "open", "out", "lost"], clean: ["chore"] };
    const ev = S.events.filter((e) => !types[f] || types[f].includes(e.type)).slice(0, 80);
    const exp = Math.max(1, S.fridges.length * 2);
    const cells = Array.from({ length: 30 }, (_, i) => { const k = addDays(dayKey(), i - 29); const rs = readingsFor(k); const n = new Set(rs.map((r) => r.fridgeId + r.slot)).size; const bad = rs.some((r) => !r.ok); const cls = !n ? "" : bad ? "r" : n >= exp ? "g" : "y"; return `<i class="${cls}" title="${shortDate(k)} · ${n}/${exp} relevés${bad ? " · hors seuil" : ""}"></i>`; }).join("");
    const conf = (() => { const rs = S.readings.filter((r) => daysUntil(r.day) >= -29); return rs.length ? Math.round((rs.filter((r) => r.ok).length / rs.length) * 1000) / 10 : null; })();
    return `<div class="inner">${topBar("Registre HACCP", { right: `<button class="btn soft sm" data-act="exportReg">${ico("download")}Exporter</button>` })}
      <div class="cols"><div>
      <div class="glass pad st" style="--i:1"><div class="row"><span class="lbl">30 derniers jours</span><span class="sub">${conf != null ? `${fmt(conf, 1)} % conformes` : "aucun relevé"}</span></div><div class="heat" style="margin-top:12px">${cells}</div><div class="hstack" style="gap:14px;margin-top:10px;font-size:11.5px;color:var(--muted);flex-wrap:wrap"><span class="hstack" style="gap:5px"><i style="width:10px;height:10px;border-radius:3px;background:#2FB985"></i>complet</span><span class="hstack" style="gap:5px"><i style="width:10px;height:10px;border-radius:3px;background:#F0A43A"></i>incomplet</span><span class="hstack" style="gap:5px"><i style="width:10px;height:10px;border-radius:3px;background:#E14560"></i>hors seuil</span></div></div>
      <div class="chips st" style="--i:2">${[["all", "Tout"], ["temp", "Températures"], ["rec", "Réceptions"], ["trace", "Traçabilité"], ["clean", "Ménage"]].map(([k, t]) => `<button class="chip ${f === k ? "on" : ""}" data-act="regF" data-v="${k}">${t}</button>`).join("")}</div>
      <div class="glass pad st" style="--i:3">${ev.length ? ev.map((e) => `<div class="li">${avatar(e.uid)}<div class="tx"><b style="white-space:normal">${esc(said(e.uid, e.text))}</b><em>${when(e.at)}</em></div>${e.photoUrl ? `<a class="thumb" style="width:46px;height:46px;border-radius:10px" href="${esc(e.photoUrl)}" target="_blank" rel="noopener"><img src="${esc(e.photoUrl)}" alt="Photo"></a>` : ""}</div>`).join("") : `<div class="empty">Le registre se remplit tout seul à chaque action.</div>`}</div>
      </div><div>
      <div class="glass pad st" style="--i:4;display:flex;flex-direction:column;gap:10px"><span class="lbl">Photos d'étiquettes</span><p class="note" style="margin:0">Les photos sont gardées 6 mois, comme demandé, puis supprimées depuis ce bouton.</p><button class="btn soft" data-act="purge" ${S.cap.assets ? "" : "disabled"}>${ico("trash")}Supprimer les photos de plus de 6 mois</button></div>
      <div class="glass pad st" style="--i:5"><span class="lbl">Pour un contrôle</span><p class="note" style="margin:6px 0 0">« Exporter » produit un fichier tableur avec tous les relevés, réceptions, ouvertures et sorties, avec date, heure et auteur.</p></div>
      </div></div></div>`;
  },
};


Object.assign(ACT, {
  regF: (a, id, v) => { S.regFilter = v; SFX.tick(); rerender(); },
  exportReg: async () => {
    const rows = [["Date", "Heure", "Type", "Détail", "Valeur", "Conforme", "Auteur"]];
    S.readings.slice().reverse().forEach((r) => rows.push([r.day, hm(r.at), `Relevé ${r.slot}`, fridgeName(r.fridgeId), String(r.value).replace(".", ","), r.ok ? "oui" : `non : ${r.action || ""}`, nameOf(r.uid)]));
    S.receptions.slice().reverse().forEach((rc) => (rc.lines || []).forEach((L) => rows.push([dayKey(new Date(rc.at)), hm(rc.at), "Réception", `${rc.supplier} · ${L.name} · lot ${L.lot || "-"} · DLC ${L.dlc || "-"}`, L.temp != null ? String(L.temp).replace(".", ",") : "", L.ok ? "oui" : "réserve", nameOf(rc.uid)])));
    S.lots.forEach((l) => { if (l.openedAt) rows.push([dayKey(new Date(l.openedAt)), hm(l.openedAt), "Ouverture", `${l.name} · DLC ouverte ${l.dlcOpen}`, "", "", nameOf(l.openedBy)]); if (l.outAt) rows.push([dayKey(new Date(l.outAt)), hm(l.outAt), l.status === "lost" ? "Perte" : "Sortie", l.name, "", "", nameOf(l.outBy)]); });
    await saveCsv(`registre-haccp-${dayKey()}.csv`, rows);
  },
  purge: async (a) => {
    if (!S.cap.assets) return; a.setAttribute("disabled", "");
    try { const { assets } = await S.cap.assets.list(); const lim = Date.now() - 183 * 864e5; const old = assets.filter((x) => new Date(x.createdAt).getTime() < lim);
      if (!old.length) { toast("Aucune photo de plus de 6 mois"); a.removeAttribute("disabled"); return; }
      for (const x of old) await S.cap.assets.delete(x.id); toast(`${old.length} photo${old.length > 1 ? "s" : ""} supprimée${old.length > 1 ? "s" : ""}`); SFX.ok();
    } catch (e) { toast("Suppression impossible : seuls les éditeurs peuvent gérer les photos.", "err"); }
    a.removeAttribute("disabled");
  },

});

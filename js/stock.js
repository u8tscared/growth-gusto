/* Growth Gusto — area: stock */
VIEWS.stock = {
  render() {
    const tab = S.stockTab, m = monthKey(), pm = prevMonthKey();
    const zones = [...new Set(S.products.map((p) => p.zone || "Autre"))];
    if (!S.zone || !zones.includes(S.zone)) S.zone = zones[0] || null;
    const seg = `<div class="seg st" style="--i:1"><span class="knob" style="width:calc(50% - 4px);transform:translateX(${tab === "cat" ? "100%" : "0"})"></span><button class="${tab === "inv" ? "on" : ""}" data-act="stockTab" data-v="inv">Inventaire de ${MONTHS[new Date().getMonth()]}</button><button class="${tab === "cat" ? "on" : ""}" data-act="stockTab" data-v="cat">Catalogue</button></div>`;
    if (!S.products.length) return `<div class="inner narrow">${topBar("Stock", { noBack: true })}${seg}<div class="glass empty st" style="--i:2"><div class="ic">${ico("box")}</div><b>Votre catalogue est vide</b>Ajoutez vos produits (sucre, beurre, saumon…) avec leur unité et leur prix, puis comptez-les chaque mois.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn acc" data-act="prodEdit">Ajouter un produit</button><button class="btn soft" data-act="prodStarter">Partir d'une liste type</button></div></div></div>`;
    if (tab === "cat") {
      return `<div class="inner narrow">${topBar("Stock", { noBack: true, right: `<button class="btn soft sm" data-act="prodEdit">${ico("plus")}Produit</button>` })}${seg}
        ${zones.map((z, zi) => `<div class="glass pad st" style="--i:${zi + 2}"><div class="row"><span class="lbl">${esc(z)}</span><span class="sub">${S.products.filter((p) => (p.zone || "Autre") === z).length}</span></div>${S.products.filter((p) => (p.zone || "Autre") === z).map((p) => `<div class="li tap" data-act="prodEdit" data-id="${p.id}"><div class="tx"><b>${esc(p.name)}</b><em>${esc(p.unit)} · pas de ${fmt(p.step || 1, (p.step || 1) < 1 ? 2 : 0)}${p.price ? ` · ${fmt(p.price, 2)} € / ${esc(p.unit)}` : " · prix non renseigné"}</em></div>${ico("chev")}</div>`).join("")}</div>`).join("")}</div>`;
    }
    const P = invProgress(); const rows = S.products.filter((p) => (p.zone || "Autre") === S.zone);
    const sum = invSummary();
    return `<div class="inner">${topBar("Stock", { noBack: true, right: `<button class="btn soft sm" data-act="exportInv" aria-label="Exporter Excel">${ico("download")}</button><button class="btn acc sm" data-act="countMode">${ico("list")}Compter</button>` })}${seg}
      <div class="cols"><div>
        <div class="glass pad st" style="--i:2"><div class="row"><b class="h3"><span class="mono">${P.n}</span> / ${P.total} comptés</b><span class="pill ${P.pct === 100 ? "ok" : "acc"}">${P.pct}%</span></div><div class="prog" style="margin-top:10px"><i style="width:${P.pct}%"></i></div></div>
        <div class="chips st" style="--i:3">${zones.map((z) => { const zp = S.products.filter((p) => (p.zone || "Autre") === z); const zc = zp.filter((p) => countOf(p.id, m) != null).length; return `<button class="chip ${z === S.zone ? "on" : ""}" data-act="zone" data-v="${esc(z)}">${esc(z)} <span style="opacity:.6">${zc}/${zp.length}</span></button>`; }).join("")}</div>
        <div class="glass pad st" style="--i:4">${rows.map((p) => {
          const c = countOf(p.id, m), pc = countOf(p.id, pm), d = c != null && pc != null ? c - pc : null; const dec = (p.step || 1) < 1 ? 2 : 1;
          return `<div class="li"><div class="tx"><b>${esc(p.name)}</b><em>${pc != null ? `En ${MONTHS[parseDay(pm + "-01").getMonth()]} : ${fmt(pc, dec)} ${esc(p.unit)}` : "Premier comptage"}${d != null ? ` · <span class="mono" style="font-weight:700;color:${d < 0 ? "var(--bad)" : d > 0 ? "var(--ok)" : "var(--muted)"}">${d > 0 ? "+" : ""}${fmt(d, dec)}</span>` : ""}</em></div>
            <div class="cnt"><button data-act="cnt" data-id="${p.id}" data-s="-1" aria-label="Moins">${ico("minus")}</button><input inputmode="decimal" data-cnt="${p.id}" value="${c != null ? fmt(c, dec) : ""}" placeholder="–" aria-label="Quantité ${esc(p.name)}"><button data-act="cnt" data-id="${p.id}" data-s="1" aria-label="Plus">${ico("plus")}</button></div></div>`;
        }).join("")}</div>
      </div><div>
        ${S.products.some((p) => p.price) ? "" : `<div class="glass pad st" style="--i:5;display:flex;flex-direction:column;gap:10px"><span class="lbl">Valeur et consommation</span><p class="note" style="margin:0">Ajoutez le prix de vos produits pour voir la valeur du stock et ce qui a été consommé ce mois-ci.</p><button class="btn soft sm" data-act="stockTab" data-v="cat" style="align-self:flex-start">Ouvrir le catalogue</button></div>`}
        <div class="glass pad st" style="--i:5;${S.products.some((p) => p.price) ? "" : "display:none"}"><span class="lbl">Valeur du stock compté</span><div class="title mono" style="margin-top:6px">${fmt(sum.value, 0)} €</div><div class="sub">${sum.prevValue ? `${sum.value >= sum.prevValue ? "+" : ""}${fmt(((sum.value - sum.prevValue) / sum.prevValue) * 100, 1)} % vs ${MONTHS[parseDay(pm + "-01").getMonth()]}` : "Renseignez les prix pour la valorisation"}</div></div>
        <div class="glass pad st" style="--i:6;${S.products.some((p) => p.price) ? "" : "display:none"}"><span class="lbl">Consommation du mois</span><div class="h2 mono" style="margin-top:6px">${fmt(sum.used, 0)} €</div><p class="note" style="margin:6px 0 0">Stock du mois dernier + achats reçus − stock compté aujourd'hui, pour chaque produit. Les achats viennent des réceptions dont le nom correspond au produit.</p>
          ${sum.top.length ? `<div style="margin-top:8px">${sum.top.map((t) => `<div class="li"><div class="tx"><b>${esc(t.name)}</b><em>${fmt(t.prev, t.dec)} + ${fmt(t.buy, t.dec)} − ${fmt(t.cur, t.dec)} ${esc(t.unit)}</em></div><span class="mono" style="font-weight:700">${fmt(t.used, t.dec)} ${esc(t.unit)}</span></div>`).join("")}</div>` : ""}</div>
      </div></div></div>`;
  },
};
function cmHtml() {
  const C = S.ui.cm; const p = S.products.find((x) => x.id === C.list[C.i]); if (!p) return ""; const pc = countOf(p.id, prevMonthKey()); const dec = (p.step || 1) < 1 ? 2 : 1;
  return `<div class="row"><span class="lbl">${esc(p.zone || "")} · ${C.i + 1} / ${C.list.length}</span><button class="btn ghost sm" data-act="sheetClose">Fermer</button></div>
    <div class="prog"><i style="width:${(C.i / C.list.length) * 100}%"></i></div>
    <div id="cmCard" style="text-align:center;padding:6px 0 2px"><div class="h2" style="font-size:24px">${esc(p.name)}</div><div class="sub">${pc != null ? `Le mois dernier : ${fmt(pc, dec)} ${esc(p.unit)}` : "Premier comptage"}</div>
      <div style="display:flex;align-items:baseline;justify-content:center;gap:8px;margin-top:10px"><span class="mono" id="cmVal" style="font-size:58px;font-weight:700;letter-spacing:-.06em;line-height:1">${esc(C.buf || "0")}</span><span class="mono" style="font-size:20px;color:var(--faint)">${esc(p.unit)}</span></div></div>
    <div class="keypad">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"].map((k) => `<button data-act="cmKey" data-v="${k}" aria-label="${k === "del" ? "Effacer" : k}">${k === "del" ? ico("back") : k}</button>`).join("")}</div>
    <div class="grid2" style="grid-template-columns:1fr 2fr"><button class="btn soft" data-act="cmNext" data-v="skip">Passer</button><button class="btn acc" data-act="cmNext">Suivant</button></div>`;
}
function countOf(pid, m) { const c = S.counts.find((x) => x.id === `${m}_${pid}`); return c ? c.qty : null; }
function invProgress() { const m = monthKey(); const total = S.products.length; const n = S.products.filter((p) => countOf(p.id, m) != null).length; return { n, total, pct: total ? Math.round((n / total) * 100) : 0 }; }
function invSummary() {
  const m = monthKey(), pm = prevMonthKey(); let value = 0, prevValue = 0, used = 0; const top = [];
  S.products.forEach((p) => {
    const c = countOf(p.id, m), pc = countOf(p.id, pm), price = p.price || 0; const dec = (p.step || 1) < 1 ? 2 : 1;
    if (c != null) value += c * price; if (pc != null) prevValue += pc * price;
    const buy = S.lots.filter((l) => l.createdAt && monthKey(new Date(l.createdAt)) === m && (l.productId === p.id || (l.name || "").toLowerCase() === p.name.toLowerCase()) && (l.unit || p.unit) === p.unit).reduce((a, l) => a + (num(l.qty) || 0), 0);
    if (c != null && pc != null) { const u = pc + buy - c; used += Math.max(0, u) * price; top.push({ name: p.name, unit: p.unit, prev: pc, buy, cur: c, used: u, dec }); }
  });
  top.sort((a, b) => b.used - a.used);
  return { value, prevValue, used, top: top.slice(0, 5) };
}


const countTimers = {};
function saveCount(pid, raw) {
  clearTimeout(countTimers[pid]); countTimers[pid] = setTimeout(() => {
    const v = num(raw); const id = `${monthKey()}_${pid}`;
    if (v == null) { DB.del("counts", id).catch(() => {}); return; }
    safe(DB.set("counts", id, { month: monthKey(), productId: pid, qty: v, uid: S.me.id, at: Date.now() })).catch(() => {});
  }, 500);
}

Object.assign(ACT, {
  stockTab: (a, id, v) => { S.stockTab = v; SFX.tick(); rerender(); },
  zone: (a, id, v) => { S.zone = v; SFX.tick(); rerender(); },
  cnt: (a, id) => {
    const p = S.products.find((x) => x.id === id); const inp = $(`[data-cnt="${id}"]`); const cur = num(inp.value) ?? countOf(id, prevMonthKey()) ?? 0;
    const nv = Math.max(0, Math.round((cur + (+a.dataset.s) * (p.step || 1)) * 100) / 100); inp.value = fmt(nv, (p.step || 1) < 1 ? 2 : 1);
    inp.classList.remove("bump"); void inp.offsetWidth; inp.classList.add("bump"); SFX.tick(); buzz(4); saveCount(id, inp.value);
  },
  prodEdit: (a, id) => {
    const p = S.products.find((x) => x.id === id) || { name: "", unit: "kg", zone: S.zone || ZONES[0], price: "", step: 0.5 };
    openSheet(`<div class="h2" style="font-size:20px">${id ? "Modifier le produit" : "Nouveau produit"}</div>
      <label class="field"><span>Nom</span><input class="input" id="pName" value="${esc(p.name)}" placeholder="Sucre semoule"></label>
      <div class="grid2"><label class="field"><span>Unité</span><select class="input" id="pUnit">${UNITS.map((u) => `<option ${u === p.unit ? "selected" : ""}>${u}</option>`).join("")}</select></label><label class="field"><span>Prix par unité (€)</span><input class="input mono" id="pPrice" inputmode="decimal" value="${p.price !== "" && p.price != null ? fmt(p.price, 2) : ""}" placeholder="1,20"></label></div>
      <div class="grid2"><label class="field"><span>Zone</span><input class="input" id="pZone" list="zoneList" value="${esc(p.zone)}"><datalist id="zoneList">${[...new Set([...ZONES, ...S.products.map((x) => x.zone)])].map((z) => `<option value="${esc(z)}">`).join("")}</datalist></label><label class="field"><span>Pas du compteur</span><input class="input mono" id="pStep" inputmode="decimal" value="${fmt(p.step || 1, (p.step || 1) < 1 ? 2 : 0)}"></label></div>
      <button class="btn acc block" data-act="prodSave" data-id="${id || ""}">Enregistrer</button>${id ? `<button class="btn ghost block" style="color:var(--bad)" data-act="prodDel" data-id="${id}">Supprimer</button>` : ""}`);
  },
  prodSave: async (a, id) => {
    const d = { name: $("#pName").value.trim(), unit: $("#pUnit").value, price: num($("#pPrice").value), zone: $("#pZone").value.trim() || "Autre", step: num($("#pStep").value) || 1 };
    if (!d.name) { SFX.err(); return; }
    if (id) await safe(DB.update("products", id, d)); else await safe(DB.add("products", { ...d, createdAt: Date.now() }));
    closeSheet(true); SFX.ok(); toast(id ? "Produit mis à jour" : "Produit ajouté");
  },
  prodDel: (a, id) => { openSheet(`<div class="h2" style="font-size:20px">Supprimer ce produit ?</div><p class="sub" style="margin:0">Les comptages passés restent dans l'historique.</p><div class="grid2"><button class="btn soft" data-act="sheetClose">Annuler</button><button class="btn danger" data-act="prodDelOk" data-id="${id}">Supprimer</button></div>`); },
  prodDelOk: async (a, id) => { await safe(DB.del("products", id)); closeSheet(true); toast("Produit supprimé"); },
  prodStarter: async () => {
    const L = [["Sucre semoule", "kg", "Réserve sèche", 0.5], ["Sel fin", "kg", "Réserve sèche", 0.1], ["Baies roses", "kg", "Réserve sèche", 0.01], ["Farine T55", "kg", "Réserve sèche", 0.5], ["Huile d'olive", "L", "Réserve sèche", 0.5], ["Beurre AOP", "kg", "Chambre froide 2", 0.5], ["Crème liquide 35 %", "L", "Chambre froide 2", 0.5], ["Saumon", "kg", "Chambre froide 1", 0.1], ["Crevettes grises", "kg", "Chambre froide 1", 0.1], ["Huîtres n°3", "bourriche", "Chambre froide 1", 1]];
    for (const [name, unit, zone, step] of L) await DB.add("products", { name, unit, zone, step, price: null, createdAt: Date.now() });
    SFX.ok(); toast("10 produits ajoutés, à compléter avec vos prix");
  },
  countMode: () => {
    const m = monthKey(); const zp = S.products.filter((p) => (p.zone || "Autre") === S.zone); const todo = zp.filter((p) => countOf(p.id, m) == null);
    S.ui.cm = { list: (todo.length ? todo : zp).map((p) => p.id), i: 0, buf: "" }; openSheet(cmHtml(), () => {}); },
  cmKey: (a, id, v) => { const C = S.ui.cm; if (v === "del") C.buf = C.buf.slice(0, -1); else if (v === "," ) { if (!C.buf.includes(",")) C.buf = (C.buf || "0") + ","; } else if (C.buf.length < 7) C.buf = (C.buf === "0" ? "" : C.buf) + v; SFX.tick(); buzz(3); const d = $("#cmVal"); d.textContent = C.buf || "0"; d.classList.remove("bump"); void d.offsetWidth; d.classList.add("bump"); },
  cmNext: (a, id, v) => {
    const C = S.ui.cm; const pid = C.list[C.i]; if (v !== "skip" && C.buf !== "") { saveCount(pid, C.buf); SFX.ok(); } else SFX.tap();
    C.i++; C.buf = "";
    if (C.i >= C.list.length) { closeSheet(true); setTimeout(() => { SFX.done(); toast(`${S.zone} compté`); rerender(); }, 600); return; }
    const b = $("#cmCard"); b.style.transition = "transform .22s var(--ease),opacity .22s"; b.style.transform = "translateX(-40%)"; b.style.opacity = "0";
    setTimeout(() => { $("#sheetBody").innerHTML = cmHtml(true); const n = $("#cmCard"); n.style.transform = "translateX(40%)"; n.style.opacity = "0"; void n.offsetWidth; n.style.transition = "transform .45s var(--spring),opacity .3s"; n.style.transform = ""; n.style.opacity = ""; }, 200);
  },
  exportInv: async () => {
    const m = monthKey(), pm = prevMonthKey();
    const rows = [["Produit", "Zone", "Unité", "Prix", monthLabel(pm), monthLabel(m), "Écart", "Valeur"]].concat(S.products.map((p) => { const c = countOf(p.id, m), pc = countOf(p.id, pm); return [p.name, p.zone, p.unit, p.price ?? "", pc ?? "", c ?? "", c != null && pc != null ? Math.round((c - pc) * 100) / 100 : "", c != null && p.price ? Math.round(c * p.price * 100) / 100 : ""]; }));
    await saveCsv(`inventaire-${m}.csv`, rows);
  },

});

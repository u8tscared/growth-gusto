// node tools/run.js tools/ev-ui.js (DESKTOP=1 / TABLET=1 too): demo → Événements (une case par événement) → bilan de l'événement →
// « Ouvrir la caisse du stand » (plein écran, sans menu ni barre d'onglets) → caisse (panier, carte, espèces + rendu) → commandes → ma journée
// → « Fermer la caisse » → bilan → préparer un événement → appareil du stand (kiosque). Vérifie que rien ne passe dans la salle.
// Prints EV OK / EV KO.
module.exports = async (page, shot) => {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); };
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  const click = async (sel) => { await page.$eval(sel, (e) => e.click()); await page.waitForTimeout(500); };
  await ev(() => go('evenement')); await page.waitForTimeout(1500);
  await shot('ev-1-evenements');
  const L = await ev(() => ({ cards: document.querySelectorAll('.ev-card').length, live: document.documentElement.classList.contains('ev-live'), nav: NAV.some((n) => n[0] === 'evenement' && n[2] === 'Événements') }));
  console.log('LIST', JSON.stringify(L)); ok(L.cards >= 2 && !L.live && L.nav, 'section Événements');
  await click('.ev-card[data-id=ev-salon]'); await page.waitForTimeout(600);
  await shot('ev-2-bilan-evenement');
  const D = await ev(() => ({ id: S.params.id, all: !!document.querySelector('.ev-days .chip.on[data-v=all]'), bars: document.querySelectorAll('.ev-bars.days .ev-bar').length }));
  console.log('DETAIL', JSON.stringify(D)); ok(D.id === 'ev-salon' && D.all && D.bars >= 2, 'bilan de l\'événement');
  /* restaurant data before selling on the stand */
  const before = await ev(() => JSON.stringify([Object.keys(DB.local[`restos/${S.rid}/clientOrders`] || {}).length, Object.keys(DB.local[`restos/${S.rid}/salleTabs`] || {}).length]));
  await click('.ev-head [data-act=evGoLive]'); await page.waitForTimeout(900);
  await shot('ev-3-caisse');
  const C = await ev(() => { const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
    return { live: document.documentElement.classList.contains('ev-live'), tiles: document.querySelectorAll('.ev-tile').length, side: vis('.side'), tabbar: vis('.tabbar'), back: vis('.top [data-act=back]'), stored: localStorage.getItem('gg-ev-live-' + S.rid) }; });
  console.log('TILL', JSON.stringify(C)); ok(C.live && C.tiles === 8 && !C.side && !C.tabbar && !C.back && C.stored === 'ev-salon', 'caisse plein écran');
  /* a table call from the dining room does not pop up on the till */
  await ev(() => toast('Table 5 · Demande l\'addition', 'info')); await page.waitForTimeout(200);
  const q = await ev(() => document.getElementById('toast').classList.contains('on') && /Table 5/.test(document.getElementById('toastTx').textContent));
  ok(!q, 'alerte du restaurant affichée sur la caisse');
  await click('.ev-tile[data-id=ev-croque]'); await click('.ev-tile[data-id=ev-croque]'); await click('.ev-tile[data-id=ev-vin]');
  await click('[data-act=evMode][data-v=emporter]');
  await shot('ev-4-panier');
  await click('[data-act=evPay]'); await page.waitForTimeout(400);
  await click('[data-act=evPayCash]');
  await click('[data-act=evGiven][data-v="30"]');
  await shot('ev-5-especes');
  await click('[data-act=evPaid]'); await page.waitForTimeout(800);
  const A = await ev(() => { const s = EV.sales[0]; return { ev: s.ev, n: s.n, total: s.total, pay: s.pay, mode: s.mode, status: s.status, cart: EV.cart.length }; });
  console.log('AFTER', JSON.stringify(A)); ok(A.ev === 'ev-salon' && A.total === 23 && A.status === 'prep' && !A.cart, 'vente espèces');
  await click('.ev-tile[data-id=ev-planche]'); await click('[data-act=evPay]'); await click('[data-act=evPaid][data-v=carte]'); await page.waitForTimeout(800);
  const after = await ev(() => JSON.stringify([Object.keys(DB.local[`restos/${S.rid}/clientOrders`] || {}).length, Object.keys(DB.local[`restos/${S.rid}/salleTabs`] || {}).length]));
  console.log('SALLE', before, after); ok(before === after, 'une vente du stand est passée dans la salle');
  await click('[data-act=evTab][data-v=servir]'); await page.waitForTimeout(500);
  await shot('ev-6-commandes');
  await click('.ev-oc [data-act=evStatus][data-v=prete]'); await page.waitForTimeout(700);
  await click('[data-act=evTab][data-v=bilan]'); await page.waitForTimeout(600);
  await shot('ev-7-ma-journee');
  await click('[data-act=evLiveEnd]'); await page.waitForTimeout(500);
  await shot('ev-8-fermer');
  await click('[data-act=evLiveEndGo]'); await page.waitForTimeout(900);
  const E = await ev(() => ({ live: document.documentElement.classList.contains('ev-live'), id: S.params.id, stored: localStorage.getItem('gg-ev-live-' + S.rid), tab: !!document.querySelector('.tabbar') && getComputedStyle(document.querySelector('.tabbar')).display !== 'none' }));
  console.log('CLOSED', JSON.stringify(E)); ok(!E.live && E.id === 'ev-salon' && !E.stored, 'fermer la caisse');
  await shot('ev-9-bilan-apres');
  await ev(() => go('evenement', {})); await page.waitForTimeout(600);
  await click('[data-act=evEditNew]'); await page.waitForTimeout(400);
  await page.fill('[data-bind="evF.name"]', 'Festival Lumière'); await click('[data-act=evItemAdd]');
  await page.fill('[data-bind="evF.items.0.t"]', 'Hot-dog'); await page.fill('[data-bind="evF.items.0.p"]', '6,5'); await page.fill('[data-bind="evF.items.0.n"]', '100');
  await shot('ev-10-preparer');
  await click('[data-act=evSave]'); await page.waitForTimeout(900);
  const N = await ev(() => { const s = (EV.stands || []).find((x) => x.name === 'Festival Lumière'); return { ok: !!s, items: s && s.items, route: S.route, id: S.params.id === (s && s.id) }; });
  console.log('NEW', JSON.stringify(N)); ok(N.ok && N.id, 'préparer un événement');
  await ev(() => { EV.sel = 'ev-salon'; EV.tab = 'vendre'; go('espaces'); }); await page.waitForTimeout(1200);
  await ev(() => ACT.esDemoDev(document.body, null, 'evenement', new MouseEvent('click'))); await page.waitForTimeout(3500);
  await shot('ev-11-stand-kiosque');
  const K = await ev(() => ({ route: S.route, kiosk: document.documentElement.classList.contains('es-kiosk'), live: document.documentElement.classList.contains('ev-live'), fab: !!document.getElementById('esLockFab'), close: !!document.querySelector('[data-act=evLiveEnd]') }));
  console.log('KIOSK', JSON.stringify(K)); ok(K.route === 'evenement' && K.kiosk && K.live && K.fab && !K.close, 'appareil du stand');
  console.log(bad.length ? 'EV KO ' + JSON.stringify(bad) : 'EV OK');
};

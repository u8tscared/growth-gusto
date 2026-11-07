// Prix dynamiques (js/prix.js) : happy hour, plat du jour, alertes de marge ; prix réduit dans la prise de commande et le menu QR.
// Usage : node tools/run.js tools/px-ui.js  (DESKTOP=1 / TABLET=1 pour les autres tailles)
const path = require('path');
module.exports = async (page, shot, ctx) => {
  const OUT = process.env.OUT || path.join(__dirname, 'out');
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); };
  ok(await page.evaluate(() => NAV.some((n) => n[0] === 'prix')), 'prix absent du menu');
  await page.evaluate(() => go('prix')); await page.waitForTimeout(1500);
  ok(await page.$('.px-hero'), 'hero absent');
  ok(await page.$('.px-hero .px-live:not(.off)'), 'happy hour de démo pas en cours');
  ok((await page.$$('.px-rule')).length >= 3, 'règles');
  await shot('px-1-happy-hour');
  /* public projection + the waiter's price */
  const r = await page.evaluate(() => { const P = pxPubPromos(pxCarte().map((n) => ({ id: n.id }))); const sp = S.notes.find((n) => n.id === 'n-spritz'); return { P, now: pxNowPrice(sp), full: num(sp.price), doc: cmPubDoc().promos.length }; });
  ok(r.P.some((p) => p.k === 'hh' && p.it['n-spritz'] === 30), 'spritz pas en happy hour : ' + JSON.stringify(r.P));
  ok(Math.abs(r.now - 6.3) < 0.001 && r.full === 9, 'prix du serveur ' + r.now);
  ok(r.doc >= 1, 'promos absentes du menu public');
  /* edit sheet */
  await page.evaluate(() => ACT.pxEdit(null, null, '')); await page.waitForTimeout(500);
  await page.fill('#pxN', 'Apéro test');
  await page.$eval('[data-act=pxFSec][data-v=dessert]', (e) => e.click()); await page.waitForTimeout(250);
  await page.$eval('[data-act=pxFPct][data-v="50"]', (e) => e.click()); await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.getElementById('pxN').value === 'Apéro test'), 'le nom saisi est perdu');
  ok(await page.$('.px-pr'), 'aperçu des prix');
  await shot('px-2-edition');
  await page.$eval('[data-act=pxHHSave]', (e) => e.click()); await page.waitForTimeout(700);
  ok(await page.evaluate(() => pxCfg().hh.some((x) => x.t === 'Apéro test' && x.pct === 50)), 'happy hour pas enregistré');
  /* plat du jour (the demo picks one alone) */
  await page.evaluate(() => { PX.tab = 'jour'; rerender(); }); await page.waitForTimeout(2500);
  ok(await page.evaluate(() => !!pxToday()), 'plat du jour automatique pas choisi');
  await page.evaluate(() => rerender()); await page.waitForTimeout(600);
  await shot('px-3-plat-du-jour');
  const T = await page.evaluate(() => { const t = pxToday(); return { id: t.n.id, pct: t.pct, why: t.why }; });
  /* margin alerts */
  await page.evaluate(() => { PX.tab = 'marge'; rerender(); }); await page.waitForTimeout(900);
  const n = (await page.$$('.px-al')).length; ok(n >= 1, 'alertes de marge : ' + n);
  await shot('px-4-marges');
  const before = await page.evaluate(() => { const b = document.querySelector('[data-act=pxBack]'); return { id: b.dataset.id, v: +b.dataset.v }; });
  await page.$eval('[data-act=pxBack]', (e) => e.click()); await page.waitForTimeout(800);
  ok(await page.evaluate((b) => num(S.notes.find((x) => x.id === b.id).price) === b.v, before), 'prix pas ajusté');
  ok(await page.evaluate(() => ALERTES.list().some((a) => a.type === 'marge')), "pas d'alerte dans le centre d'alertes");
  /* the public demo menu */
  const base = page.url().replace(/[#?].*$/, '').replace(/index\.html$/, '');
  const p2 = await ctx.newPage(); await p2.goto(base + 'commande/?r=demo&t=4'); await p2.waitForTimeout(1800);
  ok(await p2.$('.qm-deal'), 'bandeau happy hour absent du menu client');
  ok(await p2.$('.qm-was'), 'prix barré absent');
  await p2.screenshot({ path: path.join(OUT, 'px-5-menu-client.png') });
  await p2.$eval('.qm-cat[data-v=boisson]', (e) => e.click()); await p2.waitForTimeout(900);
  await p2.screenshot({ path: path.join(OUT, 'px-6-menu-boissons.png') });
  await p2.close();
  console.log('PX OK', JSON.stringify({ jour: T, alerts: n }));
};

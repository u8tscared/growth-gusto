// Cadeaux de fidélité, VIP automatique et client de la table (js/clients.js, js/salle.js, js/resa.js).
// Usage : node tools/run.js tools/fd-cadeaux.js  (DESKTOP=1 / TABLET=1 pour les autres tailles)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); };
  const w = (t = 500) => page.waitForTimeout(t);
  /* 1) la liste des cadeaux */
  await page.evaluate(() => { FD.tab = 'fid'; go('clients', { tab: 'fid' }); }); await w(1300);
  ok(await page.$('.fd-rwl'), 'liste des cadeaux absente');
  const n0 = await page.$$eval('.fd-rw:not(.add):not(.ed)', (x) => x.length); ok(n0 >= 5, 'cadeaux : ' + n0);
  await page.$eval('.fd-rwl', (e) => e.scrollIntoView({ block: 'center' })); await w(300); await shot('fdc-1-cadeaux');
  await page.fill('#fdRwN', 'Le digestif offert'); await page.press('#fdRwN', 'Enter'); await w(700);
  ok(await page.evaluate(() => fdCfg().rewards.includes('Le digestif offert')), 'ajout');
  const i = await page.evaluate(() => fdCfg().rewards.indexOf('Le digestif offert'));
  await page.$eval(`[data-act=fdRwPick][data-v="${i}"]`, (e) => e.click()); await w(600);
  ok(await page.evaluate(() => fdCfg().reward === 'Le digestif offert'), 'choix du cadeau');
  await page.$eval(`[data-act=fdRwEdit][data-v="${i}"]`, (e) => e.click()); await w(400);
  await page.fill('#fdRwE', 'Le digestif maison offert'); await page.press('#fdRwE', 'Enter'); await w(700);
  ok(await page.evaluate(() => fdCfg().reward === 'Le digestif maison offert' && !fdCfg().rewards.includes('Le digestif offert')), 'renommer le cadeau actif');
  await page.$eval('.fd-rwl', (e) => e.scrollIntoView({ block: 'center' })); await w(200); await shot('fdc-2-cadeau-modifie');
  await page.$eval(`[data-act=fdRwDel][data-v="${i}"]`, (e) => e.click()); await w(200);
  ok(await page.evaluate(() => fdCfg().rewards.includes('Le digestif maison offert')), 'supprimé en un seul toucher');
  await page.$eval(`[data-act=fdRwDel][data-v="${i}"]`, (e) => e.click()); await w(700);
  ok(await page.evaluate(() => !fdCfg().rewards.includes('Le digestif maison offert') && fdCfg().rewards.includes(fdCfg().reward)), 'suppression du cadeau actif');
  /* 2) VIP tout seul */
  const vipBefore = await page.evaluate(() => fdPeople().filter((p) => p.vip).length);
  await page.$eval('[data-act=fdCfgTog][data-v=vipAuto]', (e) => e.click()); await w(700);
  ok(await page.evaluate(() => fdCfg().vipAuto === true), 'VIP auto non activé');
  for (let k = 0; k < 6; k++) { await page.$eval('[data-act=fdVipN][data-v="-1"]', (e) => e.click()); await w(250); }
  const vipAfter = await page.evaluate(() => fdPeople().filter((p) => p.vip).length);
  ok(vipAfter > vipBefore, `VIP auto : ${vipBefore} → ${vipAfter}`);
  await page.$eval('[data-act=fdVipN]', (e) => e.scrollIntoView({ block: 'center' })); await w(200); await shot('fdc-3-vip-auto');
  /* enlever le VIP à la main à un client devenu VIP tout seul */
  const auto = await page.evaluate(() => { const p = fdPeople().find((x) => x.vipAuto && !(x.doc || {}).vip); return p && p.id; }); ok(auto, 'pas de VIP auto');
  await page.evaluate((id) => fdOpenSheet(id), auto); await w(700); await shot('fdc-4-fiche-vip-auto');
  await page.$eval('[data-act=fdVip]', (e) => e.click()); await w(300);
  await page.$eval('[data-act=fdSave]', (e) => e.click()).catch(() => {}); await w(900);
  ok(await page.evaluate((id) => !fdById(id).vip, auto), 'VIP non retiré à la main');
  await page.evaluate(() => closeSheet(true)); await w(400);
  /* 3) annuler un cadeau noté par erreur */
  const g = await page.evaluate(() => { const p = fdPeople().find((x) => (x.doc && (x.doc.gifts || []).length)); return p && { id: p.id, st: p.stamps }; }); ok(g, 'pas de cadeau dans la démo');
  await page.evaluate((id) => fdOpenSheet(id), g.id); await w(700);
  await page.$eval('[data-act=fdGiftDel]', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
  const more = await page.$('[data-act=fdAll]'); if (more && !(await page.$('[data-act=fdGiftDel]'))) { await more.click(); await w(400); }
  ok(await page.$('[data-act=fdGiftDel]'), 'bouton annuler le cadeau absent');
  await page.$eval('[data-act=fdGiftDel]', (e) => e.click()); await w(200); await shot('fdc-5-annuler-cadeau');
  await page.$eval('[data-act=fdGiftDel]', (e) => e.click()); await w(900);
  const st2 = await page.evaluate((id) => fdById(id).stamps, g.id); ok(st2 > g.st, `tampons rendus : ${g.st} → ${st2}`);
  await page.evaluate(() => closeSheet(true)); await w(400);
  /* 4) table sans réservation : Pierre Morel */
  await page.evaluate(() => go('salle')); await w(1200);
  const tid = await page.evaluate(() => { const t = slTables().T.find((x) => !slTabAt(x.id) && !slBookingAt(x.id)); return t && t.id; }); ok(tid, 'pas de table libre');
  const before = await page.evaluate(() => { const p = fdPeople().find((x) => x.name === 'Pierre Morel'); return { id: p.id, v: p.visits }; });
  await page.evaluate((id) => slOpenSheet(slTableBy(id)), tid); await w(700);
  ok(await page.$('#slClQ'), 'champ « Qui est à table ? » absent');
  await page.fill('#slClQ', 'Morel'); await w(400); await shot('fdc-6-qui-est-a-table');
  await page.$eval(`#slClR [data-act=slClPick][data-id="${before.id}"]`, (e) => e.click()); await w(400);
  await page.$eval('[data-act=slOpen][data-v="2"]', (e) => e.click()); await w(1400);
  const after = await page.evaluate((id) => fdById(id).visits, before.id); ok(after === before.v + 1, `visite de Pierre : ${before.v} → ${after}`);
  ok(await page.$('.sl-tcl.on'), 'client absent de la table'); await shot('fdc-7-table-pierre');
  /* changer pour un nouveau client : la venue suit */
  await page.$eval('[data-act=slClient]', (e) => e.click()); await w(600);
  await page.fill('#slClQ', 'Bastien'); await w(300);
  await page.$eval('[data-act=slClNew]', (e) => e.click()); await w(300);
  await page.fill('#slClP', '06 11 22 33 44'); await shot('fdc-8-nouveau-client');
  await page.$eval('[data-act=slClNewOk]', (e) => e.click()); await w(1300);
  const moved = await page.evaluate((id) => ({ p: fdById(id).visits, n: (fdPerson('0611223344') || {}).visits, nm: (fdPerson('0611223344') || {}).name }), before.id);
  ok(moved.p === before.v && moved.n === 1 && moved.nm === 'Bastien', 'venue déplacée : ' + JSON.stringify(moved));
  /* invité */
  await page.$eval('[data-act=slClient]', (e) => e.click()); await w(600);
  await page.$eval('[data-act=slClPick][data-id=""]', (e) => e.click()); await w(1200);
  ok(await page.evaluate(() => (fdPerson('0611223344') || {}).visits === 0), 'invité : la venue reste notée');
  ok(await page.$('.sl-tcl:not(.on)'), 'puce invité absente');
  console.log('FDC OK');
};

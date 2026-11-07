// Prévisions (js/previsions.js) : démo avec 13 mois d'historique N-1, prévision du jour, fiche d'un jour, import d'un fichier, commandes reliées.
// Usage : node tools/run.js tools/pv-ui.js  (DESKTOP=1 / TABLET=1 pour les autres tailles, DARK=1 pour le mode sombre)
module.exports = async (page, shot) => {
  if (process.env.DARK) { await page.evaluate(() => localStorage.setItem('gg-theme', 'dark')); await page.reload(); }
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); };
  await page.evaluate(() => go('previsions')); await page.waitForTimeout(1600);
  const info = await page.evaluate(() => { const d = PREV.range(dayKey(), addDays(dayKey(), 13)); return { n: d.length, open: d.filter((x) => !x.closed).length, ca: d.map((x) => x.ca), tr: PREV.trend(), acc: PREV.accuracy(), ev: d.filter((x) => x.ev).map((x) => x.k + ' ' + x.ev.t) }; });
  console.log(JSON.stringify(info));
  ok(info.open >= 10, 'jours ouverts : ' + info.open); ok(info.tr && info.tr > 1.02 && info.tr < 1.15, 'tendance : ' + info.tr); ok(info.acc && info.acc.pct > 0.7, 'précision');
  ok(await page.$$eval('.pv-d', (x) => x.length) === 14, 'barres');
  await shot('pv-1-ecran');
  await page.evaluate(() => { const v = $('#viewport .view'); v.scrollTop = 99999; }); await page.waitForTimeout(500); await shot('pv-1b-bas');
  await page.evaluate(() => ACT.pvDay(null, null, PREV.range(dayKey(), addDays(dayKey(), 13)).find((x) => x.ev && !x.closed).k)); await page.waitForTimeout(700);
  ok(await page.$('.pv-sheet .pv-r.tot'), 'fiche du jour'); await shot('pv-2-jour');
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(300);
  await page.evaluate(() => ACT.pvMode(null, null, 'cov')); await page.waitForTimeout(500); await page.evaluate(() => ACT.pvH(null, null, 28)); await page.waitForTimeout(700);
  ok(await page.$$eval('.pv-d', (x) => x.length) === 28, '28 jours'); await shot('pv-3-couverts-28j');
  // import d'un fichier « CA par jour »
  await page.evaluate(() => { const rows = [['Date', 'CA TTC', 'Couverts']]; for (let i = 0; i < 30; i++) rows.push([addDays('2024-06-01', i).split('-').reverse().join('/'), String(1500 + i * 10).replace('.', ','), '50']); const T = cxTable(rows); S.ui.pvI = { file: 'export.csv', head: T.head, rows: T.rows, cols: pvGuess(T.head, T.rows) }; openSheet(pvImportHtml(), pvImportAfter); });
  await page.waitForTimeout(500); await shot('pv-4-import');
  ok(await page.evaluate(() => Object.keys(pvParse(S.ui.pvI)).length === 30), 'import : 30 jours');
  await page.$eval('[data-act=pvSave]', (e) => e.click()); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => !!PREV.sales('2024-06-10') && PREV.sales('2024-06-10').src === 'import'), 'jour importé');
  // les commandes et le tableau de bord suivent
  ok(await page.evaluate(() => { const k = addDays(dayKey(), 2); const a = acCovers(k), p = PREV.day(k); return p.closed ? !a.open : a.n >= p.covers; }), 'commandes reliées');
  await page.evaluate(() => go('dashboard')); await page.waitForTimeout(1200); ok(await page.$('.fdb-pv'), 'tuile tableau de bord'); await shot('pv-5-tableau');
  ok(await page.evaluate(() => { const r = salesBetween(addDays(dayKey(), -364 - 6), addDays(dayKey(), -364)); return r.ttc > 0; }), 'N-1 dans salesBetween');
  await page.evaluate(() => go('achats')); await page.waitForTimeout(1000); await shot('pv-6-achats');
  console.log('PV OK');
};

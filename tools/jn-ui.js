// Journée du restaurant (js/journee.js) : réglage du rythme (bar ouvert la nuit), noms des relevés, jours fermés, congés.
// Usage : node tools/run.js tools/jn-ui.js  (DESKTOP=1 / TABLET=1 pour les autres tailles)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); console.log('ok', m); };
  await page.evaluate(() => go('reglages')); await page.waitForTimeout(900);
  ok(await page.$('[data-act=jnOpen]'), 'ligne Réglages');
  await page.$eval('[data-act=jnOpen]', (e) => e.click()); await page.waitForTimeout(600);
  ok(await page.$('#sheetBody .jn'), 'fiche ouverte'); await shot('jn-1-fiche');
  await page.$eval('[data-act=jnPreset][data-v=nuit]', (e) => e.click()); await page.waitForTimeout(500);
  ok(await page.evaluate(() => GG_DAY.start === 8 && GG_DAY.cut === 22 && GG_DAY.names[1] === 'Fermeture'), 'préréglage nuit');
  /* à 1 h du matin, un bar ouvert la nuit est encore sur la veille, au relevé de fermeture */
  const at = (h) => page.evaluate((h) => {
    const R = Date; const t = new R(2026, 10, 7, h, 30).getTime();
    class F extends R { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }
    window.Date = F; try { return { k: dayKey(), s: slotNow(), n: slotName(slotNow()) }; } finally { window.Date = R; }
  }, h);
  const a1 = await at(1), a19 = await at(19), a23 = await at(23), a9 = await at(9);
  console.log(JSON.stringify({ a1, a9, a19, a23 }));
  ok(a1.k === '2026-11-06' && a1.s === 'soir' && a1.n === 'Fermeture', '1 h = fermeture de la veille');
  ok(a9.k === '2026-11-07' && a9.s === 'midi', '9 h = ouverture du jour');
  ok(a19.s === 'midi' && a23.s === 'soir', '19 h ouverture, 23 h fermeture');
  await shot('jn-2-nuit');
  /* jour fermé aujourd'hui → accueil « Fermé aujourd'hui », registre sans oubli */
  const wd = await page.evaluate(() => ggDayNow().getDay());
  await page.$eval(`[data-act=jnWd][data-v="${wd}"]`, (e) => e.click()); await page.waitForTimeout(500);
  ok(await page.evaluate(() => ggClosed(dayKey())), 'aujourd\'hui fermé');
  await page.$eval('[data-act=jnOffAdd]', (e) => e.click()); await page.waitForTimeout(300);
  await page.fill('#jnLbl', 'Fermeture annuelle'); await page.$eval('[data-act=jnOffSave]', (e) => e.click()); await page.waitForTimeout(600);
  ok(await page.evaluate(() => ggClosed(addDays(dayKey(), 3))), 'congés pris en compte');
  await page.fill('#jnN0', 'Ouverture'); await page.fill('#jnN1', 'Clôture');
  await shot('jn-3-fermetures');
  await page.$eval('[data-act=jnSave]', (e) => e.click()); await page.waitForTimeout(800);
  ok(await page.evaluate(() => GG_DAY.names[1] === 'Clôture'), 'noms enregistrés');
  await page.evaluate(() => go('home')); await page.waitForTimeout(1200);
  const home = await page.evaluate(() => $('#viewport').innerText);
  ok(/Fermé aujourd'hui/.test(home), 'accueil fermé'); await shot('jn-4-accueil');
  for (const v of ['releve', 'registre', 'controle', 'alertes']) { await page.evaluate((v) => { try { go(v); } catch (e) {} }, v); await page.waitForTimeout(900); await shot('jn-5-' + v); }
  ok(await page.evaluate(() => /Clôture/i.test(regSlotT('soir')) && /Clôture/i.test(relSlotName('soir'))), 'registre et relevés suivent les noms');
  /* retour à midi/soir */
  await page.evaluate(() => go('reglages')); await page.waitForTimeout(600); await page.$eval('[data-act=jnOpen]', (e) => e.click()); await page.waitForTimeout(400);
  await page.$eval('[data-act=jnPreset][data-v=midi]', (e) => e.click()); await page.waitForTimeout(400);
  ok(await page.evaluate(() => GG_DAY.start === 4 && GG_DAY.cut === 16 && slotName('soir') === 'Soir'), 'retour midi/soir');
  console.log('JN OK');
};

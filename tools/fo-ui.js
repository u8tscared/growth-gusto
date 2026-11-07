// Annuaire des fournisseurs (js/fournisseurs.js) : liste, filtre du jour, fiche, ajout, favori, commande en un clic, retrait.
// Usage : node tools/run.js tools/fo-ui.js  (DESKTOP=1 / TABLET=1 pour les autres tailles)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); };
  await page.evaluate(() => go('fournisseurs')); await page.waitForTimeout(1200);
  const n = await page.$$eval('.fo-card', (x) => x.length); ok(n >= 8, 'cartes fournisseurs : ' + n);
  ok(await page.$('.fo-next'), 'prochaine commande absente'); await shot('fo-1-liste');
  await page.evaluate(() => ACT.foDay(null, null, addDays(dayKey(), [1, 2].find((i) => parseDay(addDays(dayKey(), i)).getDay() !== 0)))); await page.waitForTimeout(500);
  const n2 = await page.$$eval('.fo-card', (x) => x.length); ok(n2 > 0 && n2 <= n, 'filtre du jour : ' + n2);
  await page.evaluate(() => ACT.foClear()); await page.waitForTimeout(300);
  await page.evaluate(() => ACT.foEdit(null, null, '')); await page.waitForTimeout(500);
  await page.fill('#foN', 'Fromagerie Bernard'); await page.fill('#foPh', '06 12 34 56 78'); await page.fill('#foAd', '5 rue Mercière, Lyon');
  await page.$eval('[data-act=foSDay][data-v="4"]', (e) => e.click());
  await page.$eval('[data-act=foSave]', (e) => e.click()); await page.waitForTimeout(900);
  ok(await page.evaluate(() => S.route === 'fournisseur' && !!foOf(acKey('Fromagerie Bernard'))), 'nouveau fournisseur pas ouvert');
  ok(await page.evaluate(() => foCatOf(foOf(acKey('Fromagerie Bernard'))) === 'cremerie'), 'catégorie devinée');
  await shot('fo-2-fiche');
  await page.$eval('[data-act=foFav]', (e) => e.click()); await page.waitForTimeout(300);
  ok(await page.evaluate(() => foOf(acKey('Fromagerie Bernard')).doc.fav === true), 'favori');
  await page.evaluate(() => go('fournisseur', { k: acKey('Charcuterie Ripert') })); await page.waitForTimeout(800);
  await page.$eval('.fo-send', (e) => e.click()); await page.waitForTimeout(500);
  ok(await page.$('.ac-send'), "la commande en un clic n'ouvre pas l'envoi"); await shot('fo-3-envoi');
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(300);
  await page.evaluate(() => { go('fournisseur', { k: acKey('Fromagerie Bernard') }); ACT.foEdit(null, null, acKey('Fromagerie Bernard')); }); await page.waitForTimeout(500);
  await page.$eval('[data-act=foArch]', (e) => e.click()); await page.$eval('[data-act=foArch]', (e) => e.click()); await page.waitForTimeout(600);
  ok(await page.evaluate(() => S.route === 'fournisseurs' && !foAll().some((s) => s.key === acKey('Fromagerie Bernard'))), 'retrait');
  console.log('FO OK');
};

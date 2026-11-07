// Marques et points de vente (js/marques.js) : démo avec « Le Comptoir à huîtres », chiffres par marque, création, rangement des plats.
// Usage : node tools/run.js tools/mq-ui.js  (DESKTOP=1 / TABLET=1)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); console.log('ok', m); };
  ok(await page.evaluate(() => mqList().length === 1), 'démo : une marque');
  await page.evaluate(() => go('reglages')); await page.waitForTimeout(800);
  ok(await page.$('[data-go=marques]'), 'Réglages : ligne Marques');
  await page.evaluate(() => go('marques')); await page.waitForTimeout(1200); await shot('mq-1-ecran');
  const st = await page.evaluate(() => { const s = mqStats(30); return { total: s.total, b: Object.fromEntries(Object.entries(s.B).map(([k, v]) => [k || 'main', [Math.round(v.ca), Math.round(v.fc || 0), Math.round(v.margin || 0), v.qty]])) }; });
  console.log(JSON.stringify(st));
  ok(st.b['b-huitres'] && st.b['b-huitres'][0] > 0 && st.b.main && st.b.main[0] > 0, 'CA par marque');
  ok(await page.$$eval('.mq-card', (x) => x.length) === 2, 'deux cartes (marque + carte principale)');
  await page.$eval('[data-act=mqDays][data-v="7"]', (e) => e.click()); await page.waitForTimeout(600); await shot('mq-2-7j');
  /* nouvelle marque, puis ses plats */
  await page.$eval('[data-act=mqEdit][data-v=""]', (e) => e.click()); await page.waitForTimeout(400);
  await page.fill('#mqN', 'Bistrot Box'); await page.$eval('[data-act=mqSave]', (e) => e.click()); await page.waitForTimeout(900);
  ok(await page.evaluate(() => mqList().some((b) => b.name === 'Bistrot Box')), 'marque créée');
  ok(await page.$('.mq-ds'), 'choix des plats ouvert'); await shot('mq-3-plats');
  await page.$eval('[data-act=mqPut][data-id=n-bourgui]', (e) => e.click()); await page.waitForTimeout(500);
  ok(await page.evaluate(() => mqOf(S.notes.find((n) => n.id === 'n-bourgui')).name === 'Bistrot Box'), 'plat rangé');
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(600);
  ok(await page.$$eval('.mq-card', (x) => x.length) === 3, 'trois cartes'); await shot('mq-4-trois');
  await page.evaluate(() => go('marges')); await page.waitForTimeout(1200); ok(await page.$('.mg [data-go=marques]'), 'Marges : bouton Par marque');
  /* suppression : les plats reviennent à la carte principale */
  await page.evaluate(() => go('marques')); await page.waitForTimeout(800);
  const bid = await page.evaluate(() => mqList().find((b) => b.name === 'Bistrot Box').id);
  await page.$eval(`[data-act=mqEdit][data-v="${bid}"]`, (e) => e.click()); await page.waitForTimeout(400);
  await page.$eval('[data-act=mqDel]', (e) => e.click()); await page.waitForTimeout(900);
  ok(await page.evaluate(() => !mqOf(S.notes.find((n) => n.id === 'n-bourgui')) && mqList().length === 1), 'marque supprimée, plat revenu');
  console.log('MQ OK');
};

// node tools/run.js tools/notifs-ui.js (DESKTOP=1 / TABLET=1 too): démo → Notifications (gérante) → aperçu du téléphone, postes, interrupteurs,
// réglages de cet appareil, heures calmes → « Voir comme » Sarah (salle) : un bon envoyé, prêt 20 s plus tard → bannière « prêt ».
module.exports = async (page, shot) => {
  const c = (s) => page.$eval(s, (e) => e.click()); const w = (ms) => page.waitForTimeout(ms);
  await w(1500); await c('[data-act=auDemo]'); await w(2500);
  if (await page.evaluate(() => DB.mode) !== 'demo') throw new Error('démo non ouverte');
  if (!(await page.evaluate(() => NAV.some((n) => n[0] === 'notifs')))) throw new Error('Notifications absent du menu');
  await page.evaluate(() => go('reglages')); await w(900);
  if (!(await page.$('[data-go=notifs]'))) throw new Error('ligne Notifications absente des Réglages');
  await c('[data-go=notifs]'); await w(1400); await shot('pu-01-patron');
  const pat = await page.evaluate(() => PU_KINDS.map((k) => k[0]).filter((k) => puAccountOn(k)));
  if (!pat.includes('ca') || pat.includes('k_new')) throw new Error('défauts patron faux : ' + pat);
  if ((await page.$$('#puStack .pu-pc')).length < 2) throw new Error('aperçu du téléphone vide');
  await w(3000); await shot('pu-02-apercu-anime');
  await page.evaluate(() => window.scrollTo(0, 0));
  await c('[data-act=puPreset][data-v=cuisine]'); await w(700); await shot('pu-03-preset-cuisine');
  if (!(await page.evaluate(() => puAccountOn('k_new') && !puAccountOn('ca')))) throw new Error('poste Cuisine non appliqué');
  await c('[data-act=puPreset][data-v=patron]'); await w(500);
  if (await page.evaluate(() => Object.keys(puPrefs().kinds).length)) throw new Error('revenir au poste du patron devrait vider les exceptions');
  await c('[data-act=puToggle][data-v=chat]'); await w(400);
  if (await page.evaluate(() => puAccountOn('chat'))) throw new Error('interrupteur Discussion sans effet');
  await c('[data-act=puScope][data-v=dev]'); await w(500); await c('[data-act=puToggle][data-v=ca]'); await w(500); await shot('pu-04-cet-appareil');
  if (await page.evaluate(() => puDevOn('ca') || !puAccountOn('ca'))) throw new Error('réglage par appareil faux');
  await c('[data-act=puScope][data-v=all]'); await w(300);
  await c('[data-act=puQuietSheet]'); await w(600); await shot('pu-05-heures-calmes');
  await c('[data-act=puQuietPre][data-v="00:00|09:00"]'); await c('[data-act=puQuietOk]'); await w(600);
  if (!(await page.evaluate(() => puPrefs().quiet.on && puPrefs().quiet.from === '00:00'))) throw new Error('heures calmes non enregistrées');
  await c('[data-act=puPlay]'); await w(1200); await shot('pu-06-banniere-demo');
  if (!(await page.$('.pu-ban'))) throw new Error('pas de bannière en démo');
  await w(6500);
  /* Sarah (salle): sends a table, the demo kitchen cooks it, she gets « prêt » */
  await page.evaluate(() => { esDemoBecome('demo-sarah'); go('notifs'); }); await w(1200); await shot('pu-07-sarah');
  const sal = await page.evaluate(() => PU_KINDS.map((k) => k[0]).filter((k) => puAccountOn(k)));
  if (!sal.includes('s_ready') || sal.includes('ca')) throw new Error('défauts salle faux : ' + sal);
  await page.evaluate(() => { const now = Date.now(); const id = 'nftest1'; DB.set('clientOrders', id, { src: 'salle', mode: 'table', table: '6', tabId: 'x', course: 2, courseT: 'Plats', station: 'cuisine', items: [{ name: 'Bœuf bourguignon', q: 2 }], total: 44, n: 99, day: dayKey(), at: now, firedAt: now, waiter: 'demo-sarah', waiterName: 'Sarah Lemoine', status: 'nouvelle' }); });
  await w(900); await page.evaluate(() => go('home')); await w(400);
  await page.evaluate(() => DB.update('clientOrders', 'nftest1', { status: 'prete', readyAt: Date.now(), by: 'demo-thomas' })); await w(1100); await shot('pu-08-pret-sarah');
  const t = await page.$$eval('.pu-ban b', (b) => b.map((x) => x.textContent));
  if (!t.some((x) => /Table 6.*prêt/.test(x))) throw new Error('Sarah n\'a pas reçu « prêt » : ' + JSON.stringify(t));
  console.log('PU OK');
};

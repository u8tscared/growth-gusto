// Journal des actions (rafales repliées, « Aujourd'hui » lisible) + bulles qu'on efface (appel de table, notification) : croix et glisser.
// Usage : node tools/run.js tools/effacer-ui.js  (DESKTOP=1 / TABLET=1 pour les autres tailles)
module.exports = async (page, shot) => {
  const ok = (c, m) => { if (!c) throw new Error(m); console.log('ok', m); };
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  /* journal */
  await page.evaluate(() => go('journal')); await page.waitForTimeout(1000);
  await page.$eval('[data-act=jrP][data-v=jour]', (e) => e.click()); await page.waitForTimeout(1000);
  ok(await page.evaluate(() => [...document.querySelectorAll('.jr-per button')].every((b) => b.scrollWidth <= b.clientWidth)), 'les 4 périodes tiennent en entier');
  const n = await page.evaluate(() => ({ rows: document.querySelectorAll('.jr-list > .jr-day > .jr-row, .jr-gr').length, grp: document.querySelectorAll('.jr-grp').length, all: JR_ROWS().filter((e) => e.at >= jrSince()).length }));
  console.log(JSON.stringify(n));
  ok(n.grp >= 1 && n.rows < n.all / 2, 'rafale automatique repliée');
  ok(await page.evaluate(() => [...document.querySelectorAll('.jr-row.sens')].length >= 2), 'gestes sensibles toujours visibles un par un');
  await page.evaluate(() => document.querySelector('.jr-list').scrollIntoView()); await page.waitForTimeout(500); await shot('ef-1-journal');
  await page.$eval('[data-act=jrGrp]', (e) => e.click()); await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.querySelectorAll('.jr-grp.open .jr-sub .jr-row').length >= 4), 'rafale dépliée');
  await page.evaluate(() => document.querySelector('.jr-grp.open').scrollIntoView()); await page.waitForTimeout(400); await shot('ef-2-deplie');
  /* appel de table : la croix */
  await page.evaluate(() => { localStorage.removeItem('gg-ap-hid'); AP.hid = null; DB.set('tableCalls', 't9-eau', { table: '9', kind: 'eau', at: Date.now(), n: 1, day: dayKey(), status: 'new', src: 'qr' }); go('home'); });
  await page.waitForTimeout(1500);
  ok(await page.$('#apPill.on .ap-px'), 'bulle Table avec sa croix'); await shot('ef-3-bulle');
  await page.click('#apPill .ap-pt'); await page.waitForTimeout(700);
  ok(await page.$('#sheet.open .ap-sh'), 'toucher la bulle ouvre toujours la liste des appels');
  await page.evaluate(() => closeSheet(true)); await page.waitForTimeout(500);
  await page.click('#apPill .ap-px'); await page.waitForTimeout(700);
  ok(!(await page.$('#apPill.on')), 'croix : bulle masquée');
  ok(await page.evaluate(() => apLive().length >= 1), "l'appel reste ouvert (pas clos)");
  await page.evaluate(() => { rerender(); }); await page.waitForTimeout(600);
  ok(!(await page.$('#apPill.on')), 'reste masquée après un rafraîchissement');
  /* un nouvel appel la refait apparaître ; on la chasse d'un glissé */
  await page.evaluate(() => DB.set('tableCalls', 't3-pain', { table: '3', kind: 'pain', at: Date.now(), n: 1, day: dayKey(), status: 'new', src: 'qr' }));
  await page.waitForTimeout(1500);
  ok(await page.$('#apPill.on'), 'nouvel appel : la bulle revient');
  const b = await page.$eval('#apPill .ap-pt', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; });
  await page.mouse.move(b.x, b.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + i * 25, b.y); await page.waitForTimeout(16); } await page.mouse.up();
  await page.waitForTimeout(900);
  ok(!(await page.$('#apPill.on')), 'glisser : bulle masquée');
  ok(!(await page.$('#sheet.open')), 'le glissé n\'ouvre pas la liste');
  /* notification : croix et glisser */
  await page.evaluate(() => puBanner({ title: 'Table 5', body: 'Demande l\'addition', kind: 's_call' })); await page.waitForTimeout(700);
  ok(await page.$('.pu-ban.on .pu-bx'), 'notification avec sa croix'); await shot('ef-4-notif');
  const r0 = await page.evaluate(() => S.route);
  await page.click('.pu-ban .pu-bx'); await page.waitForTimeout(700);
  ok(!(await page.$('.pu-ban')), 'croix : notification effacée');
  ok(await page.evaluate((r) => S.route === r, r0), 'la croix n\'ouvre rien');
  await page.evaluate(() => puBanner({ title: 'Table 2', body: 'Appelle le serveur', kind: 's_call' })); await page.waitForTimeout(700);
  const c = await page.$eval('.pu-ban', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + 60, y: r.y + r.height / 2 }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(c.x - i * 25, c.y); await page.waitForTimeout(16); } await page.mouse.up();
  await page.waitForTimeout(700);
  ok(!(await page.$('.pu-ban')), 'glisser : notification effacée');
};

// Une personne sur plusieurs établissements (js/rh.js, staff.sites) : même fiche dans chaque restaurant, heures additionnées pour l'HCR.
// Usage : node tools/run.js tools/rh-sites.js  (DESKTOP=1 / TABLET=1)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); console.log('ok', m); };
  const info = await page.evaluate(() => ({ restos: S.restos.map((r) => r.id + ':' + r.name), staff: S.staff.map((s) => s.id + ':' + s.name) }));
  console.log(JSON.stringify(info));
  ok(info.restos.length >= 2, 'démo : plusieurs restaurants');
  const other = info.restos[1].split(':')[0];
  await page.evaluate(() => go('staff')); await page.waitForTimeout(1000);
  const sid = await page.evaluate(() => S.staff.find((s) => /Hugo/.test(s.name)).id);
  await page.evaluate((sid) => ACT.rhEmp(null, sid), sid); await page.waitForTimeout(500);
  ok(await page.$(`[data-act=rhESite][data-v="${other}"]`), 'fiche : choix des établissements');
  await page.$eval(`[data-act=rhESite][data-v="${other}"]`, (e) => e.click()); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = $('.rh-sites'); s && s.scrollIntoView(); }); await shot('rs-1-fiche');
  await page.$eval('[data-act=rhEmpSave]', (e) => e.click()); await page.waitForTimeout(1200);
  const copy = await page.evaluate(([sid, other]) => { const c = (DB.local[`restos/${other}/staff`] || {})[sid]; return c ? { name: c.name, sites: c.sites, active: c.active } : null; }, [sid, other]);
  console.log(JSON.stringify(copy));
  ok(copy && copy.active !== false && copy.sites.includes(other), 'fiche copiée dans l\'autre restaurant');
  /* 3 longues journées prévues là-bas cette semaine : elles comptent ici */
  const before = await page.evaluate((sid) => rhHoursOf(rhStaff(sid), rhMonday()).used, sid);
  await page.evaluate(async ([sid, other]) => { const mon = rhMonday(); for (let i = 0; i < 3; i++) await mrPut(other, 'shifts', 'rs' + i, { staffId: sid, day: addDays(mon, i), start: '08:00', end: '20:00', breakMin: 30, post: 'salle' }); }, [sid, other]);
  const after = await page.evaluate((sid) => { const h = rhHoursOf(rhStaff(sid), rhMonday()); return { used: h.used, away: h.away, alerts: h.alerts.map((a) => a.t) }; }, sid);
  console.log(before, JSON.stringify(after));
  ok(after.away === 3 * 690 && after.used >= before + 3 * 690 - 1, 'heures d\'ailleurs additionnées');
  await page.evaluate(() => go('planning')); await page.waitForTimeout(1200);
  ok(/ailleurs/.test(await page.evaluate(() => $('#viewport').innerText)), 'planning : « + … ailleurs »'); await shot('rs-2-planning');
  await page.evaluate((sid) => ACT.rhHrOpen(null, sid), sid); await page.waitForTimeout(500);
  ok(/prévues au|prévues à/.test(await page.evaluate(() => $('#sheetBody').innerText)), 'fiche heures : détail ailleurs'); await shot('rs-3-heures');
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(300);
  /* dans l'autre restaurant, la personne est là, à la pointeuse */
  await page.evaluate((other) => ACT.restoPick(null, other), other); await page.waitForTimeout(2000);
  await page.evaluate(() => go('pointeuse')); await page.waitForTimeout(1200);
  ok(/Hugo/.test(await page.evaluate(() => $('#viewport').innerText)), 'pointeuse de l\'autre restaurant'); await shot('rs-4-pointeuse-autre');
  /* retrait : la fiche de l'autre restaurant passe en ancien */
  await page.evaluate(() => ACT.restoPick(null, 'demo')); await page.waitForTimeout(2000);
  await page.evaluate(() => go('staff')); await page.waitForTimeout(800);
  await page.evaluate((sid) => ACT.rhEmp(null, sid), sid); await page.waitForTimeout(400);
  await page.$eval(`[data-act=rhESite][data-v="${other}"]`, (e) => e.click()); await page.$eval('[data-act=rhEmpSave]', (e) => e.click()); await page.waitForTimeout(1000);
  ok(await page.evaluate(([sid, other]) => DB.local[`restos/${other}/staff`][sid].active === false, [sid, other]), 'retrait : fiche désactivée là-bas');
  console.log('SITES OK');
};

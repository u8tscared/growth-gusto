// Heures sup. et temps de travail (js/heuressup.js) : démo → carte au Planning et aux Employés, alertes, réglages des seuils,
// une semaine à 50 h au planning (va sortir du cadre légal), « Vu ». Usage : node tools/run.js tools/hs-ui.js (DESKTOP=1 / TABLET=1 ; DARK=1)
module.exports = async (page, shot) => {
  const ok = (c, m) => { if (!c) throw new Error('KO : ' + m); console.log('ok · ' + m); };
  const W = (ms) => page.waitForTimeout(ms); const tag = process.env.DESKTOP ? 'desk' : process.env.TABLET ? 'tab' : 'tel';
  if (process.env.DARK) { await page.evaluate(() => localStorage.setItem('gg-theme', 'dark')); await page.reload(); await W(1200); }
  await page.waitForFunction(() => document.querySelector('#au.on [data-act=auDemo]'), null, { timeout: 8000 });
  await page.$eval('#au.on [data-act=auDemo]', (e) => e.click()); await W(2600);
  await page.evaluate(() => { const x = document.querySelector('#auDemo'); x && (x.style.display = 'none'); });
  /* one person with a heavy week: 5 × 10 h already clocked, and a 6th day planned → 48 h crossed by the planning */
  const sid = await page.evaluate(async () => {
    const p = rhPeople().find((x) => x.post === 'cuisine') || rhPeople()[0]; const mon = rhMonday(); const t = dayKey();
    const at = (d, h, m) => { const x = parseDay(d); x.setHours(h, m, 0, 0); return x.getTime(); };
    for (const s of S.shifts.filter((s) => s.staffId === p.id && s.day >= mon)) await DB.del('shifts', s.id);
    for (const q of S.punches.filter((q) => q.staffId === p.id && q.day >= mon)) await DB.del('punches', q.id);
    for (let i = 0; i < 7; i++) { const d = addDays(mon, i); if (i === 6) continue; await DB.add('shifts', { staffId: p.id, day: d, start: '09:00', end: '20:00', breakMin: 60, post: 'cuisine' });
      if (d < t) { await DB.add('punches', { staffId: p.id, kind: 'in', at: at(d, 8, 55), day: d, by: 'x' }); await DB.add('punches', { staffId: p.id, kind: 'out', at: at(d, 20, 5), day: d, by: 'x' }); } }
    return p.id; });
  await page.evaluate(() => hsAttach()); await W(600); await page.evaluate(() => hsRun(true)); await W(1500);
  const docs = await page.evaluate(() => HS.docs.map((d) => [d.id, d.lvl, d.fut, d.title, d.body]));
  console.log('ALERTS', JSON.stringify(docs, null, 1));
  ok(docs.some((d) => d[0].startsWith(sid)), 'alerte pour la personne chargée');
  const again = await page.evaluate(async () => { for (let i = 0; i < 4; i++) { await hsRun(true); await new Promise((r) => setTimeout(r, 300)); } const n = HS.docs.length; await hsRun(true); await new Promise((r) => setTimeout(r, 400)); return [n, HS.docs.length]; });
  ok(again[0] === again[1], 'pas de doublon au 2e passage');
  await W(400); await page.evaluate(() => { const b = document.querySelector('#puBans'); b && (b.style.display = 'none'); go('planning'); }); await W(1200);
  ok(await page.$('#hsCard'), 'carte au planning');
  await page.evaluate(() => document.querySelector('#hsCard').scrollIntoView({ block: 'start' })); await W(600); await shot('hs-1-planning-' + tag);
  await page.$eval('[data-act=hsCfgOpen]', (e) => e.click()); await W(700); await shot('hs-2-reglages-' + tag);
  await page.$eval('[data-act=hsStep][data-v=week][data-d="1"]', (e) => e.click()); await W(500);
  ok(await page.evaluate(() => hsCfg().week.h === 9), 'seuil semaine +1 h');
  await page.evaluate(() => closeSheet()); await W(500);
  await page.$eval('#hsCard [data-act=hsPerson]', (e) => e.click()); await W(700); await shot('hs-4-personne-' + tag);
  await page.$eval('#sheet [data-act=hsSeenP]', (e) => e.click()); await W(600);
  ok(await page.evaluate(() => HS.docs.some((d) => d.seen)), 'marquée vue');
  await page.evaluate(() => go('staff')); await W(1000);
  ok(await page.$('#hsCard'), 'carte aux employés'); await shot('hs-3-employes-' + tag);
  await page.evaluate(() => go('notifs')); await W(900);
  ok(await page.evaluate(() => PU_KINDS.some((k) => k[0] === 'heures')), 'catégorie de notification');
};

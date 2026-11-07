// Planning intelligent (js/planif.js) : proposition de la semaine prochaine en démo, changer une personne, couverts à la main,
// dispos, réglages, publier (les créneaux arrivent dans le Planning). Usage : node tools/run.js tools/pf-ui.js (DESKTOP=1 / TABLET=1)
module.exports = async (page, shot) => {
  const ok = (c, m) => { if (!c) throw new Error('KO : ' + m); console.log('ok · ' + m); };
  const tag = process.env.DESKTOP ? 'desk' : process.env.TABLET ? 'tab' : 'tel';
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  ok(await page.evaluate(() => NAV.some((n) => n[0] === 'planif')), 'dans le menu');
  await page.evaluate(() => go('planning')); await page.waitForTimeout(900);
  ok(await page.$('[data-act=rhPropose]'), 'bouton « Proposer la semaine » au planning');
  await shot('pf-0-planning-' + tag);
  await page.evaluate(() => { S.ui.rhPlanWeek = addDays(rhMonday(), 7); rerender(); }); await page.waitForTimeout(400);
  await page.$eval('[data-act=rhPropose]', (e) => e.click()); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => { const D = S.ui.pf; return { route: S.route, n: D.shifts.length, gaps: D.gaps.length, cov: Object.values(D.fc).map((f) => f.n), src: Object.values(D.fc).map((f) => f.src), hugoMidi: D.shifts.filter((s) => s.staffId === 's_demo-hugo' && s.svc === 'midi').length, days: rhPeople().map((p) => [p.name, new Set(D.shifts.filter((s) => s.staffId === p.id).map((s) => s.day)).size]) }; });
  console.log(JSON.stringify(r));
  ok(r.route === 'planif' && r.n > 10, 'proposition : ' + r.n + ' créneaux');
  ok(r.hugoMidi === 0, 'Hugo jamais le midi (indispo)');
  ok(r.days.every(([, d]) => d <= 5), '2 jours de repos pour chacun');
  await shot('pf-1-proposition-' + tag);
  await page.evaluate(() => document.querySelectorAll('.pf-day')[1].scrollIntoView({ block: 'start' })); await page.waitForTimeout(500); await shot('pf-2-jours-' + tag);
  // swap a person
  await page.$eval('.pf-ch', (e) => e.click()); await page.waitForTimeout(600); await shot('pf-3-changer-' + tag);
  const cand = await page.$('.pf-cand:not([disabled])');
  if (cand) { await cand.evaluate((e) => e.click()); await page.waitForTimeout(500); ok(await page.evaluate(() => S.ui.pf.edited), 'personne remplacée'); }
  else await page.evaluate(() => closeSheet(true));
  // covers by hand
  const d = await page.evaluate(() => rhWeekDays(S.ui.pf.mon)[5]);
  await page.$eval(`[data-act=pfCov][data-v="${d}"]`, (e) => e.click()); await page.waitForTimeout(500); await shot('pf-4-couverts-' + tag);
  await page.$eval('#pfCovN', (e) => (e.value = '140')); await page.$eval('[data-act=pfCovSave]', (e) => e.click()); await page.waitForTimeout(700);
  const sat = await page.evaluate((d) => ({ n: S.ui.pf.fc[d].n, ppl: S.ui.pf.shifts.filter((s) => s.day === d).length, gaps: S.ui.pf.gaps.filter((g) => g.day === d).reduce((x, g) => x + g.n, 0) }), d);
  ok(sat.n === 140 && sat.ppl + sat.gaps > 6, 'samedi 140 couverts → plus de monde : ' + JSON.stringify(sat));
  await page.evaluate((d) => { const el = document.querySelector(`[data-act=pfCov][data-v="${d}"]`); el.scrollIntoView({ block: 'center' }); }, d); await page.waitForTimeout(500); await shot('pf-5-samedi-' + tag);
  // availability
  await page.$eval('[data-act=pfAvail]', (e) => e.click()); await page.waitForTimeout(600); await shot('pf-6-dispos-' + tag);
  await page.$eval('[data-act=pfAvDone]', (e) => e.click()); await page.waitForTimeout(400);
  await page.$eval('[data-act=pfTune]', (e) => e.click()); await page.waitForTimeout(600); await shot('pf-7-reglages-' + tag);
  await page.$eval('[data-act=pfTPer][data-v="salle|-1"]', (e) => e.click()); await page.waitForTimeout(300);
  await page.$eval('[data-act=pfTuneSave]', (e) => e.click()); await page.waitForTimeout(800);
  ok(await page.evaluate(() => S.resto.pfCfg && S.resto.pfCfg.posts.salle.per < 25), 'réglages enregistrés');
  // publish
  await page.$eval('[data-act=pfPublish]', (e) => e.click()); await page.waitForTimeout(500); await shot('pf-8-publier-' + tag);
  const n = await page.evaluate(() => S.ui.pf.shifts.length);
  await page.$eval('[data-act=pfPublishGo]', (e) => e.click()); await page.waitForTimeout(2500);
  const pub = await page.evaluate(() => { const mon = addDays(rhMonday(), 7); const l = S.shifts.filter((s) => s.day >= mon && s.day <= addDays(mon, 6)); return { route: S.route, n: l.length, auto: l.filter((s) => s.src === 'auto').length }; });
  ok(pub.route === 'planning' && pub.n === n && pub.auto === n, 'publié dans le Planning : ' + JSON.stringify(pub));
  await shot('pf-9-publie-' + tag);
  // dark mode
  await page.evaluate(() => { closeSheet(true); TH.pref = 'dark'; S.ui.pf = { mon: addDays(rhMonday(), 14), cov: {} }; go('planif'); }); await page.waitForTimeout(1200);
  await shot('pf-10-sombre-' + tag);
};

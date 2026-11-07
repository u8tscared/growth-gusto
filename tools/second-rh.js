// Pack Second : pointeuse, planning et fiches employés ouverts, sans salaires, coûts ni export paie (pack Chef).
// Usage : node tools/run.js tools/second-rh.js  (DESKTOP=1 / TABLET=1)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); console.log('ok', m); };
  const txt = async (r) => { await page.evaluate((r) => go(r), r); await page.waitForTimeout(1100); return page.evaluate(() => $('#viewport').innerText); };
  ok(/Coût estimé/.test(await txt('planning')), 'Chef : coût au planning');
  await page.evaluate(() => { window.abPlan = () => ({ plan: 'pro', pack: 'pro', feat: 'pro', open: true, days: null }); });
  const pl = await txt('planning'); await shot('sr-1-planning');
  ok(!/fait partie du pack/.test(pl) && !/Coût estimé/.test(pl) && !/€/.test(pl), 'Second : planning sans euros');
  const po = await txt('pointeuse'); await shot('sr-2-pointeuse');
  ok(!/fait partie du pack/.test(po) && !/€/.test(po), 'Second : pointeuse sans euros');
  const st = await txt('staff'); await shot('sr-3-employes');
  ok(!/fait partie du pack/.test(st) && !/Masse salariale/.test(st) && /pack Chef/.test(st), 'Second : fiches employés sans salaires');
  ok(await page.$('[data-act=rhEmpNew]'), 'Second : le gérant ajoute un employé');
  await page.$eval('[data-act=rhEmpNew]', (e) => e.click()); await page.waitForTimeout(500);
  ok(!(await page.$('#rhEw')), 'Second : pas de taux horaire dans la fiche'); await shot('sr-4-fiche');
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(300);
  ok(/fait partie du pack Chef/.test(await txt('planif')), 'Second : planning intelligent reste Chef');
  ok(/fait partie du pack Chef/.test(await txt('finance')), 'Second : finances restent Chef');
  ok(await page.evaluate(() => AB_PACKS.pro.feats.includes('Pointeuse & planning')), 'pack Second affiche pointeuse & planning');
  console.log('SECOND RH OK');
};

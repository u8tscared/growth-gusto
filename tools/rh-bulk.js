// Ajout groupé d'extras / saisonniers (js/rh.js, rhBulk) : une liste collée devient des fiches, visibles au planning et à la pointeuse.
// Usage : node tools/run.js tools/rh-bulk.js  (DESKTOP=1 / TABLET=1)
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ok = (c, m) => { if (!c) throw new Error(m); console.log('ok', m); };
  await page.evaluate(() => go('equipe')); await page.waitForTimeout(1200);
  ok(await page.$('[data-act=rhBulk]'), 'Équipe : ajout groupé proposé');
  const n0 = await page.evaluate(() => S.staff.length);
  await page.$eval('[data-act=rhBulk]', (e) => e.click()); await page.waitForTimeout(500);
  await page.fill('#rhBt', '1. Léa Martin\n- Hugo Bernard\nInès Diallo, Tom Leroy\nléa martin\n\nCamille Laurent');
  await page.waitForTimeout(300);
  const note = await page.$eval('#rhBn', (e) => e.textContent); console.log(note);
  ok(/5 personnes/.test(note) && /déjà dans l'équipe/.test(note), 'liste lue, doublons repérés');
  await page.$eval('[data-act=rhBC][data-v=CDD]', (e) => e.click()); await page.waitForTimeout(300);
  await page.$eval('[data-act=rhBP][data-v=cuisine]', (e) => e.click()); await page.waitForTimeout(300);
  await page.fill('#rhBe', '2026-09-15'.replace('2026', String(new Date().getFullYear() + 1)));
  await shot('rb-1-fiche');
  ok(/Ajouter 4 personnes/.test(await page.$eval('[data-act=rhBulkSave]', (e) => e.textContent)), 'bouton : 4 personnes');
  await page.$eval('[data-act=rhBulkSave]', (e) => e.click()); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => S.staff.filter((s) => s.bulk).map((s) => [s.name, s.contract, s.post, s.end, s.weeklyHours]));
  console.log(JSON.stringify(r));
  ok(await page.evaluate(() => S.staff.length) === n0 + 4 && r.every((x) => x[1] === 'CDD' && x[2] === 'cuisine' && x[3] && x[4] === 35), '4 saisonniers créés');
  await page.evaluate(() => go('planning')); await page.waitForTimeout(1200);
  ok(/Inès/.test(await page.evaluate(() => $('#viewport').innerText)), 'visibles au planning'); await shot('rb-2-planning');
  await page.evaluate(() => go('pointeuse')); await page.waitForTimeout(1200);
  ok(/Tom/.test(await page.evaluate(() => $('#viewport').innerText)), 'visibles à la pointeuse'); await shot('rb-3-pointeuse');
  await page.evaluate(() => go('staff')); await page.waitForTimeout(900); ok(await page.$('[data-act=rhBulk]'), 'Employés : bouton Plusieurs'); await shot('rb-4-employes');
  console.log('BULK OK');
};

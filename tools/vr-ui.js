// node tools/run.js tools/vr-ui.js (DESKTOP=1 / TABLET=1 too): démo → Réglages → Verrouillage → activer Face ID (simulé) + code de secours
// → verrouiller → écran verrouillé → Face ID → déverrouillé ; code : faux puis bon ; désactivation après confirmation.
module.exports = async (page, shot) => {
  const c = (s) => page.$eval(s, (e) => e.click()); const w = (ms) => page.waitForTimeout(ms);
  const keys = async (sel, code) => { for (const d of code) { await c(`${sel} [data-v="${d}"]`); await w(90); } };
  await w(1500); await c('[data-act=auDemo]'); await w(2500);
  if (await page.evaluate(() => DB.mode) !== 'demo') throw new Error('démo non ouverte');
  await page.evaluate(() => go('reglages')); await w(900); await shot('vr-01-reglages');
  if (!(await page.$('[data-go=verrou]'))) throw new Error('ligne Verrouillage absente des Réglages');
  await c('[data-go=verrou]'); await w(1000); await shot('vr-02-ecran');
  await c('[data-act=vrEnable]'); await w(700); await shot('vr-03-scan'); await w(1500);
  await shot('vr-04-code'); await keys('.vr-sheetpin', '111111'); await w(400); await shot('vr-05-code-faible');
  await keys('.vr-sheetpin', '258014'); await w(400); await keys('.vr-sheetpin', '258014'); await w(1200);
  if (!(await page.evaluate(() => vrOn()))) throw new Error('verrouillage non activé');
  await shot('vr-06-active');
  await c('[data-act=vrLockNow]'); await w(900); await shot('vr-07-verrouille');
  if (!(await page.evaluate(() => VR.locked && document.querySelector('#app').hasAttribute('inert')))) throw new Error('pas verrouillé');
  await c('.vr-cta[data-act=vrBio]'); await w(500); await shot('vr-08-scan'); await w(1000); await shot('vr-09-ok'); await w(900);
  if (await page.evaluate(() => VR.locked)) throw new Error('Face ID simulé n\'a pas déverrouillé');
  await c('[data-act=vrLockNow]'); await w(700); await c('[data-act=vrUsePin]'); await w(300);
  await keys('.vr-lock', '123456'); await w(500); await shot('vr-10-code-faux');
  if (!(await page.evaluate(() => VR.locked))) throw new Error('faux code accepté');
  await keys('.vr-lock', '258014'); await w(1100);
  if (await page.evaluate(() => VR.locked)) throw new Error('bon code refusé');
  await c('[data-act=vrForgot]').catch(() => {});
  // reprise après un passage en arrière-plan de plus de 5 min
  await page.evaluate(() => { VR.hiddenAt = Date.now() - 6 * 60000; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await w(600); if (!(await page.evaluate(() => VR.locked))) throw new Error('pas verrouillé au retour');
  await page.evaluate(() => vrUnlockTest()); await w(700);
  await c('[data-act=vrOff]'); await w(700); await shot('vr-11-confirmer');
  await c('.vr-cta[data-act=vrBio]'); await w(2200);
  if (await page.evaluate(() => vrOn())) throw new Error('désactivation impossible');
  await shot('vr-12-desactive');
  console.log('VR OK');
};

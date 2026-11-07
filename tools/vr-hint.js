// UA=iPad TABLET=1 node tools/run.js tools/vr-hint.js : sur un iPad à bouton supérieur, le bouton Touch ID s'allume pendant la vérification.
module.exports = async (page, shot) => {
  const c = (s) => page.$eval(s, (e) => e.click()); const w = (ms) => page.waitForTimeout(ms);
  await w(1500); await c('[data-act=auDemo]'); await w(2500);
  await page.evaluate(() => go('verrou')); await w(800);
  await c('[data-act=vrEnable]'); await w(500);
  if (!(await page.$('#vrTb.on'))) throw new Error('pas d\'animation du bouton pendant l\'activation');
  await shot('vh-1-activation');
  await w(1800); for (const d of '258014') { await c(`.vr-sheetpin [data-v="${d}"]`); await w(90); } await w(500); for (const d of '258014') { await c(`.vr-sheetpin [data-v="${d}"]`); await w(90); } await w(1300); await shot('vh-1b');
  await c('[data-act=vrLockNow]'); await w(800); await c('.vr-cta[data-act=vrBio]'); await w(400);
  await shot('vh-2-verrou-portrait');
  for (const o of ['l', 'r', 'b']) { await page.evaluate((o) => { const h = document.getElementById('vrTb'); if (h) h.dataset.o = o; }, o); await shot('vh-3-' + o); }
  await w(1500);
  if (await page.evaluate(() => VR.locked)) throw new Error('pas déverrouillé');
  console.log('HINT OK');
};

// node tools/run.js tools/vr-emb.js (DESKTOP=1 / TABLET=1 too; DARK=1 for dark mode): le logo du restaurant en empreinte sur l'écran verrouillé.
// démo (initiales) → logo « 8 » noir sur fond blanc (JPEG) → logo transparent (PNG) → déverrouillage simulé.
module.exports = async (page, shot) => {
  const c = (s) => page.$eval(s, (e) => e.click()); const w = (ms) => page.waitForTimeout(ms);
  const keys = async (sel, code) => { for (const d of code) { await c(`${sel} [data-v="${d}"]`); await w(80); } };
  if (process.env.DARK || process.env.TOUCH) { await page.evaluate((o) => { if (o.d) localStorage.setItem('gg-theme', 'dark'); if (o.t) localStorage.setItem('gg-vr-sensor', 'touch'); }, { d: !!process.env.DARK, t: !!process.env.TOUCH }); await page.reload(); }
  await w(1500); await c('[data-act=auDemo]'); await w(2500);
  await page.evaluate(() => go('verrou')); await w(900);
  await c('[data-act=vrEnable]'); await w(2300); await keys('.vr-sheetpin', '258014'); await w(400); await keys('.vr-sheetpin', '258014'); await w(1200);
  const lock = async (n) => { await page.evaluate(() => { if (VR.locked) vrUnlockTest(); }); await w(700); await page.evaluate(() => VR.lockNow()); await w(300); await shot(n + '-a-trace'); await w(2200); await shot(n + '-b');
    const r = await page.evaluate(() => { const e = document.querySelector('#vrEmb'); return { emb: !!e && !e.classList.contains('wait'), cls: e && e.className, paths: e ? e.querySelectorAll('.vr-er.fr path').length : 0, glyph: !!document.querySelector('#vrGlyph') }; });
    if (!r.emb || r.paths < 20 || !r.glyph) throw new Error('empreinte absente ' + JSON.stringify(r)); return r; };
  console.log('initiales', JSON.stringify(await lock('ve-01-initiales')));
  // logo opaque : un 8 noir sur blanc
  await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#1a1a1a'; g.font = '900 280px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', 150, 160); S.resto.logo = cv.toDataURL('image/jpeg', .9); S.resto.name = 'Le Parc à 8'; });
  const r2 = await lock('ve-02-logo-8'); if (!/logo/.test(r2.cls)) throw new Error('logo non utilisé ' + r2.cls);
  // logo transparent : une fourchette + cercle
  await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 240; cv.height = 240; const g = cv.getContext('2d'); g.strokeStyle = '#c33'; g.lineWidth = 26; g.beginPath(); g.arc(120, 120, 90, 0, 6.283); g.stroke(); g.fillStyle = '#c33'; g.fillRect(108, 50, 24, 140); g.fillRect(80, 50, 14, 60); g.fillRect(146, 50, 14, 60); S.resto.logo = cv.toDataURL('image/png'); S.resto.name = 'La Fourchette'; });
  const r3 = await lock('ve-03-logo-png'); if (!/logo/.test(r3.cls)) throw new Error('logo png non utilisé');
  await c('.vr-cta[data-act=vrBio]'); await w(500); await shot('ve-04-scan'); await w(1100); await shot('ve-05-ok'); await w(900);
  if (await page.evaluate(() => VR.locked)) throw new Error('pas déverrouillé');
  console.log('EMB OK');
};

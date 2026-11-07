// node tools/run.js tools/avc-ui.js (DESKTOP=1 / TABLET=1, DARK=1): demo → Avis clients → répondre → QR « Votre avis » ; menu QR servi → « Comment c'était ? »
module.exports = async (page, shot) => {
  const P = (process.env.TABLET ? 'tab-' : process.env.DESKTOP ? 'desk-' : 'tel-') + (process.env.DARK ? 'sombre-' : '');
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  if (process.env.DARK) { await ev(() => localStorage.setItem('gg-theme', 'dark')); await page.reload(); await page.waitForTimeout(2500); }
  console.log('NAV', await ev(() => NAV.some((n) => n[0] === 'avisClients')), 'LECON', await ev(() => !!PC_LECONS.avisClients));
  await ev(() => go('avisClients')); await page.waitForTimeout(1600);
  await shot(P + 'avc-app-1-a-traiter');
  console.log('CARDS', await ev(() => document.querySelectorAll('.vc-card').length), 'TODO', await ev(() => document.querySelectorAll('.vc-card.todo').length));
  await page.$eval('[data-act=vcReply]', (e) => e.click()); await page.waitForTimeout(900);
  await shot(P + 'avc-app-2-repondre');
  await page.$eval('[data-act=vcSend]', (e) => e.click()); await page.waitForTimeout(900);
  console.log('AFTER REPLY TODO', await ev(() => document.querySelectorAll('.vc-card.todo').length));
  await ev(() => ACT.vcTab(null, null, 'all')); await page.waitForTimeout(800);
  await shot(P + 'avc-app-3-tous');
  await page.$eval('[data-act=vcQr]', (e) => e.click()); await page.waitForTimeout(900);
  await shot(P + 'avc-app-4-qr');
  await ev(() => closeSheet()); await page.waitForTimeout(400);
  await ev(() => go('dashboard')); await page.waitForTimeout(1200);
  console.log('DASH TILE', await ev(() => { const t = document.querySelector('.fdb-avis'); return t && t.dataset.go; }));
  await ev(() => go('alertes')); await page.waitForTimeout(600);
  if (!process.env.DESKTOP && !process.env.TABLET && !process.env.DARK) {
    const base = page.url().replace(/\/[^/]*$/, '/').replace(/\?.*$/, '');
    await page.goto(base + 'commande/?r=demo&t=4'); await page.waitForTimeout(1500);
    await shot('qr-0');
  }
};

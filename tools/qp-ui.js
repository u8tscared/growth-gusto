// node tools/run.js tools/qp-ui.js (DESKTOP=1 / TABLET=1, DARK=1): demo → Commandes en ligne › Réglages (paiement à table) → rail « À régler » → écran cuisine → salle → Réglé.
module.exports = async (page, shot) => {
  const P = process.env.TABLET ? 'tab-' : process.env.DESKTOP ? 'desk-' : 'tel-';
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  if (process.env.DARK) { await ev(() => localStorage.setItem('gg-theme', 'dark')); await page.reload(); await page.waitForTimeout(2500); }
  await ev(() => { go('commandes'); }); await page.waitForTimeout(1200);
  await ev(() => ACT.cmTab(null, null, 'cfg')); await page.waitForTimeout(900);
  await ev(() => { const e = document.querySelector('.cm-tpay'); if (e) e.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(500);
  await shot(P + 'qp-1-reglage');
  await page.$eval('[data-act=cmTablePay][data-v=apres]', (e) => e.click()); await page.waitForTimeout(700);
  console.log('TPAY', await ev(() => cmTablePay()), await ev(() => cmPubDoc().cfg.tablePay));
  await ev(() => ACT.cmTab(null, null, 'live')); await page.waitForTimeout(900);
  await shot(P + 'qp-2-rail');
  console.log('RAIL DUE', await ev(() => document.querySelectorAll('.cm-o .cm-due').length));
  await ev(() => go('cuisine')); await page.waitForTimeout(1400);
  await shot(P + 'qp-3-cuisine');
  console.log('CUISINE DUE', await ev(() => document.querySelectorAll('.sl-kcard .cm-due').length));
  await ev(() => go('salle')); await page.waitForTimeout(1400);
  await shot(P + 'qp-4-salle');
  console.log('SALLE DUE', await ev(() => document.querySelectorAll('.sl-due-l .cm-due').length));
  await page.$eval('.sl-due-l [data-act=cmSettle]', (e) => e.click()); await page.waitForTimeout(1200);
  console.log('AFTER SETTLE', await ev(() => document.querySelectorAll('.sl-due-l .cm-due').length));
  await shot(P + 'qp-5-regle');
};

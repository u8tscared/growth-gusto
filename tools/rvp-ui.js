// node tools/run.js tools/rvp-ui.js (DESKTOP=1 / TABLET=1, DARK=1): démo → Réservations › Réglages › Avis : « Aussi après un paiement en ligne »,
// aperçus des deux e-mails d'avis (après le repas / après paiement), champ « Recevoir un e-mail de test » (en démo : rien n'est envoyé).
module.exports = async (page, shot) => {
  const P = (process.env.TABLET ? 'tab-' : process.env.DESKTOP ? 'desk-' : 'tel-') + (process.env.DARK ? 'sombre-' : '');
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  if (process.env.DARK) { await ev(() => localStorage.setItem('gg-theme', 'dark')); await page.reload(); await page.waitForTimeout(2500); }
  await ev(() => go('resa')); await page.waitForTimeout(1500);
  await ev(() => ACT.rsCfgOpen(null, null, 'a')); await page.waitForTimeout(900);
  const ok = await ev(() => ({ pay: !!document.querySelector('[data-act=rsCeRevPay]'), prevs: document.querySelectorAll('.rs-revmls [data-act=rsMailPrev]').length, to: !!document.querySelector('#rsRevTo'), btn: !!document.querySelector('[data-act=rsRevTest]') }));
  console.log('CARD', JSON.stringify(ok));
  await ev(() => { const t = document.querySelector('.rs-revtest'); if (t) t.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(400);
  await shot(P + 'rvp-1-reglages');
  await page.fill('#rsRevTo', 'test@exemple.fr');
  await page.$eval('[data-act=rsRevTk][data-v=paye]', (e) => e.click()); await page.waitForTimeout(400);
  console.log('KEEP', await ev(() => document.querySelector('#rsRevTo').value), await ev(() => R.revTk));
  await page.$eval('[data-act=rsRevTest]', (e) => e.click()); await page.waitForTimeout(700);
  console.log('DEMO TOAST', await ev(() => (document.querySelector('.toast, #toast') || {}).textContent || ''));
  await page.$eval('[data-act=rsCeRevPay]', (e) => e.click()); await page.waitForTimeout(300);
  console.log('PAY OFF', await ev(() => R.ce.reviewPay === false));
  await page.$eval('[data-act=rsCeRevPay]', (e) => e.click()); await page.waitForTimeout(300);
  await page.$eval('.rs-revmls [data-act=rsMailPrev][data-v=paye]', (e) => e.click()); await page.waitForTimeout(1200);
  const pv = await ev(() => { const f = document.querySelector('.rs-mpf'); return { subj: (document.querySelector('.rs-mpo b') || {}).textContent, html: f && /Merci de votre visite/.test(f.srcdoc) && /Un petit avis/.test(f.srcdoc) }; });
  console.log('PREVIEW', JSON.stringify(pv));
  await shot(P + 'rvp-2-apercu-paiement');
  if (!pv.html || !ok.pay || ok.prevs !== 2 || !ok.to || !ok.btn) console.log('SCRIPT ERROR rvp');
};

// node tools/run.js tools/cd-ui.js (DESKTOP=1 / TABLET=1, DARK=1): demo → Commandes en ligne → toucher une commande → détail (chronologie, articles, client, paiement, notes) → Lancer → le détail suit → Terminées → détail.
module.exports = async (page, shot) => {
  const P = (process.env.TABLET ? 'tab-' : process.env.DESKTOP ? 'desk-' : 'tel-') + (process.env.DARK ? 'dark-' : '');
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  if (process.env.DARK) { await ev(() => localStorage.setItem('gg-theme', 'dark')); await page.reload(); await page.waitForTimeout(2500); }
  await ev(() => { go('commandes'); }); await page.waitForTimeout(1500);
  await shot(P + 'cd-0-rail');
  /* a paid table order in preparation, with a note */
  await page.click('.cm-o[data-id=dm3] .cm-items'); await page.waitForTimeout(900);
  console.log('OPEN', await ev(() => !!document.querySelector('#sheet.open .cm-dt')), await ev(() => document.querySelectorAll('#sheet .cm-tl-r').length));
  console.log('TL', await ev(() => [...document.querySelectorAll('#sheet .cm-tl-r')].map((r) => r.className.replace('cm-tl-r ', '') + ':' + r.querySelector('b').textContent + '@' + r.querySelector('.cm-tl-at').textContent).join(' | ')));
  await shot(P + 'cd-1-detail');
  await ev(() => { const b = document.getElementById('sheetBody'); b.scrollTop = b.scrollHeight; }); await page.waitForTimeout(400);
  await shot(P + 'cd-2-detail-bas');
  /* the order moves on while the detail is open: it follows */
  await ev(() => DB.update('clientOrders', 'dm3', { status: 'prete', readyAt: Date.now(), readyBy: S.me.id, by: S.me.id })); await page.waitForTimeout(900);
  console.log('FOLLOW', await ev(() => [...document.querySelectorAll('#sheet .cm-tl-r.ok b')].map((b) => b.textContent).join(', ')));
  await ev(() => closeSheet()); await page.waitForTimeout(500);
  /* takeaway, unpaid, with phone */
  await page.click('.cm-o[data-id=dm2] .cm-o-h'); await page.waitForTimeout(900);
  await shot(P + 'cd-3-emporter');
  console.log('TEL', await ev(() => !!document.querySelector('#sheet .cm-dt a[href^="tel:"]')));
  await ev(() => closeSheet()); await page.waitForTimeout(500);
  /* finished orders */
  await ev(() => ACT.cmDoneTog()); await page.waitForTimeout(700);
  await ev(() => document.querySelector('.cm-done').scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
  await shot(P + 'cd-4-terminees');
  await page.click('.cm-done button.cm-dr'); await page.waitForTimeout(900);
  await shot(P + 'cd-5-terminee-detail');
  console.log('DONE TL', await ev(() => document.querySelector('#sheet .cm-tl-sum') ? document.querySelector('#sheet .cm-tl-sum').textContent : 'no sum'));
};

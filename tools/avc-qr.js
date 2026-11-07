// node tools/run.js tools/avc-qr.js : menu QR démo, table 4 → commande → servie → « Comment c'était ? » → page d'avis
module.exports = async (page, shot) => {
  const base = page.url().replace(/\/[^/]*$/, '/');
  await page.goto(base + 'commande/?r=demo&t=4'); await page.waitForTimeout(1800);
  const c = async (s) => page.$eval(s, (e) => e.click());
  if (await page.$('[data-a="pickTable"]')) { await c('[data-a="pickTable"]'); await page.waitForTimeout(600); }
  await c('[data-a="inc"]'); await page.waitForTimeout(400);
  await c('[data-a="cart"]'); await page.waitForTimeout(700);
  await c('[data-a="send"]'); await page.waitForTimeout(32000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1200);
  await shot('avc-qr-1-servie');
  const href = await page.$eval('.qm-av-s a:nth-child(5)', (e) => e.getAttribute('href'));
  console.log('HREF', href);
  await c('.qm-av-s a:nth-child(5)'); await page.waitForTimeout(1500);
  await shot('avc-qr-2-page');
  console.log('PICKED', await page.$$eval('.av-st.on', (l) => l.length));
};

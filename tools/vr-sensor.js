// node tools/run.js tools/vr-sensor.js avec UA=iPad/iPhone : le bon capteur est proposé selon l'appareil, et on peut corriger.
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500); await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({ t: vrKind().t, dev: vrKind().dev, w: screen.width, h: screen.height }));
  console.log('CAPTEUR', JSON.stringify(r), 'attendu', process.env.EXPECT);
  if (process.env.EXPECT && r.t !== process.env.EXPECT) throw new Error('mauvais capteur : ' + r.t);
  await page.evaluate(() => go('verrou')); await page.waitForTimeout(900); await shot('vs-1');
  const other = r.t === 'Face ID' ? 'face' : 'touch';
  await page.$eval(`[data-act=vrSensor][data-v=${other === 'face' ? 'touch' : 'face'}]`, (e) => e.click()); await page.waitForTimeout(700);
  const t2 = await page.evaluate(() => vrKind().t); if (t2 === r.t) throw new Error('correction sans effet');
  await shot('vs-2');
};

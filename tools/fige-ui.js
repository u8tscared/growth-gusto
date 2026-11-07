// node tools/run.js tools/fige-ui.js (TABLET=1 too): l'écran reste figé sous le doigt (js/core.js FIGE, Marceau 2026-11-07).
// Vrais gestes tactiles (CDP) : glisser sur une fenêtre « Préparer un événement », sur un écran qui tient sans défiler, et
// vers le haut d'une liste déjà en haut → rien ne bouge ; une liste longue défile toujours. Prints FIGE OK / FIGE KO.
module.exports = async (page, shot) => {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); };
  const cdp = await page.context().newCDPSession(page);
  const drag = async (x, y0, y1, steps = 8) => {
    await page.evaluate(() => { window.__fp = []; if (!window.__fl) { window.__fl = 1; window.addEventListener('touchmove', (e) => window.__fp.push(e.defaultPrevented), { passive: true }); } });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(450);
    return page.evaluate(() => window.__fp.slice());
  };
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => go('evenement')); await page.waitForTimeout(1200);
  /* 1) the « new event » sheet: pull its form down, then up: the sheet never moves */
  await ev(() => ACT.evEditNew()); await page.waitForTimeout(800);
  const r = await ev(() => { const b = document.querySelector('#sheetBody .ev-2').getBoundingClientRect(); return { x: b.left + 20, y: b.top + 10, top: document.getElementById('sheet').getBoundingClientRect().top }; });
  let p = await drag(r.x, r.y, r.y + 220);
  let s1 = await ev(() => ({ top: document.getElementById('sheet').getBoundingClientRect().top, open: document.getElementById('sheet').classList.contains('open'), st: document.getElementById('sheetBody').scrollTop }));
  console.log('SHEET DOWN', JSON.stringify(s1), JSON.stringify(p)); ok(s1.open && Math.abs(s1.top - r.top) < 2 && s1.st === 0 && p.includes(true), 'la fenêtre suit le doigt vers le bas');
  /* up: the form scrolls if it is longer than the sheet, the sheet itself stays put */
  p = await drag(r.x, r.y + 200, r.y - 100);
  s1 = await ev(() => ({ top: document.getElementById('sheet').getBoundingClientRect().top, tr: document.getElementById('sheet').style.transform }));
  console.log('SHEET UP', JSON.stringify(s1)); ok(Math.abs(s1.top - r.top) < 2 && !s1.tr, 'la fenêtre suit le doigt vers le haut');
  await shot('fige-1-fenetre');
  /* the grab handle still closes it */
  const g = await ev(() => { const b = document.querySelector('#sheet .grab').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  if (g.x) { await drag(g.x, g.y, g.y + 400, 10); const o = await ev(() => document.getElementById('sheet').classList.contains('open')); console.log('GRAB CLOSES', !o); if (!(await ev(() => matchMedia('(min-width:960px)').matches))) ok(!o, 'la poignée ne ferme plus la fenêtre'); }
  await ev(() => closeSheet(true)); await page.waitForTimeout(400);
  /* 2) a screen at its top: pulling down does nothing (no rubber band) */
  await ev(() => { const v = document.querySelector('#viewport .view:not(.leave)'); v.scrollTop = 0; });
  p = await drag(200, 300, 520);
  console.log('VIEW TOP PULL', JSON.stringify(p)); ok(p.length && p.every(Boolean), 'écran tiré vers le bas en haut de page');
  /* 3) a long screen still scrolls */
  await ev(() => go('evenement', { id: 'ev-salon' })); await page.waitForTimeout(1200);
  const h = await ev(() => { const v = document.querySelector('#viewport .view:not(.leave)'); return v.scrollHeight - v.clientHeight; });
  p = await drag(200, 700, 300);
  const st = await ev(() => document.querySelector('#viewport .view:not(.leave)').scrollTop);
  console.log('VIEW SCROLL', h, st, JSON.stringify(p)); ok(h <= 0 || (!p.some(Boolean)), 'une longue page ne défile plus');
  console.log(bad.length ? 'FIGE KO ' + JSON.stringify(bad) : 'FIGE OK');
};

// Coupure réseau côté client (js/reseau-client.js). Usage : node tools/run.js tools/rc-ui.js  (DESKTOP=1 / TABLET=1, DARK=1)
// 1) démo commande/ : « Simuler une coupure », envoi pendant la coupure → « Petit souci de réseau » → « Nous renvoyons… » → « C'est reparti ! »
// 2) vrai chemin (Firebase simulé, réseau du navigateur vraiment coupé) : la commande part UNE fois, avec le même rq à chaque essai
// 3) réservation : même message pendant la coupure.
module.exports = async (page, shot, ctx) => {
  const base = page.url().replace(/\/$/, '');
  const dark = !!process.env.DARK; if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const sfx = (process.env.DESKTOP ? 'ordi' : process.env.TABLET ? 'tablette' : 'tel') + (dark ? '-sombre' : '');
  const wait = (ms) => page.waitForTimeout(ms);
  const cardState = () => page.evaluate(() => { const c = document.querySelector('.ggr'); return c && !c.hidden && c.classList.contains('on') ? (c.className.match(/is-(\w+)/) || [])[1] + ' | ' + c.querySelector('.ggr-h').textContent : 'none'; });

  /* 1) demo */
  await page.goto(base + '/commande/?r=demo&t=12'); await wait(900);
  await page.click('.qm-it [data-a="inc"]'); await wait(200); await page.click('[data-a="cart"]'); await wait(600);
  const pay = await page.$('[data-a="pay"][data-v="place"]'); if (pay) { await pay.click(); await wait(300); }
  await page.evaluate(() => GGR.fake(7000));
  await wait(400); console.log('idle cut:', await cardState());
  await page.click('[data-a="send"]'); await wait(1500);
  console.log('during:', await cardState()); await shot('rc-1-coupure-' + sfx);
  await page.waitForFunction(() => document.querySelector('.ggr.is-retry'), null, { timeout: 15000 }); console.log('retry:', await cardState()); await shot('rc-2-renvoi-' + sfx);
  await page.waitForFunction(() => document.querySelector('.ggr.is-ok'), null, { timeout: 15000 }); await wait(300); console.log('ok:', await cardState()); await shot('rc-3-reparti-' + sfx);
  await wait(1200); console.log('order view:', await page.evaluate(() => !!document.querySelector('.qm-order')));

  /* 2) real path with a fake Firebase: the browser goes really offline, the callable fails like the SDK does, the same rq comes back */
  if (!process.env.DESKTOP && !process.env.TABLET && !dark) {
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => {
      window.__calls = []; const orders = {};
      const menu = { name: 'Test', cfg: { on: true, table: true, takeaway: false, payPlace: true, tables: 20 }, cats: [{ id: 'p', t: 'Plats' }], items: [{ id: 'a', t: 'Plat', p: 10, c: 'p', al: [] }] };
      window.firebase = { apps: [1], initializeApp() {}, app: () => ({ functions: () => ({ httpsCallable: () => async (d) => {
        window.__calls.push(d.rq || ''); const off = !navigator.onLine || window.__down;
        if (off) { await new Promise((r) => setTimeout(r, 200)); const e = new Error('internal'); e.code = 'functions/internal'; throw e; }
        if (d.op === 'create') { if (window.__lose) { window.__lose = false; orders[d.rq] = orders[d.rq] || { oid: 'o' + Object.keys(orders).length }; await new Promise((r) => setTimeout(r, 400)); const e = new Error('internal'); e.code = 'functions/internal'; window.__down = true; throw e; }
          orders[d.rq] = orders[d.rq] || { oid: 'o' + Object.keys(orders).length }; window.__orders = Object.keys(orders).length;
          return { data: { oid: orders[d.rq].oid, k: 'f'.repeat(32), order: { id: orders[d.rq].oid, n: 7, mode: 'table', table: '4', items: [{ name: 'Plat', price: 10, q: 1 }], total: 10, pay: 'place', status: 'nouvelle', at: Date.now() } } }; }
        return { data: { order: { id: 'o0', n: 7, mode: 'table', table: '4', items: [{ name: 'Plat', price: 10, q: 1 }], total: 10, pay: 'place', status: 'nouvelle', at: Date.now() } } };
      } }) }), firestore: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => JSON.parse(JSON.stringify(menu)) }) }) }) };
      window.firebase.functions = true; window.firebase.firestore.FieldValue = {};
      window.GG_FIREBASE = { projectId: 'x' };
    });
    await p2.goto(base + '/commande/?r=testresto&t=4'); await p2.waitForTimeout(800);
    await p2.click('.qm-it [data-a="inc"]'); await p2.click('[data-a="cart"]'); await p2.waitForTimeout(500);
    /* the order reaches the server, the answer is lost, then the network drops */
    await p2.evaluate(() => { window.__lose = true; });
    await p2.click('[data-a="send"]'); await p2.waitForTimeout(100); await ctx.setOffline(true); await p2.waitForTimeout(2500);
    const st1 = await p2.evaluate(() => document.querySelector('.ggr').className); console.log('real offline card:', st1);
    await p2.evaluate(() => { window.__down = false; }); await ctx.setOffline(false); await p2.evaluate(() => window.dispatchEvent(new Event('online')));
    await p2.waitForFunction(() => document.querySelector('.qm-order'), null, { timeout: 20000 });
    const r = await p2.evaluate(() => ({ orders: window.__orders, rqs: [...new Set(window.__calls.filter(Boolean))], tries: window.__calls.length }));
    console.log('real path:', JSON.stringify(r), r.orders === 1 && r.rqs.length === 1 ? 'ONE ORDER OK' : 'DOUBLE ORDER !');
    await p2.close();
  }

  /* 3) booking */
  await page.goto(base + '/reserver/?r=demo'); await wait(900);
  const t = await page.$('[data-a="time"]:not([disabled])'); if (t) { await t.click(); await wait(300); }
  await page.fill('#fName', 'Camille Martin').catch(() => {}); await page.fill('#fPhone', '06 12 34 56 78').catch(() => {}); await wait(200);
  await page.evaluate(() => GGR.fake(6000)); await wait(200);
  const sb = await page.$('[data-a="send"]'); if (sb) await sb.click(); await wait(1500);
  console.log('resa during:', await cardState()); await shot('rc-4-reservation-' + sfx);
  await page.waitForFunction(() => document.querySelector('.ggr.is-ok'), null, { timeout: 20000 }); console.log('resa ok:', await cardState());
};

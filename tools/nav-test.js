// Chaque écran du menu de gauche (ordinateur) doit aussi être accessible sur téléphone et tablette, dans le menu « Plus ».
// Lancé par tools/ci.js (téléphone 390 px puis tablette 820 px) : échoue si un module n'existe que sur ordinateur.
// Les vues (js/espaces.js : En service, Mon espace, Pilotage) filtrent le même menu : on vérifie chaque vue de la gérante
// de la démo, puis les vues d'une serveuse et d'un commis (« Voir comme »).
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const check = (label) => page.evaluate((label) => new Promise((res) => {
    go('more');
    setTimeout(() => {
      const plus = new Set([...document.querySelectorAll('.cc-gt')].map((b) => b.dataset.go));
      const tabs = new Set([...document.querySelectorAll('#tabbar [data-tab]')].map((b) => b.dataset.tab));
      const nav = (typeof esNavRoutes === 'function' ? esNavRoutes() : NAV.filter((n) => n[0] !== 'sep' && VIEWS[n[0]] && canSee(n[0])).map((n) => n[0])).filter((r) => r !== 'home');
      res({ label, sp: typeof esCur === 'function' ? esCur() : '', mode: DB.mode, missing: nav.filter((x) => !plus.has(x) && !tabs.has(x)) });
    }, 900);
  }), label);
  const out = [];
  out.push(await check('gérante'));
  await shot('nav-plus');
  const spaces = await page.evaluate(() => (typeof esAllowed === 'function' ? esAllowed() : []));
  for (const sp of spaces) { await page.evaluate((sp) => { ES.sp = sp; renderChrome(); }, sp); out.push(await check('gérante · ' + sp)); }
  for (const who of ['demo-sarah', 'demo-lucas']) {
    const sps = await page.evaluate((who) => { if (typeof esDemoBecome !== 'function') return []; esDemoBecome(who); return esAllowed(); }, who);
    for (const sp of sps) { await page.evaluate((sp) => { ES.sp = sp; const tb = document.querySelector('#tabbar'); if (tb) delete tb.dataset.built; renderChrome(); }, sp); out.push(await check(who + ' · ' + sp)); }
  }
  /* appareils du restaurant : verrouillés sur leur mode (écran cuisine et pointeuse en grand écran, sans menu) */
  const dev = await page.evaluate(() => new Promise((res) => {
    if (typeof ES_ST === 'undefined') return res([]);
    const g = (S.members.find((m) => m.role === 'gerant') || {}).id; const out = [];
    const ks = Object.keys(ES_ST); let i = 0;
    const next = () => {
      if (i >= ks.length) { esDemoBecome(g); S.history = []; go('home', {}, { replace: true }); renderChrome(); return res(out); }
      const k = ks[i++]; esDemoBecome(g, k); S.history = []; go('home', {}, { replace: true }); renderChrome();
      setTimeout(() => { go('finance'); setTimeout(() => { const h = document.documentElement; out.push({ k, route: S.route, big: h.classList.contains('gg-big'), side: getComputedStyle(document.querySelector('#side')).display, nav: esNavRoutes() }); next(); }, 400); }, 500);
    };
    next();
  }));
  const devBad = dev.filter((d) => d.route === 'finance' || d.nav.includes('finance') || d.nav.includes('reglages') || ((d.k === 'cuisine' || d.k === 'pointeuse') && (!d.big || d.side !== 'none' || d.route !== d.k)));
  if (devBad.length) throw new Error('appareil du restaurant pas verrouillé : ' + JSON.stringify(devBad));
  if (out[0].mode !== 'demo') throw new Error('démo non ouverte');
  const bad = out.filter((r) => r.missing.length);
  if (bad.length) throw new Error('absent du menu Plus sur téléphone/tablette : ' + bad.map((r) => `${r.label} (${r.sp}) → ${r.missing.join(', ')}`).join(' ; '));
  console.log('NAV OK : tous les écrans sont dans le menu Plus (' + out.map((r) => r.label).join(', ') + ')');
};

// Chaque écran du menu de gauche (ordinateur) doit aussi être accessible sur téléphone et tablette, dans le menu « Plus ».
// Lancé par tools/ci.js (téléphone 390 px puis tablette 820 px) : échoue si un module n'existe que sur ordinateur.
module.exports = async (page, shot) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => new Promise((res) => {
    go('more');
    setTimeout(() => {
      const plus = new Set([...document.querySelectorAll('.cc-gt')].map((b) => b.dataset.go));
      const tabs = new Set([...document.querySelectorAll('#tabbar [data-tab]')].map((b) => b.dataset.tab));
      const nav = NAV.filter((n) => n[0] !== 'sep' && VIEWS[n[0]] && canSee(n[0])).map((n) => n[0]);
      res({ mode: DB.mode, missing: nav.filter((x) => !plus.has(x) && !tabs.has(x)) });
    }, 900);
  }));
  await shot('nav-plus');
  if (r.mode !== 'demo') throw new Error('démo non ouverte');
  if (r.missing.length) throw new Error('absent du menu Plus sur téléphone/tablette : ' + r.missing.join(', '));
  console.log('NAV OK : tous les écrans sont dans le menu Plus');
};

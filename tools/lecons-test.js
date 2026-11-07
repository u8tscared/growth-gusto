// Chaque écran du menu de l'app (NAV : core.js + chaque module qui s'y ajoute) doit avoir sa leçon de « Prise en main »
// (js/lecons.js, ou PC_LECONS.<route> = {…} dans le fichier du module). Lancé par tools/ci.js : un nouveau module sans sa
// leçon bloque la mise en ligne. On vérifie aussi la forme de chaque leçon (titre, phrase, 2 à 4 gestes, une question dont la
// bonne réponse existe, une scène connue, des icônes qui existent), et que le parcours de chaque personne de la démo se calcule.
module.exports = async (page) => {
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click());
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const bad = [];
    if (typeof PC_LECONS !== 'object') return { bad: ['js/lecons.js absent (PC_LECONS)'] };
    const routes = NAV.filter((n) => n[0] !== 'sep').map((n) => n[0]);
    const missing = routes.filter((r) => !PC_LECONS[r] && !(r in PC_SANS_LECON));
    const check = (k, L) => {
      const w = (m) => bad.push(`leçon « ${k} » : ${m}`);
      if (!L || typeof L !== 'object') return w('vide');
      if (!L.t || typeof L.t !== 'string') w('titre (t) manquant');
      if (!L.d || L.d.length < 20) w('phrase (d) manquante ou trop courte');
      if (!Array.isArray(L.steps) || L.steps.length < 2 || L.steps.length > 4 || L.steps.some((s) => !s || typeof s !== 'string')) w('2 à 4 gestes (steps) attendus');
      if (!Array.isArray(L.q) || typeof L.q[0] !== 'string' || !Array.isArray(L.q[1]) || L.q[1].length < 2 || !(L.q[2] >= 0 && L.q[2] < L.q[1].length)) w('question (q) mal formée : ["question ?", ["réponse", …], index de la bonne]');
      if (!L.sc || !PC_SCENES.includes(L.sc.k)) w('scène (sc.k) inconnue : ' + (L.sc && L.sc.k) + ' (au choix : ' + PC_SCENES.join(', ') + ')');
      ((L.sc && L.sc.rows) || []).forEach((row) => { if (L.sc.k !== 'check' && row[0] && !IC[row[0]]) w('icône inconnue dans la scène : ' + row[0]); });
      if (typeof L.who === 'string') L.who = [L.who];
      if (L.who && (!Array.isArray(L.who) || L.who.some((x) => !['cuisine', 'salle', 'bar', 'plonge', 'boss'].includes(x)))) w('who : cuisine, salle, bar, plonge ou boss');
    };
    Object.entries(PC_LECONS).forEach(([k, L]) => check(k, L));
    Object.entries(PC_META).forEach(([k, L]) => check(k, L));
    const plans = {};
    (S.members || []).forEach((m) => { try { const p = pcPlan(m.id); if (!p.length) bad.push('parcours vide pour ' + m.name); p.forEach((k) => { if (!(k[0] === '@' ? PC_META[k] : PC_LECONS[k])) bad.push(`parcours de ${m.name} : leçon ${k} introuvable`); }); plans[m.name] = p.length; } catch (e) { bad.push('parcours de ' + m.name + ' : ' + e.message); } });
    return { bad, missing, n: routes.length, plans };
  });
  if (r.missing && r.missing.length) throw new Error(`écran du menu sans leçon de prise en main : ${r.missing.join(', ')}. Ajoutez PC_LECONS.<route> = { t, d, steps, q, sc } dans le fichier du module (modèle en tête de js/lecons.js).`);
  if (r.bad.length) throw new Error('leçons mal formées :\n  ' + r.bad.join('\n  '));
  console.log(`LECONS OK : ${r.n} écrans du menu, tous avec leur leçon · parcours ${JSON.stringify(r.plans)}`);
};

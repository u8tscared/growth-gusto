// Demandes RH (js/demandes.js) en démo : délai minimum bloquant, circuit en 2 étapes (chef puis gérant), échange accepté par le
// collègue puis le gérant (le planning bouge), arrêt maladie avec justificatif (photo), services libérés / remis, refus avec un mot,
// réglages du gérant, repères dans le Planning et le Planning intelligent. Usage : node tools/run.js tools/dr-ui.js (DESKTOP=1 / TABLET=1)
module.exports = async (page, shot) => {
  const ok = (c, m) => { if (!c) throw new Error('KO : ' + m); console.log('ok · ' + m); };
  const tag = process.env.DESKTOP ? 'desk' : process.env.TABLET ? 'tab' : 'tel';
  const as = async (mid) => { await page.evaluate((mid) => { closeSheet(true); esDemoBecome(mid); }, mid); await page.waitForTimeout(150); };
  const goto = async (r) => { await page.evaluate((r) => go(r), r); await page.waitForTimeout(700); };
  const click = async (sel) => { await page.$eval(sel, (e) => e.click()); await page.waitForTimeout(350); };
  await page.waitForTimeout(1500);
  await page.$eval('[data-act=auDemo]', (e) => e.click()); await page.waitForTimeout(2500);

  // ── the gérant's inbox
  await goto('esDemandes');
  let n = await page.evaluate(() => ({ rows: document.querySelectorAll('.dr-row').length, pend: ES_REQS().filter((r) => r.status === 'attente').length, cfg: !!S.resto.drCfg }));
  ok(n.cfg && n.pend >= 3 && n.rows >= 3, 'demandes de l\'équipe : ' + JSON.stringify(n));
  await shot('dr-1-a-traiter-' + tag);
  await page.evaluate(() => { const r = ES_REQS().find((x) => x.name === 'Sarah Lemoine' && x.kind === 'conge' && x.status === 'attente'); ACT.drOpen(null, r.id); }); await page.waitForTimeout(600);
  ok(await page.$('.dr-path li.ok') && await page.$('.dr-path li.cur') && /Hors délai/.test(await page.textContent('#sheetBody')), 'détail : circuit chef ✓ puis gérant, hors délai signalé');
  await shot('dr-2-detail-' + tag);

  // ── refuse needs a word
  await page.evaluate(() => { const r = ES_REQS().find((x) => x.name === 'Sarah Lemoine' && x.kind === 'conge' && x.status === 'attente'); ACT.drDecide(null, r.id, 'refus'); }); await page.waitForTimeout(500);
  await click('[data-act=drDecGo]');
  ok(await page.evaluate(() => ES_REQS().find((x) => x.name === 'Sarah Lemoine' && x.kind === 'conge').status === 'attente'), 'refus sans motif : impossible');
  await page.fill('#drDecC', 'Trop de monde ce week-end-là'); await click('[data-act=drDecGo]'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => { const r = ES_REQS().find((x) => x.name === 'Sarah Lemoine' && x.kind === 'conge'); return r.status === 'refus' && r.answer === 'Trop de monde ce week-end-là' && r.hist.length === 3; }), 'refusé avec un mot, dans l\'historique');

  // ── employee: indispo 2 weeks ahead, strict
  await as('demo-sarah'); await goto('moiDemandes');
  ok(await page.$$eval('.dr-kgrid .es-rqk', (l) => l.length) === 5, '5 types de demande');
  await shot('dr-3-mes-demandes-' + tag);
  await page.evaluate(() => { ACT.esReqNew(null, addDays(dayKey(), 3), 'dispo'); }); await page.waitForTimeout(500);
  let s = await page.evaluate(() => ({ dis: document.querySelector('[data-act=drSend]').disabled, tx: document.querySelector('#drChk').textContent }));
  ok(s.dis && /2 sem/.test(s.tx), 'indispo à 3 jours : bloquée (2 semaines demandées) — ' + s.tx.slice(0, 90));
  await shot('dr-4-indispo-trop-tard-' + tag);
  await page.evaluate(() => { const i = document.querySelector('#drFrom'); i.value = addDays(dayKey(), 16); i.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(400);
  await click('[data-act=drSlotF][data-v=soir]'); await click('[data-act=drRepF]');
  s = await page.evaluate(() => ({ dis: document.querySelector('[data-act=drSend]').disabled, rep: DR.F.rep, slot: DR.F.slot }));
  ok(!s.dis && s.rep && s.slot === 'soir', 'à 16 jours, chaque semaine le soir : possible');
  await shot('dr-5-indispo-ok-' + tag);
  await click('[data-act=drSend]'); await page.waitForTimeout(500);
  const dispo = await page.evaluate(() => ES_REQS().find((x) => x.memberId === 'demo-sarah' && x.kind === 'dispo'));
  ok(dispo && dispo.status === 'attente' && dispo.rep === 'week' && dispo.steps.length === 1 && dispo.steps[0].who === 'gerant', 'indispo envoyée au gérant');
  ok(await page.evaluate((id) => { const r = ES_REQS().find((x) => x.id === id); return drCovers(r, addDays(r.from, 7), 'soir') && !drCovers(r, addDays(r.from, 7), 'midi') && !drCovers(r, addDays(r.from, 1)); }, dispo.id), 'répétition chaque semaine, le soir seulement');

  // ── leave in 2 steps: Lucas → a chef → the gérant
  await as('demo-lucas'); await goto('moiDemandes');
  await page.evaluate(() => { ACT.esReqNew(null, '', 'conge'); }); await page.waitForTimeout(400);
  await page.evaluate(() => { const a = document.querySelector('#drFrom'), b = document.querySelector('#drTo'); a.value = addDays(dayKey(), 45); b.value = addDays(dayKey(), 48); a.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(400);
  ok(/Un chef, puis/.test(await page.textContent('.dr-circ')), 'circuit affiché avant l\'envoi : ' + (await page.textContent('.dr-circ')));
  await page.fill('#drNote', 'Mariage'); await click('[data-act=drSend]'); await page.waitForTimeout(400);
  let lc = await page.evaluate(() => ES_REQS().find((x) => x.memberId === 'demo-lucas' && x.kind === 'conge' && x.status === 'attente'));
  ok(lc && lc.steps.length === 2 && lc.cur === 0, 'congé de Lucas : 2 étapes');
  await as('demo-thomas'); await goto('esDemandes');
  ok(await page.evaluate((id) => drCanAct(ES_REQS().find((x) => x.id === id)), lc.id), 'Thomas (chef) peut répondre à l\'étape 1');
  await page.evaluate((id) => ACT.drDecide(null, id, 'ok'), lc.id); await page.waitForTimeout(400); await click('[data-act=drDecGo]'); await page.waitForTimeout(400);
  lc = await page.evaluate((id) => ES_REQS().find((x) => x.id === id), lc.id);
  ok(lc.status === 'attente' && lc.cur === 1 && lc.steps[0].st === 'ok', 'étape 1 validée, passe au gérant');
  ok(await page.evaluate((id) => !drCanAct(ES_REQS().find((x) => x.id === id)), lc.id), 'Thomas ne valide pas l\'étape du gérant');
  await as('demo-camille'); await goto('esDemandes');
  await page.evaluate((id) => ACT.drDecide(null, id, 'ok'), lc.id); await page.waitForTimeout(400); await click('[data-act=drDecGo]'); await page.waitForTimeout(400);
  ok(await page.evaluate((id) => ES_REQS().find((x) => x.id === id).status === 'ok', lc.id), 'gérant : congé accepté');

  // ── swap: Inès accepts, then the gérant → shifts move
  const sw = await page.evaluate(() => ES_REQS().find((x) => x.kind === 'echange' && x.status === 'attente'));
  ok(sw && sw.peer.st === 'attente', 'échange de Lucas en attente d\'Inès');
  ok(await page.evaluate((id) => !drCanAct(ES_REQS().find((x) => x.id === id)), sw.id), 'le gérant attend l\'accord du collègue');
  await as('demo-ines'); await goto('moiDemandes');
  ok(await page.$('.dr-todol .dr-row.act'), 'Inès : « À vous de répondre »');
  await shot('dr-6-ines-a-repondre-' + tag);
  await page.evaluate((id) => ACT.drDecide(null, id, 'ok'), sw.id); await page.waitForTimeout(400);
  await shot('dr-7-accepter-echange-' + tag);
  await click('[data-act=drDecGo]'); await page.waitForTimeout(400);
  await as('demo-camille');
  await page.evaluate((id) => ACT.drDecide(null, id, 'ok'), sw.id); await page.waitForTimeout(400); await click('[data-act=drDecGo]'); await page.waitForTimeout(800);
  const moved = await page.evaluate((r) => { const a = S.shifts.find((x) => x.id === r.shift.id); const b = r.shift2 && S.shifts.find((x) => x.id === r.shift2.id); const x = ES_REQS().find((q) => q.id === r.id); return { a: a && a.staffId, b: b && b.staffId, st: x.status, swapped: x.swapped }; }, sw);
  ok(moved.st === 'ok' && moved.a === 's_demo-ines' && (!sw.shift2 || moved.b === 's_demo-lucas') && moved.swapped, 'échange validé : planning échangé ' + JSON.stringify(moved));

  // ── sick leave with a photo (employee), then the gérant frees and restores the shifts
  await as('demo-sarah'); await goto('moiDemandes');
  await page.evaluate(() => ACT.esReqNew(null, '', 'maladie')); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelector('[data-act=drSend]').disabled), 'arrêt sans justificatif : il faut la photo ou « plus tard »');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act=drDocAddF]:not([data-v])')]);
  await fc.setFiles({ name: 'arret.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(900);
  ok(await page.evaluate(() => DR.F.docs.length === 1 && !document.querySelector('[data-act=drSend]').disabled), 'photo ajoutée, envoi possible');
  await shot('dr-8-arret-photo-' + tag);
  await click('[data-act=drSend]'); await page.waitForTimeout(900);
  const ar = await page.evaluate(() => ES_REQS().find((x) => x.memberId === 'demo-sarah' && x.kind === 'maladie'));
  ok(ar && ar.status === 'ok' && ar.docs.length === 1, 'arrêt pris en compte tout de suite, justificatif joint');
  const dd = await page.evaluate((id) => DB.local[DB.path('rhDocs')][id], ar.docs[0].id);
  ok(dd && dd.uid === 'demo-sarah' && dd.readers.includes('demo-camille') && /^data:image\/jpeg/.test(dd.data), 'justificatif rangé à part, lisible par la personne et les gérants');
  await as('demo-camille'); await goto('esDemandes');
  await page.evaluate(() => ACT.drOpen(null, 'rq-hugo-arret')); await page.waitForTimeout(500);
  await shot('dr-9-arret-hugo-' + tag);
  const before = await page.evaluate(() => drShiftsOf(ES_REQS().find((x) => x.id === 'rq-hugo-arret')).length);
  ok(before > 0 && await page.$('[data-act=drFree]'), 'arrêt de Hugo : ' + before + ' services encore au planning');
  await page.click('[data-act=drDocView]'); await page.waitForTimeout(600);
  ok(await page.$('.dr-view .dr-img'), 'le gérant ouvre le justificatif');
  await shot('dr-10-justificatif-' + tag);
  await page.evaluate(() => ACT.drOpen(null, 'rq-hugo-arret')); await page.waitForTimeout(400);
  await click('[data-act=drFree]'); await page.waitForTimeout(600);
  let h = await page.evaluate(() => { const r = ES_REQS().find((x) => x.id === 'rq-hugo-arret'); return { left: drShiftsOf(r).length, freed: (r.freed || []).length }; });
  ok(h.left === 0 && h.freed === before, 'services libérés du planning');
  await page.evaluate(() => ACT.drOpen(null, 'rq-hugo-arret')); await page.waitForTimeout(400); await click('[data-act=drRestore]'); await page.waitForTimeout(600);
  h = await page.evaluate(() => { const r = ES_REQS().find((x) => x.id === 'rq-hugo-arret'); return drShiftsOf(r).length; });
  ok(h === before, 'services remis au planning');

  // ── planning marks + planif
  await goto('planning'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelectorAll('.dr-pm').length > 0 || !document.querySelector('.rh-plan')), 'Planning : absences visibles');
  await shot('dr-11-planning-' + tag);
  ok(await page.evaluate(() => { const p = rhPeople().find((x) => x.memberId === 'demo-hugo'); return !pfCanWork(p, dayKey(), 'midi') && pfCanWork(p, addDays(dayKey(), 4), 'soir') !== undefined; }), 'Planning intelligent : Hugo en arrêt n\'est pas proposé');

  // ── settings
  await page.evaluate(() => { DR.tab = 'cfg'; DR.open = 'dispo'; go('esDemandes'); }); await page.waitForTimeout(700);
  await shot('dr-12-reglages-' + tag);
  await click('[data-act=drCSet][data-id=dispo][data-v="notice|7"]');
  await click('[data-act=drCSet][data-id=dispo][data-v="strict|0"]');
  await page.selectOption('[data-act-change=drCStepAdd][data-id=dispo]', 'm:demo-thomas'); await page.waitForTimeout(400);
  await click('[data-act=drCSave]'); await page.waitForTimeout(600);
  const cf = await page.evaluate(() => S.resto.drCfg.k.dispo);
  ok(cf.notice === 7 && cf.strict === false && cf.steps.length === 2 && cf.steps[1].who === 'm:demo-thomas', 'réglages enregistrés : ' + JSON.stringify(cf));
  await page.evaluate(() => { DR.open = 'conge'; rerender(); }); await page.waitForTimeout(400); await shot('dr-13-reglages-conge-' + tag);
  // ── history + absences
  await page.evaluate(() => { DR.tab = 'hist'; rerender(); }); await page.waitForTimeout(500); await shot('dr-14-historique-' + tag);
  ok(await page.$('.dr-tot'), 'compteurs par personne');
  await page.evaluate(() => { DR.tab = 'cal'; rerender(); }); await page.waitForTimeout(500); await shot('dr-15-absences-' + tag);
  ok(await page.$('.dr-cal .dr-pm'), 'calendrier des absences');
  // ── manager enters a sick leave for someone
  await page.evaluate(() => { ACT.drForWho(); }); await page.waitForTimeout(400);
  await click('[data-act=drForPick][data-v=demo-lea]'); await page.waitForTimeout(300);
  await click('[data-act=drSend]'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => ES_REQS().some((x) => x.memberId === 'demo-lea' && x.by === 'demo-camille' && x.status === 'ok')), 'saisi pour Léa par le gérant');
  // ── employee home card + dark
  await as('demo-ines'); await page.evaluate(() => { ES.sp = 'moi'; go('home'); }); await page.waitForTimeout(900); await shot('dr-16-mon-espace-' + tag);
  await as('demo-camille'); await page.evaluate(() => { TH.pref = 'dark'; DR.tab = 'todo'; go('esDemandes'); }); await page.waitForTimeout(900); await shot('dr-17-sombre-' + tag);
};

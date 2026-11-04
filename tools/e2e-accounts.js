// Accounts end-to-end against the LIVE Firebase project (js/config.js): two phones (A gérant, B invitee) plus a third for « mot de passe oublié ».
// Usage: node tools/e2e-accounts.js            (phone 390×844)      DESKTOP=1 node tools/e2e-accounts.js
// Env: FBSDK=<dir with firebase-*-compat.js> serves the SDK locally when www.gstatic.com is unreachable (default /tmp/gg/fbsdk/package when it exists);
//      OUT=<screenshot dir> (default tools/out/accounts). Every account and restaurant it creates is deleted at the end (names « Bistrot Test <ts> »).
// Prints one « ok » per assertion and ERRORS: [] (page errors + console errors) at the end.
// static server of the repo + Playwright contexts (console errors collected per context)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve(__dirname, "..");
const OUT = process.env.OUT || path.join(__dirname, 'out', 'accounts'); fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; const f = path.join(ROOT, u); if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader('content-type', T[path.extname(f)] || 'application/octet-stream'); return r.end(fs.readFileSync(f)); } r.statusCode = 404; r.end(); });
    srv.listen(0, () => res({ srv, port: srv.address().port, url: 'http://localhost:' + srv.address().port + '/' }));
  });
}
async function newCtx(b, name, opts = {}) {
  const ctx = await b.newContext({ ...(process.env.DESKTOP ? { viewport: { width: 1366, height: 860 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), ...opts });
  const SDK = process.env.FBSDK || (fs.existsSync('/tmp/gg/fbsdk/package') ? '/tmp/gg/fbsdk/package' : ''); if (SDK) await ctx.route(/www\.gstatic\.com\/firebasejs\//, (rt) => { const f = rt.request().url().split('/').pop(); rt.fulfill({ path: path.join(SDK, f), contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (rt) => rt.fulfill({ body: '', contentType: 'text/css' }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(name + ' pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(name + ' console ' + m.text().slice(0, 300) + ' @ ' + ((m.location() || {}).url || '')); });
  page.shot = (n) => page.screenshot({ path: path.join(OUT, name + '-' + n + '.png') });
  page.errs = errs; page.ctxName = name;
  page.c = (s) => page.$eval(s, (e) => e.click());
  page.ev = (fn, ...a) => page.evaluate(fn, ...a);
  page.state = () => page.evaluate(() => ({ mode: DB.mode, uid: DB.uid, route: S.route, rid: S.rid, resto: S.resto && S.resto.name, restos: S.restos.map((r) => r.id), members: S.members.map((m) => ({ id: m.id, role: m.role, name: m.name })), role: myRole(), au: document.querySelector('#au.on') ? (AUTH.ui.screen + ':' + AUTH.ui.err) : null, dbErr: S.dbErr, sheet: document.querySelector('#sheet.open') ? document.querySelector('#sheetBody').innerText.slice(0, 160) : null, toast: (document.querySelector('#toastTx') || {}).textContent }));
  page.waitAu = (screen, ms = 15000) => page.waitForFunction((s) => typeof AUTH !== 'undefined' && AUTH.ui.screen === s && document.querySelector('#au.on'), screen, { timeout: ms });
  page.waitApp = (ms = 20000) => page.waitForFunction(() => typeof S !== 'undefined' && S.ready && S.resto && !document.querySelector('#au.on'), null, { timeout: ms });
  return { ctx, page };
}
async function signUp(page, name, email, pw) {
  await page.c('[data-act="auEmail"]'); await page.waitForTimeout(500);
  await page.ev(() => { if (AUTH.ui.tab !== 'up') ACT.auTab(null, null, 'up'); }); await page.waitForTimeout(400);
  await page.fill('#auName', name); await page.fill('#auEmail', email); await page.fill('#auPw', pw);
  await page.c('#auGo');
}
async function signIn(page, email, pw) {
  await page.c('[data-act="auEmail"]'); await page.waitForTimeout(500);
  await page.ev(() => { if (AUTH.ui.tab !== 'in') ACT.auTab(null, null, 'in'); }); await page.waitForTimeout(400);
  await page.fill('#auEmail', email); await page.fill('#auPw', pw);
  await page.c('#auGo');
}
/* the existing create screen (owned by another agent): fill the name and submit */
async function createResto(page, name) {
  await page.waitAu('setup'); await page.c('[data-act="auCreate"]'); await page.waitAu('create');
  await page.fill('#auRName', name); await page.waitForTimeout(200);
  await page.ev(() => AUTH.createSubmit());
  await page.waitApp(30000);
}
async function deleteUserRaw(page) { return page.evaluate(async () => { try { await firebase.auth().currentUser.delete(); return 'deleted'; } catch (e) { return e.code; } }); }
function assert(c, m) { if (!c) throw new Error('ASSERT ' + m); console.log('  ok  ' + m); }
const L = { serve, newCtx, signUp, signIn, createResto, deleteUserRaw, assert, chromium, OUT, ROOT };
(async () => {
  const { srv, url } = await L.serve(); const b = await L.chromium.launch(); const t = Date.now(); const pw = 'Cuisine-2026!';
  const emA = `gg-e2e-a-${t}@example.com`, emB = `gg-e2e-b-${t}@example.com`, RNAME = 'Bistrot Test ' + t;
  const A = await L.newCtx(b, 'A'), B = await L.newCtx(b, 'B'), D = await L.newCtx(b, 'D');
  const pa = A.page, pb = B.page, pd = D.page;
  const wait = (p, fn, ms = 20000, arg) => p.waitForFunction(fn, arg, { timeout: ms });
  const sheetText = (p) => p.ev(() => (document.querySelector('#sheet.open') ? document.querySelector('#sheetBody').innerText : ''));
  const countCols = (p, rid) => p.ev(async (rid) => { const fs = firebase.firestore(); const out = {}; for (const c of [...AUTH.COLS, 'members']) { const s = await fs.collection(`restos/${rid}/${c}`).get(); if (s.size) out[c] = s.size; } return out; }, rid);
  let rid;
  try {
    // ── 1. A: sign up, create the restaurant (existing create flow) ──
    await pa.goto(url); await pa.waitAu('welcome');
    await L.signUp(pa, 'Alice', emA, pw); await L.createResto(pa, RNAME);
    let st = await pa.state(); rid = st.rid; assert(st.mode === 'db' && st.resto === RNAME && st.role === 'gerant', 'A created ' + RNAME + ' as gérant (rid ' + rid + ')');
    await pa.shot('01-home');
    // ── 2. A: Réglages shows the e-mail; invite with role chef through the UI ──
    await pa.ev(() => go('reglages')); await pa.waitForTimeout(700); await pa.shot('02-reglages');
    const regTx = await pa.ev(() => document.querySelector('#viewport').innerText);
    assert(regTx.includes(emA), 'Réglages shows the account e-mail');
    assert(regTx.includes('Vider les données du restaurant') && regTx.includes('Supprimer le restaurant') && regTx.includes('Supprimer mon compte'), 'Réglages has the three reset rows (gérant + owner)');
    await pa.c('[data-act="auInvite"]'); await pa.waitForTimeout(600);
    await pa.c('[data-act="auInvRole"][data-v="chef"]'); await pa.c('[data-act="auInvCreate"]');
    await wait(pa, () => S.ui.auInv && S.ui.auInv.cur); const code = await pa.ev(() => S.ui.auInv.cur.code);
    assert(/^[A-Z0-9]{8}$/.test(code), 'invite created, code ' + code);
    const link = await pa.ev(() => AUTH.invLink(S.ui.auInv.cur.code)); assert(link.includes('?invite=' + code), 'invite link ' + link);
    assert(await pa.ev(() => !!document.querySelector('#sheetBody .au-qr svg')), 'QR code rendered');
    await pa.shot('03-invite'); await pa.ev(() => closeSheet(true));
    // ── 3. D (nobody signed in): wrong code, then « Mot de passe oublié » for A ──
    await pd.goto(url + '?invite=ZZZZZZZZ'); await pd.waitAu('welcome');
    assert((await pd.ev(() => document.querySelector('#auPane').innerText)).includes('Vous êtes invité'), 'welcome shows « Vous êtes invité » for a link');
    await pd.c('[data-act="auEmail"]'); await pd.waitForTimeout(500); await pd.c('[data-act="auForgot"]'); await pd.waitAu('reset');
    await pd.fill('#auREmail', emA); await pd.c('#auRGo'); await wait(pd, () => AUTH.ui.sent, 20000);
    assert((await pd.ev(() => document.querySelector('#auPane').innerText)).includes('Vérifiez vos e-mails'), 'password reset e-mail sent (sent screen)');
    await pd.shot('04-reset-sent');
    // ── 4. B: opens the invite link on a fresh phone, signs up → joins automatically as chef ──
    await pb.goto(url + '?invite=' + code); await pb.waitAu('welcome'); await pb.shot('05-welcome-invite');
    assert((await pb.ev(() => document.querySelector('#auPane').innerText)).includes('Vous êtes invité'), 'B welcome shows the invitation');
    await L.signUp(pb, 'Bob', emB, pw); await pb.waitApp(40000); await pb.shot('06-b-home');
    st = await pb.state(); assert(st.rid === rid && st.resto === RNAME && st.role === 'chef', 'B joined automatically as chef and sees ' + RNAME);
    await wait(pa, (uid) => S.members.some((m) => m.id === uid && m.role === 'chef'), 20000, st.uid); const uidB = st.uid;
    // ── 5. A: Équipe → B → change role to équipe ──
    await pa.ev(() => go('equipe')); await pa.waitForTimeout(700); await pa.shot('07-equipe');
    await pa.c(`[data-act="ccMember"][data-id="${uidB}"]`); await pa.waitForTimeout(500); await pa.shot('08-member-sheet');
    assert((await sheetText(pa)).includes('Modifier le rôle') && (await sheetText(pa)).includes("Retirer de l'équipe"), 'member sheet offers role change and removal');
    await pa.c('[data-act="ccMemberEdit"]'); await pa.waitForTimeout(400); await pa.c('[data-act="ccFormRole"][data-v="equipe"]'); await pa.c('[data-act="ccMemberSave"]');
    await wait(pb, () => myRole() === 'equipe', 20000); assert(true, 'B now sees role équipe');
    // ── 6. A removes B → B loses access cleanly ──
    await pa.waitForTimeout(600); await pa.c(`[data-act="ccMember"][data-id="${uidB}"]`); await pa.waitForTimeout(400); await pa.c('[data-act="ccMemberDel"]'); await pa.waitForTimeout(400); await pa.shot('09-remove-confirm'); await pa.c('[data-act="ccMemberDelOk"]');
    await wait(pa, (uid) => !S.members.some((m) => m.id === uid), 20000, uidB);
    await wait(pb, () => !S.restos.length && document.querySelector('#au.on') && AUTH.ui.screen === 'setup', 30000);
    await pb.waitForTimeout(900); await pb.shot('10-b-removed'); st = await pb.state(); assert(st.restos.length === 0 && st.au && st.au.startsWith('setup'), 'B after removal: no restaurant, « créer ou rejoindre » screen, no crash');
    await pb.waitForTimeout(16000); /* the pruning of users/{uid}.restos happens after the retries */
    const bList = await pb.ev(async () => (await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get()).data().restos);
    assert(Array.isArray(bList) && !bList.includes(rid), 'B users.restos pruned of the lost restaurant: ' + JSON.stringify(bList));
    // ── 7. expired invite error; then a signed-in user (B) opens a fresh link → joins ──
    await pa.ev(async (rid) => { await firebase.firestore().collection('invites').doc('EXPIRED1').set({ rid, restoName: 'x', role: 'equipe', createdBy: DB.uid, createdAt: Date.now() - 2e9, expiresAt: Date.now() - 1000, uses: 0 }); }, rid);
    await pb.ev(() => ACT.auJoinOpen()); await pb.waitAu('join'); await pb.fill('#auCode', 'EXPIRED1'); await wait(pb, () => AUTH.ui.join && AUTH.ui.join.err, 15000);
    const errExp = await pb.ev(() => AUTH.ui.join.err); assert(errExp.includes('expiré'), 'expired invite → ' + errExp); await pb.shot('11-expired');
    await pb.fill('#auCode', 'ZZZZZZZZ'); await wait(pb, () => AUTH.ui.join && /existe pas/.test(AUTH.ui.join.err), 15000); assert(true, 'unknown code → ' + (await pb.ev(() => AUTH.ui.join.err)));
    await pa.ev(() => firebase.firestore().collection('invites').doc('EXPIRED1').delete());
    const code2 = await pa.ev(async () => { AUTH.inviteSheet('equipe'); await AUTH.invCreate(); const c = S.ui.auInv.cur.code; closeSheet(true); return c; });
    await pb.goto(url + '?invite=' + code2); await pb.waitApp(40000); st = await pb.state(); assert(st.rid === rid && st.role === 'equipe', 'signed-in B opened the link and re-joined as équipe');
    await wait(pa, (uid) => S.members.some((m) => m.id === uid), 20000, uidB);
    // ── 8. B leaves from Réglages ──
    await pb.ev(() => go('reglages')); await pb.waitForTimeout(700);
    const regB = await pb.ev(() => document.querySelector('#viewport').innerText); assert(regB.includes("Quitter l'équipe") && !regB.includes('Supprimer le restaurant') && !regB.includes('Vider les données'), 'B (équipe) sees « Quitter » but no owner/gérant reset rows');
    await pb.shot('12-b-reglages'); await pb.c('[data-act="auLeave"]'); await pb.waitForTimeout(400); await pb.c('[data-act="auLeaveOk"]');
    await pb.waitForTimeout(1500); await wait(pb, () => typeof AUTH !== 'undefined' && document.querySelector('#au.on') && AUTH.ui.screen === 'setup', 40000); assert(true, 'B left: back to « créer ou rejoindre »');
    await wait(pa, (uid) => !S.members.some((m) => m.id === uid), 20000, uidB);
    const bList2 = await pb.ev(async () => (await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get()).data().restos); assert(!bList2.includes(rid), 'B users.restos no longer lists the restaurant');
    // ── 9. A: add a kitchen profile (Équipe → Ajouter), seed data, « Vider les données » ──
    await pa.ev(() => go('equipe')); await pa.waitForTimeout(600); await pa.c('[data-act="ccMemberNew"]'); await pa.waitForTimeout(400);
    await pa.fill('#ccfName', 'Hugo'); await pa.fill('#ccfPin', '2580'); await pa.c('[data-act="ccMemberSave"]');
    await wait(pa, () => S.members.some((m) => m.name === 'Hugo' && m.pinSha), 20000); assert(true, 'kitchen profile Hugo (with PIN) added in cloud mode'); await pa.shot('13-equipe-hugo');
    await pa.ev(async () => { for (let i = 0; i < 3; i++) await DB.add('readings', { fridgeId: S.fridges[0] && S.fridges[0].id, value: 3 + i, at: Date.now() + i, day: dayKey(), slot: 'midi', uid: DB.uid }); await DB.add('lots', { name: 'Sauce', createdAt: Date.now(), status: 'in' }); await DB.add('products', { name: 'Beurre' }); await DB.add('notes', { title: 'Recette' }); await DB.add('staff', { name: 'Hugo', role: 'Commis', active: true }); });
    await pa.waitForTimeout(2500); let cnt = await countCols(pa, rid); console.log('  before wipe', JSON.stringify(cnt)); assert(cnt.readings >= 3 && cnt.fridges >= 1 && cnt.members === 2, 'data seeded');
    await pa.ev(() => go('reglages')); await pa.waitForTimeout(600); await pa.c('[data-act="auWipe"]'); await pa.waitForTimeout(400); await pa.shot('14-wipe-confirm');
    assert(await pa.ev(() => document.querySelector('#auConfGo').disabled), 'wipe button disabled until EFFACER is typed');
    await pa.fill('#auConfIn', 'effacer'); await pa.waitForTimeout(100); await pa.c('#auConfGo');
    await wait(pa, () => !document.querySelector('#au.on') && (document.querySelector('#toastTx') || {}).textContent.includes('Données effacées'), 60000);
    cnt = await countCols(pa, rid); console.log('  after wipe', JSON.stringify(cnt)); assert(Object.keys(cnt).every((k) => k === 'members' || k === 'events') && cnt.members === 2 && (cnt.events || 0) <= 1, 'every subcollection emptied, team kept (events: only « a vidé »)');
    st = await pa.state(); assert(st.resto === RNAME && st.members.length === 2, 'restaurant and team still there'); await pa.shot('15-after-wipe');
    // ── 10. A: « Supprimer le restaurant » ──
    await pa.ev(() => go('reglages')); await pa.waitForTimeout(600); await pa.c('[data-act="auDelResto"]'); await pa.waitForTimeout(400); await pa.fill('#auConfIn', 'EFFACER'); await pa.shot('16-delresto-confirm'); await pa.c('#auConfGo');
    await pa.waitForTimeout(1500); await wait(pa, () => typeof AUTH !== 'undefined' && document.querySelector('#au.on') && AUTH.ui.screen === 'setup', 60000);
    await wait(pa, () => (document.querySelector('#toastTx') || {}).textContent.includes('supprimé'), 8000); /* the flash toast lands 900 ms after the reload */
    await pa.shot('17-after-delresto'); st = await pa.state(); assert(st.restos.length === 0 && st.toast.includes('supprimé'), 'A after restaurant deletion: no restaurant, toast « ' + st.toast + ' »');
    const gone = await pa.ev(async (rid) => { try { const s = await firebase.firestore().collection('restos').doc(rid).get(); return s.exists ? 'exists' : 'missing'; } catch (e) { return e.code; } }, rid);
    assert(gone === 'missing' || gone === 'permission-denied', 'restos/' + rid + ' is gone (' + gone + ')');
    const orphan = await pa.ev(async (rid) => { try { const s = await firebase.firestore().collection(`restos/${rid}/members`).get(); return s.size; } catch (e) { return e.code; } }, rid); console.log('  members left under the deleted resto:', orphan);
    // ── 11. A deletes the account (Réglages → Compte); then B ──
    await pa.c('#au.on [data-act="auDelAccount"]'); await pa.waitAu('delAccount'); await pa.waitForTimeout(700); await pa.shot('18-delaccount-confirm');
    assert(await pa.ev(() => document.querySelector('#auConfGo').disabled), 'delete-account button disabled until EFFACER');
    await pa.fill('#auConfIn', 'EFFACER'); await pa.c('#auConfGo');
    await pa.waitForTimeout(2000); await wait(pa, () => typeof AUTH !== 'undefined' && document.querySelector('#au.on') && AUTH.ui.screen === 'welcome' && !document.querySelector('.au-busyp'), 60000);
    await pa.waitForTimeout(1200); await pa.shot('19-a-deleted'); st = await pa.ev(() => ({ user: !!(window.firebase && firebase.apps.length && firebase.auth().currentUser), toast: document.querySelector('#toastTx').textContent, mode: localStorage.getItem('gg-mode') }));
    assert(!st.user && st.mode === 'out', 'A account deleted → welcome screen, signed out (toast « ' + st.toast + ' »)');
    await L.signIn(pa, emA, pw); await wait(pa, () => AUTH.ui.err, 20000); const errA = await pa.ev(() => AUTH.ui.err); assert(/incorrect/.test(errA), 'signing in as deleted A fails: ' + errA);
    await pb.c('#au.on [data-act="auDelAccount"]'); await pb.waitAu('delAccount'); await pb.fill('#auConfIn', 'EFFACER'); await pb.c('#auConfGo');
    await pb.waitForTimeout(2000); await wait(pb, () => typeof AUTH !== 'undefined' && document.querySelector('#au.on') && AUTH.ui.screen === 'welcome' && !document.querySelector('.au-busyp'), 60000);
    assert(!(await pb.ev(() => window.firebase && firebase.apps.length && firebase.auth().currentUser)) && (await pb.ev(() => localStorage.getItem('gg-mode'))) === 'out', 'B account deleted → welcome, signed out');
    await L.signIn(pb, emB, pw); await wait(pb, () => AUTH.ui.err, 20000); assert(/incorrect/.test(await pb.ev(() => AUTH.ui.err)), 'signing in as deleted B fails');
  } catch (e) { console.log('SCRIPT', e.stack); await pa.shot('err'); await pb.shot('err'); console.log('A', await pa.state().catch(() => '-')); console.log('B', await pb.state().catch(() => '-')); }
  // safety net cleanup (if the scenario broke before the deletions)
  for (const P of [pb, pa]) { const r = await P.ev(async () => { try { if (!window.firebase || !firebase.apps.length) return 'no sdk'; const u = firebase.auth().currentUser; if (!u) return 'no user'; const fs = firebase.firestore(); const s = await fs.collection('users').doc(u.uid).get(); for (const rid of (s.exists && s.data().restos) || []) { let r = null; try { r = await fs.doc('restos/' + rid).get(); } catch (e) { continue; } if (r.exists && r.data().owner === u.uid) await AUTH.deleteRestoDocs(rid); else await fs.doc(`restos/${rid}/members/${u.uid}`).delete().catch(() => {}); } await fs.doc('users/' + u.uid).delete().catch(() => {}); await u.delete(); return 'cleaned'; } catch (e) { return 'ERR ' + (e.code || e.message); } }).catch((e) => 'x ' + e.message); if (r !== 'no user' && r !== 'no sdk') console.log('cleanup', P.ctxName, r); }
  /* the deliberate sign-in with deleted credentials makes the browser log the 400 of identitytoolkit (Firebase's own XHR): expected, not an app error */
  const errs = [...pa.errs, ...pb.errs, ...pd.errs].filter((x) => !/favicon/.test(x) && !/400 \(Bad Request\) @ https:\/\/identitytoolkit/.test(x));
  console.log('ERRORS:', JSON.stringify(errs, null, 1)); await b.close(); srv.close();
})();

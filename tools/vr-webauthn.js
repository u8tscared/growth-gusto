// node tools/run.js tools/vr-webauthn.js : vrai WebAuthn (authentificateur virtuel de Chromium, avec vérification de la personne).
// Sans compte (profils + codes) : un profil ajoute Face ID → l'écran « Qui êtes-vous ? » s'ouvre d'un regard. Puis création/lecture directes.
module.exports = async (page, shot) => {
  const c = (s) => page.$eval(s, (e) => e.click()); const w = (ms) => page.waitForTimeout(ms);
  const cdp = await page.context().newCDPSession(page); await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await page.waitForFunction(() => document.querySelector('#au.on [data-act=auLocal]') || (window.S && S.ready), null, { timeout: 8000 }).catch(() => {});
  if (await page.$('#au.on [data-act=auLocal]')) { await w(700); await c('#au.on [data-act=auLocal]'); await w(900); }
  const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }, [id, v]);
  await set('obName', 'Chemin des Sarments'); await page.evaluate(() => ACT.obNext()); await w(600); await set('obMe', 'Marceau');
  await page.evaluate(() => ACT.obCreate()); await w(2500); await page.evaluate(() => ACT.obFinish()); await w(900);
  await page.evaluate(() => { ccUnlockTest(); return DB.update('members', S.me.id, ccPinPatch(S.me.id, '2580')); }); await w(500);
  await page.evaluate(() => go('reglages')); await w(800);
  if (!(await page.$('[data-go=verrou]'))) throw new Error('ligne absente des Réglages (sans compte)');
  await c('[data-go=verrou]'); await w(900); await shot('vw-01-local');
  await page.waitForFunction(() => vrAvail === true, null, { timeout: 4000 });
  await page.evaluate(() => rerender()); await w(500);
  await c('[data-act=vrEnable]'); await w(1500); await shot('vw-02-active');
  if (!(await page.evaluate(() => !!(vrCfg() && vrCfg().cred)))) throw new Error('passkey non créée');
  await page.evaluate(() => ccLock()); await w(800); await shot('vw-03-lock');
  if (!(await page.$('.vr-ccbio'))) throw new Error('bouton Face ID absent du verrou des profils');
  await w(1500);
  if (await page.evaluate(() => CC.locked)) { await c('.vr-ccbio'); await w(1200); }
  if (await page.evaluate(() => CC.locked)) throw new Error('Face ID n\'a pas ouvert le profil');
  // échec de la vérification (visage non reconnu) : refusé
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  const r = await page.evaluate(async () => { try { await vrGet([vrCfg().cred]); return 'ok'; } catch (e) { return e.name; } });
  if (r === 'ok') throw new Error('déverrouillé sans vérification de la personne');
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
  const r2 = await page.evaluate(async () => { try { const id = await vrCreate(); return (await vrGet([id])) === id; } catch (e) { return e.name + ' ' + e.message; } });
  if (r2 !== true) throw new Error('création/lecture directe : ' + r2);
  console.log('WEBAUTHN OK (refus sans vérification : ' + r + ')');
};

// Abonnement (js/abo.js): trial state, Home strip, expired block sheet, activation code, pack gating, admin space, site deep links.
// Usage: node tools/run.js tools/abo-test.js   ·   DESKTOP=1 node tools/run.js tools/abo-test.js
module.exports = async (page, shot) => {
  const c = (s) => page.$eval(s, (e) => e.click()); const ok = (cond, m) => { if (!cond) throw new Error("FAIL " + m); console.log("ok  ", m); };
  const base = page.url().split("?")[0];
  await page.goto(base + "?local=1"); await page.waitForFunction(() => typeof S !== "undefined" && S.ready, null, { timeout: 8000 });
  await page.evaluate(() => { try { localStorage.setItem("gg-nolock", "1"); } catch (e) {} });
  const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } }, [id, v]);
  await set("obName", "Chemin des Sarments"); await page.evaluate(() => ACT.obNext()); await page.waitForTimeout(500); await set("obMe", "Marceau");
  await page.evaluate(() => ACT.obCreate()); await page.waitForTimeout(2200);
  ok(await page.evaluate(() => !!S.resto), "onboarding created a restaurant");
  await page.evaluate(() => ACT.obFinish()); await page.waitForTimeout(800);
  const r0 = await page.evaluate(() => ({ plan: S.resto.plan, pack: S.resto.pack, trialEnds: S.resto.trialEnds, createdAt: S.resto.createdAt }));
  ok(r0.plan === "essai" && r0.pack === "complet" && r0.trialEnds > Date.now() + 13 * 864e5, "resto doc has plan/pack/trialEnds " + JSON.stringify(r0));
  // Abonnement screen (trial)
  await page.evaluate(() => go("abonnement")); await page.waitForTimeout(900); await shot("10-abonnement-essai");
  ok(await page.evaluate(() => /14 jours restants/.test(document.querySelector(".ab-hero").textContent) && document.querySelectorAll(".ab-pack").length === 3), "trial hero + three packs");
  await page.evaluate(() => { const v = document.querySelector("#viewport .view"); v.scrollTop = 99999; }); await page.waitForTimeout(400); await shot("11-abonnement-bas");
  // Plus + Réglages entries
  await page.evaluate(() => go("more")); await page.waitForTimeout(700); ok(await page.evaluate(() => !!document.querySelector('[data-go="abonnement"]')), "tile Abonnement in Plus"); await shot("12-plus");
  await page.evaluate(() => go("reglages")); await page.waitForTimeout(700); ok(await page.evaluate(() => /Abonnement/.test(document.querySelector('#viewport .view').textContent)), "row Abonnement in Réglages");
  // Home strip at 2 days
  await page.evaluate(async () => { await DB.update("restos", S.rid, { trialEnds: Date.now() + 2 * 864e5 }); }); await page.waitForTimeout(300);
  await page.evaluate(() => go("home")); await page.waitForTimeout(900);
  ok(await page.evaluate(() => /2 jours restants/.test((document.querySelector(".ab-strip") || {}).textContent || "")), "Home strip « 2 jours restants »"); await shot("20-home-strip");
  // expired: writes blocked, sheet
  await page.evaluate(async () => { await DB.update("restos", S.rid, { trialEnds: Date.now() - 1000 }); }); await page.waitForTimeout(300);
  await page.evaluate(() => go("home")); await page.waitForTimeout(700);
  ok(await page.evaluate(() => abPlan().plan === "expire" && abBlocked("readings")), "plan computed as expire");
  const res = await page.evaluate(async () => { try { await DB.add("readings", { value: 3, at: Date.now() }); return "resolved"; } catch (e) { return e.code; } });
  ok(res === "ab/blocked", "DB.add rejected with ab/blocked (" + res + ")");
  await page.waitForTimeout(700); ok(await page.evaluate(() => document.querySelector("#sheet.open .ab-block") && /essai est terminé/.test(document.querySelector("#sheetBody").textContent)), "block sheet « Votre essai est terminé »");
  await shot("21-expire-sheet");
  ok(await page.evaluate(() => S.readings.length === 0), "no reading written");
  await c("[data-act=abGoAbo]"); await page.waitForTimeout(900); ok(await page.evaluate(() => S.route === "abonnement" && /Choisissez votre pack/.test(document.querySelector(".ab-hero").textContent)), "Abonnement still opens when expired"); await shot("22-abonnement-expire");
  // resto writes still allowed (rename)
  const ren = await page.evaluate(async () => { try { await DB.update("restos", S.rid, { name: "Chemin des Sarments" }); return "ok"; } catch (e) { return e.code; } }); ok(ren === "ok", "restos write allowed while expired");
  // bad code then good code
  await set("abCode", "GG-NOPE"); await page.evaluate(() => document.querySelector("form[data-ab=code]").requestSubmit()); await page.waitForTimeout(500);
  ok(await page.evaluate(() => /Code inconnu/.test(document.querySelector("#abCodeErr").textContent) && S.resto.plan === "expire" || S.resto.plan === "essai"), "wrong code refused");
  await set("abCode", "gg-complet-2026"); await page.evaluate(() => document.querySelector("form[data-ab=code]").requestSubmit()); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => S.resto.plan === "complet" && S.resto.paidAt && S.resto.activatedBy && abPlan().plan === "complet"), "activation code flips the plan to complet"); await shot("23-abonnement-complet");
  const w = await page.evaluate(async () => { try { await DB.add("readings", { value: 3, at: Date.now() }); return "ok"; } catch (e) { return e.code; } }); ok(w === "ok", "writes work again");
  // pack gating: essentiel → stock shows the upgrade card
  await page.evaluate(async () => { await DB.update("restos", S.rid, { plan: "essentiel", pack: "essentiel" }); }); await page.waitForTimeout(300);
  await page.evaluate(() => go("stock")); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !!document.querySelector(".ab-up") && /pack Pro/.test(document.querySelector(".ab-up").textContent)), "stock gated with a Pro upgrade card under Essentiel"); await shot("30-upgrade-stock");
  await page.evaluate(() => go("abonnement")); await page.waitForTimeout(800); await shot("31-abonnement-essentiel");
  ok(await page.evaluate(() => /Pack actuel/.test(document.querySelector(".ab-pack.essentiel").textContent) && /Passer à Pro/.test(document.querySelector(".ab-pack.pro").textContent) && /Passer à Complet/.test(document.querySelector(".ab-pack.complet").textContent)), "Essentiel = current, Pro and Complet = upgrades");
  await page.evaluate(() => go("resa")); await page.waitForTimeout(600); ok(await page.evaluate(() => /pack Pro/.test((document.querySelector(".ab-up") || {}).textContent || "")), "reservations gated under Essentiel");
  await page.evaluate(async () => { await DB.update("restos", S.rid, { plan: "pro", pack: "pro" }); }); await page.evaluate(() => go("stock")); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !document.querySelector(".ab-up")), "stock open under Pro");
  await page.evaluate(() => go("pointeuse")); await page.waitForTimeout(600); ok(await page.evaluate(() => /pack Complet/.test((document.querySelector(".ab-up") || {}).textContent || "")), "pointeuse gated with a Complet card under Pro"); await shot("32-upgrade-pointeuse-pro");
  await page.evaluate(() => go("abonnement")); await page.waitForTimeout(700); ok(await page.evaluate(() => /Pack actuel/.test(document.querySelector(".ab-pack.pro").textContent) && /Nous écrire/.test(document.querySelector(".ab-pack.essentiel").textContent)), "Pro = current, Essentiel = downgrade by mail"); await shot("33-abonnement-pro");
  await page.evaluate(async () => { await DB.update("restos", S.rid, { plan: "complet", pack: "complet" }); }); await page.evaluate(() => go("stock")); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !document.querySelector(".ab-up")), "stock open again under Complet");
  // paidUntil in the past → expire ; suspendu → blocked
  ok(await page.evaluate(() => { S.resto.paidUntil = Date.now() - 5; const a = abPlan().plan; S.resto.paidUntil = null; S.resto.plan = "suspendu"; const b = abPlan(); S.resto.plan = "complet"; return a === "expire" && b.plan === "suspendu" && !b.open; }), "paidUntil past = expire, suspendu = blocked");
  // Stripe link appended params (stub window.open)
  const url = await page.evaluate(() => { window.GG_STRIPE.complet = "https://buy.stripe.com/test_x"; let u = null; const o = window.open; window.open = (x) => { u = x; }; ACT.abChoose(null, null, "complet"); window.open = o; window.GG_STRIPE.complet = null; return u; });
  ok(/client_reference_id=r/.test(url) && /buy\.stripe\.com/.test(url), "Stripe link gets client_reference_id: " + url);
  await page.evaluate(() => ACT.abChoose(null, null, "complet")); await page.waitForTimeout(700); ok(await page.evaluate(() => /contactez|écrivez-nous|Nous écrire/i.test(document.querySelector("#sheetBody").textContent)), "no Stripe link → contact sheet"); await shot("32-contact-sheet"); await page.evaluate(() => closeSheet(true));
  // admin: denied, then as admin (local fallback data)
  await page.evaluate(() => go("admin")); await page.waitForTimeout(700); ok(await page.evaluate(() => /Accès réservé/.test(document.querySelector("#viewport .view").textContent)), "admin denied for a non-admin"); await shot("40-admin-denied");
  await page.evaluate(() => { S.me.email = "marceau.ruis@gmail.com"; go("admin"); }); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll(".ab-cl").length === 1 && /Chemin des Sarments/.test(document.querySelector("#abList").textContent)), "admin lists the restaurant"); await shot("41-admin");
  await c(".ab-cl"); await page.waitForTimeout(700); await shot("42-admin-sheet");
  await c("[data-act=abAdmSuspend]"); await page.waitForTimeout(600); ok(await page.evaluate(() => S.resto.plan === "suspendu" && abPlan().plan === "suspendu"), "admin suspended the restaurant");
  await c(".ab-cl"); await page.waitForTimeout(600); await shot("43-admin-suspended"); await c("[data-act=abAdmRestore]"); await page.waitForTimeout(600); ok(await page.evaluate(() => S.resto.plan === "complet"), "admin restored the plan (" + (await page.evaluate(() => S.resto.plan)) + ")");
  await c(".ab-cl"); await page.waitForTimeout(500); await c("[data-act=abAdmPack][data-v=essentiel]"); await page.waitForTimeout(300); await c("[data-act=abAdmDur][data-v='3']"); await page.waitForTimeout(300); await c("[data-act=abAdmGrant]"); await page.waitForTimeout(600);
  ok(await page.evaluate(() => S.resto.plan === "essentiel" && S.resto.paidUntil > Date.now() + 80 * 864e5 && S.resto.grantedBy === "marceau.ruis@gmail.com"), "admin granted Essentiel for 3 months");
  await c(".ab-cl"); await page.waitForTimeout(500); await c("[data-act=abAdmTrial][data-v='30']"); await page.waitForTimeout(600); ok(await page.evaluate(() => S.resto.plan === "essai" && S.resto.trialEnds > Date.now() + 29 * 864e5), "admin extended the trial by 30 days");
  await c("[data-act=abAdmTab][data-v=comptes]"); await page.waitForTimeout(600); ok(await page.evaluate(() => /marceau/.test(document.querySelector("#abList").textContent)), "Comptes tab lists the account"); await shot("44-admin-comptes");
  // deep links from the site
  await page.goto(base + "?signup=1&plan=complet"); await page.waitForTimeout(1600);
  ok(await page.evaluate(() => AUTH.ui.screen === "email" && AUTH.ui.tab === "up" && !!document.querySelector("#au.on") && /Pack Complet/.test(document.querySelector(".au-pack").textContent) && localStorage.getItem("gg-plan") === "complet" && !/signup/.test(location.search)), "?signup=1&plan=complet opens « Créer un compte » with the pack"); await shot("50-signup-complet");
  await page.goto(base + "?signup=1&plan=essentiel"); await page.waitForTimeout(1400); ok(await page.evaluate(() => /Pack Essentiel/.test(document.querySelector(".au-pack").textContent) && /59 €/.test(document.querySelector(".au-pack").textContent)), "plan=essentiel shown at 59 €"); await shot("51-signup-essentiel");
  await page.goto(base + "?login=1"); await page.waitForTimeout(1400); ok(await page.evaluate(() => AUTH.ui.screen === "email" && AUTH.ui.tab === "in" && !document.querySelector(".au-pack")), "?login=1 opens sign-in"); await shot("52-login");
  await c("[data-act=auBack]"); await page.waitForTimeout(600); ok(await page.evaluate(() => AUTH.ui.screen === "welcome"), "back goes to the welcome");
  await page.goto(base + "?admin=1"); await page.waitForTimeout(1400); ok(await page.evaluate(() => AUTH.ui.screen === "email" && sessionStorage.getItem("gg-admin") === "1"), "?admin=1 asks to sign in");
  await c("[data-act=auBack]"); await page.waitForTimeout(400); await c("[data-act=auLocal]"); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => S.route === "admin" && /Accès réservé/.test(document.querySelector("#viewport .view").textContent)), "after entering, the admin route opens (denied without an admin account)"); await shot("53-admin-after-login");
  await page.goto(base + "?demo=1"); await page.waitForTimeout(2500); ok(await page.evaluate(() => DB.mode === "demo" && abPlan().plan === "demo"), "?demo=1 still works, demo is open");
  await page.goto(base + "?local=1"); await page.waitForTimeout(1500); ok(await page.evaluate(() => DB.mode === "local" && !!S.resto), "?local=1 still works");
};

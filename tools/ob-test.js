// Onboarding walk-through (js/onboard.js): local first run through the 6 steps, home, then « Compléter la fiche » from Réglages,
// then the account hand-off (sessionStorage gg-ob) on a reload. Screenshots ob1…ob6, ob7-home, ob8-complete, ob9-boot into tools/out.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXElEQVR42u3aQREAIAhFQfoYif45NAUM6r6hwJ7+hdiXFwAAAM8Bcs09AAAAAAAAAACAvwHVAQAAAADMBlhiAAAAAAAAAAAAAAAAAAAAAAAAAACACoCvRQAAgMYOovbGcIWOSLkAAAAASUVORK5CYII=", "base64");
module.exports = async (page, shot, ctx) => {
  const c = (s) => page.$eval(s, (e) => e.click());
  const w = (ms) => page.waitForTimeout(ms);
  const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); if (!e) throw new Error("no #" + id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);
  const must = async (fn, msg) => { const r = await page.evaluate(fn); if (r !== true && r !== false && typeof r !== "string") return; if (r !== true) throw new Error(msg + (r ? " · " + r : "")); };
  await ctx.route(/google\.com\/s2\/favicons|duckduckgo\.com/, (rt) => rt.fulfill({ body: PNG, contentType: "image/png" }));
  await page.evaluate(() => { try { localStorage.setItem("gg-nolock", "1"); } catch (e) {} });
  await page.goto(page.url().replace(/\?.*$/, "") + "?local=1"); await w(900);
  await page.waitForFunction(() => typeof S !== "undefined" && S.ready && document.querySelector(".onb"), null, { timeout: 8000 });
  await w(600);
  /* 1 · le restaurant */
  await set("obName", "Chemin des Sarments"); await set("obSite", "https://www.chemindessarments.fr/carte"); await w(800);
  await c('[data-act=obType][data-v=bistrot]'); await set("obAddr", "12 rue des Sarments, Bordeaux"); await set("obPhone", "05 56 12 34 56"); await set("obCovers", "42"); await w(400);
  await shot("ob1");
  await must(() => !!(OB.st.d.logo), "logo not fetched");
  await page.focus("#obCovers"); await page.keyboard.press("Enter"); await w(700); /* Enter = continuer */
  await must(() => OB.st.step === 1 || "step " + OB.st.step, "Enter did not continue");
  /* 2 · vous */
  await set("obMe", "Marceau"); await w(300); await shot("ob2");
  await c("[data-act=obNext]"); await w(700);
  /* 3 · les frigos */
  await c('[data-act=obFr][data-v="Saladette"]'); await set("obFrIn", "Frigo poisson"); await c("[data-act=obFrAdd]"); await w(400); await shot("ob3");
  await c("[data-act=obNext]"); await w(700);
  /* 4 · l'équipe (local: profils sans compte) */
  await set("obTeamIn", "Léa"); await c("[data-act=obTeamAdd]"); await set("obTeamIn", "Tom"); await c("[data-act=obTeamAdd]"); await w(400); await shot("ob4");
  await c("[data-act=obNext]"); await w(700);
  /* 5 · l'imprimante */
  await c("[data-act=obPrinter]"); await w(300); await shot("ob5");
  await c("[data-act=obNext]"); await w(1600);
  /* 6 · c'est prêt */
  await shot("ob6");
  await must(() => !!(S.resto && S.resto.name === "Chemin des Sarments" && S.resto.site && S.resto.logo && S.resto.type === "bistrot" && S.resto.covers === 42 && S.resto.printer) || JSON.stringify(S.resto), "resto doc incomplete");
  await must(() => S.fridges.length === 6 || "n=" + S.fridges.length, "fridges count");
  await must(() => (S.members.length === 3 && !!S.members.find((m) => m.role === "gerant" && m.name === "Marceau")) || JSON.stringify(S.members), "members");
  await c("[data-act=obFinish]"); await w(900); await shot("ob7-home");
  await must(() => S.route === "home" || S.route, "not home");
  /* compléter plus tard, depuis Réglages */
  await page.evaluate(() => go("reglages")); await w(700); await shot("ob8-reglages");
  await c("[data-act=obComplete]"); await w(800); await shot("ob8-complete");
  await must(() => S.route === "onboard" && OB.st.mode === "complete" && document.getElementById("obName").value === "Chemin des Sarments", "complete mode not prefilled");
  await c("[data-act=obNext]"); await w(600); await c("[data-act=obNext]"); await w(600); await shot("ob8-frigos");
  await must(() => document.querySelectorAll(".onb-fr.had").length === 6, "existing fridges not shown");
  /* the team step as an account would see it (invite card): mocked data, no Firestore here */
  await page.evaluate(() => { OB._cloud0 = OB.cloud; OB.cloud = () => true; OB.st.d.inv = { code: "K7MP2XQ9", rid: S.rid, role: "equipe", expiresAt: Date.now() + 7 * 864e5 }; });
  await c("[data-act=obSkip]"); await w(700); await shot("ob8-equipe-cloud");
  await must(() => !!document.querySelector(".onb-qr svg") && !!document.querySelector(".onb-code"), "invite card not rendered");
  await page.evaluate(() => { OB.cloud = OB._cloud0; });
  await c("[data-act=obSkip]"); await w(600); await c("[data-act=obSkip]"); await w(1200); await shot("ob8-done");
  await c("[data-act=obPrev]").catch(() => {});
  await c("[data-act=obFinish]"); await w(800);
  await must(() => S.route === "reglages" || S.route, "back to reglages expected");
  /* the account hand-off: the flag set by auth.js createSubmit, picked up at boot */
  await page.evaluate(() => { sessionStorage.setItem("gg-ob", S.rid); location.reload(); }); await w(1800);
  await page.waitForFunction(() => typeof S !== "undefined" && S.ready, null, { timeout: 8000 }); await w(700); await shot("ob9-boot");
  await must(() => (S.route === "onboard" && !!OB.st && OB.st.mode === "complete") || S.route, "boot hand-off failed");
  await must(() => !document.querySelector("#tabbar:not(.hide)") , "tab bar visible during onboarding");
  await page.emulateMedia({ colorScheme: "dark" }); await w(400); await shot("ob10-dark1");
  await c("[data-act=obNext]"); await w(700); await c("[data-act=obNext]"); await w(700); await shot("ob10-dark3");
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => { try { localStorage.removeItem("gg-nolock"); } catch (e) {} });
};

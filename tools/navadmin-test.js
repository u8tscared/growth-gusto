// Admin entries in the sidebar and in Plus, only for GG_ADMINS. Usage: DESKTOP=1 node tools/run.js tools/navadmin-test.js
module.exports = async (page, shot) => {
  const ok = (cond, m) => { if (!cond) throw new Error("FAIL " + m); console.log("ok  ", m); };
  const base = page.url().split("?")[0];
  await page.goto(base + "?local=1"); await page.waitForFunction(() => typeof S !== "undefined" && S.ready, null, { timeout: 8000 });
  await page.evaluate(() => { try { localStorage.setItem("gg-nolock", "1"); } catch (e) {} });
  const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } }, [id, v]);
  await set("obName", "Chemin des Sarments"); await page.evaluate(() => ACT.obNext()); await page.waitForTimeout(500); await set("obMe", "Marceau");
  await page.evaluate(() => ACT.obCreate()); await page.waitForTimeout(2200); await page.evaluate(() => ACT.obFinish()); await page.waitForTimeout(800);
  await page.evaluate(() => go("more")); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !document.querySelector('#side [data-go="admin"]') && !document.querySelector('#viewport [data-go="admin"]')), "no admin entry for a regular account");
  await page.evaluate(() => { S.me.email = "marceau.ruis@gmail.com"; go("home"); }); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !!document.querySelector('#side .nav[data-go="admin"]')), "sidebar shows Admin for the admin");
  await page.evaluate(() => { const n = document.querySelector("#side .navs"); n.scrollTop = 99999; }); await page.waitForTimeout(300); await shot("navadmin-side");
  await page.evaluate(() => go("more")); await page.waitForTimeout(700);
  ok(await page.evaluate(() => /^Admin/.test(document.querySelector(".cc-sec").textContent) && !!document.querySelector('#viewport [data-go="admin"]')), "Plus starts with the Admin group"); await shot("navadmin-plus");
  await page.evaluate(() => document.querySelector('#side .nav[data-go="admin"]').click()); await page.waitForTimeout(900);
  ok(await page.evaluate(() => S.route === "admin" && document.querySelector('#side .nav[data-go="admin"]').classList.contains("on")), "click opens /admin, item highlighted"); await shot("navadmin-open");
};

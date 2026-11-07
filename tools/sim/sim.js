// Simulation : 15 restaurants très différents (tools/sim/profiles.js) testent toute l'app, sur téléphone, tablette et ordinateur.
// Rien ne sort de la machine : l'app tourne en mode « sur cet appareil » (localStorage), toute requête hors localhost est bloquée
// (et notée), window.print / window.open / navigator.share sont neutralisés. Aucun vrai compte, aucun vrai e-mail, aucun paiement.
//
// Usage : node tools/sim/sim.js [--only bistrot,bar] [--devices phone,tablet,desktop] [--monkey all|one|none] [--par 4]
// Sortie : tools/sim/out/results.json (+ captures des écrans à problème) puis node tools/sim/report.js pour le rapport.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.resolve(process.env.OUT || path.join(__dirname, "out"));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const PROFILES = require("./profiles.js").filter((p) => !arg("only") || arg("only").split(",").includes(p.id));
const DEVICES = (arg("devices", "phone,tablet,desktop")).split(",");
const MONKEY = arg("monkey", "one"); /* one : un appareil par profil (en tournant) · all · none */
const PAR = +arg("par", 4);
const SEED = fs.readFileSync(path.join(__dirname, "seed.js"), "utf8");
const CHECKS = require("./checks.js");
fs.mkdirSync(OUT, { recursive: true });

const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 860 } },
};

/* serveur statique, comme tools/run.js (css servis avec leurs jumeaux sombres) */
const SB = require("../sombre.js");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".json": "application/json", ".woff2": "font/woff2" };
const prep = (f) => { const b = fs.readFileSync(f); if (path.dirname(f) !== path.join(ROOT, "css") || !f.endsWith(".css")) return b; const n = path.basename(f); if (n === "sombre.css") return b.toString() + "\n" + SB.BUILT; return SB.SKIP_FILES.has(n) ? b : SB.transform(b.toString()).css; };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; const f = path.join(ROOT, u); if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream"); return r.end(prep(f)); } r.statusCode = 404; r.end(); });

const DANGER = /del|suppr|remove|reset|wipe|logout|signout|signOut|quit|leave|purge|erase|danger|wipe|abPay|abPortal|abCheckout|stripe|Send|send|mail|sms|Sms|invite|Invite|share|Share|print|Print|auDemo|auLocal|auGoogle|install|Install|camera|Camera|scanStart|photo|Photo|file|File|upload|Upload|import|Import|export|Export|download|Download|ics|tourStart|vrOn|vrEnroll|lock|Lock|bigToggle|Fullscreen|theme|Theme|ccWipe|backup|Backup|restore|Restore|leaveResto|newResto|addResto|switchResto|esDemoBecome|esDemoPick|esDev|esKiosk|esLaunch|nfAsk|notif|Notif|bqConnect|plConnect|cxConnect|cxGo|cxKey|sdBuy|buy|Buy|link|Link|call|Call|tel|Tel|map|Map/;

async function prepare(page, P, device) {
  const t0 = Date.now();
  await page.goto(BASE + "/?nointro", { waitUntil: "domcontentloaded" });
  if (P.depart === "demo") {
    await page.waitForSelector("[data-act=auDemo]", { timeout: 15000 });
    await page.$eval("[data-act=auDemo]", (e) => e.click());
    await page.waitForFunction(() => typeof S !== "undefined" && S.ready && S.resto && DB.mode === "demo", null, { timeout: 20000 });
    await page.waitForTimeout(3500); /* les modules ajoutent leurs données de démo après le démarrage */
    await page.addScriptTag({ content: SEED });
    const info = await page.evaluate((P) => {
      const r = simApply(DB.local, P);
      localStorage.setItem("gg-local", JSON.stringify(r.data)); localStorage.setItem("gg-rid", r.rid);
      localStorage.setItem("gg-mode", "local"); localStorage.setItem("gg-local-ok", "1"); localStorage.setItem("gg-tour-local", "1"); localStorage.setItem("gg-vr-seen", "1");
      sessionStorage.removeItem("gg-demo");
      return { rid: r.rid, sites: r.sites, bytes: localStorage.getItem("gg-local").length };
    }, P);
    await page.goto(BASE + "/?nointro&local=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof S !== "undefined" && S.ready && S.resto, null, { timeout: 20000 });
    await page.waitForTimeout(1200);
    return { ...info, ms: Date.now() - t0 };
  }
  /* nouveau client : la vraie prise en main, écran par écran */
  await page.evaluate(() => { localStorage.setItem("gg-vr-seen", "1"); });
  await page.goto(BASE + "/?nointro&local=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && S.ready, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const steps = [];
  const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } return !!e; }, [id, v]);
  await set("obName", P.nom); await page.evaluate((t) => { const b = document.querySelector(`.onb [data-act=obType][data-v="${t}"]`); if (b) b.click(); }, P.type);
  await set("obCovers", String(P.couverts));
  for (let i = 0; i < 16; i++) {
    const st = await page.evaluate(() => (typeof OB !== "undefined" && OB.st ? (OB_STEPS[OB.st.step] || {}).k : "fin:" + S.route));
    steps.push(st);
    if (!st || String(st).startsWith("fin:")) break;
    await set("obName", P.nom); await set("obMe", P.equipe[0][0].split(" ")[0]);
    if (st === "pret") { await page.evaluate(() => { try { ACT.obFinish(); } catch (e) {} }); await page.waitForTimeout(900); continue; }
    const moved = await page.evaluate(() => { try { const k = (OB_STEPS[OB.st.step] || {}).k; OB.next(!(k === "resto" || k === "vous")); return true; } catch (e) { return "ERR " + e.message; } });
    if (moved !== true) { steps.push("blocked:" + moved); break; }
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1500);
  const ok = await page.evaluate(() => !!S.resto);
  if (!ok) return { rid: null, ms: Date.now() - t0, steps, error: "aucun restaurant créé" };
  await page.evaluate(async (P) => {
    const add = (c, d) => DB.add(c, d);
    const kinds = P.id === "foodtruck" ? ["saladette", "congel"] : ["frigo", "cfp", "congel", "saladette"];
    if (!S.fridges.length) for (let i = 0; i < P.frigos; i++) await add("fridges", { name: ["Saladette", "Congélateur", "Frigo", "Chambre froide"][i % 4] + " " + (i + 1), type: kinds[i % kinds.length], min: kinds[i % kinds.length] === "congel" ? -40 : 0, max: kinds[i % kinds.length] === "congel" ? -15 : 4, order: i });
    for (const [name, role, poste] of P.equipe.slice(1)) await add("members", { name, role, poste, joinedAt: Date.now() });
    const patch = P.plan === "essai" ? { plan: "essai", pack: P.pack } : { plan: P.plan, pack: P.plan, paidAt: Date.now(), paidUntil: null };
    if (P.sansModules.length) patch.modsOff = P.sansModules.slice();
    await DB.update("restos", S.rid, patch);
  }, P);
  await page.evaluate(() => { localStorage.setItem("gg-tour-local", "1"); try { TOUR && TOUR.done && TOUR.done(); } catch (e) {} });
  await page.waitForTimeout(1200);
  return { rid: await page.evaluate(() => S.rid), ms: Date.now() - t0, steps };
}
const S_ROUTE_HOME = (r) => r === "home";

/* une mesure d'écran : erreurs, rendu, débordement, textes cassés, boutons trop petits, écran vide */
const MEASURE = () => {
  const vw = innerWidth, v = document.querySelector("#viewport .view") || document.body;
  const sel = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += "#" + e.id; if (e.classList.length) s += "." + [...e.classList].slice(0, 2).join("."); const a = e.getAttribute("data-act"); if (a) s += `[data-act=${a}]`; return s; };
  const visible = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const clipped = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) return true; } return false; };
  const over = [];
  v.querySelectorAll("*").forEach((e) => { if (over.length > 4) return; const r = e.getBoundingClientRect(); if (r.right > vw + 2 && r.left < vw && visible(e) && !clipped(e)) over.push(sel(e) + " → " + Math.round(r.right - vw) + "px"); });
  const text = v.innerText || "";
  const glitch = (text.match(/\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\bnull\b|Infinity/g) || []).slice(0, 5);
  let tiny = [];
  if (matchMedia("(pointer:coarse)").matches) v.querySelectorAll("button,[data-act],[data-go],a[href],input[type=checkbox],select").forEach((e) => { if (!visible(e)) return; const r = e.getBoundingClientRect(); if ((r.width < 30 || r.height < 30) && !e.closest(".sheet") && r.top < innerHeight * 3) tiny.push(sel(e) + " " + Math.round(r.width) + "×" + Math.round(r.height)); });
  const hScroll = document.scrollingElement.scrollWidth - vw;
  const small = [...v.querySelectorAll("p,span,b,div,li,em,small,label")].filter((e) => e.childElementCount === 0 && (e.innerText || "").trim().length > 3 && visible(e) && parseFloat(getComputedStyle(e).fontSize) < 11).length;
  return { len: text.trim().length, glitch, over, hScroll: hScroll > 2 ? hScroll : 0, tiny: tiny.length, tinyEx: tiny.slice(0, 4), small, locked: !!v.querySelector(".ab-up") || S.route === "locked", route: S.route, title: (v.querySelector(".top .h2,h1,.h1,.h2") || {}).innerText || "" };
};

async function visit(page, route, errs, wait = 650) {
  const before = errs.length;
  const r = await page.evaluate((route) => { const t = performance.now(); try { go(route); } catch (e) { return { ms: performance.now() - t, err: "go(" + route + ") : " + e.message }; } return { ms: performance.now() - t }; }, route);
  await page.waitForTimeout(wait);
  const m = await page.evaluate(MEASURE).catch((e) => ({ err2: e.message }));
  return { route, ms: Math.round(r.ms), ...(r.err ? { err: r.err } : {}), ...m, errs: errs.slice(before) };
}

async function job(browser, P, device, doMonkey) {
  const ctx = await browser.newContext({ ...DEV[device], permissions: [] });
  const ext = [];
  await ctx.route("**/*", (rt) => { const u = rt.request().url(); if (u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:")) return rt.continue(); ext.push(u.replace(/\?.*/, "")); return /googleapis|gstatic/.test(u) && /css|font/.test(u) ? rt.fulfill({ body: "", contentType: "text/css" }) : rt.abort(); });
  await ctx.addInitScript(() => { window.print = () => { (window.__sim = window.__sim || {}).print = (window.__sim.print || 0) + 1; }; window.open = (u) => { (window.__sim = window.__sim || {}).open = [...(window.__sim.open || []), String(u)]; return null; }; try { navigator.share = undefined; } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errs.push("console: " + m.text().slice(0, 300)); });
  page.on("dialog", (d) => { errs.push("dialog natif (" + d.type() + ") : " + d.message().slice(0, 120)); d.dismiss().catch(() => {}); });
  const res = { profile: P.id, device, visits: [], roles: [], stations: [], monkey: [], checks: [], ext: [], setup: null };
  const dir = path.join(OUT, P.id, device); fs.mkdirSync(dir, { recursive: true });
  const shot = (n) => page.screenshot({ path: path.join(dir, n + ".jpg"), type: "jpeg", quality: 55 }).catch(() => {});
  try {
    res.setup = await prepare(page, P, device);
    res.setup.errs = errs.splice(0);
    await shot("00-accueil");
    /* 1) le gérant ouvre chaque écran de son menu */
    const nav = await page.evaluate(() => (typeof esNavRoutes === "function" ? esNavRoutes() : NAV.filter((n) => n[0] !== "sep" && VIEWS[n[0]]).map((n) => n[0])));
    res.nav = nav;
    const all = await page.evaluate(() => NAV.filter((n) => n[0] !== "sep" && VIEWS[n[0]]).map((n) => n[0]));
    res.hidden = all.filter((r) => !nav.includes(r));
    for (const r of ["home", ...nav.filter((x) => x !== "home"), "more", "reglages"]) {
      const v = await visit(page, r, errs);
      res.visits.push(v);
      if (v.err || v.errs.length || v.glitch.length || v.over.length || v.hScroll) await shot("pb-" + r);
    }
    /* 2) chaque type de personne ouvre son appli (Voir comme) */
    const people = await page.evaluate(() => { const seen = new Set(); return S.members.filter((m) => m.role !== "gerant" && m.id !== "local").filter((m) => { const k = m.role + "|" + (m.poste || ""); if (seen.has(k)) return false; seen.add(k); return true; }).map((m) => ({ id: m.id, role: m.role, poste: m.poste || "", name: m.name })); });
    for (const who of people) {
      const sp = await page.evaluate((id) => { try { esDemoBecome(id); S.history = []; go("home", {}, { replace: true }); renderChrome(); return { nav: esNavRoutes(), spaces: esAllowed() }; } catch (e) { return { err: e.message }; } }, who.id);
      const rv = { ...who, ...sp, visits: [] };
      for (const r of (sp.nav || []).slice(0, 40)) { const v = await visit(page, r, errs, 400); if (v.err || v.errs.length || v.glitch.length || v.over.length || v.hScroll) { rv.visits.push(v); await shot("pb-" + who.poste + "-" + r); } }
      const fin = await visit(page, "finance", errs, 300); rv.financeOuverte = fin.route === "finance" && !fin.locked;
      res.roles.push(rv);
    }
    await page.evaluate(() => { esDemoBecome("local"); S.me = { id: "local", name: S.me.name }; S.isOwner = true; S.demoAs = null; S.history = []; go("home", {}, { replace: true }); renderChrome(); });
    /* 3) appareils du restaurant (tablette surtout) */
    if (device !== "phone") {
      const st = await page.evaluate(() => (typeof ES_ST === "object" ? Object.keys(ES_ST) : []));
      for (const k of st) {
        const before = errs.length;
        const r = await page.evaluate((k) => { try { esDemoBecome("local", k); S.history = []; go("home", {}, { replace: true }); renderChrome(); return { ok: true }; } catch (e) { return { err: e.message }; } }, k);
        await page.waitForTimeout(700);
        const m = await page.evaluate(MEASURE);
        res.stations.push({ station: k, ...r, ...m, errs: errs.slice(before) });
        await shot("station-" + k);
      }
      await page.evaluate(() => { try { esUnkiosk && esUnkiosk(); } catch (e) {} esDemoBecome("local"); S.isOwner = true; S.demoAs = null; S.history = []; go("home", {}, { replace: true }); renderChrome(); });
    }
    /* 4) on appuie sur tout (sauf ce qui supprime, envoie, paie, imprime ou quitte) */
    if (doMonkey) {
      for (const r of nav) {
        await page.evaluate((r) => { try { go(r); } catch (e) {} }, r); await page.waitForTimeout(350);
        const acts = await page.evaluate((D) => { const re = new RegExp(D); const seen = new Set(); return [...document.querySelectorAll("#viewport .view:first-child [data-act]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.disabled; }).map((e) => ({ a: e.dataset.act, id: e.dataset.id || "", v: e.dataset.v || "" })).filter((x) => !re.test(x.a) && !seen.has(x.a + x.v) && seen.add(x.a + x.v)).slice(0, 14); }, DANGER.source);
        for (const x of acts) {
          const before = errs.length;
          const out = await page.evaluate(async (x) => {
            const el = [...document.querySelectorAll("#viewport .view:first-child [data-act]")].find((e) => e.dataset.act === x.a && (e.dataset.v || "") === x.v);
            if (!el) return { gone: true };
            try { if (typeof el.click === "function") el.click(); else el.dispatchEvent(new MouseEvent("click", { bubbles: true })); } catch (e) { return { err: e.message }; }
            await new Promise((r) => setTimeout(r, 260));
            const sheet = document.querySelector("#sheet.open");
            let inner = null;
            if (sheet) { const b = [...sheet.querySelectorAll("[data-act]")].find((e) => !/del|suppr|send|mail|sms|pay|print|share|remove|invite|confirm|Ok$|Save|save|valid/i.test(e.dataset.act)); if (b) { inner = b.dataset.act; try { b.click(); } catch (e) { return { err: e.message, inner }; } await new Promise((r) => setTimeout(r, 200)); } }
            const m = { route: S.route, sheet: !!sheet, inner };
            try { closeSheet(); } catch (e) {}
            return m;
          }, x).catch((e) => ({ err: "eval: " + e.message.slice(0, 200) }));
          const e2 = errs.slice(before);
          if (out.err || e2.length) res.monkey.push({ route: r, act: x.a, v: x.v, ...out, errs: e2 });
          const cur = await page.evaluate(() => S.route).catch(() => r);
          if (cur !== r) { await page.evaluate((r) => { try { go(r); } catch (e) {} }, r); await page.waitForTimeout(250); }
        }
        res.monkeyRoutes = (res.monkeyRoutes || 0) + 1; res.monkeyActs = (res.monkeyActs || 0) + acts.length;
      }
    }
    /* 5) les vérifications propres à ce restaurant */
    res.checks = await CHECKS.run(page, P, device, errs, { visit, shot, MEASURE, DEV: DEV[device], ctx });
  } catch (e) {
    res.fatal = e.message.slice(0, 500); await shot("fatal");
  }
  res.leftErrs = errs.slice();
  res.ext = [...new Set(ext)].slice(0, 30);
  res.print = await page.evaluate(() => window.__sim || {}).catch(() => ({}));
  await ctx.close();
  return res;
}

let BASE;
srv.listen(0, async () => {
  BASE = "http://localhost:" + srv.address().port;
  const browser = await chromium.launch();
  const jobs = [];
  PROFILES.forEach((P, i) => DEVICES.forEach((d, j) => jobs.push({ P, d, monkey: MONKEY === "all" || (MONKEY === "one" && DEVICES[i % DEVICES.length] === d) })));
  const results = []; let k = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (k < jobs.length) {
      const j = jobs[k++]; const t = Date.now();
      const r = await job(browser, j.P, j.d, j.monkey).catch((e) => ({ profile: j.P.id, device: j.d, fatal: e.message }));
      r.sec = Math.round((Date.now() - t) / 1000); results.push(r);
      const bad = (r.visits || []).filter((v) => v.err || v.errs.length).length;
      console.log(`${j.P.id.padEnd(12)} ${j.d.padEnd(8)} ${r.sec}s  écrans ${(r.visits || []).length}  erreurs ${bad}  monkey ${(r.monkey || []).length}  checks ${(r.checks || []).filter((c) => !c.ok).length} KO${r.fatal ? "  FATAL " + r.fatal : ""}`);
      fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
    }
  }));
  console.log("Terminé en " + Math.round((Date.now() - t0) / 60000) + " min · " + results.length + " parcours");
  await browser.close(); srv.close();
});

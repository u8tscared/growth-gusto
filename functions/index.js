/* Growth Gusto server (Firebase Cloud Functions v2, europe-west9). Each module lives in src/<name>.js and exports named functions.
   Cost rule: ONE scheduled job (Cloud Scheduler gives 3 free jobs per account) calls every module's tick. */
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const { onSchedule } = require("firebase-functions/v2/scheduler");
const mods = {};
/* modules switched on in functions/.env (GG_MODULES): caisse needs its SumUp keys set as secrets before it can be deployed */
for (const m of String(process.env.GG_MODULES || "sondes,alertes,resa,mails").split(",").map((x) => x.trim()).filter(Boolean)) {
  try { mods[m] = require("./src/" + m); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; }
}
const TICKS = ["sondesTick", "caisseTick", "alertesTick", "resaTick", "mailsTick"];
const SECRETS = [];
const isSecret = (v) => v && typeof v === "object" && typeof v.name === "string" && /Secret/.test((v.constructor && v.constructor.name) || "");
for (const m of Object.values(mods)) for (const [k, v] of Object.entries(m)) { if (Array.isArray(v) && v.every(isSecret)) { v.forEach((x) => { if (!SECRETS.some((y) => y.name === x.name)) SECRETS.push(x); }); } else if (isSecret(v)) { if (!SECRETS.some((y) => y.name === v.name)) SECRETS.push(v); } else if (!TICKS.includes(k) && k !== "alertesWeekly" && k[0] !== "_") exports[k] = v; }
exports.ggTick = onSchedule({ schedule: "every 15 minutes", region: "europe-west9", timeZone: "Europe/Paris", secrets: SECRETS }, async () => {
  const fns = []; for (const m of Object.values(mods)) for (const k of TICKS) if (typeof m[k] === "function") fns.push(m[k]);
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  if (now.getDay() === 1 && now.getHours() === 7 && now.getMinutes() < 15) for (const m of Object.values(mods)) if (typeof m.alertesWeekly === "function") fns.push(m.alertesWeekly);
  const res = await Promise.allSettled(fns.map((f) => f()));
  res.forEach((r) => { if (r.status === "rejected") console.error("tick", r.reason); });
});

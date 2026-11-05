/* Growth Gusto server (Firebase Cloud Functions v2, europe-west9). Each module lives in src/<name>.js and exports named functions.
   Cost rule: ONE scheduled job (Cloud Scheduler gives 3 free jobs per account) calls every module's tick. */
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const { onSchedule } = require("firebase-functions/v2/scheduler");
const mods = {};
for (const m of ["sondes", "alertes", "caisse"]) {
  try { mods[m] = require("./src/" + m); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; }
}
const TICKS = ["sondesTick", "caisseTick", "alertesTick"];
const SECRETS = [];
const isSecret = (v) => v && typeof v === "object" && typeof v.name === "string" && /Secret/.test((v.constructor && v.constructor.name) || "");
for (const m of Object.values(mods)) for (const [k, v] of Object.entries(m)) { if (isSecret(v)) { if (!SECRETS.includes(v)) SECRETS.push(v); } else if (!TICKS.includes(k) && k !== "alertesWeekly") exports[k] = v; }
exports.ggTick = onSchedule({ schedule: "every 15 minutes", region: "europe-west9", timeZone: "Europe/Paris", secrets: SECRETS }, async () => {
  const fns = []; for (const m of Object.values(mods)) for (const k of TICKS) if (typeof m[k] === "function") fns.push(m[k]);
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  if (now.getDay() === 1 && now.getHours() === 7 && now.getMinutes() < 15) for (const m of Object.values(mods)) if (typeof m.alertesWeekly === "function") fns.push(m.alertesWeekly);
  const res = await Promise.allSettled(fns.map((f) => f()));
  res.forEach((r) => { if (r.status === "rejected") console.error("tick", r.reason); });
});

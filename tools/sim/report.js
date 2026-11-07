// Rapport de la simulation : lit tools/sim/out/<passe>/results.json, regroupe les problèmes par écran et par restaurant.
// Usage : node tools/sim/report.js [dossier]  → écrit <dossier>/rapport.md et affiche le résumé.
const fs = require("fs"), path = require("path");
const DIR = path.resolve(process.argv[2] || path.join(__dirname, "out"));
const R = JSON.parse(fs.readFileSync(path.join(DIR, "results.json"), "utf8"));
const P = Object.fromEntries(require("./profiles.js").map((p) => [p.id, p]));
const L = [];
const add = (m, k, v) => { (m[k] ||= []).push(v); };
const errs = {}, glitch = {}, over = {}, slow = {}, tiny = {}, monkey = {}, small = {}, empty = {};
let visits = 0, acts = 0;
const norm = (e) => e.replace(/https?:\/\/localhost:\d+/g, "").replace(/\d{4,}/g, "#").slice(0, 220);
for (const r of R) {
  const who = `${r.profile}/${r.device}`;
  for (const v of r.visits || []) {
    visits++;
    (v.errs || []).concat(v.err ? [v.err] : []).forEach((e) => add(errs, norm(e), who + " · " + v.route));
    if (v.glitch && v.glitch.length) add(glitch, v.route + " : " + [...new Set(v.glitch)].join(","), who);
    if ((v.over && v.over.length) || v.hScroll) add(over, v.route + (r.device ? " (" + r.device + ")" : ""), who + " " + (v.over || []).slice(0, 2).join(" ; ") + (v.hScroll ? " · défilement horizontal " + v.hScroll + "px" : ""));
    if (v.ms > 250) add(slow, v.route, who + " " + v.ms + " ms");
    if (v.tiny > 4 && r.device !== "desktop") add(tiny, v.route, who + " " + v.tiny + " (" + (v.tinyEx || []).slice(0, 2).join(", ") + ")");
    if (v.small > 3) add(small, v.route, who + " " + v.small);
    if (v.len < 60 && !v.locked) add(empty, v.route, who);
  }
  for (const ro of r.roles || []) for (const v of ro.visits || []) {
    (v.errs || []).concat(v.err ? [v.err] : []).forEach((e) => add(errs, norm(e), who + " · " + ro.poste + "/" + ro.role + " · " + v.route));
    if (v.glitch && v.glitch.length) add(glitch, v.route + " : " + [...new Set(v.glitch)].join(","), who + " (" + ro.poste + ")");
    if ((v.over && v.over.length) || v.hScroll) add(over, v.route + " (" + r.device + ")", who + " (" + ro.poste + ") " + (v.over || []).slice(0, 2).join(" ; "));
  }
  for (const s of r.stations || []) (s.errs || []).concat(s.err ? [s.err] : []).forEach((e) => add(errs, norm(e), who + " · appareil " + s.station));
  for (const m of r.monkey || []) { const k = (m.err || (m.errs || []).join(" | ")); add(monkey, norm(k), who + " · " + m.route + " → " + m.act + (m.v ? "(" + m.v + ")" : "") + (m.inner ? " → " + m.inner : "")); }
  acts += r.monkeyActs || 0;
  (r.setup && r.setup.errs || []).forEach((e) => add(errs, norm(e), who + " · démarrage"));
}
const sec = (t, m, max = 6) => { const ks = Object.keys(m).sort((a, b) => m[b].length - m[a].length); L.push(`\n## ${t} (${ks.length})\n`); ks.forEach((k) => L.push(`- **${k}** — ${m[k].length}× : ${[...new Set(m[k])].slice(0, max).join(" ; ")}`)); };
L.push(`# Simulation de ${new Set(R.map((r) => r.profile)).size} restaurants\n`);
L.push(`${R.length} parcours (restaurant × appareil), ${visits} ouvertures d'écran, ${acts} boutons essayés.`);
const fat = R.filter((r) => r.fatal); if (fat.length) { L.push("\n## Parcours interrompus\n"); fat.forEach((r) => L.push(`- ${r.profile}/${r.device} : ${r.fatal}`)); }
sec("Erreurs JavaScript", errs, 8);
sec("Erreurs en appuyant sur les boutons", monkey, 8);
sec("Textes cassés (undefined, NaN…)", glitch);
sec("Débordements de l'écran", over);
sec("Écrans lents (> 250 ms)", slow);
sec("Boutons trop petits pour le doigt", tiny, 4);
sec("Textes minuscules (< 11 px)", small, 4);
sec("Écrans presque vides", empty, 6);
L.push("\n## Vérifications par restaurant\n");
const seen = new Set();
for (const r of R) for (const c of r.checks || []) { const k = r.profile + c.id; if (seen.has(k) && c.ok) continue; seen.add(k); if (c.ok && !c.info) continue; L.push(`- ${c.ok ? (c.info ? "ℹ" : "✓") : "✗"} **${P[r.profile].nom}** (${r.device}) · ${c.titre} : ${c.detail}${c.errs && c.errs.length ? " · erreurs : " + c.errs.join(" | ").slice(0, 200) : ""}`); }
L.push("\n## Accès par personne\n");
const ra = new Set();
for (const r of R) for (const ro of r.roles || []) { const k = r.profile + ro.role + ro.poste; if (ra.has(k)) continue; ra.add(k); L.push(`- ${P[r.profile].nom} · ${ro.role}/${ro.poste} : ${(ro.nav || []).length} écrans, vues ${(ro.spaces || []).join("/")}${ro.financeOuverte ? " · **voit les finances**" : ""}${ro.err ? " · erreur " + ro.err : ""}`); }
L.push("\n## Requêtes vers l'extérieur (bloquées)\n");
const ex = {}; R.forEach((r) => (r.ext || []).forEach((u) => add(ex, u.replace(/^(https?:\/\/[^/]+).*/, "$1"), r.profile))); Object.keys(ex).forEach((k) => L.push(`- ${k} : ${[...new Set(ex[k])].join(", ")}`));
fs.writeFileSync(path.join(DIR, "rapport.md"), L.join("\n"));
console.log(L.join("\n").slice(0, +process.env.MAX || 60000));

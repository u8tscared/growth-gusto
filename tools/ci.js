// Vérification lancée sur chaque PR (.github/workflows/pr.yml) avant la mise en ligne automatique.
// 1) chaque fichier .js du dépôt (hors vendor/) se lit sans erreur de syntaxe ;
// 2) chaque .json / .webmanifest se lit ;
// 3) l'app s'ouvre dans un vrai navigateur, crée un restaurant, enregistre un relevé (tools/smoke.js) sans aucune erreur.
// Usage : node tools/ci.js  (code de sortie 1 au moindre problème)
const {execFileSync,spawnSync}=require('child_process');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');process.chdir(ROOT);
const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(Boolean).filter(f=>!f.startsWith('vendor/'));
const bad=[];
for(const f of files.filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)bad.push(f+'\n'+(r.stderr||'').trim());}
for(const f of files.filter(f=>/\.(json|webmanifest)$/.test(f))){try{JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){bad.push(f+' : JSON illisible ('+e.message+')')}}
if(bad.length){console.log('Erreurs de syntaxe :\n\n'+bad.join('\n\n'));process.exit(1);}
console.log('Syntaxe OK ('+files.length+' fichiers)');
if(process.env.SKIP_BROWSER)process.exit(0);
const r=spawnSync(process.execPath,['tools/run.js','tools/smoke.js'],{encoding:'utf8',env:{...process.env,OUT:path.join(ROOT,'tools/out/ci')},timeout:180000});
const out=(r.stdout||'')+(r.stderr||'');console.log(out.trim());
const m=out.match(/ERRORS: (\[[\s\S]*\])/);const errs=m?JSON.parse(m[1]):null;
if(r.status!==0||/SCRIPT ERROR/.test(out)||!errs||errs.length){console.log("\nL'app ne s'ouvre pas proprement : voir ci-dessus.");process.exit(1);}
console.log("App OK : ouverture, création d'un restaurant et relevé sans erreur.");

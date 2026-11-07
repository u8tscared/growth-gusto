// Vérification lancée sur chaque PR (.github/workflows/pr.yml) avant la mise en ligne automatique.
// 1) chaque fichier .js du dépôt (hors vendor/) se lit sans erreur de syntaxe ;
// 2) chaque .json / .webmanifest se lit ;
// 3) l'app s'ouvre dans un vrai navigateur, crée un restaurant, enregistre un relevé (tools/smoke.js) sans aucune erreur ;
// 4) sur téléphone et tablette, chaque écran du menu ordinateur est aussi dans le menu « Plus » (tools/nav-test.js) ;
// 5) chaque écran du menu a sa leçon de « Prise en main » (tools/lecons-test.js, js/lecons.js) ;
// 6) le site vitrine suit l'app : il se construit, et chaque écran du menu y est présenté (tools/site/build.py + check.py).
// Usage : node tools/ci.js  (code de sortie 1 au moindre problème)
const {execFileSync,spawnSync}=require('child_process');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');process.chdir(ROOT);
const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(Boolean).filter(f=>!f.startsWith('vendor/'));
const bad=[];
for(const f of files.filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)bad.push(f+'\n'+(r.stderr||'').trim());}
for(const f of files.filter(f=>/\.(json|webmanifest)$/.test(f))){try{JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){bad.push(f+' : JSON illisible ('+e.message+')')}}
if(bad.length){console.log('Erreurs de syntaxe :\n\n'+bad.join('\n\n'));process.exit(1);}
console.log('Syntaxe OK ('+files.length+' fichiers)');
// 5) site vitrine (growthgusto.fr) : construit depuis le menu de l'app, et aucun écran sans texte sur le site
const py=(args)=>{const x=spawnSync('python3',args,{encoding:'utf8',timeout:120000});const o=((x.stdout||'')+(x.stderr||'')).trim();console.log(o);return x.status===0;};
if(!py(['tools/site/build.py'])){console.log("\nLe site vitrine ne se construit pas : voir ci-dessus.");process.exit(1);}
if(!py(['tools/site/check.py'])){console.log("\nLe site vitrine ne présente pas tous les écrans de l'app : voir ci-dessus.");process.exit(1);}
if(process.env.SKIP_BROWSER)process.exit(0);
const r=spawnSync(process.execPath,['tools/run.js','tools/smoke.js'],{encoding:'utf8',env:{...process.env,OUT:path.join(ROOT,'tools/out/ci')},timeout:180000});
const out=(r.stdout||'')+(r.stderr||'');console.log(out.trim());
const m=out.match(/ERRORS: (\[[\s\S]*\])/);const errs=m?JSON.parse(m[1]):null;
if(r.status!==0||/SCRIPT ERROR/.test(out)||!errs||errs.length){console.log("\nL'app ne s'ouvre pas proprement : voir ci-dessus.");process.exit(1);}
console.log("App OK : ouverture, création d'un restaurant et relevé sans erreur.");
// 4) téléphone et tablette : chaque écran du menu ordinateur est aussi dans le menu « Plus » (tools/nav-test.js)
for(const [nom,env] of [['téléphone',{}],['tablette',{TABLET:'1'}]]){
  const n=spawnSync(process.execPath,['tools/run.js','tools/nav-test.js'],{encoding:'utf8',env:{...process.env,...env,OUT:path.join(ROOT,'tools/out/ci')},timeout:180000});
  const o=(n.stdout||'')+(n.stderr||'');console.log(nom+' : '+o.trim());
  const mm=o.match(/ERRORS: (\[[\s\S]*\])/);const ee=mm?JSON.parse(mm[1]):null;
  if(n.status!==0||/SCRIPT ERROR/.test(o)||!/NAV OK/.test(o)||!ee||ee.length){console.log("\nUn écran n'est pas accessible sur "+nom+" : voir ci-dessus.");process.exit(1);}
  const rr=o.match(/NAV ROUTES (\S*)/);if(nom==='téléphone'&&(!rr||!py(['tools/site/check.py','--nav',rr[1]]))){console.log("\nLe site vitrine ne lit pas le même menu que l'app : voir ci-dessus.");process.exit(1);}
}
// 5) chaque écran du menu a sa leçon de « Prise en main » (js/lecons.js) : un nouveau module doit arriver avec sa formation
{
  const n=spawnSync(process.execPath,['tools/run.js','tools/lecons-test.js'],{encoding:'utf8',env:{...process.env,OUT:path.join(ROOT,'tools/out/ci')},timeout:180000});
  const o=(n.stdout||'')+(n.stderr||'');console.log('prise en main : '+o.trim());
  const mm=o.match(/ERRORS: (\[[\s\S]*\])/);const ee=mm?JSON.parse(mm[1]):null;
  if(n.status!==0||/SCRIPT ERROR/.test(o)||!/LECONS OK/.test(o)||!ee||ee.length){console.log("\nUn écran du menu n'a pas sa leçon de prise en main (ou une leçon est mal formée) : voir ci-dessus et l'en-tête de js/lecons.js.");process.exit(1);}
}
// 6) clavier à l'écran (js/clavier.js), téléphone et tablette : l'app s'arrête au clavier, le champ reste visible, la barre d'action
//    se pose sur le clavier, chaque champ a sa touche Entrée (tools/clavier-ui.js)
for(const [nom,env] of [['téléphone',{}],['tablette',{TABLET:'1'}]]){
  const n=spawnSync(process.execPath,['tools/run.js','tools/clavier-ui.js'],{encoding:'utf8',env:{...process.env,...env,OUT:path.join(ROOT,'tools/out/ci')},timeout:180000});
  const o=(n.stdout||'')+(n.stderr||'');console.log('clavier '+nom+' : '+(o.match(/CLAVIER (OK|KO)[\s\S]*/)||[o.trim()])[0]);
  const mm=o.match(/ERRORS: (\[[\s\S]*\])/);const ee=mm?JSON.parse(mm[1]):null;
  if(n.status!==0||/SCRIPT ERROR/.test(o)||!/CLAVIER OK/.test(o)||!ee||ee.length){console.log("\nSaisie au clavier cassée sur "+nom+" : voir ci-dessus et l'en-tête de js/clavier.js.");process.exit(1);}
}

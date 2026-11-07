// Captures for the site (site/img/<name>.jpg): demo, then each shot's steps, on a 390 × 844 phone at 600 px wide.
// Usage: node tools/site-shot.js [name ...]  then  python3 tools/landing-statusbar.py site/img/<name>.jpg && python3 tools/landing-homebar.py site/img/<name>.jpg
// OUT=<dir> writes elsewhere (to look at them first).
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const SHOTS={
 // l'addition plat par plat d'une table de la démo, deux plats choisis
 'plat-par-plat':async(p)=>{await p.evaluate(()=>{const t=SL.tabs.find(t=>t.status==='open'&&t.table==='3');go('salle',{id:t.id});});await p.waitForTimeout(1200);
  await p.evaluate(()=>ACT.slBill());await p.waitForTimeout(900);await p.$eval('.sl-sh.bill [data-act=slBillMode][data-v=plats]',e=>e.click());await p.waitForTimeout(700);
  await p.evaluate(()=>{const b=[...document.querySelectorAll('.sl-sh.bill [data-act=slBillPick]')].slice(0,2);b.forEach(x=>x.click());});await p.waitForTimeout(900);
  await p.evaluate(()=>{const m=document.querySelector('.sl-sh.bill [data-act=slBillMode][data-v=plats]');if(m){m.scrollIntoView({block:'start'});const sc=(function f(e){return !e||e===document.body?null:(e.scrollHeight>e.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)?e:f(e.parentElement));})(m);sc&&(sc.scrollTop-=150);}});await p.waitForTimeout(700);},
 // fiche d'une commande en ligne
 'commande-detail':async(p)=>{await p.evaluate(()=>go('commandes'));await p.waitForTimeout(1400);await p.click('.cm-o[data-id=dm3] .cm-items');await p.waitForTimeout(1400);},
 // demandes de l'équipe
 'demandes-rh':async(p)=>{await p.evaluate(()=>go('esDemandes'));await p.waitForTimeout(1600);},
 // marques et points de vente
 'marques':async(p)=>{await p.evaluate(()=>go('marques'));await p.waitForTimeout(1600);},
 // fidélité : cadeaux et VIP
 'fidelite':async(p)=>{await p.evaluate(()=>{FD.tab='fid';go('clients',{tab:'fid'});});await p.waitForTimeout(1600);},
 // heures sup. au planning
 'heures-sup':async(p)=>{await p.evaluate(()=>go('planning'));await p.waitForTimeout(1500);await p.evaluate(()=>{try{hsAttach();hsRun(true);}catch(e){}});await p.waitForTimeout(1500);
  await p.evaluate(()=>{const c=document.querySelector('.hs-hd');if(c){c.scrollIntoView({block:'start'});const v=document.querySelector('#viewport .view');v&&(v.scrollTop-=40);}});await p.waitForTimeout(800);},
 // journée et fermetures
 'journee':async(p)=>{await p.evaluate(()=>go('reglages'));await p.waitForTimeout(1200);await p.$eval('[data-act=jnOpen]',e=>e.click());await p.waitForTimeout(1400);},
 // coup de feu, clair
 'coup-de-feu':async(p)=>{await p.evaluate(()=>go('coupdefeu'));await p.waitForTimeout(2200);},
};
const want=process.argv.slice(2).length?process.argv.slice(2):Object.keys(SHOTS);
const OUT=process.env.OUT||path.join(ROOT,'site/img');
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
 if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');return r.end(fs.readFileSync(f));}r.statusCode=404;r.end();});
srv.listen(0,async()=>{const port=srv.address().port;const b=await chromium.launch();
 for(const name of want){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:600/390,isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic/,rt=>rt.fulfill({body:'',contentType:'text/css'}));
  const page=await ctx.newPage();page.on('pageerror',e=>console.log(name,'pageerror',e.message));
  await page.goto('http://localhost:'+port+'/?nointro');
  await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:10000});
  await page.$eval('#au.on [data-act=auDemo]',e=>e.click());await page.waitForTimeout(2600);
  await page.evaluate(()=>{const x=document.querySelector('#auDemo');x&&(x.style.display='none');document.documentElement.classList.remove('au-demomode');const st=document.createElement('style');st.textContent='#apPill,#puBans,#toast{display:none!important}';document.head.appendChild(st);});
  try{await SHOTS[name](page);}catch(e){console.log(name,'ERR',e.message);}
  const out=path.join(OUT,name+'.jpg');await page.screenshot({path:out,type:'jpeg',quality:86});console.log('saved',out);await ctx.close();}
 await b.close();srv.close();});

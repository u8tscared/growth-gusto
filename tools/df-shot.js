// Capture for the site (site/img/defis.jpg): demo → Défis d'équipe on a 390 × 844 phone at 600 px wide.
// Usage: node tools/df-shot.js && python3 tools/landing-statusbar.py site/img/defis.jpg && python3 tools/landing-homebar.py site/img/defis.jpg
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
 if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');return r.end(fs.readFileSync(f));}r.statusCode=404;r.end();});
srv.listen(0,async()=>{const port=srv.address().port;const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:600/390,isMobile:true,hasTouch:true});
 await ctx.route(/googleapis|gstatic/,rt=>rt.fulfill({body:'',contentType:'text/css'}));
 const page=await ctx.newPage();await page.goto('http://localhost:'+port+'/?nointro');
 await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:10000});
 await page.$eval('#au.on [data-act=auDemo]',e=>e.click());await page.waitForTimeout(2600);
 await page.evaluate(()=>{const x=document.querySelector('#auDemo');x&&(x.style.display='none');document.documentElement.classList.remove('au-demomode');go('defis');});await page.waitForTimeout(1600);
 await page.evaluate(()=>{const X=DF.demo;X.sales.push({p:X.P.cam,id:'',cat:'dessert',name:'Tarte Tatin',q:1,amount:8,at:Date.now()});dfPulse();});await page.waitForTimeout(400);
 const out=path.join(ROOT,'site/img/defis.jpg');await page.screenshot({path:out,type:'jpeg',quality:86});
 console.log('saved',out);await b.close();srv.close();});

// Test harness. Usage: node tools/run.js <script.js>
// The script exports async (page, shot, ctx) => {}. It serves the repo root statically.
// Env: UA=<user agent> (e.g. an iPhone one), DESKTOP=1 (1366x860, TABLET=1 820x1180 touch, else iPhone-size 390x844 touch), OUT=<dir for screenshots> (default tools/out).
// Prints "ERRORS: [...]" with page errors and console errors at the end.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');const OUT=path.resolve(process.env.OUT||path.join(__dirname,'out'));fs.mkdirSync(OUT,{recursive:true});
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
/* css/*.css are served as they go online: with their dark twins (tools/sombre.js, run by the firebase.json predeploy hook). RAW=1 serves the sources. */
const SB=require('./sombre.js');const prep=(f)=>{const b=fs.readFileSync(f);if(process.env.RAW||path.dirname(f)!==path.join(ROOT,'css')||!f.endsWith('.css'))return b;
 const n=path.basename(f);if(n==='sombre.css')return b.toString()+'\n'+SB.BUILT;return SB.SKIP_FILES.has(n)?b:SB.transform(b.toString()).css;};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
 if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');return r.end(prep(f));}r.statusCode=404;r.end();});
srv.listen(0,async()=>{const port=srv.address().port;const b=await chromium.launch();
 const opts=process.env.DESKTOP?{viewport:{width:1366,height:860}}:process.env.TABLET?{viewport:{width:820,height:1180},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true};
 const ctx=await b.newContext({...opts,...(process.env.UA?{userAgent:process.env.UA}:{}),permissions:['camera']});
 await ctx.route(/googleapis|gstatic/,rt=>rt.fulfill({body:'',contentType:'text/css'}));
 const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 await page.goto('http://localhost:'+port+'/');await page.waitForTimeout(800);
 const shot=async(n)=>page.screenshot({path:path.join(OUT,n+'.png')});
 try{await require(path.resolve(process.argv[2]))(page,shot,ctx);}catch(e){console.log('SCRIPT ERROR',e.message)}
 console.log('ERRORS:',JSON.stringify(errs,null,1));await b.close();srv.close();});

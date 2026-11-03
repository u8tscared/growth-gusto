// Test harness. Usage: node tools/run.js <script.js>
// The script exports async (page, shot, ctx) => {}. It serves the repo root statically.
// Env: DESKTOP=1 (1366x860, else iPhone-size 390x844 touch), OUT=<dir for screenshots> (default tools/out).
// Prints "ERRORS: [...]" with page errors and console errors at the end.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');const OUT=path.resolve(process.env.OUT||path.join(__dirname,'out'));fs.mkdirSync(OUT,{recursive:true});
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
 if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');return r.end(fs.readFileSync(f));}r.statusCode=404;r.end();});
srv.listen(0,async()=>{const port=srv.address().port;const b=await chromium.launch();
 const opts=process.env.DESKTOP?{viewport:{width:1366,height:860}}:{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true};
 const ctx=await b.newContext({...opts,permissions:['camera']});
 await ctx.route(/googleapis|gstatic/,rt=>rt.fulfill({body:'',contentType:'text/css'}));
 const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 await page.goto('http://localhost:'+port+'/');await page.waitForTimeout(800);
 const shot=async(n)=>page.screenshot({path:path.join(OUT,n+'.png')});
 try{await require(path.resolve(process.argv[2]))(page,shot,ctx);}catch(e){console.log('SCRIPT ERROR',e.message)}
 console.log('ERRORS:',JSON.stringify(errs,null,1));await b.close();srv.close();});

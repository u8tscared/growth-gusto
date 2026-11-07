// Renders icons/splash-WxH.jpg from the app's own boot screen, so the iOS launch image and the first app frame are identical.
// Usage: node tools/gen-splash.js   (prints the <link> tags for index.html)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
// [cssW, cssH, dpr, label]
const PHONES=[[440,956,3,'iPhone 16/17 Pro Max'],[430,932,3,'iPhone 14/15 Pro Max, 15/16 Plus'],[420,912,3,'iPhone Air'],[402,874,3,'iPhone 16/17 Pro, 17'],[393,852,3,'iPhone 14/15 Pro, 15, 16'],[428,926,3,'iPhone 12-14 Pro Max/Plus'],[390,844,3,'iPhone 12-14, 16e'],[375,812,3,'iPhone X/XS/11 Pro, 12/13 mini'],[414,896,3,'iPhone XS Max, 11 Pro Max'],[414,896,2,'iPhone XR, 11'],[414,736,3,'iPhone 8 Plus'],[375,667,2,'iPhone SE, 8']];
const PADS=[[1032,1376,2,'iPad Pro 13 M4'],[1024,1366,2,'iPad Pro 12.9'],[834,1210,2,'iPad Pro 11 M4'],[834,1194,2,'iPad Pro 11'],[820,1180,2,'iPad Air, iPad 10'],[744,1133,2,'iPad mini']];
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
 if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');return r.end(fs.readFileSync(f));}r.statusCode=404;r.end();});
srv.listen(0,async()=>{const port=srv.address().port;const b=await chromium.launch();const links=[];
 const jobs=[];PHONES.forEach(d=>jobs.push([...d,'portrait']));PADS.forEach(d=>{jobs.push([...d,'portrait']);jobs.push([d[1],d[0],d[2],d[3],'landscape'])});
 for(const [w,h,dpr,label,ori] of jobs){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  await ctx.route(/googleapis|gstatic/,rt=>rt.fulfill({body:'',contentType:'text/css'}));
  const p=await ctx.newPage();await p.goto('http://localhost:'+port+'/?nointro');await p.waitForTimeout(2200);
  await p.evaluate(()=>{const bt=document.getElementById('boot');bt.style.transition='none';bt.querySelector('.boot-ic').style.transition='none';bt.classList.remove('out','gone','gg-x');document.querySelectorAll('.tabbar,#app,.aurora').forEach(e=>e.style.visibility='hidden');});
  await p.waitForTimeout(300);
  const name=`splash-${w*dpr}x${h*dpr}.jpg`;
  await p.screenshot({path:path.join(ROOT,'icons',name),type:'jpeg',quality:90});
  const dw=ori==='landscape'?h:w,dh=ori==='landscape'?w:h;
  links.push(`<link rel="apple-touch-startup-image" href="icons/${name}" media="(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${ori})">`);
  await ctx.close();
 }
 fs.writeFileSync(path.join(__dirname,'splash-links.html'),links.join('\n')+'\n');console.log(links.length,'splashes');await b.close();srv.close();});

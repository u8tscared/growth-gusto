// Printer pipeline test: onboarding -> lots -> Imprimante screen -> label sheet -> print document (1 and 3 lots) -> QR roundtrip -> scan screen.
const fs=require('fs');const path=require('path');const {chromium}=require('playwright');
module.exports=async(page,shot,ctx)=>{const c=s=>page.$eval(s,e=>e.click());const OUT=path.resolve(process.env.OUT||path.join(__dirname,'out'));
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auLocal]')||(window.S&&S.ready),null,{timeout:8000}).catch(()=>{});
if(await page.$('#au.on [data-act=auLocal]')){await c('#au.on [data-act=auLocal]');await page.waitForTimeout(900);}
const set=async(id,v)=>page.evaluate(([id,v])=>{const e=document.getElementById(id);if(e){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}},[id,v]);
await set('obName','Chemin des Sarments');await page.evaluate(()=>ACT.obNext());await page.waitForTimeout(600);await set('obMe','Marceau');
await page.evaluate(()=>ACT.obCreate());await page.waitForTimeout(2500);await page.evaluate(()=>typeof ACT.obFinish==='function'&&ACT.obFinish());await page.waitForTimeout(900);
if(!(await page.evaluate(()=>!!S.resto)))throw new Error('no resto');
// lots: one plain (allergens via its product), one opened, one with a long name and own allergens
const ids=await page.evaluate(async()=>{const f=S.fridges[0]?.id||'';const now=Date.now();
 const pid=await DB.add('products',{name:'Crème fraîche 35 %',allergens:['lait'],unit:'L'});
 const a=await DB.add('lots',{name:'Crème fraîche 35 %',productId:pid,qty:'1',unit:'L',lot:'A1234',dlc:addDays(dayKey(),6),supplier:'Métro',fridgeId:f,status:'in',code:'GG-'+rid6(),createdAt:now,uid:S.me.id});
 const b=await DB.add('lots',{name:'Saumon fumé',productId:'',qty:'0,8',unit:'kg',lot:'L778',dlc:addDays(dayKey(),4),fridgeId:f,status:'opened',openedAt:now-3600e3,openedBy:S.me.id,dlcOpen:addDays(dayKey(),2),code:'GG-'+rid6(),createdAt:now-86400e3,uid:S.me.id});
 const d=await DB.add('lots',{name:'Fond de veau maison réduit aux herbes',productId:'',qty:'2',unit:'L',dlc:addDays(dayKey(),3),fridgeId:f,status:'in',allergens:['celeri','moutarde'],code:'GG-'+rid6(),createdAt:now,uid:S.me.id});
 return [a,b,d];});
await page.waitForTimeout(400);
// Imprimante screen
await page.evaluate(()=>go('imprimante'));await page.waitForTimeout(900);await shot('p1-imprimante-vide');
await c('[data-act=printerSet][data-v=ql810wc]');await page.waitForTimeout(500);
await c('[data-act=printerRoll][data-v=dk11209]');await page.waitForTimeout(400);
const cfg=await page.evaluate(()=>JSON.stringify(S.resto.printer));console.log('printer cfg',cfg);
if(!cfg.includes('ql810wc'))throw new Error('printer not saved');
await shot('p2-imprimante');
await page.$eval('.lb-faq summary',e=>e.click());await page.waitForTimeout(300);
await page.evaluate(()=>{window.scrollTo(0,99999);document.scrollingElement.scrollTop=99999;document.querySelectorAll('.view,#viewport,main').forEach(x=>x.scrollTop=99999);});
await page.waitForTimeout(400);await shot('p3-imprimante-bas');
await page.screenshot({path:path.join(OUT,'p3b-imprimante-full.png'),fullPage:true});
console.log('test mode after choosing a printer:',await page.evaluate(()=>lbTestMode()));
// compact block for the onboarding
await page.evaluate(()=>openSheet('<div class="h2" style="font-size:20px">Votre imprimante</div>'+lbPrinterStepHTML()));await page.waitForTimeout(600);await shot('p3c-onboard-block');
await c('[data-act=printerRoll][data-v=dk22205]');await page.waitForTimeout(300);console.log('roll via chip:',await page.evaluate(()=>S.resto.printer.roll+' '+document.querySelector('[data-lb=rollsub]').textContent));
await c('[data-act=printerRoll][data-v=dk11209]');await page.waitForTimeout(300);await page.evaluate(()=>closeSheet(true));
// PNG fallback still renders
const png=await page.evaluate(async(ids)=>{const b=await labelPng(ids.map(lbLot));return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(b);});},ids);fs.writeFileSync(path.join(OUT,'label-png-fallback.png'),Buffer.from(png,'base64'));
// test print (headless: print() is a no-op) must not throw
const t0=await page.evaluate(()=>Promise.race([ACT.lbPrintTest(document.querySelector('[data-act=lbPrintTest]')).then(()=>'done'),new Promise(r=>setTimeout(()=>r('timeout'),4000))]));console.log('test print:',t0);
console.log('last:',await page.evaluate(()=>document.querySelector('[data-lb=last]').textContent));
await page.evaluate(()=>lbPrintCleanup());
// lot sheet + label sheet
await page.evaluate(()=>go('frigos'));await page.waitForTimeout(600);
await page.evaluate((id)=>ACT.lot(null,id),ids[0]);await page.waitForTimeout(700);await shot('p4-lot');
await page.evaluate((id)=>ACT.lotLabel(null,id),ids[0]);await page.waitForTimeout(1700);await shot('p5-etiquette');
await page.evaluate((ids)=>openLabel(ids),ids);await page.waitForTimeout(1700);await shot('p6-etiquettes3');
const dry1=await page.evaluate((ids)=>lbPrint(ids.map(lbLot),{dry:true}),ids.slice(0,1));const dry3=await page.evaluate((ids)=>lbPrint(ids.map(lbLot),{dry:true}),ids);
console.log('dry pages',dry1,dry3);if(dry1!==1||dry3!==3)throw new Error('bad page count');
if(await page.evaluate(()=>!!document.querySelector('.lb-pframe')))throw new Error('frame not cleaned');
// real print path (headless: no dialog shows)
const real=await page.evaluate((ids)=>Promise.race([lbPrint(ids.map(lbLot)),new Promise(r=>setTimeout(()=>r('hang'),5000))]),ids.slice(0,1));console.log('real print:',real);
await page.evaluate(()=>lbPrintCleanup());
// print documents for 1 and 3 lots, each roll: screenshot at label size, count PDF pages, check overflow
const base='http://localhost:'+new URL(page.url()).port+'/';
for(const roll of ['dk11209','dk22205','dk11201']){
 await page.evaluate(async(r)=>{await lbPrinterSave({roll:r});},roll);await page.waitForTimeout(200);
 for(const n of (roll==='dk11209'?[1,3]:[3])){const html=await page.evaluate((ids)=>lbPrintDoc(ids.map(lbLot)),ids.slice(0,n));
  fs.writeFileSync(path.join(OUT,`print-${roll}-${n}.html`),html);
  const b=await chromium.launch();const pctx=await b.newContext({viewport:{width:360,height:140},deviceScaleFactor:3});
  await pctx.route(/googleapis|gstatic/,rt=>rt.fulfill({body:'',contentType:'text/css'}));
  const pp=await pctx.newPage();const perr=[];pp.on('pageerror',e=>perr.push(e.message));pp.on('console',m=>{if(m.type()==='error')perr.push(m.text())});
  await pp.goto(base+path.relative(path.resolve(__dirname,'..'),path.join(OUT,`print-${roll}-${n}.html`)),{waitUntil:'load'});
  await pp.emulateMedia({media:'print'});await pp.waitForTimeout(400);
  const pages=await pp.$$('.lb-page');for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:path.join(OUT,`label-${roll}-${n}-${i+1}.png`)});}
  const box=await pages[0].boundingBox();console.log(roll,n,'label box px',Math.round(box.width),Math.round(box.height),'pages',pages.length);
  const ov=await pp.evaluate(()=>[...document.querySelectorAll('.lb-tag .t > *')].map(e=>({c:e.className,sw:e.scrollWidth,cw:e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight})).filter(x=>x.sw>x.cw+1||x.sh>x.ch+1));
  if(ov.length)console.log('OVERFLOW',roll,n,JSON.stringify(ov));
  const fs2=await pp.evaluate(()=>{const px=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize)/96*72;return {namePt:px('.lb-tag .n').toFixed(1),datePt:px('.lb-tag .d').toFixed(1)}});console.log(roll,n,'pt sizes',JSON.stringify(fs2));
  const pdf=await pp.pdf({preferCSSPageSize:true,printBackground:true});const np=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;console.log(roll,n,'pdf pages',np);if(np!==n)throw new Error('pdf page count '+np+' for '+n);
  if(n===1)fs.writeFileSync(path.join(OUT,`print-${roll}-1.pdf`),pdf);
  if(perr.length)console.log('PRINTDOC ERRORS',perr);await b.close();}}
await page.evaluate(async()=>{await lbPrinterSave({roll:'dk11209'});});
// QR roundtrip: qrcode.js -> canvas -> jsQR
const rt=await page.evaluate(()=>{const txt='GG-'+rid6();const q=qrcode(0,'M');q.addData(txt);q.make();const n=q.getModuleCount(),s=8,c=document.createElement('canvas');c.width=c.height=(n+8)*s;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))g.fillRect((x+4)*s,(y+4)*s,s,s);const d=g.getImageData(0,0,c.width,c.height);const r=jsQR(d.data,d.width,d.height);return {txt,got:r&&r.data};});
console.log('qr roundtrip',JSON.stringify(rt));if(rt.got!==rt.txt)throw new Error('QR roundtrip failed');
// the label's QR SVG (what gets printed) decodes too
const rt2=await page.evaluate(async(id)=>{const l=lbLot(id);const div=document.createElement('div');div.innerHTML=lbTagHtml(l);const svg=div.querySelector('svg');svg.setAttribute('width',300);svg.setAttribute('height',300);const img=new Image();const u=URL.createObjectURL(new Blob([svg.outerHTML],{type:'image/svg+xml'}));await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=u;});const c=document.createElement('canvas');c.width=c.height=300;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,300,300);g.drawImage(img,0,0,300,300);const d=g.getImageData(0,0,300,300);const r=jsQR(d.data,300,300);return {code:l.code,got:r&&r.data};},ids[0]);
console.log('label qr',JSON.stringify(rt2));if(rt2.got!==rt2.code)throw new Error('label QR not decodable');
// scan screen with the fake camera
await page.evaluate(()=>closeSheet(true));await page.evaluate(()=>go('scan'));await page.waitForTimeout(600);
await page.evaluate(()=>ACT.lbRetry&&ACT.lbRetry());
const st=await page.waitForFunction(()=>{const s=document.querySelector('#lbStage');return s&&s.dataset.state&&s.dataset.state!=='starting'?s.dataset.state:false},null,{timeout:8000}).then(h=>h.jsonValue()).catch(()=>'?');
console.log('scan state',st);await page.waitForTimeout(800);await shot('p7-scan');
if(st!=='live')throw new Error('scanner not live with the fake camera: '+st);
// a code typed by hand still opens the lot
await page.evaluate((id)=>lookupCode(lbLot(id).code),ids[1]);await page.waitForTimeout(700);
const opened=await page.evaluate(()=>!!document.querySelector('#sheet.open .lb-lot'));console.log('lookup opens lot',opened);if(!opened)throw new Error('lookup failed');
await shot('p8-scan-lot');
};

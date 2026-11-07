// Ticket d'heures au départ + relevé PDF (js/rh.js). Usage : node tools/run.js tools/tk-ui.js  (DESKTOP=1 / TABLET=1 ; DARK=1)
const fs=require('fs');const path=require('path');const OUT=path.resolve(process.env.OUT||path.join(__dirname,'out'));
module.exports=async(page,shot,ctx)=>{
  await require('./smoke.js')(page,async()=>{});
  if(process.env.DARK){await page.evaluate(()=>localStorage.setItem('gg-theme','dark'));await page.reload();await page.waitForTimeout(1500);}
  await page.$eval('[data-gt=skip]',e=>e.click()).catch(()=>{});await page.waitForTimeout(300);
  /* capture the print documents instead of opening the system dialog */
  await page.evaluate(()=>{window.__docs=[];const o=rhPrintDoc;window.rhPrintDoc=async(html,title,opts)=>{window.__docs.push({html,title});return o(html,title,{dry:true});};});
  const sid=await page.evaluate(async()=>{
    const id=await DB.add('staff',{memberId:S.me.id,name:'Lucas Martin',role:'Commis',post:'cuisine',contract:'CDI',weeklyHours:35,hourlyGross:12.5,chargesPct:42,active:true,pinHash:rhPinHash('x','1')});
    await DB.update('staff',id,{pinHash:rhPinHash(id,'1234')});
    const t=dayKey();const at=(d,h,m)=>{const x=parseDay(d);x.setHours(h,m,0,0);return x.getTime();};
    for(let i=1;i<=9;i++){const d=addDays(t,-i);if(i%4===0)continue;await DB.add('punches',{staffId:id,kind:'in',at:at(d,9,58),day:d,by:'x'});await DB.add('punches',{staffId:id,kind:'out',at:at(d,15,4+i),day:d,by:'x'});}
    const now=Date.now();await DB.add('punches',{staffId:id,kind:'in',at:now-(7*60+29)*60000-30*60000,day:t,by:'x'});
    await DB.add('punches',{staffId:id,kind:'breakStart',at:now-4*3600e3,day:t,by:'x'});await DB.add('punches',{staffId:id,kind:'breakEnd',at:now-3.5*3600e3,day:t,by:'x'});
    await DB.add('shifts',{staffId:id,day:t,start:'09:00',end:'17:00',breakMin:30});
    return id;});
  await page.waitForTimeout(500);
  await page.evaluate(()=>go('pointeuse'));await page.waitForTimeout(900);console.log('MGR',await page.evaluate(()=>JSON.stringify({r:myRole(),m:rhIsMgr(),k:RH.kiosk,c:!!document.querySelector('.rh-card'),route:S.route})));await page.waitForTimeout(1200);await shot('tk-01-pointeuse');
  await page.evaluate((sid)=>ACT.rhTile(null,sid),sid);await page.waitForTimeout(400);
  for(const k of '1234'){await page.evaluate((k)=>ACT.rhKey(null,null,k),k);await page.waitForTimeout(170);}
  await page.waitForTimeout(700);await shot('tk-02-sheet');
  await page.$eval('[data-act=rhPunch][data-v=out]',e=>e.click());await page.waitForTimeout(1400);await shot('tk-03-depart');
  const txt=await page.$eval('#rhDone',e=>e.innerText);console.log('DONE:',txt.replace(/\n+/g,' | '));
  await page.$eval('#rhDone [data-act=rhTicket]',e=>e.click());await page.waitForTimeout(1500);
  /* PDF: the manager sheet, then this month */
  await page.evaluate(()=>ACT.rhPdf(null,'all'));await page.waitForTimeout(700);await shot('tk-04-pdfsheet');
  await page.$eval('[data-act=rhPdfPick][data-v=month]',e=>e.click());await page.waitForTimeout(1500);
  await page.evaluate(()=>go('moiHeures'));await page.waitForTimeout(800);await page.evaluate(()=>{const b=document.querySelector('.es-hrx');b&&b.scrollIntoView({block:'center'});});await page.waitForTimeout(500);await shot('tk-05-mesheures');
  const docs=await page.evaluate(()=>window.__docs);console.log('DOCS:',docs.map(d=>d.title));
  /* render the captured documents */
  const b=page.context().browser();const p2=await b.newPage({viewport:{width:500,height:900},deviceScaleFactor:2});
  for(const [i,d] of docs.entries()){await p2.setContent(d.html.replace(/<link[^>]+googleapis[^>]*>/,''));await p2.waitForTimeout(300);
    if(/Ticket/.test(d.title)){const el=await p2.$('.pg');await el.screenshot({path:path.join(OUT,'tk-06-ticket-'+i+'.png')});}
    else{await p2.pdf({path:path.join(OUT,'tk-07-releve.pdf'),format:'A4',preferCSSPageSize:true});await p2.setViewportSize({width:820,height:1160});await p2.screenshot({path:path.join(OUT,'tk-07-releve.png'),fullPage:true});}}
  /* compact ticket on the default die-cut 62 × 29 roll */
  const small=await page.evaluate((sid)=>{const T=rhTicketData(sid);return rhTicketDoc(T);},sid);
  await p2.setContent(small.replace(/<link[^>]+googleapis[^>]*>/,''));await p2.waitForTimeout(200);await (await p2.$('.pg')).screenshot({path:path.join(OUT,'tk-08-ticket-29mm.png')});
  const roll=await page.evaluate(()=>lbRoll());console.log('ROLL',JSON.stringify(roll));
  await page.evaluate(async()=>{await lbPrinterSave({roll:'dk22205'});});await page.waitForTimeout(300);
  const big=await page.evaluate((sid)=>rhTicketDoc(rhTicketData(sid)),sid);
  await p2.setContent(big.replace(/<link[^>]+googleapis[^>]*>/,''));await p2.waitForTimeout(200);await (await p2.$('.pg')).screenshot({path:path.join(OUT,'tk-09-ticket-62mm.png')});
  await p2.close();
};

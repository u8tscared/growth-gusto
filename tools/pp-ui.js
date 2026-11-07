// node tools/run.js tools/pp-ui.js (DESKTOP=1 / TABLET=1 too) : payer l'addition plat par plat.
// Démo → prise de commande → table 3 → Addition « Plat par plat » → un client touche ses plats → « Payé » → le reste baisse,
// ses plats sont cochés ; annuler ; écran client (plats cochés, reste) ; page client du QR (?r=demo&b=demo) « Mes plats » → payer → cochés.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);const fail=[];const ok=(b,m)=>{if(!b)fail.push(m);};
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2500);
await page.evaluate(()=>go('salle'));await W(1500);
const tid=await page.evaluate(()=>{const t=SL.tabs.find(t=>t.status==='open'&&t.table==='3');go('salle',{id:t.id});return t.id;});await W(1200);
await page.evaluate(()=>ACT.slBill());await W(800);
const tot=await page.evaluate(id=>slTotal(slItemsOk(slTabOf(id))),tid);console.log('total',tot);
await c('.sl-sh.bill [data-act=slBillMode][data-v=plats]');await W(400);
const rows=await page.evaluate(id=>slBillRows(slTabOf(id)).rows.map(r=>({rk:r.rk,q:r.q,u:r.u,left:r.left})),tid);console.log('rows',JSON.stringify(rows));
ok(rows.length>=2,'rows');
const multi=rows.find(r=>r.q>1)||rows[0],single=rows.find(r=>r!==multi)||rows[1];
// one of a dish served twice, and one other dish
await page.evaluate(v=>document.querySelector(`.sl-sh.bill [data-act=slBillPick][data-v="${CSS.escape(v)}"]`).click(),multi.rk);await W(200);
await page.evaluate(v=>document.querySelector(`.sl-sh.bill [data-act=slBillPick][data-v="${CSS.escape(v)}"]`).click(),single.rk);await W(300);
const sel=await page.evaluate(()=>({...SL.bill.sel}));console.log('sel',JSON.stringify(sel));ok(sel[multi.rk]===1,'pick one of multi');
const want=Math.round((multi.u+single.u*Math.min(1,single.q))*100)/100;
await page.evaluate(()=>{const e=document.querySelector('.sl-sh.bill .sl-partb');e&&e.scrollIntoView({block:'center'});});await W(200);await shot('pp-01-selection');
await c('.sl-sh.bill [data-act=slBillHow][data-v=especes]');await W(200);
await c('.sl-sh.bill [data-act=slBillPart]');await W(900);
const after=await page.evaluate(id=>{const t=slTabOf(id);return {parts:(t.parts||[]).map(p=>({amount:p.amount,how:p.how,lines:p.lines})),left:slBillLeft(t),rows:slBillRows(t).rows.map(r=>[r.rk,r.paid,r.left])};},tid);
console.log('after',JSON.stringify(after));ok(after.parts.length===1&&Math.abs(after.parts[0].amount-want)<0.001&&after.parts[0].how==='especes','part saved');ok(Math.abs(after.left-(tot-want))<0.001,'left');
ok(!!(await page.$('.sl-sh.bill .sl-parts .sl-part')),'parts list');ok(!!(await page.$('.sl-sh.bill .sl-btot.left')),'left shown');ok(!!(await page.$('.sl-sh.bill .sl-pd')),'paid tag');
await page.evaluate(()=>{document.querySelector('#sheetBody').scrollTop=0;});await W(200);await shot('pp-02-apres-paiement');
await page.evaluate(()=>{const e=document.querySelector('.sl-sh.bill .sl-parts');e&&e.scrollIntoView({block:'center'});});await W(200);await shot('pp-03-deja-regle');
// a second guest pays the rest of the multi dish: picking more than left is impossible (cycles back to none)
await page.evaluate(v=>{const e=document.querySelector(`.sl-sh.bill [data-act=slBillPick][data-v="${CSS.escape(v)}"]`);e&&e.click();},multi.rk);await W(150);
await page.evaluate(v=>{const e=document.querySelector(`.sl-sh.bill [data-act=slBillPick][data-v="${CSS.escape(v)}"]`);e&&e.click();},multi.rk);await W(150);
const s2=await page.evaluate(v=>SL.bill.sel[v]||0,multi.rk);console.log('cap sel',s2,'left',multi.q-1);ok(s2<=multi.q-1,'cap');
await page.evaluate(()=>ACT.slBillClear());await W(200);
// undo the payment from the list, then pay again (keeps one part for the screens below)
await c('.sl-sh.bill [data-act=slBillUnpart]');await W(700);ok(await page.evaluate(id=>(slTabOf(id).parts||[]).length,tid)===0,'unpart');
await page.evaluate(v=>document.querySelector(`.sl-sh.bill [data-act=slBillPick][data-v="${CSS.escape(v)}"]`).click(),multi.rk);await W(200);
await c('.sl-sh.bill [data-act=slBillPart]');await W(800);
// live: an online payment for other dishes arrives while the sheet is open
await page.evaluate(id=>{const t=slTabOf(id);const r=slBillRows(t).rows.find(r=>r.left>0&&r.rk!==t.parts[0].lines[0].rk);DB.set('billPays','dpx1',{tabId:id,table:t.table,amount:r.u,status:'paye',at:Date.now(),paidAt:Date.now(),lines:[{rk:r.rk,q:1}]});},tid);await W(1200);
const live=await page.evaluate(id=>({left:slBillLeft(slTabOf(id)),online:document.querySelectorAll('.sl-sh.bill .sl-part').length,txt:(document.querySelector('.sl-sh.bill .sl-btot.left b')||{}).textContent}),tid);console.log('live',JSON.stringify(live));ok(live.online===2,'live online pay in sheet');
await page.evaluate(()=>{document.querySelector('#sheetBody').scrollTop=0;});await W(200);await shot('pp-04-en-direct');
// écran client
await page.evaluate(()=>closeSheet(true));await W(300);
await page.evaluate(id=>{DB.set('ecran','demo',{name:'Comptoir',seenAt:Date.now(),show:'bill',tabId:id,table:'3',split:0,at:Date.now()});go('ecran');},tid);await W(1500);
const ec=await page.evaluate(()=>({pd:document.querySelectorAll('.ap-lines .pd,.ap-lines span i').length,left:!!document.querySelector('.ap-tot.left')}));console.log('ecran',JSON.stringify(ec));ok(ec.pd>0&&ec.left,'ecran ticks');
await shot('pp-05-ecran-client');
// the customer's phone: ?r=demo&b=demo&k=0…
await page.goto(page.url().replace(/\/[^/]*$/,'/')+'commande/?r=demo&b=demo&k='+'0'.repeat(32));await W(1800);
await c('[data-a=billHow][data-v=plats]');await W(300);await shot('pp-06-client-mes-plats');
const rk=await page.$$eval('[data-a=billPick]',b=>b.map(x=>x.dataset.v));console.log('client rows',rk.length);ok(rk.length>=3,'client rows');
await page.evaluate(v=>document.querySelector(`[data-a=billPick][data-v="${CSS.escape(v)}"]`).click(),rk[2]);await W(200);
await page.evaluate(v=>document.querySelector(`.qm-pkb[data-v="${CSS.escape(v)}"]`).click(),rk[2]);await W(200);
await page.evaluate(v=>document.querySelector(`.qm-pkb[data-v="${CSS.escape(v)}"]`).click(),rk[0]);await W(300);
const btn=await page.$eval('[data-a=billGo]',b=>b.textContent.trim());console.log('pay btn',btn);ok(/Payer 48,50/.test(btn),'client amount 2×22+4,5');
await page.evaluate(()=>{const e=document.querySelector('.qm-pk.on');e&&e.scrollIntoView({block:'center'});});await W(200);await shot('pp-07-client-choix');
await c('[data-a=billTip][data-v="10"]');await W(200);
const btn2=await page.$eval('[data-a=billGo]',b=>b.textContent.trim());console.log('with tip',btn2);ok(/Payer 53,40/.test(btn2),'tip 10%');
await page.evaluate(()=>{const e=document.querySelector('[data-a=billGo]');e&&e.scrollIntoView({block:'center'});});await W(200);await shot('pp-08-client-pourboire');
await c('[data-a=billGo]');await W(2200);
const pd=await page.evaluate(()=>({tags:document.querySelectorAll('.qm-pd').length,left:(document.querySelector('.qm-tk-t.left b')||{}).textContent}));console.log('client paid',JSON.stringify(pd));ok(pd.tags>=2&&/69,50/.test(pd.left||''),'client paid ticks & left');
await page.evaluate(()=>window.scrollTo(0,0));await W(300);await shot('pp-09-client-paye');
console.log(fail.length?'PP KO '+JSON.stringify(fail):'PP OK');};

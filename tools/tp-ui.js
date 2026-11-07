// node tools/run.js tools/tp-ui.js (DESKTOP=1 / TABLET=1 too): demo → Pourboires (month, split, my share, journal) → add a cash tip → rule editor → last month (closed, paid) → bill with a tip in Prise de commande → Plus menu.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2600);
await page.evaluate(()=>{const x=document.querySelector('#auDemo');x&&(x.style.display='none');go('pourboires');});await W(1800);await shot('tp-01-mois');
console.log('calc',JSON.stringify(await page.evaluate(()=>{const v=tpView(tpMk());return {total:v.total,n:v.rows.length,groups:v.groups.map(g=>[g.t,g.pct,Math.round(g.eff),g.amt,g.el.map(m=>m.p.name+':'+m.h+'h:'+m.amt).join(' ')]),left:v.left,prev:tpMonthTotal(tpMk(-1)),closed:Object.keys(TP.months)}})));
await page.evaluate(()=>{const e=document.querySelector('.tp-split');e&&e.scrollIntoView();});await W(500);await shot('tp-02-repartition');
await page.evaluate(()=>{const e=document.querySelector('.tp-jr');e&&e.scrollIntoView();});await W(500);await shot('tp-03-journal');
await page.evaluate(()=>{document.querySelector('#viewport .view').scrollTop=0});
// tap a day
await page.evaluate(()=>{const b=[...document.querySelectorAll('.tp-bar:not(.fut)')].filter(b=>b.querySelector('i'));b[b.length-2]&&b[b.length-2].click();});await W(700);await shot('tp-04-jour');
await page.evaluate(()=>{const b=document.querySelector('.tp-bar.on');b&&b.click();});await W(400);
// add a cash tip
await c('.top [data-act=tpAdd]');await W(700);await c('#sheetBody [data-act=tpAddQ][data-v="20"]');await W(300);await shot('tp-05-ajout');
await c('#sheetBody [data-act=tpAddOk]');await W(1400);await shot('tp-06-ajoute');
// rule editor
await page.evaluate(()=>ACT.tpRule());await W(700);await shot('tp-07-regle');
await page.evaluate(()=>{const b=document.querySelector('#sheetBody [data-act=tpPct][data-id="0"][data-v="5"]');b&&b.click();});await W(400);await shot('tp-08-regle-faux');
await page.evaluate(()=>{const e=document.querySelector('#sheetBody .tp-who');e&&e.scrollIntoView();});await W(400);await shot('tp-09-qui');
await page.evaluate(()=>{const b=document.querySelector('#sheetBody [data-act=tpPre][data-v="70"]');b&&b.click();});await W(300);
await page.evaluate(()=>{const b=document.querySelector('#sheetBody [data-act=tpRuleOk]');b&&b.click();});await W(1200);await shot('tp-10-70-30');
// last month
await page.evaluate(()=>{document.querySelector('#viewport .view').scrollTop=0});await c('[data-act=tpMonth][data-v="-1"]');await W(1500);await shot('tp-11-mois-dernier');
await page.evaluate(()=>{const e=document.querySelector('.tp-split');e&&e.scrollIntoView();});await W(400);await shot('tp-12-mois-dernier-parts');
await c('[data-act=tpMonth][data-v="1"]');await W(800);
// bill with a tip
await page.evaluate(()=>go('salle'));await W(1500);
const tab=await page.evaluate(()=>{const t=(SL.tabs||[]).find(x=>x.status==='open'&&(x.items||[]).length);return t&&t.id});
console.log('tab',tab);
if(tab){await page.evaluate((id)=>go('salle',{id}),tab);await W(1300);await page.evaluate(()=>ACT.slBill());await W(800);await shot('tp-13-addition');
 await page.evaluate(()=>{const b=document.querySelector('#sheetBody [data-act=tpBillAmt][data-v="5"]');b&&b.click();});await W(400);
 await page.evaluate(()=>{const e=document.querySelector('#sheetBody .tp-bill');e&&e.scrollIntoView({block:'center'});});await W(300);await shot('tp-14-addition-5');
 const n0=await page.evaluate(()=>TP.rows.length);
 await page.evaluate(()=>{const b=document.querySelector('#sheetBody [data-act=slClose]');b&&b.click();});await W(2600);await shot('tp-15-liberee');
 console.log('tips before/after',n0,await page.evaluate(()=>TP.rows.length),await page.evaluate(()=>JSON.stringify(TP.rows.slice().sort((a,b)=>b.at-a.at)[0])));
}
// as an employee (Sarah)
await page.evaluate(()=>{esDemoBecome('demo-sarah');go('pourboires');});await W(1500);await shot('tp-17-sarah');
await page.evaluate(()=>{const e=document.querySelector('.tp-split');e&&e.scrollIntoView();});await W(400);await shot('tp-18-sarah-parts');
await page.evaluate(()=>go('more'));await W(1200);
console.log('in plus',await page.evaluate(()=>!!document.querySelector('[data-go=pourboires]')));
await page.evaluate(()=>{const e=document.querySelector('[data-go=pourboires]');e&&e.scrollIntoView({block:'center'});});await W(400);await shot('tp-16-plus');
};

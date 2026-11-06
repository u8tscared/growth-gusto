// node tools/run.js tools/lv-ui.js (DESKTOP=1 too): demo → Livraison (4 weeks seeded) → Uber Eats sheet → import of a real-looking CSV → finance + tickets.
const path=require('path');
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2500);
await page.evaluate(()=>go('livraison'));await W(1600);await shot('lv-01-page');
await page.evaluate(()=>{const e=document.querySelector('.lv-dish');e&&e.scrollIntoView();});await W(300);await shot('lv-02-dishes');
await page.evaluate(()=>{const e=document.querySelector('.lv-honest');e&&e.scrollIntoView();});await W(300);await shot('lv-03-honest');
await c('[data-act=lvPf][data-v=ubereats]');await W(800);await shot('lv-04-sheet');
const [fc]=await Promise.all([page.waitForEvent('filechooser'),c('#sheetBody [data-act=lvImport]')]);
await fc.setFiles(path.join(__dirname,'import-samples/ubereats-paiements.csv'));await W(900);await shot('lv-05-import');
console.log('cols',JSON.stringify(await page.evaluate(()=>S.ui.lvI&&S.ui.lvI.cols)));
console.log('parse',JSON.stringify(await page.evaluate(()=>Object.entries(lvParse(S.ui.lvI)).map(([d,x])=>[d,x.gross,x.commission,x.net,x.orders,x.items.size]))));
await c('#sheetBody [data-act=lvImportGo]');await W(2500);await shot('lv-06-after');
console.log('days',JSON.stringify(await page.evaluate(()=>S.lvDays.filter(x=>x.file==='ubereats-paiements.csv').map(x=>[x.day,x.gross,x.commission,x.orders]))));
console.log('expenses',JSON.stringify(await page.evaluate(()=>(S.expenses||[]).filter(e=>e.cat==='commissions'&&e.day>='2026-11-03'&&e.day<='2026-11-04').map(e=>[e.id,e.amountHT]))));
await W(1500);console.log('tickets',JSON.stringify(await page.evaluate(()=>S.tickets.filter(t=>t.id&&t.id.startsWith('pos_ubereats_2026-11-0')).map(t=>[t.id,t.total,t.lines.length]))));
console.log('finance cat',await page.evaluate(()=>{try{const r=finExp('2026-10-01','2026-11-30');return JSON.stringify(r.byCat.commissions)}catch(e){return e.message}}));
// in the till already: sales removed, commissions kept
await c('[data-act=lvPf][data-v=ubereats]');await W(600);await c('#sheetBody [data-act=lvInPos]');await W(2500);await shot('lv-07-inpos');
console.log('sales after inPos',await page.evaluate(()=>S.cxSales.filter(s=>s.provider==='ubereats').length),'exp',await page.evaluate(()=>(S.expenses||[]).filter(e=>e.cat==='commissions'&&e.supplier==='Uber Eats').length));
await page.evaluate(()=>closeSheet());await W(300);await page.evaluate(()=>go('finance'));await W(1500);await page.evaluate(()=>{const e=document.querySelector('.fin-charges');e&&e.scrollIntoView();});await W(400);await shot('lv-08-finance');
await page.evaluate(()=>go('caisse'));await W(1200);await shot('lv-09-caisse');
await page.evaluate(()=>{const b=document.querySelector('[data-act=cxPickOn]');b&&b.click();});await W(800);await shot('lv-10-caisse-pick');
};

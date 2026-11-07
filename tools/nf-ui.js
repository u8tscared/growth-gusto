// node tools/run.js tools/nf-ui.js (DESKTOP=1 / TABLET=1 too): demo → prise de commande → addition « note de frais » → table réglée → facture ;
// tables réglées aujourd'hui → note après coup ; avoir ; liste.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2500);
await page.evaluate(()=>go('salle'));await W(1500);
await page.evaluate(()=>{const e=document.querySelector('.nf-flh');e&&e.scrollIntoView();});await W(300);await shot('nf-01-floor');
console.log('floor block',!!(await page.$('.nf-done-l')),'nav frais',await page.evaluate(()=>NAV.some(n=>n[0]==='frais')));
const tid=await page.evaluate(()=>{const t=SL.tabs.find(t=>t.status==='open'&&t.table==='3');go('salle',{id:t.id});return t.id;});await W(1200);
await page.evaluate(()=>ACT.slBill());await W(800);
await c('.sl-sh.bill [data-act=nfBToggle]');await W(500);await shot('nf-02-bill-on');
// close without company → refused
await c('.sl-sh.bill [data-act=slClose]');await W(500);console.log('still open',await page.evaluate(id=>slTabOf(id).status,tid));
await page.fill('.sl-sh.bill [data-k=company]','Atelier Lumière SAS');await page.fill('.sl-sh.bill [data-k=address]','4 quai Saint-Antoine, 69002 Lyon');
await page.evaluate(()=>{const e=document.querySelector('.sl-sh.bill .nf-fields');e&&e.scrollIntoView();});await W(300);await shot('nf-03-bill-filled');
console.log('build',JSON.stringify(await page.evaluate(id=>nfBuild(slTabOf(id),nfB(id)),tid)));
await c('.sl-sh.bill [data-act=slClose]');await W(1800);await shot('nf-04-facture');
console.log('closed',await page.evaluate(id=>slTabOf(id).status,tid),'inv',await page.evaluate(id=>{const n=nfOfTab(id);return n&&n.no+' '+n.total},tid));
await page.evaluate(()=>closeSheet());await W(400);
await page.evaluate(()=>{const e=document.querySelector('.nf-flh');e&&e.scrollIntoView();});await W(300);await shot('nf-05-floor-after');
await c('[data-act=nfTab]');await W(700);await shot('nf-06-after-sheet');
await page.fill('.nf-sh [data-k=company]','Lyon Conseil');await c('.nf-sh [data-act=nfBMode][data-v=detail]');await W(300);
await c('.nf-sh [data-act=nfIssue]');await W(1200);await shot('nf-07-detail');
await c('.nf-sh [data-act=nfAvoirAsk]');await W(500);await c('.nf-sh [data-act=nfAvoir]');await W(1000);await shot('nf-08-avoir');
await page.evaluate(()=>ACT.nfList());await W(600);await shot('nf-09-list');
console.log('notes',JSON.stringify(await page.evaluate(()=>NF.notes.map(n=>[n.no,n.kind,n.total,!!n.avoirId]))));
};

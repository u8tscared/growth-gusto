// node tools/run.js tools/nf-ui.js (DESKTOP=1 / TABLET=1 too): demo → Notes de frais (seeded) → open a note → new note libre 115 € / 3 → from a table (bill sheet button) → save.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2500);
await page.evaluate(()=>go('frais'));await W(1400);await shot('nf-01-list');
await c('[data-act=nfOpen]');await W(800);await shot('nf-02-sheet');
await page.evaluate(()=>closeSheet());await W(300);
await c('[data-act=nfNew]');await W(1000);
await c('[data-act=nfSrc][data-v=libre]');await W(500);
await page.fill('#nfTotal','115');await c('[data-act=nfCov][data-v="1"]');await W(300);await page.fill('#nfCo','Atelier Lumière');await W(400);
console.log('lines',JSON.stringify(await page.evaluate(()=>nfCompute(NF.F))));
await shot('nf-03-libre');
await page.evaluate(()=>{const e=document.querySelector('#nfPrevBox');e&&e.scrollIntoView();});await W(300);await shot('nf-04-preview');
await c('[data-act=nfSave]');await W(1500);await shot('nf-05-saved');
console.log('count',await page.evaluate(()=>NF.notes.length),await page.evaluate(()=>NF.notes[0].no+' '+NF.notes[0].total));
await page.evaluate(()=>closeSheet());await W(300);
// from a table bill
await page.evaluate(()=>{slWatch();const t=SL.tabs.find(t=>t.status==='open');go('salle',{id:t.id});});await W(1200);
await page.evaluate(()=>ACT.slBill());await W(800);await shot('nf-06-bill');
const has=await page.$('.sl-sh.bill [data-act=nfFromTab]');console.log('bill button',!!has);
if(has){await c('.sl-sh.bill [data-act=nfFromTab]');await W(1200);await shot('nf-07-fromtab');
 await c('[data-act=nfMode][data-v=detail]');await W(500);await shot('nf-08-detail');
 console.log('detail',JSON.stringify(await page.evaluate(()=>nfCompute(NF.F))));}
await page.evaluate(()=>go('more'));await W(900);console.log('in plus',!!(await page.$('[data-go=frais]')));
};

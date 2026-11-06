// node tools/run.js tools/rz-ui.js (DESKTOP=1 too): demo → Réservations → « Récupérer Zenchef » (3 tabs) → import of a pasted table.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2500);
await page.evaluate(()=>{S.resto.resaProvider='zenchef';go('resa');});await W(1400);
await page.evaluate(()=>{const e=document.querySelector('.rz-card');e&&e.scrollIntoView();});await W(300);await shot('rz-01-resa');
await c('.rz-card [data-act=rzOpen]');await W(900);await shot('rz-02-live');
await c('[data-act=rzTab][data-v=file]');await W(500);await shot('rz-03-file');
const k=(n)=>{const d=new Date(Date.now()+n*864e5);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;};
const tsv=['Référence\tDate\tHeure\tNom\tPrénom\tCouverts\tTéléphone\tStatut\tCommentaire',
 `Z101\t${k(1)}\t20:00\tMoreau\tLéa\t2\t06 22 33 44 55\tConfirmée\tTerrasse si possible`,
 `Z102\t${k(1)}\t20:30\tGirard\tTom\t5\t06 98 76 54 32\tConfirmée\tAllergie arachide`,
 `Z103\t${k(3)}\t12:30\tFaure\tInès\t3\t07 11 22 33 44\tConfirmée\t`,
 `Z104\t${k(-2)}\t12:30\tVieux\tPassé\t3\t07 11 22 33 45\tVenu\t`,
 `Z105\t${k(4)}\t19:45\tRoux\tNoé\t4\t07 55 66 77 88\tAnnulée\t`].join('\n');
await page.$eval('[data-rzpaste]',(e,v)=>{e.value=v;},tsv);await c('[data-act=rzRead]');await W(700);await shot('rz-04-preview');
const n=await page.evaluate(()=>RZ.res&&RZ.res.items.length);console.log('preview items',n,'past',await page.evaluate(()=>RZ.res&&RZ.res.past));
await c('[data-act=rzGo]');await W(1600);await shot('rz-05-after');
const got=await page.evaluate(()=>rsRows().filter(b=>b.ext).map(b=>[b.name,b.date,b.time,b.covers,b.source,b.table||'']));console.log('imported',JSON.stringify(got));
// re-import: nothing new
await page.evaluate(()=>rzOpen('zenchef','file'));await W(500);await page.$eval('[data-rzpaste]',(e,v)=>{e.value=v;},tsv.replace('\t20:30\tGirard','\t21:00\tGirard'));await c('[data-act=rzRead]');await W(700);
console.log('reimport',JSON.stringify(await page.evaluate(()=>RZ.res.items.map(x=>x.op+':'+x.b.name))));await shot('rz-06-reimport');
await c('[data-act=rzGo]');await W(1200);
await c('[data-act=rzTab][data-v=swap]').catch(()=>{});await page.evaluate(()=>rzOpen('zenchef','swap'));await W(700);await shot('rz-07-swap');
await page.evaluate(()=>closeSheet());await W(400);
// paste an e-mail
await page.evaluate(()=>rzOpen('zenchef','file'));await W(400);
await page.$eval('[data-rzpaste]',(e,v)=>{e.value=v;},`Nouvelle réservation\nNom : Jeanne Martin\nDate : ${k(2)}\nHeure : 19h30\nNombre de personnes : 2\nTéléphone : 06 00 11 22 33`);
await c('[data-act=rzRead]');await W(600);await page.evaluate(()=>closeSheet());await page.evaluate(()=>{R.day=Object.keys({}).length?R.day:rsRows().find(b=>b.ext).date;rerender();});await W(700);await page.evaluate(()=>{const e=document.querySelector('.rz-tag');e&&e.scrollIntoView({block:'center'});});await W(300);await shot('rz-08-card');console.log('email paste',JSON.stringify(await page.evaluate(()=>RZ.res.items.map(x=>x.op+':'+x.b.name+':'+x.b.time))));
};

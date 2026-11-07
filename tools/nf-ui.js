// node tools/run.js tools/nf-ui.js (DESKTOP=1 / TABLET=1 too): demo → prise de commande → addition « note de frais » → client habitué →
// N repas complets (total ÷ N, jamais plus que le ticket) → pourboire ligne à part / pas sur la note → table réglée → facture ;
// tables réglées aujourd'hui → note après coup ; avoir ; liste ; clients.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);const fail=[];const ok=(b,m)=>{if(!b)fail.push(m);};
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2500);
await page.evaluate(()=>go('salle'));await W(1500);
await page.evaluate(()=>{const e=document.querySelector('.nf-flh');e&&e.scrollIntoView();});await W(300);await shot('nf-01-floor');
console.log('floor block',!!(await page.$('.nf-done-l')),'nav frais',await page.evaluate(()=>NAV.some(n=>n[0]==='frais')));
const tid=await page.evaluate(()=>{const t=SL.tabs.find(t=>t.status==='open'&&t.table==='3');go('salle',{id:t.id});return t.id;});await W(1200);
await page.evaluate(()=>ACT.slBill());await W(800);
const tot=await page.evaluate(id=>nfTabData(slTabOf(id)).total,tid);console.log('table total',tot);
// tip 10 % first (pourboires block), then the note
const hasTip=!!(await page.$('.sl-sh.bill .tp-bill'));
if(hasTip){await page.evaluate(()=>{const b=[...document.querySelectorAll('.sl-sh.bill [data-act=tpBillAmt]')].find(x=>+x.dataset.v===5);b&&b.click();});await W(300);}
await c('.sl-sh.bill [data-act=nfBToggle]');await W(500);
console.log('order tip before note',await page.evaluate(()=>{const n=document.querySelector('.sl-sh.bill .nf-bill'),t=document.querySelector('.sl-sh.bill .tp-bill');return !t||!!(t.compareDocumentPosition(n)&4);}));
await shot('nf-02-bill-on');
// close without company → refused
await c('.sl-sh.bill [data-act=slClose]');await W(500);ok(await page.evaluate(id=>slTabOf(id).status,tid)==='open','closed without company');
// pick a regular client
await c('.sl-sh.bill [data-act=nfBClient][data-v=nfc1]');await W(300);
const B1=await page.evaluate(id=>({...nfB(id)}),tid);console.log('client filled',B1.company,B1.siren,B1.vatNo);ok(B1.company==='Atelier Lumière SAS'&&B1.siren==='884512376','client fill');
// meals: 1..N, sum always = ticket
for(const n of [1,2,3,7]){const r=await page.evaluate(([id,n])=>{const B=nfB(id);B.n=n;const d=nfBuild(slTabOf(id),B);return {meals:d.meals,sum:Math.round(d.lines.reduce((a,l)=>a+l.tot,0)*100)/100,total:d.total,lines:d.lines.map(l=>l.q+'x'+l.u+'@'+l.r)};},[tid,n]);console.log('N',n,JSON.stringify(r));ok(Math.abs(r.sum-r.total)<0.001&&r.meals===n,'sum N='+n);}
await page.evaluate(id=>{nfB(id).n=0;},tid);
// stepper down to 2
const cov=await page.evaluate(id=>nfTabData(slTabOf(id)).covers,tid);
for(let i=cov;i>2;i--){await c('.sl-sh.bill [data-act=nfBN][data-v="-1"]');await W(120);}
console.log('stepper N',await page.evaluate(id=>nfN(nfB(id).n,nfTabData(slTabOf(id))),tid),'shown',await page.$eval('.sl-sh.bill .nf-mt em',e=>e.textContent));
// cannot exceed: a stupid N is capped and still sums to the total
const cap=await page.evaluate(id=>{const t=slTabOf(id),B={...nfB(id),n:999};const d=nfBuild(t,B);return [d.meals,Math.round(d.lines.reduce((a,l)=>a+l.tot,0)*100)/100,d.total];},tid);console.log('cap',cap);ok(cap[1]===cap[2]&&cap[0]<=40,'cap');
await page.evaluate(()=>{const e=document.querySelector('.sl-sh.bill .nf-meals');e&&e.scrollIntoView({block:'center'});});await W(300);await shot('nf-03-meals');
if(hasTip){
  const t1=await page.evaluate(id=>{const d=nfBuild(slTabOf(id),nfB(id));return [d.tip,d.tipMode,d.total,d.rates.reduce((a,x)=>a+x.ttc,0)];},tid);console.log('tip ligne',t1);ok(t1[0]===5&&t1[1]==='ligne','tip ligne');ok(Math.abs(t1[3]-t1[2])<0.001,'tip not in VAT');
  await page.evaluate(()=>{const e=document.querySelector('.sl-sh.bill .nf-tip');e&&e.scrollIntoView({block:'center'});});await W(200);await shot('nf-04-tip-ligne');
  await c('.sl-sh.bill [data-act=nfBTip][data-v=non]');await W(300);
  const t2=await page.evaluate(id=>{const d=nfBuild(slTabOf(id),nfB(id));return [d.tip,d.tipMode,d.total];},tid);console.log('tip non',t2);ok(t2[0]===0&&t2[1]==='non','tip non');
  await shot('nf-05-tip-non');
  await c('.sl-sh.bill [data-act=nfBTip][data-v=ligne]');await W(300);
}
console.log('build',JSON.stringify(await page.evaluate(id=>nfBuild(slTabOf(id),nfB(id)),tid)));
await c('.sl-sh.bill [data-act=slClose]');await W(1800);await shot('nf-06-facture');
const inv=await page.evaluate(id=>{const n=nfOfTab(id);return n&&{no:n.no,total:n.total,tip:n.tip,meals:n.meals,client:n.clientId};},tid);console.log('closed',await page.evaluate(id=>slTabOf(id).status,tid),'inv',JSON.stringify(inv));ok(inv&&inv.meals===2,'invoice');
console.log('paper has tip',await page.evaluate(()=>!!document.querySelector('.nf-sh .nf-tots .tip')),'prestation',await page.evaluate(()=>/prestation de services/.test(document.querySelector('.nf-sh .nf-paper').textContent)));
await page.evaluate(()=>{const p=document.querySelector('.nf-sh .nf-paper');p&&(p.scrollTop=p.scrollHeight);});await W(200);await shot('nf-07-facture-bas');
console.log('client count',await page.evaluate(()=>NF.clients.find(c=>c.id==='nfc1').n));
await page.evaluate(()=>closeSheet());await W(400);
await page.evaluate(()=>{const e=document.querySelector('.nf-flh');e&&e.scrollIntoView();});await W(300);await shot('nf-08-floor-after');
await c('[data-act=nfTab]');await W(700);
await page.fill('.nf-sh [data-k=company]','Brasserie Nouvelle SARL');await page.fill('.nf-sh [data-k=vatNo]','FR40123456789');await W(200);
console.log('siren from vat',await page.$eval('.nf-sh [data-k=siren]',e=>e.value));
await shot('nf-09-after-sheet');
await c('.nf-sh [data-act=nfBMode][data-v=detail]');await W(300);
await c('.nf-sh [data-act=nfIssue]');await W(1200);await shot('nf-10-detail');
console.log('new client saved',await page.evaluate(()=>NF.clients.some(c=>c.name==='Brasserie Nouvelle SARL'&&c.siren==='123456789')));
await c('.nf-sh [data-act=nfAvoirAsk]');await W(500);await c('.nf-sh [data-act=nfAvoir]');await W(1000);await shot('nf-11-avoir');
await page.evaluate(()=>ACT.nfList());await W(600);await shot('nf-12-list');
await page.evaluate(()=>ACT.nfClients());await W(600);await shot('nf-13-clients');
console.log('notes',JSON.stringify(await page.evaluate(()=>NF.notes.map(n=>[n.no,n.kind,n.total,n.tip||0,!!n.avoirId]))));
console.log('FAILS',JSON.stringify(fail));
};

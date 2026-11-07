// node tools/run.js tools/df-ui.js (DESKTOP=1 / TABLET=1 too): demo → Défis d'équipe (live leaderboard, ideas, trophies) → new challenge sheet → create → live ticks until the win.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());const W=(ms)=>page.waitForTimeout(ms);
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});
await c('#au.on [data-act=auDemo]');await W(2600);
await page.evaluate(()=>go('home'));await W(1500);await shot('df-01-home');
await page.evaluate(()=>go('defis'));await W(1800);await shot('df-02-defis');
console.log('live',JSON.stringify(await page.evaluate(()=>dfLive().map(d=>{const s=dfStats(d);return [d.title,s.v,s.goal,s.rows.map(r=>r.n+':'+r.v).join(' ')]}))));
await page.evaluate(()=>{const e=document.querySelector('.df-ideas');e&&e.scrollIntoView();});await W(400);await shot('df-03-ideas');
await page.evaluate(()=>{const e=document.querySelector('.df-shelf');e&&e.scrollIntoView();});await W(500);await shot('df-04-trophies');
await page.evaluate(()=>{document.querySelector('#viewport .view').scrollTop=0});
await c('.top [data-act=dfNew]');await W(700);await shot('df-05-new');
await c('#sheetBody [data-act=dfK][data-v=ca]');await W(400);await shot('df-06-new-ca');
await c('#sheetBody [data-act=dfK][data-v=vente]');await W(300);await c('#sheetBody [data-act=dfWhat][data-v=boisson]');await W(300);await c('#sheetBody [data-act=dfGoalSet][data-v="30"]');await W(300);
await c('#sheetBody [data-act=dfRewSet]');await W(300);
await page.evaluate(()=>{const e=document.querySelector('#sheetBody .df-go');e&&e.scrollIntoView();});await W(300);await shot('df-07-new-filled');
await c('#sheetBody [data-act=dfCreate]');await W(1500);await shot('df-08-created');
console.log('count',await page.evaluate(()=>DF.list.length));
// speed the demo up: a few ticks
for(let i=0;i<6;i++){await page.evaluate(()=>{dfDemoTick();dfDemoTick();dfPulse();});await W(700);}
await shot('df-09-live');
// force the win
await page.evaluate(()=>{const d=dfLive().find(x=>x.kind==='vente'&&x.what.v==='dessert');const X=DF.demo;for(let i=0;i<8;i++)X.sales.push({p:X.P.sarah,id:'',cat:'dessert',name:'Mousse au chocolat',q:1,amount:7,at:Date.now()});dfPulse();});
await W(1700);await shot('df-10-win');
for(let i=0;i<3;i++){await page.evaluate(()=>{const b=document.querySelector('#dfWin [data-act=dfWinClose]');b&&b.click();});await W(900);}
await page.evaluate(()=>go('salle'));await W(1500);await shot('df-11-salle');
await page.evaluate(()=>go('cuisine'));await W(1500);await shot('df-12-cuisine');
await page.evaluate(()=>go('defis'));await W(1200);
await page.evaluate(()=>{const b=document.querySelector('[data-act=dfMenu]');b&&b.click();});await W(700);await shot('df-13-menu');
await page.evaluate(()=>closeSheet());await W(300);
await page.evaluate(()=>go('more'));await W(1200);
console.log('in plus',await page.evaluate(()=>!!document.querySelector('[data-go=defis]')));
await page.evaluate(()=>{const e=document.querySelector('[data-go=defis]');e&&e.scrollIntoView({block:'center'});});await W(400);await shot('df-14-more');
};

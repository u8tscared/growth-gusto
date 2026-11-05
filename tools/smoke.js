// Welcome -> « Continuer sans compte » -> onboarding (js/onboard.js: name on step 1, first name on step 2) -> home -> relevé -> frigos.
// (A fresh device shows the accounts welcome screen, js/auth.js; opening the app with ?local=1 skips it too.)
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auLocal]')||(window.S&&S.ready),null,{timeout:8000}).catch(()=>{});
if(await page.$('#au.on [data-act=auLocal]')){await page.waitForTimeout(700);await shot('00-welcome');await c('#au.on [data-act=auLocal]');await page.waitForTimeout(900);}
await shot('01-onboarding');
const set=(id,v)=>page.evaluate(([id,v])=>{const e=document.getElementById(id);if(e){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}},[id,v]);
await set('obName','Chemin des Sarments');await page.evaluate(()=>ACT.obNext());await page.waitForTimeout(600);await set('obMe','Marceau');
await page.evaluate(()=>ACT.obCreate());await page.waitForTimeout(2500);
if(!(await page.evaluate(()=>!!S.resto)))throw new Error('onboarding did not create a restaurant');
await page.evaluate(()=>DB.add('fridges',{name:'Chambre froide',type:'cfp',min:0,max:4,order:0}));await page.waitForTimeout(400);
await page.evaluate(()=>ACT.obFinish());await page.waitForTimeout(900);
await shot('02-home');
await page.evaluate(()=>go('releve'));await page.waitForTimeout(800);await shot('03-releve');
await c('[data-act=saveReading]');await page.waitForTimeout(1200);await shot('04-releve-after');
if(!(await page.evaluate(()=>S.readings.length)))throw new Error('no reading saved');
await page.evaluate(()=>go('frigos'));await page.waitForTimeout(800);await shot('05-frigos');
};

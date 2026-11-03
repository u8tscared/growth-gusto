// Onboarding -> home -> relevé -> frigos. Onboarding fields live on separate steps, so set them directly.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());
await shot('01-onboarding');
await page.evaluate(()=>{const set=(id,v)=>{const e=document.getElementById(id);if(e){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}};set('obMe','Marceau');set('obName','Chemin des Sarments');});
await page.evaluate(()=>ACT.obCreate());await page.waitForTimeout(2500);
if(!(await page.evaluate(()=>!!S.resto)))throw new Error('onboarding did not create a restaurant');
await shot('02-home');
await page.evaluate(()=>go('releve'));await page.waitForTimeout(800);await shot('03-releve');
await c('[data-act=saveReading]');await page.waitForTimeout(1200);await shot('04-releve-after');
if(!(await page.evaluate(()=>S.readings.length)))throw new Error('no reading saved');
await page.evaluate(()=>go('frigos'));await page.waitForTimeout(800);await shot('05-frigos');
};

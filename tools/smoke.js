// Onboarding -> home -> relevé -> frigos. Click with $eval to avoid smooth-scroll timeouts.
module.exports=async(page,shot)=>{const c=s=>page.$eval(s,e=>e.click());
await shot('01-onboarding');await page.fill('#obMe','Marceau');await page.fill('#obName','Chemin des Sarments');await c('[data-act=obCreate]');await page.waitForTimeout(1500);await shot('02-home');
await page.evaluate(()=>go('releve'));await page.waitForTimeout(800);await shot('03-releve');
await c('[data-act=saveReading]');await page.waitForTimeout(1200);await shot('04-releve-after');
await page.evaluate(()=>go('frigos'));await page.waitForTimeout(800);await shot('05-frigos');
};

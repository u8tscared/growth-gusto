// UI test of the public « Comment nous avez-vous trouvés ? » page (avis/) in demo. node tools/run.js tools/avc-page.js
module.exports=async(page,shot)=>{
  const base=page.url().replace(/\/[^/]*$/,'/');
  await page.goto(base+'avis/?r=demo&b=x&k='+'a'.repeat(32));await page.waitForTimeout(1200);await shot('avc-1-etoiles');
  await page.$eval('[data-v="5"][data-a="rate"]',e=>e.click());await page.waitForTimeout(700);
  await page.$eval('[data-a="tag"][data-v="cuisine"]',e=>e.click());await page.$eval('[data-a="tag"][data-v="service"]',e=>e.click());
  await page.$eval('[data-a="wand"]',e=>e.click());await page.waitForTimeout(500);await shot('avc-2-cinq-etoiles');
  console.log('TEXT', await page.$eval('#avText',e=>e.value));
  await page.$eval('[data-a="send"]',e=>e.click());await page.waitForTimeout(1600);await shot('avc-3-merci-google');
  await page.$eval('[data-a="google"]',e=>e.click());await page.waitForTimeout(600);await shot('avc-4-google-demo');
  await page.$eval('[data-a="edit"]',e=>e.click());await page.waitForTimeout(400);
  await page.$eval('[data-v="2"][data-a="rate"]',e=>e.click());await page.waitForTimeout(600);
  await page.$eval('[data-a="tag"][data-v="attente"]',e=>e.click());await page.fill('#avText','40 minutes pour le plat, et personne ne nous a prévenus.');await shot('avc-5-deux-etoiles');
  await page.$eval('[data-a="send"]',e=>e.click());await page.waitForTimeout(1600);await shot('avc-6-merci-prive');
  await page.goto(base+'avis/?r=demo&n=4');await page.waitForTimeout(1200);await shot('avc-7-anonyme-4');
};

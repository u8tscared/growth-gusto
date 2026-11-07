// node tools/run.js tools/clavier-ui.js (TABLET=1 too): on-screen keyboard (js/clavier.js), simulated with KB.sim(px) since a headless
// browser has no keyboard. Checks, on the sign-in screen, Réception (sticky CTA), a booking sheet and the product sheet, that with the
// keyboard up: the app box ends at the keyboard, the focused field is fully visible and not under a sticky bar, the CTA rests on the
// keyboard, and every text field got its Enter key (enterkeyhint). Prints "CLAVIER OK" or the problems.
module.exports=async(page,shot)=>{const W=(ms)=>page.waitForTimeout(ms);const tab=!!process.env.TABLET;const KBH=tab?398:336;const bad=[];
const check=async(name,sel,cta)=>{await page.evaluate(([s])=>{const e=document.querySelector(s);e&&e.focus();},[sel]);await page.evaluate((h)=>KB.sim(h),KBH);await W(700);
 const r=await page.evaluate(([s,c])=>{const e=document.querySelector(s);if(!e)return{miss:1};const H=document.documentElement.clientHeight;const b=document.body.getBoundingClientRect();const er=e.getBoundingClientRect();
  const x=er.left+er.width/2,y=er.top+Math.min(er.height-2,er.height/2);const hit=document.elementFromPoint(x,y);const ok=hit&&(hit===e||e.contains(hit)||hit.contains(e)||(hit.closest&&hit.closest('label')===e.closest('label')));
  const cr=c?document.querySelector(c):null;const crr=cr?cr.getBoundingClientRect():null;
  const noHint=[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]):not([type=date]):not([type=time]):not([type=color])')].filter(i=>i.getClientRects().length&&!i.getAttribute('enterkeyhint')).map(i=>i.id||i.getAttribute('placeholder')||'?');
  return{kb:document.documentElement.classList.contains('kb'),H,bodyB:Math.round(b.bottom),top:Math.round(er.top),bot:Math.round(er.bottom),visible:ok,cta:crr?{top:Math.round(crr.top),bot:Math.round(crr.bottom)}:null,noHint,hint:e.getAttribute('enterkeyhint')}},[sel,cta]);
 await shot('kb-'+name);
 const lim=r.H-KBH;const p=[];if(r.miss)p.push('champ introuvable '+sel);else{if(!r.kb)p.push('html.kb absent');if(Math.abs(r.bodyB-lim)>2)p.push('app box '+r.bodyB+' au lieu de '+lim);if(r.bot>lim||r.top<0||!r.visible)p.push('champ caché ('+r.top+'→'+r.bot+', visible '+r.visible+')');
  if(cta&&r.cta&&r.cta.bot>0&&(r.cta.bot>lim+1||r.cta.bot<lim-90))p.push('barre d\'action pas sur le clavier '+JSON.stringify(r.cta));if(r.noHint.length)p.push('sans touche Entrée: '+r.noHint.join(', '));}
 console.log(name,JSON.stringify(r));if(p.length)bad.push(name+': '+p.join(' ; '));
 await page.evaluate(()=>{KB.sim(0);document.activeElement&&document.activeElement.blur&&document.activeElement.blur();});await W(400);};
await page.waitForFunction(()=>document.querySelector('#au.on [data-act=auDemo]'),null,{timeout:8000});await W(600);
// sign-in screen: e-mail field
const em=await page.evaluate(()=>{const e=document.querySelector('#au.on input[type=email]');return e?'#'+e.id:null});
if(em)await check('connexion',em,null);else{await page.evaluate(()=>{const b=document.querySelector('#au.on [data-act=auMail],#au.on [data-act=auEmail]');b&&b.click();});await W(800);const e2=await page.evaluate(()=>{const e=document.querySelector('#au.on input[type=email]');return e?'#'+e.id:null});if(e2)await check('connexion',e2,null);}
await page.evaluate(()=>{const b=document.querySelector('#au.on [data-act=auDemo]');b&&b.click();});await W(2600);
await page.evaluate(()=>{const x=document.querySelector('#auDemo');x&&(x.style.display='none');go('reception');});await W(1500);
await page.evaluate(()=>{const b=document.querySelector('[data-act=recStart],[data-act=recNew]');b&&b.click();});await W(900);
const recSel=await page.evaluate(()=>{const e=document.querySelector('#recSupIn,#recName,#recQty');return e?'#'+e.id:null});
if(recSel)await check('reception',recSel,'.rec-cta');else bad.push('reception: aucun champ');
await page.evaluate(()=>{const i=document.querySelector('#recSupIn');if(i){i.value='Marée Atlantique';i.dispatchEvent(new Event('input',{bubbles:true}));ACT.recSupGo();}});await W(1000);
if(await page.$('#recQty'))await check('reception-quantite','#recQty','.rec-cta');else bad.push('reception: pas de champ quantité');
await page.evaluate(()=>go('resa'));await W(1200);await page.evaluate(()=>ACT.rsNew());await W(900);
await check('resa-nom','[data-rsed="name"]',null);await check('resa-email','[data-rsed="email"]',null);
await page.evaluate(()=>closeSheet());await W(600);
await page.evaluate(()=>{go('stock');});await W(1200);await page.evaluate(()=>openSheet(stkProdSheet({},true)));await W(900);
await check('produit-nom','#pName',null);await check('produit-fournisseur','#pSup',null);
console.log(bad.length?'CLAVIER KO\n'+bad.join('\n'):'CLAVIER OK');};

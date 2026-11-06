// Firestore rules for consignes and discussion groups (js/consignes.js), against the emulator. Same setup as tools/rules.test.js:
// cp firestore.rules . && npx firebase emulators:exec --only firestore --project demo-cs "node consignes.rules.test.js"
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,deleteDoc,getDoc,writeBatch,arrayUnion}=require('firebase/firestore');
const fs=require('fs');let pass=0,fail=0;
const t=async(n,p)=>{try{await p;pass++;console.log('ok  ',n)}catch(e){fail++;console.log('FAIL',n,e.message.slice(0,160))}};
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-cs',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8085}});
 await env.withSecurityRulesDisabled(async(c)=>{const d=c.firestore();await setDoc(doc(d,'restos/r1'),{name:'B',owner:'alice',plan:'essai'});
  await setDoc(doc(d,'restos/r1/members/alice'),{role:'gerant'});await setDoc(doc(d,'restos/r1/members/chef'),{role:'chef'});await setDoc(doc(d,'restos/r1/members/eq'),{role:'equipe'});
  await setDoc(doc(d,'restos/r1/consignes/c0'),{text:'x',uid:'chef'});});
 const A=env.authenticatedContext('alice').firestore(),C=env.authenticatedContext('chef').firestore(),E=env.authenticatedContext('eq').firestore(),Z=env.authenticatedContext('zed').firestore();
 await t('gerant posts consigne',assertSucceeds(setDoc(doc(A,'restos/r1/consignes/a1'),{text:'a',uid:'alice'})));
 await t('chef posts consigne (default)',assertSucceeds(setDoc(doc(C,'restos/r1/consignes/c1'),{text:'a',uid:'chef'})));
 await t('equipe cannot post consigne (default)',assertFails(setDoc(doc(E,'restos/r1/consignes/e1'),{text:'a',uid:'eq'})));
 await t('equipe reads consignes',assertSucceeds(getDoc(doc(E,'restos/r1/consignes/c0'))));
 await t('stranger cannot read consignes',assertFails(getDoc(doc(Z,'restos/r1/consignes/c0'))));
 await t('equipe marks read (csReads)',assertSucceeds(setDoc(doc(E,'restos/r1/csReads/c0~eq'),{cid:'c0',pid:'eq'})));
 await t('equipe cannot set csCfg',assertFails(updateDoc(doc(E,'restos/r1'),{csCfg:{writers:['eq']}})));
 await t('gerant sets csCfg',assertSucceeds(updateDoc(doc(A,'restos/r1'),{csCfg:{writers:['eq']}})));
 await t('equipe now posts',assertSucceeds(setDoc(doc(E,'restos/r1/consignes/e2'),{text:'a',uid:'eq'})));
 await t('chef no longer posts',assertFails(setDoc(doc(C,'restos/r1/consignes/c2'),{text:'a',uid:'chef'})));
 await t('chef still deletes own',assertSucceeds(deleteDoc(doc(C,'restos/r1/consignes/c1'))));
 await t('gerant creates group',assertSucceeds(setDoc(doc(A,'restos/r1/chatGroups/cuisine'),{name:'Cuisine',add:[],remove:[]})));
 await t('equipe cannot create group',assertFails(setDoc(doc(E,'restos/r1/chatGroups/g1'),{name:'X'})));
 await t('equipe reads groups',assertSucceeds(getDoc(doc(E,'restos/r1/chatGroups/cuisine'))));
 await t('equipe writes chat with group',assertSucceeds(setDoc(doc(E,'restos/r1/chat/m1'),{text:'x',uid:'eq',g:'cuisine'})));
 console.log(`\n${pass} ok, ${fail} échec(s)`);await env.cleanup();process.exit(fail?1:0);
})();

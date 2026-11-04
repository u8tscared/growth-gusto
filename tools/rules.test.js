// Firestore rules test (68 cases) against the emulator. From a folder with firebase.json {"emulators":{"firestore":{"port":8085}}} and @firebase/rules-unit-testing installed
// (e.g. /tmp/gg/v4-fb): cp firestore.rules . && npx firebase emulators:exec --only firestore --project demo-gg "node rules.test.js"
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,collection,query,where,getDocs,arrayUnion,increment}=require('firebase/firestore');
const fs=require('fs');let pass=0,fail=0;
const t=async(name,p)=>{try{await p;pass++;console.log('ok  ',name)}catch(e){fail++;console.log('FAIL',name,e.message.slice(0,160))}};
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-gg',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8085}});
 const db=(uid,tok={})=>env.authenticatedContext(uid,tok).firestore();
 const A=db('alice',{email:'alice@x.fr'}),B=db('bob'),C=db('carol'),Z=db('zed'),anon=env.unauthenticatedContext().firestore();
 const now=Date.now(),rid='r1';
 // 1 owner bootstrap
 await t('owner creates resto+membership+fridge in one batch',(()=>{const b=writeBatch(A);b.set(doc(A,'restos',rid),{name:'Bistrot',owner:'alice',createdAt:now,plan:'essai'});b.set(doc(A,`restos/${rid}/members/alice`),{name:'Alice',role:'gerant',joinedAt:now});b.set(doc(A,'users','alice'),{restos:arrayUnion(rid)},{merge:true});b.set(doc(A,`restos/${rid}/fridges/f1`),{name:'CF',min:0,max:4});b.set(doc(A,`restos/${rid}/events/e1`),{type:'team',text:'x',at:now,uid:'alice'});return assertSucceeds(b.commit())})());
 await t('cannot create resto owned by someone else',assertFails(setDoc(doc(Z,'restos','r2'),{name:'X',owner:'alice'})));
 await t('cannot self-add as gerant to someone else resto',assertFails(setDoc(doc(Z,`restos/${rid}/members/zed`),{role:'gerant',name:'Z'})));
 await t('stranger cannot read resto',assertFails(getDoc(doc(Z,'restos',rid))));
 await t('stranger cannot read fridges',assertFails(getDocs(collection(Z,`restos/${rid}/fridges`))));
 await t('stranger cannot write readings',assertFails(setDoc(doc(Z,`restos/${rid}/readings/x`),{v:1})));
 await t('member reads resto',assertSucceeds(getDoc(doc(A,'restos',rid))));
 await t('member writes reading',assertSucceeds(setDoc(doc(A,`restos/${rid}/readings/r1`),{value:2})));
 await t('user cannot read other users doc',assertFails(getDoc(doc(Z,'users','alice'))));
 // invites
 await t('gerant creates invite',assertSucceeds(setDoc(doc(A,'invites','CODE1234'),{rid,restoName:'Bistrot',role:'chef',createdBy:'alice',createdAt:now,expiresAt:now+7*864e5,uses:0})));
 await t('gerant creates expired invite (for test)',assertSucceeds(setDoc(doc(A,'invites','OLDCODE1'),{rid,restoName:'Bistrot',role:'equipe',createdBy:'alice',createdAt:now,expiresAt:now-1000,uses:0})));
 await t('anyone reads an invite by code',assertSucceeds(getDoc(doc(anon,'invites','CODE1234'))));
 await t('stranger cannot list invites',assertFails(getDocs(query(collection(Z,'invites'),where('rid','==',rid)))));
 await t('gerant lists invites of the resto',assertSucceeds(getDocs(query(collection(A,'invites'),where('rid','==',rid)))));
 await t('stranger cannot create invite for resto',assertFails(setDoc(doc(Z,'invites','HACK0001'),{rid,role:'gerant',createdBy:'zed',createdAt:now,expiresAt:now+1e9,uses:0})));
 await t('join with wrong role fails',(()=>{const b=writeBatch(Z);b.set(doc(Z,`restos/${rid}/members/zed`),{name:'Z',role:'gerant',joinedAt:now,invite:'CODE1234'});return assertFails(b.commit())})());
 await t('join with expired invite fails',(()=>{const b=writeBatch(Z);b.set(doc(Z,`restos/${rid}/members/zed`),{name:'Z',role:'equipe',joinedAt:now,invite:'OLDCODE1'});return assertFails(b.commit())})());
 await t('bob joins with valid invite (batch)',(()=>{const b=writeBatch(B);b.set(doc(B,`restos/${rid}/members/bob`),{name:'Bob',role:'chef',joinedAt:now,invite:'CODE1234'});b.set(doc(B,'users','bob'),{restos:arrayUnion(rid)},{merge:true});b.update(doc(B,'invites','CODE1234'),{uses:increment(1),lastUsedAt:now});b.set(doc(B,`restos/${rid}/events/e2`),{type:'team',at:now,uid:'bob'});return assertSucceeds(b.commit())})());
 await t('bob cannot bump uses by 5',assertFails(updateDoc(doc(B,'invites','CODE1234'),{uses:6})));
 await t('bob (chef) reads fridges',assertSucceeds(getDocs(collection(B,`restos/${rid}/fridges`))));
 await t('bob cannot promote himself',assertFails(updateDoc(doc(B,`restos/${rid}/members/bob`),{role:'gerant'})));
 await t('bob renames himself',assertSucceeds(updateDoc(doc(B,`restos/${rid}/members/bob`),{name:'Bobby'})));
 await t('chef cannot create invite',assertFails(setDoc(doc(B,'invites','CHEF0001'),{rid,role:'equipe',createdBy:'bob',createdAt:now,expiresAt:now+1e9,uses:0})));
 await t('chef cannot remove the owner',assertFails(deleteDoc(doc(B,`restos/${rid}/members/alice`))));
 await t('chef cannot rename the resto',assertFails(updateDoc(doc(B,'restos',rid),{name:'Hack'})));
 await t('chef can set the printer on the resto',assertSucceeds(updateDoc(doc(B,'restos',rid),{printer:'Brother'})));
 await t('gerant adds a kitchen profile',assertSucceeds(setDoc(doc(A,`restos/${rid}/members/m123`),{name:'Hugo',role:'equipe',joinedAt:now,pinH:'abc'})));
 await t('gerant promotes bob',assertSucceeds(updateDoc(doc(A,`restos/${rid}/members/bob`),{role:'gerant'})));
 await t('gerant bob cannot demote the owner',assertFails(updateDoc(doc(B,`restos/${rid}/members/alice`),{role:'equipe'})));
 await t('gerant bob cannot remove the owner',assertFails(deleteDoc(doc(B,`restos/${rid}/members/alice`))));
 await t('owner renames resto',assertSucceeds(updateDoc(doc(A,'restos',rid),{name:'Bistrot 2'})));
 await t('owner cannot hand ownership by update',assertFails(updateDoc(doc(A,'restos',rid),{owner:'zed'})));
 await t('gerant revokes invite',assertSucceeds(deleteDoc(doc(A,'invites','OLDCODE1'))));
 // carol: import (first batch, then the rest)
 await t('import batch 1',(()=>{const b=writeBatch(C);b.set(doc(C,'restos','r9'),{name:'Chez C',owner:'carol',createdAt:now,plan:'essai',importedAt:now});b.set(doc(C,'restos/r9/members/carol'),{role:'gerant',name:'C',joinedAt:now});b.set(doc(C,'users','carol'),{restos:arrayUnion('r9')},{merge:true});return assertSucceeds(b.commit())})());
 await t('import batch 2 (data + local profiles)',(()=>{const b=writeBatch(C);for(let i=0;i<50;i++)b.set(doc(C,`restos/r9/readings/x${i}`),{v:i});b.set(doc(C,'restos/r9/members/local'),{role:'gerant',name:'Paul'});b.set(doc(C,'restos/r9/members/m1'),{role:'equipe',name:'Léo'});return assertSucceeds(b.commit())})());
 await t('member leaves',assertSucceeds(deleteDoc(doc(B,`restos/${rid}/members/bob`))));
 await t('after leaving, no access',assertFails(getDoc(doc(B,'restos',rid))));
 // appFeedback
 await t('member sends app feedback',assertSucceeds(setDoc(doc(A,'appFeedback','a1'),{rid,uid:'alice',text:'Super',at:now})));
 await t('non-member cannot send feedback for that resto',assertFails(setDoc(doc(Z,'appFeedback','a2'),{rid,uid:'zed',text:'x'})));
 await t('cannot send as someone else',assertFails(setDoc(doc(A,'appFeedback','a3'),{rid,uid:'bob',text:'x'})));
 await t('team lists its feedback',assertSucceeds(getDocs(query(collection(A,'appFeedback'),where('rid','==',rid)))));
 await t('stranger cannot list all feedback',assertFails(getDocs(collection(Z,'appFeedback'))));
 const ADM=db('marc',{email:'marceau.ruis@gmail.com',email_verified:true});
 await t('admin lists all feedback',assertSucceeds(getDocs(collection(ADM,'appFeedback'))));
 await t('admin updates feedback',assertSucceeds(updateDoc(doc(ADM,'appFeedback','a1'),{status:'fait'})));
 const FAKE=db('fake',{email:'marceau.ruis@gmail.com',email_verified:false,firebase:{sign_in_provider:'password'}});
 await t('unverified admin e-mail is refused',assertFails(getDocs(collection(FAKE,'appFeedback'))));
 // ── commercial layer (js/abo.js) + admin space ──
 const FAKE2=db('fake2',{email:'marceau.ruis@gmail.com',email_verified:false,firebase:{sign_in_provider:'password'}});
 await t('member (equipe) cannot change plan/pack/trialEnds/paidUntil',(async()=>{await setDoc(doc(A,`restos/${rid}/members/dora`),{name:'Dora',role:'equipe',joinedAt:now});const D=db('dora');await assertFails(updateDoc(doc(D,'restos',rid),{plan:'complet'}));await assertFails(updateDoc(doc(D,'restos',rid),{trialEnds:now+9e9}));await assertFails(updateDoc(doc(D,'restos',rid),{paidUntil:now+9e9}));await assertFails(updateDoc(doc(D,'restos',rid),{pack:'complet'}));await assertSucceeds(updateDoc(doc(D,'restos',rid),{printer:'QL'}));})());
 await t('gerant activates a pack with a code (plan, pack, paidAt, activatedBy)',assertSucceeds(updateDoc(doc(A,'restos',rid),{plan:'complet',pack:'complet',paidAt:now,paidUntil:null,activatedBy:'alice@x.fr',activationCode:'GG-COMPLET-2026'})));
 await t('admin lists all restos',assertSucceeds(getDocs(collection(ADM,'restos'))));
 await t('admin gets a resto he is not a member of',assertSucceeds(getDoc(doc(ADM,'restos','r9'))));
 await t('admin lists all users',assertSucceeds(getDocs(collection(ADM,'users'))));
 await t('admin reads a user doc',assertSucceeds(getDoc(doc(ADM,'users','carol'))));
 await t('admin reads members of any resto',assertSucceeds(getDocs(collection(ADM,`restos/r9/members`))));
 await t('admin grants access (plan, pack, paidUntil, grantedBy, grantedAt)',assertSucceeds(updateDoc(doc(ADM,'restos','r9'),{plan:'essentiel',pack:'essentiel',paidAt:now,paidUntil:now+90*864e5,grantedBy:'marceau.ruis@gmail.com',grantedAt:now,suspended:null})));
 await t('admin extends the trial',assertSucceeds(updateDoc(doc(ADM,'restos','r9'),{plan:'essai',trialEnds:now+30*864e5})));
 await t('admin suspends',assertSucceeds(updateDoc(doc(ADM,'restos','r9'),{plan:'suspendu',suspended:{at:now,by:'marceau.ruis@gmail.com',plan:'essai',pack:'complet'}})));
 await t('admin restores',assertSucceeds(updateDoc(doc(ADM,'restos','r9'),{plan:'essai',suspended:null})));
 await t('admin cannot rename a resto',assertFails(updateDoc(doc(ADM,'restos','r9'),{name:'Hack'})));
 await t('admin cannot take ownership',assertFails(updateDoc(doc(ADM,'restos','r9'),{owner:'marc'})));
 await t('admin cannot mix allowed and forbidden keys',assertFails(updateDoc(doc(ADM,'restos','r9'),{plan:'complet',name:'Hack'})));
 await t('admin cannot write readings of a resto',assertFails(setDoc(doc(ADM,'restos/r9/readings/adm'),{v:1})));
 await t('admin cannot delete a resto',assertFails(deleteDoc(doc(ADM,'restos','r9'))));
 await t('admin cannot write a user doc',assertFails(updateDoc(doc(ADM,'users','carol'),{name:'x'})));
 await t('unverified admin e-mail cannot list restos',assertFails(getDocs(collection(FAKE2,'restos'))));
 await t('unverified admin e-mail cannot list users',assertFails(getDocs(collection(FAKE2,'users'))));
 await t('unverified admin e-mail cannot grant',assertFails(updateDoc(doc(FAKE2,'restos','r9'),{plan:'complet'})));
 await t('stranger cannot list restos',assertFails(getDocs(collection(Z,'restos'))));
 await t('stranger cannot list users',assertFails(getDocs(collection(Z,'users'))));
 await t('google admin (unverified flag absent) is accepted',assertSucceeds(getDocs(collection(db('marcg',{email:'marceau.ruis@gmail.com',firebase:{sign_in_provider:'google.com'}}),'restos'))));
 console.log(`\n${pass} passed, ${fail} failed`);await env.cleanup();process.exit(fail?1:0);
})();

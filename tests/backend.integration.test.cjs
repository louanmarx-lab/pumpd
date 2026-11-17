const {test,before}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {createRequire}=require('node:module');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Run this test through the Firebase emulator with the demo project.');
const req=createRequire(path.resolve('functions/package.json'));const {initializeApp,getApps}=req('firebase-admin/app');const {getFirestore}=req('firebase-admin/firestore');
if(!getApps().length)initializeApp({projectId:'demo-ripped-release'});const db=getFirestore();const accounts=new Set(['server_friend','server_peer','server_guest2','server_delete','server_partial','server_coach']);let fetchHook=null;
const fakeAuth={getUser:async id=>{if(!accounts.has(id))throw Object.assign(Error('Gone'),{code:'auth/user-not-found'});return{uid:id};},deleteUser:async id=>{accounts.delete(id);}};
process.env.REVENUECAT_SECRET_KEY='emulator-only';process.env.REVENUECAT_WEBHOOK_SECRET='emulator-only';
const wrappedDb=new Proxy(db,{get(target,prop){if(prop==='runTransaction')return callback=>target.runTransaction(t=>Promise.resolve(callback(t)));const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;}});
const backend={exports:{}};
vm.runInNewContext(fs.readFileSync('functions/index.js','utf8'),{module:backend,exports:backend.exports,process,console,Date,Buffer,fetch:async(url,options)=>{
 assert.ok(url.startsWith('https://api.revenuecat.com/v1/subscribers/'));if(fetchHook)return fetchHook(url,options);return{ok:true,status:200,json:async()=>({subscriber:{entitlements:{}}})};
},require:name=>name==='firebase-admin/firestore'?{...req(name),getFirestore:()=>wrappedDb}:name==='firebase-admin/app'?{initializeApp:()=>{}}:name==='firebase-admin/auth'?{getAuth:()=>fakeAuth}:name==='./domain'?require('../functions/domain'):req(name)});
const f=backend.exports;const auth=id=>({auth:{uid:id,token:{auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'password'},name:id}},data:{}});const invoke=(name,id,data={})=>f[name].run({...auth(id),data});
before(async()=>{
 await db.doc('users/server_coach').set({displayName:'Coach',accountType:'coach',serverEntitlements:{seatLimit:1,expiresAt:Date.now()+3600000},clients:[{id:'client_srv_A',type:'shadow',name:'Friend',macroTargets:{protein:130}},{id:'client_srv_B',type:'shadow',name:'Other'}]});
 await db.doc('users/server_friend').set({macroTargets:{protein:100},splits:[{id:'own_program'}]});
 await db.doc('users/server_peer').set({displayName:'Peer',accountType:'coach'});
});
test('server enforces seats, preserves athlete history, and rejects revoked invitation replay',async()=>{
 await invoke('registerShadowClient','server_coach',{clientId:'client_srv_A'});
 await assert.rejects(invoke('registerShadowClient','server_coach',{clientId:'client_srv_B'}),error=>error.code==='resource-exhausted');
 await db.doc('users/client_srv_A/nutrition/2026-11-11').set({id:'coach_day',userId:'client_srv_A',date:'2026-11-11',waterMl:2000,meals:[{id:'coach_meal'}]});
 await db.doc('users/server_friend/nutrition/2026-11-11').set({id:'own_day',userId:'server_friend',date:'2026-11-11',waterMl:100,meals:[{id:'own_meal'}]});
 await db.doc('users/client_srv_A/workouts/original').set({id:'original',userId:'client_srv_A',exercises:[]});
 const code=require('../functions/domain').roomCode();await invoke('publishCoachInvitation','server_coach',{clientId:'client_srv_A',code});
 await invoke('redeemCoachInvitation','server_friend',{code});await invoke('redeemCoachInvitation','server_friend',{code});
 const nutrition=(await db.doc('users/server_friend/nutrition/2026-11-11').get()).data();assert.equal(nutrition.waterMl,100);assert.equal(nutrition.meals.length,2);
 assert.equal((await db.doc('users/server_friend').get()).data().macroTargets.protein,100);assert.equal((await db.doc('users/server_friend').get()).data().splits[0].id,'own_program');
 assert.ok((await db.doc('users/server_friend/workouts/claimed_client_srv_A_original').get()).exists);
 await invoke('unlinkCoachClient','server_coach',{athleteId:'server_friend'});await assert.rejects(invoke('redeemCoachInvitation','server_friend',{code}));assert.equal((await db.doc('coach_links/server_friend').get()).exists,false);
});
test('server room admission is atomic and local accountType cannot impersonate a paid coach',async()=>{
 const room=await invoke('createWorkoutRoom','server_peer',{routineName:'Test',exerciseIds:[]});assert.equal(room.hostRole,'athlete');
 const results=await Promise.allSettled([invoke('workoutInvitation','server_friend',{code:room.roomPin,join:true}),invoke('workoutInvitation','server_guest2',{code:room.roomPin,join:true})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('deletion blocks in-flight billing refresh and removes auth plus owned/shared records',async()=>{
 await db.doc('users/server_delete').set({displayName:'Delete'});await db.doc('users/server_delete/workouts/one').set({id:'one'});await db.doc('shared_splits/delete_export').set({authorId:'server_delete'});
 let release;let fetchStarted;const started=new Promise(resolve=>fetchStarted=resolve);
 fetchHook=(url,options)=>{if(options.method==='DELETE')return{ok:true,status:200};fetchStarted();return new Promise(resolve=>{release=()=>resolve({ok:true,status:200,json:async()=>({subscriber:{entitlements:{coach:{product_identifier:'com.ripped.pt.pro.monthly',expires_date:new Date(Date.now()+3600000).toISOString()}}}})});});};
 const refreshing=invoke('refreshStoreEntitlements','server_delete');await started;
 await invoke('deleteMyAccount','server_delete');release();await refreshing;fetchHook=null;
 assert.equal(accounts.has('server_delete'),false);assert.equal((await db.doc('users/server_delete').get()).exists,false);assert.equal((await db.doc('shared_splits/delete_export').get()).exists,false);assert.ok((await db.doc('account_deletions/server_delete').get()).exists);
 await db.doc('account_deletions/server_delete').delete();await invoke('refreshStoreEntitlements','server_delete');assert.equal((await db.doc('users/server_delete').get()).exists,false);
});
test('failed provider cleanup stays visibly incomplete and can be retried',async()=>{
 await db.doc('users/server_partial').set({displayName:'Partial'});fetchHook=async()=>({ok:false,status:503});
 await assert.rejects(invoke('deleteMyAccount','server_partial'));assert.ok(accounts.has('server_partial'));assert.ok((await db.doc('account_deletions/server_partial').get()).exists);
 fetchHook=null;await invoke('deleteMyAccount','server_partial');assert.equal(accounts.has('server_partial'),false);
});
test('roster writes cannot forge a linked athlete or consume unpaid seats',async()=>{
 const result=await invoke('saveCoachRoster','server_coach',{clients:[{id:'client_srv_A',name:'Client',linkedUserId:'stranger',type:'linked',macroTargets:{calories:2000,protein:120,carbs:200,fats:70}}]});
 assert.equal(result.clients[0].linkedUserId,null);assert.equal(result.clients[0].type,'shadow');
 await assert.rejects(invoke('saveCoachRoster','server_peer',{clients:[{id:'client_fake',name:'Fake'}]}),error=>error.code==='permission-denied');
});

test('same-coach second invitation cannot orphan a live linked seat',async()=>{
 const until=Date.now()+3600000;
 await db.doc('users/relink_coach').set({serverEntitlements:{seatLimit:2,expiresAt:until},clients:[{id:'client_relink_A',linkedUserId:'relink_athlete'},{id:'client_relink_B'}]});
 await db.doc('users/relink_athlete').set({displayName:'Athlete'});
 await db.doc('coach_links/relink_athlete').set({coachId:'relink_coach',clientId:'client_relink_A'});
 await db.doc('coach_seats/relink_coach').set({activeIds:['client_relink_A','client_relink_B']});
 const code=require('../functions/domain').roomCode();await db.doc(`client_claims/${code}`).set({coachId:'relink_coach',clientId:'client_relink_B',expiresAt:until,claimed:false});
 await assert.rejects(invoke('redeemCoachInvitation','relink_athlete',{code}),error=>error.code==='failed-precondition');
 assert.equal((await db.doc('coach_links/relink_athlete').get()).data().clientId,'client_relink_A');
});
test('unlink and coach deletion preserve independently paid athlete access',async()=>{
 const until=Date.now()+3600000;
 for(const action of ['unlinkTrainer','unlinkCoachClient','deleteMyAccount']){
  const coach=`paid_coach_${action}`,athlete=`paid_athlete_${action}`;accounts.add(coach);accounts.add(athlete);
  await db.doc(`users/${coach}`).set({clients:[{id:`client_${action}`,linkedUserId:athlete}]});
  await db.doc(`users/${athlete}`).set({serverEntitlements:{tier:'athlete',expiresAt:until},linkedCoach:{coachId:coach}});
  await db.doc(`coach_links/${athlete}`).set({coachId:coach,clientId:`client_${action}`});
  await invoke(action,action==='unlinkTrainer'?athlete:coach,{athleteId:athlete});
  const profile=(await db.doc(`users/${athlete}`).get()).data();assert.equal(profile.athleteMembership.status,'solo_active');assert.equal(profile.linkedCoach,null);
 }
});
test('linked athlete deletion releases the paid seat and removes its roster entry',async()=>{
 const coach='seat_delete_coach',athlete='seat_delete_athlete';accounts.add(athlete);
 await db.doc(`users/${coach}`).set({clients:[{id:'client_deleted_seat',linkedUserId:athlete},{id:'client_kept_seat'}]});
 await db.doc(`users/${athlete}`).set({displayName:'Delete'});
 await db.doc(`coach_links/${athlete}`).set({coachId:coach,clientId:'client_deleted_seat'});
 await db.doc(`shadow_owners/client_deleted_seat`).set({coachId:coach});
 await db.doc(`coach_seats/${coach}`).set({activeIds:['client_deleted_seat','client_kept_seat']});
 await invoke('deleteMyAccount',athlete);
 assert.deepEqual((await db.doc(`coach_seats/${coach}`).get()).data().activeIds,['client_kept_seat']);
 assert.deepEqual((await db.doc(`users/${coach}`).get()).data().clients.map(c=>c.id),['client_kept_seat']);
});

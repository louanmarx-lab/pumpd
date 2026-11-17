const {test,before,after}=require('node:test');const {createRequire}=require('node:module');const fs=require('node:fs');
const tools=createRequire(process.env.PUMPD_RULE_TEST_PACKAGE||require('node:path').resolve('package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=tools('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,collection,getDocs}=tools('firebase/firestore');let env;
const db=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'password'}}).firestore();
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-ripped-release',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
 await env.withSecurityRulesDisabled(async context=>{
 const d=context.firestore();for(const [path,data] of Object.entries({
 'users/owner':{displayName:'Owner'},'users/stranger':{displayName:'Stranger',clients:[{linkedUserId:'owner'}]},'users/coach':{serverEntitlements:{expiresAt:Date.now()+3600000,seatLimit:5}},
 'coach_seats/coach':{activeIds:['client_one']},'coach_links/athlete':{coachId:'coach',clientId:'client_one'},'users/athlete':{displayName:'Athlete'},'users/athlete/workouts/one':{userId:'athlete',id:'one'},
 'users/blocked':{displayName:'Blocked'},'account_deletions/blocked':{status:'deleted'},
 'gym_jam_rooms/secret':{hostUserId:'owner',guestUserId:'athlete',roomPin:'secret',expiresAt:Date.now()+3600000,status:'connected'},
 'gym_jam_rooms/expired':{hostUserId:'owner',guestUserId:'athlete',roomPin:'expired',expiresAt:Date.now()-1000,status:'connected'},
 'client_claims/secret':{clientName:'Private'},'shadow_owners/client_one':{coachId:'coach'},'users/client_one/workouts/one':{userId:'client_one'}
 }))await setDoc(doc(d,path),data);
 });
});after(async()=>{await env?.cleanup();});
test('owner access is isolated from strangers and forged roster links',async()=>{
 await assertSucceeds(setDoc(doc(db('owner'),'users/owner/workouts/new'),{id:'new',userId:'owner'}));
 await assertFails(getDoc(doc(db('stranger'),'users/owner')));await assertFails(setDoc(doc(db('stranger'),'users/owner/workouts/new'),{id:'new'}));
});
test('only verified server coach relationships permit client data access',async()=>{
 await assertSucceeds(getDoc(doc(db('coach'),'users/athlete/workouts/one')));
 await assertSucceeds(getDoc(doc(db('coach'),'users/client_one/workouts/one')));
 await assertFails(getDoc(doc(db('stranger'),'users/athlete/workouts/one')));
 await assertFails(setDoc(doc(db('stranger'),'coach_links/owner'),{coachId:'stranger'}));
});
test('client cannot mint entitlements or create protected relationship fields',async()=>{
 await assertFails(updateDoc(doc(db('owner'),'users/owner'),{serverEntitlements:{expiresAt:Date.now()+100000}}));
 await assertFails(updateDoc(doc(db('owner'),'users/owner'),{linkedCoach:{coachId:'stranger'}}));
 await assertFails(updateDoc(doc(db('owner'),'users/owner'),{clients:[{id:'client_fake',linkedUserId:'stranger'}]}));
});
test('deletion tombstone blocks previously valid tokens',async()=>{
 await assertFails(setDoc(doc(db('blocked'),'users/blocked/workouts/new'),{id:'new'}));await assertFails(getDoc(doc(db('blocked'),'users/blocked')));
});
test('room membership cannot be guessed, enumerated, forged or replaced',async()=>{
 await assertSucceeds(getDoc(doc(db('owner'),'gym_jam_rooms/secret')));await assertSucceeds(getDoc(doc(db('athlete'),'gym_jam_rooms/secret')));
 await assertFails(getDoc(doc(db('stranger'),'gym_jam_rooms/secret')));await assertFails(getDocs(collection(db('owner'),'gym_jam_rooms')));
 await assertFails(updateDoc(doc(db('athlete'),'gym_jam_rooms/secret'),{guestUserId:'stranger'}));
 await assertFails(setDoc(doc(db('owner'),'gym_jam_rooms/new'),{hostUserId:'owner'}));
 await assertFails(getDoc(doc(db('owner'),'gym_jam_rooms/expired')));
});
test('claim payloads and support tickets are never directly readable by app users',async()=>{
 await assertFails(getDoc(doc(db('owner'),'client_claims/secret')));await assertFails(getDoc(doc(db('owner'),'support_requests/secret')));
});

test('athlete subscription never grants coach access and inactive seats deny access',async()=>{
 await env.withSecurityRulesDisabled(async context=>{await updateDoc(doc(context.firestore(),'users/coach'),{serverEntitlements:{expiresAt:Date.now()+60000,seatLimit:0}});});
 await assertFails(getDoc(doc(db('coach'),'users/athlete')));
 await env.withSecurityRulesDisabled(async context=>{await updateDoc(doc(context.firestore(),'users/coach'),{serverEntitlements:{expiresAt:Date.now()+60000,seatLimit:5}});await setDoc(doc(context.firestore(),'coach_seats/coach'),{activeIds:[]});});
 await assertFails(getDoc(doc(db('coach'),'users/athlete')));
});

test('coach cannot access an athlete while the athlete is being deleted',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  const d=context.firestore();await setDoc(doc(d,'coach_seats/coach'),{activeIds:['client_one']});
  await setDoc(doc(d,'account_deletions/athlete'),{status:'deleting'});
 });
 await assertFails(getDoc(doc(db('coach'),'users/athlete/workouts/one')));
 await assertFails(setDoc(doc(db('coach'),'users/athlete/workouts/during_delete'),{id:'during_delete'}));
 await assertFails(updateDoc(doc(db('coach'),'users/athlete'),{macroTargets:{protein:150}}));
});

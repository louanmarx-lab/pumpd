const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function moduleFrom(path,deps,env={}){const module={exports:{}};const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,require:name=>{if(!(name in deps))throw Error('Unexpected '+name);return deps[name];},console,Date,JSON,Map,Set,Promise,setTimeout,clearTimeout,process:{env}});return module.exports;}
function fixture(saved=new Map()){
 const auth={currentUser:{uid:'owner',isAnonymous:false}};const sent=[];let fail=false;
 const store={getItem:async k=>saved.get(k)||null,setItem:async(k,v)=>saved.set(k,v),removeItem:async k=>saved.delete(k)};
 const queue=moduleFrom('src/utils/cloudSyncQueue.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:store},'../services/secureBackend':{callSecureBackend:async()=>({})},'../config/firebase':{auth,db:{}},'firebase/firestore':{doc:(_, ...path)=>path,setDoc:async(ref,data)=>{if(typeof fail==='function'){const error=fail(ref);if(error)throw error;}else if(fail)throw Error('permission-denied');sent.push({ref,data});},deleteDoc:async ref=>{if(fail)throw Error('permission-denied');sent.push({ref,deleted:true});}}});
 return{queue,saved,auth,sent,setFail:v=>fail=v};
}
test('failed cloud writes reject, persist, and retry after module restart',async()=>{
 const f=fixture();f.setFail(true);await assert.rejects(f.queue.queueCloudWrite(['users','owner','workouts','one'],{id:'one',userId:'owner'}),/permission-denied/);
 assert.equal((await f.queue.pendingCloudOperations('owner')).length,1);
 const restarted=fixture(f.saved);await restarted.queue.flushCloudQueue('owner');assert.equal(restarted.sent.length,1);assert.equal((await restarted.queue.pendingCloudOperations('owner')).length,0);
});
test('pending profile merges preserve independent fields across restart',async()=>{
 const f=fixture();f.setFail(true);await assert.rejects(f.queue.queueCloudWrite(['users','owner'],{coachProfile:{name:'Coach'}},true));
 const restarted=fixture(f.saved);restarted.setFail(true);await assert.rejects(restarted.queue.queueCloudWrite(['users','owner'],{clients:['one']},true));
 const op=(await restarted.queue.pendingCloudOperations('owner'))[0];assert.equal(op.data.coachProfile.name,'Coach');assert.equal(op.data.clients[0],'one');
});
test('server deletions and empty snapshots replace only target owner',()=>{
 const {queue}=fixture();const own={id:'one',userId:'owner'},other={id:'two',userId:'other'};
 const result=queue.reconcileCloudRecords([own,other],[],'owner','workouts',[]);assert.equal(result.length,1);assert.equal(result[0].userId,'other');
});
test('pending upserts survive empty snapshot, pending deletions hide stale remote records',()=>{
 const {queue}=fixture();const base={owner:'owner',path:['users','owner','workouts','one'],revision:1};
 let result=queue.reconcileCloudRecords([],[],'owner','workouts',[{...base,data:{id:'one',userId:'owner'}}]);assert.equal(result.length,1);
 result=queue.reconcileCloudRecords([],[{id:'one',userId:'owner'}],'owner','workouts',[{...base,deleted:true}]);assert.equal(result.length,0);
});
test('nutrition snapshot honors removed meals and reduced water',()=>{
 const {queue}=fixture();const local={id:'n',userId:'owner',date:'2026-11-11',meals:[{id:'deleted'}],waterMl:3000};
 const result=queue.reconcileCloudRecords([local],[{...local,meals:[],waterMl:250}],'owner','nutrition',[]);assert.equal(result[0].meals.length,0);assert.equal(result[0].waterMl,250);
});
test('owner switch cannot send another account outbox; deletion cleanup blocks stale writes',async()=>{
 const f=fixture();f.setFail(true);await assert.rejects(f.queue.queueCloudWrite(['users','owner','workouts','one'],{id:'one'}));
 f.auth.currentUser={uid:'other'};f.setFail(false);await f.queue.flushCloudQueue('owner');assert.equal(f.sent.length,0);
 f.auth.currentUser={uid:'owner'};await f.queue.clearCloudQueue('owner');await assert.rejects(f.queue.queueCloudWrite(['users','owner'],{name:'stale'},true),/deletion/);
});
test('Expo Go and web never load or simulate native billing',async()=>{
 let calls=0;const billing=moduleFrom('src/services/inAppPurchaseService.ts',{'react-native':{Platform:{OS:'ios'}},'expo-constants':{__esModule:true,default:{appOwnership:'expo'}},'../config/firebase':{auth:{currentUser:{uid:'owner'}}},'../types/trainer':{TIER_CONFIGS:{}},'./secureBackend':{callSecureBackend:()=>{calls++;}}});
 const result=await billing.requestSubscriptionPurchase('athlete');assert.equal(result.success,false);assert.match(result.error,/Expo Go/);assert.equal(calls,0);
 const restore=await billing.restorePurchases();assert.equal(restore.success,false);
});
test('full set followed by nested merge retains older fields across restart',async()=>{
 const f=fixture();f.setFail(true);await assert.rejects(f.queue.queueCloudWrite(['users','owner'],{name:'Lifter',targets:{protein:100,carbs:200}},false));
 const restarted=fixture(f.saved);restarted.setFail(true);await assert.rejects(restarted.queue.queueCloudWrite(['users','owner'],{targets:{protein:120}},true));
 const op=(await restarted.queue.pendingCloudOperations('owner'))[0];assert.equal(op.merge,false);assert.equal(op.data.name,'Lifter');assert.equal(op.data.targets.carbs,200);assert.equal(op.data.targets.protein,120);
});
test('one permanently rejected operation does not stall unrelated writes and can be retried',async()=>{
 const f=fixture();f.setFail(ref=>ref.includes('bad')?Object.assign(Error('Denied'),{code:'permission-denied'}):null);
 await assert.rejects(f.queue.queueCloudWrite(['users','owner','workouts','bad'],{id:'bad'}));
 await assert.rejects(f.queue.queueCloudWrite(['users','owner','workouts','good'],{id:'good'}));
 assert.ok(f.sent.some(entry=>entry.ref.includes('good')));assert.equal((await f.queue.pendingCloudOperations('owner'))[0].failedCode,'permission-denied');
 f.setFail(false);await f.queue.flushCloudQueue('owner',true);assert.equal((await f.queue.pendingCloudOperations('owner')).length,0);
});
test('confirmed store transaction cannot grant access when backend verification fails',async()=>{
 let purchases=0;const auth={currentUser:{uid:'owner'}};const sdk={configure(){},getProducts:async()=>[{identifier:'com.ripped.athlete.monthly'}],getCustomerInfo:async()=>({activeSubscriptions:[]}),purchaseStoreProduct:async()=>{purchases++;},PRODUCT_CATEGORY:{SUBSCRIPTION:'subscription'}};
 const billing=moduleFrom('src/services/inAppPurchaseService.ts',{'react-native':{Platform:{OS:'ios'}},'expo-constants':{__esModule:true,default:{appOwnership:'standalone'}},'../config/firebase':{auth},'../types/trainer':{TIER_CONFIGS:{}},'./secureBackend':{callSecureBackend:async()=>{throw Error('Verification unavailable');}},'react-native-purchases':{__esModule:true,default:sdk}},{EXPO_PUBLIC_REVENUECAT_IOS_KEY:'appl_emulator_only'});
 const result=await billing.requestSubscriptionPurchase('athlete');assert.equal(purchases,1);assert.equal(result.success,false);assert.equal(result.access,undefined);
});
test('account-local erasure preserves another account and prevents stale workspace saves',async()=>{
 const ownDraft='@ripped_workout_draft_'+JSON.stringify(['owner','owner']);const otherDraft='@ripped_workout_draft_'+JSON.stringify(['other','other']);
 const saved=new Map([['@ripped_workspace_data_owner','{}'],['@ripped_workspace_data_other','{"keep":true}'],[ownDraft,'{}'],[otherDraft,'{}'],['@ripped_registered_accounts',JSON.stringify([{id:'owner',email:'owner@example.invalid'},{id:'other',email:'other@example.invalid'}])]]);
 const store={getItem:async k=>saved.get(k)||null,setItem:async(k,v)=>saved.set(k,v),getAllKeys:async()=>[...saved.keys()],multiRemove:async keys=>keys.forEach(k=>saved.delete(k)),removeItem:async k=>saved.delete(k)};
 const storage=moduleFrom('src/utils/storage.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:store}});
 await storage.eraseOwnerLocalData('owner');assert.equal(saved.has(ownDraft),false);assert.equal(saved.has(otherDraft),true);assert.equal(saved.has('@ripped_workspace_data_other'),true);
 await storage.persistAppData({currentUser:{id:'owner'}});assert.equal(saved.has('@ripped_workspace_data_owner'),false);assert.equal(JSON.parse(saved.get('@ripped_registered_accounts')).length,1);
});

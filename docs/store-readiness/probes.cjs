// Read-only regression probes documenting release blockers. All Firebase calls are mocked.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..') + path.sep;
const ts = require(path.join(root, 'node_modules/typescript'));
function load(file, deps) {
  const source = ts.transpileModule(fs.readFileSync(root + file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(source, {module,exports:module.exports,require:(name)=>{if (!(name in deps)) throw new Error('Unexpected dependency '+name); return deps[name]},console:{warn(){}},setTimeout:(fn)=>{fn();return 1},Date,JSON,Promise}, {filename:file});
  return module.exports;
}
(async()=>{
 const iap=load('src/services/inAppPurchaseService.ts', {'react-native':{Platform:{OS:'ios'}},'../types/trainer':{TIER_CONFIGS:{starter:{productIdIos:'test.starter',seatLimit:5,priceZar:199}}}});
 const purchase=await iap.requestSubscriptionPurchase('starter');
 assert.equal(purchase.success,true); assert.equal(purchase.subscription.status,'active');
 const restored=await iap.restorePurchases(); assert.equal(restored.success,true);
 console.log('REPRODUCED: purchase grants active subscription and restore returns success without any billing SDK.');
 const fakeFirestore={doc:(...args)=>args,setDoc:async()=>{throw new Error('permission-denied')},collection(){},getDoc(){},getDocs(){},deleteDoc:async()=>{throw new Error('permission-denied')},query(){},where(){},orderBy(){},onSnapshot(){}};
 const cloud=load('src/services/firestoreService.ts', {'firebase/firestore':fakeFirestore,'../config/firebase':{db:{}}});
 await cloud.saveUserProfileCloud('test',{displayName:'Test'});
 await cloud.saveNutritionLogCloud('test',{date:'2026-11-11',meals:[]});
 await cloud.saveBodyMetricCloud('test',{id:'test',date:'2026-11-11'});
 await cloud.deleteWorkoutLogCloud('test','test');
 await assert.rejects(cloud.saveWorkoutLogCloud('test',{id:'test'}));
 console.log('REPRODUCED: profile, nutrition, metrics and delete helpers resolve despite denied writes. Workout save correctly rejects.');
 const jam=load('src/services/gymJamService.ts', {'firebase/firestore':fakeFirestore,'../config/firebase':{db:{}}});
 const room=await jam.createJamRoomCloud('RIP-42',{userId:'test',displayName:'Test',role:'athlete'},{routineName:'Test',exerciseIds:[]});
 assert.equal(room.status,'waiting');
 console.log('REPRODUCED: room creation returns a waiting room despite denied backend creation.');
})().catch(error=>{console.error(error);process.exitCode=1});

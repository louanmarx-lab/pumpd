function soloMembership(profile) { return {status:profile?.serverEntitlements?.tier==='athlete' && profile.serverEntitlements.expiresAt>Date.now() ? 'solo_active' : 'free'}; }
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('node:crypto');
const { verifiedAccess, freshAuth, roomCode, validCode, canJoin, text } = require('./domain');
initializeApp();
const db = getFirestore();
const rcKey = defineSecret('REVENUECAT_SECRET_KEY');
const webhookKey = defineSecret('REVENUECAT_WEBHOOK_SECRET');
const opts = { region: 'us-central1', enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };
function uid(request) {
  if (!request.auth?.uid || request.auth.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Sign in to your account to continue.');
  return request.auth.uid;
}
async function available(id) {
  if ((await db.doc(`account_deletions/${id}`).get()).exists) throw new HttpsError('failed-precondition', 'Account deletion is in progress.');
}
async function txAvailable(transaction,id){
 const lock=await transaction.get(db.doc(`account_deletions/${id}`));
 if(lock.exists)throw new HttpsError('failed-precondition','Account deletion is in progress.');
}
async function limit(key, max = 20) {
  const ref = db.doc(`request_limits/${crypto.createHash('sha256').update(key).digest('hex')}`);
  await db.runTransaction(async t => {
    const snap = await t.get(ref); const data = snap.data(); const now = Date.now();
    const count = data?.until > now ? data.count + 1 : 1;
    if (count > max) throw new HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
    t.set(ref, { count, until: data?.until > now ? data.until : now + 3600000, expiresAt: new Date(now + 7200000) });
  });
}
async function accessFor(id) {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${rcKey.value()}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpsError('unavailable', 'The store verification service is unavailable. Your purchase has not been applied yet.');
  return verifiedAccess((await response.json()).subscriber);
}
async function saveAccess(id) {
  await available(id);
  const access = await accessFor(id);
  try{await getAuth().getUser(id);}catch(error){if(error.code==='auth/user-not-found')return null;throw error;}
  await db.runTransaction(async t=>{
    const lock=await t.get(db.doc(`account_deletions/${id}`));
    if(lock.exists)throw new HttpsError('failed-precondition','Account deletion is in progress.');
    const profileRef=db.doc(`users/${id}`);const profile=(await t.get(profileRef)).data()||{};
    const linkRef=db.doc(`coach_links/${id}`);const link=(await t.get(linkRef)).data();
    let sponsored=false;
    if(link){const coach=(await t.get(db.doc(`users/${link.coachId}`))).data();const seats=(await t.get(db.doc(`coach_seats/${link.coachId}`))).data()?.activeIds||[];sponsored=Boolean(coach?.serverEntitlements?.seatLimit>0&&coach.serverEntitlements.expiresAt>Date.now()&&seats.includes(link.clientId));}
    const membership=access?.tier==='athlete'?{status:'solo_active'}:sponsored?{status:'sponsored_by_coach'}:{status:'free'};
    const changes={serverEntitlements:access,entitlementCheckedAt:Date.now(),athleteMembership:membership};
    if(access?.seatLimit>0){changes.accountType='coach';changes.linkedCoach=null;changes.athleteMembership={status:'free'};if(link)t.delete(linkRef);}
    else if(access?.tier==='athlete')changes.accountType='athlete';
    t.set(profileRef,changes,{merge:true});
  });
  return access;
}
exports.refreshStoreEntitlements = onCall({ ...opts, secrets: [rcKey] }, async request => {
  const id = uid(request); await limit(`billing:${id}`, 60);
  return { access: await saveAccess(id) };
});
exports.revenueCatWebhook = onRequest({ region: 'us-central1', secrets: [rcKey, webhookKey] }, async (request, response) => {
  if (request.method !== 'POST') return response.status(405).send('Method not allowed');
  const provided = Buffer.from(request.get('authorization') || ''); const expected = Buffer.from(`Bearer ${webhookKey.value()}`);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return response.status(401).send('Unauthorized');
  const event = request.body?.event;
  const ids = [...new Set([event?.app_user_id, ...(event?.transferred_from || []), ...(event?.transferred_to || [])])].filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) && !id.startsWith('$RCAnonymousID:'));
  try { for (const id of ids) { if (!(await db.doc(`account_deletions/${id}`).get()).exists) await saveAccess(id); } return response.sendStatus(200); }
  catch { return response.status(503).send('Verification unavailable; retry'); }
});
exports.createWorkoutRoom = onCall(opts, async request => {
  const id = uid(request); await available(id); await limit(`host:${id}`);
  const input = request.data || {}; const profile = (await db.doc(`users/${id}`).get()).data() || {};
  const ids = Array.isArray(input.exerciseIds) ? input.exerciseIds.filter(v => typeof v === 'string' && v.length <= 160).slice(0, 100) : [];
  if (JSON.stringify(input).length > 100000) throw new HttpsError('invalid-argument', 'Workout is too large to share.');
  for (let attempt = 0; attempt < 4; attempt++) {
    const pin = roomCode(); const now = Date.now();
    const room = { roomPin: pin, hostUserId: id, hostName: text(profile.displayName || request.auth.token.name || 'Lifter', 80), hostRole: profile.serverEntitlements?.seatLimit>0 && profile.serverEntitlements.expiresAt>Date.now() ? 'coach' : 'athlete', routineName: text(input.routineName, 120) || 'Workout', exerciseIds: ids, sessionExercisesTemplate: Array.isArray(input.sessionExercisesTemplate) ? input.sessionExercisesTemplate : [], guestUserId: null, guestName: null, status: 'waiting', activeTurnUserId: id, activeTurnUserName: text(profile.displayName || 'Lifter', 80), activeExerciseIndex: 0, lastEvent: null, createdAt: now, updatedAt: now, expiresAt: now + 6 * 3600000 };
    try { await db.runTransaction(async t=>{await txAvailable(t,id);t.create(db.doc(`gym_jam_rooms/${pin}`),room);}); return room; }
    catch (e) { if (e.code !== 6) throw e; }
  }
  throw new HttpsError('unavailable', 'Could not create a unique invitation. Try again.');
});
exports.workoutInvitation = onCall(opts, async request => {
  const id = uid(request); await available(id); await limit(`join:${id}`, 30);
  const code = text(request.data?.code, 40).toUpperCase();
  if (!validCode(code)) throw new HttpsError('invalid-argument', 'Ask your friend for a new workout invitation.');
  const ref = db.doc(`gym_jam_rooms/${code}`);
  return db.runTransaction(async t => {
    await txAvailable(t,id);
    const snap = await t.get(ref); const room = snap.data();
    if (!room || room.expiresAt <= Date.now() || room.status === 'ended') throw new HttpsError('not-found', 'Invitation expired or not found.');
    if (room.hostUserId === id) throw new HttpsError('failed-precondition', 'Use a different account on the other phone.');
    if (!canJoin(room, id)) throw new HttpsError('already-exists', 'This workout already has a partner.');
    if (request.data?.join !== true) return { roomPin: code, routineName: room.routineName, hostName: room.hostName, hostRole: room.hostRole, exerciseIds: [], hostUserId: '', createdAt: room.createdAt, updatedAt: room.updatedAt, status: 'waiting' };
    const updates = { guestUserId: id, guestName: text(request.auth.token.name || 'Partner', 80), status: 'connected', updatedAt: Date.now() };
    t.update(ref, updates); return { ...room, ...updates };
  });
});
exports.publishCoachInvitation = onCall(opts, async request => {
  const id = uid(request); await available(id); await limit(`invite:${id}`);
  const p = request.data || {};
  if (!validCode(p.code) || typeof p.clientId !== 'string' || !/^client_[A-Za-z0-9_-]+$/.test(p.clientId)) throw new HttpsError('invalid-argument', 'Generate a new invitation.');
  const ref = db.doc(`users/${id}`); const ownerRef = db.doc(`shadow_owners/${p.clientId}`);
  await db.runTransaction(async t => {
    await txAvailable(t,id);
    const [profile, owner, existing] = await Promise.all([t.get(ref), t.get(ownerRef), t.get(db.doc(`client_claims/${p.code}`))]);
    const me = profile.data(); const client = me?.clients?.find(c => c.id === p.clientId && c.type !== 'linked');
    const seats=(await t.get(db.doc(`coach_seats/${id}`))).data()?.activeIds||[];
    if(!seats.includes(p.clientId))throw new HttpsError('permission-denied','Activate this client seat before inviting.');
    if (!client || !me.serverEntitlements?.seatLimit || me.serverEntitlements.expiresAt <= Date.now()) throw new HttpsError('permission-denied', 'A verified coach plan and an unlinked client are required.');
    if (!owner.exists || owner.data().coachId !== id) throw new HttpsError('permission-denied', 'This client belongs to another coach.');
    if(existing.exists){const old=existing.data();if(old.coachId===id&&old.clientId===client.id&&!old.revoked&&!old.claimed&&old.expiresAt>Date.now())return;throw new HttpsError('already-exists','Generate a fresh invitation.');}
    const expiry = Date.now() + 24 * 3600000;
    // Shadow ownership is established separately before creating an invitation.
    // Only the server can read the payload; redemption uses canonical owner data, not client-supplied histories.
    t.create(db.doc(`client_claims/${p.code}`), { code: p.code, coachId: id, clientId: client.id, clientName: client.name, coachName: text(me.coachProfile?.name || me.displayName, 80), coachBusiness: text(me.coachProfile?.businessName, 120), expiresAt: expiry, claimed: false });
  });
  return { success: true };
});
exports.previewCoachInvitation = onCall(opts, async request => {
  const id = uid(request); await available(id); await limit(`claim:${id}`, 30);
  const code = text(request.data?.code, 40).toUpperCase();
  if (!validCode(code)) throw new HttpsError('invalid-argument', 'Ask your trainer for a new invitation.');
  const claim = (await db.doc(`client_claims/${code}`).get()).data();
  if (!claim || claim.expiresAt <= Date.now() || (claim.claimed || claim.revoked)) throw new HttpsError('not-found', 'Invitation expired or already used.');
  if (claim.coachId === id) throw new HttpsError('failed-precondition', 'A coach cannot claim their own invitation.');
  return { code, coachId: claim.coachId, coachName: claim.coachName, coachBusiness: claim.coachBusiness, clientId: claim.clientId, clientName: claim.clientName, expiresAt: claim.expiresAt, claimed: false };
});
exports.redeemCoachInvitation = onCall(opts, async request => {
  const id = uid(request); await available(id); await limit(`redeem:${id}`, 30);
  const code = text(request.data?.code, 40).toUpperCase();
  if (!validCode(code)) throw new HttpsError('invalid-argument', 'Invalid invitation.');
  const claimRef = db.doc(`client_claims/${code}`); const athleteRef = db.doc(`users/${id}`); const linkRef = db.doc(`coach_links/${id}`);
  return db.runTransaction(async t => {
    await txAvailable(t,id);
    const [claimSnap, athleteSnap, linkSnap] = await Promise.all([t.get(claimRef), t.get(athleteRef), t.get(linkRef)]);
    const claim = claimSnap.data(); const athlete = athleteSnap.data() || {};
    if (!claim || claim.expiresAt <= Date.now() || (claim.claimed && claim.claimedByUserId !== id)) throw new HttpsError('failed-precondition', 'Invitation expired or already used.');
    if (claim.coachId === id || (athlete.serverEntitlements?.seatLimit>0&&athlete.serverEntitlements.expiresAt>Date.now())) throw new HttpsError('permission-denied', 'Use an athlete account to link a trainer.');
    if(claim.revoked)throw new HttpsError('failed-precondition','This invitation has been revoked.');
    if(claim.claimed){
      const current=linkSnap.data();
      if(current?.coachId!==claim.coachId||current?.clientId!==claim.clientId)throw new HttpsError('failed-precondition','This invitation has already been used. Ask your trainer for a new one.');
    }
    if (linkSnap.exists && (linkSnap.data().coachId !== claim.coachId || linkSnap.data().clientId !== claim.clientId)) throw new HttpsError('failed-precondition', 'Unlink your current trainer first.');
    await txAvailable(t,claim.coachId);
    const coachRef = db.doc(`users/${claim.coachId}`); const coach = (await t.get(coachRef)).data();
    const client = coach?.clients?.find(c => c.id === claim.clientId);
    const seats=(await t.get(db.doc(`coach_seats/${claim.coachId}`))).data()?.activeIds||[];
    if(!seats.includes(claim.clientId))throw new HttpsError('failed-precondition','This trainer seat is inactive.');
    if (!client || (client.linkedUserId && client.linkedUserId !== id) || !coach.serverEntitlements?.seatLimit || coach.serverEntitlements.expiresAt <= Date.now()) throw new HttpsError('failed-precondition', 'This trainer invitation is no longer available.');
    if(claim.claimed)return{success:true};
    const source = db.doc(`users/${claim.clientId}`);
    const shadowProfile = (await t.get(source)).data() || {};
    const names=['workouts','nutrition','bodyMetrics'];
    const snapshots = await Promise.all(names.map(name => t.get(source.collection(name))));
    if (snapshots.reduce((n,s) => n+s.size,0) > 350) throw new HttpsError('resource-exhausted', 'This large history needs a server migration before linking. Contact support.');
    const imports=snapshots.flatMap((snapshot,index)=>snapshot.docs.map(record=>{
      const name=names[index]; const data=record.data();
      const key=name==='nutrition'?record.id:`claimed_${claim.clientId}_${record.id}`;
      return {name,ref:athleteRef.collection(name).doc(key),data:{...data,id:name==='nutrition'?data.id:key,userId:id}};
    }));
    const existing=await Promise.all(imports.map(entry=>t.get(entry.ref)));
    const now = Date.now();
    imports.forEach((entry,index)=>{
      const old=existing[index].data();
      if(!old)t.create(entry.ref,entry.data);
      else if(entry.name==='nutrition'){
        const meals=new Map([...(entry.data.meals||[]),...(old.meals||[])].map(meal=>[meal.id,meal]));
        t.set(entry.ref,{...entry.data,...old,userId:id,meals:[...meals.values()]});
      }
    });
    const mergedSplits=[...new Map([...(shadowProfile.splits||[]).map(split=>({...split,userId:id})),...(athlete.splits||[])].map(split=>[split.id,split])).values()];
    t.set(linkRef,{coachId:claim.coachId,clientId:claim.clientId,linkedAt:now});
    t.update(claimRef,{claimed:true,claimedByUserId:id,claimedAt:now});
    t.update(coachRef,{clients:coach.clients.map(c=>c.id===claim.clientId?{...c,type:'linked',linkedUserId:id,linkedAt:now,claimToken:null}:c)});
    t.set(athleteRef,{ linkedCoach:{coachId:claim.coachId,name:claim.coachName,businessName:claim.coachBusiness,linkedAt:now}, macroTargets:athlete.macroTargets || client.macroTargets || {calories:2500,protein:150,carbs:250,fats:70}, splits:mergedSplits, prescribedArchetypes:client.prescribedArchetypes||[], athleteMembership:{status:'sponsored_by_coach',coachName:claim.coachName} },{merge:true});
    return { success:true };
  });
});
exports.unlinkTrainer = onCall(opts, async request => {
  const id = uid(request); await available(id);
  await db.runTransaction(async t=>{
    await txAvailable(t,id);
    const linkRef=db.doc(`coach_links/${id}`); const snap=await t.get(linkRef); const link=snap.data();
    const athlete=(await t.get(db.doc(`users/${id}`))).data();
    const coachRef=link?db.doc(`users/${link.coachId}`):null; const coach=coachRef?(await t.get(coachRef)).data():null;
    const claims=await t.get(db.collection('client_claims').where('claimedByUserId','==',id));
    claims.docs.filter(record=>record.data().coachId===link?.coachId).forEach(record=>t.update(record.ref,{revoked:true}));
    t.delete(linkRef); t.set(db.doc(`users/${id}`),{linkedCoach:null,athleteMembership:soloMembership(athlete)},{merge:true});
    if(coach?.clients) t.update(coachRef,{clients:coach.clients.map(c=>c.linkedUserId===id?{...c,linkedUserId:null,type:'shadow',status:'archived'}:c)});
  });
  return {success:true};
});
exports.registerShadowClient = onCall(opts,async request=>{
  const id=uid(request);await available(id);const clientId=text(request.data?.clientId,160);
  if(!/^client_[A-Za-z0-9_-]+$/.test(clientId)) throw new HttpsError('invalid-argument','Invalid client.');
  await db.runTransaction(async t=>{
    await txAvailable(t,id);
    const ref=db.doc(`shadow_owners/${clientId}`);const seatRef=db.doc(`coach_seats/${id}`);
    const [owner,profile,target,seatSnapshot]=await Promise.all([t.get(ref),t.get(db.doc(`users/${id}`)),t.get(db.doc(`users/${clientId}`)),t.get(seatRef)]);
    const p=profile.data();if(!p?.clients?.some(c=>c.id===clientId)||!p.serverEntitlements?.seatLimit||p.serverEntitlements.expiresAt<=Date.now()) throw new HttpsError('permission-denied','Verified coach access required.');
    if((owner.exists&&owner.data().coachId!==id)||(!owner.exists&&target.exists)) throw new HttpsError('permission-denied','Client already registered.');
    const activeIds=seatSnapshot.data()?.activeIds||[];
    if(!activeIds.includes(clientId)&&activeIds.length>=p.serverEntitlements.seatLimit)throw new HttpsError('resource-exhausted','Your coach plan has no available client seats.');
    t.set(ref,{coachId:id});t.set(seatRef,{activeIds:[...new Set([...activeIds,clientId])]});t.update(db.doc(`users/${id}`),{clients:p.clients.map(c=>c.id===clientId?{...c,status:'active'}:c)});
    if(!target.exists)t.create(db.doc(`users/${clientId}`),{shadowOwnerId:id});
  });return {success:true};
});
exports.submitSupportRequest = onCall({region:'us-central1'},async request=>{
  await limit(`support:${request.rawRequest.ip}`,5);
  const email=text(request.data?.email,254);const message=text(request.data?.message,3000);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10) throw new HttpsError('invalid-argument','Enter a valid reply email and a message of at least 10 characters.');
  const ticket=await db.collection('support_requests').add({email,message,createdAt:Date.now(),status:'new',expiresAt:new Date(Date.now()+90*86400000)});
  return {reference:ticket.id};
});
exports.deleteMyAccount = onCall({...opts,secrets:[rcKey]},async request=>{
  const id=uid(request);
  if(!freshAuth(request.auth)) throw new HttpsError('unauthenticated','Sign in again before deleting your account.');
  // A durable server lock makes partial failures retryable and blocks all subsequent client writes.
  await db.doc(`account_deletions/${id}`).set({startedAt:Date.now(),status:'deleting'},{merge:true});
  const links=await db.collection('coach_links').where('coachId','==',id).get();
  for(const record of links.docs){await db.runTransaction(async t=>{const ref=db.doc(`users/${record.id}`);const [profile,lock]=await Promise.all([t.get(ref),t.get(db.doc(`account_deletions/${record.id}`))]);if(profile.exists&&!lock.exists)t.update(ref,{linkedCoach:null,athleteMembership:soloMembership(profile.data())});t.delete(record.ref);});}
  await db.doc(`coach_seats/${id}`).delete();
  const ownLink=(await db.doc(`coach_links/${id}`).get()).data();
  if(ownLink){
    const ref=db.doc(`users/${ownLink.coachId}`);const seatRef=db.doc(`coach_seats/${ownLink.coachId}`);
    await db.runTransaction(async t=>{
      const [profile,seats]=await Promise.all([t.get(ref),t.get(seatRef)]);const p=profile.data();
      if(p?.clients)t.update(ref,{clients:p.clients.filter(c=>c.id!==ownLink.clientId&&c.linkedUserId!==id)});
      if(seats.exists)t.update(seatRef,{activeIds:(seats.data().activeIds||[]).filter(value=>value!==ownLink.clientId)});
    });
    await db.recursiveDelete(db.doc(`users/${ownLink.clientId}`));await db.doc(`shadow_owners/${ownLink.clientId}`).delete();await db.doc(`coach_links/${id}`).delete();
  }
  const shadows=await db.collection('shadow_owners').where('coachId','==',id).get();
  for(const shadow of shadows.docs){await db.recursiveDelete(db.doc(`users/${shadow.id}`));await shadow.ref.delete();}
  for(const [collection,field] of [['gym_jam_rooms','hostUserId'],['gym_jam_rooms','guestUserId'],['client_claims','coachId'],['client_claims','claimedByUserId'],['shared_splits','authorId']]){
    const records=await db.collection(collection).where(field,'==',id).get();for(const record of records.docs)await db.recursiveDelete(record.ref);
  }
  // RevenueCat holds billing identity too. A failed provider deletion leaves the request retryable.
  const rc=await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${rcKey.value()}`}});
  if(!rc.ok&&rc.status!==404)throw new HttpsError('unavailable','Billing identity cleanup failed. Please retry account deletion.');
  await db.recursiveDelete(db.doc(`users/${id}`));
  try { await getAuth().deleteUser(id); } catch (error) { if(error.code !== 'auth/user-not-found') throw error; }
  await db.doc(`account_deletions/${id}`).set({status:'deleted',expiresAt:new Date(Date.now()+172800000)}, {merge:true});
  return {success:true};
});
exports.unlinkCoachClient=onCall(opts,async request=>{
 const id=uid(request);await available(id);const athleteId=text(request.data?.athleteId,128);
 if(!/^[A-Za-z0-9_-]+$/.test(athleteId))throw new HttpsError('invalid-argument','Invalid athlete.');
 await db.runTransaction(async t=>{
    await txAvailable(t,id);
  const ref=db.doc(`coach_links/${athleteId}`);const link=(await t.get(ref)).data();
  if(!link||link.coachId!==id)throw new HttpsError('permission-denied','This athlete is not linked to you.');
  await txAvailable(t,athleteId);
  const coachRef=db.doc(`users/${id}`);const coach=(await t.get(coachRef)).data();
  const athlete=(await t.get(db.doc(`users/${athleteId}`))).data();
  const claims=await t.get(db.collection('client_claims').where('claimedByUserId','==',athleteId));
  claims.docs.filter(record=>record.data().coachId===id).forEach(record=>t.update(record.ref,{revoked:true}));
  t.delete(ref);t.set(db.doc(`users/${athleteId}`),{linkedCoach:null,athleteMembership:soloMembership(athlete)},{merge:true});
  if(coach?.clients)t.update(coachRef,{clients:coach.clients.map(c=>c.linkedUserId===athleteId?{...c,linkedUserId:null,type:'shadow',claimToken:null}:c)});
 });return{success:true};
});
exports.setCoachSeat=onCall(opts,async request=>{
 const id=uid(request);await available(id);const clientId=text(request.data?.clientId,160);const activate=request.data?.active===true;
 if(!/^client_[A-Za-z0-9_-]+$/.test(clientId))throw new HttpsError('invalid-argument','Invalid client.');
 await db.runTransaction(async t=>{
    await txAvailable(t,id);
  const seatRef=db.doc(`coach_seats/${id}`);const [p,owner,counter]=await Promise.all([t.get(db.doc(`users/${id}`)),t.get(db.doc(`shadow_owners/${clientId}`)),t.get(seatRef)]);
  const profile=p.data();if(owner.data()?.coachId!==id)throw new HttpsError('permission-denied','Client ownership required.');
  const activeIds=counter.data()?.activeIds||[];
  if(activate&&(!profile?.serverEntitlements?.seatLimit||profile.serverEntitlements.expiresAt<=Date.now()||(!activeIds.includes(clientId)&&activeIds.length>=profile.serverEntitlements.seatLimit)))throw new HttpsError('resource-exhausted','No verified client seat is available.');
  t.set(seatRef,{activeIds:activate?[...new Set([...activeIds,clientId])]:activeIds.filter(value=>value!==clientId)});
  if(profile?.clients)t.update(db.doc(`users/${id}`),{clients:profile.clients.map(c=>c.id===clientId?{...c,status:activate?'active':'archived'}:c)});
 });return{success:true};
});
// Roster relationship fields are derived from server links, never accepted from an app write.
exports.saveCoachRoster=onCall(opts,async request=>{
 const id=uid(request);await available(id);
 const input=request.data?.clients;
 if(!Array.isArray(input)||input.length>500||JSON.stringify(input).length>700000)throw new HttpsError('invalid-argument','Roster is too large.');
 const unique=new Set();for(const c of input){if(!/^client_[A-Za-z0-9_-]{1,150}$/.test(c?.id)||unique.has(c.id))throw new HttpsError('invalid-argument','Invalid or repeated client identity.');unique.add(c.id);}
 return db.runTransaction(async t=>{
  await txAvailable(t,id);
  const profileRef=db.doc(`users/${id}`);
  const [profile,links,counter]=await Promise.all([t.get(profileRef),t.get(db.collection('coach_links').where('coachId','==',id)),t.get(db.doc(`coach_seats/${id}`))]);
  const me=profile.data()||{};if(input.length&&(!me.serverEntitlements?.seatLimit||me.serverEntitlements.expiresAt<=Date.now()))throw new HttpsError('permission-denied','Verify a trainer subscription before syncing a client roster.');
  const active=counter.data()?.activeIds||[];const byClient=new Map(links.docs.map(link=>[link.data().clientId,{...link.data(),uid:link.id}]));
  const clients=input.map(c=>{
    const linked=byClient.get(c.id);const macro=c.macroTargets||{};
    const macros=Object.fromEntries(['calories','protein','carbs','fats'].map(key=>[key,Number.isFinite(macro[key])&&macro[key]>=0?macro[key]:0]));
    const prescribed=Array.isArray(c.prescribedArchetypes)?c.prescribedArchetypes.slice(0,50).map(meal=>({id:text(meal.id,160),name:text(meal.name,120),emoji:text(meal.emoji,16),...Object.fromEntries(['calories','protein','carbs','fats'].map(key=>[key,Number.isFinite(meal[key])&&meal[key]>=0?meal[key]:0])),instructions:text(meal.instructions,2000),recipe:text(meal.recipe,4000)})):[];
    return {id:c.id,name:text(c.name,80),email:text(c.email,254),avatarEmoji:text(c.avatarEmoji,16)||'👤',notes:text(c.notes,4000),createdAt:Number.isFinite(c.createdAt)?c.createdAt:Date.now(),macroTargets:macros,prescribedArchetypes:prescribed,assignedSplitId:text(c.assignedSplitId,160),assignedSplitName:text(c.assignedSplitName,120),assignedRoutineIds:Array.isArray(c.assignedRoutineIds)?c.assignedRoutineIds.filter(id=>typeof id==='string').slice(0,100):[],assignedRoutineNames:Array.isArray(c.assignedRoutineNames)?c.assignedRoutineNames.map(name=>text(name,120)).slice(0,100):[],claimToken:c.claimToken&&validCode(c.claimToken.code)?{code:c.claimToken.code,expiresAt:Math.min(c.claimToken.expiresAt||0,Date.now()+86400000),qrPayload:JSON.stringify({type:'RIPPED_CLIENT_CLAIM',code:c.claimToken.code})}:null,linkedUserId:linked?.uid||null,linkedAt:linked?.linkedAt||null,type:linked?'linked':'shadow',status:active.includes(c.id)?'active':'archived'};
  });
  t.set(profileRef,{clients,updatedAt:Date.now()},{merge:true});return{clients};
 });
});

const {test}=require('node:test');const assert=require('node:assert/strict');
const {verifiedAccess,freshAuth,roomCode,validCode,canJoin}=require('../domain');
test('only recognized unexpired subscriptions grant server access',()=>{
 const now=Date.now();const entry={product_identifier:'com.ripped.pt.pro.monthly',expires_date:new Date(now+60000).toISOString()};
 assert.equal(verifiedAccess({entitlements:{coach:entry}},now).seatLimit,30);
 assert.equal(verifiedAccess({entitlements:{coach:{...entry,expires_date:new Date(now-1).toISOString()}}},now),null);
 assert.equal(verifiedAccess({entitlements:{coach:{...entry,product_identifier:'fake'}}},now),null);
 assert.equal(verifiedAccess({entitlements:{coach:{...entry,expires_date:null}}},now),null);
});
test('deletion requires authentication within five minutes and rejects future tokens',()=>{
 const now=Date.now();assert.ok(freshAuth({uid:'a',token:{auth_time:Math.floor(now/1000)}},now));
 assert.equal(freshAuth({uid:'a',token:{auth_time:now/1000-301}},now),false);
 assert.equal(freshAuth({uid:'a',token:{auth_time:now/1000+30}},now),false);
 assert.equal(freshAuth(null,now),false);
});
test('secure invitations have a large code space and strict format',()=>{
 const codes=new Set(Array.from({length:5000},roomCode));assert.equal(codes.size,5000);assert.ok([...codes].every(validCode));assert.equal(validCode('RIP-42'),false);
});
test('room admission rejects host, expiry and replacing another guest',()=>{
 const now=Date.now();const room={hostUserId:'host',guestUserId:null,expiresAt:now+1000,status:'waiting'};
 assert.ok(canJoin(room,'friend',now));assert.equal(canJoin(room,'host',now),false);assert.equal(canJoin({...room,expiresAt:now},'friend',now),false);
 assert.equal(canJoin({...room,guestUserId:'other'},'friend',now),false);assert.ok(canJoin({...room,guestUserId:'friend'},'friend',now));assert.equal(canJoin({...room,status:'ended'},'friend',now),false);
});

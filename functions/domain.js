const crypto = require('node:crypto');
const PRODUCTS = {
  'com.ripped.pt.starter.monthly': 'starter', ripped_pt_starter_monthly: 'starter',
  'com.ripped.pt.standard.monthly': 'standard', ripped_pt_standard_monthly: 'standard',
  'com.ripped.pt.pro.monthly': 'pro', ripped_pt_pro_monthly: 'pro',
  'com.ripped.pt.studio.monthly': 'studio', ripped_pt_studio_monthly: 'studio',
  'com.ripped.athlete.monthly': 'athlete', ripped_athlete_monthly: 'athlete',
};
const SEATS = { starter: 5, standard: 15, pro: 30, studio: 50 };
function verifiedAccess(subscriber, now = Date.now()) {
  const active = Object.values(subscriber?.entitlements || {}).flatMap(e => {
    const product = e.product_identifier?.split(':')[0];
    const tier = PRODUCTS[product];
    const expiry = Date.parse(e.expires_date);
    // Subscription products must have an explicit valid expiry; unknown/lifetime SKUs never grant access.
    return tier && Number.isFinite(expiry) && expiry > now ? [{ tier, expiresAt: expiry, seatLimit: SEATS[tier] || 0 }] : [];
  });
  return active.sort((a, b) => b.seatLimit - a.seatLimit || b.expiresAt - a.expiresAt)[0] || null;
}
function freshAuth(auth, now = Date.now()) {
  return Boolean(auth?.uid && Number.isFinite(auth.token?.auth_time) && now / 1000 - auth.token.auth_time <= 300 && now / 1000 >= auth.token.auth_time);
}
function roomCode() { return `RIP-${crypto.randomBytes(12).toString('hex').toUpperCase()}`; }
function validCode(value) { return typeof value === 'string' && /^RIP-[A-F0-9]{24}$/.test(value); }
function canJoin(room, uid, now = Date.now()) {
  return Boolean(room && room.expiresAt > now && room.status !== 'ended' && room.hostUserId !== uid && (!room.guestUserId || room.guestUserId === uid));
}
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
module.exports = { verifiedAccess, freshAuth, roomCode, validCode, canJoin, text, SEATS };

# Independent remediation review

Run: 20261111-091800-c138c5

These findings refer to the reviewed revision, before subsequent fixes. Static review is not release certification.

### Independent Source-Code Review (Supplied Evidence Only)

Below are the 4 concrete medium/high security, state-corruption, and data-loss defects remaining in the supplied code, with exact function names and fixes:

1. **Permanent Paid Seat Leak When a Linked Athlete Deletes Their Account (`deleteMyAccount` and `setCoachSeat` in `functions/index.js`)**
   - **Defect**: When a linked athlete calls `deleteMyAccount`, the `if (ownLink)` branch deletes `users/${ownLink.clientId}`, `shadow_owners/${ownLink.clientId}`, and `coach_links/${id}`, and filters `users/${ownLink.coachId}.clients`, but **never removes `ownLink.clientId` from `coach_seats/${ownLink.coachId}.activeIds`**. Because `shadow_owners/${ownLink.clientId}` is already deleted, the coach cannot release the seat via `setCoachSeat` either (`owner.data()?.coachId !== id` throws `permission-denied`), permanently bricking one of the coach's paid seats.
   - **Fix**: In `deleteMyAccount`, inside the `ownLink` transaction on the coach's records, read `coach_seats/${ownLink.coachId}` and remove `ownLink.clientId` from `activeIds` (and filter `p.clients` by `c.id !== ownLink.clientId && c.linkedUserId !== id`).

2. **Same-Coach Re-Claim Orphans Previous Linked Client Entry (`redeemCoachInvitation` in `functions/index.js`)**
   - **Defect**: `redeemCoachInvitation` only rejects existing links when `linkSnap.exists && linkSnap.data().coachId !== claim.coachId`. If an athlete already linked to `coachId` under `client_A` redeems a fresh (unclaimed) invitation from the **same** coach for `client_B`, `coach_links/${id}` is overwritten with `client_B` while `client_A` remains marked `type: 'linked', linkedUserId: id` on the coach roster and active in `coach_seats/${claim.coachId}` (which also prevents `saveCoachRoster` and `deleteMyAccount` from properly cleaning up both).
   - **Fix**: In `redeemCoachInvitation`, change the existing-link guard to:
     ```js
     if (linkSnap.exists && (linkSnap.data().coachId !== claim.coachId || linkSnap.data().clientId !== claim.clientId)) {
       throw new HttpsError('failed-precondition', 'Unlink your current trainer first.');
     }
     ```

3. **Active Solo Athlete Entitlement Overwritten to `'free'` on Unlink or Coach Deletion (`unlinkTrainer`, `unlinkCoachClient`, and `deleteMyAccount` in `functions/index.js`)**
   - **Defect**: `unlinkTrainer`, `unlinkCoachClient`, and the coach-link cleanup loop in `deleteMyAccount` unconditionally write `athleteMembership: { status: 'free' }` to the athlete's user document, revoking `{ status: 'solo_active' }` for athletes who hold a valid paid solo subscription (`serverEntitlements?.tier === 'athlete' && serverEntitlements.expiresAt > Date.now()`).
   - **Fix**: In `unlinkTrainer`, `unlinkCoachClient`, and `deleteMyAccount`, read the athlete's `users/${athleteId}` document inside the transaction and compute:
     ```js
     const hasSolo = profile?.serverEntitlements?.tier === 'athlete' && profile.serverEntitlements.expiresAt > Date.now();
     const athleteMembership = { status: hasSolo ? 'solo_active' : 'free' };
     ```

4. **Coach Can Write to an Athlete's Documents During Account Deletion (`coach(uid)` in `firestore.rules`)**
   - **Defect**: In `firestore.rules`, `active()` only verifies that `request.auth.uid` (the caller) does not have an `account_deletions` lock. `coach(uid)` does not check whether the target `uid` is currently being deleted (`account_deletions/$(uid)`), allowing a linked coach to write to `users/{uid}` and `users/{uid}/{workouts|nutrition|bodyMetrics}` concurrently with `deleteMyAccount`'s `recursiveDelete` before `coach_links/{uid}` is removed.
   - **Fix**: Add `!exists(/databases/$(database)/documents/account_deletions/$(uid))` to `coach(uid)` in `firestore.rules`.

### Verification Limits
- Review was performed strictly by static inspection of the supplied `functions/index.js`, `functions/domain.js`, `firestore.rules`, and `src/utils/cloudSyncQueue.ts` snippets without executing tools or tests.
- Deployed functions, live RevenueCat webhook/sandbox verification, legacy ownership migration, and store readiness were not tested or certified.

VERDICT: CHANGES_REQUESTED

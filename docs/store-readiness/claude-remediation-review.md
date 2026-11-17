# Independent remediation review

Run: 20261111-083121-d67e79

These findings refer to the reviewed revision, before subsequent fixes. Static review is not release certification.

I'll start by inspecting the files in scope.
**Review of the uncommitted release fixes: changes requested.** This is a source-only review. I ran no tests, rules emulator, deployed functions or RevenueCat. I edited nothing.

## Findings

1. **Coach revocation can be undone by replaying the invitation code.** (high, verified in source)
   - [functions/index.js:117](file:///Users/lou-anmarx/Pumpd/functions/index.js#L117) still accepts a claim that was already claimed when `claimedByUserId === id`.
   - `unlinkCoachClient` ([L184-192](file:///Users/lou-anmarx/Pumpd/functions/index.js#L184-L192)) and `unlinkTrainer` ([L136-145](file:///Users/lou-anmarx/Pumpd/functions/index.js#L136-L145)) never invalidate the claim.
   - `unlinkCoachClient` also leaves the coach's `clients[]` entry as `linked`. That entry satisfies the `client.linkedUserId === id` check.
   - An athlete the coach removed can therefore redeem the same code again within 24h. This recreates `coach_links` and the coach's read/write access without the coach's consent.
   - **Fix:** make redemption single-use. Return success only if `coach_links/{id}` already exists with the same coach and client. Otherwise reject. On either unlink, set the claim to `revoked` and update the coach's `clients[]` entry.

2. **Seat limits are never enforced, and coach rosters are client-controlled.** (high, verified)
   - `registerShadowClient` ([L151](file:///Users/lou-anmarx/Pumpd/functions/index.js#L151)) only checks that `seatLimit` is truthy. `publishCoachInvitation` ([L90](file:///Users/lou-anmarx/Pumpd/functions/index.js#L90)) and `redeemCoachInvitation` ([L122](file:///Users/lou-anmarx/Pumpd/functions/index.js#L122)) do the same.
   - [firestore.rules:16](file:///Users/lou-anmarx/Pumpd/firestore.rules#L16) lets the owner write `clients[]`, so a Starter coach (5 seats) can register unlimited shadows and links.
   - **Fix:** count `shadow_owners` where `coachId == id` plus active `coach_links`, inside the transaction, against `seatLimit`.

3. **Coach access survives losing the coach plan.** (high, verified)
   - [firestore.rules:11](file:///Users/lou-anmarx/Pumpd/firestore.rules#L11) checks only `serverEntitlements.expiresAt > now`.
   - `verifiedAccess` also returns athlete-tier access, which has `seatLimit` 0 ([domain.js:16](file:///Users/lou-anmarx/Pumpd/functions/domain.js#L16)).
   - A coach who downgrades to the athlete SKU keeps read/write on all existing shadow and linked athlete data.
   - **Fix:** also require `serverEntitlements.seatLimit > 0` in `coach()`.

4. **Deleted accounts can be recreated.** (medium, verified)
   - `saveAccess` ([L35-40](file:///Users/lou-anmarx/Pumpd/functions/index.js#L35-L40)) checks `available()` before a slow RevenueCat fetch, then does `set(..., {merge:true})` outside any transaction. A refresh or webhook in flight during `deleteMyAccount` can recreate `users/{id}` after `recursiveDelete` ([L179](file:///Users/lou-anmarx/Pumpd/functions/index.js#L179)).
   - The `account_deletions` tombstone is meant to expire after 48h ([L181](file:///Users/lou-anmarx/Pumpd/functions/index.js#L181)). A later RevenueCat event for that ID passes `available()` and recreates the user document.
   - **Fix:** write inside a transaction that reads `account_deletions/{id}`, and skip IDs whose Auth user no longer exists (`getAuth().getUser`). Consider a non-expiring tombstone.
   - Not checked: whether a TTL policy is configured on `account_deletions`.

5. **Redeeming an invitation overwrites the athlete's existing data.** (medium, verified)
   - [L131](file:///Users/lou-anmarx/Pumpd/functions/index.js#L131) merge-sets shadow records under the same document IDs. Nutrition documents are keyed by date, so same-date athlete logs are clobbered.
   - [L132](file:///Users/lou-anmarx/Pumpd/functions/index.js#L132) merge-replaces the athlete's `splits` array and `macroTargets` with the shadow's.
   - **Fix:** use `t.create` or skip documents that already exist, and keep the athlete's existing splits and targets. Alternatively, namespace the imported documents.

6. **The sync queue drops earlier full writes when merging.** (medium, verified)
   - [cloudSyncQueue.ts:46](file:///Users/lou-anmarx/Pumpd/src/utils/cloudSyncQueue.ts#L46) merges only when both operations are `merge` operations. If an earlier `setDoc` (non-merge) is followed by a merge, the merge replaces it and the earlier fields are lost.
   - `load()` ([L23](file:///Users/lou-anmarx/Pumpd/src/utils/cloudSyncQueue.ts#L23)) has the same flaw. After a restart, a persisted full set plus a newer merge keeps only the merge.
   - The `{...a,...b}` merge is shallow, so nested maps are replaced rather than deep-merged.
   - **Fix:** if the previous operation was a non-merge set and the new one is a merge, keep `merge:false` with merged data. Deep-merge nested fields, or avoid coalescing them.

7. **One failing queue operation blocks the whole queue.** (medium, verified)
   - The flush loop ([L59-68](file:///Users/lou-anmarx/Pumpd/src/utils/cloudSyncQueue.ts#L59-L68)) always retries the head operation. A permanent failure, such as a permission-denied from the rules, stalls every later write for that owner. Nothing is lost, but nothing syncs.
   - `blockedOwners` ([L75](file:///Users/lou-anmarx/Pumpd/src/utils/cloudSyncQueue.ts#L75)) is never cleared. That is safe after a successful deletion, but the call site ([authService.ts:299](file:///Users/lou-anmarx/Pumpd/src/services/authService.ts#L299)) relies on it.
   - **Fix:** on `permission-denied` or `invalid-argument`, move the operation to a dead-letter key and continue. Surface the error to the user.

8. **Cleanup is incomplete and some roles are client-controlled.** (low to medium, verified)
   - `deleteMyAccount` does not delete `shared_splits` authored by the user ([rules L35](file:///Users/lou-anmarx/Pumpd/firestore.rules#L35) writes `authorId`; the delete lists at [L173-175](file:///Users/lou-anmarx/Pumpd/functions/index.js#L173-L175) omit it).
   - `eraseOwnerLocalData` ([storage.ts:307](file:///Users/lou-anmarx/Pumpd/src/utils/storage.ts#L307)) only matches `@ripped_workout_draft_` keys. Any `@pumpd_` drafts are not covered.
   - The server trusts the self-writable `accountType` in two places:
     - `redeemCoachInvitation` ([L118](file:///Users/lou-anmarx/Pumpd/functions/index.js#L118)).
     - `createWorkoutRoom` `hostRole` ([L61](file:///Users/lou-anmarx/Pumpd/functions/index.js#L61)).
     - A user can set `accountType: 'coach'` to present as a coach in rooms or block coach linking.
   - **Fix:** derive the coach role from `serverEntitlements.seatLimit > 0`. Add `shared_splits` (`authorId`) to the deletion list. Extend the draft prefix match to `@pumpd_`.

## Checked, no defect found

- **Coach links:** `coach_links` and `shadow_owners` are server-only writes. `publishCoachInvitation` verifies shadow ownership, so a forged `client_*` ID cannot reach another coach's data.
- **Subscription fields:** the rules block client writes to `serverEntitlements`, `linkedCoach` and `athleteMembership`.
- **Deleted-user token use:** the rules and callables block a deleted user's still-valid token through `account_deletions`.
- **Purchases:** `inAppPurchaseService.ts` guards against account switches and refreshes access through the server.

## Verification limits

- **Shadow profile documents:** `users/client_*` cannot be created under the rules (create needs `self(uid)`). I did not confirm whether the rules would deny coach edits to shadow profiles. Confirm in the emulator.
- **Deployed settings:** TTL policies, App Check enforcement and the RevenueCat restore/transfer behavior were not verifiable.
- **Sandbox purchases:** `accessFor` does not distinguish sandbox from production purchases.

VERDICT: CHANGES_REQUESTED

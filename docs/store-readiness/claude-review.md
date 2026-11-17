# Claude independent evidence review

Advisory review of source excerpts and manager reproductions. See the manager report for final validation and scope.

# Store readiness audit: reviewer findings

This review uses only the supplied excerpts and the manager's mocked reproductions. I ran nothing myself. The "proven" items below are code behavior shown in the excerpts. The "unknown" items depend on server state nobody has inspected.

## Priority findings

### P0: Purchase and restore are simulated, so the app grants paid entitlements without billing
**Proven by the excerpts:**
- [`requestSubscriptionPurchase`](/Users/lou-anmarx/Pumpd/src/services/inAppPurchaseService.ts:22) waits 800 ms and returns `success: true` with `status: 'active'` and a 30-day `expiresAt`. It never calls StoreKit or Google Play Billing.
- Its `E_USER_CANCELLED` and error branches are unreachable, because nothing in the `try` block can throw.
- [`restorePurchases`](/Users/lou-anmarx/Pumpd/src/services/inAppPurchaseService.ts:64) always returns `{ success: true }` with no entitlement data. Callers may treat that as restored.
- `productId` is computed but never used.

**Impact:**
- Any user who reaches this path gets a free subscription. A store build would also fail review, because Apple 3.1.1 and Google Play require real billing.
- If the subscription object is stored locally or written to Firestore, the expiry is client-authored and can't be trusted.

**Unknown:** Whether callers gate this behind `__DEV__`, and whether any server-side receipt validation exists. The manager found no backend code.

**Verify:**
- Grep callers of `requestSubscriptionPurchase` and `restorePurchases`, and look at what they persist.
- Run a release-mode build and confirm the purchase path.
- Confirm the products exist in App Store Connect and Play Console, and that the IDs match `TIER_CONFIGS`.

### P0: Missing `ios.bundleIdentifier` blocks the iOS store build
**Proven:** The manager found that the app config lacks it. EAS or Xcode builds and App Store submission require it, and StoreKit product lookup is tied to it.

**Verify:** Check `app.json` or `app.config.*` for `ios.bundleIdentifier` and `android.package`. Compare them with the store console records and the Firebase app registrations. Then run `eas build --platform ios` to confirm.

### P1: Firestore write helpers swallow permission errors, so the UI reports success when the write failed
**Proven by the excerpts and the manager's mocks:**
- [`createJamRoomCloud`](/Users/lou-anmarx/Pumpd/src/services/gymJamService.ts:120) catches the `setDoc` error, then returns `roomData` with `status: 'waiting'`.
- [`useGymJam`](/Users/lou-anmarx/Pumpd/src/hooks/useGymJam.ts:444) then sets the host role and PIN and subscribes. A host can sit in a room that doesn't exist, and guests can never join it.
- [`saveUserProfileCloud`](/Users/lou-anmarx/Pumpd/src/services/firestoreService.ts:44) swallows errors the same way. The manager's mocks show the nutrition, metric, and delete helpers do too.
- The workout save does reject properly, so the helpers behave inconsistently.
- [`syncAllToCloud`](/Users/lou-anmarx/Pumpd/src/context/UserWorkspaceContext.tsx:1068) relies on those helpers throwing to reach its `catch`. For the swallowing helpers it can set `'synced'` and update `lastCloudSyncTimestamp` even though nothing was written.

**Impact:** Silent data loss. If the deployed rules deny any of these writes, the user sees "synced" while the data stays local only. Deleting from the cloud may also appear to work when it didn't.

**Unknown:** Whether the deployed rules actually deny these writes. This finding is about error handling, not a proven server denial.

**Verify:**
- Make the helpers rethrow, or return a result object, and add unit tests with a mocked `permission-denied`.
- Run against the Firebase emulator with rules deployed.
- Check that the sync status becomes `'error'`.

### P1: No Firestore rules in the repo, so access control can't be audited
**Proven:** The manager found no `firestore.rules`.

**Unknown:** What the console has deployed. Several client patterns would be unsafe under permissive rules:
- [`executeClientClaimCloud`](/Users/lou-anmarx/Pumpd/src/services/clientClaimService.ts:242) lets the client write `claimed`, `claimedByUserId`, and the athlete's name and email into claim docs. Claim codes are short, and the PIN-only document is a second key.
- Jam rooms use a 2-digit PIN, `RIP-10` to `RIP-99`. That is 90 values. They are guessable, and `setDoc` on the same ID overwrites any existing room. A host can clobber another host's room, depending on rules.

Don't present these as exploits. Only the deployed rules decide whether they are.

**Verify:**
- Export the deployed rules and commit them.
- Test with the emulator for cross-user reads and writes, claim hijacking, and room overwrite.
- Make the room create conditional, using `create` only, and use a longer random code.

### P1: Compliance gaps, as far as the manager found in the repo
**Proven (absence only):** No account deletion flow and no policy links were found, and auth permits signup. Apple 5.1.1(v) requires in-app account deletion when signup exists, and both stores require a privacy policy URL. Nothing is proven about the consoles.

**Verify:** Grep for `deleteUser`, `privacy` and `terms`. Confirm the console metadata and the data-safety forms.

## Lower priority
- The `Math.random` PIN is not a secret. Don't use it as an access control.
- Merging cloud logs in [`UserWorkspaceContext`](/Users/lou-anmarx/Pumpd/src/context/UserWorkspaceContext.tsx:799) never removes deleted items. This is a correctness concern only and is not a store blocker.

## Limits
I did not inspect store consoles, deployed rules, callers, or `app.json`, and I ran no tests.

VERDICT: CHANGES_REQUESTED

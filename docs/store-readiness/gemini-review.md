# Gemini independent review

Raw advisory output. Manager validation and corrections are in 2026-11-11.md; this is not a verified release checklist.

### Store Product Readiness Review

#### Store Blockers (8 Findings)

1. **Missing In-App Account & Cloud Data Deletion**
   - **Location**: [authService.ts](/Users/lou-anmarx/Pumpd/src/services/authService.ts:82), [settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L841-L944), [AuthModal.tsx](/Users/lou-anmarx/Pumpd/src/components/auth/AuthModal.tsx:229)
   - **Evidence**: Users can create Firebase Auth accounts via [`registerWithEmail`](/Users/lou-anmarx/Pumpd/src/services/authService.ts:82) and sync profile, workout, nutrition, and body-metric data to Cloud Firestore (`users/{uid}`), but there is no `deleteUser` implementation in `authService.ts`, no cloud user-data purge in `firestoreService.ts`, and no "Delete Account" action in Settings or `AuthModal` (only local test-log clearing at [settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L1038-L1085)).
   - **User Consequence**: Users cannot delete their registered account or erase personal health/fitness data stored in Firebase, which is an immediate rejection blocker for both Apple App Store and Google Play.
   - **Fix**: Implement a re-authenticated account deletion flow (`deleteUser(auth.currentUser)` plus deletion of `users/{uid}` and its subcollections `workouts`, `nutrition`, `bodyMetrics`, and local storage) and expose a clear "Delete Account" button in [settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L917-L944) and [AuthModal.tsx](/Users/lou-anmarx/Pumpd/src/components/auth/AuthModal.tsx:246).

2. **Fake/Mocked In-App Purchases & Unwired Restore Purchases**
   - **Location**: [inAppPurchaseService.ts](/Users/lou-anmarx/Pumpd/src/services/inAppPurchaseService.ts:22), [SeatUpgradeModal.tsx](/Users/lou-anmarx/Pumpd/src/components/coach/SeatUpgradeModal.tsx:128), [GraduationModal.tsx](/Users/lou-anmarx/Pumpd/src/components/coach/GraduationModal.tsx:160), [app/index.tsx](/Users/lou-anmarx/Pumpd/app/index.tsx:224)
   - **Evidence**: [`requestSubscriptionPurchase`](/Users/lou-anmarx/Pumpd/src/services/inAppPurchaseService.ts:22) only runs `setTimeout(..., 800)` and returns a fabricated active subscription without invoking StoreKit or Google Play Billing (no IAP library is installed in [package.json](/Users/lou-anmarx/Pumpd/package.json:15)). Meanwhile, [SeatUpgradeModal.tsx](/Users/lou-anmarx/Pumpd/src/components/coach/SeatUpgradeModal.tsx:410) explicitly claims *"Billed via Apple App Store / Google Play. Recurring monthly subscription."* Additionally, [`restorePurchases`](/Users/lou-anmarx/Pumpd/src/services/inAppPurchaseService.ts:64) is a no-op stub that is never called anywhere in the UI, and the `studio` ("Custom") tier dynamically calculates arbitrary prices (`R699 + R30 * extraSeats` at [SeatUpgradeModal.tsx](/Users/lou-anmarx/Pumpd/src/components/coach/SeatUpgradeModal.tsx:364)) mapped to a single fixed store SKU (`com.ripped.pt.studio.monthly`).
   - **User Consequence**: Users are shown live store billing claims and pricing (`R59/mo`, `R199–R1299+/mo`) that either grant entitlements without billing or misrepresent store transactions, and users have no "Restore Purchases" button in the UI.
   - **Fix**: Integrate a real store billing SDK (`react-native-iap` or `expo-iap` / RevenueCat) with fixed store SKUs or quantity billing, wire a visible "Restore Purchases" button in `SeatUpgradeModal` and `settings/index.tsx`, or remove/gate in-app purchase UI claims if billing is not shipping in v1.0.

3. **Zero Privacy Policy, Terms of Service, or Support Links in App UI**
   - **Location**: [app/index.tsx](/Users/lou-anmarx/Pumpd/app/index.tsx:224), [SeatUpgradeModal.tsx](/Users/lou-anmarx/Pumpd/src/components/coach/SeatUpgradeModal.tsx:408), [settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L998-L1086)
   - **Evidence**: No `Linking.openURL` or legal/support links exist anywhere in the codebase. Account sign-up ([app/index.tsx](/Users/lou-anmarx/Pumpd/app/index.tsx:543)), subscription upgrade ([SeatUpgradeModal.tsx](/Users/lou-anmarx/Pumpd/src/components/coach/SeatUpgradeModal.tsx:408)), and Settings ([settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L998-L1086)) contain no Privacy Policy, Terms of Use (EULA), or Support contact links.
   - **User Consequence**: Users cannot inspect data handling terms, subscription auto-renewal terms, or reach support before registering or subscribing.
   - **Fix**: Add working links (`expo-linking`) to the Privacy Policy, Terms of Service, and Support URL in the sign-up screen, subscription modal footer, and Settings screen.

4. **Missing iOS `bundleIdentifier` and Incomplete EAS Production Config**
   - **Location**: [app.json](/Users/lou-anmarx/Pumpd/app.json:15), [eas.json](/Users/lou-anmarx/Pumpd/eas.json:23), [firebase.ts](/Users/lou-anmarx/Pumpd/src/config/firebase.ts:10)
   - **Evidence**: `expo.ios` in [app.json](/Users/lou-anmarx/Pumpd/app.json:15) defines only `supportsTablet` and `userInterfaceStyle`, omitting `bundleIdentifier` and `infoPlist.ITSAppUsesNonExemptEncryption`. In [eas.json](/Users/lou-anmarx/Pumpd/eas.json:23), the `production` profile lacks the `node` and `NPM_CONFIG_LEGACY_PEER_DEPS` settings required by `preview` ([eas.json](/Users/lou-anmarx/Pumpd/eas.json:15)) and has no `channel` configured despite `expo-updates` being installed.
   - **User Consequence**: iOS EAS production builds cannot be generated or submitted, and Android/iOS production builds risk dependency resolution or OTA channel mismatches.
   - **Fix**: Set `expo.ios.bundleIdentifier` (e.g., `com.multiplier.ripped`) and `expo.ios.infoPlist.ITSAppUsesNonExemptEncryption: false` in `app.json`, and align `build.production` in `eas.json` with a production `channel`, `node` version, and peer-deps config.

5. **Unnecessary `RECORD_AUDIO` Permission Requested on Android**
   - **Location**: [app.json](/Users/lou-anmarx/Pumpd/app.json:27), [app.json](/Users/lou-anmarx/Pumpd/app.json:38), [QRCodeScannerModal.tsx](/Users/lou-anmarx/Pumpd/src/components/QRCodeScannerModal.tsx:134)
   - **Evidence**: [app.json](/Users/lou-anmarx/Pumpd/app.json:30) explicitly requests `"android.permission.RECORD_AUDIO"`, and the `expo-camera` config plugin ([app.json](/Users/lou-anmarx/Pumpd/app.json:39)) does not set `"recordAudioAndroid": false`. The app only uses `CameraView` for silent QR code scanning.
   - **User Consequence**: Users and store reviewers face an unexplained microphone permission manifest declaration for a fitness/QR feature that never records audio.
   - **Fix**: Remove `"android.permission.RECORD_AUDIO"` (and duplicate `"CAMERA"`) from `expo.android.permissions` and set `"recordAudioAndroid": false` in the `expo-camera` plugin options in [app.json](/Users/lou-anmarx/Pumpd/app.json:39).

6. **Nutrition & Calorie Prescriptions Lack Health/Medical Disclaimers and Sources**
   - **Location**: [ProteinRecommendationCard.tsx](/Users/lou-anmarx/Pumpd/src/components/nutrition/ProteinRecommendationCard.tsx:124), [tdee.ts](/Users/lou-anmarx/Pumpd/src/utils/tdee.ts:181), [nutrition/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/nutrition/index.tsx#L164-L179)
   - **Evidence**: [ProteinRecommendationCard.tsx](/Users/lou-anmarx/Pumpd/src/components/nutrition/ProteinRecommendationCard.tsx:129) cites *"Schoenfeld & Phillips Hypertrophy Range"* and *"Muscle protein synthesis (MPS) plateaus between 1.6–2.2 g/kg"* without clickable source citations or a medical disclaimer, and [nutrition/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/nutrition/index.tsx#L169-L179) plus coach macro prescriptions ([UserWorkspaceContext.tsx](/Users/lou-anmarx/Pumpd/src/context/UserWorkspaceContext.tsx:127)) prescribe daily calorie/macro targets down to 1,200 kcal ([tdee.ts](/Users/lou-anmarx/Pumpd/src/utils/tdee.ts:185)) without any educational/medical disclaimer.
   - **User Consequence**: Users may treat automated TDEE or coach macro prescriptions as medical/clinical nutrition advice without citations or safety disclaimers.
   - **Fix**: Add an explicit medical/educational disclaimer ("For informational and educational purposes only; consult a physician or registered dietitian before changing your diet or training program") and full bibliographic links/references on the Nutrition and Settings screens.

7. **Production Settings Screen Exposes Developer Demo & Test Data Controls**
   - **Location**: [settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L998-L1086), [UserWorkspaceContext.tsx](/Users/lou-anmarx/Pumpd/src/context/UserWorkspaceContext.tsx:202)
   - **Evidence**: The Settings screen displays a "Device Local Storage" card with buttons labeled **"Clear Test Logs"** and **"Reset Defaults"** (*"Reset all accounts, splits, exercises, and logs to initial factory demo state?"* at [settings/index.tsx](file:///Users/lou-anmarx/Pumpd/app/(tabs)/settings/index.tsx#L1038-L1085)), and initializes fallback profile state to `Alex Johnson` (`alex@ripped.app`).
   - **User Consequence**: Real users can accidentally wipe their workspace or reset their app into a hardcoded demo persona, signaling an unfinished test build to store reviewers.
   - **Fix**: Gate test/demo reset controls behind `__DEV__` or replace them with user-facing "Clear Local Cache" and proper "Delete Account" actions, and remove hardcoded `Alex Johnson` fallback identity for authenticated users.

8. **Invalid React / React Native / Expo Package Versions in `package.json`**
   - **Location**: [package.json](/Users/lou-anmarx/Pumpd/package.json:20)
   - **Evidence**: [package.json](/Users/lou-anmarx/Pumpd/package.json:20) specifies non-existent/mismatched versions (`"expo": "~58.0.23"`, `"react": "19.3.0"`, `"react-native": "0.88.1"`, `"typescript": "~6.0.3"`), while [eas.json](/Users/lou-anmarx/Pumpd/eas.json:17) forces `"NPM_CONFIG_LEGACY_PEER_DEPS": "true"` only in `preview`.
   - **User Consequence**: Clean cloud builds on EAS `production` or `expo doctor` checks can fail or produce runtime native bridge crashes on store submission binaries.
   - **Fix**: Align `expo`, `react`, `react-native`, and `expo-*` packages via `npx expo install --fix` and verify with `npm run type-check` and a clean EAS production build.

---

#### Review Access & Verification Notes
- **Review Access**: [app/index.tsx](/Users/lou-anmarx/Pumpd/app/index.tsx:585) provides immediate guest access for both roles (*"Try as Guest (Athlete Demo)"* and *"Try as Coach (Trainer Pro Demo)"*), which helps reviewers explore offline features, though cloud sync, coach-client claiming (`RIP-XXXX` PIN), and live Co-op (`GymJam`) still require two active sessions/accounts and reviewer instructions in App Store Connect / Play Console.
- **Verification Limits**: Per read-only reviewer constraints, no files were modified, no builds/tests were executed, and external store consoles or Firebase rules were not queried.

VERDICT: CHANGES_REQUESTED

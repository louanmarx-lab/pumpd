# RIPPED release activation

Local release remediation is implemented. **Do not submit to either store yet.** The website is private at the user's request, real store credentials are not configured, and the new backend has not been deployed. The owner authorized pushing the app changes to GitHub on 17 November 2026. That push does not activate the backend, publish an OTA, or create a signed APK. On 17 November the owner authorized OTA for a new preview APK; see [preview APK/OTA setup](../releases/2026-11-17-preview-apk-ota.md) for the current configuration and access blocker.

## Human-owned setup

A guided helper is available at `/private/tmp/ripped-store-setup.sh`. Run it from Terminal with `bash /private/tmp/ripped-store-setup.sh`. It opens the relevant dashboards and captures only public SDK keys in ignored `.env.local`. It does not create purchases, collect secret keys, deploy, or push. This is an ephemeral helper; this document is the persistent setup reference.

1. Confirm app identities against any existing store records before creating new records. Local iOS bundle ID and Android package are both `com.multiplier.ripped`. Production builds increment the remote build version. Do not change a previously published identifier to match this repository without checking its existing listing.
2. Connect Apple and Google store apps to RevenueCat using the [official Expo guide](https://www.revenuecat.com/docs/getting-started/installation/expo). Account agreements, service pricing and any charges must be accepted by the user. No RevenueCat account or paid service was created automatically.
3. Create monthly subscription products and attach them to active entitlements in RevenueCat. Put the Apple products in one subscription group. Confirm Google base plans, pricing, upgrade behavior and notification configuration. Use the same Firebase UID as the RevenueCat app user ID across devices. Review restore/transfer behavior to prevent unintended cross-account transfers.

| Plan | iOS product | Google subscription ID | Coach seats |
| --- | --- | --- | --- |
| Athlete | `com.ripped.athlete.monthly` | `ripped_athlete_monthly` | 0 |
| Entry | `com.ripped.pt.starter.monthly` | `ripped_pt_starter_monthly` | 5 |
| Standard | `com.ripped.pt.standard.monthly` | `ripped_pt_standard_monthly` | 15 |
| Pro | `com.ripped.pt.pro.monthly` | `ripped_pt_pro_monthly` | 30 |
| Studio | `com.ripped.pt.studio.monthly` | `ripped_pt_studio_monthly` | 50 |

Studio is a fixed 50-seat product. Arbitrary per-seat pricing and fabricated 7-day trials were removed. Any real introductory offer must be configured and tested through the stores. The UI obtains localized prices from the store and handles Google replacement subscriptions; backend verification controls access.

4. Add the platform-specific **public SDK keys** to ignored `.env.local` using `.env.example`. Never put RevenueCat secret keys in an `EXPO_PUBLIC_*` variable. Production builds also need these public values in the chosen EAS build environment. The new preview APK is configured for OTA as requested on 17 November; use the preview environment consistently for its builds and updates. See the preview APK/OTA setup above.
5. Obtain a domain. The preview at `https://ripped-fitness-support.louanmarx.chatgpt.site` remains owner-private, as explicitly requested. The website has privacy, terms, support and authenticated deletion pages. Its independent source repository is managed by Sites/Cloudflare and is ignored by the app repository; the app repository was not pushed. Update `EXPO_PUBLIC_LEGAL_SITE_URL` to the public HTTPS origin when ready. Add the monitored support email and verified operator/business details to the legal pages before launch. The support-email reminder is set for 12 November 2026, 09:00 Africa/Johannesburg.

## Backend activation — review before deploying

Code: `functions/index.js`, `functions/domain.js`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`.

The app now calls secure functions for billing verification, admission to shared workouts, trainer invitations, server-authoritative roster relationships/seats, support and account deletion. Those features report unavailable until the functions are activated. Guest/local workout logging still works in Expo Go. Support/deletion website forms never report success without a confirmed server response.

- Use an isolated test Firebase project first. Cloud Functions/Secret Manager/TTL may require billing on the user's Google account; enabling it is a user decision. No cloud billing plan was changed.
- Configure a RevenueCat **REST API v1-compatible secret** with subscriber read/delete permission in Firebase Secret Manager as `REVENUECAT_SECRET_KEY`. Configure a separate strong webhook bearer secret as `REVENUECAT_WEBHOOK_SECRET`. Do not commit either value. [RevenueCat key guidance](https://www.revenuecat.com/docs/projects/authentication).
- Deploy functions, rules and TTL/index configuration together only after reviewing the migration below. Set the RevenueCat webhook to the deployed `revenueCatWebhook` HTTPS endpoint with its bearer authorization secret. Test cancellation, renewal, refunds, revocations and account transfer events against that endpoint.
- `ENFORCE_APP_CHECK` remains false until native/web App Check providers are configured and tested. Authentication, recent reauthentication for deletion, rate limits, server ownership checks and Firestore rules still apply. Do not enable enforcement without a valid client attestation flow, including decisions about Expo Go testing.
- TTL config covers support requests (eligible after 90 days), short-lived abuse counters (after two hours) and deletion locks (after two days). Cleanup is asynchronous, not an exact-time guarantee. Shared workout admission expires after six hours even if the document remains until account cleanup.
- The support form saves requests in private `support_requests`; the owner must monitor them. Automated email delivery is not configured. No outgoing messages were sent.
- Account deletion removes Auth and owned cloud records, associated claims/rooms, authored shared programs, trainer links and shadow client records. It cleans RevenueCat identity records, blocks stale writes with a short-lived server lock, and signs out/cleans this account's local data in the app. It does **not** cancel Apple or Google billing. Both app and website warn users to cancel separately.

### Existing data must be reviewed before changing production rules

Previous client-created invite records and paid flags are not trustworthy authorization. The new rules do not honor legacy claim codes, locally fabricated subscriptions or self-authored linked IDs.

Before a rollout, identify the verified coach accounts and existing legitimate athlete links. Verify paid entitlements from store/RevenueCat records. Rebuild `shadow_owners`, `coach_links`, and `coach_seats` from that reviewed data using trusted administrative access; never automatically grant access just because an old roster lists a UID. Legacy shadow profiles that already exist need reviewed ownership migration before `registerShadowClient` will accept them. Export/back up data before the cutover. This migration was not executed because production access and verified ownership evidence were not supplied.

Existing room codes must be regenerated using the secure server-created invitations. New trainer invitations are single-use, last 24 hours and are activated before sharing. Redemption imports records without overwriting the athlete's existing entries; same-day nutrition is merged while preserving existing water totals and macro targets. A single atomic redemption currently supports up to 350 source history records; larger accounts are rejected explicitly and need an administrative migration rather than a partially completed claim.

### Suggested activation commands (not executed)

After the account owner reviews the project and any costs, provides secret values and approves backend deployment:

```sh
firebase functions:secrets:set REVENUECAT_SECRET_KEY --project ripped-a5726
firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET --project ripped-a5726
firebase deploy --only functions:ripped-release,firestore --project ripped-a5726
```

These commands change live infrastructure. They are documentation, not an instruction that the assistant has already performed them. Domain attachment/public access, signed production builds and store submissions are separate actions.

## Verification performed and remaining

Completed tests and exact current status are recorded in `implementation-2026-11-11.md`. Unit tests use mocked transports; authorization and transaction tests use the Firestore emulator with the `demo-ripped-release` project. RevenueCat and Auth deletion are mocked in backend integration tests. No test called production Firebase, charged a store purchase or deleted a real account.

Before submission, complete real iOS/Google sandbox purchase/restore/cancel/renew/refund tests with signed development/store builds. Expo Go is suitable for UI and local workout testing; it does not verify native billing. Confirm final IPA/AAB launch, final native permissions, actual SDK/target versions and 16 KB compatibility. Complete Apple App Privacy, Google Data safety and Health apps declarations, age/content ratings, public legal/deletion URLs, review accounts and two-user feature instructions. Keep the hold verdict until those checks produce evidence.

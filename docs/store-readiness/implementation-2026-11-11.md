# Release remediation — 11 November 2026

**Status: local implementation completed; store submission remains on hold.** Backend services and real store products/credentials are not activated. The website remains private by the owner's explicit request while a domain is obtained. No app GitHub push, OTA release, store submission, live purchase or production account deletion was performed.

## Implemented

- Replaced simulated purchases/restores with native RevenueCat/store transactions, localized prices, verified server entitlements and fixed seat products. Expo Go/web never simulate a successful purchase. Removed fabricated trials and pricing. Added restore, subscription-management, renewal information and legal links.
- Added authenticated backend billing verification/webhook, cryptographic workout and trainer invitations, atomic guest admission, single-use trainer linking, ownership verification, and authoritative paid seat/roster enforcement. Client-written roles and roster IDs cannot grant access.
- Preserved an athlete's existing history and macro targets when importing trainer history; merged nutrition without raising existing water values or overwriting meals. Revoked invitation replay and switching between two live roster entries are rejected.
- Added durable owner-scoped cloud outboxes, retry/error reporting, correct server deletion reconciliation and protection against account-switch/deletion races. Permanent failures remain visible without blocking unrelated queued writes.
- Added reauthenticated account deletion, server deletion locks, RevenueCat identity cleanup, Auth/cloud/local-data removal and explicit separate subscription-cancellation instructions. Deletion failures remain retryable. Deleting a linked athlete releases their paid trainer seat. Unlinking or deleting a trainer preserves independently paid athlete access.
- Added Firestore rules, index/TTL configuration, consent/privacy/support UI, gated development controls, restrained fitness guidance, native identity/build configuration and reduced Android permissions. Native OTA updates are disabled.
- Added a separate support website with privacy, terms, support and authenticated deletion pages. Its forms wait for actual backend confirmation. Support requests go to a private queue; automatic email delivery is not configured.
- Updated compatible dependencies and documented the supported Node runtime. Audits at implementation time reported zero high/critical root issues (seven moderate remain), and zero functions-package issues. A bundle export does not establish native binary compatibility.

## Independent AI-team evidence

The subscription-only AI Team bridge was used with quota preflight and no paid API fallback. Managed Orkestra runs were attempted in an isolated snapshot; the first failed verification and the bounded retry produced no usable integration diff. No generated patch was accepted from those runs. Codex implemented the changes and tests in the existing checkout.

Claude's substantive source review found eight issues, including claim replay, seat enforcement, deletion races and queue corruption; those were corrected. A follow-up Claude call returned only an acknowledgement and is not counted as approval. Gemini's final source review found four additional issues: leaked seats after athlete deletion, same-coach duplicate links, paid solo access lost during unlinking, and coach writes during target deletion. All four were corrected and received executable regression coverage. Neither reviewer certified a deployed service or final signed build. Reports retain their original CHANGES_REQUESTED verdicts against the reviewed revisions:

- [Claude remediation review](claude-remediation-review.md)
- [Gemini remediation review](gemini-remediation-review.md)

## Verification

| Check | Result and limits |
| --- | --- |
| TypeScript | `npm run type-check` passes |
| Release unit tests | 11 pass: durable queue, coalescing, account isolation, deletion protection, reconciliation, billing failure paths and local cleanup |
| Backend domain tests | 4 pass: entitlement expiry/product validation, recent authentication, secure codes and admission |
| Firestore rules emulator | 8 pass: owner isolation, protected fields, trusted coach seats/links, deletion locks, invitation privacy and room restrictions |
| Backend transaction integration | 8 pass: seat caps, history preservation, claim replay/relink rejection, concurrent admission, billing/deletion race, retryable partial deletion, roster integrity, paid solo preservation and seat cleanup |
| All-platform Expo export | iOS, Android and web bundles pass using Node 24; no signed IPA/AAB produced |
| Native configuration introspection | Bundle ID present; Android CAMERA/INTERNET only, microphone permission absent, native Updates disabled |
| Whitespace | `git diff --check` passes |
| Website | Local home/deletion pages inspected; hosted preview visibly requires login and remains private |

**31 tests pass in total.** Emulator tests use `demo-ripped-release`; backend integration uses real emulator transactions but mocks Auth and RevenueCat. Unit tests use mocked transports. No test reached production Firebase, purchased a product or deleted a real account. Expected PERMISSION_DENIED messages appear in negative authorization tests.

## Activation work before submission

Follow [activation.md](activation.md). Required external work includes verified store identifiers/product records, RevenueCat public keys and server secrets, reviewed migration of legitimate existing links/seats, coordinated backend/rules deployment, a public domain and accessible legal/deletion URLs, verified business details and support email, signed native sandbox billing tests, and final store declarations/review accounts. Native purchases cannot be tested in Expo Go; local/UI flows can.

The private website is [RIPPED support preview](https://ripped-fitness-support.louanmarx.chatgpt.site). Its independent Sites repository is not the app's GitHub repository. Keep it private until the owner requests the audience change. The app currently links to this private preview unless `EXPO_PUBLIC_LEGAL_SITE_URL` is configured, so public legal accessibility remains a launch blocker.

Support email reminder: 12 November 2026 at 09:00 Africa/Johannesburg. No support email or operator identity was invented. Trainer histories above the atomic 350-record import cap require reviewed administrative migration; they fail explicitly rather than partially importing.

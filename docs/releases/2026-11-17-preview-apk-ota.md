# Preview APK and OTA setup — 17 November 2026

The owner requested a new Android APK with OTA updates enabled. This supersedes the earlier instruction to keep OTA disabled. The owner subsequently authorized pushing the current app changes to GitHub on 17 November 2026. This does not publish an APK or OTA update.

## Prepared locally

- App version 1.0.1; native OTA enabled with checks on launch and immediate fallback to the embedded/cached bundle while an update downloads.
- Runtime policy `fingerprint` prevents updates from matching older native builds or builds with different native dependencies. Native changes still require a new APK.
- Internal Android APK build profile `preview`, channel `preview`, environment `preview`, remote version-code increment enabled.
- Build and update scripts invoke pinned official EAS CLI 27.10.0; no globally installed `eas` command is required.
- The EAS upload ignore file excludes the separate website, backend, tests, documentation and local environment/credential files. Public build values must be configured in the EAS preview environment.

## Current blocker

EAS project `5d872213-25f7-4a4c-b1b6-753d3c67634d` belongs to `loubrytsite`. The current Expo session is `lou-an`; Expo denies READ access to that project. No APK build has been created and no OTA has been published. The project has not been disconnected, transferred or replaced. Sign in with an account that already has access, or provide the correct project link if ownership changed.

```sh
npx eas-cli@27.10.0 login
npm run build:apk
```

Install the completed APK once on the Android device. Keep the signing key consistent with the installed app to preserve upgrade capability and local data; do not uninstall merely to bypass a signing mismatch.

For future JavaScript/UI changes compatible with that APK:

```sh
npm run update -- --message "Describe the changes"
```

This targets Android on the preview channel using the preview environment. It uploads to Expo, not GitHub. Open the app online to download an update, then fully close and reopen it to apply it. A changed fingerprint requires another native build. This setup does not enable updates in an already installed APK whose native updates support is disabled.

Store purchases, secure backend services and legal/support activation retain the limitations recorded in [release activation](../store-readiness/activation.md). An APK build does not deploy Firebase functions or make the private website public.

Official references: [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/), [build profiles](https://docs.expo.dev/build/eas-json/).

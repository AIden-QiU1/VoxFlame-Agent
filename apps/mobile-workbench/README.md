# VoxFlame Mobile Workbench

Expo / React Native shell for the full mobile workbench.

## Direction

This app is not a thin WebView companion. It is the native mobile surface for:

1. `communication` - quick talk and LiveKit communication sessions.
2. `practice` - native recording, local queue, retry, upload receipt.
3. `memory` - workspace snapshot, prepared expressions, high-frequency phrases.
4. `device` - mic permission, sync state, local files, future hardware bridge.

The app must reuse backend-owned contracts:

1. `workspace snapshot`
2. `recording envelope`
3. `upload receipt`
4. `RTC session orchestration`

## Setup

```bash
cd apps/mobile-workbench
npm install
```

Local environment values are public-client only. Do not commit `.env` files.

```bash
EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3001/api
EXPO_PUBLIC_SUPABASE_URL=<supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

For LiveKit, the app calls backend `/api/rtc/session/start`; it does not hold LiveKit API secrets.

## Communication Session

The communication surface now includes the first backend-orchestrated RTC slice:

1. `src/realtime/use-mobile-rtc-session.ts` calls backend `/api/rtc/session/start`.
2. The app receives room metadata, readiness, and participant token from backend.
3. The UI displays room/readiness state but never renders the participant token.
4. `src/realtime/use-livekit-room-connection.ts` starts the LiveKit React Native `AudioSession`, connects the room, and publishes microphone audio.
5. Real-device room smoke is still required before declaring communication complete.

## Commands

```bash
npm run check
npm run typecheck
npm run start
npm run export:android
npm run build:android:development
npm run build:android:preview
npm run build:android:china-store
npm run smoke:device-env
```

The LiveKit React Native SDK requires a development build or prebuild path once the real room view is enabled.
Web export is not part of the current smoke path; add `react-dom` and `react-native-web` explicitly if browser preview becomes a product requirement.

## Device Verification

Early app verification does not require App Store or Google Play release. The current order is:

1. Static checks and Android bundle export.
2. Development build on a physical Android phone first, then iPhone.
3. Real-device smoke for login, workspace read, recording, playback, upload receipt, and LiveKit quick talk.
4. Small tester distribution through EAS internal distribution, TestFlight, or Google Play internal testing.
5. Formal store release only after privacy, deletion, medical wording, permission copy, and beta feedback are ready.

Run the environment preflight before opening the app on a phone:

```bash
npm run smoke:device-env
```

For a physical phone, `EXPO_PUBLIC_API_BASE_URL` should usually point at your computer's LAN address, for example `http://<lan-ip>:3001/api`, not `http://127.0.0.1:3001/api`.

See [Mobile Workbench Device Verification Runbook](../../docs/VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md).

## Real Account Smoke

This checks the mobile app's real dependency chain without storing credentials:

```bash
MOBILE_WORKBENCH_SMOKE_EMAIL=<account-email> \
MOBILE_WORKBENCH_SMOKE_PASSWORD=<account-password> \
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001/api \
npm run smoke:real-workspace
```

It signs in through Supabase Auth, calls backend `/api/memory/workspace/:userId`, and verifies that the mobile read model can depend on the existing backend owner.

## Native Recorder Queue

The practice surface uses Expo-native APIs:

1. `expo-audio` for microphone permission, audio mode, recording, and local playback.
2. `expo-file-system` document storage for persistent local queue files.

Current local paths:

```text
Paths.document/voxflame-recorder-queue/queue.json
Paths.document/voxflame-recorder-queue/audio/
```

The queue now includes the first backend upload receipt slice:

1. `src/api/mobile-upload-client.ts` calls `/api/upload/sign`, PUTs the local audio file to OSS, then calls `/api/upload/complete`.
2. Successful uploads persist `uploadReceipt` on the queue item and move it to `uploaded`.
3. Failed uploads keep the local file, store `lastError`, and move the item to `failed` for retry or deletion.

Native-device smoke is still required before declaring the full recorder/upload loop complete.

## Android Install

There is no App Store / Google Play download yet. Install the Android test app through an EAS build link.

Use a development build when you want to connect the phone to your local Expo server:

```bash
cd apps/mobile-workbench
npx eas login
npx eas env:create --environment development --visibility plaintext --name EXPO_PUBLIC_API_BASE_URL --value http://<your-lan-ip>:3001/api
npx eas env:create --environment development --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <supabase-url>
npx eas env:create --environment development --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <supabase-anon-key>
npm run smoke:device-env
npm run build:android:development
```

Use a preview build when you want a directly installable APK that does not need the local Expo dev server:

```bash
cd apps/mobile-workbench
npx eas login
npx eas env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_API_BASE_URL --value http://<reachable-api-host>:3001/api
npx eas env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <supabase-url>
npx eas env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <supabase-anon-key>
npm run smoke:device-env
npm run build:android:preview
```

After EAS finishes, open the build page and tap **Install**, or scan the QR code shown by Expo. On Android, the normal phone Camera app usually works: scan the QR code, open the link in the browser, download the APK, allow installation from the browser if Android asks, then install.

The app environment is public-client only. Before building for a real phone, set `EXPO_PUBLIC_API_BASE_URL` to the computer or server address the phone can reach, such as `http://192.168.1.23:3001/api`. Do not use `127.0.0.1` for a physical phone.

Remote EAS builds do not automatically receive your uncommitted local `.env`, so configure the `EXPO_PUBLIC_*` values in EAS before cloud builds. These values are public client configuration; never add service role keys, LiveKit API secrets, DashScope keys, or OSS secrets.

## China App Stores

Domestic Android stores need a release APK, not a development build. Use:

```bash
cd apps/mobile-workbench
npx eas login
npx eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_API_BASE_URL --value https://<production-api-host>/api
npx eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <supabase-url>
npx eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <supabase-anon-key>
npm run build:android:china-store
```

Upload the generated APK to Xiaomi, Huawei AppGallery Android distribution, OPPO, vivo, or other Android app stores after store-specific review materials are ready.

Huawei / HarmonyOS has two tracks:

1. Huawei AppGallery Android app: use the APK generated above.
2. HarmonyOS NEXT native app: this React Native Android APK is not enough; a separate HarmonyOS-native implementation or port is required.

Before store submission, prepare privacy policy, user agreement, account deletion/data deletion instructions, microphone permission explanation, screenshots, app icon, app description, ICP/website information if required, and medical wording that says communication/training assistance only.

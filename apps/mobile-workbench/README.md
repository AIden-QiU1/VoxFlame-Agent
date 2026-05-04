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

## Commands

```bash
npm run check
npm run typecheck
npm run start
```

The LiveKit React Native SDK requires a development build or prebuild path once the real room view is enabled.

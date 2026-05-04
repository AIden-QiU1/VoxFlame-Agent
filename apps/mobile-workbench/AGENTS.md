# Mobile Workbench Agent Guide

This subtree owns the Expo / React Native mobile workbench.

Rules:

1. Treat `mobile_workbench` as the only mobile app surface id.
2. Do not import Next.js `frontend` modules directly. Extract or mirror stable contracts first.
3. Never put LiveKit server secrets, Supabase service role keys, provider keys, or backend private env values in the app.
4. RTC sessions must go through backend `/api/rtc/session/*`; the app only receives participant URL/token from backend.
5. Recorder queue files are local cache until backend returns an upload receipt. The mobile app is not a durable owner.
6. Background recording, background sync, SMS, phone calls, location, Bluetooth, and hardware events must stay explicit, visible, and user-confirmed.
7. Keep the four first-class surfaces aligned: `communication`, `practice`, `memory`, `device`.

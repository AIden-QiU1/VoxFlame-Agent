# VoxFlame Mobile Workbench Phase 0 RFC（2026-05-04）

## 1. 决策

VoxFlame 开始建设完整移动端工作台，目录为：

```text
apps/mobile-workbench
```

移动端不是当前 Next.js Web 的 WebView 包装，也不是薄 companion。它是第一等产品 surface，但必须继续复用现役事实源：

```text
mobile_workbench
  -> backend /api/*
  -> backend /api/rtc/session/*
  -> self-hosted livekit-server
  -> livekit_agent
```

## 2. 技术主线

默认技术路线：

1. `Expo / React Native`
2. `@livekit/react-native`
3. Supabase React Native auth adapter
4. 原生 recorder queue
5. backend-orchestrated LiveKit token

`Capacitor` 只保留为 WebView 原型或过渡方案，不作为完整移动端工作台主线。

## 3. 四个一级 surface

### 3.1 Communication

职责：

1. quick talk
2. 一键开口
3. LiveKit room
4. 连接、中断、断网、切后台状态

不得做：

1. 不直接保存 LiveKit API secret。
2. 不绕过 backend 自签 token。

验收信号：

1. app 能向 backend 发送 `surface = mobile_workbench` 的 RTC intent。
2. backend 返回 LiveKit participant token。
3. app 显示 room 连接状态和可退出状态。

### 3.2 Practice

职责：

1. 真机录音。
2. 本地文件落盘。
3. 生成移动端 recording envelope。
4. 本地 queue。
5. 断网补传。
6. 后端 upload receipt。

不得做：

1. 不新增第二套训练样本 schema。
2. 不把本地队列变成 durable owner。

验收信号：

1. Android / iPhone 真机各录一条。
2. 断网后本地可见。
3. 恢复网络后同一条 recording retry 不重复写 manifest。

### 3.3 Memory

职责：

1. 读取 `workspace snapshot`。
2. 展示 active prepared expression。
3. 展示高频短句和保底句。
4. 后续支持低风险置顶、收藏、最近使用。

不得做：

1. 不复制 Web 记忆页整套 UI。
2. 不私自新增 workspace owner。

验收信号：

1. 真实账号能读取 prepared expression。
2. Web 和 App 看到同一份 active asset。

### 3.4 Device

职责：

1. 麦克风权限状态。
2. 本地队列状态。
3. 删除本地未上传录音。
4. 补传失败原因。
5. 后续 BLE / USB / 外接麦事件。

不得做：

1. 不在后台偷偷录音。
2. 不让硬件事件直接触发高风险副作用。

验收信号：

1. 用户能看见录音权限和本地队列。
2. 用户能手动删除本地未上传录音。

## 4. 已落地的 Phase 0 代码边界

本轮已新增：

1. `apps/mobile-workbench/package.json`
2. `apps/mobile-workbench/app.json`
3. `apps/mobile-workbench/App.tsx`
4. `apps/mobile-workbench/src/constants/surfaces.ts`
5. `apps/mobile-workbench/src/contracts/workbench-contracts.ts`
6. `apps/mobile-workbench/src/contracts/workspace-read-model.ts`
7. `apps/mobile-workbench/src/realtime/rtc-session-intent.ts`
8. `apps/mobile-workbench/src/queue/recorder-queue-policy.ts`
9. `apps/mobile-workbench/scripts/check-mobile-workbench.mjs`

同时现役 RTC / recording contract 已把移动端 surface 收口为：

```text
mobile_workbench
```

## 5. 下一步实现顺序

当前 App 验证不需要先打包上架到 App Store 或 Google Play。Phase 0 的验收梯度是：

1. 代码级检查和 Android bundle export。
2. 真机 development build。
3. 真机登录、workspace read、录音、回放、上传 receipt、LiveKit quick talk smoke。
4. 小范围内测分发。
5. 正式商店上架。

详细步骤见 [Mobile Workbench 真机验证手册（2026-05-05）](VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)。

Android 当前已提供 EAS 构建入口：

```bash
cd apps/mobile-workbench
npm run build:android:development
npm run build:android:preview
```

构建完成后，通过 EAS build 页面里的 Install 链接或二维码在 Android 手机上下载安装 APK。手机通常用系统相机扫码，最终会在浏览器里打开下载页。

### Step 1：依赖安装与 Expo smoke

目标：

1. `cd apps/mobile-workbench && npm install`
2. `npm run check`
3. `npm run typecheck`
4. `npm run start`

验收：

1. Expo shell 可启动。
2. 四个 tab 可切换。
3. 没有旧移动端 surface id 残留。

当前状态：

1. `npm install --package-lock-only` 已成功生成 lockfile。
2. `npm install --ignore-scripts --no-audit --prefer-offline` 已完成依赖安装。
3. `npm run check` 已通过。
4. `npm run typecheck` 已通过。
5. Expo dev server 已用 `/tmp/voxflame-expo-home` 启动在 `http://localhost:8123`，`/status` 返回 `packager-status:running`。
6. Docker 核心栈已重新 build / up，`backend` 与 `frontend` compose health 均为 healthy，`/health` 与 `/api/rtc/health` 均返回 OK。
7. Android Metro bundle export 已通过：`HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-android-export-20260504-stage2`。
8. Web export 当前不作为 smoke 路径；package 已移除 `web` script，避免在未声明 `react-dom / react-native-web` 依赖时误导验证。
9. 真机 smoke 尚未完成；下一步进入 Native recorder queue / LiveKit room 前应做一次设备预览。
10. 依赖安装期间出现 LiveKit 依赖链 React peer warning，需在后续 Native LiveKit 接入前复核。

### Step 2：Auth adapter

目标：

1. 接入 Supabase React Native auth。
2. 用 AsyncStorage / SecureStore 持久化 session。
3. 提供 `MobileAuthTokenProvider`。

验收：

1. 登录后能拿 access token。
2. token 不进日志。
3. 退出登录后本地 session 清除。

当前状态：

1. 已新增 `src/auth/mobile-supabase-client.ts`，按官方 React Native 路径使用 `@react-native-async-storage/async-storage` 作为 Supabase session storage，启用 `autoRefreshToken / persistSession`，并关闭 `detectSessionInUrl`。
2. 已新增 `src/auth/use-mobile-auth.ts`，提供 `signInWithPassword / signOut / MobileAuthTokenProvider`。
3. 已新增 `src/auth/mobile-auth-hint-storage.ts`，只把 last email 这类小型提示放入 `expo-secure-store`；不把整份 Supabase session 塞进 SecureStore，避免单值大小限制与刷新边界不清。
4. `App.tsx` 已有登录卡片、状态展示、退出登录和 token provider 接入。
5. 真实账号 smoke 已通过：取消 `NODE_TLS_REJECT_UNAUTHORIZED` 后，测试账号可通过 Supabase Auth 登录，并能带 token 读取本地 Docker backend 的 workspace snapshot。
6. 自动化验证已覆盖 typecheck、mobile check 与 Android Metro bundle export；真机登录 UI 尚未手动 smoke。

### Step 3：Workspace snapshot read

目标：

1. 调用 `GET /api/memory/workspace/:userId`。
2. 用 `selectMobileWorkspaceReadModel` 提取移动端显示模型。
3. 展示 prepared expression 和 quick phrases。

验收：

1. 真实账号可读。
2. Web 记忆页和 App 读到同一个 active prepared expression。

当前状态：

1. 已新增 `src/workspace/use-mobile-workspace.ts`，登录后通过 `GET /api/memory/workspace/:userId` 读取 backend-owned snapshot。
2. `App.tsx` 已把 `selectMobileWorkspaceReadModel` 接到准备材料、快捷短句和今日练习目标展示。
3. 缺少 API、未登录、同步中、同步失败、已同步都有显式 UI 状态。
4. 当前真实账号 smoke 返回 `workspaceStatus=200`、`hasPreparedExpression=true`、`dailyTarget=20`。
5. 当前仍是只读接入；写入 prepared expression、quick phrase 或 profile memory 继续留给后续阶段。

## 5.1 Web / App 架构关系

App 不应该依赖 Web / Next.js 运行时，也不应该复用 Web 页面作为长期主线。

默认架构关系：

```text
Web / PWA client
  -> backend-owned contracts

Expo / React Native app client
  -> backend-owned contracts

backend
  -> Supabase / LiveKit / upload / workspace owner
```

也就是说，Web 和 App 是两个 sibling client：

1. 可以共享 contract、schema、测试样本和产品判断。
2. 不共享浏览器 cookie、Next.js middleware、DOM audio、PWA service worker 或页面组件。
3. App 需要自己的 auth storage、native permission、recording queue、app lifecycle 和 LiveKit audio session adapter。
4. 真正需要稳定的是 backend contract，而不是让 App 依赖 Web 的实现细节。

### Step 4：Native recorder queue

目标：

1. 真机录音。
2. 本地文件 URI + metadata。
3. upload sign / complete。
4. 失败进入本地 queue。

验收：

1. 真机录音可回放。
2. 断网补传可见。
3. 后端 upload receipt 可见。

当前状态：

1. 已按 Expo 官方 `expo-audio` 路线接入 `useAudioRecorder / useAudioRecorderState / AudioModule.requestRecordingPermissionsAsync / setAudioModeAsync`。
2. 已按 Expo `expo-file-system` document storage 路线新增 `src/queue/native-recorder-storage.ts`：
   - 队列文件：`Paths.document/voxflame-recorder-queue/queue.json`
   - 音频目录：`Paths.document/voxflame-recorder-queue/audio`
   - 录音临时 URI 会复制为持久本地文件
3. 已新增 `src/queue/use-native-recorder-queue.ts`：
   - 麦克风权限检查 / 请求
   - 开始录音 / 停止录音
   - 生成 `recording envelope`
   - 本地 queue 读取、追加、丢弃、标记 `upload_pending`
   - 调用现有 upload sign / complete 链
   - 最近一条录音回放
4. `App.tsx` 的练习 surface 已接上：
   - 本次练习句输入
   - 权限按钮
   - 录音 / 停止并保存
   - 回放
   - 上传 / 上传中 / 已上传状态
   - 丢弃
   - 本地 / 待传 / 失败统计
5. 已新增 `src/api/mobile-upload-client.ts`：
   - 复用 backend `/api/upload/sign`
   - PUT 本地音频文件到 OSS signed URL
   - 调用 backend `/api/upload/complete`
   - 成功后把 `uploadReceipt` 写回本地 queue item，并将状态改为 `uploaded`
   - 失败时保留本地文件，记录 `lastError`，并将状态改为 `failed`
6. 已验证 typecheck、mobile static check 与 Android Metro bundle export。
7. 尚未完成真机录音 smoke；因此“真机录音可回放”“断网补传可见”和“后端 upload receipt 真机可见”还不能宣布完成。

### Step 5：LiveKit quick talk

目标：

1. 调用 backend `/api/rtc/session/start`。
2. app 只接收 `serverUrl + participantToken`。
3. 启动 LiveKit React Native audio session。
4. 进入 quick talk room。

验收：

1. 不绕过 backend。
2. token 不落日志。
3. 中断、断网、切后台都有 UI 状态。

当前状态：

1. 已新增 `src/realtime/use-mobile-rtc-session.ts`：
   - 调用 backend `/api/rtc/session/start`
   - 只从 backend 接收 LiveKit room metadata、readiness 和 participant token
   - App UI 只展示 room/readiness，不渲染 participant token
   - 可清除当前 session state
2. 已新增 `src/realtime/use-livekit-room-connection.ts`：
   - 调用 `AudioSession.startAudioSession`
   - 使用 backend 返回的 `serverUrl + participantToken` 连接 LiveKit room
   - 连接后发布本机麦克风音频
   - 断开时关闭麦克风、disconnect room，并停止 `AudioSession`
3. `index.ts` 已调用 `registerGlobals()`，确保 React Native WebRTC globals 在 App 启动时注册。
4. `App.tsx` 的沟通 surface 已能：
   - 登录后请求 quick talk session
   - 显示 backend readiness、room name、blockers、warnings
   - 进入 / 断开 LiveKit room
   - 显示 room connection status 与麦克风发布状态
5. 已验证 typecheck、mobile static check 与 Android Metro bundle export。
6. 尚未完成真机 LiveKit room smoke、中断 / 断网 / 切后台 UI。

## 6. 创始人需要把控

1. App Store / 应用市场文案是否只表达“沟通辅助”，不表达医学诊断或康复疗效。
2. 后台录音是否允许；如果允许，用户如何知道正在录。
3. 未上传本地录音保存多久，如何删除。
4. 硬件桥接先支持外接麦 / BLE 按钮 / 脚踏，还是更重的自研设备。
5. 哪些移动端编辑能力可以先做，哪些必须先留在 Web。

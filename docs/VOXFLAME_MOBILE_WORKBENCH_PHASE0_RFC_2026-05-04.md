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
7. 真机 smoke 尚未完成；下一步进入 Auth adapter 前应做一次设备预览。
8. 依赖安装期间出现 LiveKit 依赖链 React peer warning，需在后续 Native LiveKit 接入前复核。

### Step 2：Auth adapter

目标：

1. 接入 Supabase React Native auth。
2. 用 AsyncStorage / SecureStore 持久化 session。
3. 提供 `MobileAuthTokenProvider`。

验收：

1. 登录后能拿 access token。
2. token 不进日志。
3. 退出登录后本地 session 清除。

### Step 3：Workspace snapshot read

目标：

1. 调用 `GET /api/memory/workspace/:userId`。
2. 用 `selectMobileWorkspaceReadModel` 提取移动端显示模型。
3. 展示 prepared expression 和 quick phrases。

验收：

1. 真实账号可读。
2. Web 记忆页和 App 读到同一个 active prepared expression。

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

## 6. 创始人需要把控

1. App Store / 应用市场文案是否只表达“沟通辅助”，不表达医学诊断或康复疗效。
2. 后台录音是否允许；如果允许，用户如何知道正在录。
3. 未上传本地录音保存多久，如何删除。
4. 硬件桥接先支持外接麦 / BLE 按钮 / 脚踏，还是更重的自研设备。
5. 哪些移动端编辑能力可以先做，哪些必须先留在 Web。

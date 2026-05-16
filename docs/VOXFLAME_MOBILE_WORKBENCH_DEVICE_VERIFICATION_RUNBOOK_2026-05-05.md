# VoxFlame Mobile Workbench Device Verification Runbook（2026-05-05）

## 1. 结论

当前 App 验证不需要先打包上架到 App Store 或 Google Play。

当前最小真实验收需要：

1. 本地静态验证：`check / typecheck / export:android`。
2. 真机 development build：Android 或 iPhone 至少一台，优先 Android。
3. 真机业务 smoke：登录、workspace read、录音、回放、上传 receipt、LiveKit quick talk。
4. 小范围内测分发：EAS internal distribution、TestFlight 或 Google Play internal testing。
5. 正式商店上架：等隐私、医疗表述、账号删除、录音权限文案、稳定性和内测反馈收口后再做。

这意味着：现在最应该做的是“真机 development build + 业务 smoke”，不是正式上架。

## 2. 为什么必须有真机

下面这些能力无法只靠代码检查、Web/PWA 或桌面模拟器证明：

1. 麦克风权限、录音文件 URI、回放和本地 document storage。
2. LiveKit React Native 的 `AudioSession`、WebRTC globals 和麦克风发布。
3. 手机访问本机 backend 的 LAN / HTTPS / tunnel 网络路径。
4. 断网、弱网、切后台、来电/系统中断后的状态恢复。
5. 后续 BLE / 外接麦 / 硬件按钮事件。

模拟器可以帮忙看 UI 和部分网络，但不能替代真实录音、真实音频路由和真实系统权限。

## 3. 验证梯度

### Level 0：代码级验证

目的：确认代码、contract 和 bundle 不明显坏。

命令：

```bash
npm run check:mobile-workbench
cd apps/mobile-workbench
npm run check
npm run typecheck
HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-device-export
```

当前状态：已通过多轮。

### Level 1：真机 development build

目的：确认原生能力真正可运行。

VoxFlame 当前已经接入：

1. `@livekit/react-native`
2. `@livekit/react-native-webrtc`
3. `@livekit/react-native-expo-plugin`
4. `expo-audio`
5. `expo-file-system`
6. `expo-secure-store`

这些能力意味着不能长期依赖 Expo Go。需要 development build 或 prebuild 路线。

官方参考：

1. Expo Development Builds: https://docs.expo.dev/develop/development-builds/introduction/
2. Expo 使用 development build: https://docs.expo.dev/develop/development-builds/use-development-builds/
3. EAS 创建 development build: https://docs.expo.dev/develop/development-builds/create-a-build/

建议优先 Android：

1. Android development build 安装成本较低。
2. 录音、回放、上传、LiveKit room 可以先跑通。
3. iPhone 之后再补 TestFlight / ad hoc 设备。

当前仓库已提供 Android EAS 配置：

```bash
cd apps/mobile-workbench
npx eas login
npx eas env:create --environment development --visibility plaintext --name EXPO_PUBLIC_API_BASE_URL --value http://<your-lan-ip>:3001/api
npx eas env:create --environment development --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <supabase-url>
npx eas env:create --environment development --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <supabase-anon-key>
npm run smoke:device-env
npm run build:android:development
```

EAS 构建完成后会给出 build 页面。Android 手机上通常直接用系统相机扫 Expo 页面里的二维码；相机会打开浏览器下载 APK。下载后如果系统提示“禁止从此来源安装”，允许浏览器安装未知应用，再回到下载页安装。

如果只是给非开发者试用，不需要连接本地 Metro，可以用 preview APK：

```bash
cd apps/mobile-workbench
npx eas login
npx eas env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_API_BASE_URL --value http://<reachable-api-host>:3001/api
npx eas env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <supabase-url>
npx eas env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <supabase-anon-key>
npm run smoke:device-env
npm run build:android:preview
```

`development` 和 `preview` 都不是应用商店版本；它们是内部测试安装包。
EAS 云端构建不会自动读取你本机未提交的 `.env`，所以云端打包前要用 `eas env:create` 或 Expo dashboard 配好 `EXPO_PUBLIC_*` 公共客户端配置。不要把 service role key、LiveKit API secret、DashScope key 或 OSS secret 放进 EAS 客户端环境。

### Level 2：真机业务 smoke

目的：确认“真实用户路径”可用。

必测账号链路：

1. 使用真实 Supabase 账号登录。
2. 读取 `GET /api/memory/workspace/:userId`。
3. 看到 active prepared expression、quick phrases 和 daily target。

必测练习链路：

1. 请求麦克风权限。
2. 录一条练习句。
3. 回放本地录音。
4. 点击上传。
5. 确认本地 queue item 变为 `uploaded`，并持有 `uploadReceipt`。
6. 后端 / OSS 能查到对应对象。

必测沟通链路：

1. 点击 quick talk。
2. App 调 backend `/api/rtc/session/start`。
3. App 进入 LiveKit room。
4. 本机麦克风发布成功。
5. 断开后 `AudioSession` 被清理。

必测失败路径：

1. 后端未启动时，App 显示可理解错误。
2. 网络断开时，本地录音不丢。
3. 上传失败后仍可重试或删除。
4. 切后台 / 回前台后状态不假装成功。

### Level 3：小范围内测分发

目的：让 1-10 个可信测试者用自己的手机验证真实场景。

可选路径：

1. EAS internal distribution：适合团队快速拿安装链接。
2. Apple TestFlight：适合 iPhone beta，内部/外部测试者收集反馈。
3. Google Play internal testing：适合 Android 内测轨道。

官方参考：

1. Expo EAS internal distribution: https://docs.expo.dev/build/internal-distribution
2. Apple TestFlight: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
3. Google Play internal testing: https://support.google.com/googleplay/android-developer/answer/9845334

### Level 4：正式商店上架

目的：公开发布，不是当前 Phase 0 的前置条件。

国内 Android 应用商店需要 release APK，不要上传 development build。当前仓库提供：

```bash
cd apps/mobile-workbench
npm run build:android:china-store
```

这条 profile 会生成面向国内 Android 商店的正式 APK。小米应用商店官方流程是创建应用、填写包名、上传 APK，并在权限信息模块说明敏感权限使用场景。华为 AppGallery Android 分发也需要开发者认证、创建应用、填写应用资料、上传应用包和隐私政策 URL。

华为 / 鸿蒙需要分两条线判断：

1. 华为应用市场里的 Android 应用：当前 React Native Android APK 可以作为提交物。
2. HarmonyOS NEXT 原生鸿蒙应用：当前 Android APK 不是原生鸿蒙应用，后续需要单独做 HarmonyOS-native 版本或确认跨端方案支持。

进入正式上架前，至少需要补齐：

1. 隐私政策：录音、账号、训练样本、OSS 存储、删除方式。
2. 账号删除 / 数据删除入口。
3. App Store / Google Play 文案：只表达“沟通辅助”，不表达医学诊断或康复疗效。
4. 麦克风权限说明与 App 内录音显式状态。
5. crash / 日志策略：不上传录音内容到普通日志。
6. 内测反馈闭环。

## 4. 本地环境预检

先在仓库根目录跑：

```bash
npm run check:mobile-workbench
```

再在 mobile workbench 目录跑：

```bash
cd apps/mobile-workbench
npm run smoke:device-env
```

真机访问本地 backend 时，`EXPO_PUBLIC_API_BASE_URL` 不应写成 `http://127.0.0.1:3001/api`，因为手机上的 `127.0.0.1` 指向手机自己。通常应该写成：

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:3001/api
```

如果网络环境复杂，可以后续改用 HTTPS tunnel，但不要把 service role key、LiveKit API secret、DashScope key 放进 App 环境变量。

## 5. 当前下一步

建议下一刀：

1. 用 `npm run build:android:development` 或 `npm run build:android:preview` 生成 Android APK 安装链接。
2. 用一台 Android 手机验证登录、workspace read、录音、回放。
3. 再验证上传 receipt。
4. 最后验证 LiveKit quick talk room。

在这四步跑通前，不进入正式商店上架准备。

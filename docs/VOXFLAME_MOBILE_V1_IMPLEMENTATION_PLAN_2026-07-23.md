# VoxFlame Mobile V1 Implementation Plan（2026-07-23）

## 1. Task

- 标题：Android / iOS 第一版可测试 Mobile Workbench
- 日期：2026-07-23
- 范围：`apps/mobile-workbench`、现役 backend contract、移动端验证文档

## 2. Context

- 当前 Expo / React Native 工程已有 Supabase 登录、workspace snapshot、LiveKit room、原生录音、本地队列和上传 receipt。
- 当前主要缺口不是重新选技术栈，而是产品界面仍像工程控制台、用户文案暴露实现细节、RTC 断开未显式通知 backend、iOS 缺少对等导出和 EAS 命令、双平台尚无真机 smoke 证据。
- 工作区已有其他前端与语料改动，本任务不覆盖或回退这些改动。

## 3. Governance Inventory

- 入口层：`apps/mobile-workbench/App.tsx`、四个一级 surface。
- 服务层：移动端 API client / hooks；backend `/api/rtc/session/*`、`/api/memory/workspace/*`、`/api/upload/*`。
- 存储层：Supabase workspace、OSS 训练资产、移动端 document queue。
- 旁路层：LiveKit runtime、upload receipt、EAS build。

仍在运行的唯一链路：

```text
Android / iOS App
  -> Supabase Auth
  -> Backend /api/memory/workspace/:userId
  -> Backend /api/rtc/session/start|ping|stop
  -> self-hosted LiveKit + livekit_agent
  -> Backend /api/upload/sign -> OSS -> /api/upload/complete
```

## 4. Source Of Truth

- durable workspace：backend + Supabase。
- RTC orchestration：backend `/api/rtc/session/*`。
- 实时传输：self-hosted LiveKit。
- 本地录音：App cache，拿到 backend receipt 后才算完成上传。
- 不新增 WebView、移动端私有后端或平级 memory owner。

## 5. Success Criteria

1. 未登录界面只承担登录，不显示工程诊断信息。
2. 登录后四个 surface 都有单一主任务：沟通、练习、准备、我的。
3. 沟通可 start / ping / stop backend session，并连接 / 断开 LiveKit 麦克风。
4. 练习可真机授权、录音、回放、保留、上传、收到 receipt、确认删除。
5. 准备页读取与 Web 相同的 workspace snapshot。
6. Android 与 iOS 都有静态检查、Metro export 和 EAS development / preview build 入口。
7. TypeScript、移动端守卫、Android/iOS export、仓库文档检查通过。

## 6. Out Of Scope

- App Store / Google Play 正式发布与审核。
- HarmonyOS NEXT 原生版本。
- BLE / USB 硬件、后台录音、后台持续同步。
- 未经真机执行的麦克风、音频路由与弱网结论。

## 7. Risks And Rollback

- LiveKit React Native 依赖 native development build，Expo Go 不能作为验收环境。
- iOS 云构建需要 Expo 账号与 Apple Developer 凭据；本地 Linux 只能验证 bundle export，不能生成签名 IPA。
- UI 改动集中在 `App.tsx`，RTC lifecycle 集中在现有 API/hook，均可按文件回退，不改变 backend schema。

## 8. Validation

- `npm run check`
- `npm run typecheck`
- `npm run export:android`
- `npm run export:ios`
- `bash scripts/check_ai_docs.sh`
- Android / iPhone development build 真机 smoke 按 runbook 执行并记录结果。

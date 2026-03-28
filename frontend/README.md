# VoxFlame Frontend

前端已收口到 `RTC + RTM` 实时链路，不再接入旧 websocket 代理。

## 技术栈

- Next.js 14 App Router
- React 18 + TypeScript + Tailwind CSS
- Agora Web SDK
- PWA（默认开启，可按环境显式关闭）
- Web Audio API

## 当前职责

- 首页任务入口与资源入口
- 沟通页实时会话与 starter kit
- 训练页 RTC 会话、录音资产与上传回执
- 沟通档案页与共享 `workspace` 读模型
- PWA 安装、离线与更新提示

## 当前主链

```text
Frontend
  -> Backend /api/rtc/session/*
  -> TEN Agent control server
  -> Agora RTC + RTM
```

## 当前页面系统

- `/`
  首页已经从说明页收口成“高压场景优先”的任务入口，重点是 `现在沟通 / 练习表达 / 沟通档案`。
- `/?mode=communicate`
  沟通工作台，围绕 `starter kit -> live session -> expression kit` 组织。
- `/contribute`
  练习工作台，围绕真实场景录音、训练反馈、训练资产上传和本地待同步队列组织。
- `/memory`
  沟通档案页，不再只做统计，而是为“下一次沟通前准备什么”服务。

## 当前前端 contract

- 运行时唯一事实源仍然是 `Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`
- 长期画像前端优先消费 backend `workspace` 聚合接口，而不是页面各自拼 memory
- 训练录音前端统一围绕 `recording envelope -> recorder queue -> upload receipt` 组织
- 默认优先走同源 `/api` rewrite，而不是让浏览器直接访问 `:3001`

## 核心模块

- `src/hooks/useRtcAgentSession.ts`
  沟通页 RTC 音频、RTM 文本/控制、字幕与消息状态。

- `src/hooks/useMandarinTrainingSession.ts`
  训练页 RTC 会话、录音状态、实时 transcript 与 recorder envelope 产出。

- `src/hooks/useVoiceUpload.ts`
  训练资产上传、OSS 签名、manifest 回执与本地 recorder queue 同步。

- `src/hooks/useWorkspaceMemorySnapshot.ts`
  供沟通页、训练页、沟通档案页共享 `profile_bundle / session_review / expression_kit`。

- `src/app/page.tsx`
  首页和沟通模式入口。

- `src/app/contribute/page.tsx`
  中文训练页。

- `src/app/memory/page.tsx`
  沟通档案与场景化准备页。

## 快速开始

### Docker (推荐)

```bash
# 从项目根目录
sudo docker-compose up -d frontend
```

如需排查本地浏览器缓存或 service worker 干扰，可临时关闭 PWA：

```bash
VOXFLAME_ENABLE_PWA=0 sudo docker-compose up -d --build frontend
```

### 本地开发

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

## 核心组件

### `useRtcAgentSession`

管理 Agora RTC 音频会话和 RTM 文本/控制通道：

```typescript
const {
  isConnected,
  isRecording,
  latestUserTranscript,
  messages,
  connect,
  startRecording,
  sendText,
} = useRtcAgentSession({ userId })
```

### `useMandarinTrainingSession`

训练页通过同一套 RTC + RTM transport 建会话，停止录音后回传 transcript 和本地录音 blob：

```typescript
const {
  status,
  interimText,
  startRecording,
  stopRecording,
  sendTrainingResult,
} = useMandarinTrainingSession({ userId })
```

## 训练资产链路

当前训练页的最小数据链路已经收口成：

```text
recording envelope
  -> recorder queue (IndexedDB)
  -> upload/sign
  -> OSS audio object
  -> upload/complete
  -> voice_contributions + manifest.jsonl + transcripts.txt(兼容)
```

- `recording_id / session_id / mode / source_surface / collection_mode / consent_scope` 已被强制带入上传 metadata
- 本地断网时录音先进入 `recorder queue`
- 上传成功后前端拿到结构化 `UploadReceipt`
- 后端现在会尽量复用已有 contribution / manifest，同一条录音重试时不再默认重复写入

## 音频格式

| 参数 | 值 |
|------|-----|
| 格式 | PCM |
| 采样率 | 16000 Hz |
| 位深 | 16-bit |
| 声道 | Mono |

## 环境变量

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
VOXFLAME_ENABLE_PWA=1
```

## 开发经验

### 浏览器自动播放策略

AudioContext 必须在用户交互后初始化：

```typescript
// 在用户点击后调用
await client.initAudio()
```

### Docker 缓存问题

代码更新后需要重新构建：

```bash
sudo docker-compose build frontend --no-cache
sudo docker-compose up -d frontend
```

### PWA 边界

PWA 现在适合承担：

- 安装到桌面 / 主屏幕
- 静态资源缓存
- 安装感和较轻的离线体验
- 与 recorder queue 结合，降低“临时断网就丢数据”的风险

PWA 还不能替代未来原生 App / companion 的部分：

- 更稳定的后台音频与长时录制
- 更强的系统级权限与设备集成
- 更完整的通知、后台同步和硬件协作
- 更强的移动端 / 桌面端原生分发与系统入口

当前建议是：先把 PWA 当作近端产品面，把“能安装、能录、能断网兜底、能持续验证”做扎实；原生 App 不需要立刻抢 P0，但也没有被完全替代。

## 相关文档

- [主项目 README](../README.md)
- [后端 README](../backend/README.md)
- [Agent README](../ten_agent/README.md)

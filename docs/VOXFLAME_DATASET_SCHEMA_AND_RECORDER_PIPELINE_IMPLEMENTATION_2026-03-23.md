# VoxFlame Dataset Schema And Recorder Pipeline Implementation

> 基于 `ququ` 与 `vocotype-cli` 的代码级拆解，为 `VoxFlame` 当前训练链路、上传链路和后续 app / companion 规划整理出的实施文档。
>
> 状态说明：这份文档仍是现役 contract 文档，但其中“待实现”的部分已经在 `2026-03-26` 收口了一轮，下面内容已按当前代码刷新。

## 为什么现在要做这份文档

`VoxFlame` 已经有了训练页录音、RTC 训练会话、上传接口和第一版训练画像聚合，但数据入口、录音形态、上传元数据和后续训练资产沉淀还没有收成统一 contract。

如果不先把这层收紧，后面很容易出现几个问题：

- 训练页、沟通页、未来 desktop companion 各自长出不同的数据格式
- 只保存音频路径和文本，后面做质检、评测、回放、个体画像时信息不够
- 把“训练反馈”直接当“长期记忆”，导致 memory plane 被原始样本淹没
- 未来替换 `TEN + Agora` 或增加 app surface 时，数据和 recorder contract 重新打碎

这份文档的目标不是一次性做完整数据平台，而是先把 `VoxFlame` 的最小正确骨架定下来。

## 参考仓库到底带来了什么

### `ququ` 给 `VoxFlame` 的启发

`ququ` 更像桌面产品工程参照，而不是数据系统参照。

它最值得迁移的是：

- `raw first, optimize second`
  先让原始识别尽快出来，再异步做 AI 优化，不把所有价值都塞进第一回合。
- readiness / degradation 思维
  麦克风、模型、权限、自动粘贴失败都要有真实 fallback。
- 常驻服务和产品脏活显式建模
  热键、权限、历史、设置、服务健康不该藏在页面胶水里。

对 `VoxFlame` 来说，这更适合指导未来 `desktop companion` 或“训练录制器 app”的产品形态。

### `vocotype-cli` 给 `VoxFlame` 的启发

`vocotype-cli` 更像数据和引擎参照。

它最值得迁移的是：

- 会话式 recorder
  `start -> stop -> finalize -> enqueue` 的录音会话，而不是一切都走无限实时流。
- 异步 transcription worker
  停止录音后立即结束用户等待，转写和元数据整理在后台完成。
- dataset recorder
  顺手把 `audio + text + duration + sample_rate + latency + confidence` 写成标准资产。
- 本地落盘优先
  先保证录音和元数据不丢，再考虑同步、上传和聚合。

对 `VoxFlame` 来说，这部分直接关系到训练数据、评测 harness、未来本地 companion 和数据治理。

## 实施原则

1. `训练反馈` 不是 `数据 schema`
   训练反馈是执行面和产品层的即时结果，数据 schema 是长期资产 contract。
2. `memory` 不等于 `dataset`
   原始录音、转写、评测细节默认进 dataset / artifact store，不直接写成长时记忆。
3. `raw` 与 `derived` 分层
   原始音频、原始 transcript、模型修正、训练建议、聚合画像要分层存。
4. `surface-agnostic`
   web、PWA、未来 desktop / mobile recorder 都写向同一套 schema。
5. `local-first, sync-later`
   先确保录音不丢，再做对象存储上传和云端索引。

## 现状映射

截至 `2026-03-26`，当前代码已经有几个可以直接沿用的入口：

- 前端训练录音会话：
  [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts)
- 前端上传 hook：
  [useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts)
- 后端上传控制器：
  [upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts)

已经存在的基础能力：

- 训练页可以拿到结构化 `recording envelope`
- 录音 envelope 已带 `recording_id / session_id / mode / source_surface / collection_mode`
- 上传路径已初步区分：
  - `supervised/mandarin/...`
  - `weak-supervision/dialogue/...`
- 上传 metadata 已支持结构化对象
- 后端已写 `voice_contributions`
- 后端已追加 `dataset/{user_id}/manifest.jsonl`
- 指导录音仍兼容追加 `dataset/{user_id}/transcripts.txt`
- 本地降级录音已进入 IndexedDB `recorder queue`

当前主要缺口：

- 已有最小 `recording schema`，但还需要 authenticated live smoke 证明整条链真正跑通
- `/api/upload/complete` 的最小幂等保护已经落在 backend service 层：同一条录音重试时会优先复用已有 contribution，并尽量避免重复追加 `manifest`
- `voice_contributions` 的数据库唯一键 / upsert contract 已开始正式化，但还需要真实登录态 smoke 继续证明“补传 + 并发重试”一起稳定
- `transcripts.txt` 现在只保留兼容导出角色，后续评测、质检、画像应继续以 `manifest.jsonl` 为准
- recorder queue 已进入 IndexedDB，但仍要继续补 `最后尝试时间 / 重试次数 / 失败原因 / companion 共享边界`

## VoxFlame 最小数据模型

下面这套 schema 不是要求一次性建全数据库，而是要求所有 recorder / uploader / worker 都围绕同一套字段组织。

### 1. Recording Identity

每条录音必须至少具备：

- `recording_id`
  全局唯一 ID，建议 `uuid`
- `user_id`
  当前登录用户
- `session_id`
  对应训练会话或沟通会话
- `turn_id`
  可选，单次说话回合 ID
- `mode`
  `training | communication | evaluation | free_recording`
- `source_surface`
  `web | pwa | desktop_companion | mobile_companion | local_cli`
- `collection_mode`
  `supervised | weak_supervision | free_recording | benchmark`
- `created_at`

### 2. Prompt Context

训练与评测场景下，必须保留 prompt 语境：

- `prompt_id`
- `prompt_text`
- `prompt_category`
- `prompt_subcategory`
- `target_pinyin`
- `target_focus`
  例如 `sh_initial`, `iang_final`, `third_tone`
- `scenario_tag`
  例如 `medical`, `home`, `outing`, `opening`

对于自由对话场景，允许为空，但要保留：

- `conversation_context`
- `starter_template_id`
- `partner_mode`

### 3. Audio Artifact

每条录音都应显式记录音频资产信息：

- `audio_path`
- `audio_format`
  例如 `wav`, `webm`, `opus`
- `sample_rate`
- `channel_count`
- `duration_ms`
- `file_size_bytes`
- `capture_device`
  可选，设备名或简化标签
- `capture_transport`
  `browser_media_recorder | rtc_dup_track | local_pcm_stream`

### 4. Transcript Artifact

必须区分原始转写与后处理结果：

- `raw_transcript`
- `final_transcript`
- `prompt_aligned_transcript`
  训练场景下可选
- `transcript_source`
  `rtc_asr | local_funasr | batch_asr | manual_fix`
- `confidence`
- `latency_ms`
- `language`
  默认 `zh-CN`

### 5. Evaluation Artifact

训练页和后续评测需要显式保留衍生特征，但不要和原始 transcript 混为一层：

- `clarity_signals`
  结构化对象，保存可解释 signal，而不是一个玄学总分
- `error_tags`
  例如 `missing_syllable`, `tone_confusion`, `extra_word`
- `focus_feedback`
  当前重点音节或动作建议
- `llm_feedback_version`
- `rule_feedback_version`
- `evaluation_status`
  `pending | ready | sampled_for_review | rejected`

### 6. Consent And Storage

这层很重要，尤其是以后做 app 和长期样本池：

- `consent_scope`
  `training_only | training_and_model_improvement | evaluation_only`
- `retention_tier`
  `local_only | synced_hot | cold_archive`
- `sync_status`
  `local_only | upload_pending | uploaded | indexed | failed`
- `visibility`
  `private | therapist_shared | benchmark_pool`

## 建议的最小对象结构

前后端先围绕下面这个结构对齐，数据库可以先存 JSON，再逐步拆表：

```ts
type VoxFlameRecordingRecord = {
  recording_id: string
  user_id: string
  session_id: string
  turn_id?: string
  mode: 'training' | 'communication' | 'evaluation' | 'free_recording'
  source_surface: 'web' | 'pwa' | 'desktop_companion' | 'mobile_companion' | 'local_cli'
  collection_mode: 'supervised' | 'weak_supervision' | 'free_recording' | 'benchmark'
  created_at: string
  prompt?: {
    id?: string
    text?: string
    category?: string
    subcategory?: string
    target_pinyin?: string[]
    target_focus?: string[]
    scenario_tag?: string[]
  }
  audio: {
    path: string
    format: string
    sample_rate: number
    channel_count: number
    duration_ms: number
    file_size_bytes?: number
    capture_transport: 'browser_media_recorder' | 'rtc_dup_track' | 'local_pcm_stream'
  }
  transcript: {
    raw: string
    final?: string
    aligned?: string
    source: 'rtc_asr' | 'local_funasr' | 'batch_asr' | 'manual_fix'
    confidence?: number
    latency_ms?: number
    language: 'zh-CN'
  }
  evaluation?: {
    clarity_signals?: Record<string, unknown>
    error_tags?: string[]
    focus_feedback?: string[]
    llm_feedback_version?: string
    rule_feedback_version?: string
    evaluation_status?: 'pending' | 'ready' | 'sampled_for_review' | 'rejected'
  }
  consent: {
    scope: 'training_only' | 'training_and_model_improvement' | 'evaluation_only'
    retention_tier: 'local_only' | 'synced_hot' | 'cold_archive'
    sync_status: 'local_only' | 'upload_pending' | 'uploaded' | 'indexed' | 'failed'
    visibility: 'private' | 'therapist_shared' | 'benchmark_pool'
  }
  metadata?: Record<string, unknown>
}
```

## Recorder Pipeline

### 总体目标

把 `训练页录音 -> 上传 -> 反馈 -> 聚合` 变成一条稳定且可扩展的链，而不是页面里临时拼几个 hook。

### Pipeline Stage 1: Capture

不同 surface 可以有不同录音技术，但都要产出同一份 recorder envelope：

- `recording_id`
- `session_id`
- `started_at`
- `stopped_at`
- `sample_rate`
- `source_surface`
- `capture_transport`

当前 web 训练页可以继续沿用：
[useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts)

但建议把它产出的 `recording` 对象扩成：

- `blob`
- `duration_ms`
- `sample_rate`
- `channel_count`
- `capture_transport`
- `recording_id`
- `local_cache_key`

### Pipeline Stage 2: Finalize

停止录音时，不要只等 transcript。

应该同步做三件事：

1. 固化录音 envelope
2. 等待 RTC / ASR 最终 transcript
3. 立即写本地 recorder manifest

这里借鉴 `vocotype-cli` 的地方是：
先保证本地 session 资产完整，再做远端上传。

### Pipeline Stage 3: Local Dataset Recorder

这是最值得新增的一层。

建议新增一个前端或 companion 共享的 recorder manifest 层，哪怕 web 端第一版先用 IndexedDB，也不要只靠 `localStorage` 临时数组。

最小职责：

- 保存 `recording envelope`
- 记录本地 blob 引用
- 记录 `sync_status`
- 记录上传失败原因
- 提供重试队列

这层就是 `vocotype-cli dataset_recorder` 在 `VoxFlame` 里的翻译。

### Pipeline Stage 4: Structured Upload

当前上传 hook：
[useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts)

建议从“只传 text + duration + metadata”升级成显式上传 `recording record`。

第一步不需要一次性重构所有接口，先做这几个动作：

- `metadata` 内强制包含 `recording_id / session_id / mode / source_surface / collection_mode`
- `duration` 统一换算为 `duration_ms`
- 把 `sampleRate` 和 `capture_transport` 一起上送
- 训练 prompt 的 `category / subcategory / prompt_text / target_focus` 一起上送

### Pipeline Stage 5: Async Derivation

上传完成后，衍生层再异步做：

- 训练反馈生成
- 错误标签归纳
- 画像聚合
- 评测抽样
- 数据集导出清单

这里要严格避免：

- 页面上传成功就直接把原始 transcript 写成长时记忆
- 每句训练反馈都直接写进 memory plane

正确做法是：

- 原始记录进入 dataset
- 聚合摘要进入 memory
- 训练建议保留为 session 级或样本级 artifact

### Pipeline Stage 6: Memory-Safe Aggregation

这一步和 [VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md) 对齐。

建议只把这些聚合结果写入 memory / voice profile：

- 训练总量
- 最近周期趋势
- 高频错误模式
- 当前优先训练目标
- 个体热词或高频表达偏好

不要把：

- 单句原始 transcript
- 单句完整反馈文本
- 原始音频路径

直接写成长时记忆。

## 对当前实现的具体改造建议

### A. 前端训练录音 hook

目标文件：
[useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts)

建议新增：

- `recording_id`
- `duration_ms`
  当前是秒，后续数据治理更适合毫秒
- `channel_count`
- `capture_transport='rtc_dup_track'`
- `session_id`
  从 RTC 会话显式拿

建议改动方向：

- `StopRecordingResult.recording` 升级为 recorder envelope
- 停止录音后立即调用本地 recorder manifest 写入
- 把“等待 transcript”与“固化录音资产”并行化

### B. 前端上传 hook

目标文件：
[useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts)

建议新增结构化字段：

- `recording_id`
- `session_id`
- `mode`
- `source_surface`
- `collection_mode`
- `sample_rate`
- `capture_transport`
- `prompt_text`
- `prompt_category`
- `target_focus`
- `consent_scope`

目录建议也进一步收口：

- 监督训练：
  `supervised/mandarin/{category}/{user_id}/{recording_id}.{ext}`
- 弱监督沟通：
  `weak-supervision/dialogue/{user_id}/{session_id}/{recording_id}.{ext}`
- 评测 / benchmark：
  `benchmark/mandarin/{suite}/{user_id}/{recording_id}.{ext}`

### C. 后端上传控制器

目标文件：
[upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts)

建议从“插一条 voice_contributions”升级到至少支持：

- 保存 `recording_id`
- 保存 `session_id`
- 保存 `mode`
- 保存 `source_surface`
- 保存 `collection_mode`
- 保存 `audio metadata`
- 保存 `transcript metadata`
- 保存 `consent`

`transcripts.txt` 仍然可以保留给传统监督数据导出，但应该并行增加：

- `dataset/{user_id}/manifest.jsonl`

每条一行，对应完整 recording record 的瘦身版。

## 从 `ququ` 值得迁移的模块

这些不一定马上写进当前 web 代码，但应该进入 `desktop / companion` 路线图：

1. readiness manager
   麦克风、模型、本地服务、权限、热键都应有统一健康状态。
2. raw first, optimize second
   先把原始识别和用户反馈做快，再做润色或重写。
3. fallback 设计
   权限失败、自动输入失败、模型不可用时要有明确降级。
4. 历史与设置分层
   本地历史记录和长期用户画像不要混成一个表。

## 从 `vocotype-cli` 值得迁移的模块

这些更适合尽快进入 `VoxFlame` 主线：

1. recorder manifest / dataset recorder
2. session-style recording envelope
3. async transcription / derivation queue
4. `jsonl` manifest 输出
5. `latency_ms + confidence + duration_ms` 作为默认指标

## 实施优先级

### Phase 1: 先把 contract 做对

当前状态：大部分已落地

1. 把训练录音结果升级成 recorder envelope
2. 把上传 metadata 收口到统一字段
3. 后端为监督录音增加 `manifest.jsonl`
4. 本地降级存储从 `localStorage` 临时对象升级为正式 recorder queue
5. `/api/upload/complete` 对同一条录音的重试，默认优先复用已有 contribution / manifest

### Phase 2: 继续沉淀数据资产

当前状态：进行中

1. 训练页保存 `raw_transcript / final_transcript / latency_ms / confidence`
2. 增加评测和抽样复核字段
3. 聚合层只写 training profile summary，不写逐句长记忆
4. 让对象存储目录结构和导出清单统一

### Phase 3: 为 app / companion 做准备

当前状态：尚未进入实现，但 contract 已开始向这一步对齐

1. 抽 `surface-agnostic recorder contract`
2. 增加 `desktop_companion` 这个 surface
3. 增加本地 recorder manifest 与后端 sync worker 的边界
4. 让 web、PWA、desktop 共享同一套 recording schema

## 下一步行动清单

1. 用真实登录态补一次 `upload/sign -> OSS -> upload/complete` smoke，确认 `voice_contributions + manifest.jsonl + transcripts.txt(兼容)` 一起闭环。
2. 为 `voice_contributions` 明确更强的唯一键 / upsert contract，进一步降低并发重试下的重复写入风险。
3. 把训练反馈写入规则和 memory 写入规则分开，明确“样本 artifact”与“画像摘要”的边界。
4. 让 recorder queue 继续支持更明确的失败原因、重试次数和最后同步时间。
   当前 web 端已补到这一步，下一步应继续把这套队列状态推广成 web / PWA / future companion 可共享的 contract。
5. 为后续 desktop companion 新增一份 `recorder readiness` 草图文档，提前消化 `ququ` 的权限/降级经验。
6. 后续所有训练数据、benchmark 数据、弱监督数据都按本文件的 schema 评审，不再各写各的 metadata。

## 一句话结论

`ququ` 告诉我们怎么把语音产品做成真正能用的桌面体验，`vocotype-cli` 告诉我们怎么把录音链顺手沉淀成长期可用的数据资产。

对 `VoxFlame` 来说，眼下最该做的不是继续堆训练 prompt，而是先把 `recording contract + dataset schema + recorder queue + manifest` 收成一套稳定骨架。

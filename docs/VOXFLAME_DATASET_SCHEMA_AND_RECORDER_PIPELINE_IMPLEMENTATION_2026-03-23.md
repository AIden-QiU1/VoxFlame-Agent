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
6. `auto-verify before manual annotation`
   句子录入后默认自动校验“这段录音是否真的对应这句目标句/目标翻译”；P0 不先做独立 annotation UI，只有高风险样本才进入复核流。

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
- 训练页在登录授权已确认后，已开始按主路径自动保存监督样本，而不是再把“保存训练样本”做成主按钮
- `/api/upload/complete` 现已优先保证 `manifest.jsonl` 落盘；`voice_contributions` 写入异常时，样本 artifact 不再跟着整条失败
- 已新增 [reconcile_upload_artifacts.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/reconcile_upload_artifacts.ts)，可把历史缺 `upload_receipt / manifest` 的训练样本补齐到现役事实源
- 当前环境中的历史真实样本已完成一次对账：测试账号的 1 条监督录音与 legacy `v_gv7fxwrp` 的 5 条录音现在都已具备 `upload_receipt + manifest.jsonl`
- 训练样本现已显式区分两种 key：
  - `prompt_group_key`
    用来把“同一句/同一条 corpus prompt 的多次练习”归到同一组
  - `recording_dedupe_key`
    用来保证“同一条录音”的重试与补传不会重复写入
- 训练样本现已开始显式写 `evaluation_status / review_queue / review_priority / review_reason_tags`
- 已新增 [list_dataset_review_queue.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/list_dataset_review_queue.ts)，可把 `sampled_for_review / retry_recommended` 样本直接拉成 review queue

当前主要缺口：

- 创始人已在真实前端补过 smoke，且历史真实样本已证明 `voice_contributions + upload_receipt + manifest.jsonl + transcripts.txt(兼容)` 可以收口到同一条链；当前剩余的验证重点不再是“能不能保存”，而是确认 2026-03-29 这版新增的 `sample_quality_* / confidence / latency_ms / review_*` 会稳定进入新样本 manifest
- `/api/upload/complete` 的最小幂等保护已经落在 backend service 层：同一条录音重试时会优先复用已有 contribution，并尽量避免重复追加 `manifest`
- `voice_contributions` 的数据库唯一键 / upsert contract 已开始正式化，但还需要真实登录态 smoke 继续证明“补传 + 并发重试”一起稳定
- `transcripts.txt` 现在只保留兼容导出角色，后续评测、质检、画像应继续以 `manifest.jsonl` 为准
- recorder queue 已进入 IndexedDB，但仍要继续补 `最后尝试时间 / 重试次数 / 失败原因 / companion 共享边界`
- 监督训练样本的 contract 还需要继续强调：云端 canonical label 是目标句，`recognized_text` 只作为前端反馈和样本诊断字段，不应与监督标签混用
- 句子录入后的“一句一音对应性”还缺自动判定主链：
  - 默认应在上传完成后自动判断录音是否确实对应当前目标句/目标翻译
  - 只有低置信、不覆盖、明显跑题或疑似串句样本才进入 review queue / retry

## 当前去重规则

当前 dataset 链路不是按“句子内容相同”去重，而是分两层处理：

1. 同一句 prompt 允许多次保存
   - 同一个 `exercise_id / target_text`
   - 不同录音尝试
   - 这些样本都应继续保留，方便后续训练、对比和质检

2. 同一条录音只保留一份
   - 当前实际幂等主键仍是 `contributor_id + audio_path`
   - `recording_id / recording_dedupe_key` 与 `upload_receipt` / `manifest` 检查会一起兜底
   - 目标是允许“同一句多条样本”，但阻止“同一条录音重复补传”

这意味着：

- “我今天把同一句练了 5 遍”不会被系统压成 1 条
- “同一条录音因为网络重试了 5 次”不会被系统写成 5 条

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
  `pending | ready | sampled_for_review | retry_recommended`

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
    evaluation_status?: 'pending' | 'ready' | 'sampled_for_review' | 'retry_recommended'
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

## Recorder Pipeline（现役 contract）

### 总体目标

把 `训练页录音 -> OSS 音频对象 -> upload receipt -> manifest -> review queue -> profile summary` 变成一条对 web、PWA、future mobile / desktop companion 都成立的统一链路。

这里的关键不是“多写几层”，而是确保任何一个 surface 录完音后，都能回答同一组问题：

- 这条录音的唯一 ID 是什么
- 它有没有进云端对象存储
- 它有没有完成 dataset 登记
- 它现在是可直接训练、待复核还是建议重录
- 它有没有越界写进长期 memory

### Stage 1: Capture

当前 web 训练页已经能稳定产出 `recording envelope`：

- `recording_id`
- `session_id`
- `mode`
- `source_surface`
- `collection_mode`
- `started_at / stopped_at`
- `sample_rate / channel_count / duration_ms / capture_transport`
- 原始音频 `blob`

这层对多端架构最重要的价值是：

- 录音对象已经不再依赖页面临时 state 命名
- web / PWA / future companion 可以共享同一套 envelope 结构
- 后续移动端或桌面端只需要替换 capture transport，不需要再改 dataset schema

### Stage 2: Finalize

当前停录后已经不是“只等 transcript”，而是并行完成：

1. 固化 `recording envelope`
2. 等待更稳定的最终 transcript
3. 生成本地训练反馈和样本质量判断
4. 在授权已确认时直接进入自动保存主链

这一层已经明显更接近 `vocotype-cli` 的 session-style recorder，而不是页面里随手拼出来的一次性录音按钮。

### Stage 3: Local Dataset Recorder

这层已经从旧的临时缓存升级成现役 `IndexedDB recorder queue`：

- 保存 `recording envelope`
- 记录本地 blob 引用
- 记录 `syncStatus / syncAttempts / lastAttemptAt / lastError`
- 记录授权范围与结构化 metadata
- 在云端登记失败时保留自动补登入口

当前要强调的新产品判断是：

- 这层存在的目的不是让用户手动同步
- 它是系统的可靠性缓冲层
- 训练页主路径不再围绕“留在本地，稍后自己同步”组织

### Stage 4: Structured Upload

当前现役上传链已经收口成：

```text
recording envelope
  -> upload/sign
  -> OSS audio object
  -> upload/complete
  -> voice_contributions + upload_receipt + manifest.jsonl
  -> transcripts.txt(兼容导出)
```

其中已经成立的 contract：

- 前端强制上送 `recording_id / session_id / mode / source_surface / collection_mode / consent_scope`
- 监督训练目录收口到 `supervised/mandarin/{category}/{user_id}/{recording_id}.{ext}`
- 弱监督沟通目录收口到 `weak-supervision/dialogue/{user_id}/{session_id}/{recording_id}.{ext}`
- `target_text` 是监督标签
- `recognized_text` 仅用于反馈显示、样本诊断和后续复核
- `upload_receipt + manifest.jsonl` 才是“已进入训练资产链”的正式标志

当前还要继续固定一条新 contract：

- 句子一旦进入录入流程，系统默认自动执行 `target_text(or target_translation) <-> recorded audio` 的对应性校验
- P0 不要求用户再手动做一遍 annotation
- 人工复核只处理自动校验命中风险的样本，而不是处理全部样本

### Stage 5: Dataset Review Signals

这层已经不是计划，而是现役 metadata contract 的一部分：

- `sample_quality_score`
- `sample_quality_tier`
- `sample_quality_action`
- `transcript_coverage_ratio`
- `confidence`
- `latency_ms`
- `evaluation_status`
- `review_queue`
- `review_priority`
- `review_reason_tags`
- `review_summary`

当前差的不是字段定义，而是把它们继续推进成真正的 worker / export / 人工复核流程。

在当前主线里，这层还需要补一个更直接的产品判断：

- 默认路径应该是 `句子录入 -> 录音 -> ASR/final transcript -> 自动对应性校验 -> auto_verified | sampled_for_review | retry_recommended`
- 自动校验的目标不是“再生成一份标签”，而是确认保留下来的音频确实对应当前目标句
- `recognized_text`、覆盖率、时长异常、静音比例、串句迹象应优先作为自动分流信号
- 只有自动校验认为不稳的样本，才值得进入人工 review queue

### Stage 6: Memory-Safe Aggregation

这一层仍然必须坚持：

- dataset 保存样本事实
- memory 保存提炼后的画像与摘要

当前允许继续写入 memory / voice profile 的只有：

- 训练总量
- 最近周期趋势
- 高频错误模式
- 当前优先训练目标
- 个体热词或高频表达偏好

不允许直接写成长时记忆的仍然包括：

- 单句原始 transcript
- 单句完整反馈文本
- 原始音频路径

## 当前已经落地的部分

以下内容已经不再属于“建议新增”：

1. recorder envelope
   - [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts)
   - 已包含 `recording_id / session_id / duration_ms / sample_rate / channel_count / capture_transport`

2. 自动上传主路径
   - [useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts)
   - 当前主路径已收口到“停录即上传”，失败时才进入后台自动补登

3. upload artifact persistence
   - [upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts)
   - [upload-artifact.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/upload-artifact.service.ts)
   - 已同时处理 `voice_contributions / upload_receipt / manifest.jsonl / transcripts.txt(兼容)`

4. 历史样本对账
   - [reconcile_upload_artifacts.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/reconcile_upload_artifacts.ts)
   - 当前历史真实样本已补齐到现役 artifact 链

5. review queue 基础入口
   - [training-sample-review.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-sample-review.ts)
   - [list_dataset_review_queue.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/list_dataset_review_queue.ts)
   - [mark_dataset_review_decision.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/mark_dataset_review_decision.ts)
   - 当前已经能把 `sampled_for_review / retry_recommended` 样本拉出来，也能用默认 dry-run 的 review 标记脚本预览 `accepted_for_export / reviewer / reviewed_at / rejection_reason` 回写 payload

6. export manifest 第一版脚本
   - [dataset-export.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/dataset-export.service.ts)
   - [export_dataset_manifest.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/export_dataset_manifest.ts)
   - 当前已能按 `accepted_for_export` 生成统一字段语言的 dataset export manifest；在当前环境里由于还没有被人工标记为 `accepted_for_export` 的样本，所以导出结果为 0 条

## 为多端架构与真正产品准备的进度判断

### 已经达到 multi-surface-ready 基线的部分

1. surface-agnostic recording schema 已经成立
   - `recording envelope` 不再绑定单一页面实现
2. cloud persistence contract 已经成立
   - `OSS audio object + upload receipt + manifest.jsonl`
3. queue fallback contract 已经成立
   - `IndexedDB recorder queue + automatic background retry`
4. dataset / memory 边界已经成立
   - canonical label、review metadata、profile summary 各有边界

### 还没有达到真正可复用产品基线的部分

1. 没有统一的 surface readiness contract
   - 还缺 `web / pwa / mobile / desktop` 的录音权限、设备状态、后台能力矩阵
2. 还没有真正的 review worker
   - 现在已经有 review service、受保护的 review queue 读写接口和 `reviewed_at / reviewer / rejection_reason / accepted_for_export` 状态机字段
   - 但复核推进仍主要靠 API / 脚本调用，还没有独立 worker / audit 流
3. 没有统一的 sync daemon 语义
   - 当前自动补登主要落在 web 端 hook，未来 app 需要更稳定的后台同步 owner
4. dataset export contract 还没有完全跑通
   - `accepted_for_export / reviewer / reviewed_at / rejection_reason` 和第一版 export manifest 脚本已经落地
   - 还缺真实 accepted 样本验证、OSS audit trail 与后续导出 worker

## 数据面到底要优化到哪里

数据面不该被无限上纲成“先做一个大而全的数据平台”。对当前 `VoxFlame` 来说，做到下面 4 层就够支撑真正有用的产品：

1. 录音事实层
   - `recording envelope`
   - `audio object`
   - `upload receipt`
   - `manifest`
2. 样本治理层
   - `lineage`
   - `dedupe`
   - `sample_quality`
   - `review_queue`
3. 导出与复核层
   - `accepted_for_export / rejected / reviewed_at / reviewer`
   - dataset export manifest
4. memory-safe 聚合层
   - training profile summary
   - confusion patterns
   - recommended focus

超过这 4 层之后，再往上做更复杂的数据平台、通用特征仓或大规模离线流程，都不该抢当前主产品主线。

## `ququ` 与 `vocotype-cli` 现在还值得继续迁移什么

### 来自 `ququ`

更值得进入下一阶段多端产品设计的是：

1. recorder readiness manager
2. 权限与设备降级状态
3. 本地长期状态与页面态分层

### 来自 `vocotype-cli`

更值得继续推进到主链的是：

1. 真正独立的 dataset review worker
2. export manifest / audit trail
3. 更明确的 async derivation 队列

## 下一阶段实施优先级

### Phase A：把 web/PWA 版本做成真正的多端基线收尾

1. 用真实物理麦克风补一次新的 `upload/sign -> OSS -> upload/complete` smoke
   重点确认 `latency_ms / confidence / sample_quality_* / review_*` 稳定进入 `manifest.jsonl`
2. 继续加固 `voice_contributions` 的唯一键 / 幂等 contract
3. 把自动补登结果回写成更清楚的云端回执状态，而不是只在前端局部提示

### Phase B：把 dataset 治理层补齐

1. 把 review queue 推进成真正的 worker contract
   - 默认只消费自动校验命中风险的样本，不接管全部句子录入
2. 让对象存储目录、manifest 和 export 清单保持同一套字段语言
3. 用一条真实 accepted sample 完成 export manifest 闭环

### Phase C：为 mobile / desktop companion 开路

1. 增加 `surface readiness` 文档与状态机
2. 定义 companion / app 侧 `recorder sync worker` 与本地队列 owner
3. 保持 web、PWA、mobile、desktop 共用同一套 recording schema 与 upload receipt contract

## 一句话结论

`VoxFlame` 的 dataset 链路已经不再停留在“能录、能传、能存一条数据库记录”的阶段，而是已经具备了支撑多端产品复用的第一版骨架。

现在真正要推进的，不是继续发散更多训练句子，而是把 `recording envelope + upload receipt + manifest + 自动对应性校验 + review signals` 做成跨 surface 可复用的长期 contract；等这条链收尾验证完成后，dataset 就应该退到次主线，主线转向 runtime / surface / workspace owner。

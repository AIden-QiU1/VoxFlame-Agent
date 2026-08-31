# 录音工作流可靠性治理与完整测试计划

> 日期：2026-08-29  
> 分支：`release/mobile-parity-0.1.4`  
> 状态：五步风险收口已完成自动验证，真机/生产门仍待完成，尚未部署  
> 目标用户：包含构音障碍、ASR 低置信度和长时间连续录制用户

## 1. 结论

账号 308 的大量连续录制暴露的不是一个孤立页面问题，而是同一类系统性问题：录音目标、页面游标、ASR 结果、目录请求、账户进度和持久化结果分别由多个 `state/ref/effect` 更新，但没有统一的所有权、事件作用域和事务结果。

短期修复必须保留：普通数据录入只要产生完整 recording envelope 就推进，ASR 质量只能给出建议，不能控制导航。当前先以小型纯函数、capture snapshot、generation 和后端可恢复步骤收口现役链路；长期是否继续抽成共享 TypeScript reducer，应以剩余 28 场景测试缺口和跨端复用收益决定。不是全仓重写，也不引入 XState；每一阶段先加测试和守卫，再迁移一段现役链路，最后删除旧状态写入口。

预期结果不是“以后不再出现任何新业务边界”，而是把同类错误变成状态机不允许、测试可复现、线上可观测的失败，而不是靠用户大量录制后才发现。

### 1.1 2026-08-29 实施状态

本轮按风险依赖顺序完成了五步可回退收口；它覆盖当前重复句、错绑、跨账号污染和撤回误删的主要现役路径，但不等于第 13 节所描述的完整共享 reducer/model-based 框架已经全部实现。

1. Mobile 冻结开始录音时的账号、题目和材料 lineage；加载更多不再重置游标，页末会加载下一页或进入明确完成态，并阻止快速重复开始。
2. Backend 撤回先写最小 tombstone，再以 ETag 条件重写擦除 manifest 正文与 transcript，随后删除音频，最后删除数据库记录；失败时保留可重试的 durable lookup。
3. Web progress、Mobile catalog/memory 和本机录音队列按账号与 request generation 隔离；旧响应、旧账号队列和迟到结果不能覆盖新上下文，本机队列读改写串行化。
4. Backend 强制校验 OSS 路径属于已认证账号；complete/discard 按账号串行，撤回的 contribution ID、audio path、recording ID 必须指向同一录音，避免同账号误删相邻样本。所有仓库内 manifest 消费者统一折叠 tombstone。
5. 自动验证通过：Frontend 116 项测试、TypeScript、25/25 production build；Backend RTC、路径策略 2 项、artifact/撤回 19 项及 build；Mobile training、memory/account scope、typecheck、静态检查及 Android/iOS Expo export。最终 docs harness 与 diff 检查见任务状态。

仍未完成且不能宣称通过：账号 308 真实设备连续录制、Android/iOS 真机账号切换/断网/撤回、专用 E2E 账号的 Playwright 时序套件、真实多实例/数据库并发 50 轮、生产 canary 与部署。Expo export 还显示宿主环境设置了 `NODE_TLS_REJECT_UNAUTHORIZED=0`；发布构建前必须移除该不安全环境配置并重新验证。

## 2. Step 0：范围挑战

### 2.1 What already exists

| 已有能力 | 当前价值 | 方案如何复用 |
| --- | --- | --- |
| `recording_id` / `client_capture_id` | 关联一次采集、ASR 和上传 | 直接纳入 capture snapshot 与 operation scope，不再造第三套 ID |
| Backend `(contributor_id, audio_path)` 唯一索引 | 上传重试最多产生一条 DB 记录 | 保留，并补并发与 receipt 延迟契约测试 |
| Web `recordingExerciseRef` | 已在开始录音时冻结题目 | 提升为显式、可测试的 capture snapshot |
| Mobile native queue 的 `recordingText/context` | 本地录音已有冻结字段 | 停止、反馈、上传全部改为读取同一 snapshot |
| Web `useRecordingProgress` single-flight、超时、本地/云端合并 | 已解决重复刷新和长历史白屏的一部分 | 增加 `accountId + scope generation + latest-wins`，不重建进度系统 |
| Web/Mobile 严格替换 helper | 已规定“先撤回旧版，再开始新版” | 作为 reducer 的 replacement transition 与契约测试输入 |
| Mobile 13 项真机验收 JSON 门 | 已有设备证据格式和校验器 | 扩展录音可靠性项目，不另建一套手工表格 |
| Web Playwright 指南 | 已规定页面行为优先浏览器验证 | 增加可重复的录音、网络乱序和账号切换套件 |

### 2.2 最小完整范围

本方案只治理训练/数据录入的录音工作流：选择题目、开始/停止、ASR 关联、回看、收录、撤回、替换、推进、进度恢复和分页。RTC 沟通主链不改，题库内容与 ASR 模型不改。

完整实现会跨 Web、Mobile、Backend 和测试基础设施，直接一次性修改会超过 8 个文件，因此必须拆成 5 个可独立回退的 PR。每个 PR 最多迁移一个所有权边界，不能让新旧状态机同时长期写同一字段。

### 2.3 工程判断

- 这是“偿还状态管理债务”，不是新增产品功能。
- 使用 reducer、AbortController、请求 generation、幂等键和后端可恢复操作，均是现有技术栈内的成熟能力。
- 不新增消息队列、工作流平台或第二套数据库；优先使用现有 React、TypeScript、Supabase、IndexedDB/native queue。
- 共享的是业务 transition contract 和测试向量；Web、Mobile 的录音设备与持久化 adapter 继续独立。

## 3. 当前已确认问题

| 位置 | 已确认问题 | 可能后果 |
| --- | --- | --- |
| Web `contribute/page.tsx` | 推进曾绑定 ASR `retry` | 录音已保存但重复当前句；已直接修复 |
| Web `useRecordingProgress.ts` | Hook 不接收 `userId`，请求未按账户代次隔离 | A 账号旧响应覆盖 B 账号进度 |
| Web 撤回流程 | 乐观移除本轮进度后，撤回失败未完整回滚 | UI 再次出题，但云端旧录音仍存在 |
| Mobile `App.tsx` | 停止时重新读取 `effectiveExercise` | 录音期间材料刷新可能把音频绑定到另一句 |
| Mobile `App.tsx` | `visibleExercises` 变化就重置到第 1 句 | 加载更多后跳回开头 |
| Mobile `App.tsx` | 当前页末句确认后不加载下一页，也无完成态 | 再次录制会重复末句 |
| Mobile catalog Hook | 没有 abort/generation/latest-wins | 旧主题请求晚返回后覆盖新主题 |
| Mobile | 未消费账户级 `/upload/progress` | 跨登录、跨设备、长文轮次与 Web 不对等 |
| Backend 撤回 | DB、manifest、transcript、OSS 是跨存储多步删除 | 中途失败可能留下部分删除，客户端无法把它当普通失败处理 |

## 4. 产品不变量与成功标准

以下不变量是测试与发布的唯一验收合同：

1. 一条录音永远绑定开始录音时的 `accountId + prompt + lineage + round`。
2. 同一 `recordingId/audioPath` 无论上传重试或并发提交多少次，最多产生一个持久资产。
3. 普通数据录入成功收下 recording envelope 后，绝不静默停留原句；ASR 差异不阻止推进。
4. 筛查只有在获得可用 transcript 后推进；空 transcript 明确要求重录。
5. 撤回和替换是显式事务；失败时不能显示“已删除”，也不能同时留下两个有效版本。
6. 账号、主题、材料、文章轮次或请求代次变化后，旧异步结果不得改变新上下文。
7. 本地音频事实先于网络状态；断网不会丢录音，也不会冒充云端成功。
8. 长文当前轮次完成后进入明确完成态，只有显式开启新轮次才允许重复。
9. 普通题库分页边界可继续到下一条；加载更多不会移动当前游标。
10. 停止、确认、重录、撤回的快速双击最多触发一次副作用。

发布失败判定：上述任一不变量在自动测试、设备验收或 canary 中失败，都阻止该阶段发布；不能以“多数用户正常”放行。

## 5. 所有权模型

```text
                    持久事实
        ┌──────────────────────────────┐
        │ Web IndexedDB / Native queue │  本地音频与待上传状态
        │ Backend + Supabase + OSS     │  云端资产与账户进度
        └──────────────┬───────────────┘
                       │ scoped events / receipts
                       ▼
        ┌──────────────────────────────┐
        │ Recording Workflow Reducer   │  会话唯一状态
        │ - session scope / generation │
        │ - cursor                     │
        │ - capture snapshot           │
        │ - attempt / operation        │
        └──────────────┬───────────────┘
                       │ derived view + explicit commands
          ┌────────────┴────────────┐
          ▼                         ▼
      Web adapter               Mobile adapter
      MediaRecorder             expo-audio / LiveKit
      browser queue             native queue
```

所有权规则：

- Reducer 只做纯状态转换，不调用网络、录音设备或存储。
- Adapter 执行 reducer 发出的命令，完成后携带 `scopeKey/generation/operationId/captureId` 回传事件。
- 不匹配当前 scope 或 generation 的响应被记录为 stale 并丢弃。
- 云端 progress 只用于首次/跨设备恢复，不得抢夺活跃录音会话的游标。
- ASR 是 attempt 的 advisory 数据，不是普通数据录入推进的事实源。
- Web 可保留 `auto_commit`，Mobile 可保留 `confirm_commit`；差异必须是显式 policy，不得分叉状态语义。

## 6. 状态机

```text
bootstrapping
      │ SESSION_READY
      ▼
    ready ── START(capture snapshot) ──► recording
      ▲                                      │ STOP
      │                                      ▼
      │                                  finalizing
      │                         ┌────────────┴────────────┐
      │                         │ envelope missing        │ envelope saved
      │                         ▼                         ▼
      │                recoverable_error              reviewing
      │                                                   │
      │                    ┌──────────────┬───────────────┼──────────────┐
      │                    │ CONFIRM      │ DISCARD       │ REPLACE      │
      │                    ▼              ▼               ▼              │
      │                 saving        discarding      replacing          │
      │                    │              │               │              │
      │          SAVE_OK   │    DISCARD_OK│     old gone + START_OK      │
      │                    ▼              ▼               ▼              │
      │                  saved         discarded       recording         │
      │                    │ ADVANCE                                      │
      └────────────────────┴────────────► advancing ──► ready(next)       │
                                                   └──► completed         │
                                                                         │
任一异步状态 ── retryable failure ──► recoverable_error(previous stable) ┘
```

Capture snapshot 在 `START` 时一次性冻结：

```ts
interface CaptureSnapshot {
  accountId: string
  sessionScopeKey: string
  sessionGeneration: number
  captureId: string
  recordingId: string
  exerciseId: string
  exerciseText: string
  exerciseCategory: string
  preparedExpressionId?: string
  readingArticleId?: string
  readingArticleVersion?: string
  readingSegmentId?: string
  readingSegmentIndex?: number
  readingRoundId?: string
}
```

禁止状态：

- `recording` 没有 capture snapshot。
- 同一个 operation 同时处于 saving 与 discarding。
- 当前 account 与 capture snapshot account 不同仍继续提交。
- `completed` 自动回到长文第一段。
- ASR 事件直接修改 cursor。

## 7. 异步与事务协议

### 7.1 Scope 与 generation

```text
scopeKey = accountId / flow / material-kind / material-id / article-round

请求开始: generation = N
上下文切换: generation = N + 1，abort N
响应返回: 仅当 response.scopeKey == current.scopeKey
                 且 response.generation == current.generation 时接收
```

目录 `loadMore` 还必须匹配请求发起时的 `expectedOffset`，结果按 exercise ID 去重后追加，绝不重置当前 selection。

### 7.2 录音保存

```text
本地音频落盘
  -> queue item(local_only/upload_pending)
  -> 上传对象
  -> complete(recordingId, audioPath)
  -> Backend 幂等收敛 DB/manifest/transcript
  -> receipt
  -> queue 标记 uploaded/indexed
```

receipt 延迟或丢失时，客户端以同一 `recordingId/audioPath` 重试，不生成新 ID。UI 在 receipt 到达前只能显示“已保存在本机/正在同步”，不能显示云端成功。

### 7.3 撤回与严格替换

跨 DB/OSS/manifest 的删除不能假装是单数据库事务。后端应提供以 `recordingId` 为幂等键的可恢复 deletion operation：

```text
DELETE requested
  -> operation accepted (pending)
  -> remove manifest/transcript/audio/DB with per-step durable status
  -> complete only when all required targets are absent
  -> retries resume missing steps
```

客户端在 operation complete 前保留 attempt 并显示“正在撤回”；失败显示可重试状态。严格替换只能在旧 operation complete 后开始新 capture。若本阶段暂不增加 durable operation，至少必须做到后端删除步骤幂等、返回逐项结果、客户端不做不可回滚的乐观进度删除，并把完整 saga 列为发布前阻断项，而不是长期 TODO。

## 8. 代码路径覆盖图

```text
CODE PATH COVERAGE（当前 -> 目标）
================================
[+] Web stop recording
    ├── [★★★ 已有] envelope 成功且 ASR retry 仍推进
    ├── [★★  已有] envelope 缺失不推进
    ├── [GAP] ASR final 晚到/乱序只更新同一 capture
    └── [GAP] 快速双击 stop 只执行一次

[+] Web progress
    ├── [★★★ 已有] cloud + 当前账户 local queue 合并
    ├── [★★  已有] single-flight 与 8 秒超时
    ├── [GAP] A -> B 直接切换，A 响应被丢弃
    └── [GAP] logout 时取消请求并清空派生状态

[+] Web discard / replace
    ├── [★★★ 已有] replacement 先撤回再开始
    ├── [GAP] discard 500/timeout 完整恢复本轮状态
    ├── [GAP] saving 中 discard 与迟到 receipt 收敛
    └── [GAP] 双击 discard/replace 单副作用

[+] Mobile capture orchestration
    ├── [★★  已有] queue 冻结 recording text/context
    ├── [GAP] feedback/recognition/upload 读取同一 capture snapshot
    ├── [GAP] 录音期间 loadMore/material refresh 不错绑
    └── [GAP] stop 双击与 ASR final 乱序

[+] Mobile catalog/navigation
    ├── [GAP] latest-request-wins
    ├── [GAP] loadMore 保持当前 cursor
    ├── [GAP] 第 120 条确认后加载并进入第 121 条
    └── [GAP] 末项进入 completed/new-round，不原地重复

[+] Backend asset lifecycle
    ├── [★★  已有] DB unique index + existing lookup
    ├── [GAP] 两个并发 complete 只产生一份 manifest/transcript
    ├── [GAP] receipt 更新延迟后重试收敛
    ├── [GAP] discard 每一步失败均可恢复
    └── [GAP] 两设备同时提交/撤回的确定结果
```

当前覆盖质量：直接重复句回归已有高质量纯函数测试；其余竞态大多只有实现保护或人工验收，没有确定性时序测试。实施完成门槛是上图所有 `[GAP]` 转为自动测试或明确的真机门；任何跨存储静默半失败不得仅留人工验证。

## 9. 用户流程覆盖图

```text
USER FLOW COVERAGE
==================
选择材料 -> 开始录音 -> 停止 -> 回看/保存 -> 下一句
   │            │          │          │            │
   │            │          │          │            ├─ 普通短句：成功即下一句
   │            │          │          │            ├─ 分页边界：自动加载下一页
   │            │          │          │            └─ 长文末段：明确完成，不自动重复
   │            │          │          ├─ 断网：本机保存，稍后重试
   │            │          │          ├─ 不收录：完整撤回或保持原状态
   │            │          │          └─ 重录：旧版消失后才开始新版
   │            │          ├─ ASR 晚到：只关联本次 capture
   │            │          └─ 双击停止：只生成一个 attempt
   │            └─ 期间材料/目录变化：继续绑定开始时题目
   └─ 账号/主题切换：旧请求和旧进度不能污染新页面

跨会话：
设备 A 保存 -> 云端 progress -> 设备 B 登录 -> 从下一条未读恢复
设备 A 离线保存 -> 设备 B 不得显示云端成功 -> A 上线补传 -> 两端最终一致
```

## 10. 五层测试策略

### 10.1 L1：纯 reducer / model-based 单元测试

计划新增：

- `packages/recording-workflow/src/recording-workflow.reducer.test.ts`
- `packages/recording-workflow/src/recording-workflow.model.test.ts`
- `packages/recording-workflow/test-vectors/recording-workflow-v1.json`

测试方式：固定事件向量 + 确定性 seed 的模型遍历。至少运行 100 个 seed、每个 200 个合法/非法事件；每一步检查 10 条产品不变量。失败必须输出 seed 和完整事件序列，可直接重放。无需引入随机网络服务。

### 10.2 L2：Web Hook / 组件集成测试

计划新增：

- `frontend/src/hooks/useRecordingProgress.integration.test.tsx`
- `frontend/src/app/contribute/recording-workflow.integration.test.tsx`
- `frontend/src/lib/recording/recording-operation-coordinator.test.ts`

使用可延迟 Promise、fake timers、mock fetch 和内存 queue，主动控制 A/B 账户、请求返回顺序、超时和迟到 receipt。组件测试必须断言用户可见文字、按钮禁用状态、当前题目和一次性副作用调用次数。

### 10.3 L3：Mobile orchestration 测试

计划新增：

- `apps/mobile-workbench/src/training/mobile-recording-workflow.test.ts`
- `apps/mobile-workbench/src/training/mobile-catalog-coordinator.test.ts`
- `apps/mobile-workbench/src/training/TrainingPracticeScreen.test.tsx`

使用 `jest-expo` 与 React Native Testing Library；mock `expo-audio`、LiveKit transcript、native queue 和 catalog。现有脚本级纯函数测试继续保留。`TrainingPracticeScreen` 从大 `App.tsx` 中提取后，测试只关注录音编排，不快照整个 App。

### 10.4 L4：Backend 幂等/撤回契约测试

计划新增：

- `backend/src/services/upload-artifact.lifecycle.test.ts`
- `backend/src/controllers/upload.controller.integration.test.ts`
- `backend/test/recording-lifecycle-fixtures.ts`

测试 adapter 注入 DB/OSS/manifest 故障点；本地 Supabase 集成测试验证真实唯一索引和并发。每个删除步骤都注入一次失败，再以同一 operation ID 重试，最终必须达到全删除或明确 pending，不允许接口返回成功但仍残留有效资产。

### 10.5 L5：Playwright + Android/iOS 真机验收

计划新增：

- `frontend/e2e/recording-workflow.spec.ts`
- `frontend/e2e/recording-account-isolation.spec.ts`
- 扩展 `apps/mobile-workbench/device-acceptance.example.json`
- 扩展 `apps/mobile-workbench/scripts/validate-device-acceptance.mjs`

Playwright 在 `http://localhost:3000` 使用 Chromium fake microphone 和固定 WAV，测试真实浏览器权限、按钮、网络和 console。账号 308 仅做本人设备观察性 smoke，不把个人凭据写入测试；自动账号隔离使用专用 E2E A/B 账户与 CI secret。Android 和 iOS 必须分别提交设备 JSON 证据。

## 11. 预期效果到测试的完整映射

说明：下面文件为实施目标；标注“已有”的测试当前已经存在，其余随对应阶段代码一起提交。

| ID / 预期效果 | 自动测试与输入事件序列 | 最终状态 | 持久层断言 | UI 断言 | E2E/真机 | 通过门槛 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 普通录入不受 ASR retry 阻断 | 已有 `training-attempt-navigation.test.ts`；`START(a) -> ENVELOPE_OK -> ASR_RETRY -> ADVANCE` | `ready(b)` | a 有一个本地/云端记录 | 当前题为 b，提示可主动重录 | Playwright + 双端真机 | 连续 20 次低分，0 次重复 a |
| T02 无完整音频不推进 | reducer；`START(a) -> STOP -> ENVELOPE_MISSING` | `recoverable_error(a)` | 无 queue/DB 资产 | 明确“未生成完整录音”，仍为 a | Playwright | 100% 不推进、不上传 |
| T03 筛查空 transcript 不推进 | reducer；`assessment START(a) -> ENVELOPE_OK -> ASR_FINAL("")` | `reviewing/retry(a)` | 音频按筛查策略保留或撤回，不能记完成 | 明确要求重录 | Playwright + 真机 | 0 次误计入筛查完成 |
| T04 Capture 冻结 | Mobile/Web integration；`START(a) -> CATALOG_REFRESH(b) -> STOP -> ASR_FINAL` | attempt.exercise=a | metadata/queue 全部为 a lineage | 回看显示 a，不显示 b 的反馈 | 双端真机 | 100 次注入 0 错绑 |
| T05 ASR final 晚到 | reducer；`capture1 stop -> capture2 start -> ASR_FINAL(capture1)` | capture2 不变 | ASR 只附着 recording1 | 当前题/反馈不被旧结果覆盖 | Playwright + 真机 | 旧事件丢弃率 100% |
| T06 ASR final 乱序 | reducer；final2 先于 final1 | 各 attempt 正确关联 | 两条 recording ID 各自 transcript 正确 | 无反馈串句 | 自动即可，真机抽检 | 0 串绑 |
| T07 目录请求乱序 | Mobile catalog；`select A(req1) -> select B(req2) -> resolve req2 -> resolve req1` | scope=B | 无持久写 | 显示 B，A 响应不闪回 | 真机 | 100% latest-wins |
| T08 progress 乱序 | Web Hook；`account A req1 -> account B req2 -> B OK -> A OK` | B progress | 仅 B local queue 合并 | 不出现 A 的时长/已读句 | Playwright | 0 跨账号字段污染 |
| T09 退出时上传进行中 | integration；`SAVE_PENDING(A) -> SIGNED_OUT -> RECEIPT(A)` | signed_out，A receipt 被隔离 | A queue/receipt 仍归 A，B 不可见 | 登录页/未登录态稳定 | Playwright + 双端真机 | 不丢 A、不显示给 B |
| T10 A→B 直接切换 | Hook/component；无中间 false 的 `ACCOUNT_CHANGED` | `bootstrapping(B) -> ready(B)` | queue 按 contributor 过滤 | B 从自己的进度恢复 | Playwright + 双端真机 | 0 次短暂显示 A 数据 |
| T11 receipt 延迟 | lifecycle；`COMPLETE persisted -> receipt timeout -> retry same ID` | `saved` | DB/manifest/transcript 各 1 条 | 先显示本机已保存，后显示同步完成 | Playwright + 真机 | 任意重试次数仍 1 资产 |
| T12 上传失败转本地队列 | integration；`SAVE -> network error` | `recoverable_error/local_only` | 音频文件和 queue item 存在，DB 无成功假象 | 显示“保存在本机，可重试” | 双端真机 | 杀进程重开后仍可恢复 |
| T13 撤回 500/超时 | reducer + backend；`DISCARD -> 500/timeout` | 原 stable attempt 或 `discard_pending` | 不返回 complete；资产可用或 operation 可继续 | 不显示“已撤回”，提供重试 | Playwright + 双端真机 | 无 UI/云端分裂 |
| T14 撤回逐步故障 | backend lifecycle；依次在 DB/manifest/transcript/OSS 注错并重试 | `discarded` 或可审计 pending | 所有目标最终不存在；同 ID 重试安全 | 客户端最终收到确定状态 | API integration | 每个故障点 100% 收敛 |
| T15 严格替换 | `REPLACE -> DISCARD_COMPLETE -> START_NEW`；并测 discard fail | 新 capture 或保留旧 attempt | 任一时刻最多一份有效版本 | 失败不启动新录音 | Playwright + 真机 | 0 双版本窗口 |
| T16 快速双击 stop | component；两次 press 同 tick | 一个 `finalizing/reviewing` | `stopRecording` 与 queue append 各 1 次 | 第二次按钮禁用/无响应 | Playwright + 真机 | 调用次数严格 1 |
| T17 快速双击 confirm | component；confirm×2 | 一个 saving/saved | upload/complete 各 1 次 | 单一 loading/receipt | Playwright + 真机 | 调用次数严格 1 |
| T18 快速双击 discard/replace | component；action×2 | 单 operation | 删除一次；新 capture 最多一次 | 无重复弹层或双录音 | Playwright + 真机 | 副作用严格 1 |
| T19 loadMore 保持游标 | Mobile integration；当前 80 -> `LOAD_MORE(120)` | 仍为 80 | 无录音写 | 题目和进度数字不跳 1 | 真机 | 0 cursor reset |
| T20 120 分页边界 | `ready(120) -> CONFIRM -> LOAD_MORE -> page OK` | `ready(121)` | 120 已保存一次 | 自动显示 121，加载态可见 | Playwright(目录模拟)+真机 | 不回到 1、不停留 120 |
| T21 当前未读只剩 1 条 | 已有导航测试扩展；`active=[c], fallback=[a,b,c], accept(c)` | `ready(a)` 普通复练 | c 记完成 | 不原地显示 c | Playwright | 下一题必须 distinct，除非总题数=1 |
| T22 总题数只有 1 | reducer；`only(a) -> accept` | `completed` 或明确可复练 | a 仅新增一次 | 显示完成/主动再录，不伪装下一句 | 组件 | 不自动产生第二次录音 |
| T23 长文最后一段 | `round1 last -> SAVE_OK` | `completed(round1)` | round1 全段完成 | 显示“本轮完成”，无录音按钮自动指向首段 | Playwright + 双端真机 | 刷新后仍完成 |
| T24 显式新轮次 | `completed -> RESET_OK(round2)` | `ready(round2:first)` | round2 durable，round1 音频保留 | 显示 0/N 新轮次 | Playwright + 双端真机 | 未录首句刷新仍是 round2 |
| T25 两标签页同一录音重试 | Backend concurrent complete | 两端收到同一资产结果 | DB/manifest/transcript 各 1 条 | 两页最终 progress 一致 | Playwright multi-page + API | 50 轮并发无重复 |
| T26 两设备相邻句并发 | A 保存 x、B 保存 y，progress 乱序刷新 | 各自会话不跳题，最终云端合并 | x/y 各 1 条 | 刷新后均看到 x/y 已录 | 双端真机 | 最终一致且无丢失 |
| T27 材料刷新改变 lineage | `START(article-v1:s3) -> v2 refresh -> STOP` | attempt 仍为 v1:s3 | metadata 保留 v1/s3/round | 提示当前录音属于开始时版本 | 双端真机 | 0 跨版本错绑 |
| T28 10,000 历史记录 | progress API +页面恢复 | ready，无整页永久阻塞 | 聚合接口，不搬运全量 metadata | 首次可退出、后台刷新不遮页 | Playwright + staging | p95 ≤2s，响应 ≤150KB |

## 12. 故障模式表

| 故障模式 | 当前处理 | 目标处理 | 自动测试 | 用户体验 | 严重度 |
| --- | --- | --- | --- | --- | --- |
| ASR 低分 | 曾阻止普通录入推进 | 仅建议，录音事实推进 | T01 | 下一句 + 可主动重录 | P0，直接修复已有 |
| ASR 晚到/乱序 | Web capture ID；Mobile capture snapshot | reducer scope 丢弃 stale | T05/T06 | 不串反馈 | P0，代码保护已有，真机待验 |
| 目录旧响应覆盖 | Mobile Abort + generation | 保持 latest-wins | T07 | 不闪回旧主题 | P0，自动测试已有 |
| progress 跨账号覆盖 | Web account generation | Mobile 接入云端 progress | T08–T10 | 不泄露、不串进度 | P0，Web 已收口，跨设备待验 |
| upload receipt 延迟 | 可能重复调用 complete | 同 ID 幂等收敛 | T11/T25 | 明确同步中 | P0 |
| 断网上传失败 | 已有 local queue | reducer 明确 local_only | T12 | 可恢复，不假成功 | P0 |
| 撤回 500/超时 | Web 不再提前移除进度/队列 | operation 可重试 | T13 | 旧录音仍可见或明确处理中 | P0，代码保护已有 |
| 撤回跨存储部分失败 | tombstone + 条件 scrub + DB 最后删 | durable operation/saga | T14 | 不宣称成功，可重试收敛 | P0，单进程故障测试已有 |
| 双击动作 | 主要依赖局部布尔状态 | operationId + reducer guard | T16–T18 | 单一进行态 | P1 |
| 加载更多重置 | append 与 selection 已分离 | 保持现状 | T19 | 当前句不变 | P0，自动测试已有 |
| 页末停留 | 自动加载或完成态 | 保持现状 | T20–T22 | 不静默重复 | P0，自动测试已有 |
| 两设备并发 | 后端部分幂等 | 资产级幂等 + progress 最终一致 | T25/T26 | 不丢、不重复 | P1 |

当前最关键的剩余缺口是：Backend 仍是单进程串行和可重试步骤，而不是带持久 operation 状态的跨实例 saga；尚未完成真实数据库/OSS 故障注入、50 轮多实例并发和真机/生产 canary。这些不能由前端状态保护替代。

## 13. 分阶段实施

以下是完整目标路线，不应与本轮五步风险收口混同。当前进度：Phase 0 代码完成但设备门未过；Phase 1 只落了 Web/Mobile 小型纯函数，尚无共享 package 和 model-based 遍历；Phase 2/3 的 P0 竞态已收口，但组件拆分、全量 reducer 迁移、Mobile 云端 progress 和真机门未完成；Phase 4 已有 tombstone/条件 scrub/串行化和故障顺序测试，但无 durable operation 与真实多实例并发；Phase 5 尚未完成。

### Phase 0：发布当前直接修复

- 保留 `getNextExerciseAfterAcceptedRecording` 及已有回归测试。
- 账号 308 在真实设备连续录制 5 句，其中至少 2 句人为制造明显 ASR 差异。
- 确认每句只保存一次、每次都进入不同下一句、console/network 无重复 complete。
- 这是止血，不代表框架治理完成。

### Phase 1：建立共享 transition core

- 新增 `packages/recording-workflow`，只包含类型、纯 reducer、不变量断言和测试向量。
- 不碰录音设备和 API；先用 Web/Mobile 现有行为回放向量。
- Next 与 Expo 各做一次 package import build spike，通过后才迁移消费者。
- Gate：L1 全绿，model-based 100×200 事件无不变量失败。

### Phase 2：Web 收敛

- `useRecordingProgress` 显式接收 `userId`，账户切换 abort/reset/latest-wins。
- 迁移 selection/capture/review/save/discard/replace 到 reducer。
- 修复撤回失败的 UI 与 session progress 回滚。
- 四个调用 `useRecordingProgress` 的页面全部传 account scope。
- Gate：L1/L2 + Web Playwright 全绿；旧 ref/state 不再写已迁移字段。

### Phase 3：Mobile 收敛

- 从 `App.tsx` 提取 `TrainingPracticeScreen`，避免继续扩大单文件状态面。
- 开始录音时冻结完整 capture snapshot；停止、ASR、反馈、上传只读 snapshot。
- catalog 增加 abort/generation；loadMore 追加不重置；页末自动加载或完成。
- Gate：L1/L3、Android/iOS bundle、两端真机录音可靠性项目通过。

### Phase 4：Backend 资产生命周期

- 把 complete/discard 变成以 recording ID 为核心的幂等 contract。
- 增加可恢复 deletion operation 或等价 durable 状态；逐项记录清理结果。
- 给 DB unique race、manifest/transcript append、receipt 延迟和每个删除故障点加集成测试。
- Gate：L4 全绿；50 轮并发 complete 无重复；所有故障点重试收敛。

### Phase 5：账户级进度与跨设备对等

- Mobile 消费 `/upload/progress`，只用于 session 初始化/恢复。
- 普通题库、自定义材料、长文轮次采用同一 scope 语义。
- 删除已迁移的旧 effects/refs，不保留双写兼容层。
- Gate：T08–T10、T23–T26 的 Playwright/双端真机证据齐全。

## 14. 预期改动边界

建议目标文件，不要求一次全部修改：

- 共享：`packages/recording-workflow/**`
- Web：`frontend/src/app/contribute/page.tsx`、`frontend/src/hooks/useRecordingProgress.ts`、录音 operation coordinator 与测试
- Mobile：`apps/mobile-workbench/App.tsx`、`TrainingPracticeScreen`、`use-mobile-training-catalog.ts` 与测试
- Backend：`upload.controller.ts`、`upload-artifact.service.ts`、必要 migration 与 lifecycle tests
- E2E：`frontend/e2e/**`、Mobile device acceptance schema/validator

每阶段改动生产代码超过 8 个文件时再次拆分；结构迁移和产品行为改变不能塞进同一不可回退提交。

## 15. 性能与可观测性门槛

- 同一 tab/account/scope 最多一个 progress 请求在途；scope 变化立即 abort。
- 账号 308 等长历史账户的 progress p95 ≤ 2 秒，响应体 ≤ 150 KB；8 秒超时后页面仍可录音。
- catalog loadMore 只追加新 ID，单页 120 条；不得因追加触发全列表游标重算或跳首项。
- recording envelope 本地返回后，普通录入下一题在 500 ms 内可见；不等待云端 receipt。
- 指标按匿名 ID 记录：`stale_event_dropped`、`duplicate_operation_blocked`、`capture_scope_mismatch`、`discard_pending_age`、`progress_latency_ms`、`catalog_generation_discarded`。
- 日志不记录题目正文、transcript、音频路径、手机号或 token；只记录不透明 operation/capture/recording ID 和状态。

Canary 告警：

- `capture_scope_mismatch > 0`：立即阻止扩大发布。
- 任何 recording ID 产生多条有效 DB/manifest 记录：P0 回滚。
- `discard_pending` 超过 10 分钟：告警并进入人工核对队列。
- 连续录制“保存成功但 prompt ID 未变化”比例 > 0.1%：停止 rollout。

## 16. 发布门与回滚

### 自动门

1. L1 reducer/model tests 全绿，所有 transition 分支 100% 覆盖。
2. Web 全量测试、TypeScript、production build、Playwright 录音套件全绿。
3. Mobile check/typecheck/training tests、Android/iOS export 全绿。
4. Backend build、upload lifecycle、真实 DB unique race 测试全绿。
5. `bash scripts/check_ai_docs.sh` 与 `git diff --check` 全绿。

### 人工/设备门

- Web：Chrome + Android Chrome，账号 308 连续 5 句；另用测试账号连续 20 句。
- Android/iOS：各完成新增录音可靠性验收项，必须附时间、版本、设备、录屏/日志引用。
- 双设备：同账号相邻句并发、A/B 账号切换、离线后补传、长文最后一段与新轮次。

### 渐进发布

1. 仅测试账号开启新 workflow。
2. 账号 308 单账户 canary，观察至少 50 次录音操作。
3. 10% 录音用户，至少 24 小时。
4. 50%，再全量；每级只有在重复、错绑、跨账号污染和 pending deletion 均为 0 时晋级。

回滚只切回上一阶段的 adapter，不回滚已写入的 recording ID、queue item 或云端资产。新旧版本必须读取相同持久 contract；禁止同时双写两套游标。

## 17. NOT in scope

- 不改 ASR 模型、个性化训练或质量评分阈值；本方案只规定它们不能拥有普通录入导航权。
- 不恢复 WebSocket、TEN 或 Agora 主链。
- 不重写 RTC 沟通、memory owner 或训练题库内容。
- 不在本轮统一 Web/Mobile 的视觉设计。
- 不立即把整个 App 改造成全局状态机；只迁移训练录音边界。
- 不引入 Kafka、Temporal 或新的分布式基础设施。
- 不把账号 308 的个人登录凭据纳入自动化。
- 不创建 `TODOS.md`；阶段工作记录在 `.tasks/current.md`，实施时按 PR 切片推进。

## 18. 完成定义

“根本解决”不是代码中出现了一个 reducer，而是同时满足：

- 10 条产品不变量都有自动化证明。
- 28 个场景均有明确最终状态、持久层和 UI 断言。
- 所有 stale response、重复动作和跨账号事件被结构化拒绝。
- Backend 撤回不再存在静默半成功。
- Web、Android、iOS 和两设备证据门均通过。
- 已迁移字段只有 reducer 一个会话写入口，旧 ref/effect 写入口被删除。
- canary 中重复当前句、错绑题目、跨账号污染、重复资产均为 0。

达到以上条件后，这类问题才从“业务上不断打补丁”升级为“框架层可防、可测、可恢复”。

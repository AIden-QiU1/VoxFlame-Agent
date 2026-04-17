# VoxFlame Agent / Memory / Tooling Reference（精简版，2026-04-14）

> 这份文档只回答 4 个问题：
> 1. memory 和 dataset 到底怎么分
> 2. durable owner 是谁
> 3. runtime 现在到底做到哪一步
> 4. 上线前还必须补哪些 contract

---

## 1. 先说结论

截至 2026-04-14，VoxFlame 的正确边界是：

1. `backend workspace` 是 durable memory owner。
2. `livekit_agent` 只应该拥有 session-local working memory。
3. `dataset` 是录音资产、review、export 的体系，不是长期记忆。
4. `tooling` 现在不该扩成通用 agent 平台，只该服务实时沟通、训练录音和会后沉淀。

---

## 2. 当前代码里的真实状态

### 2.1 已经成立的部分

当前代码已经具备：

1. backend `workspace snapshot`
   - 位置：`backend/src/services/supabase.service.ts`
   - 已经能聚合：
     - `profile_bundle`
     - `session_review`
     - `preparation`
     - `prepared_expression`
     - `expression_kit`
2. frontend 已经开始只消费 `workspace snapshot`
   - 沟通页、训练页、记忆页都已接这一层
3. `prepared_expression` 已经能成为准备稿 owner
   - 可读
   - 可写
   - 可 summarize
4. 沟通页句子级资产来源也已经更清楚
   - `prepared_expression` 是用户材料 owner
   - `hotword_profiles` 是场景 / 热词模板 owner
   - `quick_phrases` 是开口短句 owner
   - `expression_kit.recommended_phrases` 只是派生推荐，不再假装自己是 owner
5. dataset 录音链已经成立
   - `recording envelope`
   - `recorder queue`
   - `upload receipt`
   - `manifest.jsonl`

### 2.2 还只是“过渡态”的部分

当前 `livekit_agent` 只有最小 session-local state：

1. `PreparationContextPack`
2. `last_user_transcript`
3. `last_assistant_reply`
4. `interruption_count`
5. `barge_in_count`
6. `caption_mode_enabled`

也就是说：

1. 已经不是“完全没有记忆”
2. 但也远没到“完整 typed session memory”

另外一个关键事实：

1. `session_compaction` 目前是由前端 `memoryService.endSession()` 生成的过渡方案
2. `livekit_agent` 本身还没有真正完成 server-side `flush -> compact -> durable write`

所以文档里不能再把这件事写成“已经彻底落地”。

---

## 3. durable memory 与 dataset 的明确边界

### 3.1 应该进入 dataset 的

1. 音频文件
2. `recording_id / session_id`
3. `target_text / recognized_text`
4. 最小对句判断
5. manifest / upload receipt

### 3.2 应该进入 durable memory 的

1. 用户长期准备稿
2. 高价值 hotword / phrase
3. 会后压缩出的稳定表达规律
4. session review
5. 对下一次沟通真的有帮助的 profile summary

### 3.3 不该直接进入 durable memory 的

1. 原始 transcript 流水
2. 每一条训练录音原样
3. 暂时不可信的 heuristic
4. review 还没通过的 dataset 判断

一句话：

`dataset != memory` 必须继续作为硬边界。

---

## 4. owner 划分

### 4.1 Frontend

frontend 负责：

1. 采集
2. 展示
3. 本地 queue 兜底
4. 调用 backend 和 runtime

frontend 不应该再承担：

1. 长期画像 owner
2. durable memory 决策
3. 页面级拼装长期上下文

### 4.2 Backend

backend 负责：

1. `workspace` durable owner
2. `prepared_expression` owner
3. `session_review` / `profile_bundle` 聚合
4. dataset artifact 与最小 `audio + target` contract

### 4.3 livekit_agent

`livekit_agent` 负责：

1. realtime ASR / correction / TTS
2. 当前会话 working memory
3. runtime context consume
4. 会后 flush / compact / write 的执行入口

但当前第 4 点还没有完全做完。

---

## 5. 上线前必须补齐的 memory contract

正式上线前，至少要把下面 3 层补齐。

### 5.1 typed session memory

至少明确：

1. 当前轮事实
2. 最近几轮承接
3. 当前 preparation snapshot
4. interruption / audio telemetry
5. 哪些字段只活在 session

### 5.2 context assembly

至少明确三个阶段：

1. `assemble_context`
   - 从 `workspace snapshot` 取最小必要上下文
2. `after_turn`
   - 更新本轮 working memory
3. `compact`
   - 会后提炼可写回 durable memory 的最小结果

### 5.3 session-close durable write

正式链路应固定为：

`flush -> compact -> durable write`

在这条链真正进 agent server-side 之前，不能再把 compaction 写成“已完全稳定”。

---

## 6. 上线前必须补齐的 dataset contract

dataset 侧现在只需要稳定到：

1. 音频上传稳定
2. `target_text / recognized_text` 保存稳定
3. 最小对句判断稳定
4. 同一条录音重传不重复写 manifest
5. `audio + target` 导出稳定

---

## 7. 当前不做的事

在这轮上线前，不做：

1. 通用向量记忆平台
2. 复杂多 agent
3. 通用 workflow 平台化
4. 为了“更先进”而再开一套 memory backend

---

## 8. 当前最重要的决定

当前最重要的决定只有一句：

VoxFlame 先做成“实时沟通工作台 + 训练录音入口 + 可持续沉淀的 workspace owner”，而不是先做成“万能 agent 平台”。

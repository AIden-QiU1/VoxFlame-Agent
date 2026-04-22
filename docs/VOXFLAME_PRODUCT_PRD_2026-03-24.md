# VoxFlame Product PRD（上线收口版，2026-04-16）

> 这版 PRD 不再保留已经完成的骨架建设，只保留 4 件事：
> 1. 产品是什么
> 2. agent 上下文到底包含什么
> 3. 三个模型怎么分层
> 4. 哪些东西允许进入长期记忆

---

## 1. 产品一句话

VoxFlame 不是“纠正用户声音”的产品，而是“帮助系统更准确理解构音障碍用户意图”的沟通工作台。

当前上线前最后要看的，不是页面多少，而是两条真实体验：

1. 沟通页准确率到底够不够
2. 训练页录音到底舒不舒服，且总结/计划到底有没有用

---

## 2. 当前已完成的固定骨架

这些不再作为 PRD 待办：

1. 主链已经固定为  
   `Frontend LiveKit RTC/Data -> Backend /api/rtc/session/* -> self-hosted livekit-server -> livekit_agent`
2. 沟通页已经有 `communication loadout`
3. 记忆页已经固定成 4 个对象区：
   - 自定义材料区
   - 场景 / 热词模板
   - 用户个人画像
   - 训练总结
4. 训练页总结已经固定成：
   - 每日总结
   - 7 天总结
   - 下一轮计划
5. `workspace` 继续是唯一 durable owner
6. `livekit_agent` 已经有 typed session memory

所以现在 PRD 不再问“要不要做记忆页 / loadout / 训练总结”，而是只问这些东西是否已经达到上线级别。

---

## 3. Agent 上下文 Contract

这是上线前最重要的第一条。

### 3.1 agent 当前轮真正吃到的上下文

沟通页 agent 上下文固定由 5 层组成：

1. `session intent`
   - 当前 surface
   - 当前 mode
   - 当前 scene
   - 当前 loadout mode
2. `durable memory context`
   - 默认直接进入当前轮的用户画像
   - 默认直接进入当前轮的场景模板 / 热词模板
   - 默认直接进入当前轮的训练总结与训练重点
   - 用户手动带入的自定义材料全文
3. `runtime session memory`
   - 最近几轮已确认纠错结果
   - 当前 turn state
   - interruption / barge-in 计数
4. `当前轮输入`
   - 本轮 ASR
   - 当前参考原文
5. `system prompt`
   - 沟通页 correction 规则
   - caption 规则

### 3.2 前端用户选一份资料后，会不会自动进入 agent 上下文

会。

当前固定行为是：

1. backend 先把 `workspace snapshot.preparation` 的结构化字段装进初始上下文
2. 前端再把本次手动选择的自定义材料和 loadout 状态补成 `preparation_context_update`
3. 通过 room data 发给 `livekit_agent`
4. agent 立刻替换当前 session 的 `PreparationContextPack`
5. 后续 correction prompt 直接使用这份新上下文

也就是说：

1. `用户画像 / 场景热词模板 / 训练总结` 会默认直接进入 agent 上下文
2. `自定义材料` 仍然只在用户本次加载后才会进入当前轮 prompt
3. 真正喂给 agent 的内容来自 `preparation / prepared_expression` 这些结构化字段，不靠前端展示文案二次截词
4. `durable memory` 不会原封不动整库塞进 prompt，但也不应该被前端弱化成“只剩一行标题”

### 3.3 prompt cache 现在的边界

当前固定边界：

1. correction 链默认不依赖 prompt cache
2. 每轮都带：
   - 当前 ASR
   - 最近确认过的纠错历史
   - 默认 durable context
   - 当前手动加载的自定义材料
   - 当前参考原文 / 热词 / 风险词
3. 这样做的目的不是省 token，而是避免 cache 过期后的上下文漂移

结论：

当前上线前优先级是“上下文准确、可解释、可控”，不是先做激进 prompt cache。

### 3.4 哪些记忆负责反映“现在的现状”

不是 4 类 durable memory 都要实时抖动。

真正反映“当前现状”的层次固定如下：

1. `session memory`
   - 负责会话内实时现状
   - 最近几轮已确认表达、turn state、打断情况都在这里
2. `用户个人画像`
   - 负责沉淀最近稳定下来的现状
   - 会话结束后允许小幅更新
3. `训练总结`
   - 负责反映最近 1 天 / 7 天训练规律
   - 不负责逐轮实时刷新
4. `场景 / 热词模板`
   - 负责稳定场景知识和高频热词
   - 是低频更新，不应该每轮抖动
5. `自定义材料`
   - 负责用户手动准备的当前任务材料
   - 完全由用户更新

所以“当前状态”主要靠：

1. `session memory`
2. 会话后小幅维护的 `用户个人画像`

---

## 4. 三个模型分层

这是上线前最重要的第二条。

### 4.1 模型 1：沟通页实时 correction

这是实时链，目标是低时延和高保真。

owner：

- `DASHSCOPE_CORRECTION_MODEL`
- 未设置时回退 `DASHSCOPE_LLM_MODEL`
- 最终兜底 `qwen-flash`

职责：

1. 基于当前 ASR 做最小必要纠错
2. 利用本轮已选材料、参考原文、最近确认历史提高准确率
3. 不负责长期总结
4. 不负责训练计划
5. 不负责会后长期记忆整理

当前推荐：

1. 默认继续用 `qwen-flash`
2. 这条链不要上大模型

### 4.2 模型 2：记忆系统后台维护

这是异步链，目标不是新增“会话后 compact 文档”，而是后台维护现有 4 块长期记忆。

owner：

- `DASHSCOPE_MEMORY_MAINTENANCE_MODEL`
- 当前建议默认 `qwen3.5-plus`

职责：

1. 读取当前会话里的稳定信号
2. 判断是否值得更新现有长期记忆
3. 当前只允许后台稳定维护 `用户个人画像`
4. 不新增第五类 memory object
5. 不把整段会话转成新的长期对象
6. 不自动改写自定义材料
7. 不自动改写场景 / 热词模板
8. 不直接写训练总结

当前状态：

1. runtime 已经有 typed session memory
2. `compaction_candidate` 现在只保留为会话内运行时信号
3. 会话结束后不再写 `session_compaction` 这类新长期对象
4. 当前实际落地是：会话结束只允许小幅更新 `用户个人画像`

这条链和 correction 不是一个模型层。

### 4.3 模型 3：训练页 summary / plan

这是训练异步链，目标是短、准、有用。

owner：

- `DASHSCOPE_TRAINING_REPORT_MODEL`
- 无值时兜底 `qwen3.5-plus`

职责：

1. 只基于目标句 / 转录句差异生成：
   - 每日总结
   - 7 天总结
   - 下一轮计划
2. 不改写沟通页材料
3. 不假装自己是沟通页实时纠错器
4. 不把训练总结自动塞进沟通侧

当前要求：

1. 总结要短
2. 计划要少
3. 用户看完就能继续录，不要写成长文

---

## 5. 哪些东西可以进入后端长期记忆

这是上线前最重要的第三条。

### 5.1 允许进入 durable memory 的内容

长期记忆只允许表现为 4 块现有对象的更新，不允许再长出新的长期对象。

这 4 块的 owner 和更新节奏固定如下：

1. `自定义材料区`
   - 完全由用户手动创建、编辑、删除
   - 后台模型不能自动写入、自动补充、自动改写
   - 系统最多只能给“可复制进去”的建议，不能直接落库
2. `场景 / 热词模板`
   - 由开发者维护模板库，用户负责选择是否加载
   - 后台不会按单次会话自动改写模板
   - 这一区是低频更新，不应该每次会话抖动
3. `用户个人画像`
   - 由后台维护链持续小幅更新
   - 只允许写入稳定偏好、稳定误听规律、稳定补救策略
   - 不允许把一次性的会话波动直接写进画像
4. `训练总结`
   - 由训练总结模型定期更新并覆盖旧版本
   - daily / weekly / training plan 都从训练页 summary 流产生
   - 沟通页不直接写这一区

沟通页只允许触发这些更新：

1. `自定义材料区`
   - 沟通页不会自动写这一区
   - 只有用户手动编辑时才会更新
2. `场景 / 热词模板`
   - 新增稳定高频场景
   - 新增稳定高频热词
3. `用户个人画像`
   - 稳定的沟通偏好
   - 稳定的误听规律
   - 稳定的补救策略
4. `训练总结`
   - 沟通页不会直接写这一区

训练页只允许触发这些更新：

1. `训练总结`
   - 每日总结
   - 7 天总结
   - 下一轮计划
2. `用户个人画像`
   - 只有真正稳定的表达规律才允许小幅更新
3. `自定义材料区`
   - 训练里提炼出的高价值材料只能作为建议展示
   - 只有用户手动复制或编辑时才可进入这一区
4. `场景 / 热词模板`
   - 不自动更新

### 5.2 不允许直接进入 durable memory 的内容

这些不能直接进长期记忆：

1. 沟通页原始音频
2. 训练页原始句子全集
3. 没被用户选中的整份材料全文
4. 一整段实时 transcript
5. 单独的“session compact 文档”
6. 冗长 prompt
7. 临时 UI 状态

### 5.3 durable write 的固定原则

所有长期写回都必须满足：

1. 可解释
2. 可删除
3. 可回看来源
4. 不跨 surface 偷渡

也就是说：

1. 训练页总结不能自动变成沟通页 loadout
2. 沟通页后台更新不能自动污染用户画像
3. 只有用户显式确认后，训练总结中的某条材料才可以复制成沟通材料

---

## 6. 当前产品判断

这版 PRD 不再继续维护“上线前 blocker 清单”。

原因是：

1. 主链骨架、页面骨架和 memory/write 边界已经基本固定。
2. 剩余工作更多是持续验证、开源协作和长期扩展，不再是“最后几项上线前骨架待办”。

因此当前产品判断只保留两条：

1. PRD 继续负责定义产品边界、agent 上下文、模型分层和 durable write 原则。
2. 真实开发优先级、最近验证结果和开源协作方向，改由下面两份文档承接。

---

## 7. 配套文档

短期执行状态以：

- [../.tasks/current.md](../.tasks/current.md)

agent / memory 边界以：

- [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)

开源后的协作方向以：

- [VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md](VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)

为准。

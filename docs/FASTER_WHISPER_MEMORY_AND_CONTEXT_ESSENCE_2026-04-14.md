# Faster-Whisper 记忆与上下文管理精髓（2026-04-14）

> 目的：不是复述 ASR 功能，而是提炼 `faster-whisper` 对 VoxFlame 的“上下文治理”启发。

## 1. 一句话结论

`faster-whisper` 的核心不是“长期记忆系统”，而是**严格受控的短窗上下文系统**：  
通过 `VAD/clip` 切窗、`previous_tokens` 继承、温度触发重置、`hotwords` 注入，保持跨段一致性与抗漂移平衡。

这套思路非常适合 VoxFlame 的实时语音链路。

---

## 2. 仓库里最关键的上下文机制

## 2.1 先切窗，再识别，不盲目喂全量音频

在 [`faster_whisper/transcribe.py`](/home/ubuntu/faster-whisper/faster_whisper/transcribe.py) 里，默认流程是：

1. 用 `vad_filter` 或 `clip_timestamps` 得到语音片段
2. 对片段做 `collect_chunks`
3. 在窗口内做转写

对 VoxFlame 的直接启发：

1. 我们也应该把“可识别窗口”当成一等对象，而不是把实时流直接当单一长序列。
2. `session_review` / `training_result` 的写入粒度，优先对齐“窗口结束点”，而不是按任意 UI 事件。

## 2.2 跨窗口一致性靠 `previous_tokens`，不是无限累加 prompt

`generate_segments()` 会把 `all_tokens[prompt_reset_since:]` 当作下一窗上下文，并通过 `get_prompt()` 截断在模型长度约束内。

对 VoxFlame 的直接启发：

1. 实时会话内要保留“短期工作记忆”，但必须有明确裁剪边界。
2. `session.userdata` 里的 working memory 不能增长成长期画像；长期内容应写回 backend `workspace`。

## 2.3 “继续前文”要有熔断：`prompt_reset_on_temperature`

当温度超过阈值（默认 0.5）或关闭 `condition_on_previous_text`，会重置 prompt 继承起点，防止重复循环和时间戳漂移。

对 VoxFlame 的直接启发：

1. 会话内上下文继承要有“质量闸门”（例如置信度、中断密度、异常重复率）。
2. 一旦命中闸门，允许回退到“场景最小上下文包”，避免把错误继续放大。

## 2.4 `hotwords` 是受限注入，不是无限词库

`get_prompt()` 只在合适条件下注入 `hotwords`，且有长度上限保护。

对 VoxFlame 的直接启发：

1. `preparation.hotwords` / `asr_hotword_entries` 应严格限制数量和长度。
2. 高风险词（医疗、姓名、地址）优先级应高于“泛热词”。

## 2.5 `word_timestamps` + 异常段处理是压缩前置条件

`word_timestamps` 和异常片段跳过逻辑（hallucination silence handling）说明：  
先做时间边界和质量标注，再做上层总结，质量更稳。

对 VoxFlame 的直接启发：

1. `session-close compaction` 前应先完成 turn 级质量标注（如低置信、打断、削波）。
2. “哪些片段进入长期画像”应走白名单策略，而不是整段全入。

---

## 3. 对 VoxFlame 当前代码的映射建议

结合当前实现（`livekit_agent/asr_runtime.py`、`backend/src/services/memory-growth.service.ts`、`frontend/src/lib/memory/workspace-snapshot.ts`）：

1. **新增 `ASRWindowContext` 内部结构**  
   包含：`window_id/start_ms/end_ms/source/rms_stats/hotwords_used/prompt_reset_reason`。
2. **把热词注入改为“场景化 top-k”**  
   从 `workspace.preparation` 只取当前场景最相关词，避免全量注入。
3. **实现一次“温度等价重置”策略**  
   即便当前不是 whisper 解码温度，也可用 `低置信+高中断+短尾词` 触发上下文重置。
4. **把 compaction 输入升级为“窗口摘要集合”**  
   降低 session close 的 hallucination 污染。

---

## 4. 不该照搬的点

1. `faster-whisper` 不负责长期用户画像，不应被误当 memory backend。
2. 它是离线/准实时 ASR 引擎，不直接等价于会话治理层。
3. 我们应借鉴其“短窗上下文纪律”，而不是把 VoxFlame 变成 Whisper 风格 pipeline。

---

## 5. 给 VoxFlame 的执行优先级（建议）

1. P0：热词注入收敛（按 scene/top-k/长度上限）
2. P0：会话内上下文熔断与重置
3. P1：窗口级摘要结构化，接入 session-close compaction
4. P1：把窗口质量指标接入 memory growth 统计

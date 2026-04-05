# 当前任务状态

> 最后更新: 2026-04-05

## 当前主线

- 主任务：把当前产品主线切到“5 天内验证长时重要表达能力”的专项体验，优先做 rehearsal / live / review 闭环。
- 当前阶段：LiveKit 执行面已经足够支撑这条新主线，重点从“继续泛化替代”切到“long-form expression mode 落地”。
- 当前最值得继续的切片：`prepared expression asset ingestion -> 结构化长表达练习 -> 记忆页顶部的当前重要表达准备模块`。

## 最近 3 天有效结论

### 2026-04-05

1. 当前最重要的目标已经重新定义
   - 不是继续抽象“更完整的 agent 替代”
   - 而是围绕 [speech.md](/home/ubuntu/VoxFlame-Agent/speech.md) 这个高压验证样本，在 5 天内做出可真实支持长时重要表达的产品闭环
   - 对应专项文档已新增：
     [VOXFLAME_SPEECH_MODE_EXECUTION_PLAN_2026-04-05.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_SPEECH_MODE_EXECUTION_PLAN_2026-04-05.md)
   - 现在时间判断已修正为“5 天窗口”，而不是 3 天窗口

2. 外部参考的可迁移长处已经收口
   - `OpenClaw`: 记忆和上下文装配分离，记忆要自动压缩，不要把流水直接喂给模型
   - `VibeVoice`: 长音频要有全局上下文、结构化 transcript 和 hotwords，不只是滚动字幕
   - `Lime`: 高压工作台界面要中文优先、信息优先、低装饰、按页面职责控制宽度
   - `CLEAR-VOX-MODEL`: 个体差异优先，LLM 后处理与规律提取比一味堆样本更重要

3. 页面角色边界已经明确
   - 所有页面都应继续变得更直白、更简单
   - `记忆页` 是准备内容 owner
   - `沟通页` 只拉起当前场景所需的最小准备
   - 不把成功押在现场 agent 自由发挥上，而是靠“平时准备 + 现场稳辅助”

4. 这次演讲成功不能押在微调立刻变强上
   - 数据录入、标注准确、后续微调仍然重要
   - 但在 5 天尺度上，它们属于长期增益，不是短期关键路径
   - 短期应优先依赖：
     - LiveKit self-hosted realtime
     - DashScope / Qwen-first 的现役 ASR / rewrite / TTS
     - 现有 `workspace snapshot / profile_bundle / session_review / expression_kit`

5. 记忆系统不需要重做
   - 当前代码已经有足够好的 durable owner
   - 更好的做法是在现有 `workspace snapshot` 上长出 `prepared-expression / pattern-extraction` 派生体验
   - 也就是把 rehearsal、现场模式和复盘串起来，而不是重建 memory architecture
   - 记忆页本体应继续收成：
     - 用户全面画像
     - 常见场景
     - 即将面对场景的准备页
   - training result 只是输入源，不是页面本体

6. 一个新的执行判断已经固定
   - 在今天这种 vibe coding 时代，`5 天做出一套真正够用的记忆系统和产品收口` 并不算慢
   - 真正的难点不是编码速度，而是我们对：
     - 模型该做什么 / 不该做什么
     - agent 在现场该承担什么角色
     - 记忆究竟该记什么、怎么压缩、怎么调出来
     这 3 件事的判断是否足够准
   - 所以下一步优先级不是“继续铺更多功能面”，而是把规律提取、场景准备、现场最小辅助这三层收准

7. 旧执行面的辅助工具链也开始一起退役
   - `frontend/Dockerfile` 里的 `NEXT_PUBLIC_ENABLE_LIVEKIT_TRANSPORT` 旧 build arg/env 已删除
   - `frontend/README.md` 已不再把 `ten_agent/README.md` 当现役 agent 入口
   - `scripts/qwen_asr_live_smoke.sh` 和 `scripts/qwen_tts_live_smoke.sh` 现在默认直接打 `voxflame-livekit-agent`
   - 两条 smoke 都已在 `livekit-agent` 容器上实跑通过
   - 这意味着不只是运行时主链，连日常验证链也已经脱离 `ten-agent`

### 2026-04-03

1. LiveKit communication 主链已经可用
   - `localhost:3000` 已统一承接页面、API、LiveKit signaling
   - `executionBackend=livekit` 已真实进入 backend session path
   - communication 文字改写与 TTS 音频回放已通过真实 smoke
   - 沟通页现在也已显式固定 `executionBackend: 'livekit'`
   - 前端默认执行面也已从 `agora_ten` 收口到 `livekit`
   - `NEXT_PUBLIC_ENABLE_LIVEKIT_TRANSPORT` 旧 gate 已删除
   - `frontend` 的 Agora 依赖与 `agora-transport.ts` 已删除
   - backend 的 `rtc-orchestration` 已不再保留 TEN control 分支
   - compose 里的 `ten-agent` service 已删除，旧 orphan 容器也已清掉

2. 真实语音 smoke 的关键根因已查到并修复一刀
   - 用户 LiveKit 音频轨此前以 `source: UNKNOWN` 发布
   - worker 订阅的是 `SOURCE_MICROPHONE`
   - 已在 [frontend/src/lib/realtime-audio/session-audio.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-audio.ts) 显式改为：
     `publishTrack(..., { source: Track.Source.Microphone })`

3. correction parity 的最小 contract 已补上
   - [livekit_agent/data_contract.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/data_contract.py) 现支持 assistant transcript 携带：
     - `metadata.type = "correction"`
     - `metadata.original`
   - [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) 已在语音 transcript 路径回发这套 metadata
   - 前端现有 reducer 会直接按纠错样式消费，不需要另起页面逻辑

4. 当前真实 blocker 已前移
   - 第一版 `VAD / 自动收句` 已接进 [livekit_agent/asr_runtime.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/asr_runtime.py)
   - 当前要继续验证的是它在真实麦克风下是否能稳定产出 `ASR final transcript`
   - `voice_profile_updated` 的最小 signal 也已接进 LiveKit 路径
   - `speech_started -> interrupt current TTS` 的最小 turn-taking 也已接进 LiveKit 路径
   - LiveKit communication session 也开始进入现有 `memory / session review` 同步链
   - `training_feedback_request -> training_feedback + voice_profile_updated` 的最小 contract 也已接进 LiveKit 路径
   - `training_feedback` 也已开始写回当前 session metadata，并落成带 `kind=training / source=livekit_training_feedback` 的 `training_result memory`
   - 训练结果还会继续携带 `focus_syllables / articulation_tips / pronunciation_targets`
   - 训练 hook 也已显式固定 `executionBackend: 'livekit'`
   - 记忆架构保持不变，继续沿现有 `training_profile_summary / session_review` 链补 parity

### 2026-04-02

1. LiveKit 迁移状态已重新写实
   - 节点 1：开发基座已完成
   - 节点 2：功能等价迁移进行中
   - 节点 3：删除 `TEN + Agora` 尚未开始

2. 现役 provider 约束已固定
   - `DashScope / Qwen-first`
   - `livekit_agent` 当前不是 OpenAI stub，而是 DashScope communication loop

## 下一步优先级

1. 先做 `prepared expression` 资产层
   - 把 [speech.md](/home/ubuntu/VoxFlame-Agent/speech.md) 切成段落、关键句、风险词、保底句
   - 以现有 `workspace snapshot` 或其派生视图承接，不重做 memory owner

2. 再为训练页补 `pattern extraction + structured output`
   - 不再只给散的训练反馈
   - 要能稳定产出：
     - 发音特点
     - 高频误听规律
     - 热词
     - 最稳表达版本

3. 再做记忆页的“用户画像 + 当前重要表达准备”
   - 当前状态
   - 常见场景
   - 接下来要面对的场景
   - 最近亮点
   - 最危险的句子
   - 上台前最后只看哪几句

4. 再让沟通页只拉起“当前场景的最小准备”
   - 这次先记哪三句
   - 哪个词最容易错
   - 没听清时怎么补

5. 然后再做现场模式
   - 长时 transcript 的滚动显示
   - 当前段落锚点
   - 听错时的快速确认和保底句

6. 旧 TEN 参考实现已完成物理清退
   - `ten_agent/` 目录已从仓库删除
   - 当前剩余工作不再是删旧运行时，而是把训练页、记忆页 AI 功能补满
   - 下一步继续围绕现有 `LiveKit + workspace snapshot` 架构收口
   - `frontend / backend / livekit_agent` 代码层已不再残留 `Agora/agora_ten` 运行时引用；现在只剩少量历史研究文档仍会提到旧迁移过程
   - 记忆页顶部也已改成“我的表达画像 -> 当前重要表达准备 -> 最近复盘”，继续贴近长期记忆 owner
   - `docker-compose` 也已收口成：
     - 默认只起核心四服务：`livekit-server / backend / frontend / livekit-agent`
     - `qdrant / redis` 改为 `extras` profile，可选启用
     - `LIVEKIT_SERVER_IMAGE` 默认钉到 `docker.m.daocloud.io/livekit/livekit-server:v1.10.1`

## 当前验证基线

- `cd frontend && npm run build`
- `cd backend && npm run build`
- `cd livekit_agent && python3 -m unittest discover tests -v`
- `python3 -m py_compile livekit_agent/app.py livekit_agent/asr_runtime.py livekit_agent/data_contract.py`
- `bash scripts/check_ai_docs.sh`
- `bash scripts/qwen_asr_live_smoke.sh`
- `bash scripts/qwen_tts_live_smoke.sh`
- Docker 真实语音排查：
  - `sudo docker compose logs -f livekit-agent`
  - 看这几个日志点：
    - `LiveKit VAD speech_started`
    - `LiveKit VAD speech_stopped`
    - `LiveKit ASR audio buffer committed`
    - `LiveKit ASR final transcript`

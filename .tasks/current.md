# 当前任务状态

> 最后更新: 2026-04-17

## 当前主线

- 主任务：把当前产品主线收成 `沟通成功率 -> typed memory -> 句子级准备资产 -> 数据录入/标注 -> 四块记忆系统后台维护` 的稳态闭环，不再新增大功能。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的产品/工程重点：
  - 把 `session-local typed memory -> 四块记忆系统后台维护 -> workspace snapshot` 的 owner 与写回边界做扎实
  - 把 `prepared-expression / important-expression / 高频句` 的录入和复用入口统一起来
  - 把 dataset 收成最小 audio-target contract，只保留“录音和目标句是否对上”的稳定判断

## 最新收口

0. 2026-04-19 已把沟通页旧壳和“沟通材料训练化”表达继续收干净
   - [frontend/src/components/chat/CommunicationStarterKit.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationStarterKit.tsx) 已删除：
     - `更像你自己的第一句话`
     - `通用补救句`
   - [frontend/src/components/chat/ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已删除用户可见的：
     - `沟通复盘`
     - `recommendedFocus / sessionReview` 卡片
   - 当前沟通页主结构已重新压成：
     - 场景入口
     - starter kit 开口句
     - 自定义材料 / 场景模板选择
     - 当前会送进助手的上下文
   - 这轮也把沟通链里的 `training_pairs` 从默认装配里降掉了：
     - frontend `buildPreparationContextUpdate(...)` 不再回传 `training_pairs`
     - backend [rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts) 初始 preparation context 也已改成不带 `training_pairs`
   - 训练页表达也已收口：
     - `准备句数 -> 可练句数`
     - `准备内容与拆句训练 -> 准备内容与句子练习`
     - “保存后按拆句训练”改成“右侧直接列出可练句子”
   - 已验证：
     - `cd frontend && npm run build`
     - `cd backend && npm run build`

0. 2026-04-17 已把“模板库 + 后端训练总结维护”这两条 gap 真正收口
   - [frontend/src/app/memory/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/memory/page.tsx) 已不再让用户自由增删“自定义重点词”
   - 记忆页现在改成：
     - 开发者维护模板库
     - 用户只负责选择加载
     - 每套模板明确展示：
       - 适用场景 / 严重程度
       - 优先顺序
       - 重点热词
       - 容易听偏的词
       - 对方配合方式
       - 可直接开口的句子
   - backend 已新增：
     - `GET /api/memory/workspace/:userId/scene-templates`
     - `PUT /api/memory/workspace/:userId/scene-templates`
   - `workspace snapshot / communication loadout / preparation` 现在都会直接消费已选模板，而不是再依赖用户自由编辑 `hotword_profiles`
   - 训练总结也已不再靠训练页打开时的 stale refresh：
     - backend 已新增 [training-report-maintenance.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/training-report-maintenance.service.ts)
     - server 启动后会定时扫描 stale 的 `prepared_expression training_reports`
     - [frontend/src/app/contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 已删掉页面打开时的 `periodic_auto` 触发
   - 这轮还把沟通页 starter kit 从“几句短句”扩成了更厚的场景表达包：
     - [frontend/src/lib/communication/starter-kit.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/communication/starter-kit.ts)
     - [frontend/src/components/chat/CommunicationStarterKit.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationStarterKit.tsx)
   - 模板内容主要参考：
     - ASHA dysarthria / AAC / communication tips
     - Patient Provider Communication 医疗计划工具与沟通板
     - Tobii Dynavox emergency communication resources
   - 已验证：
     - `cd frontend && npm run build`
     - `cd backend && npm run build`

0. 2026-04-17 已继续收记忆页的产品表达，减少误导
  - [frontend/src/app/memory/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/memory/page.tsx) 已去掉“上半总览一遍、下半再编辑一遍”的重复区
  - `沟通偏好` UI 已并回 `用户画像` 语义，不再像第五块记忆
  - 记忆页四块内容现在也已改成：
    - 标题摘要先展示
    - 选中后再展开编辑 / 查看详情
    默认不再把全文编辑器、训练总结和整套模板明细全部摊开
  - 场景模板已改成收纳式卡片，默认不再把整套内容全部摊开
  - 当前代码真相也进一步明确：
    - `用户画像` 仍由 backend memory maintenance 模型在沟通 session 结束后小幅更新
    - `自定义材料` 当前仍是“单篇当前文档”，还没升级成真正多文档列表
  - 已验证：
    - `cd frontend && npm run build`

0. 2026-04-17 已把沟通页“推荐短句”并回“第一句话”入口
  - 这一步已在 2026-04-19 继续收口，当前不再保留“推荐短句”这个单独产品概念
  - starter kit 只保留场景内的开口句和沟通表达包
  - 这样沟通页主入口更明确：
    - 选场景
    - 选第一句话
    - 再看本次资料
  - 已验证：
    - `cd frontend && npm run build`

0. 2026-04-17 已把 `livekit-agent` Docker 慢构建问题继续制度化收口
   - 根因已明确：
     - 红色 `importing cache manifest` 不是主因，只是 `cache_from` 在本地镜像缺失时的噪音
     - 真正拖慢的是没有复用到依赖层后，Docker build 会重新在线 `pip install livekit-agents`
   - 当前已新增：
     - [livekit_agent/Dockerfile.localvenv](/home/ubuntu/VoxFlame-Agent/livekit_agent/Dockerfile.localvenv)
   - [scripts/docker-rebuild-core-fast.sh](/home/ubuntu/VoxFlame-Agent/scripts/docker-rebuild-core-fast.sh) 现在会优先：
     - 检查本地 `livekit_agent/.venv`
     - 若 `.venv` 已装好 `livekit-agents / websockets / dotenv`
     - 直接切到 `Dockerfile.localvenv`
     - 用本机现成依赖层打镜像，不再走慢速在线装依赖
   - `docker-compose.yml` 也已支持：
     - `LIVEKIT_AGENT_DOCKERFILE`
     - `LIVEKIT_AGENT_PIP_INDEX_URL`
     - `LIVEKIT_AGENT_PIP_EXTRA_INDEX_URL`
   - 同时已去掉会误导判断的 `cache_from` 噪音
   - 当前宿主机推荐验证路径：
     - `bash scripts/docker-rebuild-core-fast.sh`

0. 2026-04-17 已按新的 owner 口径继续收紧训练页与文档
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 已明确收成：
     - 自定义材料 = 用户手动维护
     - 训练总结 = 训练总结模型定期覆盖更新
     - 用户画像 = 后台维护链小幅更新
     - 场景 / 热词模板 = 开发者维护模板库，用户选择加载
   - [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) 也已同步去掉：
     - 会后 compact 长期对象
     - 模板被后台自动改写
     这些容易误导的口径
   - [frontend/src/app/contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 已把训练页顶部改成：
     - 每日目标 / 今日计划置顶
     - 今日总结 / 最近 7 天总结前置可见
     - `设备状态` 已从训练页移除
     - `准备内容` 与 `拆句训练` 已合并成同一个训练工作区
     - 顶部说明文案明显缩短
   - 已验证：
     - `cd frontend && npm run build`
     - `bash scripts/check_ai_docs.sh`

0. 2026-04-17 已把沟通页从“mode-first”往“scene-first / 开口句优先”继续收了一层
   - [frontend/src/components/chat/ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 现在不再把：
     - `紧急沟通 / 长时间沟通`
     当成用户首先要理解的产品主标题
   - 当前收口成：
     - 先看场景
     - 先点第一句话
     - 再看本次资料
     - `快速开口 / 材料展开` 只在“需要时再手动微调装配策略”里出现
   - 这一步的产品判断已明确：
     - `mode` 是后台装配策略
     - `scene + first sentence + selected materials` 才是用户真正感知到的功能
   - 已验证：
     - `cd frontend && npm run build`

0. 2026-04-17 已把沟通页 / 记忆页里误暴露给用户的工程词和只读对象卡继续收口
   - [frontend/src/components/chat/ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已去掉用户可见层里的：
     - `默认常驻`
     - `workspace`
     这些工程词
   - 当前沟通页 loadout 改成只告诉用户：
     - 这类资料有什么用
     - 是否会自动带上
     - 去哪里编辑
   - [frontend/src/app/memory/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/memory/page.tsx) 已补：
     - 用户画像编辑入口
     - 自定义材料打开编辑入口
     - 自定义重点词编辑入口
     - 训练总结查看入口
   - 自定义材料已补成真正的前端删除能力：
     - frontend `deletePreparedExpressionAsset(...)`
     - backend `DELETE /api/memory/workspace/:userId/prepared-expression`
   - 已验证：
     - `cd backend && npm run build`
     - `cd frontend && npm run build`

0. 2026-04-17 已把沟通页上下文装配继续收紧到“4 类 durable memory + session memory”的固定边界
   - [frontend/src/components/chat/ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 现在不再把：
     - `训练总结`
     - `场景 / 热词模板`
     弱化成“只有前端卡片标题”
   - 当前固定口径改成：
   - `用户画像 / 场景热词模板 / 训练总结` 默认直接以结构化字段进入 agent 上下文
   - `自定义材料` 仍按用户是否加载来决定是否带全文
   - runtime 真正送进 agent 的核心字段已明确包含：
     - `hotwords`
     - `risky_terms`
     - `support_strategies`
     - `document_content`
   - backend 初始 session preparation contract 也已同步接入：
     - `backend/src/services/rtc-orchestration.service.ts`
     - `backend/src/services/livekit-session.service.ts`
   - `livekit_agent` prompt 与 typed `PreparationContextPack` 已同步扩成可消费：
     - `hotwords`
     - `risky_terms`
   - 已验证：
     - `python3 -m unittest livekit_agent.tests.test_session_userdata -v`
     - `python3 -m unittest livekit_agent.tests.test_data_contract -v`
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `cd backend && npm run build`
     - `cd frontend && npm run build`

0. 2026-04-17 已把 `livekit-agent` 的快重建路径进一步制度化到 compose
   - [docker-compose.yml](/home/ubuntu/VoxFlame-Agent/docker-compose.yml) 现在已显式加上：
     - `image: voxflame-agent-livekit-agent:latest`
     - `cache_from: voxflame-agent-livekit-agent:latest`
   - 仓库也已新增宿主机可直接执行的快重建脚本：
     - [docker-rebuild-core-fast.sh](/home/ubuntu/VoxFlame-Agent/scripts/docker-rebuild-core-fast.sh)
   - 这条脚本会：
     - 先检查本地是否已有 `voxflame-agent-livekit-agent:latest`
     - 有的话自动切到 `LIVEKIT_AGENT_BOOTSTRAP_DEPS=0`
     - 并把上一版 `livekit-agent` 镜像作为新的 base image，只覆盖最新代码
     - 没有的话才回退到全量依赖安装
   - 这意味着“在上一个本地稳定镜像基础上只覆盖新代码”这条路径不再只是会话记忆
   - 但这轮当前执行环境里：
     - `sudo` 被 `no new privileges` 禁掉
     - 普通 `docker compose` 也没有 `/var/run/docker.sock` 权限
   - 所以这轮没法在当前沙箱里真实完成 Docker 重建；需要回到宿主机继续执行：
     - `bash scripts/docker-rebuild-core-fast.sh`

0. 2026-04-16 已清掉旧的 `session-close compaction` 长期写回链
   - 前端 `memory-service` 不再生成 `session_compaction` memory payload
   - backend `/api/memory/session-close` 不再新增 `session_compaction` 记录
   - 当前会话结束后只会尝试更新 `用户个人画像`
   - 更新字段也已收窄成最小集合：
     - `summary`
     - `common_scenarios`
     - `risky_terms`
     - `support_strategies`
   - `workspace snapshot` 也已开始直接消费这层 `user_profile_memory`
   - 沟通 loadout 的第四栏已改回 `训练总结`，不再展示 `recent_compaction`
   - `training_summaries` 对象区也不再混入“最近一次会话复盘”
   - `memory-growth` 已停止把 `session_compaction` 当成新的画像来源
   - 已验证：
     - `cd backend && npm run build`
     - `cd frontend && npm run build`
     - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/memory/memory-service.test.ts`

0. 2026-04-16 已把 PRD 继续压成真正可执行的短版主文档
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 现在只保留：
     - 产品是什么
     - 当前固定边界是什么
     - 接下来只做什么
   - 已删除大段“已经做掉的代码现状报告”和重复执行细节
   - 当前 PRD 固定主轴：
     - `沟通 loadout`
     - `训练总结`
     - `durable workspace`

0. 2026-04-16 已按产品收敛重新压 PRD 里的训练页方向
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 已明确删掉“训练页重型沟通助手”主线
   - 当前训练页只保留真正和上线相关的核心能力：
     - 录音舒适度
     - 每日目标
     - 每日总结 / 7 天总结
     - 训练计划
     - 训练总结回写
   - 当前不再把以下内容当作上线前主任务：
     - 训练页 TTS 对话助手
     - 主动提醒式陪练人格
     - 重型 coach 体验
   - 新增一条固定产品边界：
     - 训练计划与总结都由同一个训练 room / 同一个模型顺手产出
     - 重点放在前端 UI 自动化和简洁化，而不是再拆新的助手角色
   - 新增固定边界：
     - 训练页和沟通页的个性化准备资料分区管理
     - 训练侧建议不自动共享到沟通侧
     - 只有用户显式确认后，训练建议才可复制成沟通材料
   - dataset 方向也已同步收窄：
     - 不再继续做 review queue / export 审批流
     - 只保留训练录音、目标句、识别句和最小对句判断

0. 2026-04-16 已把训练总结链按新口径重写成 `daily_summary / weekly_summary / training_plan`
   - backend `prepared-expression summary` 不再继续沿用：
     - `50 句纠错总结`
     - `rehearsal_summary`
     - `correction_hints`
     这些旧壳语义
   - 当前正式收成：
     - `training_reports.daily_summary`
     - `training_reports.weekly_summary`
     - `training_reports.training_plan`
   - 模型输入也已收窄：
     - 主要只看 `target_text / recognized_text` 差异
     - 不再让训练总结链顺手改写 prepared document / section summary
   - 前端训练页与记忆页也已同步改成：
     - 今日总结
     - 最近 7 天总结
     - 下一轮计划
   - 旧的“累计 50 句后自动更新纠错总结”文案和逻辑已删
   - 已验证：
     - `cd frontend && npm run build`
     - `cd backend && npm run build`
     - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/training/prepared-expression-practice.test.ts`
     - `bash scripts/check_ai_docs.sh`

0. 2026-04-16 已继续完成“句子级准备资产 owner”收口
   - backend / frontend snapshot 已把 `expression_kit.personalized_phrases` 改成 `recommended_phrases`
   - 当前边界已明确：
     - `prepared_expression` = 用户材料 owner
     - `hotword_profiles` = 场景 / 热词模板 owner
     - `quick_phrases` = 开口短句 owner
     - `expression_kit.recommended_phrases` = 派生推荐，不是 owner
   - 沟通页对应文案也已改成“推荐短句”，避免继续暗示这是新的记忆 owner
   - `PRD / memory-tooling reference / founder collaboration loop` 已同步去除这块旧待办和旧架构口径
   - 已验证：
     - `cd backend && npm run build`
     - `cd frontend && npm run build`
     - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/training/prepared-expression-practice.test.ts`
     - `bash scripts/check_ai_docs.sh`
     - `sudo docker compose build backend frontend`
     - `sudo docker compose up -d --force-recreate backend frontend`
     - Playwright smoke:
       - `/chat`
       - `/contribute`
       - `/memory`

0. 下一步主任务进一步收窄
   - 句子级 owner 命名歧义、模板库选择态、训练总结 backend 定时，这三条都已经不再是 blocker
   - 当前真正剩下的上线前主任务，只保留：
     - `livekit_agent` typed session memory 在真实 Docker 环境里的效果验证
     - server-side `assemble_context -> after_turn -> memory maintenance update` 的真实沟通准确率验证
     - 训练页“舒服录音 + 明确目标 + 稳定总结” 的真实体验打磨
     - dataset 最小 `audio + target` 闭环
     - 训练总结从“前端打开页时顺手刷新”收口成真正稳定的后台定期更新

0. 2026-04-16 已开始把 `livekit_agent` 的 typed session memory 落成正式结构
   - `session_userdata.py` 已新增：
     - `SessionTurnRecord`
     - `SessionWorkingMemory`
   - 当前 session-local working memory 已开始正式承接：
     - 当前轮状态
     - 当前 user / assistant 文本
     - 最近 turn 记录
     - `turn_count`
     - `context_revision`
     - `last_preparation_source`
     - `interruption_count / barge_in_count`
   - `assistant_runtime` 现在在回复完成后会写入 recent turns
   - `session_userdata_ack` 也开始回发 `session_memory` 摘要
   - 这一步的意义是：
     - 后续 `after_turn`
     - `session-close user profile update`
     - runtime debug / observability
     都终于有了明确 owner，而不是继续靠零散字段长
   - 已验证：
     - `python3 -m unittest livekit_agent.tests.test_session_userdata -v`
     - `python3 -m unittest livekit_agent.tests.test_data_contract -v`
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`

0. 这之后的下一刀已经更明确
   - 不是再扩新的前端功能名词
   - 而是继续把 `session_memory -> after_turn -> 4块记忆后台更新` 接成一条真正的 server-side contract

0. 2026-04-16 已把 `compact candidate` 正式接进 `session_userdata_ack`
   - `livekit_agent` 当前不再只回 `session_memory`
   - 还会同时回一份很窄的 `compaction_candidate`
   - 当前 candidate 只保留：
     - 最近确认过的更稳表达
     - 最近风险原句
     - 支撑策略
     - 最近用户意图 / 最近确认表达
     - `loadout_mode / turn_count / interruption_count / barge_in_count`
   - 前端 runtime 已开始把这层 server-side candidate 写进当前 session metadata
   - 这一步的意义是：
     - 会话结束时更新用户画像
       不必继续完全依赖前端自己从零猜一份长期写回内容
   - 已验证：
     - `python3 -m unittest livekit_agent.tests.test_session_userdata -v`
     - `python3 -m unittest livekit_agent.tests.test_data_contract -v`
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/realtime-audio/session-runtime.test.ts`
     - `cd frontend && npm run build`
     - `cd backend && npm run build`

0. 2026-04-16 已把“上线前最重要的 3 条 contract”正式写清并接入代码
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 已改成上线收口版，只保留：
     - agent 上下文到底包含什么
     - 三个模型怎么分层
     - 哪些东西允许进入长期记忆
   - 当前固定结论：
     - 用户在沟通页手动 / 默认选中的 loadout 材料，会自动进入 agent 当前轮上下文
     - durable memory 不能直接整库塞进 prompt，只能先经过 `workspace snapshot -> communication loadout -> selected preparation context`
    - correction / memory maintenance / training summary 现在正式是 3 个不同模型层
   - 代码也已同步：
    - `DASHSCOPE_CORRECTION_MODEL` 已成为沟通页实时 correction 的独立 owner
    - 训练页总结继续由 `DASHSCOPE_TRAINING_REPORT_MODEL` owner
    - 当前过渡实现里的 runtime signal 会优先使用 agent 回来的 `serverCompaction*` 字段，而不是继续混合本地旧字段
    - 当前仍未完成但已经明确 owner 的下一刀：
     - `DASHSCOPE_MEMORY_MAINTENANCE_MODEL`
       驱动的真正后端四块记忆后台更新
   - 已验证：
     - `python3 -m unittest discover livekit_agent/tests -v`
     - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/memory/memory-service.test.ts`
     - `cd frontend && npm run build`
     - `cd backend && npm run build`
     - `bash scripts/check_ai_docs.sh`

0. 2026-04-16 已把训练总结模型配置收窄到单一 owner
   - backend 训练总结链现在只认：
     - `DASHSCOPE_TRAINING_REPORT_MODEL`
     - 无值时兜底 `qwen3.5-plus`
   - 旧的 `DASHSCOPE_PREPARED_EXPRESSION_SUMMARY_MODEL` 已从 compose / `.env.example` 移除，避免继续误导
   - prompt 里残留的 `correction hints` 词也已删掉
   - 当前结论固定：
     - 手动刷新和 `periodic_auto` 都走同一个训练总结模型
     - `periodic_auto` 目前仍是前端过期检查后触发，不是独立后端 cron
   - 已验证：
     - `cd backend && npm run build`
     - `bash scripts/check_ai_docs.sh`

0. 2026-04-16 `livekit-agent` 已完成一条不降级的快重建路径
   - 直接全量 `docker compose build livekit-agent` 仍会因为外网 Python 依赖极慢而卡住
   - 当前已确认可用的稳定重建路径是：
     - 先复用当前稳定依赖层作为本地 base image
     - 再用 `LIVEKIT_AGENT_BOOTSTRAP_DEPS=0` 只覆盖最新代码
   - 当前实际已产出并启用新镜像：
     - `voxflame-agent-livekit-agent:latest`
     - image id: `86834b88b9e5`
   - 这条路径满足：
     - 包含最新代码
     - 不降级当前运行依赖
     - 后续仍可继续做全量 clean rebuild

0. 2026-04-16 已把“最后两个目标”继续往上线态推进一刀
   - backend 已新增：
     - [memory-maintenance.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/memory-maintenance.service.ts)
   - `/api/memory/session-close` 现在会先走：
     - `existing user_profile_memory`
     - `session metadata / runtime signal`
     - `proposed profile_update`
     - `DASHSCOPE_MEMORY_MAINTENANCE_MODEL`
     再落库
   - 如果 DashScope 不可用，也会回退到启发式维护，不会让会话结束写回直接失败
   - 训练页已在代码里补上：
     - `SessionReadinessPanel`
     - `当前目标` 卡
     - `重录这一句`
     - `这句判断`
   - 已验证：
     - `cd backend && npm run build`
     - `cd frontend && npm run build`
     - `cd backend && npx ts-node src/services/memory-maintenance.service.test.ts`
     - `sudo docker compose build backend frontend`
     - `sudo docker compose up -d --force-recreate backend frontend`
   - 当前新的 blocker 已经不是“还没写代码”，而是：
     - Docker 前端现在实际吐出的 `/contribute` bundle 仍表现为旧页面
     - 需要继续只在完整 Docker 环境里确认最新前端 bundle 真正生效
     - 然后再做训练页 / 沟通页真实效果测试

0. 2026-04-14 已开始按 PRD 落第一刀代码：`workspace document model + memory page object zones`
   - backend `workspace snapshot` 已新增 `object_zones`
   - 当前先把现有数据正式收成 4 个对象区：
     - `自定义材料区`
     - `场景 / 热词模板`
     - `用户个人画像`
     - `训练总结`
   - 记忆页顶部已改成对象区视图，但底下仍继续复用现有准备稿 / 热词 / 训练总结编辑与展示能力
   - 这一刀的目标不是一次性做完新对象存储，而是先把后续 `loadout / context assembly / compaction` 需要依赖的前端与 snapshot 骨架立起来
   - 已验证：
     - `cd frontend && npm run build`
     - `cd backend && npm run build`

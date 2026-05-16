# 当前任务状态

> 最后更新: 2026-05-15

## 当前主线

- 主任务：在不破坏 Web/PWA 现役主链的前提下，开始 `App / Mobile Workbench` Phase 0 调研与 RFC；移动端目标从薄 companion 升级为完整移动端工作台。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的产品/工程重点：
  - Mobile workbench 必须复用 `workspace snapshot / recording envelope / upload receipt / RTC session orchestration`
  - 战略主线推荐 `Expo / React Native + LiveKit React Native`，从 day one 规划 `沟通 / 练习 / 记忆与准备 / 设备与同步` 四个一级 surface
  - `Capacitor` 只保留为 WebView 原型或过渡方案，不再作为完整移动端工作台主线
  - Phase 0 代码已开始落在 `apps/mobile-workbench`，移动端 surface id 统一为 `mobile_workbench`
  - 把 `session-local typed memory -> 四块记忆系统后台维护 -> workspace snapshot` 的 owner 与写回边界做扎实
  - 把 `prepared-expression / important-expression / 高频句` 的录入和复用入口统一起来
  - 把 dataset 收成最小 audio-target contract，只保留“录音和目标句是否对上”的稳定判断

## 最新收口

0. 2026-05-15 已新增 Voiceitt 功能设置深度分析文档
   - 新增 [Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）](/home/ubuntu/VoxFlame-Agent/docs/VOICEITT_FEATURE_SETTINGS_ANALYSIS_AND_VOXFLAME_INSPIRATION_2026-05-15.md)
   - 文档拆解 Voiceitt 的 `Record / Speak / Dictate / Integrations` 四个功能层，以及 voice output、silence timeout、playback speed、preferred microphone、record validation、profanity、flip text、highlight words、streaming、shortcut phrases、personal vocabulary、voice commands、notes/history、account deletion 等设置项
   - 核心判断：Voiceitt 本质是 personalized speech access layer，不是单个 ASR 页面；VoxFlame 应吸收“设置影响真实链路、三种输出面分开、个人语音 profile 是中心资产、shortcut phrases 和 listener-facing UI 高价值”的原则
   - 已明确不应照搬：模式命名、过早做 Chrome/会议插件、把 voice commands 当默认交互、把训练 level 做成纯数量 gamification
   - 推荐路线：P1 做停顿时间设置、给对方看模式、confirmed text buffer、prepared expression 发声；P2 做 personal vocabulary / shortcut phrases / risky terms；P3 再考虑外部平台 integrations
   - 已同步 [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)

0. 2026-05-15 已新增构音障碍不同病因差异参考文档
   - 新增 [构音障碍病因差异参考（2026-05-15）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_DYSARTHRIA_ETIOLOGY_DIFFERENCE_REFERENCE_2026-05-15.md)
   - 文档覆盖 Voiceitt diagnosis 列表里的 CP、TBI、Down Syndrome、Stroke / nerve injury、MS、ALS / MND、ASD、Parkinson、Deafness / severe hearing loss
   - 核心判断：`diagnosis label` 不能直接决定训练策略，必须拆到可观察的 dysarthria / apraxia / aphasia / auditory feedback / prosody / progression / fatigue profile
   - 已把不同病因的本质差异、VoxFlame 产品启发、profile schema 建议和参考资料整理成正式文档
   - 已同步 [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)

0. 2026-05-15 已新增分病因言语康复与沟通产品化深度文档
   - 新增 [分病因言语康复与沟通产品化深度文档（2026-05-15）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md)
   - 以 ReTalk / 复言的中风康复产品化样板为参照，拆出 `专家评估 -> 软件高频训练 -> AI 分析 -> 专家复核 -> 专家知识自动化` 的工作流，而不是照搬单一中风训练菜单
   - 文档逐个覆盖中风 / 神经损伤、脑外伤、脑瘫、唐氏综合征、多发性硬化、肌萎缩侧索硬化 / 运动神经元病、帕金森病、孤独症谱系障碍、听力损失
   - 每个病因都给出核心机制、成熟疗法 / 医院常用训练原则、VoxFlame 沟通功能、康复练习功能、AI 接轨方式和专家边界
   - 核心判断：任务库不应按病名硬编码，而应按 `听理解 / 命名 / 构音 / 言语动作计划 / 音量 / 韵律 / 叙事 / 辅助沟通` 等机制和目标组织；病名只做适用画像和风险约束
   - 已同步 [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)

0. 2026-05-15 已把 Voiceitt 前两个设置方向收成可用音频设置链路，而不是继续堆空开关
   - 新增 Web 音频设置页 [frontend/src/app/settings/audio/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/settings/audio/page.tsx)
   - 用户头像菜单里的“设置”已改为“音频设置”，直接进入 `/settings/audio`
   - 设置页只承接一个真正会影响主链路的能力：授权麦克风、列出输入设备、保存首选麦克风、现场测试收音电平
   - Web 沟通页和训练页共用 [microphone-preferences](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/audio/microphone-preferences.ts)，LiveKit 发布麦克风时会优先使用已保存设备
   - Web 训练录音 envelope 已新增 `inputDevice` 与 `quality` 字段，记录实际设备、用户选择、RMS/peak、静音比例、speech duration、低置信/复核/高置信分级
   - 上传 metadata 已同步写入 `microphone_* / selected_microphone_* / speech_duration_ms / silence_ratio / input_level_* / audio_quality_*`
   - `assessTrainingSampleQuality` 已把 `low_confidence / review` 收音质量纳入样本分级：低质量样本保留为 attempt / 回看，不当作高置信样本
   - Mobile Workbench 练习队列已新增最小质量分级：先基于录音时长标记 `high_confidence / review / low_confidence`，并写入本地 queue 与上传 metadata；设备 surface 的“检查麦克风”现在会触发真实权限检查
   - 已验证：
   - `cd frontend && npm test -- src/lib/audio/microphone-input-feedback.test.ts src/lib/realtime-audio/session-audio.test.ts`
   - `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`
   - `cd apps/mobile-workbench && npm run check`
   - `cd apps/mobile-workbench && npm run typecheck`
   - 尚未完成：浏览器真实设备手动 smoke、Android / iPhone 真机录音 smoke、移动端真实音量 RMS/静音比例采集

0. 2026-05-12 已把训练语料库改成“来源文本抽取”，删除自生成模板路线
   - 已删除 `scripts/corpus/build_controlled_mandarin_training_corpus.py`，不再用模板批量造句
   - 新增 [source-based frontend exporter](/home/ubuntu/VoxFlame-Agent/scripts/corpus/export_frontend_source_corpus.py)，只从抓取/本地 manifest 里的真实文本切分、过滤、去重、导出
   - 新增 [普通话朗读来源清单](/home/ubuntu/VoxFlame-Agent/scripts/corpus/source_inventory_putonghua_reading_2026.json) 与 [开源中文例句来源清单](/home/ubuntu/VoxFlame-Agent/scripts/corpus/source_inventory_open_example_sentences_2026.json)
   - 已抓取普通话水平测试朗读作品 60 篇页面、Tatoeba 派生中文例句 TSV、公版经典音韵材料，并重新生成 [mandarin-training-real.json](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/generated/mandarin-training-real.json)：`1378` 条 source-extracted prompts，全部符合 `6-16` 个汉字策略
   - 前端训练语料入口继续使用 `curated + source-extracted` 合并去重，并保留 `评估筛查` 独立 20 词；当前前端总量 `1801` 条，其中非筛查训练句 `1781` 条
   - 本地 AISHELL-1 / AISHELL-2 / 其他 transcript 后续应通过 manifest 接入，不把大数据集提交进仓库
   - 训练评估开发文档已补充：前台 supervised recording 默认目标句 `6-16` 字，推荐录音窗口 `2-8s`，硬上限先按 `12s`；`1-5` 字保留给音系筛查和单词复练，不作为主功能句池主体
   - 已审计现有录音质检：Web 当前有 `target_text -> recording envelope -> upload receipt / manifest`、过短录音检查、ASR 覆盖率、transcript latency 和麦克风输入电平提示；尚未有 VAD、首尾静音裁剪、静音占比或录音过长判定
   - 下一步应给 recording envelope 增加 `speech_duration_ms / leading_silence_ms / trailing_silence_ms / silence_ratio / input_level_rms / input_level_peak`
   - 已验证：
   - `python3 scripts/corpus/export_frontend_source_corpus.py --phonology-corpus /tmp/voxflame-phonology-corpus-20260512.json --manifest /tmp/voxflame-putonghua-reading-fetch-20260512/_local_manifest.json --manifest /tmp/voxflame-open-example-sentences-fetch-20260512/_local_manifest.json --output frontend/src/lib/corpus/generated/mandarin-training-real.json --per-source-cap 3000 --cap 日常与出行=360 --cap 看病与求助=80 --cap 人群与角色=140 --cap 设备与数字=120 --cap 发音与朗读=760`
   - `cd frontend && npm test -- src/lib/corpus/mandarin-training-data/index.test.ts`
   - `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`
   - `bash scripts/check_ai_docs.sh`
   - 注意：裸 `cd frontend && npx tsc --noEmit` 会被仓库现有测试文件的 `.ts` 扩展导入挡住，需要带 `--allowImportingTsExtensions`

0. 2026-05-10 已新增 VoxFlame 专家标准与用户反馈闭环计划
   - 新增 [专家标准与协作手册（2026-05-10）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_EXPERT_STANDARD_AND_COLLABORATION_PLAYBOOK_2026-05-10.md)
   - 当前总判断：VoxFlame 后续 App / Web / 硬件 / 训练评估 / 记忆系统不能只按“技术能跑”推进，必须同时满足 `专家标准 / 技术验证 / 用户反馈` 三角闭环
   - 已明确当前最大缺口：技术闭环和数据上传链路已有雏形，但用户反馈尚未形成可追踪、可复盘、可反哺开发的闭环
   - 已沉淀 `VoxFlame Expert Standard v0.1`：覆盖证据等级 L0-L5、用户反馈等级 F0-F4、prompt registry、沟通技巧 registry、训练语料、memory schema、专家协作、材料下载与准入门槛
   - 已写清哪些内容必须专家审核：临床 / 康复 / 构音障碍评估口径、训练语料、评测维度、长期记忆解释、对外医学表达和硬件安全 / 人因设计
   - 已把用户反馈闭环拆成可落地交付物：`feedback_registry`、创始人自我观察模板、目标用户访谈模板、沟通伙伴反馈模板、每周反馈 triage、ship decision log
   - 已更新 [App / Mobile Workbench 机会文档](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)，加入“标准 / 技术 / 用户反馈闭环”章节，并明确每个 surface 的最小反馈信号
   - 已更新 [README](/home/ubuntu/VoxFlame-Agent/README.md) 与 [docs/README](/home/ubuntu/VoxFlame-Agent/docs/README.md)，把专家标准文档设为当前继续开发的主入口之一

0. 2026-05-10 已把硬件桥接路线改成“发声 + 记录”双主线
   - 更新 [硬件桥接开发手册（2026-05-05）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md)
   - 当前硬件定义：第一版围绕 `发声` 和 `记录`，不是只做 BLE 控制桥，也不是直接做完整独立 AI 语音终端
   - 已补充现有硬件形态调查：大屏 SGD / AAC 设备、简单录放音 AAC / 可穿戴消息器、随身语音扩音器
   - 已沉淀 `VoxFlame Communication Audio Bridge Standard v0.1`：覆盖形态、重量、麦克风、扬声器、按钮、状态、离线、上传、电池和隐私的 P0/P1/P2 指标
   - 已补充音频标准、人因标准、安全 / 合规 / 认证路线、P0 benchmark 测试清单和参考资料入口
   - 发声分三层：ESP32-S3 本地状态提示音、预置短句 / 最近录音回放、App / Web / desktop companion 承接实时 TTS / 翻译器输出
   - 记录分三类：ESP32-S3 I2S 训练样本记录、App / LiveKit 侧沟通现场记录、设备质量 telemetry
   - 技术判断：ESP32-S3 可做短音频录制、本地 WAV 播放、按钮和状态灯；不适合第一版扛 LiveKit、ASR、LLM、TTS 或当普通蓝牙 A2DP 音箱
   - 采购路线升级为 `I2S MEMS 麦克风 + MAX98357A + 小喇叭 + USB-C 领夹麦 + 便携蓝牙音箱`，先用现成音频外设验证收音和外放，再做自研音频桥
   - 阶段路线新增 H2.5：ESP32-S3 本地发声原型，验收本地提示音、预置短句、最近录音回放和 App BLE command 中断
   - 已验证：`bash scripts/check_ai_docs.sh`

0. 2026-05-08 已新增第一功能训练评估开发文档
   - 新增 [第一功能：训练评估开发文档（2026-05-08）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_TRAINING_ASSESSMENT_FUNCTION_DEVELOPMENT_2026-05-08.md)
   - 结论：当前 20 词筛查有低压力 onboarding 和粗筛价值，但不能代表经典中文构音评估语料，也不能替代 Frenchay 汉语版或中国康复研究中心构音障碍检查
   - 第一功能产品定义收口为 `训练表现分 / 系统听懂分 / 趋势报告`，不是独立医疗评估系统，也不把医生减负作为第一阶段核心卖点
   - 文档已从资料汇总重写成开发判尺：North Star 是“训练后，用户在真实沟通中被正确理解的概率提高”，不是平均分更高
   - 已定义 100 分开发者评分标准与一票否决项，覆盖语料、评分、反馈、趋势、沟通反哺、安全边界和工程验证
   - 已补充分阶段开发目标：Stage 0 边界修正、Stage 1 普通话音系核心语料、Stage 2 可复现评分、Stage 3 反馈质量、Stage 4 反哺沟通翻译器、Stage 5 声学趋势、Stage 6 治疗师参考报告
   - 文档明确模型职责：`qwen-flash` 可用于 ASR、实时沟通、轻量反馈和结构化指标解释；不能直接做临床分型、呼吸/发声/共鸣/韵律评分或疗效判定
   - 后续路线：P0 命名和边界修正 -> P1 普通话音系核心词表 -> P2 同句趋势分 -> P3 声学特征 -> P4 治疗师参考报告
   - 已同步入口：[docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)

0. 2026-05-08 已补齐 Mobile Workbench Android EAS 内测安装入口
   - 新增 [apps/mobile-workbench/eas.json](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/eas.json)，包含 `development` 和 `preview` Android APK profile
   - `apps/mobile-workbench` 新增 `expo-dev-client` 依赖，并新增脚本：
   - `npm run build:android:development`
   - `npm run build:android:preview`
   - [.env.example](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/.env.example) 已改成提醒 Android 真机必须使用电脑局域网 IP，不能用 `127.0.0.1`
   - [apps/mobile-workbench/README.md](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/README.md)、[Mobile Workbench 真机验证手册](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)、[Phase 0 RFC](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md) 已补充 Android EAS 安装说明
   - 当前说明：EAS build 页面会提供 Install 链接或二维码；Android 手机通常用系统相机扫码，再在浏览器下载 APK 并允许浏览器安装未知应用
   - EAS 云端构建不会自动读取本地 `.env`，需要通过 `eas env:create` 或 Expo dashboard 配置 `EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY`，且不能放服务端 secret
   - 已验证：
   - `cd apps/mobile-workbench && npm install --ignore-scripts --no-audit --prefer-offline`
   - `cd apps/mobile-workbench && npm run check`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `bash scripts/check_ai_docs.sh`
   - 尚未执行真实 EAS cloud build；下一步需要用户登录 Expo/EAS 后运行 Android build 命令并用真机安装 smoke
   - 后续又补了国内 Android 商店 profile：`npm run build:android:china-store`，用于生成 release APK，区别于 development / preview 内测包
   - 文档已写清：小米等国内 Android 商店上传 APK；华为应用市场 Android 分发可用当前 React Native Android APK；HarmonyOS NEXT 原生鸿蒙应用不是当前 APK 直接覆盖的目标，需要后续单独原生鸿蒙版本或跨端支持确认

0. 2026-05-05 已补齐 Mobile Workbench 真机验证梯度与环境预检
   - 新增 [Mobile Workbench 真机验证手册（2026-05-05）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)
   - 当前结论：App 早期验证不需要先上架 App Store / Google Play；现在应先做真机 development build 和业务 smoke
   - 验证梯度已明确为：代码级检查 -> 真机 development build -> 登录 / workspace read / 录音 / 回放 / 上传 receipt / LiveKit quick talk smoke -> 小范围内测分发 -> 正式商店上架
   - 新增 [smoke-device-env.mjs](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/scripts/smoke-device-env.mjs)，用于检查 mobile public env、提醒真机不能直接访问电脑 `127.0.0.1`，并防止 service role / LiveKit secret / DashScope key 一类服务端 secret 进入 App 环境
   - `apps/mobile-workbench` 新增 `npm run smoke:device-env`
   - 文档已同步：[apps/mobile-workbench/README.md](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/README.md)、[Mobile Workbench Phase 0 RFC](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)、[docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm run check`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `cd apps/mobile-workbench && EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3001/api EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-placeholder npm run smoke:device-env`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-device-verification-export-20260505`
   - 真实真机 smoke 尚未完成；下一步需要拿 Android 手机或 iPhone 做 development build

0. 2026-05-05 已推进 Mobile Workbench LiveKit React Native 最小 room 连接切片
   - 新增 [use-livekit-room-connection.ts](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/src/realtime/use-livekit-room-connection.ts)
   - [index.ts](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/index.ts) 已调用 `registerGlobals()`
   - 沟通 surface 现在在 backend `/api/rtc/session/start` 返回 session 后，可以启动 `AudioSession`、连接 LiveKit room、发布麦克风音频，并支持断开清理
   - UI 显示 room connection status 与麦克风发布状态；仍不渲染 participant token
   - mobile static check 已扩展守住 `registerGlobals`、`AudioSession.startAudioSession`、`setMicrophoneEnabled`
   - 文档已同步：[apps/mobile-workbench/README.md](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/README.md)、[Mobile Workbench Phase 0 RFC](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)、[FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-livekit-room-export-20260505`
   - 尚未完成：真机 LiveKit room smoke、中断 / 断网 / 切后台 UI

0. 2026-05-05 已推进 Mobile Workbench communication 的 backend RTC session orchestration 切片
   - 新增 [use-mobile-rtc-session.ts](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/src/realtime/use-mobile-rtc-session.ts)
   - 沟通 surface 现在可以登录后调用 backend `/api/rtc/session/start` 请求 `quick_talk` session
   - App 只展示 room/readiness/blockers/warnings，不渲染 participant token
   - 当前已完成 backend-orchestrated token/readiness 半段；后续已接上最小 room 连接代码，仍需真机 smoke
   - mobile static check 已扩展守住 `/rtc/session/start` 与 `participantToken` contract
   - 文档已同步：[apps/mobile-workbench/README.md](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/README.md)、[Mobile Workbench Phase 0 RFC](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)、[FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-rtc-session-export-20260505`

0. 2026-05-05 已推进 Mobile Workbench native recorder queue 的上传回执切片
   - 新增 [mobile-upload-client.ts](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/src/api/mobile-upload-client.ts)
   - `apps/mobile-workbench` 练习 surface 现在可以把本地 queue item 走现有 backend `/api/upload/sign`、OSS signed URL PUT、`/api/upload/complete`
   - 上传成功后会把 `uploadReceipt` 写回本地 queue item，并将状态改为 `uploaded`
   - 上传失败会保留本地文件，记录 `lastError`，并将状态改为 `failed`，后续可重试或丢弃
   - App 练习 surface 已把“待补传”按钮收成 `上传 / 上传中 / 已上传`
   - 文档已同步：[apps/mobile-workbench/README.md](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/README.md)、[Mobile Workbench Phase 0 RFC](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm run check`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-upload-receipt-export-20260505`
   - 尚未完成：Android / iPhone 真机录音 smoke、真实设备上传 receipt smoke、断网队列 UI smoke

0. 2026-05-05 已更新 Founder Collaboration Loop，明确继续 App 开发的下一刀
   - 更新 [FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)
   - 当前 App 现状判断：
   - `apps/mobile-workbench` 已完成 Expo skeleton、四 surface、Supabase mobile auth、workspace snapshot read、native recorder queue 本地闭环
   - 尚未完成真机录音 smoke、断网队列 UI smoke、真实设备 upload receipt smoke、Web/App active prepared expression 人工确认、LiveKit React Native room/audio session
   - 下一段继续 App 的顺序：
   - 先做 Android / iPhone 真机录音 smoke
   - 再做真实设备 upload receipt smoke 和 retry 去重细化
   - 再做 LiveKit React Native room/audio session
   - 最后接 BLE / USB / 外接麦事件
   - 创始人需要把控：录音显式性、本地未上传录音保存/删除、医疗表述边界、硬件事件必须先进 App 再映射动作

0. 2026-05-05 已新增初版硬件桥接开发手册
   - 新增 [硬件桥接开发手册（2026-05-05）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md)
   - 当前硬件判断：
   - 第一阶段不让 ESP32 直接承接 LiveKit 实时语音
   - ESP32-S3 先做 `BLE 控制桥`，事件进入 Mobile Workbench 后再映射到 recorder queue / LiveKit session
   - I2S 麦克风录音上传作为 P1 原型，先服务训练样本，不服务实时沟通
   - 文档已包含购买清单、官方文档入口、ESP-IDF 开发步骤、BLE GATT 协议、App 接入、LiveKit 边界、上传链路、安全隐私与验收清单
   - 已同步入口：[docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)、[README.md](/home/ubuntu/VoxFlame-Agent/README.md)

0. 2026-05-05 已复核应用账户注册与 OSS 分账户上传现状
   - Supabase Auth 当前共 `22` 个注册账户，全部有邮箱、无手机号；最新登录账户是 `2307294809@qq.com`，最后登录时间 `2026-05-04T09:59:55.95749Z`
   - 当前有 OSS 对象的注册账户为 `5` 个：
   - `1137205964@qq.com` / `1137205964__8a533bbe`: `120` 个对象，约 `14.8 MB`
   - `13818790456@139.com` / `13818790456__d01b4410`: `29` 个对象，约 `2.60 MB`
   - `2307294809@qq.com` / `2307294809__64758dee`: `286` 个对象，约 `38.6 MB`
   - `874888410@qq.com` / `874888410__800f7d03`: `5` 个对象，约 `461.8 KB`
   - `ltf.edgar@foxmail.com` / `ltf.edgar__53649c22`: `6` 个对象，约 `2.02 MB`
   - 当前注册但未匹配到 OSS 对象的账户为 `17` 个；其中包括 `voxflame.e2e.*@example.com` 和 `test@voxflame.com` 这类明显测试账户
   - OSS 当前全量对象数 `469`，总量约 `64.3 MB`
   - 除注册账户外，还有 `legacy__v_gv7fxwrp` `7` 个对象、`unassigned` `16` 个对象，需要后续单独判断是否迁移、归档或删除
   - 本地清单已刷新到 [artifacts/oss-by-account](/home/ubuntu/VoxFlame-Agent/artifacts/oss-by-account)，`_inventory.json` 生成时间 `2026-05-05T04:33:51.061Z`
   - 相比 2026-04-29 旧清单，OSS 从 `463` 增至 `469`，新增 `6` 个对象都归到 `1137205964__8a533bbe`
   - 只做了只读账户查询和 OSS 本地同步；未删除账户、未删除 OSS 对象、未改数据库

0. 2026-05-04 已确认可以进入 App / Mobile Workbench Phase 0
   - 新增并更新 [VoxFlame App / Mobile Workbench Best Practices And Opportunity（2026-05-04）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)
   - 结论：
   - 当前 Web/PWA 已基本具备稳定演示、录音补传和 workspace contract 基础，可以开始完整移动端工作台研发
   - “一步到位”指产品信息架构、owner、contract 和技术路线一步到位；工程交付仍按可验证切片推进
   - 推荐新建 `apps/mobile-workbench`，复用现有 backend contract，不复制 Next.js 整站，也不另造第二套 owner
   - 官方调研已覆盖：
   - Expo / React Native：适合深原生音频、LiveKit mobile、文件系统、权限、后台任务和长期移动端工作台；后台任务和 iOS background fetch 都有限制
   - Capacitor：适合 Web 技术栈 + native plugin bridge 原型；常规工作流需要 build + `npx cap sync`，不作为完整工作台主线
   - Supabase：React Native 不能沿用浏览器 localStorage/cookie 假设，需要 AsyncStorage / SecureStore adapter
   - LiveKit：移动端必须继续通过 backend 拿 token，并显式管理 audio session
   - iOS / Android：麦克风与后台录音都有系统级授权和 while-in-use 限制，不能在产品承诺里写满
   - 已同步入口：
   - [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)
   - [VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)
   - [FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)
   - 创始人需要把控的方向已写入协作循环：
   - 完整移动端工作台的承诺边界
   - 后台录音与隐私
   - 医疗 / 康复表述
   - 硬件桥接优先级
   - Expo / React Native / LiveKit mobile / Supabase mobile auth / Capacitor fallback 的学习顺序
   - 本轮同时保留上一轮 Web/PWA 稳定性修复：
   - `/api/rtc/health` 改成无认证最小健康信号，详细 RTC session/control 端点仍需认证
   - PWA manifest 的 `home-wide.png` 已从坏占位文件换成有效 `1280x720` PNG
   - 记忆页训练总结 fallback 已修复：材料库 asset 的空 reports 不再遮住 workspace snapshot 里的全训练样本总结

0. 2026-05-04 已开始 `apps/mobile-workbench` Phase 0 skeleton
   - 新增 [Mobile Workbench Phase 0 RFC](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)
   - 新增 [apps/mobile-workbench](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench)
   - 当前落地：
   - Expo / React Native package/app config skeleton
   - 四个一级 surface：`communication / practice / memory / device`
   - 移动端 contract boundary：RTC intent、recording envelope、upload receipt、workspace read model、recorder queue policy
   - 静态验证脚本：`npm run check:mobile-workbench`
   - 现役 RTC / recording 类型已从旧移动端 surface id 收口为 `mobile_workbench`
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm install --package-lock-only`
   - `cd apps/mobile-workbench && npm install --ignore-scripts --no-audit --prefer-offline`
   - `cd apps/mobile-workbench && npm run check`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run start -- --localhost --port 8123`
   - `curl -s http://127.0.0.1:8123/status`
   - `sudo docker compose up -d --build livekit-server backend frontend livekit-agent`
   - `sudo docker compose ps`
   - `curl -s http://127.0.0.1:3001/health`
   - `curl -s http://127.0.0.1:3001/api/rtc/health`
   - 注意：
   - 首次完整安装曾因 npm registry 下载 `@livekit/components-core` 出现 `ECONNRESET`，重试后成功；当前仍有 LiveKit 依赖链里的 React peer warning，后续依赖治理要继续关注
   - Expo dev server 当前使用 `/tmp/voxflame-expo-home` 避免写入仓库外 home 目录
   - Docker 核心栈已重新 build / up，`backend` 与 `frontend` compose health 均为 healthy，`/api/rtc/health` 继续保持无认证最小健康信号

0. 2026-05-04 已推进 Mobile Workbench Step 2 / Step 3
   - 已新增 Supabase React Native auth adapter：
   - `src/auth/mobile-supabase-client.ts`
   - `src/auth/use-mobile-auth.ts`
   - `src/auth/mobile-auth-hint-storage.ts`
   - Supabase session storage 使用官方推荐的 `AsyncStorage`；`SecureStore` 只保存 last email 这类小型提示，不保存整份 session
   - 已新增 `src/workspace/use-mobile-workspace.ts`，登录后读取 `GET /api/memory/workspace/:userId`
   - `App.tsx` 现在包含：
   - 登录 / 退出登录卡片
   - workspace 同步状态
   - prepared expression / quick phrases / daily target 的只读展示
   - 缺少配置、未登录、同步失败等显式状态
   - 已移除误导性的 `web` script；当前 native smoke 走 `npm run export:android`
   - 已新增 `apps/mobile-workbench/.env.example`
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm run check`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-android-export-20260504-stage2`
   - `curl -s http://127.0.0.1:8123/status`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED MOBILE_WORKBENCH_SMOKE_EMAIL=... MOBILE_WORKBENCH_SMOKE_PASSWORD=... EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001/api npm run smoke:real-workspace`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED ... npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-android-export-real-env-tls-on-20260504`
   - 真实账号 smoke 结果：
   - Supabase Auth 登录成功
   - workspace snapshot 返回 `200`
   - `hasPreparedExpression=true`
   - `dailyTarget=20`
   - workspace 无 token 返回 `401`
   - `/health` 与 `/api/rtc/health` 匿名返回 `200`
   - 尚未完成：
   - 真实账号真机 UI 登录 smoke
   - Web / App 同读同一份 active prepared expression 的人工确认
   - Native recorder queue
   - 架构判断：
   - App 不依赖 Web / Next.js runtime；Web 与 App 是两个 sibling client，共同依赖 backend-owned contracts

0. 2026-05-04 已推进 Mobile Workbench Step 4 Native recorder queue
   - 已按 Expo 官方文档接入：
   - `expo-audio`：`useAudioRecorder / useAudioRecorderState / AudioModule.requestRecordingPermissionsAsync / setAudioModeAsync`
   - `expo-file-system`：`Paths.document / Directory / File`
   - 新增 [native-recorder-storage.ts](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/src/queue/native-recorder-storage.ts)
   - 持久本地队列：`Paths.document/voxflame-recorder-queue/queue.json`
   - 持久音频目录：`Paths.document/voxflame-recorder-queue/audio`
   - 新增 [use-native-recorder-queue.ts](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/src/queue/use-native-recorder-queue.ts)
   - 支持麦克风权限检查 / 请求、开始录音、停止保存、生成 `recording envelope`、本地队列读取、标记 `upload_pending`、丢弃和最近一条回放
   - [App.tsx](/home/ubuntu/VoxFlame-Agent/apps/mobile-workbench/App.tsx) 练习 surface 已接上本次练习句输入、录音按钮、回放、待补传、丢弃和队列统计
   - 已验证：
   - `npm run check:mobile-workbench`
   - `cd apps/mobile-workbench && npm run typecheck`
   - `env -u NODE_TLS_REJECT_UNAUTHORIZED HOME=/tmp/voxflame-expo-home EXPO_NO_TELEMETRY=1 npm run export:android -- --output-dir /tmp/voxflame-mobile-workbench-recorder-queue-export-20260504`
   - 尚未完成：
   - Android / iPhone 真机录音 smoke
   - 断网队列 UI smoke
   - upload receipt / retry 去重接入

0. 2026-04-29 已新增“从需求到应用架构”的 full-stack 学习指南
   - 新增 [VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md)
   - 文档把新需求拆解固定成：
   - `真实场景 -> surface -> 状态生命周期 -> owner -> contract -> flow -> failure -> verification`
   - 结合当前 VoxFlame 主链说明：
   - `Frontend = 产品 surface + 本地兜底`
   - `Backend = durable owner + control plane`
   - `LiveKit = realtime transport`
   - `livekit_agent = session runtime intelligence`
   - `Dataset = audio-target asset system`
   - 同时补了 React / Next.js / Express / Supabase / LiveKit / MDN / Stripe / 12-Factor / Sam Newman / Martin Fowler 等学习链接
   - 已同步入口：
   - [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)
   - [FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)
   - [backend/README.md](/home/ubuntu/VoxFlame-Agent/backend/README.md)

0. 2026-04-29 已把 OSS 全量对象按账户下载到本地 artifacts；2026-05-05 已刷新
   - 输出目录：[artifacts/oss-by-account](/home/ubuntu/VoxFlame-Agent/artifacts/oss-by-account)
   - 当前 OSS 对象总数 `469`，总量约 `64.3 MB`
   - 本地排除 `_inventory.json / _objects.jsonl` 后文件数为 `469`
   - 账户目录：
   - `1137205964__8a533bbe`: `120` 个对象
   - `13818790456__d01b4410`: `29` 个对象
   - `2307294809__64758dee`: `286` 个对象
   - `874888410__800f7d03`: `5` 个对象
   - `legacy__v_gv7fxwrp`: `7` 个对象
   - `ltf.edgar__53649c22`: `6` 个对象
   - `unassigned`: `16` 个对象
   - 新增 [download_oss_by_account.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/download_oss_by_account.ts)，可通过 `cd backend && npm run download:oss-by-account` 重跑
   - 已验证：
   - `cd backend && ./node_modules/.bin/tsc --noEmit --skipLibCheck --esModuleInterop --module commonjs --target ES2020 --moduleResolution node scripts/download_oss_by_account.ts`
   - `cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts --dry-run`
   - `cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts`

# 当前任务状态

> 最后更新: 2026-08-27

## 2026-09-03 Android 录音确认修复发布

- 根因已由真机录屏确认：录音所需的环境、位置和授权确认与目标句/主按钮相隔数屏；主按钮只弹提示而不把用户带回确认区，上一句/下一句还能绕过同一门禁。
- 最新 `main` 上的最小修复已完成：3 项确认移到目标句与录音按钮之间；未确认时主按钮显示“先完成上方确认”并禁用，前后切题共用同一门禁；路由/一级页面切换自动回顶，Android 顶部补状态栏安全区。录音、上传、撤回、题库和材料协议未改变。
- 已新增控制状态单元回归和静态布局守卫；`test:training`、`test:communication`、`test:memory`、`typecheck`、`check`、Android/iOS Expo export 与 `git diff --check` 已通过。
- 发布进行中：需合入 `main` 后运行 Android Preview 发布事务并核对官网版本、build、SHA256、下载响应和 Backend health。对方安装新包并验证确认、录音、确认收录及连续下一句前，不宣称真机问题已彻底解决。

## 2026-08-26 App 完整替代 Web 七步优化

- 第 1 项已完成：Mobile parity 通过 PR #17 合入 `main`，版本为 `0.1.4`、Android `versionCode=5`、iOS `buildNumber=5`；新版 APK 已构建并发布到 `https://voxember.com/download/android`。GitHub Actions 因账号 billing lock 未启动，按用户授权以完整本地验证替代 CI 后直接合并。
- 第 2 项已完成代码切片：Mobile 沟通首页明确分成“快速表达 / 语音助手”；未登录用户也能直接进入快速表达，通用短句点击即本机朗读，并支持自定义文字、本机 TTS、复制和全屏给对方看，不创建 RTC、不上传声音。登录后会去重合并 workspace 个人短句；只有主动进入语音助手并开始沟通才建立 RTC，自定义文字可明确发送给 agent。
- 第 2 项验证通过：`npm run test:communication`、`npm run test:training`、`npm run check`、`npm run typecheck`、Android/iOS production export、`git diff --check`。真实 TTS、剪贴板、LiveKit 文字发送与触控体验留在第 7 项 Android/iPhone 真机全流程统一验收。
- 第 3 项已完成代码切片：手机训练首页改为“马上录 / 自己的材料 / 按主题选择”三层；8 个正式 collection 类别及真实可录句数直接来自 `/training/catalog`，现代文章朗读明确显示“连续朗读”标识。推荐入口直达“日常与出行”；有自有材料时直达逐句录音，无材料时转到“准备”页添加，20 词筛查保留为次级入口。
- 第 3 项验证通过：Mobile communication/training tests、check、typecheck、Android/iOS production export、`git diff --check`。下一步严格进入第 4 项材料选择、手机文件导入和统一切句；第 5–7 项尚未开始。
- 第 4 项已完成代码切片：Mobile 准备页可用 Android/iOS 系统文件选择器导入 `.txt/.md`（500 KB 上限）、自动带入文件名和正文并保存到现有材料库；训练首页多份材料可直接选择，激活 API 同时返回新的 workspace snapshot，避免异步刷新时录错材料。
- 切句唯一事实源已收口到 backend `prepared-expression.service`：workspace `prepared_expression.practice_lines` 直接返回逐句录音清单和段落关联，Web/Mobile 都只消费该协议；两端旧的原文切句算法已删除，滚动部署期间仅回退既有结构化 section 行。
- 第 4 项验证通过：backend prepared-expression 回归与 build、Web 材料练习 5 项回归/TypeScript/production build（24/24 页面）、Mobile tests/check/typecheck/Android+iOS export、`git diff --check`。下一步严格进入第 5 项录后确认、严格重录替换、不收录；第 6–7 项尚未开始。
- 第 5 项已完成代码切片：Mobile 停止录音后只写入本机队列并进入明确确认页，不再自动上传；提供回听、确认收录、重录这一句和不收录。筛查结果也只在确认收录后计入完成进度。
- 重录采用严格替换：先撤回当前录音，撤回失败不开始新录音；不收录会复用 queue 的本机删除/云端撤回能力，失败时保留当前录音和确认页。待确认或处理期间锁住返回、换句、换题库、改文字和重复操作。
- 第 6 项已完成代码切片：Mobile 记忆页补齐场景模板选择、系统模板重点词/开口句查看、自定义重点词新增/编辑/删除，以及画像中的病因、支持程度、常见场景、易听错词、支持方式完整编辑；材料和常用短句继续使用原有同源 CRUD。
- Backend 已正式挂载自定义热词 API，并修复模板热词覆盖自定义热词的问题：模板与用户重点词分别持久化、合并消费，切换模板不再删除用户重点词。显式画像编辑支持替换/清空列表和可选字段，会话自动维护仍保持增量合并。
- 第 7 项工程验收闭环已补齐：新增 Android/iPhone 共用的 13 项完整业务流验收清单、JSON 证据模板和严格校验器，覆盖登录/匿名快速表达、TTS/复制/大字、RTC 语音与文字、8 主题与现代文章、文件导入、录后确认、严格替换、不收录、完整记忆 CRUD 和断网恢复；空证据或 `fail/pending` 无法通过。
- Android EAS 发布时检测到远端已有更高 build，发布脚本按唯一递增规则自动升到 `0.1.7`、Android `versionCode=8`、iOS `buildNumber=8`。Android build `463f705e-a125-43d6-a6dc-b5df98e74673` 已发布到 `https://voxember.com/download/android`，SHA256 `821d0a3573c4738811bbe75085dd4eefab31d6c8f6cfe1f11941ed2ee8775762`。当前 Linux 主机无 adb 设备、无 macOS/iOS 工具链，因此实体 Android/iPhone 的逐项点击、麦克风、蓝牙/有线路由和 Apple 安装证据仍必须由设备持有人完成，不能由 bundle 构建替代。
- 第 6 项 Backend 已于 2026-08-27 从发布提交 `d0a0525` 的隔离源码构建并部署，没有混入当前工作树的 PWA/RTC 改动。生产 `/api/rtc/health` 返回 200，`POST /api/memory/hotwords` 未登录返回 401，Backend 容器健康；旧镜像保留为 `voxflame-agent-backend:pre-mobile-0.1.7` 可回滚。
- iOS `0.1.7 (8)` Preview 云构建已实际发起。EAS 正常加载 Preview 环境，但项目显示 `No credentials set up yet`，且没有适用于内部分发的 Provisioning Profile；非交互构建无法注册测试设备。下一步必须由 Apple 账号持有人完成登录、设备登记和签名凭据生成后重跑。
- 真机门当前仍严格 pending：本机 USB 仅有 Linux root hub，没有连接 Android/iPhone，也没有 `adb`、`xcrun` 或 macOS/iOS 工具链。Android/iPhone 各自填写验收 JSON 并通过 `npm run validate:device-acceptance -- <result.json>` 前，不宣称 App 已完全替代 Web。
- 已知非阻塞警告：Expo export 继承了当前 shell 的 `NODE_TLS_REJECT_UNAUTHORIZED=0` 并打印 TLS warning；双平台 bundle 均成功。

## 2026-08-26 Web 训练录音区产品化重构

- `/contribute` 不再用三个并列的工程分类占据首屏，改为“马上录几句今天用得上的话 / 用自己的内容 / 按沟通场景选择”三层任务入口；推荐动作直接进入日常表达，低频说明收进次级信息。
- 8 个公共主题均直接显示题库事实源中的可录句数：日常与出行 40、看病与求助 56、人群与角色 67、设备与数字 154、现代文章朗读 4947、会议与协作 771、车载与导航 80、音系强化 3540；自定义材料显示实际切分后的句数。
- 自定义材料不再要求用户先理解并绕去记忆页：`/contribute/topic/custom-material?new=1` 可直接上传 `.txt/.md` 或粘贴原文，保存到现有 workspace 材料事实源、自动设为当前材料并复用现役标点/段落切句器进入三步录音流程；已有材料仍可继续录或换新。
- 记忆区仍是个人材料的持久维护事实源，没有新增平级存储或兼容路径；录音、上传、撤回和重录语义保持不变。
- 验证：Web 95 项测试、TypeScript、production build（24/24 页面）、`git diff --check` 通过；Playwright 在 390×844 下确认 `/contribute` 与新材料入口未登录时保留精确 `next`，console 0 error/warning。登录后的主题视觉、真实文件保存/自动切句与麦克风录音仍需授权账号设备 smoke。

## 2026-08-25 “补齐声音”用户语义纠偏

- 用户入口不再把音系覆盖任务称为“补齐声音 / 核心补音”；统一改为“系统易漏听字词 / 系统易漏听”，明确不足属于系统理解覆盖，不属于用户声音。
- `/contribute` 主题卡移除 `88/88`、机器门、训练导入审核和边缘专项等研发台账文案，只说明用户价值：让系统认识较少见、容易听错的自然字词和短句；按平时方式说，不需要模仿标准发音，可随时结束。
- Web 录音页分组、Mobile collection protocol 与内部语料审核任务标签同步；底层 `targeted_gap` ID 和数据路由保持不变，没有新增兼容层或采集功能。
- 验证：Web 定向测试 11 项、TypeScript、production build（24/24 页面）、Mobile check/typecheck、AI docs harness、`git diff --check` 通过；Playwright 未登录 `/contribute` 正确回跳 `/login?next=%2Fcontribute`，console 0 error/warning。登录后的卡片视觉 smoke 仍需授权账号。

## 2026-08-24 个性化 ASR 统一账户网关

- 已彻底移除应用侧逐用户 ASR 白名单和旧 18000 入口；所有已认证的 `communication / training` 会话统一调用 `http://127.0.0.1:8001/transcribe`，未认证与 `quick_talk` 不进入该远端账户链路。
- Backend 从 Supabase 已验证身份生成稳定 `asr_account_id`：历史数字 QQ 邮箱沿用数字前缀，其他账户使用不可变 user UUID。该键由服务端生成，只进入签发给 LiveKit agent 的 dispatch metadata，不进入 participant token metadata/attributes，也不接受前端自报账户号。
- `livekit_agent` 以 `X-Account-ID` 发送账户键；8001 独占用户注册、个性化/公共 fallback、线上最佳模型和实验晋升。以后新增或替换个性化模型只改模型服务注册表，不改 VoxFlame 代码、环境变量或容器。
- HTTP 返回的 `account_id` 若与请求不一致会被拒绝；前端诊断只收到 `model_version / personalized / fallback`，不收到模型账户键。8001 失败继续回退 DashScope realtime ASR。
- HTTP 客户端按 LiveKit 会话复用连接，避免每句话重复建立 TCP 连接；会话结束显式关闭。
- 验证通过：LiveKit agent 全量 80 项（1 项 worker-only skip）、Backend TypeScript build、RTC/LiveKit 契约测试、compose 展开和 `git diff --check`。仓库搜索确认旧白名单与旧端口引用为 0。
- 尚未完成：当前主机 `127.0.0.1:8001/health` 实测 connection refused。现有 `127.0.0.1:18000` 由外部 SSH 会话监听，health 正常，但用 2187054680、2307294809、3083029019 与未知账户分别做真实 WAV smoke 时都只返回转写正文，缺少 `account_id/model_version/personalized/fallback`，说明它仍是旧接口而非新账户网关。
- 部署边界：暂不重启仍在服务的旧 `livekit-agent`，避免把线上从可用 18000 切到不可达 8001。先将远端新服务 8001 映射为本机可达的 8001，并确认三账户个性化与未知账户公共 fallback 契约，再执行 `sudo scripts/docker-rebuild-core-fast.sh backend`（若 backend 镜像包含本次 RTC 变更）和 `sudo scripts/docker-rebuild-core-fast.sh` 支持的 livekit-agent 最小重建路径；若脚本无 agent 单服务模式，则用 `sudo docker compose build livekit-agent && sudo docker compose up -d --no-deps livekit-agent`。

## 2026-08-24 Web “重录这一句”替换语义修复

- 根因：结果页展示时录音已经进入自动保存，旧按钮又因全局上传态被禁用；即使稍后能点，也只是再次开始录音，不会撤回上一版，可能让同一句同时留下两条样本。
- 现已把“重录”收口为替换操作：保存中的样本先等待保存完成并撤回，已上传或本机排队的样本先撤回，只有撤回成功才自动进入原句重录；撤回失败不开始新录音。
- 交互同步显示“正在替换 / 正在撤回旧录音”，替换期间锁住继续、不收录和重复重录，并明确说明最终只保留新录音。
- 验证：新增替换策略 4 项回归测试通过，TypeScript、前端 product-message 检查、Next production build 和 `git diff --check` 通过；Playwright 未登录访问 `/contribute/topic/daily-mobility` 正确回跳并保留 `next`，console 0 error。真实账号、麦克风、上传与撤回闭环仍需设备 smoke。
- 全量验证已恢复：`npm test` 91 项通过；录音就绪题面由独立 gate 校验，不删除基础题库或历史来源。
- 2026-08-24 继续产品化：音系强化录音页默认打开“核心补音”组，首屏明确展示全部 568 条录音就绪补音的拆分（核心 263、开放研究 14、低频补强 291）；新增独立“开放研究补充”组显示 14 条非教材、非训练导入批准的长尾补充句；“低频补强”仍单独显示 291 条录音就绪题面。“训练导入审核 0 条”与“录音就绪题面已开放”在界面上分开表达。新增完整性回归确认核心录音包 263 条恰好覆盖台账 88 个 core 缺口，低频补强只引用 below-minimum 目标。

## 2026-08-22 普通话语言学覆盖与录音区持续优化

- 核心目标：录音区以语言学和目标用户证据为根本依据，持续完成 `现有微调/采集诊断 -> 缺口驱动补料 -> 准确分区 -> 用户友好采集 -> 固定评测复盘`；SOP 只作现场操作参考，不定义覆盖完整性。
- 已建立四层覆盖模型：音系库存、常用合法音节/音节—声调、连续语流、任务与真实沟通场景；主任务分区与可叠加语言学标签分开，禁止用“句库总量”或“各音出现一次”宣称全面覆盖。
- 新增可重复工具：`frontend/scripts/mandarin-coverage-core.mjs`、参考集合生成、现役题库导出、应用/模型 manifest 审计 CLI 和回归测试。版本化参考集合来自 `pinyin-data` commit `923b108d...`，包含 402 个常用无调音节和 1242 个常用音节—声调形式，并保留上游 410 行待复核/争议限制。
- 题库基线：9107 条基础题面，另有 263 条核心补音和 291 条低频补强录音就绪题面；相对 9112 仅退出 5 条明确“学习包”商业污染，历史录音、manifest 和原始来源未删除。基础台账声母 `22/22`，规范化韵母 `38/39`；常用无调音节 `386/402`，音节—声调 `1025/1242`。主要缺口是长尾音节—声调，不是总量。
- 数量口径已用回归测试固定：`mandarin-training-real.json` 为 8771 条外部生成子池，前端合并 336 条人工策划/固定评估项后才是现役 9107 条；8771 不是再次删除 336 条。全台账有 9 个 disputed tier，其中 8 个属于 217 个完全缺失项，另 1 个已出现但低于 20 次。
- 应用采集基线：10 个 manifest 原始 1421 行，按 `recording_id` 去重为 1185 条、约 2.568 小时、9 名说话人/48 sessions；按有效音频、非空 target、授权 scope 与上传契约计入 1180 条 collected，质量异常只分层不删除；常用无调音节覆盖 `339/402`，音节—声调 `708/1242`。
- 微调诊断边界：CLEAR-VOX-MODEL 固定记录确认主 CDSD 为 `112424/14032/14100`，明确错配清理有效，但按高 CER 删除重度说话人、标准拼音 CTC 和机械最小对立增强均未形成稳定突破。当前机器未挂载 `/qiu/data/.../cdsd`，本轮不能声称逐条审过主微调集；审计 CLI 已支持 `--model-manifest`，数据挂载后补跑。
- 研究与应用决策已登记为 `RF-011 validate`。当前主线是语言学与目标用户逐条审核 263 条核心候选，再做小规模采集和固定 speaker-disjoint 微调消融；人工实际转写工具保留为旁路，不再抢占全音系列语料建设主线。
- 2026-08-24 已完成任务/标签旁路索引；当前索引覆盖基础题面与补音题面共 `9675/9675` 条，保留正常题面、原文和原类别；仅 5 条确认商业污染退出。每条只有一个互斥 `task_id`，可叠加声母、韵母、声调、音节—声调、位置和连续语流标签。
- 2026-08-23 已建立候选人工复核门禁：`frontend/scripts/validate-mandarin-review-queue.mjs` 要求语言学、自然度、安全、许可、任务五项审核；Tatoeba 300 条候选当前 `pending 1500/1500`，生产导入数为 0。该门禁只新增校验，不修改或删除题库、录音和候选原文。
- 2026-08-23 已增加评测结构门禁：`frontend/scripts/validate-mandarin-evaluation-report.mjs` 强制固定 speaker-disjoint 测试集、总体/最差说话人/短句 CER、严重度/长度分层、P95 延迟、用户成功/跳过/疲劳指标和回退动作；没有真实结果时只能保持 `validate`，不能宣称模型提升。
- 2026-08-23 已按反馈清理前端生成题库中的 5 条“学习包”类课程/考试营销噪声；清理审计总数为 209 条，新增项均为 `commercial_or_advertising`。该操作不删除历史录音、manifest 或原始来源，仅阻止污染题面进入用户录音区。
- 2026-08-23 已同步重建 1242 项全量覆盖目标台账：现役题库为 `569 robust / 456 below_minimum / 217 missing`；217 个硬缺口按现代词、实际使用证据和默认用户负担收紧为 `88 core / 121 edge / 8 disputed`。`chun3 / heng4 / long4 / ming3 / nüe4 / zei2` 等主要依赖贬损、地域、醉酒、虐待或犯罪承载词的形式转入边缘专项；它们仍在全音台账，不从语言学库存删除。
- 核心第一阶段仍保留原始 263 条候选审核包作为历史证据；另生成 `mandarin-recording-core-gap-corpus.json`，按可复现语言学/工程 gate 放行 `263` 条录音题面（`88` 词、`175` 短句、`88` 个核心目标），真正接入音系强化录音区。录音区不等待六项主观审核或人工 `spoken_text`；后者仅为可选质量诊断。
- 2026-08-23 继续按用户负担优化核心候选：将 `歹徒/懒惰/醉醺醺/挣扎/产卵/烫伤` 等默认词锚点替换为同音目标下的 `好歹/掌舵/烟熏/炸鱼/鹅卵石/烫发` 等中性现代词；挑衅、指人评价、灾难语义和明显翻译腔句进入永久拦截。人工短句现强制提供句内整词与整词拼音证据，175/175 均已满足；当前候选快照为 `2026-08-23T03:34:40.850Z`，仍为 263 条且全部 pending。
- 2026-08-23 已为 456 个 `below_minimum` 音节—声调建立基础题库补强计划：455 个默认核心目标进入调度，1 个争议目标下线；基础安全题库选出 835 条题面，分配 2998 个未来采集槽位。随后从 346 条低频语境候选中按机器门放行 291 条新增录音就绪题面，覆盖 116 个目标；计划槽位和真实录音仍严格分开。
- 录音区“低频补强”组同时包含 835 条基础计划题面和 291 条机器校验录音就绪题面，并按录音就绪优先；原有八个音系练习组不变。完整审计计划保留为旁路产物，浏览器只加载轻量产品索引。
- 本切片验证：普通话语料脚本 75/75、Web 91/91、采集证据/产品状态/录音 gate 回归、TypeScript、Next production build 24/24 页面、AI docs harness 和 `git diff --check` 通过；Playwright 未登录 smoke 正确回跳并保留审核路径，受保护 API 返回 401、console 0 错误/警告；授权审核者真实交互仍需白名单账号验证。
- 边缘专项单列 121 项，争议 8 项保持下线。地域/轻声口径冲突、只有词典证据和高负担承载形式不进入默认录音。CC-CEDICT 另发现 311 个核心基线外词音（225 轻声、68 额外声调、18 额外词汇音节），只进入发现审核表，不扩张当前覆盖分母。
- 已生成 `mandarin-core-gap-phase1-review.tsv`：263 行按每批 30 条分成 9 批，包含目标音、文本、来源、整词读音证据和六项审核栏，供语言学与目标用户复核；TSV 不直接进入生产。
- 2026-08-23 已把同一 263 条候选产品化为站内 `/corpus-review` 审稿台：9 批导航、搜索/状态筛选、六项审核、本机自动保存和 decision JSON 导出均已完成。页面/API 需登录，服务端 `VOXFLAME_CORPUS_REVIEWER_EMAILS` 精确白名单控制候选读取；浏览器不能直接写仓库或生产语料。
- 2026-08-23 已为 146 个安全题面不足的低频目标重扫完整 Tatoeba 普通话快照并建立独立低频语境审稿任务：严格用户负担门后保留 346 条唯一待审句、354 个目标—句分配，118 个目标达到每音 3 条候选，28 个目标仍需补写；全部六项 `pending`，生产 0。候选层收紧不修改 9107 条现役题库、历史录音、manifest 或来源。
- 2026-08-23 低频补写 brief 已产品化进入同一 `/corpus-review`：当前 28 个目标均进入结构化专家路线，记录风险类别、允许证据、默认录音政策和下一动作；支持目标音/承载词/拼音搜索与独立 authoring worksheet 导出，不提供浏览器直写生产。学习包及 `挨骂 / 殡仪 / 娼妓 / 排尿 / 奴役` 等高负担承载词被拦截，音系目标本身仍完整保留在 1242 项台账。
- decision JSON 已有独立校验/合并 CLI：拒绝过期来源快照、未知或重复 ID、非法状态和无说明的改写/拒绝。真实候选快照的临时往返验证确认只提交 1 条决定时仅 1 条进入批准导出，其余候选保持未动；临时产物已删除。正式审核仍全为 pending，生产导出仍为 0。
- Web 录音区已接入产品状态与安全导出：原有按音组练习保留；录音就绪的核心/开放研究/低频补强题面按机器语言学、来源、长度、安全和显式 target gate 开放，六项人工审核只决定训练导入 approved corpus，不阻塞录音；边缘与争议不混入默认推荐。
- 2026-08-23 已完成真实应用录音人工 `spoken_text` 复核旁路的第一版：从全部 10 个历史 manifest 去重生成 1185 条待复核项，ASR 仅保留为 `asr_hint`，实际文本和 audio-text 对应均为 `pending`；校验器拒绝用户/设备/存储路径字段。人工复核仍是可选质量旁路，不进入默认覆盖门或训练导入。
- 2026-08-23 已生成 1185 条可选 spoken-text 诊断队列；`mandarin-collection-evidence.json` 现按 manifest 契约计入 1180 条 collected，并将错读/漏读/长空白/不可用音频分层，不删除原 manifest 或历史录音记录。旧复核支线已删除，不参与任何现役统计。
- 2026-08-23 已将 1185 条历史录音接入受保护的 `/corpus-review/spoken-text` 人工复核工作区：审核邮箱白名单、受控音频 API、不透明 `recording_id`、ASR 非权威提示、人工 `spoken_text` 与 audio-text 对应确认、本机草稿和决定 JSON 导出均已产品化；工作区 `training_import_allowed=false`，浏览器不能直写生产；它是可选质量旁路，不是录音前置条件。
- 2026-08-23 已补齐真实录音决定离线收口：`validate-mandarin-spoken-text-review` + `merge-mandarin-spoken-text-review-decisions` 强制精确队列快照、审核者/时间、人工文本与音频对应门，并以稀疏补丁合并；未提交录音保持 pending，合并产物仍禁止训练导入。
- 历史 spoken_text 工作区仅作为可选质量旁路保留，不是录音区或采集覆盖硬门。采集统计改为有效音频 + 非空 target；ASR 只能提示疑似错读/漏读，异常按 `valid / suspected_misread / suspected_omission / long_silence / unusable_audio` 分层，不自动删除样本。旧复核机制不再存在于现役链路。
- 双人复核已实际从工作树移除：相关页面、路由、脚本、测试、统计/证据包和生成 JSON 均已删除；`git status` 中的 `D` 仅表示删除尚未提交，不表示文件仍在运行。harness 已明确禁止将双人复核、人工 spoken_text 或音频—文本确认作为录音、覆盖或训练导入前置条件。
- 本轮验证通过：普通话相关定向测试、前端测试、TypeScript、Next production build、AI docs harness 和 `git diff --check`。产品状态新增唯一总计 `recording_ready_total = 568 条 / 568 个唯一文本 / 206 个显式目标`，页面直接消费该事实源；新增开放研究补充包 14 条、覆盖 15 个目标；正式覆盖证据 `mandarin-recording-ready-coverage.json` 现记录 568 条录音就绪题面。Playwright 已确认未登录访问目标录音页会回跳并保留 `next`；真实账号录音和授权审核者交互仍未完成。
- 2026-08-24 完成覆盖口径修正：`audit-mandarin-coverage.mjs` 新增 `--recording-corpus`，对录音就绪题面同时报告普通字形注音与显式 `coverage_targets`；多音字不再因通用 pinyin 默认读音把明确目标误报为缺失。录音就绪仍不等于真实录音，真实覆盖仍只由 manifest 的有效音频 + 非空 target + 授权/上传契约计数。
- 2026-08-24 重算历史 manifest 证据：`build-mandarin-collection-evidence.mjs` 已对 10 个本地 manifest 重新生成采集证据，采集资格仍为 1180 条；历史 `prompt.target_focus` 中的“补稳/收住”反馈标签不符合音节—声调格式，已过滤为非显式目标，历史录音显式音节目标覆盖为 0。新增题面的目标链路已补后端 manifest 回归测试，确认 `pronunciation_targets` 写入 `prompt.target_focus` 且设备字段不进入 manifest。下一步必须用真实新增题面录音重算显式覆盖，不能用计划题面数量替代。
- 2026-08-24 新增可复跑收口命令 `cd frontend && npm run rebuild:mandarin-recording-evidence`：读取两组本地 OSS manifest，派生重建 `mandarin-collection-evidence.json`、`mandarin-recording-ready-coverage.json`、`mandarin-speaker-disjoint-split.json` 和 `mandarin-coverage-product-status.json`；不写入音频、manifest、题库或来源。当前重建结果：1421 行 / 1185 去重 / 1180 采集资格，显式音节—声调目标 0/1242，speaker-disjoint 为 555/429/196、交集 0；真实新增题面录音后直接重跑即可得到真实覆盖。

## 2026-08-21 沟通入口信息架构收口

- 沟通入口已拆成独立信息流：`/communicate` 只负责选择“快速表达 / 日常沟通”，不再把一个模式嵌入另一个页面。
- 快速表达独立为 `/communicate/quick`，保持本机朗读、通用短语和个人短语；日常沟通独立为 `/communicate/assistant`，由鉴权保护并保留正确登录回跳。
- 两个工作界面都能回到 `/communicate` 重新选择；首页所有“现在沟通”入口统一进入选择页。
- `useAuth` 的公共快速表达超时竞态不再决定工作界面；日常沟通使用受保护路由，避免已登录用户因 session 恢复时序被误送到登录页。
- 验证通过：frontend TypeScript、78 项测试、production build、lint（仅保留既有其他文件 warnings）、AI docs harness、`git diff --check`；Playwright 在开发端口 `3200` 验证选择页、快速表达页和未登录日常沟通回跳 `/login?next=%2Fcommunicate%2Fassistant`。

## 2026-08-21 Web 数据录入分步引导

- `/contribute` 主题入口已收成单列信息流：默认突出“日常与出行”和自定义材料，其余主题按需展开，不再一次铺开所有类型。
- 普通数据录入主题页已改为三步单列流程：`准备 -> 录一句 -> 确认结果`。每一步只显示当前任务；采集计划、年龄段、性别、换句和本轮信息均为按需展开。
- 录音成功后进入独立结果步骤，以明确正向反馈确认录音已收下，并保留系统听到、回听、继续下一句、重录和不收录。
- 修正自动切到下一句后“重录这一句”可能录到新句的问题；重录现在固定使用结果对应的原句。没有生成完整录音文件时不会显示成功反馈。
- 验证通过：frontend `npx tsc --noEmit`、78 项测试、production build、lint（仅保留仓库其他文件既有 warnings）和 `git diff --check`。Playwright 已确认 `/contribute` 未登录时正确跳转 `/login?next=%2Fcontribute`；真实账号下的麦克风与上传仍需设备 smoke。

## 2026-08-18 语音采集产品化与 App 构建

- 已读取并对照 `燃言_构音障碍普通话语音采集标准化SOP_v1.0.docx`，新增 [docs/VOXFLAME_VOICE_COLLECTION_PRODUCT_SPEC_2026-08-18.md](../docs/VOXFLAME_VOICE_COLLECTION_PRODUCT_SPEC_2026-08-18.md)。流程覆盖采集前环境/距离/同意、单任务录音、回放/撤回、Anchor/自然表达、语料覆盖、硬件 P0/G1 验收和不合时宜语料排除。
- 元数据按用户要求收口：默认训练字段为音频、目标文本、实际转写、严重程度、病种、年龄段、性别；`recording_id`/上传状态/质检字段只为追踪，不作模型特征。
- Web `/contribute/topic/[topicId]` 和 Mobile 筛查/数据录入加入采集前环境、距离和授权确认；Mobile profile 中已有病种/严重程度可进入上传标签，年龄段/性别为可选输入；目标文本与实际转写保持分离。Web/Mobile 上传均有 metadata 白名单，浏览器 UA、麦克风设备 ID/名称和内部 capture/context 字段不会默认进入训练资产。
- Mobile 训练录音先写入本机 queue，LiveKit 连接仅用于实时转写；连接失败或断网不再阻塞录音，录音仍可回放、撤回并在网络恢复后补登。
- Mobile 已加入 baseline/anchor/reading/natural_speech 采集计划选择；逐项真机、输入设备 A/B 和发布门记录在 `docs/VOXFLAME_VOICE_COLLECTION_DEVICE_ACCEPTANCE_CHECKLIST_2026-08-18.md`，原始母版与训练副本的保存边界也已写明。
- 验证通过：Web 78 tests、frontend `npx tsc --noEmit`、frontend production build、Backend build/upload-metadata/LiveKit tests、Mobile `npm run typecheck`/`npm run check`/`npm run test:training`、`bash scripts/check_ai_docs.sh` 和 `git diff --check`。
- Android EAS preview 已提交，构建链接：`https://expo.dev/accounts/qiuds-team/projects/voxflame-mobile-workbench/builds/f032fbea-6a23-424d-8585-3f7bed07d022`。Apple 组织团队已确认（Team ID `J2QXFF775Q`），iOS 签名命令见 [docs/VOXFLAME_APPLE_DEVELOPER_INPUT_CHECKLIST_2026-08-18.md](../docs/VOXFLAME_APPLE_DEVELOPER_INPUT_CHECKLIST_2026-08-18.md)，需用户本机输入 Apple 密码/验证码。

## 2026-08-18 Codex 插件连接问题

- 已确认不是项目 `scripts/start_agent.sh` 路径问题：仓库当前没有该脚本，且本次故障发生在 VS Code Codex app-server / ChatGPT 服务链路，不是 VoxFlame TEN/livekit 运行时。
- 已确认旧代理路径：历史 VS Code settings 曾设置 `http.proxy=http://127.0.0.1:7897` 并注入终端代理；当前 cpu1 无 7897 listener。仅设置 `http.proxySupport: off` 不够：Codex 扩展源码会直接读取 `http.proxy` 并将其注入 app-server 的 `HTTP_PROXY/HTTPS_PROXY`。已在 `/home/ubuntu/.vscode-server/data/User/settings.json` 固定 `http.proxy: ""`、`http.proxyStrictSSL: true` 和 `http.proxySupport: off`，并已终止旧 VS Code Server 进程；重新连接后需复查新日志。
- 已确认链路差异：CLI 走 `https://aicoding.aideb.me/v1`，该地址可达；插件还需要 `chatgpt.com` / `ab.chatgpt.com` 的官方账户链路，cpu1 直连 `chatgpt.com:443` 超时。故障修复需先重载 Remote-SSH/窗口使新设置生效，然后决定给 cpu1 提供可达 ChatGPT 官方域名的代理或继续使用 gateway CLI；不能把 gateway 地址填入插件的 ChatGPT 登录链路。
- 验证证据：`~/.vscode-server/data/logs/20260818T092800/exthost1/openai.chatgpt/Codex.log` 显示新 app-server 仍收到 `127.0.0.1:7897`，同时 `chatgpt.com`/`ab.chatgpt.com` 请求 `fetch failed`；Extension Host 环境本身无代理，代理来自扩展读取的 VS Code 应用级 `http.proxy`。官方 Codex app-server 文档（Context7 `/openai/codex`）说明 VS Code 扩展与 CLI 共享 `~/.codex/config.toml`/`auth.json`，但插件远端目录/账户请求仍受 ChatGPT auth 与网络约束。

## 当前主线

- 主任务：在不破坏 Web/PWA 现役主链的前提下，开始 `App / Mobile Workbench` Phase 0 调研与 RFC；移动端目标从薄 companion 升级为完整移动端工作台。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的产品/工程重点：
  - 先把长期使用价值收口到真实沟通：沟通页优先补 `confirmed output -> 给对方看 / 文本发声 / 听写复制` 这一层，而不是新增平行沟通页或继续加固定句库；硬件外放等真实接口选型后再接
  - 暂时把训练总结移出长期记忆和沟通默认上下文；训练总结只留在训练页、dataset review 和未来专家复核材料里
  - Mobile workbench 必须复用 `workspace snapshot / recording envelope / upload receipt / RTC session orchestration`
  - 战略主线推荐 `Expo / React Native + LiveKit React Native`，从 day one 规划 `沟通 / 练习 / 记忆与准备 / 设备与同步` 四个一级 surface
  - `Capacitor` 只保留为 WebView 原型或过渡方案，不再作为完整移动端工作台主线
  - Phase 0 代码已开始落在 `apps/mobile-workbench`，移动端 surface id 统一为 `mobile_workbench`
  - 把 `session-local typed memory -> 四块记忆系统后台维护 -> workspace snapshot` 的 owner 与写回边界做扎实
  - 把 `prepared-expression / important-expression / 高频句` 的录入和复用入口统一起来
  - 把 dataset 收成最小 audio-target contract，只保留“录音和目标句是否对上”的稳定判断

## 最新收口

0. 2026-08-17 已完成燃言硬件产品最终两版对外文件
   - 首家供应商版：`燃言多模态AI无障碍沟通机_产品功能需求文档_首家供应商修订版_2026-08-17.docx`；保留原供应商熟悉的七章骨架、黑白标题与网格表，但正文不含原稿对照、研究过程或角色阅读分工
   - 通用供应商版：`燃言多模态AI无障碍沟通机_产品方案_通用供应商版_2026-08-17.docx`；独立说明产品、全系统功能、P0/G1—G7、G1 工程输入、验证量产、质量合规、报价交付和供应商回复
   - 两份正文品牌仅为“燃言”，无 VoxFlame/心声/MindVoice、参考资料章节、图标、emoji、装饰图或内嵌媒体；均为 8 页 A4，关键表格逐页检查无裁切
   - 内部参数事实源为 `research/product-engineering/evidence/ranyan-hardware-product-2026-08-17/`：原厂器件事实、候选平台、采购/测试目标和未知逐项分开；ESP32-S3、TAS2563、QCM6490、RK3566、RK3588 资料及 ASHA/FDA/NIST/EU/W3C 方法材料已集中留档，获取失败不冒充已读
   - 旧硬件路线 Markdown、旧供应商 Markdown、两份旧生成器和旧证据目录已清理；原供应商 Word 保留为格式基准。下一步先冻结 P0 真实任务 A/B，再向至少两家供应商发 G1 同口径 RFI/RFQ，不立即冻结 BOM 或开模

0. 2026-08-16 已按第一性原理收口沟通、记忆、练习与健康筛查，重点完成沟通/记忆去重
   - 用户唯一目标是“把话表达出去”；Web 只保留 `/communicate`，已物理删除 `/chat`、`/communicate/live` 和固定六场景选择组件，不保留兼容跳转。
   - `/communicate` 默认是快速表达：匿名用户无需登录即可使用通用短语和手动输入，个人短语登录后异步加载；表达直接走浏览器本机朗读，不连接 LiveKit、不调用 agent、不上传声音，个人短语使用次数后台记录，不让网络请求阻塞代播。
   - 用户明确选择“日常沟通”后，才要求登录并动态加载、挂载 `ChatInterface` 和 LiveKit agent；首屏只保留开始沟通、麦克风和核心输出，已移除固定场景大卡、短语抽屉、连接诊断和手动资料勾选。按需拆包后 `/communicate` First Load JS 从约 355 kB 降到 209 kB。
   - 记忆页成为画像、场景模板、热词、策略、自定义材料和个人短语的唯一维护面；日常沟通按 workspace `default_selected` 自动带入已启用模板与当前材料，不让用户重复装配。
   - 练习仍只有 `20 词能力筛查 / 训练与数据录入`；健康筛查报告仍只给系统听清、音系、稳定性、节奏、静音、收音和个性化准备度，不自动判医学严重度，不新增自由表达入口。
   - 产品决策已沉淀到 `research/product-engineering/COMMUNICATION_SURFACE_FIRST_PRINCIPLES_2026-08-16.md` 和 `RF-009`。Web 17 个测试、TypeScript 与 production build 已通过；HTTP / Playwright 验证匿名 `/communicate` 为 200、`/chat` 与 `/communicate/live` 均直接 404、点击日常沟通才进入登录。待真实设备确认有声 TTS，并完成真实账号个人短语、LiveKit 麦克风与 confirmed output smoke。

0. 2026-08-16 已把筛查页从单一机器分数扩展为沟通表现报告，不新增产品任务
   - 固定 20 词筛查使用字符编辑距离，错字、多字、漏字均计入，并报告易混中文音系、词间稳定性、个人节奏、静音与收音；不再由 ASR 分数自动写入医学轻/中/重。
   - 自由表达、同场景 A/B、朋友听懂确认和 7/30 天趋势只保留为现有报告流程内的研究候选，未作为已落地功能，也不会新增练习入口。
   - 研究证据与产品边界已沉淀到 `research/speech-health/VOICE_AND_COMMUNICATION_PERFORMANCE_REPORT_RESEARCH_2026-08-16.md` 和 `RF-008`；新增核验会话 ASR、卒中构音障碍核心结局、个性化字幕真实使用、2026 伙伴训练、自动表达教练综述与 Microsoft Speaker Coach 官方能力。
   - 尚未验证：真实账号下的 20 词完整录音与报告；未来趋势必须在同人、同任务、同设备下设计，换设备后重建基线。

0. 2026-08-14 已加入国内成果初步审查体系：论文 / 发明专利 / 软件著作权 / 产品
   - `research/OUTCOME_REVIEW.md` 定义国内优先的权威来源和边界：中国版权保护中心/国家版权局、CNIPA、WIPO PATENTSCOPE、CNKI、万方、NSTL、COPE，以及 PubMed/Crossref 等补充来源
   - 软件著作权单独检查主体与权属链、源程序/文档版本固化、hash、第三方依赖和开源/模型/数据许可；不把软著当成技术效果或专利权利保护
   - 国内论文只要求“不是垃圾期刊”不等于放宽审查：至少核验期刊身份/ISSN/出版社/审稿政策、CNKI/万方/NSTL 与 DOI 题录、撤稿/更正、相关工作、数据/方法/统计/伦理和主张边界；拒绝保证录用、代写代投等掠夺性信号
   - 专利初审必须包含 CNIPA/WIPO/论文/产品现有技术检索、权利要求边界、权属和公开时机；不把自动检索当作正式法律意见
   - 每个 `research_id` 必须挂 `research/outcome-reviews/<RO>.md` 初步审查报告；报告只输出 `pass_precheck / revise / hold / escalate_professional`，未通过不得发布、申请或扩展产品范围
   - 已验证：研究 harness、来源 harness 与 AI docs harness 全部通过

0. 2026-08-14 已落地研究—发现—实验—成果—产品—反馈优化 Harness 与发布前权威闸门
   - `research/RESEARCH_HARNESS.md` 定义统一生命周期：`discovered -> evidence_review -> experiment -> outcome_review -> authority_review -> scholarly/IP 或产品试点 -> adopted/improving/rejected`
   - 每个机会只有一个 `research_id`，由 `research/PIPELINE.yaml` 串联证据包、实验、论文/专利/开源、场景试点和反馈优化，避免研究、成果和产品各维护一套事实源
   - `authority_gate` 是发布论文、专利、公开数据/代码、产品默认能力，或扩展到新用户/病因/语言/设备/场景前的硬阻断；至少两个独立权威来源、独立复核、反证、边界、失败条件和回退缺一不可，否则只能 `internal_only` / `hold`
   - `research/FEEDBACK_REGISTRY.yaml` 将用户、沟通伙伴、临床专家、遥测和失败样本转为可证伪假设、责任 owner、动作、验证和关闭条件；反馈不再直接驱动 prompt、模型或产品改动
   - 已新增证据包、反馈条目、研究机会、场景试点、学术/IP 模板和 `scripts/check_research_harness.py`
   - 已验证：`python3 scripts/check_research_harness.py`、`bash scripts/check_research_system.sh`、`bash scripts/check_ai_docs.sh`

0. 2026-08-14 已建立精简的研究来源与专家雷达
   - `research/SOURCE_REGISTRY.yaml` 现在按五个主题各保留 3 个默认锚点，其他来源只按问题临时发现，不以堆链接代替研究质量
   - `research/SOURCE_ROUTING.md` 定义来源等级、主题路由、实时搜索/抓取/更新和证据回流规则；社媒、博客和博主只作 radar，重要结论必须回到论文、标准、官方文档、代码或机构页面
   - `speechhome.com` 已登记为语音/构音领域高相关但 `candidate_unverified` 的 discovery 来源；当前环境 DNS 无法解析，未把它当作已验证权威来源
   - `research/EXPERT_WATCHLIST.yaml` 收窄为少量可核验英文专家与中文专家按需检索入口，不批量维护未经核验的中外账号名单
   - `scripts/check_research_sources.py` 已接入研究检查，默认离线验证注册表结构；需要联网时显式运行 `--network`

0. 2026-08-14 Web / Mobile 沟通与练习页面职责已完成产品级拆分
   - Web：`/communicate` 是唯一沟通 surface，同页按需承接快速表达与日常沟通；`/practice` 只区分筛查与数据录入，`/assessment` 只做 20 词筛查，`/contribute` 只选数据录入主题，`/contribute/topic/[topicId]` 只做录音执行。
   - `/chat` 与 `/communicate/live` 已在 2026-08-16 物理删除；旧筛查 topic 仍仅做训练路径兼容，不承接新逻辑。
   - Mobile 保持四个一级 surface，不引入 WebView；练习任务路由只有 `practice_home / assessment / collection`。自定义材料属于 `collection` 内部来源，与公共题库并列，不是第三个产品页面。
   - Mobile 练习首页只有“20 词能力筛查 / 数据录入”两张主卡；数据录入页内部再选择“公共题库 / 自定义材料”，公共题库主题也在这一层选择。
   - 现役事实源未改变：沟通继续复用 RTC / LiveKit hooks，筛查与数据录入继续复用正式 catalog、原生 recorder queue、识别反馈和上传回执。
   - 验证：`frontend npm test`（16 files）、`npx tsc --noEmit`、`npm run build`；Playwright 390×844 首页和未登录 `/communicate / practice / assessment` 鉴权 next；Mobile `npm run check / typecheck / export:android / export:ios`；`bash scripts/check_ai_docs.sh`。

0. 2026-08-14 已统一研究系统并接入 `CLEAR-VOX-MODEL` 子仓库
   - `references/clear-vox-model` 已作为 Git submodule 固定到 `0997c0dc941ad0cda39e3ab92d5efd783fbfc38f`；上游模型代码、R&D、EXP、harness 与 Git 跟踪资产保持原始事实源
   - 应用侧研究统一到 `research/` 五主题：`voice-agent / agent-systems / speech-health / product-psychology / product-engineering`；新增 `agent-systems/` 研究通用 Agent 底层机制、工程架构、产品化和场景落地，并要求对语音 Agent 做跨模态对照；`docs/` 不再新增平级研究稿
   - 新增 `research/APPLICATION_FEEDBACK_REGISTRY.md`，以 `adopt / validate / hold / reject` 管理实验到应用的回流；首批登记已覆盖上游 EXP-16/17A/18D/21 与现有 memory、Voiceitt、康复研究
   - 两份分散的 Faster-Whisper / EverOS memory 摘要已合并为一份上下文与记忆综合，旧文件由 Git 历史保留；其余真实研究原文按主题迁移
   - `docs/README.md` 已清除不存在的历史文档入口，agent/AI 工程规则已同步，`scripts/check_research_system.sh` 已接入 AI docs harness
   - 主 submodule 的 6 个直接嵌套仓库可按固定 gitlink 使用；上游 `modules/dsr/Qwen3-ASR` gitlink `8ea1249` 已不在配置远程中；`Codec-DSR` 内部的 `Matcha-TTS` gitlink 缺 `.gitmodules` 映射。两项均记录在 `research/UPSTREAM_INTEGRATION_STATUS.md`，未擅自替换 commit 或猜测远程 URL

0. 2026-08-14 已收口 Playwright 临时产物与 Docker 安全清理策略
   - `.playwright-cli/` 和 `output/playwright/` 已加入 `.gitignore`；浏览器快照、console 记录和临时截图只作为当次验证证据，不再长期进入 Git。重要结论继续写入任务状态和测试回归，而不是依赖易失截图。
   - 已删除仓库中历史跟踪的 Playwright 快照与截图；这些文件仍可从旧 Git commit 恢复。
   - 按 `scripts/docker_disk_maintenance.sh status -> prune-safe` 执行定向清理，回收约 `697.7MB`；根盘从 `72%` 降到 `71%`，剩余约 `17GB`。
   - 运行容器、卷、`latest` 与 `pre-*` 回滚镜像均保留；未满 7 天的 `3.274GB` build cache 未强制删除。后续按月或磁盘超过 `75%` 时运行同一安全脚本，不使用 `docker system prune -af`。

0. 2026-08-13 Web 与 Mobile 的信息架构和响应式交互继续收口
   - Web 首页、沟通页、训练入口按“入口选择 -> 当前工作台 -> 训练回顾 / 沟通档案”分层；功能没有删除，只把低频说明、报告和匿名活动移出首屏主动作区。
   - Web 沟通页在从首页带入场景时不再重复渲染场景选择大卡；手机顶栏改为紧凑动作区，返回、短句、连接和账号控件保持可触达，账号入口触控区提升到 44px。
   - Web 训练首页明确拆成“20 词能力筛查”和“训练与收集”两个主任务；训练主题、自定义材料进入第二层；今日 / 7 天总结和匿名训练活动收进原生可访问的“训练回顾”折叠区。
   - Web 训练与首页移动布局补齐 `h-dvh`、`text-balance/text-pretty`、焦点环、44px 关键动作、窄屏换行和实体表面约束；去掉训练入口和启动态的背景渐变。
   - Mobile 档案编辑器去掉不必要的 non-null assertion；材料、画像、短句操作行在窄屏自动换行，避免组合按钮挤压。
   - 已验证：Web 71 项测试、`npx tsc --noEmit`、Next production build、Playwright 390x844 / 1440x900 首页截图、未登录 `/contribute` 跳转与 console smoke；Mobile check/typecheck。
   - 当前仍不能宣称 App 100% 替代 Web：必须补 Android/iOS 真机的登录、沟通 RTC、训练 RTC + 原生录音并行、最终转写、上传 / 撤回、TTS / 复制以及档案 CRUD smoke。

0. 2026-08-13 已纠正 Mobile Workbench“只有登录和页面壳、沟通/训练功能近乎为零”的产品与工程偏差
   - 根因确认：Web 长期承载完整产品逻辑，而 Mobile `0.1.x` 当时明确只是 V1 skeleton；App 虽能建 LiveKit room 和保存本机录音，但没有消费实时文本、confirmed output，也没有正式训练题库、筛查/训练分流和自动收集，因此不能视为 Web 一对一替代
   - 一对一映射口径收口为“同一业务能力、同一后端事实源、按设备优化交互”，不使用 WebView，也不要求像素级复制桌面布局
   - Mobile 沟通页已新增：沟通前场景选择、LiveKit user/assistant transcript、常用短句真正发送给 agent、可编辑确认输出、全屏给对方看、原生文本发声、复制；场景继续进入 RTC intent，不在实时工作台里堆主题卡
   - Mobile 训练页已拆成独立 `20 词能力筛查` 与 `训练收集`；新增 `/api/training/catalog` 直接复用 Web 正式 9 类/9,000+ 句语料，支持每次 120 条分页，录音带 sentence id/category/flow，停止后自动进入现役上传回执链，失败保留本地重试
   - Web 同步优化：沟通场景上移到首页进入前选择；已有场景进入沟通工作台后不再重复显示大块主题选择；训练首页把筛查从普通主题卡中移出，形成“能力筛查 / 训练与收集”两个清晰任务入口，并移除背景渐变
   - 防回退：Mobile 静态守卫已要求 `RoomEvent.DataReceived / assistant transcript / expo-speech / expo-clipboard / training catalog / training flow metadata`
   - 已验证：Web 71 项测试、TypeScript、production build；训练目录 `9` 类、筛查 `20/20`、现代文章分页 `4952 total / 120 page`；Playwright `390x844` 首页场景入口 smoke 与训练鉴权跳转；Mobile check、TypeScript、Android `913 modules / 5MB`、iOS `915 modules / 5MB` export
   - 尚未完成的 App/Web parity：训练实时识别与评分、20 词整组结果、训练日报/周报、自定义材料切句、上传撤回，以及沟通档案完整编辑；这些完成并通过 Android 真机登录/LiveKit/录音/朗读/复制 smoke 前，App 仍不能宣称完全替代 Web

0. 2026-08-13 Web 与 Mobile 前端用户提示已统一收口为简短产品文案
   - Web 与 Mobile 分别建立受控 `product-message` 转换层，后端、第三方 SDK、实时消息和异常对象的原始 `error / message / reason / code` 不再直接进入用户界面；Mobile 不跨目录导入 Next 模块
   - 登录 / 注册 / 短信 / 账号绑定 / 连接 / 麦克风 / 训练录音 / 上传 / 短语 / 记忆快照均迁移到白名单中文提示；默认一句话，只说明问题和下一步
   - 新增页面级与全局错误页；手机端沟通错误提示避开底部浏览器工具栏和安全区；准备状态页移除 Surface / Strategy / Capability 等技术细节
   - Mobile 登录、沟通连接、工作区同步、录音队列和上传均经过统一转换；服务异常不再显示测试包、构建、配置或服务地址等工程信息
   - `scripts/check_frontend_product_messages.sh` 已覆盖 Web 与 Mobile 并接入 `frontend npm test`，Mobile 自检也阻止原始信息回流
   - 已验证：Web product-message 回归 5 项、全量 71 项、`npx tsc --noEmit`、Next production build、Playwright 390×844 登录错误 smoke；Mobile check、TypeScript、Android 与 iOS production export

0. 2026-08-13 Android 官网下载与 App 包发布已收口为本站稳定直链和单一自动发布事务
   - 根因确认：生产下载页仍注入 Expo build 详情页 URL，Caddy 虽已有 `/download/android` 规则，但旧容器没有挂载 `releases/android`；页面文案“本站直下”与真实发布链漂移
   - 已生成并发布 Android `0.1.4`（build `5`），EAS build `9de8d084-f201-4817-8665-a11565eafbfc`，本站 APK 为 `114244777` bytes，SHA-256 `f29db506b74190f8b3c72cc05d991d74c31b390277527f01c60ab827a2faf4a4`
   - `https://voxember.com/download` 的 Android 按钮固定使用同域 `/download/android`，不再暴露或跳转 Expo；线上 APK 响应为 `200/206 + application/vnd.android.package-archive + attachment`，并禁用缓存
   - 新增 `npm run release:android:preview`：校验 Mobile、按最新 EAS build 递增版本、云构建、下载校验、原子替换、保留上一版、仅重建 Caddy、验证公网直链；`npm run sync:android:latest` 可在发布后半程中断时只同步最新成品，不重复云构建
   - App 包不会随源码保存自动变化；当前正确触发点是 Mobile 改动通过检查并进入 `main` 后执行上述发布事务。已安装 App 的 JS/资源 OTA 仍未启用，原生依赖、权限和 Expo SDK 变化始终必须重建 APK
   - 已验证：Mobile check/typecheck、EAS build、APK ZIP、版本 metadata、Caddy release mount、frontend 单服务生产构建/health、官网 HTML 无 Expo URL、APK Range 下载
   - GitHub Actions 自动发布代码已就绪：`main` 的 `apps/mobile-workbench/**` 变更会执行检查、EAS APK 构建、SHA/ZIP 校验和生产原子替换；生产 APK 已迁到 `/srv/voxflame/android`，Caddy 只读挂载该目录
   - 生产发布使用无 sudo 的 `voxflame-release` 专用账号，部署 key 被 SSH forced-command 限制为只接收 APK 与 metadata，不能执行任意服务器命令；受限 SSH 同版本重发与公网 Range 已实测通过
   - GitHub CLI 与 `production` environment secrets 已配置；手动 workflow、AI Guard 和 CodeQL 都在 runner 分配前被账户 billing lock 拦截，因此 `ANDROID_AUTO_RELEASE_ENABLED` 暂保持 `false`
   - 生产 fallback 已启用：`voxflame-android-main-sync.timer` 每 5 分钟从隔离 checkout 检查 `origin/main`，仅 Mobile/Android 发布代码变化时构建，按 commit 缓存 APK，并通过同一 forced-command SSH receiver 原子发布
   - fallback 首轮已完成 `0.1.4 (5)` 构建、ZIP/SHA 校验、发布和公网 Range 验证；紧随其后的同 SHA 检查正确 no-op。EAS CLI 配置目录权限问题也已修复进 systemd unit

0. 2026-08-12 腾讯云短信签名已完成报备，短信登录进入真实发送与端到端验收阶段
   - 签名管理已确认：ID `713027`，签名内容为“上海生声不息科技有限公司”，用途为验证码/通知，状态可用（正常），报备成功；营销用途仍未报备，不用于登录短信
   - 生产 backend 已保持 `PHONE_AUTH_ENABLED=1`、`TENCENT_SMS_DRY_RUN=0`，签名 `上海生声不息科技有限公司`、模板 `2702800`、SDK AppID `1401169029` 与报备记录一致
   - Web、Mobile 的手机号注册 / 登录仍使用 Supabase Phone Auth + HTTPS Send SMS Hook；注册 `shouldCreateUser=true`，登录 `false`，邮箱登录不受影响
   - 已补齐 Web 登录、账号绑定和 Mobile 的腾讯云签名/供应商错误中文提示，避免把底层英文错误直接暴露给用户
   - 已通过 backend SMS Hook 回归、backend build、frontend test/build、Mobile check/typecheck、AI docs harness
   - 当前只需用负责人手机号完成一条真实注册短信、验证码确认、退出后再次手机登录，并在 Android 预览包做同样 smoke；本环境无法直接访问生产 DNS / Docker socket，部署与真机需在生产机/设备侧执行

0. 2026-08-05 已完成沪浦网信安通〔2026〕267号正式整改报告与当日生产复测
   - 按通知附件 2 的三段式公文结构生成 A4 Word / PDF，法定代表人和网络安全主要负责人为邱生峰
   - 当日两套生产权限回归再次通过：五张用户数据表 anon 为 `401`，活动系统预设只读为 `200`，service role 正常
   - 当日公网 smoke：`/`、`/api/rtc/health` 为 `200`，未登录 workspace 为 `401`；生产容器正常
   - `test1@poc.com` 仍长期停用；当前 Auth 仍为公开注册、邮箱自动确认、未观察到 CAPTCHA 开启
   - 报告对外口径为“通报所述越权读取路径已完成技术整改并复测通过”，不声称日志尚不能证明的“绝无数据访问”
   - 后续计划依据现行《网络安全法》第二十三、第二十四、第二十七条，覆盖等保、六个月日志、漏洞闭环、密钥治理、注册安全、WAF/源站、数据分类、供应链和应急演练

0. 2026-08-01 Docker 部署与磁盘维护经验已写入工程 harness
   - `scripts/docker-rebuild-core-fast.sh` 新增 `env-backend / backend / frontend / core` 最小影响模式；环境变量更新不再先 `docker compose down`，只 recreate backend
   - `scripts/docker_disk_maintenance.sh prune-safe` 只清理 7 天前 dangling images 与 build cache，保留运行容器、卷、`latest` 和 `pre-*` 回滚镜像
   - 本次清理后根盘占用从 `87%` 降到 `65%`，可用空间从 `7.8GB` 增至 `21GB`；5 个生产容器继续运行，backend/frontend healthy，RTC health 为 `200`

0. 2026-07-30 已完成沪浦网信安通〔2026〕267号所述 Supabase 未授权读取问题的生产封堵
   - 整改记录：[docs/NETWORK_SECURITY_REMEDIATION_2026_267.md](/home/ubuntu/VoxFlame-Agent/docs/NETWORK_SECURITY_REMEDIATION_2026_267.md)
   - 生产 `user_profiles / sessions / memories / voice_contributions / quick_phrases` 已启用并强制 RLS，`anon / authenticated` 已撤销全部直接权限
   - `preset_phrases` 仅保留活动系统文案的匿名只读兼容策略，无公开写权限
   - `service_role` 仅保留 `SELECT / INSERT / UPDATE / DELETE`，无 `TRUNCATE`
   - 已撤销 public schema 新表、新序列默认授予浏览器角色的权限
   - 通知中的 `test1@poc.com` 已长期停用，业务表记录均为 `0`；负责人已明确决定保留 `2` 条 Auth session 供取证，不执行撤销
   - 前端已删除未使用的 Supabase 数据直连旧入口；后端不再把 service role 缺失降级成 anon key
   - 生产公网复测：五张用户数据表 anon 均为 `401`；系统预设只读为 `200`；service role 正常；站点与 `/api/rtc/health` 为 `200`；未登录 workspace 为 `401`
   - 已验证：`cd backend && npm run build`、`cd frontend && npm run build`、两套 Supabase 权限回归脚本
   - 负责人已选择保留公开注册，并要求启用邮箱验证、CAPTCHA 与速率限制；正式切换前需配置生产 SMTP、Turnstile site/secret key，补齐 Web 与 Mobile CAPTCHA 流程，并提供可用的 Supabase 管理权限
   - 当前生产仍为邮箱自动确认、未开启 CAPTCHA；现有 `SUPABASE_ACCESS_TOKEN` 访问 Management API 返回 `403`，为避免中断 Web / App 登录尚未强行切换

0. 2026-07-24 已交付 Mobile Workbench `0.1.0` 双平台可打包测试版与前端下载入口
   - `apps/mobile-workbench` 已从工程控制台式单页收成四个用户任务页：`沟通 / 练习 / 准备 / 我的`
   - 登录页与主界面已移除 `RTC strategy / Backend / Room / participant token / contract status` 等工程说明，只保留用户当前动作与就地错误
   - 沟通链路已对齐 backend `/api/rtc/session/start|ping|stop`；进入 LiveKit room 后每 25 秒保活，结束、切页或退出账户时显式停止后端 session
   - 练习页已从“只操作最新一条”升级为完整本机队列，可逐条回放、上传、重试和经系统确认后删除
   - 移动端 RTC response contract 已补齐 backend 现役 `resolved intent / readiness summary / strategy / graphName` 字段，静态守卫会同时核对 backend route 与关键 contract token
   - Android / iOS 已补对等 `export`、EAS development / preview build 命令，版本为 `0.1.0`，包名保持 `org.voxflame.mobileworkbench`，共享正式图标与麦克风权限说明
   - Web 首页已去除重复的新手说明和多层渐变，只保留主动作、三个任务入口和 App 内测入口
   - 新增公开 `/download` 页面；`NEXT_PUBLIC_ANDROID_APP_DOWNLOAD_URL` 接 APK/EAS/商店，`NEXT_PUBLIC_IOS_APP_DOWNLOAD_URL` 接 TestFlight/EAS/商店，未配置时明确显示“准备中”
   - 已验证：
   - `cd apps/mobile-workbench && npm run typecheck && npm run check`
   - `npx expo config --type public`
   - Android production Metro export：`898 modules / 4.9 MB Hermes bundle`
   - iOS production Metro export：`900 modules / 4.9 MB Hermes bundle`
   - `cd frontend && npm run build`，`/` 与 `/download` 均静态生成
   - `/download` HTTP smoke 返回 `200`，包含 Android、iPhone、准备中和隐私入口
   - 尚未完成：EAS/Apple 账户绑定、可安装 APK/TestFlight build、Android/iPhone 真机录音/上传/LiveKit smoke；Playwright 因当前机器 Chrome 启动 `SIGSEGV` 未生成截图
   - EAS 登录命令已修正：提供 executable 的 npm 包是 `eas-cli`，不是 `eas`；仓库统一使用 `npm run eas:login` 与 `npx --yes eas-cli@latest ...`
   - 当前服务器失效的 `HTTP_PROXY / HTTPS_PROXY` 会让 npm 下载卡住，且存在不安全的 `NODE_TLS_REJECT_UNAUTHORIZED`；所有 EAS 登录与构建脚本会自动 unset 这些变量
   - 已验证：`eas-cli/21.1.0 linux-x64 node-v25.2.0` 可在服务器正常启动，错误的 `npx eas ...` 已由移动端守卫禁止回流
   - VS Code / SSH 下 browser login 的 OAuth callback 会错误落到开发者电脑的 `localhost:<random-port>`；`npm run eas:login` 已固定使用 `--no-browser` 终端登录
   - Expo 账户已通过 Personal Access Token 验证为 `qiud`，并拥有 `qiud / qiuds-team` Owner 权限；App owner 已固定为 `qiuds-team`
   - 新增 `npm run eas:configure`：在当前终端持有 `EXPO_TOKEN` 时自动创建/绑定团队 EAS 项目，并从现有前端配置读取 Supabase 公共值，将其与 `https://voxember.com/api` 同步到 development/preview/production；不会读取或上传服务端 secrets
   - EAS 长期认证已改为项目外凭据文件：根目录运行 `npm run eas:save-token` 后隐藏写入 `~/.config/voxflame/expo-token`（目录 `700`、文件 `600`），后续 EAS/Android/iOS 构建命令跨终端与服务器重启自动读取；根目录也已补齐 Android/iOS preview 构建入口
   - Android preview APK 已构建成功：`50814787-79bf-44aa-a8d5-1bb0296aa59a`；首次失败由 AsyncStorage `3.0.2` 的不存在 Maven 依赖导致，已按 Expo SDK 55 兼容矩阵锁定到 `2.2.0` 并增加静态守卫，第二次 Gradle release 构建通过
   - Android 权限已按能力矩阵修正：保留实时音频稳定性与蓝牙耳机所需权限，Android 12+ 在开始沟通时按需申请 `BLUETOOTH_CONNECT`，相机与悬浮窗继续从最终 Manifest 移除
   - `https://voxember.com/download` 已部署 Android 开放内测入口；Dockerfile/Compose 已接通 Android/iOS 下载 URL build args，本次用 `sudo docker compose build/up frontend` 完成前端单服务重建，未重启 backend/LiveKit
   - 下一步：Android 真机安装并完成登录/档案同步/麦克风/录音回放/上传回执/LiveKit/蓝牙耳机 smoke；完成 iOS Apple 签名、EAS build 与 TestFlight/登记设备内测入口
   - iOS 最新 production Metro export 已通过（`902 modules / 4.9 MB`），并补齐 `ITSAppUsesNonExemptEncryption=false`；EAS preview 已验证公共环境加载正常，当前仅因首次 Apple signing credentials / internal distribution provisioning 无法在 token 非交互模式自动创建而停止

0. 2026-07-19 已把“音系强化”落成真实音系二级小组
   - 主分类仍为 `音系强化`，没有新增平级训练入口，也没有改变录音、RTC、评估或上传 schema
   - 二级小组为：`双唇与唇齿音 / 舌尖中音 / 舌根音 / 舌面音 / 平舌与翘舌音 / 前后鼻韵母 / 复韵母 / 声调与变调`，另保留“全部音系句”
   - [build-phonology-index.mjs](/home/ubuntu/VoxFlame-Agent/frontend/scripts/build-phonology-index.mjs) 使用本地 `pinyin-pro` 对清理后的 `2973` 条音系句离线建立声母、韵母、声调与变调索引，不依赖运行时外部服务
   - 声母 / 韵母小组至少命中 2 个目标音节；声调组只收四声覆盖、三声连读或“一 / 不”变调；一句可进入多个专项，但最多保留得分最高的 3 个小组
   - 没有命中专项的句子仍保留在“全部音系句”，不会为了分类数量把无关语料硬塞进某个小组
   - 训练页现在可切换小组并显示每句真实命中的音位重点；录音中和处理中禁止切换，避免当前句与录音状态错位
   - 当前索引覆盖 `2973/2973` 条；各专项数量为 `252 / 725 / 196 / 518 / 1445 / 2041 / 1472 / 2235`
   - 已验证：音系索引 4 项回归、前端 61 项测试、`npx tsc --noEmit`、Next 生产构建；浏览器未登录访问训练页按现有鉴权重定向到登录页

0. 2026-07-19 已完成训练区第一轮“只清真正严重污染”的逐句清理
   - 不再使用“固定清 500 条”或“低质量超过 20% 整源退出”的策略；WenetSpeech、AISHELL 等来源继续逐句评审，不因来源或题材整体退出
   - 清理边界只包括：明确色情、直接暴力 / 血腥残片、明确广告 / 考试站 / 订阅导流、确定的 ASR 重复 / 错误儿化 / 填充词污染和严重悬空句
   - 普通新闻、财经 / 地产、影视对话、有效医疗与求助表达明确保留；例如 `孕期减少性生活`、`乳房肿胀的疼痛可以通过冷敷` 不会因敏感词误删
   - [clean_generated_training_corpus.py](/home/ubuntu/VoxFlame-Agent/scripts/corpus/clean_generated_training_corpus.py) 以现有正式池为基线做最小差异清理，不补位、不重排未命中句
   - 正式生成池由 `8980` 条降为 `8776` 条，共逐句退出 `204` 条：`ASR 破损 152 / 广告导流 38 / 直接暴力 6 / 色情 5 / 严重悬空句 3`
   - 前端合并 curated 后总训练项为 `9112` 条，其中评估 `20`、非评估训练句 `9092`，仍保持 `8000+`
   - 完整逐句审计见 [mandarin-training-real.cleanup-audit.json](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/generated/mandarin-training-real.cleanup-audit.json)，当前严重规则残留扫描为 `0`
   - 已新增 Python 回归，前端语料测试也增加严重污染拦截与正常医疗表达保留断言
   - 已验证：
   - `python3 -m unittest scripts.corpus.test_export_frontend_source_corpus`（4 项通过）
   - `cd frontend && npm test -- src/lib/corpus/mandarin-training-data/index.test.ts`（实际 58 项全部通过）
   - `cd frontend && npx tsc --noEmit`

0. 2026-07-15 已完成普通话训练语料重构到 7-18 字、8000+ 条
   - 已删除前端训练分类里的 `文言文节奏`，新增 `会议与协作`、`车载与导航`、`音系强化`
   - [export_frontend_source_corpus.py](/home/ubuntu/VoxFlame-Agent/scripts/corpus/export_frontend_source_corpus.py) 已支持 AISHELL-1 spaced transcript、AISHELL-3 `汉字 拼音` content、AISHELL-4 TextGrid、WenetSpeech id-prefixed transcript 的本地解析；WenetSpeech 解析按行流式处理，完整 `text.fix` 到位后可直接重刷
   - 最终生成池 [mandarin-training-real.json](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/generated/mandarin-training-real.json) 为 `8980` 条：`现代文章朗读 5000 / 会议与协作 900 / 车载与导航 80 / 音系强化 3000`
   - 前端合并 curated 与 generated 后总训练项为 `9316` 条，其中 `评估筛查 20`、非评估训练句 `9296` 条；当前生成来源不再使用 Tatoeba / 翻译例句
   - 生成规则已收紧为：只收 `7-18` 个可见汉字，拒绝 ASCII/数字、网页 UI 噪声、古文/旧式语料、敏感新闻/政治/宗教/暴力/影视点歌/POI 片段、悬空虚词开头结尾、全局重复和高频近重复结构
   - [index.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/mandarin-training-data/index.ts) 已在前端合并层做全局 target text 去重，避免 curated 与 generated 跨分区重复
   - [training-topic-route.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-topic-route.ts) 和 [training-scenes.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-scenes.ts) 已接入新增分区
   - [README.md](/home/ubuntu/VoxFlame-Agent/scripts/corpus/README.md) 已更新新的来源分层、导出命令和“音系强化不用古文、不模板造句”的口径
   - 已验证：
   - `python3 -m py_compile scripts/corpus/export_frontend_source_corpus.py`
   - `cd frontend && npm test -- src/lib/corpus/mandarin-training-data/index.test.ts`，实际按当前 npm script 跑了 `55` 个前端测试，全部通过
   - `cd frontend && npx tsc --noEmit`
   - `bash scripts/check_ai_docs.sh`

0. 2026-07-14 已修复 `backend/scripts/manage_users.js` 中硬编码 Supabase service role key 的问题
   - 该脚本现在通过 `dotenv` 从 `backend/.env` 读取 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ROLE_KEY`
   - 源码中的固定 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 常量已删除，避免把管理密钥留在仓库里
   - 已验证：`node backend/scripts/manage_users.js`

0. 2026-07-08 已完成 WAIC / 公安检查前的 Web 服务器侧安全收口，并完成 EdgeOne/WAF 待切 NS 前配置
   - 文档：[docs/WAIC_SECURITY_CHECKLIST_2026-07-08.md](/home/ubuntu/VoxFlame-Agent/docs/WAIC_SECURITY_CHECKLIST_2026-07-08.md)
   - 服务器运行态已实测：`3000`、`3001`、`8081` 均只监听 `127.0.0.1`；公网只保留 Caddy `80/443`、SSH `22` 和 LiveKit `7880/7881`
   - `livekit_agent/app.py` 已把 LiveKit Agents SDK 的健康 HTTP 服务绑定到 `127.0.0.1`；当前容器也已热补 `/app/app.py` 并重启，`curl http://127.0.0.1:8081/` 返回 `OK`
   - 线上 `curl -I --noproxy '*' https://voxember.com` 已确认安全头存在，且不再看到 `X-Powered-By: Next.js / Express`
   - EdgeOne 当前配置：ZoneId `zone-3sacn5q6g224`，加速域名 `voxember.com`，DomainId `edge-3sacy37kmnbh`，CNAME `voxember.com.eo.dnse2.com`，源站 `111.230.35.89`，HTTPS 回源，回源 Host `voxember.com`
   - EdgeOne DNS 当前为根域 CNAME enabled，根域 A/CAA disabled；这是为了让切 NS 后走 EdgeOne 加速/WAF，避免继续直连源站。DNSPod 侧 CAA 仍存在，但切 NS 后根域同名 CNAME 与 CAA 不能共存
   - EdgeOne 安全策略已配置为 WAF 托管规则拦截：`ManagedRules.Enabled=on`、`DetectionOnly=off`、`wafgroup-free Action=Deny`；CC/DDoS、WebSocket、HTTPS 强跳、HSTS 已开启。Bot 当前仍是 off，不应作为已完成证据
   - 当前阻塞项：权威 NS 仍是 `eleven.dnspod.net`、`rich.dnspod.net`，公网 A 仍解析到 `111.230.35.89`；CAM 子账号缺腾讯云 Domain 权限，无法代改注册商 NS。需要用户在腾讯云域名控制台把 NS 改为 `ns1.qeodns.com`、`ns2.qeodns.com`
   - NS 生效后再继续：启用 EdgeOne HTTPS 证书，验证 EdgeOne 响应头，定位源站实例 / Lighthouse 防火墙并限制源站直连

0. 2026-06-28 的单账号 HTTP ASR 试接已于 2026-08-24 被统一账户网关取代
   - 旧的应用侧账号白名单和单账号部署方式已删除，不再作为维护或扩容入口。
   - 现役契约见本文件顶部“个性化 ASR 统一账户网关”；所有已认证账户统一进入 8001，由模型服务决定个性化或公共 fallback。

0. 2026-06-14 已重新拉取 2026-05-24 之后的 OSS 训练数据增量
   - 使用脚本 [download_oss_by_account.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/download_oss_by_account.ts) 按 `--since 2026-05-24T00:00:00+08:00` 拉取，不覆盖旧目录
   - 输出目录：[artifacts/oss-by-account-after-20260524-refresh-20260614](/home/ubuntu/VoxFlame-Agent/artifacts/oss-by-account-after-20260524-refresh-20260614)
   - dry-run 与真实下载结果一致：`objects=720`、`listed=1216`、`bytes=221.6 MB`；本地目录体积约 `225M`
   - 账号分布：`2187054680__0983a35e` 517 个对象、`2307294809__64758dee` 195 个对象、`2440571672__77cab18e` 8 个对象
   - `_objects.jsonl` 共 `720` 行；匹配对象 lastModified 范围为 `2026-05-31T03:22:41.000Z` 到 `2026-06-14T06:20:53.000Z`
   - 已验证：`wc -l`、`du -sh`、账号目录枚举、`_objects.jsonl` 时间范围与账号计数

0. 2026-06-14 已把自定义材料训练语料切分规则收口到“10-20 字优先、标点边界优先、全文不丢”
   - 后端 [prepared-expression.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/prepared-expression.service.ts) 生成结构化 prepared expression 时不再只取前 12 段；所有材料段落都会进入 sections
   - 后端和前端训练页都统一为 10-20 字目标长度；特别常用或剩余短句可保留，不为凑长度强行拼错上下文
   - 带标点或自然停顿的句子优先在开头 / 标点边界收口，不再为了长度把一句话中间硬断开；只有无标点超长文本才按 20 字左右硬切
   - 前端 [prepared-expression-practice.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/prepared-expression-practice.ts) 继续用 `document_content` 全量生成训练 exercises，保证训练页可练句拼回去等于原材料全文
   - 新增 [prepared-expression.service.test.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/prepared-expression.service.test.ts) 和更新 [prepared-expression-practice.test.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/prepared-expression-practice.test.ts) 覆盖全文不丢、无标点长句硬切和 section metadata 保留
   - 当时的单账号私有 ASR 部署状态已失效；现役统一账户网关状态见本文件顶部。
   - 已验证：
   - `cd frontend && npm run build`
   - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --experimental-strip-types -e "import('./src/lib/training/prepared-expression-practice.test.ts').catch((error) => { console.error(error); process.exit(1); })"`
   - `cd backend && ./node_modules/.bin/ts-node src/services/prepared-expression.service.test.ts`
   - `cd backend && npm run build`
   - `bash scripts/check_ai_docs.sh`

0. 2026-06-05 已定位并修复沟通页录音 / 录音结束后出现大面积空白的问题
   - 最终根因：`ChatInterface` 自动滚动使用 `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`，录音、实时转写和 assistant streaming 更新时会触发该 effect；浏览器可能滚动 document/body 而不是只滚动消息面板，导致 footer/input 区被滚到视口中部，下面露出大块空白
   - 之前把问题归到波形组件过大 / fixed overlay 只是局部表象；真正要修的是滚动容器和页面高度状态机
   - [ChatInterface](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已把消息框自动滚动改为 `messagesScrollRef.current.scrollTop = scrollHeight`；文字流会随实时转写贴底滚动，但只滚消息 `main`，不再调用 `scrollIntoView` 或滚动 document/body
   - 沟通页外层已锁成 `h-dvh overflow-hidden`，主列 `min-h-0 flex-1 flex-col`，header/footer `shrink-0`，消息区 `min-h-0 flex-1 overflow-y-auto`，只允许消息区滚动
   - 进入沟通页期间会把 `html/body` 的 `overflow` 临时锁为 `hidden`，离开沟通页时恢复，确保输入栏以下没有任何可滚动空白区域
   - 进入沟通页时会重置 `window.scrollTo({ top: 0, left: 0 })`，避免从首页或旧状态带入 document scroll
   - 录音时消息流保留实时转写文字气泡；footer 内已恢复收音波形展示，波形只作为输入区上方轻量状态条，不再作为消息内容或页面滚动驱动
   - 第一轮把波形放回消息内容里的方案已回收；当前复用 `WaveformVisualizer`，但只作为 footer 收音状态条的一部分，不参与消息流高度
   - 已验证：`cd frontend && npm run build`
   - Playwright 打开本地 `http://127.0.0.1:3220/?mode=communicate` 时按现有鉴权跳转登录页，未登录浏览器无法直接做录音 UI smoke；代码层已确认 `scrollIntoView / messagesEndRef` 均已移除

0. 2026-05-30 已清理 `oss-by-account-after-20260524` 对应的云端 OSS 对象
   - 已把 [artifacts/oss-by-account-after-20260524](/home/ubuntu/VoxFlame-Agent/artifacts/oss-by-account-after-20260524) 加入 `.gitignore`
   - 新增 [delete_oss_objects_from_manifest.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/delete_oss_objects_from_manifest.ts)，从 `_objects.jsonl` 精确读取 `objectName`，默认 dry-run，`--write` 才删除
   - 本次删除范围：`voxflame / oss-cn-shanghai` 中 `artifacts/oss-by-account-after-20260524/_objects.jsonl` 列出的 `1258` 个对象
   - 删除结果：`deletedCount=1258`、`missingCount=0`、`failedCount=0`
   - 删除后复查：`cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts --dry-run --since 2026-05-24T03:24:01.898Z` 返回 `objects=0`
   - 本次没有删除本地 artifact、压缩包、Supabase 账号或数据库记录

0. 2026-05-26 已修复移动端训练录音“不能整理成标准 WAV”的兼容问题
   - 根因：训练页本地保存录音原先使用 `MediaRecorder` 产出 `audio/webm` / `audio/mp4`，上传前再用 `AudioContext.decodeAudioData` 解码并转成 16k mono WAV；部分移动端内置浏览器 / WebView 会录出自己无法解码的 blob，导致上传前转 WAV 失败
   - 新增 [local-pcm-wav-recorder.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/audio/local-pcm-wav-recorder.ts)，训练页本地录音现在直接从麦克风轨道走 WebAudio PCM 收集并写标准 WAV
   - [useMandarinTrainingSession](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 已从 `MediaRecorder` 本地保存改为 `LocalPcmWavRecorder`，实时 ASR 仍走原 LiveKit 链路
   - 上传前 `normalizeRecordingToWav` 会直接复用 `audio/wav + 16k + mono`，不再触发移动端浏览器解码 mp4/webm
   - 新增 [local-pcm-wav-recorder.test.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/audio/local-pcm-wav-recorder.test.ts)，验证 WAV header 和 normalize 复用路径
   - 已验证：
   - `cd frontend && npm test -- src/lib/audio/local-pcm-wav-recorder.test.ts`
   - `cd frontend && npm run build`

0. 2026-05-26 已完成沟通页 confirmed output 本机输出 v0
   - [ChatInterface](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 新增“确认输出”缓冲区，自动承接最新 assistant final transcript，也允许用户手动改写
   - 同一段确认文本现在可以：
   - 给对方看：打开大字展示层
   - 面对面反转：展示层内一键 180 度反转
   - 文本发声：使用浏览器本机 `speechSynthesis` 朗读
   - 听写复制：一键复制到剪贴板，供第三方应用粘贴
   - 每次展示 / 复制 / 朗读会写入当前 session metadata 的 `latestConfirmedOutput*` 字段，先记录动作，不把文本另写长期记忆
   - 硬件外放本轮先不接伪接口；等真正做硬件时再决定走 BLE、串口、局域网、系统音频路由或厂商 SDK
   - 已验证：
   - `cd frontend && npm run build`
   - 已按用户要求直接拉取 Playwright CLI，不再起本地 dev server；`bash /home/ubuntu/.codex/skills/playwright/scripts/playwright_cli.sh --help` 正常输出
   - 浏览器交互 smoke 待接入现成运行地址或用户本机已有服务后再跑

0. 2026-05-26 已完成 P0：训练总结退出长期记忆和沟通默认上下文
   - [backend/src/services/supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 已移除 `training_summaries` object zone、`training_summary` communication loadout section，以及训练总结对 `preparation` 的默认注入
   - `buildPreparationSnapshot` 现在不再把训练报告写入 `immediate_goal / support_strategies / risky_terms / pronunciation_patterns / training_pairs`
   - `session_review` 不再用训练复盘兜底，只保留最近非训练沟通会话复盘
   - [frontend/src/lib/memory/workspace-snapshot.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/memory/workspace-snapshot.ts) 已删除 `training_summary` / `training_summaries` 长期对象类型
   - [frontend/src/components/chat/ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已删除“用户画像和训练总结默认进入上下文”的文案与计数逻辑
   - [frontend/src/app/memory/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/memory/page.tsx) 已移除记忆页训练总结区；训练报告仍留在训练页、dataset review 和未来专家复核材料里
   - 已验证：
   - `cd backend && npm run build`
   - `cd frontend && npm run build`
   - `bash scripts/check_ai_docs.sh`
   - 下一步顺序：进入沟通页 confirmed output 呈现层，让同一个沟通转写 agent 的结果输出到给对方看、文本发声、复制 / 第三方粘贴；硬件外放等实际接口选型后再接

0. 2026-05-26 已按当前代码现状重写产品 PRD 和分病因疗法映射文档
   - [产品 PRD](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 已删掉已完成历史计划，改成当前代码事实 + 下一步执行计划
   - [分病因疗法锚点文档](/home/ubuntu/VoxFlame-Agent/research/speech-health/VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md) 已删掉大而全病因清单，保留正式疗法 / 理论锚点、专家边界和产品化顺序
   - 当前代码深度盘点结论：
   - 沟通页已有 LiveKit 主链、表达工具箱、starter kit、workspace loadout、字幕辅助和麦克风输入反馈
   - 训练页已拆为 `/contribute` 主题选择和 `/contribute/topic/[topicId]` 录音训练，支持评估筛查、自定义材料切句、上传 metadata、病因标签和质量信息
   - 记忆页已有用户画像、场景模板、多份自定义材料库和 active material
   - TTS 只有 runtime 代播能力；沟通页本机输出 v0 已补 `confirmed output -> 大字展示 / 面对面反转 / 本机朗读 / 复制`
   - 语音转文本、给对方看、文本发声都不应拆独立 agent；当前缺口从“没有 confirmed output 层”收窄为“还没有硬件外放接口和更完整的保存 / 第三方接入状态流”
   - P1：
   - 沟通页补 confirmed output 呈现层：同一个沟通转写 agent 的结果已经可以给对方看、文本发声、复制到第三方；硬件输出待接口选型
   - 第一句话 / 破冰材料库不要继续按人工句库扩展，应升级为沟通转写 agent 的第一轮协议：让对方知道怎么听、保护用户表达权、建立补救规则，并给每条句子补 `intent / partner_instruction / fallback_output / scene_fit / theory_basis`
   - P2：
   - 增强沟通页内高频输出出口；即使后续增加快捷入口，底层仍进入沟通页 / 沟通转写 agent，不新增第二条主链

0. 2026-05-25 已把 ICP 备案信息挂到 Web 首页底部
   - 根据腾讯云备案通过信息，网站备案 / 许可证编号为 `沪ICP备2026020229号`，审核通过日期为 `2026-05-14`
   - 新增首页底部备案展示，备案号链接到工信部备案首页 `https://beian.miit.gov.cn/`
   - 备案主体默认展示为 `上海生声不息科技有限公司`
   - 前端 Docker build args、Next build-time env 和 `.env.example` 已补齐 `NEXT_PUBLIC_ICP_BEIAN_*` 配置
   - 已把 `.env` 的正式入口切到 `https://voxember.com`，并把 frontend metadata 默认域名从旧 `ranyan.app` 切到 `voxember.com`
   - 新增 [set_dnspod_voxember_record.cjs](/home/ubuntu/VoxFlame-Agent/scripts/ops/set_dnspod_voxember_record.cjs)，读取本机 `.env.dnspod` 中的腾讯云 CAM 子用户密钥，创建 / 更新 DNSPod `voxember.com @ A -> 111.230.35.89`
   - 已通过 DNSPod 创建根域名 A 记录，记录 id 为 `2299420650`
   - 已重启 `caddy` HTTPS profile，Caddy 日志确认 Let's Encrypt `http-01` 验证通过并成功获取 `voxember.com` 证书
   - 已验证：
   - `dig +short @1.1.1.1 voxember.com A` -> `111.230.35.89`
   - `curl -I --noproxy '*' https://voxember.com` -> `HTTP/2 200`
   - `curl -I --noproxy '*' https://voxember.com/api/rtc/health` -> `HTTP/2 200`
   - Headless Chrome hydration 后确认首页底部展示 `上海生声不息科技有限公司`、`沪ICP备2026020229号` 和工信部链接

0. 2026-05-24 已下载并整理 `2307294809@qq.com` 与 `3083029019@qq.com` 的训练语料
   - Supabase 复查：`230729489@qq.com` 不存在；按真实账号 `2307294809@qq.com` 合并处理
   - `2307294809@qq.com` userId：`64758dee-5026-4b53-a063-1d02d0834f67`
   - `3083029019@qq.com` userId：`3368b1cb-8014-4502-8b4d-6011c17371ce`
   - 已用 `cd backend && npm run download:oss-by-account -- --output-dir ../artifacts/oss-by-account` 刷新 OSS 本地下载；当前远端清单：`2307294809__64758dee` `237` 个对象，`3083029019__3368b1cb` `80` 个对象
   - 新增 [prepare_training_corpus_artifact.py](/home/ubuntu/VoxFlame-Agent/scripts/audio/prepare_training_corpus_artifact.py)，从当前 `_objects.jsonl` 取指定账号，跳过 `manifest.jsonl`，输出 raw 与 trimmed 两套语料
   - 已输出到 [artifacts/training-corpus-20260524](/home/ubuntu/VoxFlame-Agent/artifacts/training-corpus-20260524)
   - raw：`313` 条音频 + `2` 个 `transcripts.txt`，没有 `manifest.jsonl`
   - trimmed：`313` 条 WAV；按 `>500ms` 静默段裁剪，长静默段保留约 `120ms` 缓冲；共检测并处理 `320` 段长静默，累计裁掉约 `293.24s`
   - 已额外生成 `2307294809` 全量本地缓存审计包：[2307294809-all-merged](/home/ubuntu/VoxFlame-Agent/artifacts/training-corpus-20260524/2307294809-all-merged)，合并本地缓存 WAV `519` 条；其中只有当前 manifest/transcripts/DB 可验证目标文本的 `235` 条可直接用于训练，另外 `284` 条是 2026-04-29 本地历史缓存残留，当前 OSS 远端清单、`dataset/<userId>/transcripts.txt` 和 `voice_contributions` 均已找不到对应 target
   - 已生成可训练的目标-音频强对应包：[2307294809-target-audio-verified](/home/ubuntu/VoxFlame-Agent/artifacts/training-corpus-20260524/2307294809-target-audio-verified)，包含 `235` 条 raw WAV、`235` 条 trimmed WAV、`metadata.jsonl` `235` 行、`errors.json` 为空；分类为 `人群与角色 142 / 发音与朗读 35 / 看病与求助 12 / 现代文章朗读 46`
   - 已验证：
   - `node backend/scripts/manage_users.js find 230729489@qq.com`
   - `node backend/scripts/manage_users.js find 2307294809@qq.com`
   - `node backend/scripts/manage_users.js find 3083029019@qq.com`
   - `cd backend && npm run download:oss-by-account -- --output-dir ../artifacts/oss-by-account`
   - `python3 scripts/audio/prepare_training_corpus_artifact.py --objects-jsonl artifacts/oss-by-account/_objects.jsonl --output-dir artifacts/training-corpus-20260524 --account-label 2307294809__64758dee --account-label 3083029019__3368b1cb`
   - `python3 -m py_compile scripts/audio/prepare_training_corpus_artifact.py`
   - `cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts --dry-run --prefix supervised/mandarin/`
   - `cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts --dry-run --prefix dataset/64758dee-5026-4b53-a063-1d02d0834f67/`
   - `cd backend && ./node_modules/.bin/ts-node scripts/export_dataset_review_report.ts --email 2307294809@qq.com --limit 1000 --output-dir ../artifacts/dataset-review-20260524/2307294809`

0. 2026-05-22 已把原 `发音与朗读` 拆成 `现代文章朗读` 和 `文言文节奏`，并统一清洗为简体中文
   - `scripts/corpus/export_frontend_source_corpus.py` 已改为优先使用 OpenCC `t2s` 繁转简；没有安装 `opencc-python-reimplemented` 时才退回脚本内置兜底表
   - `现代文章朗读` 只接普通话水平测试现代白话朗读作品这类来源，作为默认朗读入口；`文言文节奏` 单独保留《出师表》《木兰诗》《兰亭集序》等进阶声律材料
   - 已重新生成 [frontend/src/lib/corpus/generated/mandarin-training-real.json](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/generated/mandarin-training-real.json)，当前分类计数：`日常与出行 360 / 看病与求助 23 / 人群与角色 140 / 设备与数字 96 / 现代文章朗读 560 / 文言文节奏 240`
   - 已新增前端 corpus 测试，拦截训练目标句里的繁体 / 旧字形，并拦截现代文章池里的网页 / 培训站噪声
   - 已验证：
   - `python3 scripts/corpus/export_frontend_source_corpus.py ...`
   - `cd frontend && npm test -- src/lib/corpus/mandarin-training-data/index.test.ts`
   - `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`
   - `bash scripts/check_ai_docs.sh`

0. 2026-05-22 已给现有实用分类补充专业精选语料
   - 在 [frontend/src/lib/corpus/mandarin-training-data/curated-topics.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/mandarin-training-data/curated-topics.ts) 补充重点旅客 / 无障碍出行、急救与康复就医、照护 / 窗口 / 课堂角色、实时语音 / 字幕 / 辅助功能设备操作等短句
   - 不直接把网页正文灌进前端；高风险场景先按官方 / 高可信来源的业务语义抽象成短、清楚、可录音的目标句
   - 当前 curated 计数：`日常与出行 104 / 看病与求助 85 / 人群与角色 107 / 设备与数字 178`
   - 已验证：
   - `cd frontend && npm test -- src/lib/corpus/mandarin-training-data/index.test.ts`
   - `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`
   - `bash scripts/check_ai_docs.sh`

0. 2026-05-21 已继续收紧训练页 transcript 绑定，针对“前两句对、后面又错配”的残余竞态
   - 进一步把训练录音结果锁到 `client_capture_id` 维度，避免后续录音复用上一轮的 interim / bestObserved
   - `livekit_agent` 对“没有稳定语音的 manual_stop”不再把 capture 塞进 final transcript 队列，避免后续 final transcript 被整体错位
   - 已验证：
   - `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`
   - `cd frontend && npm test -- src/lib/training/final-transcript.test.ts src/lib/realtime-audio/session-runtime.test.ts`
   - `python3 -m unittest livekit_agent.tests.test_asr_runtime`

0. 2026-05-20 已清空 `2307294809@qq.com` 的上传语料
   - 账号 userId：`64758dee-5026-4b53-a063-1d02d0834f67`
   - 新增 [backend/scripts/clear_uploaded_training_corpus.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/clear_uploaded_training_corpus.ts)，默认 dry-run；只有带 `--write` 时才执行删除
   - 本次只清空上传语料，不删除 Supabase Auth 账号，不清空记忆 / workspace / prepared expression
   - 删除范围：
   - `voice_contributions` 中该用户上传训练记录 `317` 条
   - OSS 中该用户上传语料对象 `319` 个，包括 `317` 个音频对象、`dataset/<userId>/manifest.jsonl`、`dataset/<userId>/transcripts.txt`
   - 清空后复查：`voiceContributionCount=0`、`ossObjectCount=0`、删除失败 `0`
   - 已验证：
   - `cd backend && npm run clear:uploaded-training-corpus -- --email 2307294809@qq.com`
   - `cd backend && npm run clear:uploaded-training-corpus -- --email 2307294809@qq.com --write`
   - `cd backend && npx tsc --noEmit --skipLibCheck --esModuleInterop --module commonjs --target ES2020 --moduleResolution node scripts/clear_uploaded_training_corpus.ts`

0. 2026-05-20 已完成对话页 / 训练页降噪 P0 调参
   - 已按 LiveKit 2026 官方策略判断：当前 self-host 路线先保留 WebRTC 基础降噪和 agent APM/VAD；Krisp / ai-coustics 作为 P1 增强，不在本次 P0 引入依赖
   - `livekit_agent` 默认 VAD 阈值从 `0.018` 提到 `0.032`
   - VAD silence finalize 从 `720ms` 提到 `860ms`
   - barge-in 最短语音从 `220ms` 提到 `360ms`
   - 新增 `QWEN_ASR_MIN_COMMIT_SPEECH_MS=420`，避免短促噪声 / 空音频 manual stop 继续提交 ASR
   - 新增短 filler transcript 过滤：普通沟通模式过滤 `嗯 / 呃 / 啊 / 哦 / 喔 / 额 / 唔 / 哼`；训练短词 / 筛查模式不启用该误杀风险较高的过滤
   - 已验证：
   - `python3 -m unittest discover livekit_agent/tests`
   - `python3 -m py_compile livekit_agent/config.py livekit_agent/asr_runtime.py livekit_agent/data_contract.py livekit_agent/app.py`

0. 2026-05-20 已修复 Web 训练页 transcript 串条与空音频 commit 报错
   - 根因：上一条 ASR final transcript 可能晚到，被下一条训练录音当成“系统听到”消费，导致页面看起来总显示上一句
   - 前端现在每次训练录音生成 `client_capture_id`，只接受同一 capture 的 final transcript；没有可信 final 时不再用旧 interim/bestObserved 兜底保存
   - `livekit_agent` 会把 `client_capture_id` 从 `speech_activity` 透传到 user transcript payload
   - 对无稳定语音的 manual stop，`livekit_agent` 不再提交 ASR audio buffer，避免 `Error committing input audio buffer...` 冒成红色错误
   - Docker 日志确认撤回链路本身成功：backend 出现 `[Upload] Discarded ...`；截图红错来自 ASR commit，不是撤回接口
   - 已验证：
   - `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`
   - `cd frontend && npm test -- src/lib/realtime-audio/session-actions.test.ts src/lib/realtime-audio/session-runtime.test.ts src/lib/training/final-transcript.test.ts`
   - `python3 -m unittest livekit_agent.tests.test_data_contract livekit_agent.tests.test_asr_runtime`

0. 2026-05-16 已新增 restsend 作者合作价值与硬件音频桥研究文档
   - 新增 [restsend Rust 通信栈与硬件音频桥研究（2026-05-16）](/home/ubuntu/VoxFlame-Agent/research/speech-health/VOXFLAME_RESTSEND_RUST_STACK_AND_HARDWARE_AUDIO_BRIDGE_RESEARCH_2026-05-16.md)
   - 文档基于 Context7 和 GitHub 公开资料分析 `rustpbx / rsipstack / rustrtc / audio-codec`：这位作者更像 VoxFlame 未来 `SIP / PBX / RTP / WebRTC / audio codec` 通信网关层合作者，而不是第一版 ESP32-S3 固件外包
   - 核心判断：restsend 栈最适合 P2/P3 的电话 / 医院分机 / 远程随访 / SIP trunk / WebRTC-SIP bridge / 音频转码 / 通话录音接入；当前 P0/P1 硬件仍应以 Mobile Workbench + 现成麦克风/音箱 + ESP32-S3 音频外设为主
   - 硬件形态判断收口为 `耳挂式近口麦克风 + 挂脖 / 胸前扬声器盒 + 手机 App brain`；胸针更适合按钮/状态/扬声器，不适合作主麦；眼镜是高预算后期路线
   - ESP32-S3 定位明确为低成本音频桥和交互外设，负责 I2S mic、按钮、LED、小屏、本地提示音和短录音，不负责 LiveKit/WebRTC/SIP/LLM/ASR/TTS 主链
   - 已同步 [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)

0. 2026-05-15 已新增 Voiceitt 功能设置深度分析文档
   - 新增 [Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）](/home/ubuntu/VoxFlame-Agent/research/product-psychology/VOICEITT_FEATURE_SETTINGS_ANALYSIS_AND_VOXFLAME_INSPIRATION_2026-05-15.md)
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
   - 新增 [分病因言语康复与沟通产品化深度文档（2026-05-15）](/home/ubuntu/VoxFlame-Agent/research/speech-health/VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md)
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
   - 已更新 [App / Mobile Workbench 机会文档](/home/ubuntu/VoxFlame-Agent/research/product-engineering/VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)，加入“标准 / 技术 / 用户反馈闭环”章节，并明确每个 surface 的最小反馈信号
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
   - 新增并更新 [VoxFlame App / Mobile Workbench Best Practices And Opportunity（2026-05-04）](/home/ubuntu/VoxFlame-Agent/research/product-engineering/VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)
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
   - 新增 [VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md](/home/ubuntu/VoxFlame-Agent/research/product-engineering/VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md)
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

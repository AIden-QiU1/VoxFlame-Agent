# 当前任务状态

> 最后更新: 2026-07-15

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

0. 2026-06-28 已把 `2307294809@qq.com` 的沟通页与训练 / 评测页 ASR 路由接到 cpu1 本机 HTTP ASR 服务
   - 账号 userId：`64758dee-5026-4b53-a063-1d02d0834f67`
   - [livekit_agent/asr_runtime.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/asr_runtime.py) 的 `QWEN_HTTP_ASR_*` 命中范围已从仅 `communication` 放开到 `communication + training`，因此沟通页和训练评测页共用同一条账号级 HTTP ASR 路由
   - [docker-compose.yml](/home/ubuntu/VoxFlame-Agent/docker-compose.yml) 中 `livekit-agent` 改为 `network_mode: host`，默认 `QWEN_HTTP_ASR_URL=http://127.0.0.1:18000/transcribe`，默认 `QWEN_HTTP_ASR_USER_IDS=64758dee-5026-4b53-a063-1d02d0834f67`
   - 因为 `environment` 会覆盖 `livekit_agent/.env`，compose 默认白名单也必须保留该 userId；只改 `livekit_agent/.env` 不足以让容器命中账号路由
   - `backend` 默认 `LIVEKIT_AGENT_HEALTH_URL` 已改为 `http://host.docker.internal:8081/`，以便 backend 仍在 bridge 网络时检查 host-network 的 livekit-agent
   - 重启后本机 ASR health 一度返回 `{"status":"ok","backend":"transformers"}`，3 秒评估筛查 WAV 单次转写返回 `发扬`，成功样本耗时约 `0.639s` 和 `1.850s`
   - 但 `127.0.0.1:18000/transcribe` 连续请求测试出现过瞬时 `connection refused`，随后 `/health` 又恢复；这更像 ASR 服务自身的连续请求 / worker 稳定性问题，不是 VoxFlame 路由逻辑问题。HTTP ASR 失败时 livekit_agent 会按已有逻辑回退 DashScope realtime ASR
   - 已验证：`python3 -m unittest livekit_agent.tests.test_asr_runtime`、`docker compose config | rg -n "QWEN_HTTP_ASR|network_mode|LIVEKIT_AGENT_HEALTH_URL|LIVEKIT_URL"`、本机 `curl /health` 与单条 `/transcribe`

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
   - 当前运行中的 `livekit-agent` 容器里 `QWEN_HTTP_ASR_URL` 与 `QWEN_HTTP_ASR_USER_IDS` 均为空；`2307294809@qq.com` 对应 userId `64758dee-5026-4b53-a063-1d02d0834f67` 的私有 HTTP ASR 云部署路由当前没有启用
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
   - [分病因疗法锚点文档](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md) 已删掉大而全病因清单，保留正式疗法 / 理论锚点、专家边界和产品化顺序
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
   - 新增 [restsend Rust 通信栈与硬件音频桥研究（2026-05-16）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RESTSEND_RUST_STACK_AND_HARDWARE_AUDIO_BRIDGE_RESEARCH_2026-05-16.md)
   - 文档基于 Context7 和 GitHub 公开资料分析 `rustpbx / rsipstack / rustrtc / audio-codec`：这位作者更像 VoxFlame 未来 `SIP / PBX / RTP / WebRTC / audio codec` 通信网关层合作者，而不是第一版 ESP32-S3 固件外包
   - 核心判断：restsend 栈最适合 P2/P3 的电话 / 医院分机 / 远程随访 / SIP trunk / WebRTC-SIP bridge / 音频转码 / 通话录音接入；当前 P0/P1 硬件仍应以 Mobile Workbench + 现成麦克风/音箱 + ESP32-S3 音频外设为主
   - 硬件形态判断收口为 `耳挂式近口麦克风 + 挂脖 / 胸前扬声器盒 + 手机 App brain`；胸针更适合按钮/状态/扬声器，不适合作主麦；眼镜是高预算后期路线
   - ESP32-S3 定位明确为低成本音频桥和交互外设，负责 I2S mic、按钮、LED、小屏、本地提示音和短录音，不负责 LiveKit/WebRTC/SIP/LLM/ASR/TTS 主链
   - 已同步 [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)

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

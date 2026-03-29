# 当前任务状态

> 最后更新: 2026-03-29
>
> 维护约定：
> 1. 这里只保留当前主链状态、最近 3 天的有效结论、下一步优先级和最近仍有意义的验证结果。
> 2. 原始命令行、容器步骤、临时排障细节不长期保留；结论稳定后统一压成摘要。
> 3. 超过 3 天的动态进展默认转入正式文档，不继续堆在这里。

## 当前主链

- 运行时唯一事实源已经切到 `Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`
- backend 不再代理 `/ws/agent` 运行时 WebSocket；TEN 默认也不再启动 websocket runtime
- 现役 TEN graph 为：
  `agora_rtc -> streamid_adapter -> voxflame_vad_python -> qwen_asr_realtime_python -> voxflame_main_python -> llm_correction_python -> qwen_tts_realtime_python`
- 后续架构讨论统一按 `Control / Execution / Memory / Capability / Surface` 五层进行
- `TEN + Agora` 当前仍是现役执行面，但后续应被视作过渡实现

## 最近 3 天有效结论

### 2026-03-28

1. 登录授权已前置到登录页，训练页不再重复做法律确认
   - [login/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/(auth)/login/page.tsx) 现在在登录/注册前默认确认《用户隐私》与《数据采集说明》
   - [legal-consent.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/auth/legal-consent.ts) 负责把授权记录同时写入本地与 Supabase 用户元数据，并为训练页提供统一读取
   - 训练页现在只读取授权状态，不再把授权 checkbox 留在主路径里；缺失记录时只会关闭“保存训练样本”入口并提示重新登录一次

2. 训练页已从“旧贡献历史页”重建成真正的训练工作台
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 现围绕 `录音 -> 训练 -> 反馈` 主路径组织，旧贡献历史和提交统计已退出主叙事
   - 页面主组织改为真实的 5 个录音分类：`日常与出行 / 看病与求助 / 人群与角色 / 设备与数字 / 发音与朗读`
   - 句子搜索、当前句切换、大录音区、即时反馈、训练资产状态、本地待同步队列和训练设置都已回到一个页面里

3. 数据采集与授权说明入口已补齐
   - [privacy/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/privacy/page.tsx) 与 [data-collection/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/data-collection/page.tsx) 已接入登录页
   - 数据采集说明页明确把训练数据链路收口到 `recording envelope -> recorder queue -> upload receipt -> manifest`
   - 上传链路仍沿用现有 `upload/sign -> upload/complete` contract，训练页只把它降到第二层叙事

4. 训练页当前验证状态已经比上一轮清楚
   - `frontend` 的 `npm run build` 已通过
   - `frontend` 的 `npm run lint` 仅剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) `react-hooks/exhaustive-deps` warning
   - 真实浏览器 smoke 已确认：登录页双授权可见；重新登录后训练页不再提示“需要重新登录一次才能保存样本”；训练页的 5 个分类、句子搜索和分类切换都能正常工作
   - 在当前 headless 环境里点击录音，会明确提示“当前设备未检测到可用麦克风”；真实 `录音 -> transcript -> feedback -> 保存训练样本 -> manifest` 端到端仍需在有物理麦克风的浏览器里补 smoke

### 2026-03-29

1. localhost:3000 白页问题已定位到真实代码漂移
   - 文档一直假设 `localhost` 会主动清理旧 `service worker / caches`
   - 但现役 [layout.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/layout.tsx) 之前只有在 `PWA 关闭` 时才挂 [LocalRuntimeReset.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/pwa/LocalRuntimeReset.tsx)
   - 与此同时 docker 默认使用 `VOXFLAME_ENABLE_PWA=1`，所以最容易受转发 localhost 污染的生产容器版前端，正好绕开了自愈逻辑

2. localhost 自愈链已经补齐并部署到运行中的 3000
   - [layout.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/layout.tsx) 现已新增 head 级 bootstrap，会在 `localhost / 127.0.0.1` 先清理旧 `service worker / caches` 再继续页面加载
   - [LocalRuntimeReset.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/pwa/LocalRuntimeReset.tsx) 已从 sticky `localStorage` 标记改成 `sessionStorage` 级别，避免后续 localhost 再次脏掉时不触发自愈
   - [usePWA.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/usePWA.ts) 现在会显式跳过 localhost 上的 SW 注册与安装提示
   - `sudo docker compose up -d --build frontend` 已执行完成，运行中的 `localhost:3000` 已是新版本

3. 这次“重启电脑后又好了”并不随机
   - 更像是重启顺手清掉了本机浏览器 / 端口转发环境里的旧 localhost 运行态
   - 这与本轮定位出来的 `forwarded localhost + stale SW/cache` 根因一致，不是代码无规律自愈

4. 训练页已开始针对用户指出的两个真问题收口
   - [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 现在会在停录时先发送 `speech_stopped + auto_finalize`，再短等一拍后调用 RTC `end_audio`
   - 同一个 hook 也不再把“第一个冒出来的短 final”直接当最终结果，而会等待更稳定、信息量更高的 transcript，并在必要时回退到本轮里观测到的更完整文本
   - 目标是缓解“我说了一整句，但前端最后只显示一个‘嗯’”这类 turn finalize / transcript 过早收口的问题

5. 反馈区已经贴近录音区
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 已移除录音前的大段说明首屏
   - 录后反馈卡现在直接放在右侧录音卡下方，停录后可在同一视区继续看 transcript、训练建议和资产状态
   - 真实 `localhost:3000/contribute` Playwright smoke 已确认反馈预览就在录音区旁边，不再被推到页面更下方

6. 训练样本保存主路径已从“手动按钮”收口到“停录即自动保存”
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 现在在 `登录授权已确认 + 录音 envelope 完整` 时会在停录后直接自动保存监督样本
   - 当前页面仍保留“重新保存这条训练样本”作为失败后的补救动作，但它不再是默认主路径
   - 自动保存失败时会继续回退到本地待同步队列，不会让录音资产静默丢失

7. 监督训练样本的标签 contract 已进一步写清
   - [useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts) 现在会显式传 `recognizedText`
   - [upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts) 与 [upload-artifact.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/upload-artifact.service.ts) 已把 manifest 收口成：目标句是监督标签，`recognized_text/raw_transcript` 只是反馈/诊断字段
   - 这一步对齐了用户的新判断：云端要稳定保存的是 `目标句 + 录音音频`，而不是把本轮 ASR 结果误当监督标签

8. 自动保存落地后的相关旧入口已继续清理
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 现在只在 `queued_locally / failed` 状态下保留“同步 / 重新保存”补救按钮
   - `auth_required` 已改成信息提示，不再伪装成可点击主操作
   - [data-collection/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/data-collection/page.tsx) 已补“登录同意后自动保存”“目标句和识别句怎么分”的正式说明

9. 训练资产后端这轮已补上“历史真样本可对账”和“DB 异常不静默丢样本”
   - [upload-artifact.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/upload-artifact.service.ts) 现在会优先保证 `manifest.jsonl` 落盘，并在缺 `upload_receipt` 时先检查 OSS，尽量不重复追加 `manifest / transcripts.txt`
   - 已新增 [reconcile_upload_artifacts.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/reconcile_upload_artifacts.ts) 与 `npm run reconcile:artifacts`
   - 当前环境里缺 `upload_receipt` 的 6 条真实训练样本已全部补齐到 `voice_contributions.metadata.upload_receipt + dataset/{user_id}/manifest.jsonl`

10. 训练 dataset 的去重规则已显式化
   - 同一句目标句不会直接被去重，允许保留多次练习样本
   - 只有同一条录音的重复上传 / 补传才会安全去重
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx)、[data-collection/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/data-collection/page.tsx)、[useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts) 与 [upload-artifact.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/upload-artifact.service.ts) 现在已经统一按这条 contract 工作

11. dataset 主文这轮已真正按现状清理，并继续推进到 review queue contract
   - [VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md) 已删掉一整段已完成的“建议新增 recording_id / manifest / structured upload”旧改造项，只保留当前实现对照和剩余行动项
   - 已新增 [training-sample-review.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-sample-review.ts)，上传后的样本 decision 现已收口成 `ready / sampled_for_review / retry_recommended`；只要音频完整，转录和目标句差很多也不会挡住上传，`recognized_text` 只影响反馈、复核和导出优先级
   - backend 已新增 [dataset-review.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/dataset-review.service.ts) 与 [upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts) 上的受认证 `GET/PATCH /api/upload/review-queue*`，继续补齐 `reviewed_at / reviewer / rejection_reason / accepted_for_export`
   - [list_dataset_review_queue.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/list_dataset_review_queue.ts) 与 `npm run review:queue` 已同步切到 `sampled_for_review / retry_recommended` 语义；当前在线脚本验证被 Supabase DNS `EAI_AGAIN` 挡住，等网络恢复后还需补一次真实队列读取

12. 训练主路径这轮继续按“反馈服务用户，数据治理留后台”收口
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 已把主反馈区里的“样本质量 / 复核状态”降成次级数据备注
   - 页面现在会明确告诉用户：只要录音完整就会继续上传；这些字段只影响后续整理、复核和导出，不影响数据入链
   - 训练页的主反馈仍然围绕发声动作、发音差异和下一步怎么练来组织，不把 review/export 语气放到主位

13. dataset 导出与复核层已补第一版 export manifest
   - backend 已新增 [dataset-export.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/dataset-export.service.ts) 与 [export_dataset_manifest.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/export_dataset_manifest.ts)
   - `npm run export:manifest -- --limit 1` 已可正常生成统一字段语言的 export manifest
   - 当前结果为 0 条，不是脚本没通，而是库里还没有被人工标记为 `accepted_for_export=true` 的样本

14. review/export 回写链已补默认 dry-run 入口
   - backend 已新增 [mark_dataset_review_decision.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/mark_dataset_review_decision.ts)
   - `npm run review:mark -- --help` 已可正常展示脚本入口；默认只预览 payload，只有显式 `--write` 才会改真实样本数据
   - 这让后续可以在不破坏现有样本的前提下先把 `accepted_for_export / reviewer / reviewed_at / rejection_reason` 的回写路径走通

15. 训练反馈这轮继续往“发声教练”收口
   - [mandarin-feedback.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/mandarin-feedback.ts) 现在会优先生成更简单的嘴巴动作、舌位、气息和节奏建议
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 里的反馈卡标题也已改成更偏教练语言，不再把主反馈写得像拼音纠错器

16. 文档主线这轮已按“多端可复用产品”重新收口
   - [VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md) 现已明确：数据面只需要做到 `录音事实 / 样本治理 / 导出复核 / memory-safe 聚合` 四层，就够支撑训练、复核、画像和多端复用
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 现已把下一阶段判断收口成三条并行基础线：`runtime/surface/control`、`memory/agent tooling`、`dataset/review/export`
   - [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md) 已吸收产品运行时层的 control/capability 关键内容；[control-plane.md](/home/ubuntu/VoxFlame-Agent/docs/control-plane.md) 退回 backend 控制面实现深文档；[capability-registry.md](/home/ubuntu/VoxFlame-Agent/docs/capability-registry.md) 退回仓库协作 capability 盘点表

### 2026-03-26

1. `Expression Kit` 的场景排序已经从前端局部逻辑下沉到 backend contract
   - [expression-kit.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/expression-kit.service.ts) 已新增，backend 现在正式拥有 `scene-aware personalized phrase` 排序能力
   - [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 的 `getWorkspaceMemorySnapshot()` 现支持 `sceneId`
   - [memory.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/memory.controller.ts) 现支持 `GET /api/memory/workspace/:userId?scene=...`
   - `workspace.expression_kit` 现会返回 `active_scene_id`，前端不再需要保留第二套主排序逻辑

2. 沟通页的 `workspace` 取数已更收口
   - [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已去掉重复的 `workspace` 拉取实现
   - 场景变化时，现在会显式带 `scene` 参数重新拉取 backend 聚合结果
   - `CommunicationPreferenceCard` 保存后，也会按当前 starter 场景刷新同一份 `workspace` snapshot

3. 前端死代码已清掉一层
   - 之前临时加的 [frontend/src/lib/communication/expression-kit.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/communication/expression-kit.ts) 已删除
   - 现在 `Expression Kit` 主排序事实源回到 backend，前端只负责展示和交互

4. `workspace` 已从“沟通页内部状态”升级成前端共享能力
   - 已新增 [useWorkspaceMemorySnapshot.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useWorkspaceMemorySnapshot.ts) 和 [workspace-snapshot.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/memory/workspace-snapshot.ts)
   - 沟通页与记忆页现在共用同一份 `profile_bundle / session_review / expression_kit` 类型和取数逻辑
   - 这一步把 `workspace` 从“某个页面的临时聚合结果”继续推进成前端正式 contract

5. 记忆页已经开始从“统计页”收口成“准备页”
   - [memory/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/memory/page.tsx) 已新增场景化准备区，可按 `面试 / 工作 / 医疗 / 陌生人 / 家人 / 紧急` 查看同一份 `workspace` 在不同场景下的表达建议
   - 现在沟通档案页会直接显示最近一次沟通复盘、当前最值得记住的画像项和按场景重排后的个体化表达建议
   - 这使“沟通工作台 -> 沟通档案”第一次拥有了真正连续的数据流，而不是两个各自拼装的页面

6. 前端 API 默认值已继续收口到同源 `/api`
   - [config.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/config.ts) 现在默认优先走 Next 同源 `/api` rewrite，而不是依赖浏览器能直接访问 `:3001`
   - 这一步是为 VSCode / SSH 转发、本地浏览器和远端容器环境统一访问路径，减少“前端能打开但 API 访问漂移”的环境噪音

7. 训练页上传链路已开始从“能上传”收口到“可训练资产骨架”
   - [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 现在返回正式 `recording envelope`，带 `recording_id / session_id / mode / source_surface / collection_mode / duration_ms / sample_rate / file_size_bytes`
   - [useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts) 现在会把这些字段强制带入上传 metadata，并按 `recording_id` 组织 supervised / weak-supervision 路径
   - 已新增 [recorder-queue.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/recording/recorder-queue.ts)，本地降级不再把录音塞进临时 `localStorage` 数组，而是用 IndexedDB 维护 `recorder queue`
   - [upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts) 现在除了兼容 `transcripts.txt`，还会追加 `dataset/{user_id}/manifest.jsonl`
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 已开始把“本地待同步录音”显式展示出来，帮助用户知道录音没有丢
   - [upload-artifact.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/upload-artifact.service.ts) 现已接管 `upload/complete` 的资产落盘逻辑：会按 `contributor_id + audio_path` 尽量复用已有 contribution，并依据 `upload_receipt` 避免重试时重复追加 manifest

8. 训练页这轮已继续从“采集页”收口成“场景化练习工作台”
   - 已新增 [training-scenes.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-scenes.ts)，把 `求职 / 工作协作 / 陌生人开口 / 就医 / 家人照护 / 紧急求助` 映射到当前训练句库
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 现在会按训练场景拉同一份 `workspace` snapshot，显示最近沟通复盘、值得记住的画像项和当前建议 focus
   - 训练页现在不再只让用户“选句库”，而是让用户先选择“下一次想准备的真实场景”，再切到对应类别开始练

9. 训练资产状态这轮已收紧到“说真话”
   - [useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts) 现返回结构化 `UploadResult / UploadReceipt`，显式区分 `uploaded` 与 `queued_locally`
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 现在会显示 `训练资产状态` 卡片，明确展示 `recording_id / session_id / consent_scope / manifest`
   - “仅保存在本地待同步”的录音不再被误记成“已上传训练样本”，训练画像和累计统计只会吃真正进了云端 manifest 的样本
   - 这轮进一步把 IndexedDB `recorder queue` 从“只有数量”收口成“每条录音都有状态”：已新增 `syncStatus / syncAttempts / lastAttemptAt / lastError`，训练页可直接看到哪条录音仍在本机、上次同步有没有成功、已经重试了几次

10. 本地 `localhost / Edge` 白屏这轮已先做架构级止血
   - 已确认服务端 HTML、静态 chunk 和正常 Chromium 浏览器都能完整加载，问题更像本机浏览器环境而不是前端进程挂掉
   - 构建产物里原本存在 `next-pwa` 注入的 `swe-worker / workbox` bootstrap；这对本地容器测试面不是必须能力，却会放大浏览器环境噪音
   - [frontend/next.config.js](/home/ubuntu/VoxFlame-Agent/frontend/next.config.js)、[frontend/src/app/layout.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/layout.tsx)、[docker-compose.yml](/home/ubuntu/VoxFlame-Agent/docker-compose.yml) 现在以 `VOXFLAME_ENABLE_PWA` 作为显式开关，现役容器默认开启；如需排查本地缓存或 SW 干扰，再临时切回 `0`

11. 沟通页已收掉“固定三句话”这类不实用的主位表单
   - [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 不再在沟通主路径里展示 `CommunicationPreferenceCard`
   - 现役主位改成“场景优先的个体化表达建议”，并明确告诉用户“下面这些句子可以直接点、会直接代播”
   - 后续个人表达编辑应继续向 `表达工具箱 / 沟通档案 / scene-aware expression kit` 收口，而不是回到硬编码的三栏偏好表单

12. dataset 容器日志这轮已收口到“能看懂幂等”
   - [upload.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/upload.controller.ts) 现在会在 artifact persistence 完成后再打印上传日志，而不是在落盘前就提前打印 `Complete`
   - 日志会显式带出 `reusedContribution / manifestAlreadySynced / transcriptAlreadySynced`，方便区分“正常重试命中幂等”和“真实重复写入”
   - 当前 docker 日志里虽然还能看到 `manifest.jsonl / transcripts.txt` 的 append position retry，但暂时没有看到因此导致的 dataset 主链失败；dataset 线可以继续退到次主线，不再阻塞 runtime/surface

13. runtime / surface 控制面第一版 contract 已经落地
   - [rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts) 现已支持 `surface / mode / sessionStrategy / requestedCapabilities / scene / deviceContext` 组成的 `SessionIntent`
   - `/api/rtc/session/start` 返回里新增 `intent / readiness`，`/api/rtc/health` 也会暴露 `controlPlane` 能力矩阵，不再只是 `mode + graph + timeout`
   - 当前 `light_voice` 仍是预留 contract，控制面会显式回退到 `heavy_realtime`；这一步的目标是先统一语言，而不是现在就替换 Agora/TEN 执行面
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 已改为按 surface 构造 session intent，并把 `session_intent / session_readiness` 透传到 TEN `system_init`
   - [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 与 [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 现已显式声明各自 surface；[voxflame_main_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py) 也已开始记录 `session_intent + granted_capabilities`

14. `useRtcAgentSession` 已开始真正拆薄
   - 新增 [session-bootstrap.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-bootstrap.ts)，把 `start/ping/stop` 和授权 header 从 hook 中抽出
   - 新增 [session-state.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-state.ts) 与 [session-types.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-types.ts)，把共享 runtime types 和一批状态纯函数从 hook 中抽出
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 当前仍是 orchestration owner，但已不再自己同时承载全部 bootstrap API、共享类型和大段状态拼装
   - `frontend` 的 `npm run lint` 与 `npm run build` 已通过；当前仍只剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) warning

15. transport adapter 已从 session hook 中独立出来，并补了真实容器 smoke
   - 已新增 [agora-transport.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/agora-transport.ts)，把 Agora RTC/RTM 的 `join / subscribe / remote audio play / logout / leave` 从 [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 中抽出
   - `frontend` 的 `npm run lint` 与 `npm run build` 继续通过，且已执行 `sudo docker compose up -d --build frontend`
   - Playwright 已用真实登录态确认：沟通工作台可成功连接助手、进入 `已连接` 状态、点句即代播；TEN 日志已看到带 `surface=communication_workspace` 和 `session_strategy=heavy_realtime` 的 session payload
   - Playwright 也已确认：训练工作台在当前 headless 无物理麦克风环境里点击录音，会明确提示“当前设备未检测到可用麦克风”，而不是静默失败
   - 当前仅新增一条非阻塞残余观察：沟通会话断开后，TEN 仍会打印一次 `Failed to find destination of a 'data' message 'clarity_score' from graph`，后续可在 runtime/execution 收口时一起处理

16. `useRtcAgentSession` 已继续收口成更明确的 orchestration owner
   - 已新增 [session-runtime.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-runtime.ts)，统一承接 `start/stop/ping`、RTM control publish、chunked inbound envelope 解码、connect/disconnect orchestration 和 transport 建链
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 当前只保留 React state owner、麦克风资源生命周期、录音/发文本这些用户动作入口，文件已从 487 行继续压到 336 行
   - 这轮顺手清掉了 hook 顶部已经失效的麦克风常量和新的 hook dependency warning；`frontend` 的 `npm run lint` 现在再次只剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) warning
   - `frontend` 的 `npm run build` 已通过；`sudo docker compose up -d --build frontend` 后，Playwright 已确认 `/?mode=communicate&starter=medical` 会成功触发 `POST /api/rtc/session/start`，并进入 `已连接 / 已经准备好 / 可以直接说话` 状态
   - 当前仍可见一条非阻塞 Agora 浏览器 warning：`WebSocket ... closed before the connection is established`，但没有影响本轮 RTC/RTM 建链与页面连接态

17. `useRtcAgentSession` 的用户动作层已从 hook 中继续下沉
   - 已新增 [session-actions.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-actions.ts)，统一承接 `startRecording / stopRecording / sendText / clearMessages / getMicrophone*` 这组 UI-facing command
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 现在更接近 “refs + state + orchestration wiring”，文件长度从 336 行继续压到 329 行
   - `frontend` 的 `npm run lint` 继续只剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) warning；`frontend` 的 `npm run build` 通过
   - 重新 `sudo docker compose up -d --build frontend` 后，Playwright 已再次确认沟通页点击“连接助手”可正常进入 `已连接 / 已经准备好沟通 / 可以直接说话`，网络面继续能看到 `POST /api/rtc/session/start => 200`
   - 当前主 hook 里仍然保留的较重部分主要是 `refs` 组装、`connect/disconnect` wiring 和 `memoryService.init`；下一刀可以考虑把 refs/owner scaffolding 再压一层，但不必为了“更少行数”牺牲可读性

### 2026-03-25

1. 已把“创始人即用户”的一手研究正式吸收进当前产品判断
   - 当前最关键的高压场景已明确为：`求职 / 面试`、`工作协作`、`医疗沟通`、`陌生人求助`
   - 真实痛点不只是识别错误，还包括被打断、被催促、被忽视和被替代发言
   - 后续页面和功能必须优先降低这种社交压力，而不是先展示系统说明

2. 首页已开始从“说明性页面”收口成“高压场景优先的任务入口”
   - [HomeDashboard.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/home/HomeDashboard.tsx) 现已围绕 `先开口 / 补救 / 准备` 重排首屏结构
   - 首屏新增高压场景卡、用户主导说明和更清晰的三个工作台入口
   - 首页文案已不再围绕模型、功能介绍和抽象承诺来组织

3. UI 视觉规范断链已补齐
   - [design-language.md](/home/ubuntu/VoxFlame-Agent/docs/aiprompts/design-language.md) 已创建，后续页面改版不再依赖口头约定
   - 根 [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) 中“界面改动先看视觉规范”的入口现在有效

4. 已新增创始人协作节奏文档
   - [FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md) 已定义“继续开发 + 补短阅读 + 一起讨论产品/技术判断”的默认节奏
   - 后续较深技术研究完成后，默认还要给出 1 本经典书 / 2-3 篇官方文档 / 1 个关键仓库的短阅读入口

5. 已补 localhost / VSCode 转发白屏保护
   - [usePWA.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/usePWA.ts) 现在会在 `localhost / 127.0.0.1` 下禁用并清理旧 service worker / caches
   - 目标是避免 VSCode 端口转发复用旧的 `localhost` PWA 缓存，出现“端口通了但白屏”的情况
   - [useAuth.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useAuth.ts) 现已补 3 秒初始化超时兜底；即使本地浏览器访问 Supabase 卡住，首页也会先以游客态渲染，而不是一直停在准备态
   - 这层兜底现已收口成“首页 `timeoutBehavior = guest`，受保护页面继续严格 auth”，避免慢网时把已登录用户误判成游客并错误踢去登录页
   - `useAuth` 现已正确处理 `INITIAL_SESSION`，不会因为初始会话事件被忽略而丢失真实登录态

6. 个体化表达建议已开始按 starter 场景重排
   - 这一阶段最初用前端本地排序做过渡，基于 `面试 / 工作 / 医疗 / 陌生人 / 家人 / 紧急` 对表达建议做了 starter 场景偏置
   - [CommunicationStarterKit.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationStarterKit.tsx) 现会把当前选中的场景同步给父层
   - [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 现会按当前 starter 场景优先显示更贴近的个体化短语，并把页头文案里的“进展与记忆”统一回“沟通档案”
   - 这层排序已在 03-26 正式下沉到 backend，不再保留前端独立事实源

### 2026-03-24

1. 已把 `VoxFlame` 重构协作方式收成正式手册  
   [VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md)
   - 研究默认在 `/home/ubuntu`
   - 开发默认在 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent)
   - `gstack` 更适合流程型工作
   - `superpowers` 更适合工程纪律

2. 已把语音 agent、memory、tooling 的研究判断收成综合参考文档  
   [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
   - `openclaw` 式 typed tools 更适合作为语音 agent 内核
   - `deerflow` 式 workflow / subagent / sandbox 更适合作为外环协作能力
   - 后续应坚持：`实时能力做 tool，长期方法做 skill，重任务编排做 workflow，跨系统接入做 MCP`

3. 已吸收 `lime` 的 AGENTS 文件体系经验  
   - 根 `AGENTS.md` 只保留仓库级规则、文档入口和高频路由
   - 长流程继续下沉到 `docs/`
   - `Context7` 前置成专业文档检索默认入口
   - `Playwright` 前置成浏览器验证默认入口

4. 已补充记忆机制研究，并在后续收口成综合参考  
   [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
   - `openclaw` 代表本地文件事实源
   - `memU` 代表 typed memory 与 `resource -> item -> category`
   - `supermemory` 代表 service-first 的 profile/context bundle

5. 已把 `docs/aiprompts/` 作为 task-oriented workflow 文档入口开始建立  
   - 目标是继续把根 `AGENTS.md` 变成短入口，而不是继续膨胀

6. 已新增 `skill/tool` 路由主文  
   [SKILL_ROUTING_GUIDE.md](/home/ubuntu/VoxFlame-Agent/docs/aiprompts/SKILL_ROUTING_GUIDE.md)
   - `gstack / 工程纪律 skill / 设计专项 skill / Context7 / Playwright / Linear` 已有统一路由说明
   - 根 `AGENTS.md` 已继续瘦身

7. 已新增产品主文与重整执行计划  
   [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)  
   - 当前产品定义正式收口为：`主动沟通助手 + 练习工作台 + 沟通档案`
   - 旧 `reset / strategy / roadmap` 产品主文档与历史执行归档已被新 PRD 与当前任务入口吸收并退出现役维护
   - 下一轮开发优先级被重排为：`沟通工作台 -> 练习工作台 -> 沟通档案 -> 轻入口/复盘`

8. 已完成一轮更贴近代码的现状复核  
   - [CommunicationStarterKit.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationStarterKit.tsx) 已有实现，但 [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 主路径仍是 `chat-first + right quick phrases panel`
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 同时承担 session bootstrap、RTM 路由、字幕聚合、voice profile sync 和本地 memory session 管理，已接近“第二控制面”
   - 用户长期状态当前分散在 [memory-service.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/memory/memory-service.ts)、[supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 和 [memory_layer_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/memory_layer_python/extension.py)，但 backend 仍缺正式 `profile bundle / session review` 读模型
   - [voxflame_main_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py) 已同时处理 transport relay、typed text、training result、voice profile relay 与 session state，近期不应继续堆产品语义

9. 已补做一轮协作系统收口
   - [AI_ENGINEERING_SYSTEM.md](/home/ubuntu/VoxFlame-Agent/docs/AI_ENGINEERING_SYSTEM.md) 已补入“先本地，后官方；先文档，后联网；先验证，后结论”的工具升级梯度
   - [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) 已补容器验证里的 `docker compose -> sudo docker compose` 环境化回退规则
   - 协作系统现在明确要求：重复出现的坑点、命令和验证方式要继续吸收到规则、模板或脚本；旧说明被吸收后要及时清理；稳定结论要同步到状态入口

10. 已完成沟通工作台第一阶段首屏改造
   - [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已从 `chat-first + side phrases panel` 收成 `starter kit + live session + expression kit drawer`
   - [CommunicationStarterKit.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationStarterKit.tsx) 已正式接入沟通页主首屏，成为“先把第一句话说出去”的主入口
   - `QuickPhrasesPanel` 已降级为右侧 `表达工具箱` 抽屉，不再主导首屏
   - 已新增 `starter phrase -> connect({ suppressGreeting: true }) -> sendText()` 的实际链路，真实浏览器里已验证可自动连接并代播

11. 已完成沟通工作台第二阶段最小 backend contract
   - backend 新增 [workspace 聚合读模型](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts)，统一输出 `profile_bundle / session_review / expression_kit`
   - 新接口 [memory/workspace/:userId](/home/ubuntu/VoxFlame-Agent/backend/src/index.ts) 已接入
   - [ChatInterface.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/ChatInterface.tsx) 已开始消费该接口，在首屏展示“个体化表达建议 + 最近一次沟通复盘”
   - [user-nav.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/ui/user-nav.tsx) 已去掉不存在的 `/avatars/01.png` 默认图，控制台 404 已消失
   - 未登录态下的 `workspace` 提前请求也已收口，不再制造无意义 401

12. 已完成“我的沟通偏好”最小功能闭环
   - [CommunicationPreferenceCard.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationPreferenceCard.tsx) 已新增，可保存“开场白 / 节奏偏好 / 没听清时怎么办”
   - [agent.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/agent.controller.ts) 已补 `preferences` 深合并，避免覆盖其他 profile 偏好
   - [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 已把沟通偏好并入 `workspace` 聚合与个体化表达建议
   - Playwright 已确认：保存后这三句会立即出现在首屏 `个体化表达建议` 区

13. 已把“用户功能先研究人、固定功能先查技术文档”写入协作系统
   - [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) 已新增用户功能与固定功能的研究门槛
   - [AI_ENGINEERING_SYSTEM.md](/home/ubuntu/VoxFlame-Agent/docs/AI_ENGINEERING_SYSTEM.md) 已补“用户研究输入默认处理方式”
   - [USER_RESEARCH_HANDOFF_TEMPLATE.md](/home/ubuntu/VoxFlame-Agent/docs/aiprompts/USER_RESEARCH_HANDOFF_TEMPLATE.md) 已新增，后续可直接用来接你给的一手调研数据

14. 已把用户研究进一步收成“创始人即用户”模式
   - 当仓库拥有者本人就是目标用户时，默认优先研究他的真实任务、失败瞬间、情绪成本、补救动作和成功样本
   - 这类输入不再被当作“普通主观看法”，而是产品第一手核心研究材料

12. 训练页已修掉“场景和标准句错位”的初始化 bug，并把中段改成可直接选句
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 现在默认按 `DEFAULT_TRAINING_SCENE_ID -> primaryCategory -> first exercise` 初始化，不再出现“页面显示求职 / 面试，但标准句仍是‘我想和朋友说话’”的错位
   - 训练页中段现已改成 `场景 -> 固定语料分类 -> 可点击句子列表 -> 当前标准句`，点句子会直接切换右侧录音目标句，不再让用户先读一大块说明文
   - Playwright 已确认：默认进入 `/contribute` 时，`求职 / 面试` 会对齐到 `人群与角色` 句库；点击“老师即时作答”等句子后，右侧标准句会同步切换

13. 训练页录音启动链路已补一层麦克风预热
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 现在会在首次录音前先做 `warmUpMicrophoneStream()`，先把真实麦克风流拿稳，再继续 RTC 训练会话和音轨发布
   - 这一步是为了把训练页的录音启动顺序拉得更接近沟通页，减少“训练页比沟通页更容易报泛化麦克风错误”的情况
   - 训练页当前也会区分“权限已给出，但训练页没拿到麦克风流”和普通权限未开启，避免继续把真实初始化问题都说成用户没授权

14. 训练页第一屏已进一步收口成真正的主流程
   - [contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 顶部那层“左边大段解释 + 右边辅助卡”的首屏已删除
   - 页面现在一进来就直接是 `训练场景 -> 固定语料分类 -> 可点击句子列表 -> 当前标准句 -> 录音`
   - 辅助性内容如“练习更容易坚持的方式 / 中文资源 / 背景设置 / 上传与本地待同步队列”已统一下沉到页面底部的 `更多设置与资源`
   - 训练分类已对齐成固定语料类：`全部语料 / 日常与出行 / 看病与求助 / 人群与角色 / 设备与数字 / 发音与朗读`

15. 训练录音链路已收掉“本地录音一失败就整段断开”的行为
   - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 现在会暴露真实的麦克风 `MediaStream`
   - [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 本地录音会优先复用这条真实麦克风流，而不是只依赖 Agora track 包装层
   - 如果本地 `MediaRecorder` 初始化失败，训练页现在会先收掉录音尝试，而不是立刻把整个 RTC 训练会话断掉；这一步是为了解决“建立连接完了就结束了”的体验问题
   - 目前 `lint / build / docker rebuild` 已通过；真实物理麦克风下的最终 smoke 还需要继续在你的浏览器里确认

16. 已定位并修掉训练页“会话刚建立就自己断掉”的一个真实生命周期 bug
   - 根因不在麦克风权限，而在训练页的卸载清理逻辑：[contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 原先用 `useEffect(..., [disconnect])` 注册清理函数
   - 与此同时，[useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 的 `disconnect` 又会随着 `sessionId` 变化重建；一旦 RTC 建连成功、`sessionId` 更新，React 就会先执行上一次 effect cleanup，把刚连上的训练会话自己断掉
   - 现在页面只会在真正 unmount 时才调用最新的 `disconnect`，不再因为 callback identity 变化提前清会话
   - 同时 `sessionId` 已改走 `sessionIdRef`，让 `stopLocalRecording` / `disconnect` 不再随着会话 ID 改变而重建

17. 当前验证基线已同步到这轮训练页修复
   - `frontend` 的 `npm run build` 已通过
   - `frontend` 的 `npm run lint` 仍只剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) warning
   - `backend` 的 `npm run build` 已通过
   - `sudo docker compose up -d --build backend frontend` 已执行，运行中的 `localhost:3000` 和 `:3001` 已是本轮训练页 / 上传链代码
   - Playwright 已确认 `/contribute` 现在首屏直接进入 `选句 + 录音 + 贴近录音的反馈区`，并已显示“录完后如果登录授权已确认，这里会告诉你它是否已自动落盘”
   - 用户已补充说明：真实前端录音 smoke 已做过，相关记录可在 docker / 后端链路里继续追踪；当前 headless 环境仍无物理麦克风，因此这里没有重复伪造真实录音样本
   - 这轮补做的文案与补救分支清理已再次通过 `frontend` 的 `npm run lint` 与 `npm run build`

### 2026-03-23

1. 已把 runtime / surface 的多份仓库分析稿收口成综合参考  
   [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)

2. 已把控制面与能力治理收成正式文档  
   [control-plane.md](/home/ubuntu/VoxFlame-Agent/docs/control-plane.md)
   [capability-registry.md](/home/ubuntu/VoxFlame-Agent/docs/capability-registry.md)

3. 已完成 Agora 替换研究，并在后续吸收到 runtime 综合参考  
   [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)
   - `agents / LiveKit` 更适合作为下一代 realtime execution plane 候选
   - `vixio` 更适合作为 transport/provider/session 抽象方法来源

4. 已把训练数据 schema 与 recorder pipeline 收成正式实施文档  
   [VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
   - `dataset` 与 `memory` 必须继续分层

5. 已把 `light voice surface` 收成 runtime 综合参考中的正式概念  
   [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)

### 2026-03-22

- 没有新增长期文档；这一天主要被吸收到 03-23/03-24 的正式收口中。

## 当前现役状态

- RTC + RTM 主链已闭环，沟通页不再依赖旧 websocket transport
- 首页已开始按 founder-user 高压场景重排，不再只做产品介绍
- 训练页已能按需拉起 `voxtrain_*` worker，并在无麦克风环境里受控失败
- Qwen realtime 的供应商可用性已经通过 live smoke 验证
- 训练数据与记忆分层的方向已经明确，但 `memory bundle / profile bundle / session review` 还未完全产品化
- 沟通页首屏已切到 `starter kit` 主导，但 `expression kit / personalized recommendation / memory bundle` 仍未完全统一
- `workspace` 现在已经被沟通页和记忆页共用，但训练页和首页摘要还没接进来
- backend 已是控制面雏形，但 frontend session hook 和 TEN main extension 仍承担了过多产品编排责任
- 文档主线已收口成三份主参考：`PRD`、`Runtime And Surface Reference`、`Agent Memory And Tooling Reference`

## 当前重点

1. 收口沟通工作台
   - 继续把 `starter phrases / quick phrases / memory recommendation` 收成同一个 `Expression Kit`
   - 让个体化表达建议从“已可保存的三句话”继续长成更完整的 personalized phrase rail
   - 这一步若继续做用户体验层功能，默认等待一手用户研究输入或把当前假设明确标记为 provisional
   - 把“沟通已经开始”后的页面继续打磨成更轻、更 glanceable 的工作台
   - 继续减少沟通页对旧 chat 心智和旧控件布局的依赖

2. 收口首页任务入口
   - 继续把首页从“高压场景优先的静态入口”推进到“可直接跳入合适 starter 的真实入口”
   - 下一步优先补 `面试 / 工作协作 / 医疗 / 陌生人求助` 与沟通页 starter kit 之间的真实联动
   - 保持首页低噪音，不重新长回品牌说明页

3. 收口长期画像 contract
   - 把 `profile bundle / session review / expression kit merge` 从“最小读模型”继续推进到稳定 schema
   - 明确 `frontend local cache / backend durable profile / TEN realtime working state` 的职责边界
   - 减少页面和 hook 自己拼长期记忆上下文
   - 下一步优先把 scene-aware `workspace` 扩展到训练页和首页摘要，而不是继续只在沟通页 / 记忆页消费

4. 深化训练链路  
   - 用真实麦克风继续验证 `RTC 上行音频 -> transcript -> training_feedback -> voice_profile`
   - 把训练页从“录音采集页”继续推进成“练今天真会说的话”的任务流
   - 让沟通工作台和训练工作台共享同一份 `profile bundle`
   - 训练页的 UI 主路径与登录授权边界已完成收口；下一步优先补 authenticated live upload smoke，确认 `voice_contributions + manifest.jsonl + 本地待同步重试` 三段都在真实登录态下跑通，并继续验证数据库唯一键 / upsert contract 在补传和重试下的稳定性

5. 继续架构收口  
   - 把前端 hook 从“第二控制面”拉回 `transport client + UI reducer`
   - 让 TEN main control 停止继续增长产品语义
   - 在 `heavy realtime` 与 `light voice surface` 之间补更明确的 `session_strategy`
   - 把 `surface readiness / capability gating` 从 backend contract 继续写进真实 UI surface
   - 为未来替换 `TEN + Agora` 预留 vendor-neutral `session / transport / capability` contract

6. 让多端与记忆主线并行成立
   - runtime / surface / control contract 不再只为 web 页面服务
   - `workspace / profile bundle / expression kit / session review` 要继续推进成真正有用的产品上下文层
   - dataset 继续只做到支撑训练、复核、画像和多端复用所需的四层，不扩成抽象大数据平台

## 下一步优先级

1. 用真实麦克风补完当前 2026-03-29 训练页 `录音 -> transcript -> feedback -> 自动保存训练样本` 的新字段验证，重点确认 `sample_quality_* / confidence / latency_ms / review_* + upload receipt + manifest.jsonl + training profile sync` 一起成立。
2. 选一条真实样本完成 `accepted_for_export -> reviewer -> reviewed_at -> export manifest` 闭环；默认先 dry-run，得到你确认后再执行 `--write`。
3. 继续把训练反馈往“肌肉运动 / 口型 / 舌位 / 节奏”的简单建议收口，必要时再减少训练页里对拼音差异本身的强调。
4. 继续把 `surface readiness / capability gating` 做成真实 UI owner，而不是只停在 control-plane 返回值；当前已完成“连接前 planned intent + 下一步提示”，下一步优先补“已连接后显示 resolved strategy / capability 差异”和更细的 scene-aware copy。
5. 把共享 `workspace` contract 接到首页摘要与训练页任务提示，让“沟通 -> 练习 -> 沟通档案”真正共享同一份画像与复盘语言。
6. 继续基于 `workspace` 聚合接口补更准的 `personalized starter phrases / recent wins / recommended phrases` 命中逻辑，让内容层不只是框架。
7. 把 `profile bundle / session review / expression kit merge` 从当前最小实现继续推进到稳定 schema，让沟通页、训练页、记忆页共享同一份长期画像 contract。
8. 重构前端 session hooks，把 RTC/RTM transport bootstrap、消息归并、memory sync 和训练反馈协调拆开，避免 [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 继续膨胀。
9. 用真实麦克风再做一轮沟通页和训练页端到端验证，确认 RTC 上行音频、ASR transcript 和训练反馈在非 fake-mic 条件下稳定。
10. 基于 [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) 继续补 `workspace / profile bundle / expression kit / session review` 的 owner、写入边界和 runtime context service。

## 最近关键验证

- 2026-03-28 训练页与登录授权 smoke 已通过：
  - 登录页可见《用户隐私》与《数据采集说明》两项确认，且链接指向真实页面
  - 退出后重新登录可以写回新的授权记录；进入训练页后，“需要重新登录一次才能保存样本”的提示已消失
  - 训练页已确认只保留 `录音 / 训练 / 反馈` 主路径，5 个真实分类、句子搜索和分类切换都可用
  - 当前 headless 浏览器无物理麦克风，点击录音会明确提示“当前设备未检测到可用麦克风”，没有出现静默失败
- 2026-03-29 localhost 修复验证已完成：
  - `env VOXFLAME_ENABLE_PWA=1 npm run build` 通过
  - `npm run lint` 通过，仍只剩 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) 既有 Hook warning
  - `sudo docker compose up -d --build frontend` 已完成，运行中的 `localhost:3000` HTML 已确认带有 localhost runtime reset bootstrap
- 2026-03-29 训练资产对账验证已完成：
  - `backend` 的 `npm run build` 通过
  - `npm run reconcile:artifacts -- --email 2307294809@qq.com --write` 已把测试账号现有监督录音补齐到 `upload_receipt + manifest.jsonl`
  - `npm run reconcile:artifacts -- --limit 50 --write` 已把当前环境中其余 5 条缺 receipt 的 legacy 训练样本全部补齐
  - 二次 dry-run 已确认当前 `voice_contributions` 待对账数量为 0
  - 直接读取 OSS 已确认 `dataset/64758dee-5026-4b53-a063-1d02d0834f67/manifest.jsonl` 为 1 条，`dataset/v_gv7fxwrp/manifest.jsonl` 为 5 条
- 2026-03-29 训练 dataset 去重规则已落到代码和文档：
  - 同一句允许保留多条样本，当前不是按句子内容去重
  - 同一条录音的重试与补传会按 `audio_path + recording_id/upload_receipt/manifest` 组合安全去重
- 2026-03-29 dataset review queue contract 已落地：
  - `backend` 的 `npm run build` 通过
  - `frontend` 的 `npm run lint` 通过，仍只剩 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) 既有 Hook warning
  - `npm run review:queue -- --status retry_recommended --limit 1` 已验证脚本入口和新状态枚举可执行，但当前环境被 Supabase DNS `EAI_AGAIN` 挡住，尚未补到真实在线队列读取结果
  - 上传阶段语义已改成“音频完整就入链”，`retry_recommended` 只表示后续建议补录或复核，不再把说话不清的样本写成上传层 `rejected`
- 2026-03-29 dataset export manifest 第一版已落地：
  - `backend` 的 `npm run build` 通过
  - `npm run export:manifest -- --limit 1` 已成功输出 `/tmp/dataset_export_2026-03-29T11-50-01-239Z.jsonl`
  - 当前导出条数为 0，说明后续需要补一条真实 `accepted_for_export` 样本来完成这条链的最后验证
- 2026-03-29 review/export dry-run 入口已落地：
  - `backend` 的 `npm run build` 通过
  - `npm run review:mark -- --help` 已正常输出脚本帮助
  - 当前默认只做 dry-run 预览，仍未对真实样本做任何回写
- 2026-03-29 训练反馈已继续收口到更简单的动作建议：
  - `frontend` 的 `npm run lint` 通过，仍只剩 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) 既有 Hook warning
  - 新反馈文案已更强调嘴巴动作、舌位、气息和节奏，而不是只强调拼音差异
- 2026-03-29 runtime / surface 文档与 UI 已继续收口：
  - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)、[VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)、[VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md) 已删除一批过时阶段判断，把 `runtime/surface` 明确为当前主任务、`dataset` 明确为收尾中的次主线
  - 已新增 [SessionReadinessPanel.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/runtime/SessionReadinessPanel.tsx)，沟通页和训练页都开始直接展示 `surface / mode / strategy / capability / readiness`
  - `frontend` 的 `npm run lint`、`npm run build` 和 `bash scripts/check_ai_docs.sh` 通过；仍只剩 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) 既有 Hook warning
  - `sudo docker compose up -d --build frontend` 后，Playwright 已确认 `/` 沟通页和 `/contribute` 训练页都能看到 readiness 面板
- 2026-03-29 readiness UI 继续深化：
  - 沟通页未连线前已能按 `starter` 场景显示 planned intent，Playwright 已确认 `?mode=communicate&starter=medical` 会展示 `communication_workspace / communication / heavy_realtime / medical / 实时发送 + 共享画像读取`
  - 训练页未启动前也已能展示 planned intent，Playwright 已确认 `/contribute` 会展示 `training_workspace / training / heavy_realtime / outing` 与 5 个 capability，并明确提示“先点录音”
  - 面向用户的默认呈现已进一步降复杂度：panel 现在优先只显示“现在状态 / 下一步 / 阻塞或提醒”，`surface / mode / strategy / capability` 已折叠进“查看技术细节”，标题也改成更产品化的 `沟通前准备 / 训练前准备`
  - backend 已补最后一层产品化翻译： [rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts) 现会在 `readiness` 内直接返回 `summary.status / label / detail / nextAction / blockerSummary / warningSummary`；前端真实会话连接后不再主要依赖本地规则拼 readiness 文案
  - [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 这轮继续拆薄，新增 [session-audio.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-audio.ts)、[session-effects.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-effects.ts)、[session-profile.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-profile.ts)；hook 已从 736 行降到 487 行
  - `backend` 的 `npm run build`、`frontend` 的 `npm run lint` / `npm run build` 和 `bash scripts/check_ai_docs.sh` 通过；`frontend` 仍只剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) Hook warning
  - `sudo docker compose up -d --build backend frontend` 后，Playwright 已确认真实登录态下沟通页连接成功，并显示 backend summary 生成的新文案 `这页已经满足沟通会话的基础条件，可以直接连接并开始表达。` 与 `可以直接连接助手或开始表达，不需要再做额外准备。`
- 2026-03-29 workspace owner 已继续收口：
  - backend 新增 `PUT /api/memory/workspace/:userId/preferences`，由 [memory.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/memory.controller.ts) + [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 持久化 `communication_preferences`
  - [CommunicationPreferenceCard.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/chat/CommunicationPreferenceCard.tsx) 已切到新的 workspace API
  - [memory/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/memory/page.tsx) 已接入真实可编辑的沟通偏好卡；保存后会刷新 `workspace snapshot`
  - `backend` 的 `npm run build`、`frontend` 的 `npm run lint` / `npm run build`、`bash scripts/check_ai_docs.sh` 通过；Playwright 已确认 `/memory` 页面出现可编辑的“我的沟通偏好” owner 卡片
  - `workspace-client.ts` 已新增，workspace 快照读取和沟通偏好写入现在都通过同一层 client 走，不再让 hook/组件各自拼 fetch
  - compat 清理继续推进：旧的 `/api/agent/profile/:userId` 与 `/api/agent/hotwords/:userId` 已先降为 compat shell，随后这轮已从服务中移除；`backend` 的 `npm run build` 与 `bash scripts/check_ai_docs.sh` 通过
  - `memory` compat slice 也已移除：`/api/memory/user/:userId`、`/api/memory/hotwords/:userId`、`/api/memory/stats/:userId` 不再挂载；`backend` 检索已确认 controller/service/README 中没有这批旧入口残留
- 2026-03-29 runtime helper 验证基线已建立：
  - `frontend/package.json` 已新增 `npm test` 与 `npm run test:runtime`，基于 Node 内建 test runner 和 [register-runtime-test-hooks.mjs](/home/ubuntu/VoxFlame-Agent/frontend/test/register-runtime-test-hooks.mjs) 处理 `@/` alias、`.ts/.tsx` 解析
  - 已新增 [session-audio.test.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-audio.test.ts)、[session-actions.test.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-actions.test.ts)、[session-runtime.test.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-runtime.test.ts)
  - 当前 helper 单测已覆盖麦克风错误翻译、未就绪提示、文字发送动作、消息清空、麦克风 stream 读取、runtime control message 发布和 chunked envelope 解码归并
  - `cd frontend && npm test` 通过
- 2026-03-29 runtime helper 测试还带出两个真实收尾项，并都已修正：
  - [training-profile.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-profile.ts) 已改为 `import type { TrainingGuidanceProfile }`，修掉 Node ESM/runtime 下的类型导入错误
  - [agora-transport.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/agora-transport.ts) 现在按环境收紧 RTC SDK 日志级别：production 用 `WARNING/ERROR`，development 保留 `INFO`
- 2026-03-29 frontend Docker `npm ci` 兼容问题已收口：
  - 根因是 `frontend/package-lock.json` 之前带有 npm 11 写入的空壳 nested package 记录，Docker 里的 Node 20 / npm 10 会报 `Invalid Version`
  - 已使用 `sudo docker run ... node:20-slim npm install --package-lock-only` 重新生成 lockfile
  - 已再次用同版本 `sudo docker run ... npm ci --loglevel warn` 验证通过
  - 随后 `sudo docker compose up -d --build frontend` 已再次成功完成
- 2026-03-29 runtime helper 最终 smoke 已补齐：
  - `frontend` 的 `npm test`、`npm run build`、`npm run lint` 通过；`lint` 仍只剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) Hook warning
  - `bash scripts/check_ai_docs.sh` 通过
  - Playwright 已再次确认 `/?mode=communicate&starter=medical` 可以成功 `连接助手 -> 已连接 -> 发送文字`
  - 网络侧继续可见 `POST /api/rtc/session/start => 200`
  - 控制台仍保留 1 条非阻塞 Agora vendor warning：`WebSocket ... closed before the connection is established`，但此前大量 `DEBUG` 噪音已消失
- `frontend` 当前构建状态：
  - `npm run build` 通过
  - `npm run lint` 仅剩仓库既有 [WaveformVisualizer.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/components/WaveformVisualizer.tsx) Hook 依赖 warning
- 文档一致性检查通过
- Qwen ASR live smoke 通过
- Qwen TTS live smoke 通过
- `ChatInterface` lint 已通过：`npm run lint -- --file src/components/chat/ChatInterface.tsx`
- 沟通工作台 Playwright smoke 已确认：
  - 首屏已展示 `CommunicationStarterKit`
  - `表达工具箱` 抽屉可打开/关闭
  - 点击 starter phrase 后可自动连接助手并完成首句代播
- backend `workspace` 聚合接口已通过编译并接入运行中的容器：
  - `GET /api/memory/workspace/:userId`
  - 沟通页首屏已展示“个体化表达建议 + 最近一次沟通复盘”
- scene-aware `workspace` contract 已完成本轮编译与部署验证：
  - backend `npm run build` 通过
  - frontend 相关 lint 通过
  - `sudo docker compose up -d --build backend frontend` 已完成
  - backend/frontend 容器当前均为 `healthy`
- “我的沟通偏好”功能已通过真实浏览器 smoke：
  - 可以保存 3 句个体偏好
  - 保存后会立即出现在首屏 `个体化表达建议`
- 首页改版尚需补一次真实浏览器 smoke：
  - 确认高压场景卡、三个工作台入口和响应式布局都正常
- localhost / VSCode forwarded 浏览器白屏问题已做代码侧防护：
  - 生产公网地址可正常打开
  - `localhost` origin 下会主动清理旧 SW/cache，避免 stale assets 继续污染转发环境
  - 如果本地浏览器访问 Supabase/Auth 变慢或被本机网络拦住，首页会在 3 秒后回退到游客态继续渲染，不再无限等待鉴权初始化
  - 受保护页面不再共享这套 fail-open 逻辑，避免慢网时误跳登录页
- 麦克风验证的默认路径已明确：
  - 优先用 VSCode/SSH 转发后的 `http://localhost:3000`
  - 不再长期依赖 `--unsafely-treat-insecure-origin-as-secure=...`
  - 若要从公网地址直接验证麦克风权限，应补 HTTPS 和证书
- 控制台噪音已收口：
  - 不再请求不存在的 `/avatars/01.png`
  - 未登录态下不再提前触发 `workspace` 401
- 前端容器已用 `sudo docker compose up -d --build frontend` 完成重建，运行中页面已吃到新版本
- Playwright fake-mic smoke 已确认：
  - 沟通页点击麦克风后可稳定进入录音态
  - 训练页点击“开始录音”后可稳定进入录音态
- 前端登录跳转 smoke 已确认：
  - 首页“练习表达 / 进展与记忆”入口会统一落到 `/login?next=...`
- 前端 `/api` rewrite 已正确转到 backend，前端服务状态恢复为 `healthy`
- 这轮未补到 authenticated API 的在线 smoke：
  - 原因是当前环境对 Supabase 域名解析出现 `EAI_AGAIN`
  - 但 backend 容器内 `/health` 已确认可访问，类型编译和镜像构建均通过

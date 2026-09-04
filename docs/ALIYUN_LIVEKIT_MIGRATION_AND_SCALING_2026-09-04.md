# 阿里云迁移与 LiveKit 分阶段扩容手册

> 总执行入口：[语音采集四项需求总执行表](VOICE_COLLECTION_FOUR_REQUIREMENTS_EXECUTION_2026-09-04.md)。本手册只负责阿里云迁移、资源扩充和 LiveKit/Agent 容量路径。

## 目标与当前边界

目标是把 VoxFlame 的 Web、上传控制面、LiveKit 媒体面和 Agent/ASR 推理面分开扩展，逐级验证 50、100、200 路实时语音，再决定是否进入 1,000 路设计。注册用户数、同时在线人数、同时录音人数和实时 RTC 路数不是同一个容量指标。

当前生产事实：单主机 Docker Compose、单 Backend、单 LiveKit Server、单 Agent Worker；音频已直传阿里云 OSS。现有研究 `RO-014` 明确指出，首要风险是每个实时房间对应独立 Agent Job/进程以及 ASR/TTS/LLM 外部并发配额，而不是把 LiveKit 单房间人数上限直接当作 AI 会话容量。

2026-09-04 已按官方文档和开源源码完成扩容专项对照。仓库将 LiveKit Agents 从 `1.5.1` 升级到 `1.7.1`、LiveKit Server 从 `1.10.1` 升级到 `1.13.6`；升级理由仅包括 Worker/Job 内存统计、连接失败退出、drain、节点统计、Agent 连接关闭、负载和 TURN 配额/安全等扩容相关改进。生产替换必须在镜像内版本、RTC/TURN smoke 和回滚点验证后才算完成，不能只以配置文件版本号为证据。

2026-09-04 主机基线：4 vCPU、7.3 GiB 内存、2 GiB swap、59 GiB 系统盘（已用 61%）；本机监听 80/443、LiveKit 7880/7881、TURN 3478 和 RTC UDP 7882。当前 Agent 容器限制为 2 GiB，因此先按 `2` 个 active jobs、ASR/LLM/TTS 各 `2` 个单机槽位保护；这只是现主机安全起点，不是平台目标上限。仓库安全整改文档记录现生产计算节点位于腾讯云；迁移到阿里云属于跨云迁移，应始终保留原节点回滚路径。

当前个性化 ASR 接入事实：GPU1 已重新建立 SSH 反向隧道，cpu1 的 `127.0.0.1:8001` 可访问 GPU1 多账户网关；本机已无 `8000/18000` 监听。2026-09-04 使用真实 Supabase 注册用户和真实 WAV 完成三层对账：`2187054680 -> EXP-29`、`2307294809 -> EXP-24`、`3083029019 -> EXP-25` 均返回 `personalized=true/fallback=false`，随机未注册键命中公共 `exp16l3-lambda025` 且返回 `personalized=false/fallback=true`。这证明当前路由契约正确，不代表单实例 ASR 已具备目标并发容量；扩容仍需容量压测、配额和多实例/故障切换。

## 现在从哪一步开始

不要一次购买完整 10,000 用户集群。先完成以下第一批：

1. 选择与现有 OSS 相同的阿里云地域并建立 VPC。
2. 开通两台 4 vCPU / 8 GiB ECS：`control-a`、`control-b`。
3. 开通 ALB/CLB、ACR 和 SLS。
4. 先用临时预发布域名，不修改 `voxember.com` 的正式 DNS。
5. 把地域、规格、VPC/子网、临时入口、安全组和资源名称发给开发侧；不要发送密钥。

`control-b` 初期只承接 Frontend 或保持备用。阶段 2 的持久事件硬门通过前，不允许两个 Backend 同时修改 manifest/transcript。

## 推荐目标拓扑

```text
用户 Web / App
  ├─ HTTPS ─> 阿里云 CDN/WAF（可选）─> ALB/CLB
  │                                  ├─ Frontend × N
  │                                  └─ Backend × N
  ├─ WSS/WebRTC ─> LiveKit SFU × N ─> Redis（LiveKit 集群协调）
  │                    └─ TURN 节点 × N（公网 UDP/TLS）
  └─ HTTPS PUT ─> OSS

LiveKit Agent Worker × N
  ├─ 个性化 ASR 网关 × N / 明确容量的托管 ASR
  ├─ DashScope LLM/TTS
  └─ Prometheus/日志/告警

Backend
  ├─ Supabase（现阶段保留）
  ├─ OSS
  └─ 持久事件表/队列（替代跨实例不安全的进程内 manifest 锁）
```

## 阶段 0：建立基线，不改生产拓扑

你需要准备：

- 一个独立预发布域名，例如 `staging.example.com`。
- 一个只用于压测的账号，不使用真实用户账号或真实录音。
- 记录当前 ECS 的 vCPU、内存、系统盘、峰值公网带宽和安全组。

我方代码已提供：

- Backend `/health` 的上传容量计数。
- `/upload/sign` 与 `/upload/complete` 的实例级背压。
- Web/App 对 `429/503 + Retry-After` 的有界退避和本机队列。
- `backend/npm run load:upload-control` 轻量压测入口。

验收：连续观察 24 小时，记录 CPU、内存、FD、网络、容器重启、RTC 会话数、Agent active jobs、ASR/LLM/TTS P95/P99、429/5xx/timeout。

停止条件：出现 OOM、持续 5 分钟 provider 429、丢包超过 1%、ASR P95 超过 2 秒或 TTS 首包 P95 超过 1.5 秒，不再加压。

## 阶段 1：迁移 Web 与 Backend 控制面到阿里云

建议先开通：

- 2 台 ECS 或 1 个 ACK 集群的两个工作节点；每个节点从 4 vCPU / 8 GiB 起步。
- 1 个 ALB/CLB，终止 HTTPS 并把 Web/API 分流到健康实例。
- ACR 镜像仓库，用于保存 Frontend、Backend、LiveKit Agent 版本和回滚镜像。
- 日志服务 SLS 或现有可检索日志系统。
- 与现有 OSS 同地域部署，优先使用内网 Endpoint；客户端仍使用公网签名 URL。

执行顺序：

1. 在预发布 ECS/ACK 部署 Frontend 与 Backend，不接生产 DNS。
2. 配置 Supabase、OSS、LiveKit 和 CORS；Secrets 只进入服务端 Secret，不进入镜像或前端。
3. 运行数据库 migration，包括人工质检审计表。
4. 验证登录、workspace、上传签名、OSS PUT、完成登记、撤回和人工质检接口。
5. 使用 ALB 临时域名完成 50→100→200 并发的 HTTP 控制面测试。
6. 保留原生产入口，先做小比例 DNS/流量切换，再逐步扩大。

回滚：DNS/ALB 权重切回旧主机；数据库 migration 只新增表，不删除旧数据；旧镜像保留。

硬门：Backend 仍只有单实例时可以沿用当前 manifest 写入；准备扩到多个 Backend 实例前，必须完成阶段 2。

## 阶段 2：消除 Backend 多实例的 manifest 竞态

当前 `runSerializedArtifactOperation()` 只在一个 Node 进程内串行。同一账号若同时落到两个 Backend，OSS manifest/transcript 仍可能发生竞态；数据库唯一索引不能解决这个问题。

建议实现：

1. `/upload/complete` 先把不可变上传事件写入数据库事件表，使用 `recording_id`/`audio_path` 幂等。
2. 独立 worker 从事件表或消息队列消费，生成 manifest/transcript 投影。
3. 事件状态至少包括 `pending / processing / completed / failed`、attempt、last_error 和 lease 到期时间。
4. 撤回写终态 tombstone 事件；投影器必须保证迟到 complete 不能复活已撤回录音。
5. 训练导出从已完成的数据库事实与活动事件投影读取，不依赖某个进程的内存锁。

可选基础设施：先用 Supabase/Postgres 事件表与 `FOR UPDATE SKIP LOCKED`，规模和运维需要再升级时再引入阿里云 MNS/RocketMQ。不要同时维护两套队列事实源。

验收：两个 Backend 实例随机负载，针对同账号并发 complete/discard 至少 50 轮；不得有重复活动记录、丢 tombstone、相邻录音误删或不可重试半状态。

## 阶段 3：LiveKit 媒体面迁入阿里云

建议先从单 LiveKit 节点迁移，不立刻做集群：

- 1 台独立 ECS，建议 8 vCPU / 16 GiB 起步，计算型实例优先。
- 独立公网 IP；安全组开放信令 HTTPS/WSS、RTC TCP、RTC UDP 和 TURN UDP/TLS 所需端口。
- 域名建议拆分为 `rtc.example.com`；不要与普通 Web API 共用会修改 WebSocket/UDP 行为的代理链。
- TURN 证书、域名和公网 IP 必须一致；验证 UDP 被屏蔽网络下的 TURN/TLS 回退。

执行顺序：

1. 在预发布启动 LiveKit Server，关闭 dev mode，使用独立强密钥。
2. Backend 只签发新预发布 LiveKit URL，生产仍指向旧节点。
3. 运行 `lk load-test` 验证媒体包、丢包和带宽，再运行真实 VoxFlame 音频样本验证 ASR/TTS 端到端。
4. 完成 5→10→20→50 路阶梯测试。
5. 做一次 LiveKit 节点故障演练，确认客户端错误可理解、录音本机队列不丢失。

注意：`lk load-test` 只证明媒体面，不证明 ASR、LLM、TTS 或 Agent 容量。

## 阶段 4：Agent 与推理面横向扩展

Agent Worker 应与 LiveKit Server 分离部署；每个 Worker 使用相同 `agent_name` 注册，由 LiveKit 分配 Job。

建议先开 2 台 Agent ECS，每台 8 vCPU / 16–32 GiB，按实际单 Job RSS 调整。当前单 Job 已配置 450 MiB 告警、700 MiB 上限，因此不能只按 CPU 估算。

仓库已完成的单机保护：

- Worker 父进程按 active jobs、CPU、内存联合产生 LiveKit load；达到阈值后停止接新 Job。
- 官方 SDK 的 reserved slots 继续避免“已接受但尚未启动”的并发派单超收。
- 独立 Job 进程通过 POSIX 文件锁共享 ASR、LLM、TTS 单机槽位；Job 崩溃后 OS 自动释放锁。
- Agent 健康口、30 分钟 drain/stop grace 和精确版本固定已配置。

扩到多机前必须补齐：

- 按 active jobs 的 Worker 准入上限，CPU 阈值只作为第二信号。
- Redis/集中配额层控制所有 Agent 服务器的 ASR、LLM、TTS 集群总并发；当前文件锁只覆盖单机。
- provider 429、超时、首包时间、fallback 次数和每路内存监控。
- 个性化 ASR 网关至少两个实例，账户路由和响应 `account_id` 校验保持不变。
- Agent Worker 优雅下线：先停止接新 Job，再等待现有房间结束。

容量公式必须使用：

```text
集群实时 AI 安全容量
= min(
    单 Worker 实测安全路数 × 健康 Worker 数,
    ASR 集群书面/实测并发配额,
    LLM 集群书面/实测并发配额,
    TTS 集群书面/实测并发配额
  )
```

LiveKit 房间人数、注册用户数和 HTTP QPS 均不能代替这个值。

验收顺序：50 路稳定 30 分钟后才能进入 100 路；100 路稳定后再进入 200 路。每一级都要保存原始指标和配置，不凭平均值通过。

## 阶段 5：LiveKit 多节点集群

只有单 SFU 节点的 CPU、带宽或故障域已经成为证据明确的瓶颈时才进入本阶段。

需要：

- 至少 2 个 LiveKit SFU 节点。
- 独立 Redis 高可用实例供 LiveKit 节点协调。
- 支持 WebSocket、UDP/TCP 和客户端真实 IP 的负载入口；UDP 路径需按 LiveKit 集群要求配置，不能只使用普通七层 HTTP 代理。
- 每个节点可被公网客户端直接到达所需的外部 IP/端口映射。
- TURN 最少两个故障域或明确的备用节点。

验收：节点上下线、Redis 短暂故障、单节点带宽饱和和 TURN 故障注入；新会话可调度，已有会话的预期行为被记录并对用户有明确提示。

## 阶段 6：1,000–10,000 用户容量目标

先冻结业务假设，例如：10,000 同时在线中，5% 同时录音、1% 同时 RTC、每分钟多少次 `/complete`。没有这一比例，无法从“用户并发”换算资源。

建议把目标拆成：

- Web 在线：静态资源由 CDN 承担，Frontend/Backend 只处理动态请求。
- 数据采集：客户端直传 OSS，Backend 完成登记由事件队列削峰。
- 实时沟通：按每个 Agent Worker 的实测安全路数水平扩展。
- TURN：按最坏情况下的中继比例和单路双向码率单独购买带宽。
- Provider：提前申请 DashScope/ASR 的并发与速率配额，应用信号量不得高于已确认配额。

“10,000 同时在线”可早于“10,000 路实时 AI 语音”达成。后者是完全不同的成本和架构等级，必须单独立项。

## 你每完成一步后提供的信息

每个阶段完成后，请发我：资源规格和地域、内网/公网拓扑、域名、端口与安全组截图或文本、部署版本、30 分钟指标快照和失败日志。不要发送 AccessKey、服务密钥、JWT 或个人账号 token。

第二采集站还需最终确认四项：域名、中文站名、Logo 文件、主色值。产品页面不显示“燃言 / VoxFlame”，但必须显示真实法定运营主体、隐私责任主体和备案信息。代码使用同一 Backend、账号、OSS 与采集契约，不复制第二套业务系统；正式域名还必须加入 Supabase Auth Redirect URLs。

## 官方机制依据

- LiveKit 生产自托管配置、Redis、外部 IP、TURN 与 Prometheus：<https://docs.livekit.io/transport/self-hosting/deployment/>
- LiveKit 分布式部署和 Redis 共享状态：<https://docs.livekit.io/transport/self-hosting/distributed/>
- LiveKit Kubernetes 的 host networking 与每节点单 pod 约束：<https://docs.livekit.io/transport/self-hosting/kubernetes/>
- LiveKit Agents 自定义 `load_fnc`、`load_threshold` 和默认 CPU 负载机制：<https://docs.livekit.io/agents/server/options/>
- LiveKit Agents Job 隔离、水平扩展和优雅下线：<https://docs.livekit.io/agents/server/lifecycle/>
- LiveKit Agents `1.7.1` 官方 release：<https://github.com/livekit/agents/releases/tag/livekit-agents%401.7.1>
- LiveKit Server `1.13.6` 官方 release：<https://github.com/livekit/livekit/releases/tag/v1.13.6>

仓库已增加每周一自动版本审计 `.github/workflows/livekit-upgrade-watch.yml`。发现新稳定版时自动创建或刷新 GitHub Issue 并让工作流标红；它只提醒和分流，不自动升级生产。真正升级需要 release 分类、Agent 全量测试、RTC/TURN 预发布、镜像回滚点和人工发布门。

以上官方文档说明机制，不构成 VoxFlame 已达到任何并发容量的证据；最终容量只由本项目的阶梯压测和真实语音端到端指标确认。

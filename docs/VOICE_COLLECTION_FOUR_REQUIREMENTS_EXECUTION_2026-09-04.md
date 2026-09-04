# 语音采集四项需求总执行表

> 状态日期：2026-09-04  
> 目标：把方言采集、质量审核、1,000–10,000 用户容量和第二品牌采集站做成同一套可部署、可扩展、可回滚的系统。  
> 原则：Web 与 App 共用数据契约；第二品牌站不复制 Backend、账号、OSS 或训练数据事实源；没有压测证据时不承诺容量数字。

## 一、当前状态总览

| 需求 | 已完成的代码能力 | Web/App 同步 | 上线前仍需完成 | 当前状态 |
| --- | --- | --- | --- | --- |
| 方言配对采集 | 普通话后可录同句方言或跳过；共享 `utterance_pair_id`；保存语种和自报方言；ASR 不一致不拒收 | Web、App 已同步 | 部署后分别做一次真实设备双录、跳过、重录和断网补传 | `代码完成，待部署验证` |
| 自动质检与人工质检接口 | 服务端按时长、有效语音、静音、电平、削波等初筛；提供审核队列与审核决定 API；审核写独立审计表 | Web、App 上传同一质量元数据；审核入口属于后台 | 执行数据库 migration；配置审核员邮箱；用授权账号验证队列和幂等决定 | `代码完成，待 migration/部署` |
| 1,000–10,000 用户容量 | OSS 直传；Backend 背压；Web/App 有界重试；Agent active-job/CPU/内存准入；单机 ASR/LLM/TTS 跨进程槽位；健康口和 drain；LiveKit 版本升级；8001 注册用户模型路由实测审计 | Web、App 已同步退避和本机兜底 | 建预发布、持久事件队列、多实例 Backend、集群总配额、双 Worker、8001 容量/双实例故障切换、RTC 阶梯压测 | `单机保护完成，集群容量未证明` |
| 第二品牌采集站 | 已建立可配置白标模型；功能与主站相同，采集入口优先；原品牌 App 下载在白标站禁用 | Mobile 共用业务代码和数据契约，并支持独立品牌构建；安装包必须使用独立名称、图标、包名、签名和发布渠道 | 完成全站白标检查、独立容器和域名路由验证；用户提供域名、站名、Logo、主色及 App 发布标识 | `实现中，不可宣称已上线` |

## 二、唯一架构边界

```text
主站 Web ───────┐
第二品牌采集站 ─┼─> 同一 Backend ─> 同一 Supabase Auth / DB
Mobile App ─────┘       │
                        ├─> 同一 OSS 音频与 manifest 契约
                        └─> 同一质检、撤回和训练导出硬闸门

实时沟通：Web/App -> Backend session API -> LiveKit -> Agent Worker -> ASR/LLM/TTS
```

以下内容不得出现第二套事实源：用户账号、授权版本、录音 ID、录音撤回、质检决定、训练导入资格、workspace memory。第二品牌站只改变域名、Logo、站名、主色和首页信息层级；产品页面不得显示“燃言 / VoxFlame”。法定运营主体、隐私责任主体和 ICP 备案信息必须保持真实，不能为了白标隐去或伪造。

## 三、执行顺序

### Step 1：完成不依赖新服务器的产品代码

负责人：开发侧。

- 收口第二品牌站接线和环境变量。
- 保持主站默认表现不变。
- 对第二站配置缺失采用安全默认值，不把测试域名或临时 Logo 写死。
- 第二站保留与主站相同的沟通、练习、记忆、录音和 App 下载功能，只把录音作为首页第一动作。
- 第二站邮箱确认链接必须回到第二站当前 origin；正式域名需要加入 Supabase Auth 的 Redirect URLs。
- Web 白标与 Mobile App 品牌是两个发布物：Mobile 业务代码继续共用，已提供独立品牌构建入口；第二站未配置自己的安装包链接时下载页显示“准备中”，且 Caddy 不再从第二域名分发现有 VoxFlame APK。正式白标包必须另设 App 名称、图标、包名/Bundle ID、URL scheme、EAS project、签名和发布渠道。
- 完成 Web、Backend、App 测试、production build、compose 展开和 Playwright smoke。
- 为数据库 migration、Backend、Frontend 和 App 分别写清部署/回滚动作。

通过条件：主站首页无回归；第二站功能与主站一致且首页优先采集，不出现原产品品牌；Web/App 方言元数据一致；未登录、登录、上传失败和本机队列路径均可解释。

### Step 2：部署第一、二项，但暂不扩大公开流量

负责人：开发侧部署；用户提供人工审核员邮箱。

执行：

1. 保存当前生产镜像作为回滚点。
2. 执行只新增表和索引的质检 migration。
3. 最小影响重建 Backend 和主站 Frontend，不执行 `docker compose down`。
4. 配置 `VOXFLAME_QUALITY_REVIEWER_EMAILS` 精确白名单。
5. 用测试账号验证普通话、方言、跳过方言、低质录音、人工决定和撤回。
6. App 完成代码和构建验证；Android/iPhone 真机证据仍由实际设备补交。

停止条件：登录、旧录音上传、撤回或普通话单录任一回归；migration 与代码版本不匹配；审核 API 越权；训练导入资格被自动或人工审核直接改为允许。

### Step 3：建立阿里云预发布控制面

负责人：用户开通资源；开发侧部署和验证。此步不改生产 DNS。

用户第一批只需开通：

| 资源 | 建议起步 | 用途 | 现在是否需要 |
| --- | --- | --- | --- |
| 阿里云地域和 VPC | 与现有 OSS 同地域优先 | 降低服务端访问 OSS 的跨地域成本和延迟 | 是 |
| ECS `control-a` | 4 vCPU / 8 GiB | 预发布 Frontend、单实例 Backend、Caddy/运维入口 | 是 |
| ECS `control-b` | 4 vCPU / 8 GiB | Frontend 冗余；Backend 多实例门通过后再接动态流量 | 建议同时开通 |
| ALB/CLB | HTTPS、WebSocket 健康检查 | Web/API 流量入口 | 是 |
| ACR | 私有镜像仓库 | 版本化部署和回滚 | 是 |
| SLS | 应用日志、访问日志和告警 | 保存压测与故障证据 | 是 |
| Redis | 暂不购买或只开最小测试规格 | LiveKit 多节点协调，不是第一阶段 Backend 队列事实源 | 否，阶段 7 再开 |
| ACK/Kubernetes | 暂缓 | 当前规模先用 ECS 验证，更容易定位媒体网络问题 | 否 |

用户完成后只需提供非敏感信息：地域、ECS 规格、VPC/子网规划、ALB 临时访问地址、安全组端口、ACR 仓库名、SLS project 名。不要发送 AccessKey、密码、JWT 或服务密钥。

通过条件：预发布登录、workspace、录音直传 OSS、完成登记、撤回、质检全部通过；主生产域名仍未切换。

### Step 4：完成 Backend 多实例硬门

负责人：开发侧。

必须先把进程内 `runSerializedArtifactOperation()` 升级为跨实例安全的持久事件机制。第一版使用现有 Postgres/Supabase 事件表和 `FOR UPDATE SKIP LOCKED`，不要同时引入第二套消息队列。

通过条件：两个 Backend 实例随机分流，同账号并发 complete/discard 50 轮，无重复活动记录、无 tombstone 丢失、无撤回后复活、所有失败均可幂等重试收敛。

未通过前：`control-b` 可以承接 Frontend，但不得让两个 Backend 同时写 manifest/transcript。

### Step 5：切换 Web/Backend 控制面

负责人：用户批准 DNS/流量变更；开发侧执行和 canary。

执行顺序：预发布域名验证 → ALB 小流量 → 10% → 50% → 100%。每一级至少观察错误率、P95/P99、DB/OSS 调用、容器重启和队列堆积。旧主机至少保留一个完整观察周期，不立即释放。

回滚：ALB 权重或 DNS 切回旧主机；数据库新增结构保留，旧代码不得依赖新字段才能读取历史数据。

### Step 6：迁移单节点 LiveKit 和双 Agent Worker

负责人：用户开通资源/公网带宽/provider 配额；开发侧部署和阶梯压测。

第二批资源：

| 资源 | 建议起步 | 用途 | 说明 |
| --- | --- | --- | --- |
| ECS `rtc-a` | 8 vCPU / 16 GiB，计算型，独立公网 IP | 单节点 LiveKit SFU/TURN | 独立于 Web/Backend；公网带宽按实测 TURN 中继率购买 |
| ECS `agent-a` | 8 vCPU / 16–32 GiB | Agent Worker | 每房间独立 Job 进程，按实测单 Job RSS 定容量 |
| ECS `agent-b` | 8 vCPU / 16–32 GiB | Agent Worker 冗余与扩展 | 与 `agent-a` 使用同一 `agent_name` |
| ASR 网关实例 | 至少 2 个实例或已确认容量的托管 ASR | 个性化 ASR 与公共 fallback | 必须先确认返回契约和并发配额 |
| RTC 域名 | 例如 `rtc.<正式域名>` | WSS/TURN 证书和客户端入口 | 域名、证书和 TURN 配置必须一致 |

压测只按 `5 → 10 → 20 → 50 → 100 → 200` 路推进。LiveKit 媒体测试、Agent 端到端测试和真实设备弱网/TURN 测试分别记录，不能互相替代。

代码基线固定为 LiveKit Agents `1.7.1` 和 LiveKit Server `1.13.6`。每周自动检查稳定版，只对 Worker/Job、内存、drain、节点、TURN、集群和安全相关更新触发 GitHub Issue；生产升级仍需预发布和人工批准。

停止条件：OOM；Agent Job 拒绝率超过 1%；ASR P95 超过 2 秒；TTS 首包 P95 超过 1.5 秒；媒体丢包超过 1%；provider 429 持续 5 分钟。

### Step 7：有证据后再做 LiveKit 多节点

只有 `rtc-a` 的 CPU、带宽或单点故障已经成为实测瓶颈时，才开通 Redis 高可用和 `rtc-b`。LiveKit 多节点要求 Redis 共享集群状态；每个媒体节点仍需正确的公网 IP 和 UDP/TCP 路径，不能只放在普通七层 HTTP 负载均衡后面。

通过条件：新会话在节点上下线时可正确调度；Redis、单 SFU、单 TURN 故障演练结果和已有会话行为均有记录。

### Step 8：第二品牌域名上线

负责人：用户提供品牌资产并完成 DNS；开发侧配置、部署和验证。

用户需要提供：

- 正式域名及其 DNS 管理权限归属。
- 中文站名和可选英文名。
- Logo 原文件，优先 SVG；如只有位图，应提供透明背景 PNG。
- 主色十六进制值。
- 如需独立 App：Android package、iOS Bundle ID、URL scheme、EAS project、签名账号和发布渠道。
- 确认公司主体、ICP备案和隐私协议中的真实运营主体。

最后一项不属于可隐藏的产品品牌配置；上线时默认显示真实运营主体和备案信息。

第二站上线初期以采集为首页第一入口，但沟通、练习、记忆和下载页等功能与主站一致。登录、授权、录音、撤回、质检和训练导出仍回到同一系统。主站和第二站分别做桌面、Android 浏览器和 iPhone 浏览器 smoke。

## 四、1,000–10,000 用户怎样换算成资源

先填写目标，不直接写“10,000 并发”：

| 指标 | 1,000 用户场景 | 10,000 用户场景 | 资源影响 |
| --- | ---: | ---: | --- |
| 同时在线用户 | 待填写 | 待填写 | CDN、Frontend、认证 |
| 同时录音但尚未上传 | 待填写 | 待填写 | 主要消耗客户端资源 |
| 同时 PUT OSS | 待填写 | 待填写 | OSS、用户上行；Backend 不承载音频主体 |
| 每秒 `/upload/sign` | 待填写 | 待填写 | Backend、Auth |
| 每秒 `/upload/complete` | 待填写 | 待填写 | Backend、DB、事件队列 |
| 同时 RTC AI 会话 | 待填写 | 待填写 | LiveKit、Agent、ASR/LLM/TTS、TURN |
| TURN 中继比例 | 待填写 | 待填写 | RTC 公网带宽和成本 |

资源计算只使用实测值：

- `所需 Agent 数 = 目标 RTC 路数 ÷ 单 Worker 安全路数`，结果向上取整并保留至少一个故障余量。
- `TURN 峰值带宽 = 中继会话数 × 实测单会话双向码率 × 安全系数`。
- `Backend 实例数 = 目标动态请求速率 ÷ 单实例安全 RPS`，再增加冗余；健康检查 RPS 不能替代真实签名/完成登记 RPS。
- Provider 信号量不得超过阿里云百炼/DashScope 或 ASR 服务商书面确认的配额。

建议第一个可验证业务目标是：`10,000 注册用户 / 1,000 同时在线 / 500 同时采集 / 100 同时 RTC`。这只是用于设计和压测的建议场景，不是当前容量结论，也不等于支持 10,000 路实时 AI 语音。

## 五、用户审批点

以下动作必须停下来由用户确认：

1. 购买或升配 ECS、ALB、Redis、带宽、ACR/SLS 套餐。
2. 申请或提升 ASR、LLM、TTS provider 配额。
3. 执行生产数据库 migration。
4. 修改正式 DNS、证书、ICP备案接入或流量权重。
5. 释放旧服务器、删除旧资源或扩大公开用户范围。
6. 发布 Android/iOS 安装包或应用商店版本。

## 六、验收证据和状态更新

每个 Step 完成后写入 `.tasks/current.md` 和 `.claude-summary.md`：完成内容、版本、测试命令、指标、未验证项、回滚点和下一审批点。详细容量与迁移步骤见：

- [采集容量与质检边界](UPLOAD_CAPACITY_AND_REVIEW_2026-09-04.md)
- [阿里云迁移与 LiveKit 分阶段扩容手册](ALIYUN_LIVEKIT_MIGRATION_AND_SCALING_2026-09-04.md)
- [RO-014 LiveKit/ASR/Agent 实时并发容量与隔离](../research/voice-agent/RO-014-livekit-asr-concurrency-capacity-2026-08-29.md)

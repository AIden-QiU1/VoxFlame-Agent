# RO-014 LiveKit/ASR/Agent 实时并发容量与隔离

## 问题定义

“一路”是一个同时存在的实时语音会话：一个房间、一个 Agent Job、一条音频流及其 ASR/TTS/LLM 请求；注册用户数不等于并发路数。当前一个 Agent Worker 按房间创建独立进程，单路还持有 VAD、队列和 session context，因此单实例是首要风险。

## 权威机制证据与对照

LiveKit Agents 官方文档说明 Job 使用隔离进程；默认按 5 秒 CPU 负载和 0.7 threshold 接受新 Job，可用自定义 load function 按 active jobs 控制。LiveKit 自托管文档指出单 SFU 房间约 3,000 用户是房间级参考，不等于 3,000 路 AI 会话。LiveKit CLI `lk load-test` 可模拟音频发布者，但只测媒体包/丢包，不测 ASR 语义、外部配额或端到端首字节。

跨模态对照：文本 Agent 常受请求并发、token 和工具限额约束；语音 Agent 还增加连续音频、端点/打断、抖动、TURN relay、ASR/TTS 长连接和隐私边界，不能把文本 QPS 或 SFU 房间上限直接外推为语音路数。

## 当前工程事实

已配置 `load_threshold=0.7`、2 个 idle processes、单 Job 450 MiB 告警/700 MiB 限制。2026-09-04 新增 active jobs/CPU/内存联合派单负载，当前 2 GiB Agent 容器默认最多 2 个 active jobs；ASR/LLM/TTS 各自通过跨 Job 进程文件锁提供 2 个单机槽位。官方 SDK reserved slots 会纳入有效负载，避免派单窗口超收，但不能代替 provider 配额控制。

`QWEN_HTTP_ASR_URL=http://127.0.0.1:8001/transcribe` 当前未在主机监听，connection refused；现存 18000 为旧 SSH 网关且不满足新账户响应契约。当前回退 DashScope realtime ASR，实际个性化 ASR 实例数、集群 provider 配额、TURN/TLS 和带宽仍需验证。低风险 HTTP 健康压测不能证明 RTC 容量。

版本专项对照结论：LiveKit Agents `1.7.1` 相比仓库原 `1.5.1` 包含扩容相关的进程内存统计修正、Worker 连接失败退出、drain/指标增强；LiveKit Server `1.13.6` 相比原 `1.10.1` 包含 Agent 连接关闭死锁修复、节点统计、负载修正及 TURN 配额/安全变化。仓库升级到这两个精确版本，但生产 Server 升级必须验证 1.12/1.13 引入的 TURN TTL 与受限网段权限变化。

## 分阶段实验与扩展

1. **基线**：固定 5→10→20→50 路音频样本、测试账号和版本；同时采集 active jobs、Job 启动耗时、ASR/TTS/LLM P95/P99、429/5xx/timeout、丢包、CPU/RAM/FD。
2. **隔离**：单机 Provider 槽位已实现；下一步以 Redis/集中配额控制多 Agent 服务器总配额，恢复 8001 新账户网关至少两个实例，并故障注入验证第二 Worker 接管。
3. **扩展门**：仅当 50 路保护指标达标且第二 Worker、外部配额和 TURN 带宽通过，才做 100→200 路；1000 路必须拆分 Worker/ASR、增加可观测性并重新压测，不能由当前单机推算。

## 停止与回退

任一阶段出现 OOM、Job 拒绝率 >1%、ASR P95 超过 2 秒、TTS 首包 P95 超过 1.5 秒、丢包 >1% 或 provider 429 持续 5 分钟即停止加压，回退 load/memory 配置并保持小流量。

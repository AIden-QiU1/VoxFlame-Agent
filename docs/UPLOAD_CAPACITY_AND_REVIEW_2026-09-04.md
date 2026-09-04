# 采集容量与质检边界

## 已实现的保护

- 音频主体由 Web/App 直传 OSS；Backend 只承担签名、完成登记、进度和撤回。
- `/api/upload/sign` 与 `/api/upload/complete` 分别设置实例级在途上限。
- 过载返回 `503` 和 `Retry-After: 2`；Web/App 最多退避重试 3 次，之后保留本机队列。
- `/health` 暴露 `uploadCapacity` 的 active、limit、rejected 计数。
- 服务端按时长、有效语音、静音比和输入电平做初筛；ASR 不匹配不作为拒收依据。
- 人工复核 API 使用 `VOXFLAME_QUALITY_REVIEWER_EMAILS` 精确邮箱白名单，并写独立审计表。
- 自动或人工质检均不直接授权训练导入，`training_import_allowed` 固定为 `false`。

## 容量口径

“支持 1,000–10,000 用户并发”必须拆成四种负载分别验证：同时在线、同时录音、同时 PUT OSS、同时调用完成登记。当前代码只提供安全背压和复跑入口，不构成 10,000 并发的生产容量证明。

建议分级验收：

1. 单实例基线：健康检查、签名和完成登记分别测试 50、100、200 并发。
2. 预发布环境：使用生产同规格数据库和 OSS，测试 1,000 同时在线与峰值上传比例。
3. 扩容门槛：在 Backend 多实例化前，把 manifest/transcript 写入迁移到跨实例安全的持久事件表或队列。当前进程内账号锁不能保证多实例一致性。
4. 目标集群：逐级提升至 1,000、3,000、10,000，并记录 p95/p99、错误率、OSS/数据库限额及恢复时间。

## 无真实用户数据的复跑入口

未提供 token 时只压 `/health`：

```bash
cd backend
VOXFLAME_LOAD_REQUESTS=1000 VOXFLAME_LOAD_CONCURRENCY=100 npm run load:upload-control
```

提供专用压测账号 token 时压 `/api/upload/sign`，只生成合成路径，不上传音频：

```bash
VOXFLAME_LOAD_BASE_URL=https://staging.example.com \
VOXFLAME_LOAD_BEARER_TOKEN=REDACTED \
VOXFLAME_LOAD_REQUESTS=1000 \
VOXFLAME_LOAD_CONCURRENCY=100 \
npm run load:upload-control
```

只允许对明确授权的预发布/压测环境执行；不要把个人账号 token 写入文件或日志。

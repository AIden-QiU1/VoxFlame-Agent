# 腾讯云中国大陆上线清单

> 更新时间：2026-04-07
> 目标：把当前 VoxFlame 主链从“服务器上能跑”推进到“大陆公网可访问、带 HTTPS、可继续走备案/正式域名”的状态。

## 1. 当前现状

- 当前核心栈已经在腾讯云 CVM 上运行：
  - `frontend`
  - `backend`
  - `livekit-server`
  - `livekit-agent`
- 当前已具备公网 HTTP 访问能力，但还不是正式生产入口。
- 当前仓库已经补上：
  - `Caddy` HTTPS 入口 profile
  - `公网 IP + Caddy + Let's Encrypt IP 证书` 预览接法
  - `Caddy host network`，避免 raw IP HTTPS 在 Docker bridge 下的无 SNI 证书选择问题
  - `VOXFLAME_PUBLIC_BASE_URL` 推导出的浏览器侧 `wss://...` LiveKit URL
  - `start-livekit.sh + LIVEKIT_SERVER_DEV_MODE`，避免 compose shell 解析把 LiveKit 启动命令拆坏
  - `livekit.public.yaml` 公网预览配置

## 2. 正式上线必须准备的资源

### 2.1 域名

- 至少准备 1 个你自己持有的正式域名。
- 推荐直接规划这 3 个子域名：
  - `app.example.com`
  - `rtc.example.com`
  - `turn.example.com`

### 2.2 ICP 备案

- 如果 CVM 在中国大陆地域，对外提供网站或 App 服务，需要先备案。
- 域名未备案直接解析到腾讯云中国大陆云资源，可能被拦截。
- 建议优先企业主体备案；个人主体可做预研或个人项目，但后续扩展空间较小。

官方参考：
- 腾讯云 ICP 备案云资源：https://cloud.tencent.com/document/product/243/18908
- 腾讯云备案 FAQ：https://cloud.tencent.com/document/faq/243/73180
- 腾讯云首次备案：https://cloud.tencent.com/document/product/243/37402

### 2.3 HTTPS 证书

- 语音麦克风权限依赖 secure context，公网访问必须上 HTTPS。
- 正式域名推荐用 `Caddy` 自动签发和续期证书。
- 如果公司流程要求，也可以改成腾讯云托管证书。

官方参考：
- MDN `getUserMedia()` secure context：https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- LiveKit self-hosting deployment：https://docs.livekit.io/transport/self-hosting/deployment/
- LiveKit VM guide：https://docs.livekit.io/transport/self-hosting/vm/

## 3. 腾讯云侧要开通的能力

### 3.1 安全组

- 当前至少需要：
  - `80/tcp`
  - `443/tcp`
  - `7881/tcp`
  - `7882/udp`
- 当前这套公网预览如果要让浏览器真实建立语音链路，还应放开：
  - `3478/udp` for TURN/UDP
- 正式 LiveKit 生产化时，还应继续补：
  - `5349/tcp` for TURN/TLS preview
  - `443/tcp` for TURN/TLS production without separate L4 LB
  - `50000-60000/udp` for 更稳的 WebRTC 媒体连通

说明：
- 当前已经确认：
  - `livekit-server` 现在会稳定监听 `7880/tcp`、`7881/tcp`、`7882/udp`、`3478/udp`
  - 浏览器侧 ICE server 现在只收到 `turn:公网IP:3478?transport=udp`
  - `/api/rtc/session/start` 与 LiveKit signaling 已经能成功命中
- 如果页面仍提示“当前网络没能建立实时语音连接”，优先说明：
  - 腾讯云安全组还没有完整放行 `3478/udp + 7882/udp + 7881/tcp`；或
  - 用户网络本身限制了纯 UDP/ICE，当前预览形态又没有 TURN/TLS 兜底
- 这次排查也确认：宿主机本地 `ufw` 未启用，`iptables` 默认 `INPUT ACCEPT`，所以当前更像是腾讯云安全组/上游网络问题，而不是机内防火墙问题。

腾讯云官方参考：
- 安全组概述：https://cloud.tencent.com/document/product/213/12452
- 添加安全组规则：https://cloud.tencent.com/document/product/213/39740

### 3.2 DNS

- 正式域名阶段：
  - `app.example.com -> CVM 公网 IP`
  - `rtc.example.com -> CVM 公网 IP`
  - `turn.example.com -> CVM 公网 IP`
- 当前预览入口已直接使用公网 IP：
  - `https://111.230.35.89`

### 3.3 证书签发依赖

- `80/tcp` 必须能从公网访问到当前机器，Caddy 才能完成 HTTP challenge。
- 证书签发期间不要再让其他进程占用 `80/443`。

## 4. 当前仓库的部署变量

### 4.1 公网 HTTPS 入口

- `VOXFLAME_PUBLIC_HOST`
  - 例：`111.230.35.89` 或 `app.example.com`
  - 作用：Caddy 绑定的外部 HTTPS 主机名
- `VOXFLAME_PUBLIC_BASE_URL`
  - 例：`https://111.230.35.89`
  - 作用：backend 推导浏览器侧 `wss://...` LiveKit 地址

### 4.2 LiveKit 配置切换

- `LIVEKIT_CONFIG_FILE`
  - 本地开发：`./infra/livekit/livekit.dev.yaml`
  - 公网预览：`./infra/livekit/livekit.public.yaml`
- `LIVEKIT_SERVER_DEV_MODE`
  - 本地开发：`1`
  - 公网预览：`0`
- `VOXFLAME_LIVEKIT_TURN_UDP_PORT`
  - 当前预览：`3478`
  - 作用：只给 `start-livekit.sh` 使用，避免被 `livekit-server` 误读成原生 TURN/TLS 环境变量
- `VOXFLAME_LIVEKIT_TURN_TLS_PORT`
  - 当前预览：`5349`
  - 仅在真正启用 TURN/TLS 时写入生成配置
- `VOXFLAME_LIVEKIT_TURN_TLS_ENABLED`
  - 当前预览：`0`
  - 预览环境默认关闭 TURN/TLS，避免与网站 HTTPS 抢占同一个 `443/tcp`
- `VOXFLAME_LIVEKIT_TURN_DOMAIN`
  - 正式启用 TURN/TLS 时再填写，例如 `turn.example.com`

## 5. 当前可直接使用的公网 HTTPS 预览方案

### 5.1 适用范围

- 用于：
  - 快速建立公网 HTTPS 入口
  - 浏览器 secure context
  - 让前端、`/api`、`/rtc` 走同一 HTTPS 域名
- 不等于：
  - 中国大陆正式备案完成
  - 完整 LiveKit TURN/TLS 生产部署
  - 受限网络下的高覆盖率 WebRTC 连通

补充说明：
- LiveKit 官方文档明确要求：
  - 生产部署应有正式域名和可信证书
  - 如果使用 TURN，通常还需要独立 TURN 域名与证书
  - 如果没有四层负载均衡，`turn.tls_port` 应直接用 `443`
- 当前这台机子的预览形态是：
  - 网站 HTTPS 由 Caddy 占用 `443`
  - LiveKit 当前只开 `TURN/UDP 3478`
  - LiveKit 当前没有开启 `TURN/TLS`
  - 这能作为“先跑通公网 HTTPS”的预览方案
  - 但不等于 LiveKit 官方意义上的高可靠正式形态
- 因此：
  - 普通家庭网络或手机热点下，放行 `7881/tcp + 7882/udp + 3478/udp` 后通常有机会跑通
  - 公司 VPN、校园网、部分运营商或更严格网络下，因为没有 `TURN/TLS` 兜底，仍可能失败

### 5.2 预览入口

- 当前可用预览入口：`https://111.230.35.89`
- 这一版使用的是公网 IP 证书，不依赖未备案临时域名。
- 这条路适合“先把公网 HTTPS 跑通”，但正式品牌入口仍然建议切回你自己的备案域名。

### 5.3 启动命令

```bash
sudo env \
  VOXFLAME_PUBLIC_HOST=111.230.35.89 \
  VOXFLAME_PUBLIC_BASE_URL=https://111.230.35.89 \
  LIVEKIT_BROWSER_URL=wss://111.230.35.89 \
  LIVEKIT_CONFIG_FILE=./infra/livekit/livekit.public.yaml \
  LIVEKIT_SERVER_DEV_MODE=0 \
  VOXFLAME_LIVEKIT_TURN_UDP_PORT=3478 \
  VOXFLAME_LIVEKIT_TURN_TLS_ENABLED=0 \
  docker compose --profile https up -d --build livekit-server backend frontend livekit-agent caddy
```

### 5.4 验证命令

```bash
curl -I https://111.230.35.89
curl -I https://111.230.35.89/api/rtc/health
sudo docker compose logs --tail=100 caddy
sudo docker compose logs --tail=100 backend
sudo docker compose logs --tail=100 livekit-server
```

## 6. 正式域名切换步骤

### 6.1 域名和备案完成后

- 把 `VOXFLAME_PUBLIC_HOST` 改成正式域名，例如 `app.voxflame.com`
- 把 `VOXFLAME_PUBLIC_BASE_URL` 改成 `https://app.voxflame.com`
- 如果决定把 signaling 独立出来，再把 `LIVEKIT_BROWSER_URL` 显式改成 `wss://rtc.voxflame.com`

### 6.2 正式 LiveKit 生产化

- 不再使用默认开发密钥
- 补正式 API key / secret 管理
- 打开 TURN/TLS
- 为 `app / rtc / turn` 做正式域名与证书规划
- 评估单独公网 IP 或 L4/SNI 路由，避免网站 HTTPS 与 TURN/TLS 同抢 `443`
- 打开公网 UDP 媒体端口范围
- 评估是否引入 Redis 作为单机以外的生产依赖

官方参考：
- LiveKit self-hosting deployment：https://docs.livekit.io/transport/self-hosting/deployment/
- LiveKit ports & firewall：https://docs.livekit.io/transport/self-hosting/ports-firewall/
- LiveKit VM guide：https://docs.livekit.io/transport/self-hosting/vm/

## 7. 时间评估

### 7.1 今天的 HTTPS 公网预览

- 机器改造 + 容器验证：约 `0.5 ~ 1` 天
- 如果腾讯云安全组已允许 `80/443`：通常当天可完成

### 7.2 大陆正式上线

- 域名购买与实名：约 `0.5 ~ 1` 天
- 腾讯云初审：通常 `1 ~ 2` 个工作日
- 管局审核：通常 `几天到 20 个工作日以内`
- 备案完成后的正式切换：约 `0.5 ~ 1` 天

## 8. 验收标准

- 浏览器通过 `https://...` 打开首页
- `/api/rtc/health` 可从同域 HTTPS 正常访问
- 后端创建 RTC session 时返回浏览器可用的 `wss://...` LiveKit URL
- LiveKit room 可从外网浏览器成功连接
- LiveKit 日志里用户 participant 不再以 `SIGNAL_SOURCE_CLOSE` 在 `sessionDuration: 0s` 关闭
- ICE 日志里至少能看到可用的 `udp/tcp/relay` 之一成功建立
- 语音链路至少完成一次真实麦克风 smoke

## 9. 当前结论

- 这次改造已经把“公网 HTTPS 预览接口”需要的代码路径补齐。
- 你现在缺的主要是：
  - 腾讯云安全组确认 `80/443`
  - 是否从当前 `IP 预览入口` 切到你自己的正式备案域名
  - 中国大陆正式上线所需备案时间

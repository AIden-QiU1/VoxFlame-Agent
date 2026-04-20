# 腾讯云中国大陆正式上线步骤

> 更新时间：2026-04-20
> 适用范围：当前 VoxFlame 仓库的现役主链 `frontend -> backend -> self-hosted livekit-server -> livekit_agent`
> 目标：把“服务器已跑起来、端口大多已开”的状态，推进到“正式域名、HTTPS、备案完成、可对外发布”的上线状态。

## 先说结论

- 现在最短、最稳的正式上线路径，不是先买一堆独立 `rtc/turn` 域名和托管证书，而是先完成：
  1. 买 1 个可备案主域名
  2. 做域名实名认证
  3. 在腾讯云完成网站 ICP 首次备案
  4. 把 `app.<你的主域名>` 解析到当前 CVM
  5. 继续使用仓库现成的 `Caddy + 自动 HTTPS` 路径上线
- 对当前仓库来说，“正式上线第一阶段”的推荐形态是：
  - 一个正式访问域名，例如 `app.example.com`
  - `Caddy` 终止 HTTPS
  - 前端与 `/api`、`/rtc` 走同一个 HTTPS 域名
  - LiveKit 先继续使用当前单机形态的 `TURN/UDP + WebRTC TCP/UDP`
- 当前仓库还不适合把“独立 `turn.example.com` + TURN/TLS + 单公网 IP”直接写成现成步骤：
  - `Caddy` 已占用网站侧 `443`
  - `infra/livekit/start-livekit.sh` 当前读取的是 `VOXFLAME_PUBLIC_HOST` 证书目录，不是独立 `turn` 域名证书目录
  - 所以 `TURN/TLS` 应该放到第二阶段，等入口架构调整后再开

## 当前仓库上线边界

### 已经具备的能力

- `docker-compose.yml` 已提供 `https` profile，对应 `caddy` 容器。
- `infra/caddy/Caddyfile` 已能把正式域名入口转发到：
  - 前端首页与应用：`127.0.0.1:3000`
  - `/rtc`：`127.0.0.1:7880`
- backend 已支持通过 `VOXFLAME_PUBLIC_BASE_URL` 自动推导浏览器侧 `wss://...` 地址。
- `livekit-server` 已使用 `host network`，适合当前单机公网部署。

### 本文不假装已经完成的能力

- 不是完整的“多域名 LiveKit 官方推荐生产架构”。
- 不是“公司网络/校园网/高限制网络下覆盖率最高”的 TURN/TLS 终态。
- 不是“腾讯云托管证书一键接入当前仓库”的现成方案。

## 第 0 步：先定正式入口，不要边买边想

正式上线前，先把下面 3 个决定定死：

1. 备案主体是谁
   - 推荐：企业主体。
   - 如果暂时只能个人备案，也能先上线，但后续品牌扩展、服务内容和风控空间会更受限。
2. 正式主域名是什么
   - 推荐：优先选 `.com` 或 `.cn` 这类常见、可备案、长期稳定的后缀。
   - 不要为了“看起来酷”先选难备案或后缀规则特殊的域名。
3. 第一阶段只用哪个访问子域名
   - 推荐：只先定一个，例如 `app.example.com`。
   - 不要把 `rtc.example.com`、`turn.example.com` 一开始就写进正式上线必须项。

建议直接用下面这套命名：

- 备案主域名：`example.com`
- 第一阶段正式入口：`app.example.com`
- 可选品牌跳转：`www.example.com`

这样做的原因是：

- 腾讯云备案针对的是二级主域名；二级主域名备案完成后，三级、四级子域名可以继续使用。
- 当前仓库最稳的入口就是一个正式 HTTPS 域名承接首页、API 和 `/rtc`。

## 第 1 步：购买域名

在腾讯云完成域名购买，建议按下面方式做：

1. 在腾讯云创建或确认已存在可用的域名信息模板。
2. 用已经通过实名审核的信息模板购买域名。
3. 购买时直接打开自动续费。
4. 先买主域名，不急着先买一堆防御性后缀。

推荐你在腾讯云控制台购买时重点确认：

- 域名后缀可备案。
- 域名所有者与未来备案主体一致。
- 域名有效期不少于 1 年。
- 自动续费已开启。

不要忽略的事实：

- 域名注册和腾讯云账号实名认证不是一回事。
- 域名还需要单独完成域名实名认证。

## 第 2 步：完成域名实名认证，并等满备案要求的时间

买完域名后，不要马上提备案，先做这一步：

1. 确认域名实名认证状态已通过。
2. 确认域名没有处于 `Serverhold` 或未实名状态。
3. 如果域名是在腾讯云注册，实名认证通过后至少等满 `3` 个自然日再提备案。

这里一定要卡住节奏，因为这是备案的硬门槛之一。

如果这一段没等够，后面大概率会在备案阶段被退回。

## 第 3 步：准备备案材料

在腾讯云备案小程序开始填单前，把材料一次性准备好：

### 主体材料

- 企业备案：
  - 营业执照
  - 法定代表人信息
  - 主体负责人和服务负责人信息
- 个人备案：
  - 身份证
  - 与腾讯云账号绑定一致的手机号

### 域名材料

- 域名实名认证截图
  - 需能看到域名
  - 域名所有者
  - 证件类型
  - 证件号码
  - 域名过期时间

### 站点材料

- 网站名称
- 网站服务内容
- 服务语言
- 通信地址
- 负责人邮箱和手机号

提前统一口径：

- 备案主体信息必须和域名实名认证信息对得上。
- 如果是网站备案，只需要备案二级主域名，不需要把 `app.example.com` 这种三级子域名单独当成备案主体。

## 第 4 步：在腾讯云发起 ICP 首次备案

当前这套场景是“腾讯云中国大陆 CVM 上的网站正式上线”，因此应按“首次备案”流程推进。

执行顺序：

1. 打开腾讯云备案小程序。
2. 选择 `网站/域名`。
3. 选择当前中国大陆云资源作为备案云资源。
4. 填写主体信息。
5. 填写网站/域名信息。
6. 上传补充材料。
7. 完成短信核验。
8. 等待管局审核通过。

填写时最容易踩坑的地方：

- 腾讯云账号实名认证名称、备案主体名称、域名实名认证名称必须能对上。
- 备案负责人手机号、主体负责人手机号、服务负责人手机号要真实可接通。
- 服务负责人要按要求做视频核身。
- 如果你未来想外显的正式入口是 `app.example.com`，备案时仍然以主域名 `example.com` 为核心去做。

## 第 5 步：备案通过后，再做正式 DNS 解析

备案通过后，开始把正式域名接到当前机器。

第一阶段推荐只做这些记录：

- `app.example.com -> 当前 CVM 公网 IP`，记录类型 `A`
- 如果你想保留主域名访问：
  - `example.com -> 当前 CVM 公网 IP`
- 如果你想保留 `www`：
  - `www.example.com -> 当前 CVM 公网 IP`

不建议第一阶段就加的记录：

- `rtc.example.com`
- `turn.example.com`

原因不是这些域名永远不用，而是：

- 当前仓库上线第一阶段不需要它们才能正式发布。
- 现在先把“一个稳定入口域名”做成，比把多域名表面上配齐更重要。

DNS 设置建议：

- 线路：默认
- TTL：先用默认值或 `600`
- 解析完成后，用 `dig` 或 `nslookup` 确认已解析到当前公网 IP

## 第 6 步：证书方案不要先想复杂

这一段最重要的结论是：

- 域名一定要买。
- 证书不一定要先买。

对当前仓库，正式上线第一阶段最推荐的证书方案是：

- 继续使用仓库现有 `Caddy` 自动签发和续期 HTTPS 证书。

这样做的原因：

- 当前仓库已经内置 `Caddyfile`。
- 只要 `app.example.com` 正确解析到当前 CVM，且 `80/443` 已放通，`Caddy` 就能自动签发证书。
- 你不需要先额外购买腾讯云 SSL 证书，才能把网站正式跑起来。

什么时候才建议额外买腾讯云证书：

- 公司合规要求必须统一走腾讯云 SSL 控制台管理。
- 需要人工售后、品牌型证书或更集中化的证书资产管理。
- 你准备把 TLS 终止迁到 CLB、Nginx 或其他入口层，而不是继续让仓库里的 `Caddy` 承担。

这意味着：

- 如果你要的是“尽快正式上线”，现在先买域名，不必把“买证书”当成阻塞项。
- 如果你要的是“企业化证书资产治理”，那是第二条实施路线，需要额外改部署入口。

## 第 7 步：把生产变量换成正式域名

备案通过、DNS 生效后，把部署变量从公网 IP 预览值切到正式域名。

第一阶段推荐值：

```bash
VOXFLAME_PUBLIC_HOST=app.example.com
VOXFLAME_PUBLIC_BASE_URL=https://app.example.com
LIVEKIT_CONFIG_FILE=./infra/livekit/livekit.public.yaml
LIVEKIT_SERVER_DEV_MODE=0
VOXFLAME_LIVEKIT_TURN_UDP_PORT=3478
VOXFLAME_LIVEKIT_TURN_TLS_ENABLED=0
```

几个关键说明：

- `VOXFLAME_PUBLIC_HOST`
  - 直接写正式访问域名，例如 `app.example.com`
- `VOXFLAME_PUBLIC_BASE_URL`
  - 直接写 `https://app.example.com`
- `LIVEKIT_BROWSER_URL`
  - 第一阶段可以不显式写，让 backend 从 `VOXFLAME_PUBLIC_BASE_URL` 推导出浏览器侧 `wss://app.example.com`
- `VOXFLAME_LIVEKIT_TURN_TLS_ENABLED`
  - 第一阶段继续保持 `0`
  - 不要在当前单 IP + 当前仓库入口结构下直接强行打开

上线前还要补两件事：

1. 把 `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` 从开发默认值换成生产值。
2. 检查 `infra/livekit/livekit.public.yaml` 里的 `node_ip` 仍然是当前 CVM 的真实公网 IP。

如果当前公网 IP 已变更而你没改这里，外网 RTC 会继续异常。

## 第 8 步：用正式域名启动生产栈

当前仓库建议直接沿用 `https` profile。

启动命令：

```bash
sudo env \
  VOXFLAME_PUBLIC_HOST=app.example.com \
  VOXFLAME_PUBLIC_BASE_URL=https://app.example.com \
  LIVEKIT_CONFIG_FILE=./infra/livekit/livekit.public.yaml \
  LIVEKIT_SERVER_DEV_MODE=0 \
  VOXFLAME_LIVEKIT_TURN_UDP_PORT=3478 \
  VOXFLAME_LIVEKIT_TURN_TLS_ENABLED=0 \
  docker compose --profile https up -d --build livekit-server backend frontend livekit-agent caddy
```

如果你已经提前把这些值写进环境文件或系统环境，也可以直接：

```bash
sudo docker compose --profile https up -d --build livekit-server backend frontend livekit-agent caddy
```

## 第 9 步：确认 Caddy 已签发正式证书

启动完成后，先看证书是否真的签成功。

建议按顺序检查：

```bash
curl -I http://app.example.com
curl -I https://app.example.com
curl -I https://app.example.com/api/rtc/health
sudo docker compose logs --tail=100 caddy
sudo docker compose logs --tail=100 backend
sudo docker compose logs --tail=100 livekit-server
```

你应当看到的结果：

- `http://app.example.com` 会跳转到 `https://app.example.com`
- `https://app.example.com` 返回正常响应
- `https://app.example.com/api/rtc/health` 返回健康检查响应
- `caddy` 日志里没有持续的证书签发失败

如果证书签不下来，优先检查：

1. `app.example.com` 是否已解析到当前 CVM 公网 IP
2. 腾讯云安全组是否已放通 `80/tcp` 与 `443/tcp`
3. 当前机器是否还有其他进程占用了 `80/443`

## 第 10 步：做正式上线前的 RTC 冒烟

网站能打开还不够，必须补一次语音链路验证。

正式上线前至少做这 5 项：

1. 浏览器通过 `https://app.example.com` 打开首页
2. 浏览器可以授权麦克风
3. 前端能成功创建 RTC session
4. LiveKit room 能真实连上
5. 至少完成一次真实麦克风沟通 smoke

额外建议确认：

- `livekit-server` 日志里不再出现刚连上就 `sessionDuration: 0s` 关闭
- 浏览器端不再频繁提示“当前网络没能建立实时语音连接”
- 外网手机网络与普通家庭宽带各测一次

## 第 11 步：把“正式对外发布”和“更强网络覆盖”拆成两阶段

这是这次文档改写里最重要的边界判断。

### 第一阶段：先正式发布

达到下面条件，就可以算正式上线：

- 正式域名已购买
- 域名实名认证已完成
- ICP 备案已通过
- 正式 DNS 已切到当前 CVM
- `Caddy` 已签发正式 HTTPS
- 首页、API、RTC 基础链路都能从公网访问
- 至少完成一次真实语音 smoke

### 第二阶段：再补 TURN/TLS 终态

只有当你准备提升在公司网络、校园网、强限制网络下的 RTC 成功率时，再进入这一阶段。

当前仓库要做这一步，至少还要先解决入口架构问题，例如：

1. 为 TURN/TLS 提供独立公网 IP
2. 在 LiveKit 前增加 L4 负载均衡
3. 调整证书挂载路径和 `turn` 域名证书读取方式
4. 放开 `443` 到 TURN/TLS 或重做 443 端口分配
5. 按 LiveKit 正式生产要求评估 `50000-60000/udp`

在这些前提没做完前，不建议把：

```bash
VOXFLAME_LIVEKIT_TURN_TLS_ENABLED=1
VOXFLAME_LIVEKIT_TURN_DOMAIN=turn.example.com
```

直接当成“今天就能开的现成步骤”。

## 第 12 步：正式上线后要立刻做的 4 件事

1. 打开域名自动续费
2. 记录备案号、备案密码与审核主体材料的存放位置
3. 记录当前生产环境变量和公网 IP
4. 把上线 smoke 命令和日志命令保存到运维手册

建议至少固定保留这几条命令：

```bash
curl -I https://app.example.com
curl -I https://app.example.com/api/rtc/health
sudo docker compose ps
sudo docker compose logs --tail=200 caddy
sudo docker compose logs --tail=200 backend
sudo docker compose logs --tail=200 livekit-server
sudo docker compose logs --tail=200 livekit-agent
```

## 上线验收标准

- 用户通过 `https://app.example.com` 能稳定打开首页
- 页面属于 secure context，可正常申请麦克风权限
- backend 返回的 RTC session 中浏览器侧地址与正式域名一致
- LiveKit room 可从公网浏览器真实连接
- 至少完成一次真实语音沟通 smoke
- 当前正式入口不再依赖公网 IP 证书预览地址

## 当前推荐执行顺序

如果你现在就准备往前推进，直接按这个顺序做：

1. 买主域名
2. 完成域名实名认证
3. 等满 `3` 个自然日
4. 准备备案材料并提交腾讯云首次备案
5. 备案通过后添加 `app.<主域名>` 的 `A` 记录
6. 把部署变量切到正式域名
7. 用 `docker compose --profile https up -d --build ...` 启动
8. 确认 `Caddy` 自动签发证书成功
9. 做一次完整的公网语音 smoke
10. 通过后再把外部入口、品牌物料和用户测试链接全部切到正式域名

## 官方参考

- 腾讯云域名注册购买指南：
  https://cloud.tencent.com/document/product/242/9595
- 腾讯云域名实名认证：
  https://cloud.tencent.com/document/product/242/6707
- 腾讯云域名与备案相关 FAQ：
  https://cloud.tencent.com/document/product/242/60959
- 腾讯云首次备案：
  https://cloud.tencent.com/document/product/243/37402
- 腾讯云准备 ICP 备案域名：
  https://cloud.tencent.com/document/product/243/18905
- 腾讯云免费 SSL 证书概述：
  https://cloud.tencent.com/document/product/400/89868
- 腾讯云 SSL 证书托管指引：
  https://cloud.tencent.com/document/product/400/55818
- LiveKit self-hosting deployment：
  https://docs.livekit.io/transport/self-hosting/deployment/
- LiveKit ports and firewall：
  https://docs.livekit.io/transport/self-hosting/ports-firewall/
- LiveKit deploy to a VM：
  https://docs.livekit.io/transport/self-hosting/vm/

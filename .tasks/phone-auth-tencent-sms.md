# Phone Auth + Tencent SMS Execution Plan

## 1. Task

- 标题：为 Web 与 Mobile Workbench 增加独立手机号注册 / 登录
- 日期：2026-07-31
- 负责人：Codex + VoxFlame 负责人
- 相关需求：腾讯云短信签名、正文模板与付费套餐已就绪；CAM 最小权限子用户凭据已保存到服务器

## 2. Context

- 当前现状：Web 和 Mobile 已使用 Supabase Auth 邮箱密码登录；手机号是新增的并列注册 / 登录方式，不替代邮箱。
- 已知约束：允许 phone-only 用户拥有独立 Supabase UUID，不要求与邮箱账号绑定或自动合并；短信密钥只能留在 backend；Supabase Send SMS Hook 需要 5 秒内完成。
- 相关文件：`backend/src/index.ts`、`frontend/src/app/(auth)/login/page.tsx`、`apps/mobile-workbench/src/auth/use-mobile-auth.ts`、`apps/mobile-workbench/App.tsx`。

## 3. Governance Inventory

- 入口层：Web 登录页、Web 账号设置、Mobile 登录页、Mobile 我的页。
- 服务层：Supabase Auth SDK、backend Send SMS Hook、Tencent Cloud SMS SendSms API。
- 存储层：Supabase `auth.users` 是身份唯一事实源；本次不新增身份表。
- 旁路层：认证日志、腾讯云短信发送状态、Supabase Auth rate limit。
- 运行路径：邮箱密码注册 / 登录继续运行；手机号 OTP 可直接注册或登录；登录态绑定页仅作为可选能力保留。
- 历史残留：误建的 CVM 服务角色不进入运行链路；轻量应用服务器使用 CAM 编程访问子用户凭据。

## 4. Source Of Truth And Path Classification

- 唯一事实源：Supabase Auth 用户 UUID。
- `current`：邮箱密码登录。
- `current`（新增）：手机号 OTP 注册 / 登录；登录态手机号绑定为可选入口。
- `compat`：无。
- `deprecated`：无。
- `dead`：未绑定的 CVM 角色。
- 退出条件：真实短信 smoke、Web/Mobile 注册与登录 smoke 全部通过。

## 5. Problem

- 核心问题：让用户可以直接使用中国大陆手机号注册并用短信验证码登录，同时继续保留邮箱注册 / 登录。
- 不在范围：国际手机号、邮箱与手机号账号自动合并、营销短信。

## 6. Success Criteria

- 手机号注册创建独立 phone-only Supabase 用户；后续手机号登录回到该用户。
- 邮箱注册 / 登录不被替代，也不要求与手机号账号共用 UUID。
- Hook 拒绝无效签名、非大陆号码、非 6 位 OTP 和超限请求。
- OTP、SecretKey、完整手机号不出现在源码、响应或日志。
- Web 与 Android/iOS 共用同一 Supabase Auth 身份和 backend Hook。

## 7. Guardrails

- 产品：手机号和邮箱是并列入口；手机号注册不要求先登录邮箱账号。
- 工程：backend 是腾讯云短信唯一调用点；客户端不持有腾讯云密钥。
- 安全：默认 `PHONE_AUTH_ENABLED=0`、默认 `TENCENT_SMS_DRY_RUN=1`；校验 Standard Webhooks 签名；限流与幂等。
- 隐私：日志只记录掩码号码和 provider request id。
- 防扩散守卫：注册模式 `shouldCreateUser: true`、登录模式 `shouldCreateUser: false`、中国大陆号码校验、针对性测试。

## 8. Assumptions

1. 腾讯云模板只有一个参数 `{1}`，对应 6 位 OTP。
2. Supabase 项目继续作为 Auth 唯一事实源。
3. CAPTCHA 在 Web 和 Mobile 都接入 token 后再全局开启。

## 9. Plan

1. 实现并测试 Tencent SMS adapter 与 Supabase Send SMS Hook。
2. 以 dry-run 部署 backend，完成签名 webhook smoke。
3. 增加 Web/Mobile 的手机号注册和登录；保留可选绑定入口。
4. 真实发送一条测试短信，检查腾讯云状态。
5. 配置 Supabase Hook、Phone provider、OTP/限流；完成双端回归后启用。

## 10. Files And Systems Expected To Change

- `backend/src/controllers/auth-hook.controller.ts`
- `backend/src/services/tencent-sms.service.ts`
- `backend/src/services/supabase-sms-hook.service.ts`
- `frontend/src/app/(auth)/login/page.tsx` 与账号设置入口
- `apps/mobile-workbench/src/auth/use-mobile-auth.ts`
- `apps/mobile-workbench/App.tsx`
- `.env.example`、`backend/.env.example`、状态文档

## 11. Validation

- Backend：TypeScript build、adapter/hook 单元测试、签名 dry-run HTTP smoke。
- Frontend：目标测试、TypeScript、production build、登录和绑定页面 smoke。
- Mobile：static check、TypeScript、Android/iOS production export。
- Production：手机号注册和再次登录各验证一次；邮箱登录回归一次。

## 12. Risks And Rollback

- 主要风险：用户用邮箱和手机号分别注册后形成两个独立账号、短信轰炸、Hook 重试重复计费、全局 CAPTCHA 提前阻断 Mobile。
- 回退：将 `PHONE_AUTH_ENABLED=0` 并在 Supabase 关闭 Phone provider/Hook；邮箱登录完全保留。
- 观察：Hook 2xx/4xx/5xx、Tencent `RequestId`/`Code`、Supabase Auth rate limit；不记录 OTP。

## 13. Notes During Execution

- 轻量应用服务器不支持按 CVM 实例绑定标准服务角色，本次使用最小权限 CAM 编程访问子用户。
- 2026-07-31：后端签名 HTTP dry-run 已返回 `200 {}`，日志仅包含掩码号码。
- 2026-07-31：Web、Android 与 iOS 代码切片均通过构建；生产开关未打开。
- 2026-08-01：backend/frontend 安全关闭版本已部署；容器 healthy，公网主页、登录页和 RTC health 均为 `200`，邮箱登录保留，手机号入口仍隐藏。
- 2026-08-01 安全关闭部署时：腾讯云短信凭据与模板配置已正确注入 backend；当时 Supabase Hook Secret 尚未配置，Send SMS Hook 在关闭状态下按设计返回 `404`。
- 2026-08-01：Supabase HTTPS Send SMS Hook 与 Hook Secret 已配置；backend 开启 Hook 接收但继续 `TENCENT_SMS_DRY_RUN=1`，合法签名返回 `200 {}`，伪造签名返回 `401`，未发送真实短信。
- 2026-08-01：按产品决定改为独立手机号注册 / 登录；Web 与 Mobile 已按注册 / 登录模式分别发送 `shouldCreateUser: true / false`。
- 2026-08-01：生产 Phone provider、Send SMS Hook、Web 与 EAS 三套 Mobile 公共开关已开启；backend 已切真实发送模式。
- 2026-08-01：修复 Supabase Hook 在生产实际传入 `861...`（无 `+`）号码时的兼容问题，后端统一规范化为 `+861...` 后再限流和发送。
- 2026-08-01：真实请求已到达腾讯云，但被 `FailedOperation.SignatureIncorrectOrUnapproved` 拒绝；当前配置与原计划的公司全称一致，仍需在控制台核对实际签名内容、审核 / 运营商报备状态及其与应用的关联。CAM 子用户没有 `sms:DescribeSmsSignList`，无法从 API 自动读取。
- 2026-08-01：Android `0.1.2`（build 3）EAS preview 构建完成，构建 ID `b47cd371-ef9f-409f-a45d-1e1d180a26dd`，网站下载页已切换到该构建。

## 14. Final Outcome

- 已完成：backend Hook / Tencent adapter、Web 与 Mobile 的并列邮箱 / 手机注册登录、可选账号绑定、安全开关和回归守卫。
- 已完成验证：backend tests/build/HTTP dry-run，Web 65 tests/typecheck/build/Playwright UI smoke，Mobile check/typecheck/Android export/EAS build。
- 未完成：确认腾讯云签名审核 / 报备 / 应用关联状态后发送一条真实短信，以及 Web / Android 真机完成 OTP 注册与再次登录。
- 当前生产状态：Phone Auth 与双端公共入口已开启；邮箱登录行为不变；真实短信会因签名配置不一致返回失败，尚未产生短信费用。
- 生产回滚镜像：`voxflame-agent-backend:pre-phone-auth-20260801`、`voxflame-agent-frontend:pre-phone-auth-20260801`。

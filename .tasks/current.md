# 当前任务状态

> VoxFlame 语音数据收集与标注系统
> 最后更新: 2026-01-26

## ✅ 已完成 (Completed)

### 1. 基础设施 (Infrastructure)
- [x] **Supabase 数据库**: 完成 `voice_contributions` 表设计与部署。
- [x] **Aliyun OSS**: 完成 Bucket 配置与 SDK 集成。
- [x] **Backend API**: 实现 `upload` 接口与完整数据及其元数据存储。
- [x] **全链路验证**: 验证前端录音 -> OSS -> DB 流程畅通。

### 2. 维护与优化 (Maintenance)
- [x] 修复 `sentences.ts` 语法与 ID 问题。
- [x] 规范数据库 Migration 版本管理。

### 3. 环境与架构修复 (Environment Fixes) - **NEW**
- [x] **Frontend Login**: 修复 Login 页面的 JSX 语法错误与文本描述。
- [x] **Environment Architecture**:
    - 创建 `docs/CONFIGURATION_AND_ENV_GUIDE.md` 规范环境配置。
    - 优化 `docker-compose.yml` 显式加载子模块 `.env`。
    - 修复 `frontend/next.config.js` 使用 `BACKEND_INTERNAL_URL` 解决 Docker/Local 连接地址冲突。
- [x] **PWA**: 确认 PWA 功能已在 Next.js 配置中启用。

---

## 🚧 进行中: 系统验证与 Agent 调试

**目标**: 将 Supabase Auth 深度集成到 前端、后端 与 Ten Agent 流程中。

### 1. 架构设计 (Architecture)

#### A. 前端 (Frontend)
- **Tech**: `shadcn/ui` + `@supabase/auth-helpers-nextjs`.
- **Flow**:
  1. 用户在 `/login` 页面使用 手机/邮箱 登录。
  2. 获取 Supabase Session (`access_token`).
  3.在连接 WebSocket 时，将 Token 附加到 URL: `ws://host/ws/agent?token=jwt...`.

#### B. 后端代理 (Backend Proxy)
- **Tech**: Node.js `ws` + `supabase-js`.
- **Flow**:
  1. 拦截 `/ws/agent` 连接请求。
  2. 验证 Query Param 中的 Token。
  3. 从数据库 (`user_profiles`) 获取用户详细画像 (`preferences`, `hotwords`, `disability_type`).
  4. 建立与 Ten Agent 的连接。
  5. **关键步骤**: 在转发音频前，先发送一条 `system_init` 指令给 Agent，携带完整的用户上下文。

#### C. Ten Agent (Core)
- **Tech**: Python Extensions (`voxflame_main_python`).
- **Flow**:
  1. `websocket_server` 接收连接。
  2. `main_control` 接收 `system_init` JSON 数据。
  3. 更新 Session Context：
     - **Corrector**: 设置 `user_profile` 用于 LLM 纠错 Prompt。
     - **Memory**: 设置 `user_id` 用于 Qdrant 向量检索过滤。
     - **TTS**: 设置 `speed`/`volume` 偏好。

### 2. 待办任务清单 (To-Do)

#### Phase 1: 登录界面与状态
- [ ] 配置 Supabase Auth Providers (Email).
- [ ] 开发 `/login`, `/register`, `/auth/callback` 页面。
- [ ] 创建 `useAuth` Hook 或集成 Context。

#### Phase 2: 后端鉴权代理
- [ ] 改造 `backend/src/index.ts` 中的 WebSocket Handler。
- [ ] 实现 Token 验证与 Profile 预加载逻辑。

#### Phase 3: Agent 上下文感知
- [ ] 修改 `ten_agent` 的 `main_control` 扩展，支持处理 `system_init` 消息。
- [ ] 联调：确保 LLM 知道"我是谁"以及"我的发音特点"。

---

## 📋 待办 (Backlog)

### 记忆系统 (Memory)
- [ ] 基于 Qdrant 的向量记忆存储 (需配合 User ID).


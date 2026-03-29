# VoxFlame Backend

backend 当前是控制面和业务面，不再代理运行时 websocket 音频链路。

## 技术栈

- Express.js + TypeScript
- Supabase PostgreSQL
- REST API

## 当前职责

- RTC session orchestration
- workspace / memory API
- phrases API
- upload API
- compat 路由的受控兜底

## 当前主链

```text
Frontend
  -> Backend /api/rtc/session/*
  -> TEN Agent control server
```

## 快速开始

### Docker (推荐)

```bash
# 从项目根目录
sudo docker-compose up -d backend
```

### 本地开发

```bash
cd backend
npm install
npm run dev
```

服务运行在 `http://localhost:3001`

## 核心功能

### RTC orchestration

当前 backend 负责 RTC + RTM 会话编排：

```
Frontend (3000) → Backend (3001/api/rtc/*) → TEN Agent control server (8080)
```

### API 端点

### 核心 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/rtc/health` | GET | RTC orchestration 健康检查 |
| `/api/rtc/session/start` | POST | 启动 RTC + RTM 会话 |
| `/api/rtc/session/ping` | POST | 保活 RTC 会话 |
| `/api/rtc/session/stop` | POST | 停止 RTC 会话 |

### Workspace / 记忆系统 API

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/memory/workspace/:userId` | GET | 统一 workspace 快照：`profile bundle + session review + expression kit` | ✅ |
| `/api/memory/workspace/:userId/preferences` | PUT | 保存 durable `communication_preferences` | ✅ |
| `/api/memory/profile/:userId` | GET | 统一 memory profile 聚合 | ✅ |
| `/api/memory/add` | POST | 添加记忆 | ✅ |
| `/api/memory/search` | GET | 语义检索记忆 | ✅ |
| `/api/memory/:memoryId` | PUT | 更新记忆 | ✅ |
| `/api/memory/:memoryId` | DELETE | 删除记忆 | ✅ |

**添加记忆请求示例**:
```json
{
  "user_id": "uuid",
  "content": "用户喜欢用简短句子表达",
  "memory_type": "preference",
  "metadata": { "source": "conversation" }
}
```

**检索记忆请求示例**:
```
GET /api/memory/search?user_id=xxx&query=用户偏好&limit=10
```

### Agent Compat API

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/agent/session/log` | POST | compat-only，现仅返回迁移指引 | ✅ |
| `/api/agent/session/history/:userId` | GET | compat-only，现仅返回迁移指引 | ✅ |
| `/api/agent/tool/log` | POST | compat-only，现仅返回迁移指引 | ✅ |
| `/api/agent/tool/execute` | POST | compat-only，现仅返回迁移指引 | ✅ |

### 常用短语 API

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/phrases` | POST | 创建短语 | ✅ |
| `/api/phrases/user/:userId` | GET | 获取用户短语 | ✅ |
| `/api/phrases/:phraseId` | PUT | 更新短语 | ✅ |
| `/api/phrases/:phraseId` | DELETE | 删除短语 | ✅ |
| `/api/phrases/:phraseId/use` | POST | 增加使用次数 | ✅ |
| `/api/phrases/reorder` | POST | 重排序短语 | ✅ |
| `/api/phrases/presets/initialize` | POST | 初始化预设 | ✅ |

## 环境变量

```bash
# .env
PORT=3001
TEN_AGENT_SERVER_URL=http://ten-agent:8080

# Supabase (认证 + 数据库)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # 后端管理操作

# 记忆系统 (可选)
QDRANT_URL=http://qdrant:6333  # Phase 3
```

## 开发说明

- 新实时能力应接在 `/api/rtc/session/*` 或明确的业务 API 下。
- 不要恢复 backend 运行时 websocket proxy。
- 训练、沟通、记忆相关状态应分别落在 service/controller 分层里，不要堆进 `index.ts`。
- 新的 durable user state 默认应落到 `workspace owner`：
  - 读：`/api/memory/workspace/:userId`
  - 写：`/api/memory/workspace/:userId/preferences`
- 旧的 `/api/agent/profile/:userId` 与 `/api/agent/hotwords/:userId` 已从服务中移除；若仍有外部调用，应改到 `workspace owner` 或 `memory profile`。

## 相关文档

- [主项目 README](../README.md)
- [前端 README](../frontend/README.md)
- [Agent README](../ten_agent/README.md)
- [统一记忆系统报告](../docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)

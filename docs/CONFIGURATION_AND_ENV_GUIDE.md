# VoxFlame 配置与环境架构指南 (Configuration & Environment Architecture)

> **核心原则**: 显式优于隐式 (Explicit > Implicit)，构建时与运行时分离 (Build vs Runtime Separation)。

本文档详细说明了 VoxFlame 项目的环境变量管理策略，旨在解决 Next.js (Build-Time) 与 Docker (Runtime) 之间的配置矛盾。

---

## 一、 环境变量的分层架构

VoxFlame 采用三层环境变量架构，确保在本地开发、Docker 容器化和生产部署中的一致性。

| 层级 | 位置 | 作用域 | 用途 |
|------|------|--------|------|
| **L1: 编排层** | `/.env` | **Docker Compose** | 为 `docker-compose.yml` 提供变量插值 (Interpolation)，如 Supabase URL。 |
| **L2: 服务层** | `./backend/.env`, `./ten_agent/.env` | **Runtime (Local/Docker)** | 后端服务的运行时配置 (API Key, Port)。Docker 通过 `env_file` 加载。 |
| **L3: 构建层** | `args` inside `docker-compose.yml` | **Build Time (Frontend)** | **仅限前端**。在 Docker 构建镜像时，将 L1 的变量通过 `ARG` 注入到 Next.js 静态资源中。 |

---

## 二、 前端特殊性：构建时注入 (Build-Time Injection)

Next.js 应用在 Docker 构建阶段 (`npm run build`) 会将 `NEXT_PUBLIC_` 变量硬编码到生成的 JavaScript/HTML 文件中。

### ❌ 常见错误
在 Docker 运行时设置 `environment: - NEXT_PUBLIC_API_URL=...` 对已经构建好的 Next.js 静态页面**无效**。

### ✅ 正确做法 (VoxFlame 方案)
1. **定义 ARG**: 在 `frontend/Dockerfile` 中声明 `ARG`。
2. **传递参数**: 在 `docker-compose.yml` 中使用 `build.args` 传递 L1 变量。

```yaml
# docker-compose.yml
frontend:
  build:
    args:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL} # 从 L1 (.env) 读取
```

---

## 三、 网络通信架构 (Networking)

为了解决 "Docker 内部通信" 与 "本地开发通信" 的地址差异，我们使用了 **内部/外部双地址策略**。

### 1. 浏览器 (Client) -> 后端
- **本地开发**: 直接访问 `localhost:3001`。
- **Docker/生产**: 访问 `localhost:3000/api` (前端)，由 Next.js Rewrite 转发到后端。

### 2. Next.js Server -> 后端 (Rewrite)
这是最容易出错的环节。Next.js 服务端需要知道后端的内网地址。

- **变量**: `BACKEND_INTERNAL_URL`
- **Docker 值**: `http://backend:3001` (Docker DNS)
- **Local 值**: `http://localhost:3001` (默认回退)

**配置代码 (`frontend/next.config.js`)**:
```javascript
const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
// Rewrite destination: `${backendUrl}/api/:path*`
```

---

## 四、 最佳实践总结

1.  **机密管理**: 敏感信息 (API Keys) 总是放在 `.env` 文件中，**绝不提交到 Git**。
2.  **单一数据源**: `docker-compose.yml` 是 Docker 环境的单一真理源，它显式定义了所有服务需要哪些环境变量。
3.  **本地开发**: 使用 `./start_services.sh` 时，各服务会优先读取自己目录下的 `.env` (L2)。请确保 L2 文件存在且正确。

## 五、 故障排查

- **Login Failed/Connection Refused**: 
    - 检查 `docker-compose.yml` 中的 `args` 是否正确传递了 Supabase URL。
    - 检查 `frontend/next.config.js` 中的 `BACKEND_INTERNAL_URL` 逻辑。
- **PWA 不工作**:
    - 确认 `NEXT_PUBLIC_API_URL` 在构建时已正确注入。

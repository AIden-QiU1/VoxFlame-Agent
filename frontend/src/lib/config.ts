/**
 * VoxFlame 应用配置
 *
 * 支持两种访问模式：
 * 1. 直接访问 - localhost:3000 或 公网IP:3000
 * 2. 环境变量覆盖 - 通过 NEXT_PUBLIC_*_URL 指定
 *
 * WebSocket 和 API 自动根据页面协议选择 ws/wss 和 http/https
 */

// 获取当前主机名用于动态配置
function getHost(): string {
  if (typeof window === 'undefined') {
    return 'localhost'
  }
  return window.location.hostname
}

// 获取当前端口（在非标准端口时使用）
function getPort(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  const port = window.location.port
  // 标准端口不需要显示指定
  if (port === '80' || port === '443' || !port) {
    return ''
  }
  return `:${port}`
}

// 获取 WebSocket 协议（http->ws, https->wss）
function getWsProtocol(): string {
  if (typeof window === 'undefined') {
    return 'ws'
  }
  return window.location.protocol === 'https:' ? 'wss' : 'ws'
}

// 获取 HTTP 协议
function getHttpProtocol(): string {
  if (typeof window === 'undefined') {
    return 'http:'
  }
  return window.location.protocol
}

/**
 * 构建完整的基础 URL
 * @param protocol 协议 (ws/wss/http/https)
 * @param path 路径
 */
function buildUrl(protocol: string, path: string): string {
  const host = getHost()
  const port = getPort()
  return `${protocol}//${host}${port}${path}`
}

export const config = {
  // API 端点配置
  api: {
    /**
     * TEN Agent WebSocket 地址
     * 优先使用环境变量，否则根据当前页面动态构建
     * - localhost:3000 → ws://localhost:3001/ws/agent
     * - https://example.com → wss://example.com/ws/agent
     */
    get agentWsUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_WS_URL
      if (envUrl) {
        return envUrl
      }

      const protocol = getWsProtocol()
      const host = getHost()
      const port = getPort()

      // 本地开发：只在 host 是 localhost 时才使用 localhost:3001
      if (host === 'localhost') {
        return `${protocol}//localhost:3001/ws/agent`
      }

      // 生产环境：使用当前页面的 host，后端代理在 3001 端口
      // 如果是标准端口 (80/443) 并且有反向代理，使用相对路径
      if (!port || port === ':80' || port === ':443') {
        return buildUrl(protocol, '/ws/agent')
      }

      // 直接访问非标准端口时，使用 3001 端口连接后端代理
      return `${protocol}//${host}:3001/ws/agent`
    },

    /**
     * 后端 API 地址
     * 用于用户配置、工具执行、记忆管理
     * - 直接访问模式：使用绝对 URL 指向后端
     * - 环境变量：优先使用配置的 URL
     */
    get baseUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_API_URL
      if (envUrl) {
        // 环境变量配置的完整 URL
        return envUrl
      }

      const protocol = getHttpProtocol()
      const host = getHost()
      const port = getPort()

      // 本地开发：直接访问后端
      if (host === 'localhost') {
        return `${protocol}//localhost:3001/api`
      }

      // 生产环境：使用当前页面的 host，后端在 3001 端口
      // 如果是标准端口 (80/443) 并且有反向代理，使用相对路径
      if (!port || port === ':80' || port === ':443') {
        return '/api'
      }

      // 直接访问非标准端口时，使用 3001 端口连接后端
      return `${protocol}//${host}:3001/api`
    },
  },

  // 音频配置 - 固定 16kHz PCM
  audio: {
    sampleRate: 16000,
    bufferSize: 4096,
    ttsSampleRate: 16000,  // 与后端 TTS 一致
  }
}

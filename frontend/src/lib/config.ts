/**
 * VoxFlame 应用配置
 *
 * 单一 Agent 架构 - 只需要两个地址：
 * 1. TEN Agent WebSocket - 通过 Nginx 代理 (443/ws/agent) 连接
 * 2. 后端 API - 通过 Nginx 代理 (443/api) 连接
 *
 * HTTPS 部署说明：
 * - 生产环境必须使用 HTTPS，否则浏览器会禁用 getUserMedia API
 * - 使用 Nginx 反向代理处理 SSL/TLS 终止
 * - WebSocket 自动使用 wss:// 协议
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

export const config = {
  // API 端点配置
  api: {
    /**
     * TEN Agent WebSocket 地址
     * 通过 Nginx /ws/agent 路径代理
     * 自动根据页面协议选择 ws:// 或 wss://
     */
    get agentWsUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_WS_URL
      // 优先使用环境变量配置的 WebSocket 地址
      if (envUrl) {
        return envUrl
      }

      // 动态构建：使用当前页面的 host 和 port
      const protocol = getWsProtocol()
      const host = getHost()
      const port = getPort()
      return `${protocol}://${host}${port}/ws/agent`
    },

    /**
     * 后端 API 地址
     * 用于用户配置、工具执行、记忆管理
     * 使用相对路径，通过 Nginx 代理
     */
    get baseUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_API_URL
      if (envUrl && !envUrl.includes('localhost')) {
        return envUrl
      }
      // 使用相对路径，通过 Nginx /api/ 代理
      return '/api'
    },
  },

  // 音频配置 - 固定 16kHz PCM
  audio: {
    sampleRate: 16000,
    bufferSize: 4096,
    ttsSampleRate: 16000,  // 与后端 TTS 一致
  }
}

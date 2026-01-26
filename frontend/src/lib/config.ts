/**
 * VoxFlame 应用配置
 * 
 * 单一 Agent 架构 - 只需要两个地址：
 * 1. TEN Agent WebSocket - 通过后端代理 (3001/ws/agent) 连接
 * 2. 后端 API (3001) - 用户配置、记忆管理
 * 
 * 注意：由于 VSCode Remote 不支持 WebSocket 端口转发，
 * 我们通过后端 3001 端口代理 WebSocket 连接到 TEN Agent (8766)
 */

// 获取当前主机名用于动态配置
function getHost(): string {
  if (typeof window === 'undefined') {
    return 'localhost'
  }
  return window.location.hostname
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
     * 通过后端 3001 端口的 /ws/agent 路径代理
     * 解决 VSCode Remote 不支持 WebSocket 端口转发的问题
     */
    get agentWsUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_AGENT_WS_URL
      // 如果环境变量指定了非 localhost 地址，使用它
      if (envUrl && !envUrl.includes('localhost')) {
        return envUrl
      }

      // 使用相对路径，通过 Next.js Rewrite 代理到后端 (http://backend:3001)
      // 解决 CORS 和 VSCode Remote 端口转发问题
      const protocol = getWsProtocol()
      const host = getHost()
      return `${protocol}://${host}:${window.location.port || (protocol === 'wss' ? 443 : 80)}/ws/agent`
    },

    /**
     * 后端 API 地址
     * 用于用户配置、工具执行、记忆管理
     */
    get baseUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_API_URL
      if (envUrl && !envUrl.includes('localhost')) {
        return envUrl
      }
      // 使用相对路径，通过 Next.js Rewrite 代理
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

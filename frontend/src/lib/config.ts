/**
 * VoxFlame 应用配置
 * 
 * 单一 Agent 架构 - 只需要两个地址：
 * 1. TEN Agent WebSocket (8765) - 语音对话
 * 2. 后端 API (3001) - 用户配置、记忆管理
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
     * 用于语音识别、LLM 对话、语音合成
     */
    get agentWsUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_AGENT_WS_URL
      if (envUrl && !envUrl.includes('localhost')) {
        return envUrl
      }
      // 自动检测：使用当前页面的主机名
      const host = getHost()
      const protocol = getWsProtocol()
      return \`\${protocol}://\${host}:8765\`
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
      // 自动检测
      const host = getHost()
      const protocol = getHttpProtocol()
      return \`\${protocol}//\${host}:3001\`
    },
  },
  
  // 音频配置 - 固定 16kHz PCM
  audio: {
    sampleRate: 16000,
    bufferSize: 4096,
    ttsSampleRate: 22050,
  }
}

/**
 * 应用配置
 */
export const config = {
  // API 端点配置
  api: {
    // ASR WebSocket 服务地址 (Backend)
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws/asr',
    
    // Agent WebSocket 服务地址 (TEN Framework - 端口8765)
    agentWsUrl: process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:8765',
    
    // HTTP API 基础地址
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  
  // 音频配置
  audio: {
    sampleRate: 16000,
    bufferSize: 4096,
    ttsSampleRate: 22050,  // DashScope TTS output
  }
}

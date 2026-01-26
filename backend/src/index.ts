/**
 * VoxFlame Backend Server
 * 
 * 单一 Agent 架构 - 后端只负责：
 * 1. 用户配置管理
 * 2. 工具执行（电话、智能家居）
 * 3. 记忆系统（FAISS + Supabase）
 * 4. 会话日志
 * 5. WebSocket 代理 (解决 VSCode 端口转发限制)
 * 
 * 语音处理（ASR/LLM/TTS）完全由 TEN Agent (8766) 负责
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import { agentRouter } from './controllers/agent.controller'
import sessionRouter from './controllers/session.controller'
import { memoryController } from './controllers/memory.controller'
import { uploadRouter } from './controllers/upload.controller'
import { errorHandler } from './middlewares/error.middleware'
import { createClient } from '@supabase/supabase-js'

// 加载环境变量
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const TEN_AGENT_WS_URL = process.env.TEN_AGENT_WS_URL || 'ws://localhost:8766'

// Init Supabase for Auth Verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
// Warning if missing 
if (!supabaseUrl || !supabaseKey) {
  console.warn('[Backend] Supabase credentials missing. Auth verification will be skipped.')
}
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null


// 中间件
app.use(cors())
app.use(express.json())

// 创建 HTTP 服务器
const server = createServer(app)

// ========================================
// WebSocket 代理服务器
// 解决 VSCode Remote 不支持 WebSocket 端口转发的问题
// 前端连接 ws://localhost:3001 -> 代理到 -> ws://localhost:8766 (TEN Agent)
// ========================================
const wss = new WebSocketServer({ server, path: '/ws/agent' })

wss.on('connection', async (clientWs, req) => {
  console.log('[WS Proxy] 新客户端连接，正在代理到 TEN Agent...')

  // 1. 身份验证 (Auth)
  let userProfile: any = null
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
    const token = url.searchParams.get('token')

    if (token && supabase) {
      // 验证 Token
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        console.log(`[WS Proxy] 用户认证成功: ${user.email}`)
        userProfile = {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0]
        }
      } else {
        console.warn(`[WS Proxy] Token 验证失败: ${error?.message}`)
      }
    } else {
      console.log('[WS Proxy] 无 Token 连接 (匿名模式)')
    }
  } catch (err) {
    console.error('[WS Proxy] Auth Check Error:', err)
  }

  // 连接到 TEN Agent
  const agentWs = new WebSocket(TEN_AGENT_WS_URL)

  let isAgentConnected = false
  const pendingMessages: string[] = []

  agentWs.on('open', () => {
    console.log('[WS Proxy] 已连接到 TEN Agent')
    isAgentConnected = true

    // 2. 注入上下文 (Context Injection)
    if (userProfile) {
      const systemInitMsg = {
        type: "system_init",
        user: userProfile,
        timestamp: Date.now()
      }
      agentWs.send(JSON.stringify(systemInitMsg))
      console.log('[WS Proxy] -> Agent: system_init (User Context Injected)')
    }

    // 发送排队的消息
    pendingMessages.forEach(msg => {
      agentWs.send(msg)
    })
    pendingMessages.length = 0
  })

  // 转发 TEN Agent 消息到客户端
  agentWs.on('message', (data, isBinary) => {
    const messageStr = data.toString()

    // 简洁日志
    try {
      const msg = JSON.parse(messageStr)
      if (msg.type === 'audio') {
        console.log(`[WS Proxy] <- Agent: audio (${msg.audio?.length || 0} chars)`)
      } else if (msg.type === 'data') {
        console.log(`[WS Proxy] <- Agent: data/${msg.name}`)
      } else {
        console.log(`[WS Proxy] <- Agent: ${msg.type}`)
      }
    } catch {
      console.log(`[WS Proxy] <- Agent: raw (${messageStr.length} bytes)`)
    }

    // 转发到客户端
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(messageStr)
    }
  })

  agentWs.on('close', (code, reason) => {
    console.log(`[WS Proxy] Agent 连接关闭: ${code}`)
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason.toString())
    }
  })

  agentWs.on('error', (err) => {
    console.error('[WS Proxy] Agent 错误:', err.message)
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Agent connection error')
    }
  })

  clientWs.on('message', (data) => {
    // 转发客户端消息到 TEN Agent
    const msgStr = data.toString()
    console.log(`[WS Proxy] -> Agent: ${msgStr.length} bytes`)

    if (isAgentConnected && agentWs.readyState === WebSocket.OPEN) {
      agentWs.send(msgStr)
    } else {
      pendingMessages.push(msgStr)
      console.log('[WS Proxy] Queued (Agent not ready)')
    }
  })

  clientWs.on('close', (code, reason) => {
    console.log(`[WS Proxy] 客户端断开连接: ${code}`)
    if (agentWs.readyState === WebSocket.OPEN) {
      agentWs.close()
    }
  })

  clientWs.on('error', (err) => {
    console.error('[WS Proxy] 客户端连接错误:', err.message)
    if (agentWs.readyState === WebSocket.OPEN) {
      agentWs.close()
    }
  })
})

console.log('[WS Proxy] WebSocket 代理服务器已配置在 /ws/agent 路径')

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'VoxFlame Backend 运行正常',
    version: '2.1.0',
    architecture: 'Single Agent (TEN Framework)',
    wsProxy: {
      enabled: true,
      path: '/ws/agent',
      target: TEN_AGENT_WS_URL
    }
  })
})

// Agent API 路由 (用户配置、工具执行)
app.use('/api/agent', agentRouter)

// Session API 路由 (会话管理)
app.use('/api/session', sessionRouter)

// Memory API 路由 (记忆系统)
const memoryRouter = express.Router()
memoryRouter.post('/add', memoryController.addMemory.bind(memoryController))
memoryRouter.get('/search', memoryController.searchMemories.bind(memoryController))
memoryRouter.get('/user/:userId', memoryController.getUserMemories.bind(memoryController))
memoryRouter.put('/:memoryId', memoryController.updateMemory.bind(memoryController))
memoryRouter.delete('/:memoryId', memoryController.deleteMemory.bind(memoryController))
memoryRouter.get('/hotwords/:userId', memoryController.getHotwords.bind(memoryController))
memoryRouter.get('/stats/:userId', memoryController.getUserStats.bind(memoryController))
app.use('/api/memory', memoryRouter)

// Upload API 路由 (OSS 签名)
app.use('/api/upload', uploadRouter)

// Webhook 端点 - 接收 TEN Agent 的 text_webhook 回调
app.post('/api/webhook/conversation', (req, res) => {
  const { text, is_final, data_type, conversation_id, message_id } = req.body
  console.log('[Webhook] ' + (data_type || 'message') + ': ' + (text?.substring(0, 50) || '') + '...')
  res.json({ success: true, received: true })
})

// 错误处理中间件
app.use(errorHandler)

// 启动服务器
server.listen(PORT, () => {
  console.log('')
  console.log('🔥 VoxFlame Backend v2.1 已启动')
  console.log('📡 HTTP 服务地址: http://localhost:' + PORT)
  console.log('🔌 WebSocket 代理: ws://localhost:' + PORT + '/ws/agent')
  console.log('🏥 健康检查: http://localhost:' + PORT + '/health')

  console.log('')
  console.log('🏗️ 单一 Agent 架构:')
  console.log('   - TEN Agent (8766): 语音识别 + LLM + 语音合成')
  console.log('   - 本服务 (' + PORT + '): 用户配置 + 工具执行 + 记忆管理 + WS代理')
  console.log('')
  console.log('📝 WebSocket 代理说明:')
  console.log('   前端连接 ws://localhost:' + PORT + '/ws/agent')
  console.log('   -> 代理到 -> ' + TEN_AGENT_WS_URL)
  console.log('   (解决 VSCode Remote 不支持 WebSocket 端口转发的问题)')

  console.log('')
  console.log('🤖 Agent API 端点:')
  console.log('   - GET  /api/agent/profile/:userId')
  console.log('   - PUT  /api/agent/profile/:userId')
  console.log('   - POST /api/agent/tool/execute')
  console.log('   - GET  /api/agent/hotwords/:userId')

  console.log('')
  console.log('💾 Memory API 端点:')
  console.log('   - POST /api/memory/add')
  console.log('   - GET  /api/memory/search?user_id=xxx&query=...')
  console.log('   - GET  /api/memory/user/:userId')

  console.log('')
  console.log('📡 Webhook 端点:')
  console.log('   - POST /api/webhook/conversation')
  console.log('')
})

export default app

/**
 * VoxFlame Backend Server
 * 
 * 单一 Agent 架构 - 后端当前主要负责：
 * 1. WebSocket 代理与身份注入
 * 2. 记忆 / 短语 / 上传 API
 * 3. 基础 HTTP 健康检查与 compat 接口
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
import { phrasesController } from './controllers/phrases.controller'
import { errorHandler } from './middlewares/error.middleware'
import { authMiddleware, validateUserId } from './middlewares/auth.middleware'
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
  const clientUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
  const suppressGreeting = clientUrl.searchParams.get('suppress_greeting') === '1'
  const anonymousId = clientUrl.searchParams.get('anon_id')?.trim()

  // 1. 身份验证 (Auth)
  let userProfile: Record<string, string | boolean> | null = null
  try {
    const token = clientUrl.searchParams.get('token')

    if (token && supabase) {
      // 验证 Token
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        console.log(`[WS Proxy] 用户认证成功: ${user.email}`)
        userProfile = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || '用户'
        }
      } else {
        console.warn(`[WS Proxy] Token 验证失败: ${error?.message}`)
      }
    } else if (anonymousId) {
      userProfile = {
        id: `anon:${anonymousId}`,
        name: '访客',
        email: '',
        anonymous: true,
      }
      console.log(`[WS Proxy] 匿名身份注入: ${userProfile.id}`)
    } else {
      console.log('[WS Proxy] 无 Token 连接 (匿名模式)')
    }
  } catch (err) {
    console.error('[WS Proxy] Auth Check Error:', err)
  }

  // 连接到 TEN Agent
  const agentWsUrl = new URL(TEN_AGENT_WS_URL)
  if (suppressGreeting) {
    agentWsUrl.searchParams.set('suppress_greeting', '1')
  }
  const agentWs = new WebSocket(agentWsUrl.toString())
  console.log(
    `[WS Proxy] 代理目标: ${agentWsUrl.toString()}${suppressGreeting ? ' (suppress_greeting=1)' : ''}`,
  )

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

// Agent API 路由 (用户画像与兼容层)
app.use('/api/agent', agentRouter)

// Session API 路由 (compat only; runtime sessions bootstrap via /ws/agent)
app.use('/api/session', sessionRouter)

// Memory API 路由 (记忆系统) - 需要认证
const memoryRouter = express.Router()
memoryRouter.post('/session', authMiddleware, memoryController.syncSession.bind(memoryController))
memoryRouter.post('/add', authMiddleware, memoryController.addMemory.bind(memoryController))
memoryRouter.get('/profile/:userId', authMiddleware, validateUserId, memoryController.getUserMemoryProfile.bind(memoryController))
memoryRouter.get('/search', authMiddleware, memoryController.searchMemories.bind(memoryController))
memoryRouter.get('/user/:userId', authMiddleware, validateUserId, memoryController.getUserMemories.bind(memoryController))
memoryRouter.put('/:memoryId', authMiddleware, memoryController.updateMemory.bind(memoryController))
memoryRouter.delete('/:memoryId', authMiddleware, memoryController.deleteMemory.bind(memoryController))
memoryRouter.get('/hotwords/:userId', authMiddleware, validateUserId, memoryController.getHotwords.bind(memoryController))
memoryRouter.get('/stats/:userId', authMiddleware, validateUserId, memoryController.getUserStats.bind(memoryController))
app.use('/api/memory', memoryRouter)

// Phrases API 路由 (常用短语) - 需要认证
const phrasesRouter = express.Router()
phrasesRouter.post('/', authMiddleware, phrasesController.createPhrase.bind(phrasesController))
phrasesRouter.get('/user/:userId', authMiddleware, validateUserId, phrasesController.getUserPhrases.bind(phrasesController))
phrasesRouter.put('/:phraseId', authMiddleware, phrasesController.updatePhrase.bind(phrasesController))
phrasesRouter.delete('/:phraseId', authMiddleware, phrasesController.deletePhrase.bind(phrasesController))
phrasesRouter.post('/:phraseId/use', authMiddleware, phrasesController.incrementUsage.bind(phrasesController))
phrasesRouter.post('/reorder', authMiddleware, phrasesController.reorderPhrases.bind(phrasesController))
phrasesRouter.post('/presets/initialize', authMiddleware, phrasesController.initializePresets.bind(phrasesController))
app.use('/api/phrases', phrasesRouter)

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
  console.log('   - 本服务 (' + PORT + '): 身份注入 + API + 记忆管理 + WS代理')
  console.log('')
  console.log('📝 WebSocket 代理说明:')
  console.log('   前端连接 ws://localhost:' + PORT + '/ws/agent')
  console.log('   -> 代理到 -> ' + TEN_AGENT_WS_URL)
  console.log('   (解决 VSCode Remote 不支持 WebSocket 端口转发的问题)')

  console.log('')
  console.log('🤖 Agent API 端点:')
  console.log('   - GET  /api/agent/profile/:userId')
  console.log('   - PUT  /api/agent/profile/:userId')
  console.log('   - GET  /api/agent/hotwords/:userId')

  console.log('')
  console.log('⚠️ Compat API 端点:')
  console.log('   - POST /api/session/start (compat: 501; use /ws/agent)')
  console.log('   - POST /api/session/stop (compat: 501; use /ws/agent)')
  console.log('   - POST /api/session/reload-hotwords (compat: 501)')
  console.log('   - GET  /api/session/:sessionId (compat: 501)')
  console.log('   - POST /api/agent/session/log (compat: 501)')
  console.log('   - GET  /api/agent/session/history/:userId (compat: 501)')
  console.log('   - POST /api/agent/tool/log (compat: 501)')
  console.log('   - POST /api/agent/tool/execute (compat: 501)')

  console.log('')
  console.log('💾 Memory API 端点:')
  console.log('   - POST /api/memory/session')
  console.log('   - GET  /api/memory/profile/:userId')
  console.log('   - POST /api/memory/add')
  console.log('   - GET  /api/memory/search?user_id=xxx&query=...')
  console.log('   - GET  /api/memory/user/:userId (compat slice; use /profile)')
  console.log('   - GET  /api/memory/hotwords/:userId (compat slice; use /profile)')
  console.log('   - GET  /api/memory/stats/:userId (compat slice; use /profile)')

  console.log('')
  console.log('💬 Phrases API 端点:')
  console.log('   - POST /api/phrases')
  console.log('   - GET  /api/phrases/user/:userId')
  console.log('   - PUT  /api/phrases/:phraseId')
  console.log('   - POST /api/phrases/:phraseId/use')
  console.log('   - POST /api/phrases/reorder')

  console.log('')
  console.log('📡 Webhook 端点:')
  console.log('   - POST /api/webhook/conversation')
  console.log('')
})

export default app

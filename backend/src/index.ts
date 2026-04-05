/**
 * VoxFlame Backend Server
 * 
 * 单一 Agent 架构 - 后端当前主要负责：
 * 1. RTC session orchestration
 * 2. 记忆 / 短语 / 上传 API
 * 3. 基础 HTTP 健康检查与 compat 接口
 * 
 * 语音处理（RTC/ASR/LLM/TTS）由 LiveKit + livekit_agent 承接
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { agentRouter } from './controllers/agent.controller'
import sessionRouter from './controllers/session.controller'
import rtcRouter from './controllers/rtc.controller'
import { memoryController } from './controllers/memory.controller'
import { uploadRouter } from './controllers/upload.controller'
import { phrasesController } from './controllers/phrases.controller'
import { errorHandler } from './middlewares/error.middleware'
import { authMiddleware, validateUserId } from './middlewares/auth.middleware'

// 加载环境变量
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
// 中间件
app.use(cors())
app.use(express.json())

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'VoxFlame Backend 运行正常',
    version: '2.2.0',
    architecture: 'RTC-native Agent Orchestration',
    rtcOrchestration: {
      enabled: true,
      target: process.env.LIVEKIT_BROWSER_URL || process.env.LIVEKIT_URL || null,
    }
  })
})

// Agent API 路由 (用户画像与兼容层)
app.use('/api/agent', agentRouter)

// Session API 路由 (compat only; runtime sessions now bootstrap via /api/rtc/session/start)
app.use('/api/session', sessionRouter)

// RTC orchestration API 路由
app.use('/api/rtc', authMiddleware, rtcRouter)

// Memory API 路由 (记忆系统) - 需要认证
const memoryRouter = express.Router()
memoryRouter.post('/hotwords', authMiddleware, memoryController.syncHotwords.bind(memoryController))
memoryRouter.post('/session', authMiddleware, memoryController.syncSession.bind(memoryController))
memoryRouter.post('/add', authMiddleware, memoryController.addMemory.bind(memoryController))
memoryRouter.get('/workspace/:userId', authMiddleware, validateUserId, memoryController.getWorkspaceMemorySnapshot.bind(memoryController))
memoryRouter.put('/workspace/:userId/preferences', authMiddleware, validateUserId, memoryController.syncCommunicationPreferences.bind(memoryController))
memoryRouter.get('/profile/:userId', authMiddleware, validateUserId, memoryController.getUserMemoryProfile.bind(memoryController))
memoryRouter.get('/search', authMiddleware, memoryController.searchMemories.bind(memoryController))
memoryRouter.put('/:memoryId', authMiddleware, memoryController.updateMemory.bind(memoryController))
memoryRouter.delete('/:memoryId', authMiddleware, memoryController.deleteMemory.bind(memoryController))
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
app.use('/api/upload', authMiddleware, uploadRouter)

// Webhook 端点 - 预留给后续外部异步回调
app.post('/api/webhook/conversation', (req, res) => {
  const { text, is_final, data_type, conversation_id, message_id } = req.body
  console.log('[Webhook] ' + (data_type || 'message') + ': ' + (text?.substring(0, 50) || '') + '...')
  res.json({ success: true, received: true })
})

// 错误处理中间件
app.use(errorHandler)

// 启动服务器
app.listen(PORT, () => {
  console.log('')
  console.log('🔥 VoxFlame Backend v2.2 已启动')
  console.log('📡 HTTP 服务地址: http://localhost:' + PORT)
  console.log('🏥 健康检查: http://localhost:' + PORT + '/health')

  console.log('')
  console.log('🏗️ RTC-native 架构:')
  console.log('   - LiveKit server + livekit_agent: RTC + ASR/TTS + 纠错 + memory')
  console.log('   - 本服务 (' + PORT + '): session orchestration + API + 记忆管理')
  console.log('')
  console.log('🎛️ RTC Orchestration 端点:')
  console.log('   - GET  /api/rtc/health')
  console.log('   - GET  /api/rtc/graphs')
  console.log('   - POST /api/rtc/session/start')
  console.log('   - POST /api/rtc/session/ping')
  console.log('   - POST /api/rtc/session/stop')

  console.log('')
  console.log('⚠️ Compat API 端点:')
  console.log('   - POST /api/session/start (compat: 501; use /api/rtc/session/start)')
  console.log('   - POST /api/session/stop (compat: 501; use /api/rtc/session/stop)')
  console.log('   - POST /api/session/reload-hotwords (compat: 501)')
  console.log('   - GET  /api/session/:sessionId (compat: 501)')
  console.log('   - POST /api/agent/session/log (compat: 501)')
  console.log('   - GET  /api/agent/session/history/:userId (compat: 501)')
  console.log('   - POST /api/agent/tool/log (compat: 501)')
  console.log('   - POST /api/agent/tool/execute (compat: 501)')

  console.log('')
  console.log('💾 Memory API 端点:')
  console.log('   - POST /api/memory/session')
  console.log('   - GET  /api/memory/workspace/:userId')
  console.log('   - PUT  /api/memory/workspace/:userId/preferences')
  console.log('   - GET  /api/memory/profile/:userId')
  console.log('   - POST /api/memory/add')
  console.log('   - GET  /api/memory/search?user_id=xxx&query=...')

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

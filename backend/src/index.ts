/**
 * VoxFlame Backend Server
 * 
 * 单一 Agent 架构 - 后端只负责：
 * 1. 用户配置管理
 * 2. 工具执行（电话、智能家居）
 * 3. 记忆系统（FAISS + Supabase）
 * 4. 会话日志
 * 
 * 语音处理（ASR/LLM/TTS）完全由 TEN Agent (8765) 负责
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { agentRouter } from './controllers/agent.controller'
import sessionRouter from './controllers/session.controller'
import { memoryController } from './controllers/memory.controller'
import { errorHandler } from './middlewares/error.middleware'

// 加载环境变量
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(cors())
app.use(express.json())

// 创建 HTTP 服务器
const server = createServer(app)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'VoxFlame Backend 运行正常',
    version: '2.0.0',
    architecture: 'Single Agent (TEN Framework)'
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
  console.log('🔥 VoxFlame Backend v2.0 已启动')
  console.log('📡 HTTP 服务地址: http://localhost:' + PORT)
  console.log('🏥 健康检查: http://localhost:' + PORT + '/health')
  
  console.log('')
  console.log('🏗️ 单一 Agent 架构:')
  console.log('   - TEN Agent (8765): 语音识别 + LLM + 语音合成')
  console.log('   - 本服务 (' + PORT + '): 用户配置 + 工具执行 + 记忆管理')
  
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

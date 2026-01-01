/**
 * Chat Page
 * Phase 8: Frontend WebSocket Integration
 * 
 * 对话助手页面
 */

import { ChatInterface } from '@/components/chat'

export const metadata = {
  title: '燃言助手 - VoxFlame',
  description: '与燃言AI助手对话，它会记住你说的每一句话',
}

export default function ChatPage() {
  return <ChatInterface />
}

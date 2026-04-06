import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMemoryGrowthProfile,
} from './memory-growth.ts'
import type { Memory, Session } from './memory-service.ts'

function createMemory(
  id: string,
  content: string,
  metadata: Record<string, unknown>,
): Memory {
  return {
    id,
    userId: 'user-1',
    type: 'semantic',
    content,
    metadata,
    createdAt: 1_710_000_000_000 + Number.parseInt(id.replace(/\D/g, ''), 10) * 1_000,
    updatedAt: 1_710_000_000_000 + Number.parseInt(id.replace(/\D/g, ''), 10) * 1_000,
  }
}

test('buildMemoryGrowthProfile incorporates session compaction into recall-oriented fields', () => {
  const memories: Memory[] = [
    createMemory('memory-1', '这次会话里，系统更容易把“请先听我说完”听偏。当前更稳的表达是“我说话会慢一点，请先听我说完。”。', {
      kind: 'session_compaction',
      fallback_phrases: ['我说话会慢一点，请先听我说完。'],
      risky_terms: ['请先听我说完'],
      pronunciation_patterns: ['请先', '说完'],
      support_strategies: ['先把关键词慢慢送出来。'],
      hotwords: ['请先听我说完'],
      next_step: '先把开场白和补救句练稳。',
    }),
  ]
  const sessions: Session[] = [
    {
      id: 'session-1',
      userId: 'user-1',
      startTime: 1_710_000_000_000,
      endTime: 1_710_000_060_000,
      turns: [],
      metadata: {
        kind: 'communication',
        source: 'rtc_agent',
      },
    },
  ]

  const profile = buildMemoryGrowthProfile({
    memories,
    sessions,
  })

  assert.deepEqual(profile.frequentExpressions.map((item) => item.label), ['我说话会慢一点，请先听我说完。'])
  assert.deepEqual(profile.frequentFocus.map((item) => item.label), ['请先', '说完'])
  assert.deepEqual(profile.frequentConfusions.map((item) => item.label), ['请先听我说完'])
  assert.deepEqual(profile.articulationTips.map((item) => item.label), ['先把关键词慢慢送出来。'])
  assert.deepEqual(profile.hotwords, ['请先听我说完'])
  assert.equal(profile.nextStep, '先把开场白和补救句练稳。')
})

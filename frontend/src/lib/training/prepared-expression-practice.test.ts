import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPreparedExpressionPracticeExercises,
  buildPreparedExpressionPracticeSummary,
} from '@/lib/training/prepared-expression-practice'
import type { PreparedExpressionSnapshot } from '@/lib/memory/workspace-snapshot'

const PREPARED_EXPRESSION_FIXTURE: PreparedExpressionSnapshot = {
  id: 'speech-1',
  title: '公开分享准备稿',
  summary: '按开场、问题、产品定义三段收紧表达。',
  scene: 'public_speaking',
  source: 'speech.md',
  last_rehearsed_at: '2026-04-07T10:00:00.000Z',
  rehearsal_count: 4,
  low_confidence_sections: 1,
  hotwords: ['燃言', '构音障碍'],
  high_risk_phrases: ['实时辅助沟通'],
  fallback_phrases: ['燃言最核心做三件事。'],
  next_focus: ['产品定义', '实时辅助沟通'],
  sections: [
    {
      id: 'opening',
      title: '开场',
      summary: '先把实时转写说明清楚。',
      anchor_line: '现在屏幕上的文字，就是燃言实时转写的结果。',
      practice_lines: ['现在屏幕上的文字，就是燃言实时转写的结果。'],
      high_risk_phrases: ['实时转写'],
      fallback_phrases: ['现在屏幕上的文字，就是实时转写结果。'],
      hotwords: ['燃言'],
      rehearsal_count: 2,
      low_confidence_count: 0,
      latest_feedback_status: 'excellent',
      last_rehearsed_at: '2026-04-07T10:00:00.000Z',
      is_priority: false,
    },
    {
      id: 'product',
      title: '产品定义',
      summary: '把三项核心能力说稳。',
      anchor_line: '燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。',
      practice_lines: ['燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。'],
      high_risk_phrases: ['实时辅助沟通', '个人记忆管理'],
      fallback_phrases: ['燃言最核心做三件事。'],
      hotwords: ['构音障碍', '燃言'],
      rehearsal_count: 1,
      low_confidence_count: 1,
      latest_feedback_status: 'close',
      last_rehearsed_at: '2026-04-07T09:30:00.000Z',
      is_priority: true,
    },
  ],
  updated_at: '2026-04-07T10:00:00.000Z',
}

test('buildPreparedExpressionPracticeExercises maps sections into practice exercises', () => {
  const exercises = buildPreparedExpressionPracticeExercises(PREPARED_EXPRESSION_FIXTURE)

  assert.equal(exercises.length, 4)
  assert.equal(exercises[0].practiceSource, 'prepared_expression')
  assert.equal(exercises[0].preparedExpressionId, 'speech-1')
  assert.equal(exercises[0].preparedExpressionSectionId, 'opening')
  assert.equal(exercises[2].preparedExpressionSectionTitle, '产品定义')
  assert.deepEqual(
    exercises[2].preparedExpressionKeywords,
    ['构音障碍', '燃言'],
  )
  assert.deepEqual(
    exercises[2].preparedExpressionFallbackPhrases,
    ['燃言最核心做三件事。'],
  )
})

test('buildPreparedExpressionPracticeSummary returns compact rehearsal summary', () => {
  const summary = buildPreparedExpressionPracticeSummary(PREPARED_EXPRESSION_FIXTURE)

  assert.ok(summary)
  assert.equal(summary?.title, '公开分享准备稿')
  assert.equal(summary?.rehearsalCount, 4)
  assert.equal(summary?.lowConfidenceSections, 1)
  assert.deepEqual(summary?.nextFocus, ['产品定义', '实时辅助沟通'])
})

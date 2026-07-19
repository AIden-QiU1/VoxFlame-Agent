import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPreparedExpressionPracticeExercises,
  buildPreparedExpressionPracticeSummary,
} from '@/lib/training/prepared-expression-practice'
import type { PreparedExpressionSnapshot } from '@/lib/memory/workspace-snapshot'

const LENGTH_NORMALIZE_PATTERN = /[\s,.;:!?，。！？；：、"'“”‘’（）()【】[\]{}<>《》…—-]+/g

function measurePracticeLength(value: string): number {
  return value.replace(LENGTH_NORMALIZE_PATTERN, '').length
}

function normalizeDocumentForAssertion(value: string): string {
  return value.replace(/\s+/g, '')
}

const PREPARED_EXPRESSION_FIXTURE: PreparedExpressionSnapshot = {
  id: 'speech-1',
  title: '公开分享准备稿',
  summary: '按开场、问题、产品定义三段收紧表达。',
  scene: 'public_speaking',
  source: 'speech.md',
  document_content: [
    '现在屏幕上的文字，就是燃言实时转写的结果。',
    '燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。',
    '最后我想特别谢谢邱生峰，一直支持我们。',
  ].join('\n'),
  last_rehearsed_at: '2026-04-07T10:00:00.000Z',
  rehearsal_count: 4,
  low_confidence_sections: 1,
  hotwords: ['燃言', '构音障碍', '邱生峰'],
  high_risk_phrases: ['实时辅助沟通'],
  fallback_phrases: ['燃言最核心做三件事。'],
  asr_hotword_entries: [],
  reference_lines: ['燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。'],
  training_reports: {
    daily_summary: null,
    weekly_summary: {
      summary: '最近 7 天重点继续收口产品定义和核心能力表达。',
      sample_count: 4,
      mismatch_pairs: [
        {
          target: '邱生峰',
          heard: '邱文峰',
          occurrenceCount: 2,
        },
      ],
      next_focus: ['产品定义', '实时辅助沟通'],
      stable_wins: ['开场'],
      pronunciation_patterns: [],
      support_strategies: [],
      generated_at: '2026-04-07T10:00:00.000Z',
    },
    training_plan: null,
  },
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

test('buildPreparedExpressionPracticeExercises covers the full document in punctuation-aware 10-20 char chunks', () => {
  const exercises = buildPreparedExpressionPracticeExercises(PREPARED_EXPRESSION_FIXTURE)

  assert.deepEqual(
    exercises.map((exercise) => exercise.text),
    [
      '现在屏幕上的文字，就是燃言实时转写的结果。',
      '燃言最核心做三件事：实时辅助沟通、',
      '语句训练反馈、个人记忆管理。',
      '最后我想特别谢谢邱生峰，一直支持我们。',
    ],
  )
  assert.equal(
    normalizeDocumentForAssertion(exercises.map((exercise) => exercise.text).join('')),
    normalizeDocumentForAssertion(PREPARED_EXPRESSION_FIXTURE.document_content),
  )
  assert.ok(exercises.every((exercise) => measurePracticeLength(exercise.text) >= 10))
  assert.ok(exercises.every((exercise) => measurePracticeLength(exercise.text) <= 20))
})

test('buildPreparedExpressionPracticeExercises hard-splits only unpunctuated overlong material', () => {
  const exercises = buildPreparedExpressionPracticeExercises({
    ...PREPARED_EXPRESSION_FIXTURE,
    document_content: '这是一个没有任何标点的超长训练材料需要被切成自然长度',
    sections: [],
  })

  assert.deepEqual(
    exercises.map((exercise) => exercise.text),
    [
      '这是一个没有任何标点的超长训练材料需要被',
      '切成自然长度',
    ],
  )
  assert.equal(
    normalizeDocumentForAssertion(exercises.map((exercise) => exercise.text).join('')),
    '这是一个没有任何标点的超长训练材料需要被切成自然长度',
  )
  assert.ok(exercises.every((exercise, index) => {
    const length = measurePracticeLength(exercise.text)
    const isLastShortRemainder = index === exercises.length - 1 && length < 10
    return (length >= 10 || isLastShortRemainder) && length <= 20
  }))
})

test('buildPreparedExpressionPracticeExercises keeps section metadata when a line matches a structured section and synthesizes metadata for uncovered paragraphs', () => {
  const exercises = buildPreparedExpressionPracticeExercises(PREPARED_EXPRESSION_FIXTURE)

  assert.equal(exercises[0].preparedExpressionSectionId, 'opening')
  assert.equal(exercises[2].preparedExpressionSectionId, 'product')
  assert.equal(exercises[2].preparedExpressionSectionTitle, '产品定义')
  assert.deepEqual(
    exercises[2].preparedExpressionHighRiskPhrases,
    ['实时辅助沟通', '个人记忆管理'],
  )
  assert.equal(exercises[3].preparedExpressionSectionId, 'document-paragraph-3')
  assert.equal(exercises[3].preparedExpressionAnchorLine, '最后我想特别谢谢邱生峰，一直支持我们。')
  assert.deepEqual(exercises[3].preparedExpressionKeywords, ['邱生峰', '燃言', '构音障碍'])
})

test('buildPreparedExpressionPracticeExercises falls back to section lines when document_content is missing', () => {
  const exercises = buildPreparedExpressionPracticeExercises({
    ...PREPARED_EXPRESSION_FIXTURE,
    document_content: '',
  })

  assert.equal(exercises.length, 2)
  assert.deepEqual(
    exercises.map((exercise) => exercise.text),
    [
      '现在屏幕上的文字，就是燃言实时转写的结果。',
      '燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。',
    ],
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

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildApprovedCoreGapCorpus, validateCoreGapReviewPack } from './mandarin-core-gap-review-core.mjs'

function pack(item) {
  return {
    kind: 'voxflame_mandarin_core_gap_phase1_review_pack',
    status: 'human_review_required_not_for_production',
    target_status: [...new Set(item.coverage_targets)].map((syllableTone) => ({ syllable_tone: syllableTone })),
    items: [item],
  }
}

function pendingReviews() {
  return Object.fromEntries(['linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product'].map((field) => [field, 'pending']))
}

test('pending pack validates but exports no production prompts', () => {
  const payload = pack({ id: '1', type: 'short_sentence', text: '请把安全绳拴好', coverage_targets: ['shuan1'], reviews: pendingReviews() })
  assert.equal(validateCoreGapReviewPack(payload).valid, true)
  assert.equal(buildApprovedCoreGapCorpus(payload).items.length, 0)
})

test('declared targets must actually occur in the candidate text', () => {
  const payload = pack({ id: '1', type: 'short_sentence', text: '请慢一点说', coverage_targets: ['shuan1'], reviews: pendingReviews() })
  const result = validateCoreGapReviewPack(payload)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('does not realize declared target shuan1')))
})

test('word candidates use the attributed whole-word dictionary reading for polyphonic characters', () => {
  const payload = pack({ id: '1', type: 'word', text: '心脏', coverage_targets: ['zang4'], source_pinyin: 'xin1 zang4', reviews: pendingReviews() })
  assert.equal(validateCoreGapReviewPack(payload).valid, true)
})

test('authored sentences may attribute a polyphonic carrier to a dictionary reading', () => {
  const payload = pack({
    id: '1',
    type: 'short_sentence',
    text: '我买了一盒牛轧糖',
    coverage_targets: ['ga2'],
    target_carriers: [{ text: '牛轧糖', source_pinyin: 'niu2 ga2 tang2', source: 'CC-CEDICT' }],
    reviews: pendingReviews(),
  })
  assert.equal(validateCoreGapReviewPack(payload).valid, true)
  payload.items[0].target_carriers[0].text = '不存在的词'
  assert.equal(validateCoreGapReviewPack(payload).valid, false)
})

test('approved prompts require reviewer identity and timestamp before export', () => {
  const approved = Object.fromEntries(['linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product'].map((field) => [field, 'approved']))
  const payload = pack({ id: '1', type: 'word', text: '拴住', coverage_targets: ['shuan1'], reviews: approved })
  assert.equal(validateCoreGapReviewPack(payload).valid, false)
  payload.items[0].reviewed_by = 'linguist-1'
  payload.items[0].reviewed_at = '2026-08-23T00:00:00Z'
  assert.equal(buildApprovedCoreGapCorpus(payload).items.length, 1)
})

test('commercial package content is rejected at release gate', () => {
  const payload = pack({ id: '1', type: 'word', text: '学习包', coverage_targets: ['shuan1'], reviews: pendingReviews() })
  assert.equal(validateCoreGapReviewPack(payload).errors.some((error) => error.includes('blocked production')), true)
})

test('reinforcement candidates keep one targeted-gap task while discourse style remains a tag', () => {
  const payload = pack({
    id: '1', type: 'short_sentence', text: '请把安全绳拴好', coverage_targets: ['shuan1'],
    proposed_task_id: 'functional_speech', discourse_style: 'functional_speech', reviews: pendingReviews(),
  })
  payload.kind = 'voxflame_mandarin_reinforcement_context_review_pack'
  const invalidTask = validateCoreGapReviewPack(payload)
  assert.equal(invalidTask.valid, false)
  assert.match(invalidTask.errors.join('\n'), /proposed_task_id must be targeted_gap/u)

  payload.items[0].proposed_task_id = 'targeted_gap'
  payload.items[0].discourse_style = 'targeted_gap'
  const invalidStyle = validateCoreGapReviewPack(payload)
  assert.equal(invalidStyle.valid, false)
  assert.match(invalidStyle.errors.join('\n'), /discourse_style must be/u)
})

test('obvious sexual, fatal and stigmatizing prompts are rejected at release gate', () => {
  for (const text of ['裸体', '烧死', '傻子']) {
    const payload = pack({ id: text, type: 'word', text, coverage_targets: ['shuan1'], reviews: pendingReviews() })
    assert.equal(validateCoreGapReviewPack(payload).errors.some((error) => error.includes('blocked production')), true)
  }
})

test('person-directed derogatory and disability-stigmatizing prompts are rejected at release gate', () => {
  for (const text of ['他不会蠢到相信这个吧', '他瞎了一只眼']) {
    const payload = pack({
      id: text,
      type: 'short_sentence',
      text,
      coverage_targets: ['shuan1'],
      reviews: pendingReviews(),
    })
    const validation = validateCoreGapReviewPack(payload)
    assert.equal(validation.valid, false)
    assert.ok(validation.errors.some((error) => error.includes('blocked production content')))
  }
})

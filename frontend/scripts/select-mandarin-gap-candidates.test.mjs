import assert from 'node:assert/strict'
import { test } from 'node:test'

import { annotateMandarinText, isBlockedGapCandidate } from './mandarin-coverage-core.mjs'
import {
  pendingReviewState,
  proposedTaskForSentence,
  reviewWarningsForSentence,
} from './mandarin-gap-candidate-core.mjs'
import { main as selectGapCandidates } from './select-mandarin-gap-candidates.mjs'

test('candidate CLI can be imported without executing command-line side effects', () => {
  assert.equal(typeof selectGapCandidates, 'function')
})

test('coverage targets preserve citation syllable-tone forms', () => {
  const targets = annotateMandarinText('请慢慢说').syllables.map((syllable) => syllable.syllableTone)
  assert.deepEqual(targets, ['qing3', 'man4', 'man4', 'shuo1'])
})

test('blocked candidate checks do not leak state across repeated calls', () => {
  assert.equal(isBlockedGapCandidate('汤姆的发型像鸟窝'), true)
  assert.equal(isBlockedGapCandidate('萨米的洗脸盆塞住了'), true)
  assert.equal(isBlockedGapCandidate('汤姆不是傻瓜'), true)
  assert.equal(isBlockedGapCandidate('请慢一点说'), false)
})

test('proposed task separates functional speech from reading candidates', () => {
  assert.equal(proposedTaskForSentence('请帮我联系家人'), 'functional_speech')
  assert.equal(proposedTaskForSentence('这里可以坐下吗？'), 'functional_speech')
  assert.equal(proposedTaskForSentence('我听不清，请再说一次'), 'functional_speech')
  assert.equal(proposedTaskForSentence('清晨的空气很新鲜'), 'connected_reading')
  assert.equal(proposedTaskForSentence('他总是在挑剔别人的毛病'), 'connected_reading')
  assert.equal(proposedTaskForSentence('我知道怎么做这道菜'), 'connected_reading')
  assert.equal(proposedTaskForSentence('护士轻柔地给我的头缠上绷带'), 'connected_reading')
})

test('review metadata starts pending and flags wording that character conversion cannot settle', () => {
  assert.deepEqual(pendingReviewState(), {
    linguistic_review: 'pending',
    naturalness_review: 'pending',
    safety_review: 'pending',
    license_review: 'pending',
    task_review: 'pending',
  })
  assert.deepEqual(reviewWarningsForSentence('这条小路沿著山坡。'), ['mainland_modern_mandarin_usage_review'])
  assert.deepEqual(reviewWarningsForSentence('请帮我联系家人。'), [])
  assert.deepEqual(reviewWarningsForSentence('请先把资料夹设定为共用。'), ['mainland_modern_mandarin_usage_review'])
  assert.deepEqual(reviewWarningsForSentence('请不要骂我。'), ['sensitive_content_review'])
})

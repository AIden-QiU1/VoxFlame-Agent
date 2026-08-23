import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mergeMandarinDualAnnotationDecisions,
  validateMandarinDualAnnotationDecisionExport,
} from './mandarin-spoken-text-review-core.mjs'

function queue() {
  return {
    kind: 'voxflame_mandarin_dual_spoken_text_review_queue',
    status: 'human_review_required_not_for_training',
    generated_at: '2026-08-23T09:00:00Z',
    source_manifest_files: ['manifest.jsonl'],
    policy: { independent_annotators: 2, training_import_allowed: false },
    items: [{
      review_item_id: 'dual-1', recording_id: 'rec-1', audio_locator: 'rec-1',
      prompt_text: '请再说一次', category: '日常与出行', quality_disposition: 'review', duration_ms: 1000,
      annotator_a: { status: 'pending', spoken_text: null, reviewed_by: null, reviewed_at: null, note: null },
      annotator_b: { status: 'pending', spoken_text: null, reviewed_by: null, reviewed_at: null, note: null },
      agreement_status: 'pending', consensus: { status: 'pending', spoken_text: null, reviewed_by: null, reviewed_at: null, note: null },
    }],
  }
}

test('annotator decision export requires a role and exact snapshot', () => {
  const result = validateMandarinDualAnnotationDecisionExport({
    kind: 'voxflame_mandarin_dual_spoken_text_annotation_decisions',
    source_generated_at: 'old', reviewer: 'a@example.com', annotator_role: 'annotator_a',
    exported_at: '2026-08-23T10:00:00Z', items: [],
  }, queue())
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('source_generated_at')))
})

test('sparse annotator merge updates only the selected role', () => {
  const source = queue()
  const decisions = {
    kind: 'voxflame_mandarin_dual_spoken_text_annotation_decisions',
    source_generated_at: source.generated_at,
    reviewer: 'a@example.com', annotator_role: 'annotator_a', exported_at: '2026-08-23T10:00:00Z',
    items: [{
      review_item_id: 'dual-1', status: 'completed', spoken_text: '请再说一次',
      reviewed_by: 'a@example.com', reviewed_at: '2026-08-23T10:00:00Z', note: null,
    }],
  }
  assert.equal(validateMandarinDualAnnotationDecisionExport(decisions, source).valid, true)
  const merged = mergeMandarinDualAnnotationDecisions(source, decisions)
  assert.equal(merged.items[0].annotator_a.status, 'completed')
  assert.equal(merged.items[0].annotator_a.spoken_text, '请再说一次')
  assert.equal(merged.items[0].annotator_b.status, 'pending')
  assert.equal(merged.policy.training_import_allowed, false)
})

test('annotator cannot submit an incomplete completed decision', () => {
  const source = queue()
  const result = validateMandarinDualAnnotationDecisionExport({
    kind: 'voxflame_mandarin_dual_spoken_text_annotation_decisions',
    source_generated_at: source.generated_at,
    reviewer: 'a@example.com', annotator_role: 'annotator_a', exported_at: '2026-08-23T10:00:00Z',
    items: [{ review_item_id: 'dual-1', status: 'completed', spoken_text: '', reviewed_by: 'a@example.com', reviewed_at: null }],
  }, source)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('requires spoken_text')))
})

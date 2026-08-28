import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeTrainingUploadMetadata } from './upload-metadata'

test('training upload metadata keeps useful labels and drops device/user details', () => {
  assert.deepEqual(
    sanitizeTrainingUploadMetadata({
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      age_band: '60–69',
      sex: 'female',
      recording_id: 'rec-1',
      user_agent: 'browser-secret-details',
      microphone_label: 'USB microphone',
      audio_quality_reasons: ['kept for transport only'],
      pronunciation_targets: ['zang4'],
      reading_assistance_used: true,
    }),
    {
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      age_band: '60–69',
      sex: 'female',
      pronunciation_targets: ['zang4'],
      reading_assistance_used: true,
    },
  )
})

test('training upload metadata keeps reading lineage but not the full article', () => {
  assert.deepEqual(
    sanitizeTrainingUploadMetadata({
      reading_material_kind: 'voxflame_original',
      reading_article_id: 'reading-001',
      reading_article_version: '1.0.0',
      reading_segment_id: 'reading-001-segment-01',
      reading_segment_index: 0,
      reading_segment_count: 10,
      reading_round_id: 'round-1',
      reading_article_body: '这段正文不应重复上传',
    }),
    {
      reading_material_kind: 'voxflame_original',
      reading_article_id: 'reading-001',
      reading_article_version: '1.0.0',
      reading_segment_id: 'reading-001-segment-01',
      reading_segment_index: 0,
      reading_segment_count: 10,
      reading_round_id: 'round-1',
    },
  )
})

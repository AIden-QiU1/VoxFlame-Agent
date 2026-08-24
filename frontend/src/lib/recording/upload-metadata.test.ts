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
    }),
    {
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      age_band: '60–69',
      sex: 'female',
      pronunciation_targets: ['zang4'],
    },
  )
})

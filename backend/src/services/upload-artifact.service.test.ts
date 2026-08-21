import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeUploadMetadata } from './upload-artifact.service'

test('server upload metadata allow-list drops device, browser, and arbitrary fields', () => {
  assert.deepEqual(
    sanitizeUploadMetadata({
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      recording_id: 'rec-1',
      sample_rate: 16_000,
      user_agent: 'private-browser-details',
      microphone_label: 'USB microphone',
      client_capture_id: 'internal-capture-id',
      raw_audio: 'should-not-be-a-metadata-value',
      empty: '   ',
      unsupported_object: { secret: true },
    }),
    {
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      recording_id: 'rec-1',
      sample_rate: 16_000,
    },
  )
})

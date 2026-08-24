import assert from 'node:assert/strict'
import test from 'node:test'

import { buildRecordingManifestEntry, sanitizeUploadMetadata } from './upload-artifact.service'

test('server upload metadata allow-list drops device, browser, and arbitrary fields', () => {
  assert.deepEqual(
    sanitizeUploadMetadata({
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      recording_id: 'rec-1',
      pronunciation_targets: ['zang4', 'zha2'],
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
      pronunciation_targets: ['zang4', 'zha2'],
      sample_rate: 16_000,
    },
  )
})

test('manifest keeps explicit pronunciation targets without promoting arbitrary metadata', () => {
  const manifest = buildRecordingManifestEntry(
    'contributor-1',
    'supervised/mandarin/音系强化/recording-1.wav',
    '阿胶已经开封',
    null,
    1.25,
    sanitizeUploadMetadata({
      target_text: '阿胶已经开封',
      exercise_id: 'coverage-recording-gap-1',
      exercise_category: '音系强化',
      pronunciation_targets: ['e1', 'jiao1'],
      user_agent: 'must-not-enter-manifest-metadata',
    }),
  )

  assert.deepEqual(manifest.prompt.target_focus, ['e1', 'jiao1'])
  assert.equal((manifest.metadata as Record<string, unknown>).user_agent, undefined)
  assert.equal(manifest.prompt.text, '阿胶已经开封')
})

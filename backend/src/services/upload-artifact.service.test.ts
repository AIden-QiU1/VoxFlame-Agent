import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRecordingManifestEntry,
  sanitizeUploadMetadata,
  summarizeRecordingProgress,
} from './upload-artifact.service'

test('server upload metadata allow-list drops device, browser, and arbitrary fields', () => {
  assert.deepEqual(
    sanitizeUploadMetadata({
      target_text: '你好',
      spoken_text: '泥好',
      severity: 'mild',
      etiology: 'stroke',
      recording_id: 'rec-1',
      pronunciation_targets: ['zang4', 'zha2'],
      reading_assistance_used: true,
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
      reading_assistance_used: true,
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

test('server metadata keeps article lineage without accepting article body', () => {
  assert.deepEqual(
    sanitizeUploadMetadata({
      reading_material_kind: 'voxflame_original',
      reading_article_id: 'reading-001',
      reading_article_version: '1.0.0',
      reading_segment_id: 'reading-001-segment-01',
      reading_segment_index: 0,
      reading_segment_count: 10,
      reading_round_id: 'round-1',
      reading_article_body: '不应随每条录音重复进入元数据',
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

test('recording progress separates local calendar day and returns safe identifiers', () => {
  const snapshot = summarizeRecordingProgress(
    [
      {
        sentence_id: 'ordinary-1',
        duration_seconds: 25.5,
        created_at: '2026-08-27T15:59:00.000Z',
        metadata: {},
      },
      {
        sentence_id: 'reading-001-segment-01',
        duration_seconds: 34.5,
        created_at: '2026-08-27T16:01:00.000Z',
        metadata: { reading_segment_id: 'reading-001-segment-01' },
      },
      {
        sentence_id: 'reading-001-segment-02',
        duration_seconds: 20,
        created_at: '2026-08-28T03:00:00.000Z',
        metadata: { reading_segment_id: 'reading-001-segment-02' },
      },
    ],
    -480,
    Date.parse('2026-08-28T04:00:00.000Z'),
  )

  assert.deepEqual(snapshot.recordedSentenceIds, [
    'ordinary-1',
    'reading-001-segment-01',
    'reading-001-segment-02',
  ])
  assert.deepEqual(snapshot.recordedReadingSegmentIds, [
    'reading-001-segment-01',
    'reading-001-segment-02',
  ])
  assert.deepEqual(snapshot.recordedReadingRoundKeys, [
    'initial:reading-001-segment-01',
    'initial:reading-001-segment-02',
  ])
  assert.deepEqual(snapshot.readingArticleRoundIds, {})
  assert.equal(snapshot.todayDurationSeconds, 54.5)
  assert.equal(snapshot.totalDurationSeconds, 80)
})

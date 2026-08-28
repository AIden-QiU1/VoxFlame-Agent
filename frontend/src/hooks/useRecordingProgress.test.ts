import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeRecordingProgress } from './useRecordingProgress'
import type { VoxFlameRecorderQueueItem } from '@/lib/recording/recording-contract'

function queueItem(overrides: Partial<VoxFlameRecorderQueueItem>): VoxFlameRecorderQueueItem {
  const createdAt = new Date().toISOString()
  return {
    recordingId: 'recording-1',
    contributorId: 'user-1',
    text: '今天风很轻',
    sentenceId: 'reading-001-segment-01',
    source: 'guided_recording',
    metadata: { reading_segment_id: 'reading-001-segment-01' },
    consentScope: 'training_only',
    syncStatus: 'local_only',
    syncAttempts: 0,
    createdAt,
    recording: {
      recordingId: 'recording-1',
      sessionId: 'session-1',
      mode: 'training',
      sourceSurface: 'web',
      collectionMode: 'supervised',
      createdAt,
      startedAt: createdAt,
      stoppedAt: createdAt,
      audio: {
        blob: new Blob(),
        format: 'audio/wav',
        sampleRate: 16000,
        channelCount: 1,
        durationMs: 30_000,
        durationSeconds: 30,
        fileSizeBytes: 0,
        captureTransport: 'browser_media_recorder',
      },
    },
    ...overrides,
  }
}

test('merge progress includes local pending durations and de-duplicates sentence ids', () => {
  const result = mergeRecordingProgress({
    recordedSentenceIds: ['reading-001-segment-01'],
    recordedReadingSegmentIds: ['reading-001-segment-01'],
    recordedReadingRoundKeys: ['initial:reading-001-segment-01'],
    readingArticleRoundIds: {},
    todayDurationSeconds: 60,
    totalDurationSeconds: 120,
  }, [queueItem({})])

  assert.equal(result.todayDurationSeconds, 90)
  assert.equal(result.totalDurationSeconds, 150)
  assert.deepEqual(result.recordedSentenceIds, ['reading-001-segment-01'])
  assert.deepEqual(result.recordedReadingSegmentIds, ['reading-001-segment-01'])
  assert.deepEqual(result.recordedReadingRoundKeys, ['initial:reading-001-segment-01'])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { createPcmWavBlob } from './local-pcm-wav-recorder.ts'
import { normalizeRecordingToWav } from './recording-to-wav.ts'
import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'

async function readAscii(blob: Blob, start: number, length: number): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer(), start, length)
  return String.fromCharCode(...bytes)
}

test('createPcmWavBlob writes a standard PCM WAV header', async () => {
  const blob = createPcmWavBlob(new Int16Array([0, 1200, -1200]), 16000)
  const buffer = await blob.arrayBuffer()
  const view = new DataView(buffer)

  assert.equal(blob.type, 'audio/wav')
  assert.equal(await readAscii(blob, 0, 4), 'RIFF')
  assert.equal(await readAscii(blob, 8, 4), 'WAVE')
  assert.equal(await readAscii(blob, 12, 4), 'fmt ')
  assert.equal(view.getUint16(20, true), 1)
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), 16000)
  assert.equal(await readAscii(blob, 36, 4), 'data')
  assert.equal(view.getUint32(40, true), 6)
})

test('normalizeRecordingToWav reuses local PCM WAV without browser decode', async () => {
  const wavBlob = createPcmWavBlob(new Int16Array([0, 1, -1]), 16000)
  const recording: VoxFlameRecordingEnvelope = {
    recordingId: 'recording-local-pcm',
    sessionId: 'session-local-pcm',
    mode: 'training',
    sourceSurface: 'web',
    collectionMode: 'supervised',
    createdAt: new Date(0).toISOString(),
    startedAt: new Date(0).toISOString(),
    stoppedAt: new Date(1000).toISOString(),
    audio: {
      blob: wavBlob,
      format: 'audio/wav',
      sampleRate: 16000,
      channelCount: 1,
      durationMs: 1000,
      durationSeconds: 1,
      fileSizeBytes: wavBlob.size,
      captureTransport: 'local_pcm_stream',
    },
  }

  const normalized = await normalizeRecordingToWav(recording)

  assert.equal(normalized.audio.blob, wavBlob)
  assert.equal(normalized.audio.format, 'audio/wav')
  assert.equal(normalized.audio.sampleRate, 16000)
  assert.equal(normalized.audio.channelCount, 1)
})

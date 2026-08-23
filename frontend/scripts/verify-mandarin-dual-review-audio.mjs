#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function values(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean)
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line))
}

function manifestArtifactRoot(manifestPath) {
  return path.dirname(path.dirname(path.dirname(manifestPath)))
}

function resolveAudioPath(manifestPath, audioPath) {
  return path.resolve(manifestArtifactRoot(manifestPath), audioPath)
}

function wavDurationMs(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null
  const channels = buffer.readUInt16LE(22)
  const sampleRate = buffer.readUInt32LE(24)
  const bitsPerSample = buffer.readUInt16LE(34)
  const dataOffset = buffer.indexOf(Buffer.from('data'))
  if (!channels || !sampleRate || !bitsPerSample || dataOffset < 0 || dataOffset + 8 > buffer.length) return null
  const dataBytes = buffer.readUInt32LE(dataOffset + 4)
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8)
  return bytesPerSecond > 0 ? Math.round((dataBytes / bytesPerSecond) * 1000) : null
}

const inputPath = values('--input')[0]
const manifestPaths = values('--manifest')
const outputPath = values('--output')[0]
if (!inputPath || manifestPaths.length === 0 || !outputPath) {
  throw new Error('usage: verify-mandarin-dual-review-audio --input <queue.json> --manifest <jsonl> [--manifest <jsonl> ...] --output <report.json>')
}

const queue = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const manifestRows = new Map()
for (const manifestPath of manifestPaths) {
  for (const row of readJsonl(manifestPath)) {
    const id = row.recording_id ?? row.metadata?.recording_id
    if (id && !manifestRows.has(id)) manifestRows.set(id, { manifestPath, row })
  }
}

const results = queue.items.map((item) => {
  const found = manifestRows.get(item.recording_id)
  if (!found) return { recording_id: item.recording_id, status: 'manifest_missing' }
  const audioPath = found.row.audio?.path
  if (typeof audioPath !== 'string' || !audioPath) return { recording_id: item.recording_id, status: 'audio_path_missing' }
  const resolved = resolveAudioPath(found.manifestPath, audioPath)
  if (!fs.existsSync(resolved)) return { recording_id: item.recording_id, status: 'audio_missing' }
  const stat = fs.statSync(resolved)
  const buffer = fs.readFileSync(resolved)
  const durationMs = wavDurationMs(buffer)
  const expectedBytes = Number(found.row.audio?.file_size_bytes ?? 0)
  const expectedDurationMs = Number(found.row.audio?.duration_ms ?? 0)
  return {
    recording_id: item.recording_id,
    status: durationMs === null ? 'invalid_wav' : 'ok',
    size_bytes: stat.size,
    expected_size_bytes_match: expectedBytes > 0 ? stat.size === expectedBytes : null,
    duration_ms: durationMs,
    expected_duration_ms: expectedDurationMs || null,
    duration_delta_ms: expectedDurationMs && durationMs !== null ? durationMs - expectedDurationMs : null,
  }
})

const statusCounts = results.reduce((counts, result) => {
  counts[result.status] = (counts[result.status] ?? 0) + 1
  return counts
}, {})
const report = {
  kind: 'voxflame_mandarin_dual_review_audio_integrity_report',
  generated_at: new Date().toISOString(),
  input_queue_items: queue.items.length,
  manifest_files: manifestPaths.map((manifestPath) => path.basename(manifestPath)),
  status_counts: statusCounts,
  audio_integrity_gate_passed: results.every((result) => result.status === 'ok'),
  // Deliberately no resolved paths are emitted.
  results,
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ input_queue_items: report.input_queue_items, status_counts: report.status_counts, audio_integrity_gate_passed: report.audio_integrity_gate_passed }))

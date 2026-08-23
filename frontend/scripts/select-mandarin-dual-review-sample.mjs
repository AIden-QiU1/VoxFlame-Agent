#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { buildMandarinDualReviewQueue } from './mandarin-spoken-text-review-core.mjs'

function values(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean)
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line))
}

function stableHash(value) {
  let hash = 2166136261
  for (const char of value) hash = Math.imul(hash ^ char.codePointAt(0), 16777619)
  return hash >>> 0
}

function chooseStratified(rows, sampleSize) {
  const strata = new Map()
  for (const row of rows) {
    const category = row.prompt?.category ?? row.metadata?.exercise_category ?? '未分区'
    const quality = row.metadata?.audio_quality_disposition ?? 'missing'
    const key = `${category}::${quality}`
    if (!strata.has(key)) strata.set(key, [])
    strata.get(key).push(row)
  }
  const ordered = [...strata.entries()].sort(([a], [b]) => a.localeCompare(b))
  const selected = []
  const selectedIds = new Set()
  const quota = Math.max(1, Math.floor(sampleSize / Math.max(1, ordered.length)))
  for (const [, candidates] of ordered) {
    candidates.sort((left, right) => stableHash(String(left.recording_id)).toString().localeCompare(stableHash(String(right.recording_id)).toString()))
    for (const row of candidates.slice(0, quota)) {
      const id = row.recording_id ?? row.metadata?.recording_id
      if (id && !selectedIds.has(id)) {
        selected.push(row)
        selectedIds.add(id)
      }
    }
  }
  if (selected.length < sampleSize) {
    const remaining = rows.filter((row) => !selectedIds.has(row.recording_id ?? row.metadata?.recording_id))
    remaining.sort((left, right) => stableHash(String(left.recording_id)).toString().localeCompare(stableHash(String(right.recording_id)).toString()))
    selected.push(...remaining.slice(0, sampleSize - selected.length))
  }
  return selected.slice(0, sampleSize)
}

const manifestPaths = values('--manifest')
const outputPath = values('--output')[0]
const sampleSize = Number(values('--sample-size')[0] ?? 60)
if (manifestPaths.length === 0 || !outputPath || !Number.isInteger(sampleSize) || sampleSize <= 0) {
  throw new Error('usage: select-mandarin-dual-review-sample --manifest <jsonl> [--manifest <jsonl> ...] --output <json> [--sample-size 60]')
}

const uniqueRows = new Map()
for (const row of manifestPaths.flatMap(readJsonl)) {
  const id = row.recording_id ?? row.metadata?.recording_id
  if (id && !uniqueRows.has(id)) uniqueRows.set(id, row)
}
const selected = chooseStratified([...uniqueRows.values()], sampleSize)
const payload = buildMandarinDualReviewQueue(selected, { sourceManifestFiles: manifestPaths })
payload.sampling = {
  method: 'deterministic_stratified_category_quality',
  population_unique_recordings: uniqueRows.size,
  requested_sample_size: sampleSize,
  selected_sample_size: selected.length,
  strata: [...new Set(selected.map((row) => `${row.prompt?.category ?? row.metadata?.exercise_category ?? '未分区'}::${row.metadata?.audio_quality_disposition ?? 'missing'}`))].sort(),
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`selected ${selected.length}/${uniqueRows.size} recordings for dual human review`)

#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function tsvCell(value) {
  return String(value ?? '').replace(/[\t\r\n]+/gu, ' ').trim()
}

const inputPath = value('--input')
const outputPath = value('--output')
const batchSize = Number(value('--batch-size') ?? 30)
if (!inputPath || !outputPath || !Number.isInteger(batchSize) || batchSize < 1) {
  throw new Error('usage: export-mandarin-core-gap-review-sheet --input <review.json> --output <review.tsv> [--batch-size 30]')
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const targetOrder = new Map(payload.target_status.map((target, index) => [target.syllable_tone, index]))
const items = [...payload.items].sort((left, right) => {
  const leftTarget = left.coverage_targets[0]
  const rightTarget = right.coverage_targets[0]
  return (targetOrder.get(leftTarget) ?? 0) - (targetOrder.get(rightTarget) ?? 0)
    || left.type.localeCompare(right.type)
    || left.id.localeCompare(right.id)
})

const headers = [
  'batch', 'id', 'coverage_targets', 'type', 'text', 'source', 'reading_evidence',
  'linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product',
  'review_notes', 'reviewed_by', 'reviewed_at',
]
const rows = items.map((item, index) => {
  const carrierEvidence = (item.target_carriers ?? [])
    .map((carrier) => `${carrier.text} [${carrier.source_pinyin}] (${carrier.source})`)
  const readingEvidence = item.source_pinyin
    ? `${item.text} [${item.source_pinyin}] (${item.source})`
    : carrierEvidence.join(' | ')
  return [
    Math.floor(index / batchSize) + 1,
    item.id,
    item.coverage_targets.join(' '),
    item.type,
    item.text,
    item.source,
    readingEvidence,
    item.reviews.linguistic,
    item.reviews.naturalness,
    item.reviews.user_burden,
    item.reviews.safety,
    item.reviews.license,
    item.reviews.product,
    item.review_notes ?? '',
    item.reviewed_by ?? '',
    item.reviewed_at ?? '',
  ].map(tsvCell).join('\t')
})

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${headers.join('\t')}\n${rows.join('\n')}\n`, 'utf8')
console.log(`wrote ${items.length} review rows in ${Math.ceil(items.length / batchSize)} batches`)

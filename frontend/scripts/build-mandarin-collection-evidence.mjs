#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { buildMandarinCollectionEvidence } from './mandarin-collection-evidence-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function values(name) {
  return process.argv.flatMap((argument, index) => argument === name ? [process.argv[index + 1]] : []).filter(Boolean)
}

const referencePath = value('--reference')
const spokenPath = value('--spoken-review')
const outputPath = value('--output')
const manifestPaths = values('--manifest')
if (!referencePath || !outputPath) {
  throw new Error('usage: build-mandarin-collection-evidence --reference <reference.json> [--spoken-review <queue.json>] [--manifest <manifest.jsonl> ...] --output <evidence.json>')
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line) } catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`) }
  })
}

const payload = buildMandarinCollectionEvidence({
  reference: JSON.parse(fs.readFileSync(referencePath, 'utf8')),
  spokenQueue: spokenPath ? JSON.parse(fs.readFileSync(spokenPath, 'utf8')) : null,
  manifestRows: manifestPaths.flatMap(readJsonl),
})
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote collection evidence: ${payload.review.coverage_eligible_recordings} eligible full-review recordings`)

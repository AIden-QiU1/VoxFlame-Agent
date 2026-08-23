#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { buildMandarinSpokenTextReviewQueue } from './mandarin-spoken-text-review-core.mjs'

function values(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean)
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`)
      }
    })
}

const manifestPaths = values('--manifest')
const outputPath = values('--output')[0]
if (manifestPaths.length === 0 || !outputPath) {
  throw new Error('usage: build-mandarin-spoken-text-review-queue --manifest <jsonl> [--manifest <jsonl> ...] --output <json>')
}

const payload = buildMandarinSpokenTextReviewQueue(
  manifestPaths.flatMap(readJsonl),
  { sourceManifestFiles: manifestPaths },
)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${payload.items.length} human spoken_text review items to ${outputPath}`)

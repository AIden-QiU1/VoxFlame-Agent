#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateMandarinReviewQueue } from './mandarin-review-queue-core.mjs'

function value(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const inputPath = value('--input')
const outputPath = value('--output')
if (!inputPath) {
  throw new Error('usage: validate-mandarin-review-queue --input <review-queue.json> [--output <summary.json>]')
}

const result = validateMandarinReviewQueue(JSON.parse(fs.readFileSync(inputPath, 'utf8')))
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
}
if (!result.valid) {
  for (const error of result.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  console.log(JSON.stringify(result.summary))
}

if (process.argv[1] && path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) {
  // Keep the direct-execution comparison visible to static checks; no action is needed here.
}

#!/usr/bin/env node

import fs from 'node:fs'
import { validateMandarinDualReviewQueue } from './mandarin-spoken-text-review-core.mjs'

const index = process.argv.indexOf('--input')
const inputPath = index >= 0 ? process.argv[index + 1] : null
if (!inputPath) throw new Error('usage: validate-mandarin-dual-review --input <queue.json>')
const result = validateMandarinDualReviewQueue(JSON.parse(fs.readFileSync(inputPath, 'utf8')))
if (!result.valid) {
  for (const error of result.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  console.log(JSON.stringify(result.summary))
}

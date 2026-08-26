#!/usr/bin/env node

import fs from 'node:fs'

import { validateMandarinSpokenTextReviewQueue } from './mandarin-spoken-text-review-core.mjs'

const inputIndex = process.argv.indexOf('--input')
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : null
if (!inputPath) throw new Error('usage: validate-mandarin-spoken-text-review --input <queue.json>')

const result = validateMandarinSpokenTextReviewQueue(JSON.parse(fs.readFileSync(inputPath, 'utf8')))
if (!result.valid) {
  for (const error of result.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  console.log(JSON.stringify(result.summary))
}

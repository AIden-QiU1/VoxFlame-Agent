#!/usr/bin/env node

import fs from 'node:fs'

import { validateMandarinEvaluationReport } from './mandarin-evaluation-gate-core.mjs'

const inputIndex = process.argv.indexOf('--input')
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined
if (!inputPath) {
  throw new Error('usage: validate-mandarin-evaluation-report --input <evaluation-report.json>')
}

const result = validateMandarinEvaluationReport(JSON.parse(fs.readFileSync(inputPath, 'utf8')))
if (!result.valid) {
  for (const error of result.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  console.log('mandarin evaluation gate passed')
}

#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { buildApprovedCoreGapCorpus, validateCoreGapReviewPack } from './mandarin-core-gap-review-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input')
const summaryPath = value('--summary')
const approvedOutputPath = value('--approved-output')
if (!inputPath) throw new Error('usage: validate-mandarin-core-gap-review --input <review.json> [--summary <validation.json>] [--approved-output <approved.json>]')

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const validation = validateCoreGapReviewPack(payload)
if (summaryPath) {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true })
  fs.writeFileSync(summaryPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8')
}
if (!validation.valid) {
  for (const error of validation.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  if (approvedOutputPath) {
    const approved = buildApprovedCoreGapCorpus(payload)
    fs.mkdirSync(path.dirname(approvedOutputPath), { recursive: true })
    fs.writeFileSync(approvedOutputPath, `${JSON.stringify(approved, null, 2)}\n`, 'utf8')
  }
  console.log(JSON.stringify(validation.summary))
}


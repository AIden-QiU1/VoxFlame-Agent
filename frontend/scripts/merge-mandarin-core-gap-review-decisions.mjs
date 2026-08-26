#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { mergeCoreGapDecisions, validateCoreGapDecisionExport } from './mandarin-core-gap-decision-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const reviewPath = value('--review')
const decisionsPath = value('--decisions')
const outputPath = value('--output')
const summaryPath = value('--summary')
if (!reviewPath || !decisionsPath || !outputPath) {
  throw new Error('usage: merge-mandarin-core-gap-review-decisions --review <review.json> --decisions <decisions.json> --output <merged-review.json> [--summary <validation.json>]')
}

const reviewPack = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
const validation = validateCoreGapDecisionExport(decisions, reviewPack)
if (summaryPath) {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true })
  fs.writeFileSync(summaryPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8')
}
if (!validation.valid) {
  for (const error of validation.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  const merged = mergeCoreGapDecisions(reviewPack, decisions)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(validation.summary))
}

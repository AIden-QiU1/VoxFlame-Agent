#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import {
  mergeMandarinDualAnnotationDecisions,
  validateMandarinDualAnnotationDecisionExport,
} from './mandarin-spoken-text-review-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const queuePath = value('--queue')
const decisionsPath = value('--decisions')
const outputPath = value('--output')
const summaryPath = value('--summary')
if (!queuePath || !decisionsPath || !outputPath) {
  throw new Error('usage: merge-mandarin-dual-review-annotations --queue <queue.json> --decisions <decisions.json> --output <merged.json> [--summary <validation.json>]')
}

const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'))
const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
const validation = validateMandarinDualAnnotationDecisionExport(decisions, queue)
if (summaryPath) {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true })
  fs.writeFileSync(summaryPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8')
}
if (!validation.valid) {
  for (const error of validation.errors) console.error(`[error] ${error}`)
  process.exitCode = 1
} else {
  const merged = mergeMandarinDualAnnotationDecisions(queue, decisions)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(validation.summary))
}

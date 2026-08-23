#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { buildMandarinCollectionEvidence } from './mandarin-collection-evidence-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const referencePath = value('--reference')
const spokenPath = value('--spoken-review')
const dualPath = value('--dual-review')
const audioPath = value('--audio-verification')
const outputPath = value('--output')
if (!referencePath || !spokenPath || !dualPath || !audioPath || !outputPath) {
  throw new Error('usage: build-mandarin-collection-evidence --reference <reference.json> --spoken-review <queue.json> --dual-review <queue.json> --audio-verification <report.json> --output <evidence.json>')
}

const payload = buildMandarinCollectionEvidence({
  reference: JSON.parse(fs.readFileSync(referencePath, 'utf8')),
  spokenQueue: JSON.parse(fs.readFileSync(spokenPath, 'utf8')),
  dualQueue: JSON.parse(fs.readFileSync(dualPath, 'utf8')),
  audioVerification: JSON.parse(fs.readFileSync(audioPath, 'utf8')),
})
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote collection evidence: ${payload.review.coverage_eligible_recordings} eligible full-review recordings`)

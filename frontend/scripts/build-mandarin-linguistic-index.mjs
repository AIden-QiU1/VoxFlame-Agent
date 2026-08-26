#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MANDARIN_TRAINING_EXERCISES } from '../src/lib/corpus/mandarin-training-data/index.ts'
import { buildLinguisticIndex } from './mandarin-linguistic-index-core.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultOutput = path.resolve(scriptDir, '../src/lib/corpus/generated/mandarin-linguistic-index.json')
const outputIndex = process.argv.indexOf('--output')
const outputPath = path.resolve(
  outputIndex >= 0 ? process.argv[outputIndex + 1] : defaultOutput,
)

const index = buildLinguisticIndex(MANDARIN_TRAINING_EXERCISES)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  generated_from: 'frontend/src/lib/corpus/mandarin-training-data/index.ts',
  ...index,
}, null, 2)}\n`, 'utf8')
console.log(`indexed ${index.summary.indexed_items} prompts to ${outputPath}`)

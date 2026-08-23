#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MANDARIN_TRAINING_EXERCISES } from '../src/lib/corpus/mandarin-training-data/index.ts'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultOutput = path.resolve(scriptDir, '../.tmp/mandarin-training-prompts.json')
const outputIndex = process.argv.indexOf('--output')
const outputPath = path.resolve(process.cwd(), outputIndex >= 0 ? process.argv[outputIndex + 1] : defaultOutput)

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify({
  kind: 'voxflame_mandarin_training_prompts',
  generated_at: new Date().toISOString(),
  items: MANDARIN_TRAINING_EXERCISES,
}, null, 2)}\n`, 'utf8')

console.log(`exported ${MANDARIN_TRAINING_EXERCISES.length} prompts to ${outputPath}`)

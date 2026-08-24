#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MANDARIN_TRAINING_EXERCISES } from '../src/lib/corpus/mandarin-training-data/index.ts'
import {
  buildMandarinReinforcementPlan,
  buildMandarinReinforcementProductIndex,
} from './mandarin-reinforcement-plan-core.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const ledgerPath = path.join(frontendDir, 'src/lib/corpus/generated/mandarin-coverage-target-ledger.json')
const indexPath = path.join(frontendDir, 'src/lib/corpus/generated/mandarin-linguistic-index.json')
const outputPath = path.join(frontendDir, 'src/lib/corpus/generated/mandarin-below-minimum-reinforcement-plan.json')
const productIndexPath = path.join(frontendDir, 'src/lib/corpus/generated/mandarin-reinforcement-product-index.json')

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const linguisticIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const plan = buildMandarinReinforcementPlan({
  ledger,
  linguisticIndex,
  // Recording-ready gap packs use a separate collection lane; keep this
  // planning artifact scoped to the 9,107-item base corpus.
  exercises: MANDARIN_TRAINING_EXERCISES.filter((exercise) => (
    !exercise.id.startsWith('coverage-recording-gap-')
    && !exercise.id.startsWith('coverage-recording-reinforcement-')
  )),
})

fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
fs.writeFileSync(productIndexPath, `${JSON.stringify(buildMandarinReinforcementProductIndex(plan), null, 2)}\n`, 'utf8')
console.log(`planned ${plan.summary.planned_recording_slots} recording slots across ${plan.summary.selected_prompts} active prompts`)

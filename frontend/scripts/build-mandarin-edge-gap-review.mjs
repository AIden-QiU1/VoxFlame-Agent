#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input')
const outputPath = value('--output')
if (!inputPath || !outputPath) throw new Error('usage: build-mandarin-edge-gap-review --input <ledger.json> --output <edge-review.json>')

const ledger = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const items = ledger.targets.filter((target) => target.coverage_status === 'missing' && target.tier === 'edge').map((target) => ({
  syllable_tone: target.syllable_tone,
  syllable: target.syllable,
  tier_basis: target.tier_basis,
  carrier_characters: target.carrier_characters,
  candidate_words: target.candidate_words,
  candidate_sentences: target.candidate_sentences,
  review: {
    legal_mandarin_form: 'pending',
    lexical_currency: 'pending',
    target_population_value: 'pending',
    user_burden: 'pending',
    specialist_pack_decision: 'pending',
  },
}))

const payload = {
  kind: 'voxflame_mandarin_edge_gap_review_pack',
  generated_at: new Date().toISOString(),
  status: 'specialist_review_required_not_for_default_recording',
  policy: {
    default_recommendation_allowed: false,
    may_include_rare_regional_specialized_interjectional_or_high_burden_forms: true,
    user_must_opt_in_after_specialist_approval: true,
    disputed_targets_are_not_included: true,
    no_existing_prompt_or_recording_removed: true,
  },
  summary: {
    edge_missing_targets: items.length,
    targets_with_sentence_candidates: items.filter((item) => item.candidate_sentences.length > 0).length,
    targets_without_sentence_candidates: items.filter((item) => item.candidate_sentences.length === 0).length,
  },
  sources: ledger.sources,
  items,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${items.length} edge targets for specialist review`)


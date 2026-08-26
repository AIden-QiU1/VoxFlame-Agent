#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { validateMandarinRecordingCandidate } from './mandarin-recording-corpus-gate-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input')
const outputPath = value('--output')
const existingPath = value('--existing')
const coreGapPath = value('--core-gap')
const reinforcementPath = value('--reinforcement')
if (!inputPath || !outputPath || !existingPath || !coreGapPath || !reinforcementPath) {
  throw new Error('usage: build-mandarin-open-research-recording-corpus --input <candidates.json> --output <corpus.json> --existing <base.json> --core-gap <core.json> --reinforcement <reinforcement.json>')
}

const candidates = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
const coreGap = JSON.parse(fs.readFileSync(coreGapPath, 'utf8'))
const reinforcement = JSON.parse(fs.readFileSync(reinforcementPath, 'utf8'))
const existingTexts = new Set([
  ...Object.values(existing.categories ?? {}).flatMap((category) => category.items ?? []).map((item) => String(item.text).normalize('NFKC').trim()),
  ...(coreGap.items ?? []).map((item) => String(item.text).normalize('NFKC').trim()),
  ...(reinforcement.items ?? []).map((item) => String(item.text).normalize('NFKC').trim()),
])

const items = (candidates.items ?? []).map((candidate, index) => ({
  id: `coverage-recording-open-research-${String(index + 1).padStart(3, '0')}`,
  text: candidate.text,
  category: '音系强化',
  target: candidate.coverage_targets[0],
  coverage_targets: candidate.coverage_targets,
  source: 'Chen-xi111/Making-Mandarin-Sentences-from-syllables-bci (MIT open research corpus)',
  source_text: candidate.text,
  source_pinyin: candidate.source_sentence_pinyin,
  source_sentence_pinyin: candidate.source_sentence_pinyin,
  source_row_number: candidate.source_row_number,
  source_url: 'https://github.com/Chen-xi111/Making-Mandarin-Sentences-from-syllables-bci/blob/main/corpus_sentences.csv',
  prompt_type: 'short_sentence',
  target_carriers: candidate.coverage_targets.map((target) => ({
    text: candidate.text,
    source_pinyin: candidate.source_sentence_pinyin,
    source: 'open research corpus sentence reading evidence',
    target,
  })),
  recording_readiness: 'ready_for_recording',
  language_review: 'machine_checked_open_research_candidate',
  review_note: '开放研究语料补充；不是教材原文，不代表训练导入批准。只按有效音频、非空 target 和错读/漏读/长空白/不可用音频做后续质检。',
}))

const validation = items.map((item) => ({
  id: item.id,
  ...validateMandarinRecordingCandidate(item, { existingTexts }),
}))
const invalid = validation.filter((item) => !item.valid)
if (invalid.length > 0) {
  throw new Error(`open research recording gate failed:\n${invalid.map((item) => `${item.id}: ${item.errors.join(',')}`).join('\n')}`)
}
if (items.length !== 14) throw new Error(`unexpected open research item count: ${items.length}`)
const targets = new Set(items.flatMap((item) => item.coverage_targets))
if (targets.size !== 15) throw new Error(`unexpected open research target count: ${targets.size}`)

const payload = {
  kind: 'voxflame_mandarin_recording_open_research_corpus',
  generated_at: new Date().toISOString(),
  generated_from: path.basename(inputPath),
  source: candidates.source,
  policy: {
    linguistic_coverage_is_the_root_criterion: true,
    source_is_open_research_not_textbook: true,
    machine_language_and_content_checks_passed: true,
    human_spoken_text_is_not_required_before_recording: true,
    valid_audio_and_non_empty_target_are_collection_prerequisites: true,
    asr_is_hint_only_and_never_an_automatic_rejection_gate: true,
    recording_visibility_does_not_equal_model_training_import: true,
    existing_prompts_recordings_manifests_and_sources_preserved: true,
    excluded_candidates_remain_in_source_evidence: true,
    gate_rules: 'frontend/scripts/mandarin-recording-corpus-gate-core.mjs',
  },
  summary: {
    recording_ready_items: items.length,
    recording_ready_targets: targets.size,
    short_sentences: items.length,
    gate_passed_items: validation.filter((item) => item.valid).length,
  },
  items,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${items.length} open-research recording-ready prompts for ${targets.size} targets`)

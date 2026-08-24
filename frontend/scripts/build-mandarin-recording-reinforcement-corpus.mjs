#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { validateMandarinRecordingCandidate } from './mandarin-recording-corpus-gate-core.mjs'
import { annotateMandarinText } from './mandarin-coverage-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input') ?? path.resolve('../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-reinforcement-context-review.json')
const outputPath = value('--output') ?? path.resolve('src/lib/corpus/generated/mandarin-recording-reinforcement-corpus.json')
const existingCorpusPath = value('--existing') ?? path.resolve('src/lib/corpus/generated/mandarin-training-real.json')
const coreGapPath = value('--core-gap') ?? path.resolve('src/lib/corpus/generated/mandarin-recording-core-gap-corpus.json')

const review = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
if (review.kind !== 'voxflame_mandarin_reinforcement_context_review_pack') {
  throw new Error(`unexpected input kind: ${review.kind}`)
}

const generatedCorpus = JSON.parse(fs.readFileSync(existingCorpusPath, 'utf8'))
const existingTexts = new Set(
  Object.values(generatedCorpus.categories ?? {})
    .flatMap((category) => category.items ?? [])
    .map((item) => String(item.text).normalize('NFKC').trim()),
)
const coreGap = JSON.parse(fs.readFileSync(coreGapPath, 'utf8'))
for (const item of coreGap.items ?? []) existingTexts.add(String(item.text).normalize('NFKC').trim())

const items = []
const seenTexts = new Set(existingTexts)
const rejected = []
for (const candidate of review.items ?? []) {
  const item = {
    id: `coverage-recording-reinforcement-${candidate.id}`,
    text: String(candidate.text).normalize('NFKC').trim(),
    category: '音系强化',
    target: candidate.coverage_targets?.[0],
    coverage_targets: candidate.coverage_targets,
    source: candidate.source,
    source_sentence_id: candidate.source_sentence_id ?? null,
    source_url: candidate.source_url ?? null,
    contributor: candidate.contributor ?? null,
    prompt_type: candidate.type,
    target_carriers: candidate.target_carriers ?? [],
    source_sentence_pinyin: annotateMandarinText(candidate.text).syllables.map((syllable) => syllable.syllableTone).join(' '),
    recording_readiness: 'ready_for_recording',
    language_review: 'machine_checked_candidate_pack',
    review_note: '低频补强录音就绪；只按有效音频、非空 target 和错读/漏读/长空白/不可用音频状态做后续质检。',
  }
  const validation = validateMandarinRecordingCandidate(item, { existingTexts: seenTexts })
  if (!validation.valid) {
    rejected.push({ id: item.id, text: item.text, errors: validation.errors })
    continue
  }
  seenTexts.add(item.text)
  items.push(item)
}

if (items.length !== 291) {
  throw new Error(`unexpected machine-checked reinforcement size: ${items.length} (rejected ${rejected.length})`)
}

const payload = {
  kind: 'voxflame_mandarin_recording_reinforcement_corpus',
  generated_at: new Date().toISOString(),
  generated_from: path.basename(inputPath),
  policy: {
    linguistic_coverage_is_the_root_criterion: true,
    machine_language_and_content_checks_passed: true,
    human_spoken_text_is_not_required_before_recording: true,
    valid_audio_and_non_empty_target_are_collection_prerequisites: true,
    asr_is_hint_only_and_never_an_automatic_rejection_gate: true,
    quality_diagnostics_are_not_collection_gates: true,
    existing_prompts_recordings_manifests_and_sources_preserved: true,
    rejected_candidate_count: rejected.length,
    gate_rules: 'frontend/scripts/mandarin-recording-corpus-gate-core.mjs',
  },
  summary: {
    recording_ready_items: items.length,
    recording_ready_targets: new Set(items.flatMap((item) => item.coverage_targets ?? [])).size,
    short_sentences: items.filter((item) => item.prompt_type === 'short_sentence').length,
    source_counts: Object.fromEntries(Object.entries(Object.groupBy(items, (item) => item.source)).map(([source, rows]) => [source, rows.length])),
    rejected_candidates: rejected.length,
  },
  items,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${items.length} machine-checked reinforcement prompts; rejected ${rejected.length}`)

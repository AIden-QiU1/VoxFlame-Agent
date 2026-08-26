#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import zlib from 'node:zlib'

import { MANDARIN_TRAINING_EXERCISES } from '../src/lib/corpus/mandarin-training-data/index.ts'
import { parseCedictEntries } from './mandarin-coverage-ledger-core.mjs'
import {
  buildCarrierIndex,
  candidateFromAuthoredEntry,
  candidateFromSentence,
  selectReinforcementCandidatePack,
} from './mandarin-reinforcement-candidate-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function readTextMaybeGzip(filePath) {
  const payload = fs.readFileSync(filePath)
  return filePath.endsWith('.gz') ? zlib.gunzipSync(payload).toString('utf8') : payload.toString('utf8')
}

const ledgerPath = value('--ledger')
const planPath = value('--plan')
const cedictPath = value('--cedict')
const tatoebaPath = value('--tatoeba')
const tatoebaSourcePath = value('--tatoeba-source') ?? tatoebaPath
const outputPath = value('--output')
const authoredPath = value('--authored') ?? 'src/lib/corpus/mandarin-reinforcement-authored-candidates.json'
const contextsPerTarget = Number(value('--contexts-per-target') ?? 3)
if (!ledgerPath || !planPath || !cedictPath || !tatoebaPath || !outputPath || !Number.isInteger(contextsPerTarget) || contextsPerTarget < 1) {
  throw new Error('usage: build-mandarin-reinforcement-candidates --ledger <ledger.json> --plan <plan.json> --cedict <cedict.txt[.gz]> --tatoeba <cmn detailed.tsv> --output <review.json> [--authored <authored.json>] [--contexts-per-target 3]')
}

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
const partialTargetIds = new Set(plan.targets
  .filter((target) => target.status === 'collection_slots_partially_allocated')
  .map((target) => target.syllable_tone))
const ledgerByTarget = new Map(ledger.targets.map((target) => [target.syllable_tone, target]))
const targets = plan.targets
  .filter((target) => partialTargetIds.has(target.syllable_tone))
  .map((target) => ({
    ...target,
    syllable: ledgerByTarget.get(target.syllable_tone)?.syllable,
    tone: ledgerByTarget.get(target.syllable_tone)?.tone,
  }))
const wordRows = parseCedictEntries(readTextMaybeGzip(cedictPath), partialTargetIds)
const { byWord, safeWordsByTarget } = buildCarrierIndex(wordRows, partialTargetIds)
const currentTextSet = new Set(MANDARIN_TRAINING_EXERCISES.map((exercise) => exercise.text.normalize('NFKC').trim()))
const candidates = []
const input = fs.createReadStream(tatoebaPath)
const lines = readline.createInterface({ input, crlfDelay: Infinity })
for await (const line of lines) {
  const [id, language, text, contributor] = line.split('\t')
  if (language !== 'cmn' || !id || !text || !contributor || contributor === '\\N') continue
  const candidate = candidateFromSentence({ id, text, contributor, carrierIndex: byWord, currentTextSet })
  if (candidate) candidates.push(candidate)
}

const externalPack = selectReinforcementCandidatePack({
  targets,
  candidates,
  safeWordsByTarget,
  contextsPerTarget,
  sources: {},
})
const guidedBriefByTarget = new Map(externalPack.authoring_briefs
  .filter((brief) => brief.authoring_path === 'guided_authoring')
  .map((brief) => [brief.syllable_tone, brief]))
const authoredRegistry = JSON.parse(fs.readFileSync(authoredPath, 'utf8'))
if (authoredRegistry.kind !== 'voxflame_mandarin_reinforcement_authored_candidate_registry') {
  throw new Error('authored registry kind is invalid')
}
if (authoredRegistry.status !== 'human_review_required_not_for_production' || !Array.isArray(authoredRegistry.items)) {
  throw new Error('authored registry must remain a human-review-only item array')
}
const authoredIds = new Set()
const authoredTexts = new Set()
const authoredCountByTarget = new Map()
for (const entry of authoredRegistry.items) {
  if (authoredIds.has(entry.id)) throw new Error(`duplicate authored candidate id: ${entry.id}`)
  if (authoredTexts.has(entry.text)) throw new Error(`duplicate authored candidate text: ${entry.text}`)
  authoredIds.add(entry.id)
  authoredTexts.add(entry.text)
  if (!guidedBriefByTarget.has(entry.target)) throw new Error(`${entry.id} does not belong to a guided authoring gap`)
  const candidate = candidateFromAuthoredEntry({ entry, safeWordsByTarget, currentTextSet })
  candidates.push(candidate)
  authoredCountByTarget.set(entry.target, (authoredCountByTarget.get(entry.target) ?? 0) + 1)
}
const authoredCountErrors = []
for (const [target, brief] of guidedBriefByTarget) {
  const actual = authoredCountByTarget.get(target) ?? 0
  if (actual !== brief.contexts_required) authoredCountErrors.push(`${target}: expected ${brief.contexts_required}, received ${actual}`)
}
if (authoredCountErrors.length > 0) {
  throw new Error(`authored context counts do not match guided gaps:\n${authoredCountErrors.join('\n')}`)
}

const pack = selectReinforcementCandidatePack({
  targets,
  candidates,
  safeWordsByTarget,
  contextsPerTarget,
  sources: {
    coverage_ledger: { generated_at: ledger.generated_at, item_count: ledger.sources.current_prompt_corpus.item_count },
    reinforcement_plan: { generated_at: plan.generated_at, target_count: plan.summary.below_minimum_targets },
    lexical_carriers: { path_hint: path.basename(cedictPath), sha256: sha256(cedictPath), license: 'CC BY-SA 4.0' },
    authored_candidates: {
      path_hint: path.basename(authoredPath),
      sha256: sha256(authoredPath),
      item_count: authoredRegistry.items.length,
      source: 'VoxFlame authored candidates pending six-field human review',
    },
    external_sentences: {
      path_hint: path.basename(tatoebaSourcePath),
      sha256: sha256(tatoebaSourcePath),
      normalized_path_hint: path.basename(tatoebaPath),
      normalized_sha256: sha256(tatoebaPath),
      normalization: 'OpenCC t2s plus repository Traditional Chinese fallback map; sentence IDs and contributors preserved',
      license: 'CC BY 2.0 FR',
    },
  },
})

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
console.log(`selected ${pack.summary.selected_items} sentences for ${pack.summary.target_count} targets; ${pack.summary.targets_requiring_authoring} targets still require authoring`)

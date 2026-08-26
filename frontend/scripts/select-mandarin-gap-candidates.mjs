#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { annotateMandarinText, isBlockedGapCandidate } from './mandarin-coverage-core.mjs'
import {
  pendingReviewState,
  productScoreForSentence,
  proposedTaskForSentence,
  reviewWarningsForSentence,
} from './mandarin-gap-candidate-core.mjs'

function value(name, fallback, argv = process.argv) {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : fallback
}

function normalizeSentence(text) {
  return text
    .normalize('NFKC')
    .replace(/[“”‘’「」『』《》〈〉【】（）()，。！？；：、…—,.!?;:\s]/gu, '')
}

function visibleLength(text) {
  return Array.from(text.match(/[\p{Script=Han}]/gu) ?? []).length
}

function sentenceTargets(text) {
  return [...new Set(annotateMandarinText(text).syllables.map((syllable) => syllable.syllableTone))]
}

async function collectCandidates({ inputPath, audit, corpus, license }) {
  const existingTexts = new Set(corpus.items.map((item) => normalizeSentence(item.text)))
  const currentCounts = audit.prompt_corpus.distributions.syllable_tones
  const expectedForms = new Set(audit.prompt_corpus.coverage.common_syllable_tones.missing.concat(
    audit.prompt_corpus.coverage.common_syllable_tones.below_minimum,
  ))
  const candidates = []
  const input = fs.createReadStream(inputPath)
  const lines = readline.createInterface({ input, crlfDelay: Infinity })

  for await (const line of lines) {
    const [id, language, rawText, author] = line.split('\t')
    if (language !== 'cmn' || !author || author === '\\N') continue
    const text = rawText.normalize('NFKC').trim()
    const length = visibleLength(text)
    if (length < 4 || length > 16) continue
    if (/[^\p{Script=Han}，。！？；：、…—“”‘’（）《》\s]/u.test(text)) continue
    if (isBlockedGapCandidate(text)) continue
    const normalized = normalizeSentence(text)
    if (!normalized || existingTexts.has(normalized)) continue

    const targets = sentenceTargets(text).filter((target) => expectedForms.has(target))
    if (targets.length === 0) continue
    const weightedGain = targets.reduce((sum, target) => sum + (20 - Math.min(20, currentCounts[target] ?? 0)), 0)
    const proposedTask = proposedTaskForSentence(text)
    candidates.push({
      id: `tatoeba-cmn-${id}`,
      text,
      source_sentence_id: Number(id),
      contributor: author,
      license,
      source_url: `https://tatoeba.org/en/sentences/show/${id}`,
      coverage_targets: targets.sort(),
      weighted_gap_gain: weightedGain,
      product_score: productScoreForSentence(text, proposedTask),
      proposed_task: proposedTask,
      visible_han_length: length,
      review_warnings: reviewWarningsForSentence(text),
      reviews: pendingReviewState(),
    })
  }

  return candidates
}

function selectBalancedCandidates(candidates, limit) {
  candidates.sort((left, right) => (
    (right.weighted_gap_gain + right.product_score) - (left.weighted_gap_gain + left.product_score)
    || right.coverage_targets.length - left.coverage_targets.length
    || left.visible_han_length - right.visible_han_length
    || left.source_sentence_id - right.source_sentence_id
  ))

  const selected = []
  const selectedTexts = new Set()
  const contributorCounts = new Map()
  const targetCounts = new Map()
  const taskCounts = new Map()
  const functionalQuota = Math.ceil(limit * 0.6)
  for (const candidate of candidates) {
    if (selected.length >= limit) break
    const normalized = normalizeSentence(candidate.text)
    if (selectedTexts.has(normalized)) continue
    const contributorCount = contributorCounts.get(candidate.contributor) ?? 0
    if (contributorCount >= Math.max(10, Math.ceil(limit * 0.08))) continue
    const taskCount = taskCounts.get(candidate.proposed_task) ?? 0
    if (candidate.proposed_task === 'connected_reading' && taskCount >= limit - functionalQuota) continue
    const marginalTargets = candidate.coverage_targets.filter((target) => (targetCounts.get(target) ?? 0) < 3)
    if (marginalTargets.length === 0) continue
    selected.push({ ...candidate, marginal_targets: marginalTargets })
    selectedTexts.add(normalized)
    contributorCounts.set(candidate.contributor, contributorCount + 1)
    taskCounts.set(candidate.proposed_task, taskCount + 1)
    for (const target of marginalTargets) targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1)
  }

  return { selected, targetCounts, taskCounts, functionalQuota }
}

export async function main(argv = process.argv) {
  const inputPath = value('--input', undefined, argv)
  const auditPath = value('--audit', undefined, argv)
  const corpusPath = value('--corpus', undefined, argv)
  const outputPath = value('--output', undefined, argv)
  const limit = Number(value('--limit', '300', argv))
  const license = value('--license', 'CC BY 2.0 FR', argv)
  const sourceUrl = value('--source-url', undefined, argv)

  if (!inputPath || !auditPath || !corpusPath || !outputPath || !sourceUrl) {
    throw new Error('usage: select-mandarin-gap-candidates --input <detailed.tsv> --audit <baseline.json> --corpus <prompts.json> --output <json> --source-url <url> [--limit 300]')
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('--limit must be a positive integer')
  }

  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'))
  const candidates = await collectCandidates({ inputPath, audit, corpus, license })
  const { selected, targetCounts, taskCounts, functionalQuota } = selectBalancedCandidates(candidates, limit)

  const payload = {
    kind: 'mandarin_gap_candidate_review_queue',
    status: 'human_review_required_not_for_production',
    generated_at: new Date().toISOString(),
    source: {
      export_url: sourceUrl,
      source_file_sha256: value('--source-sha256', undefined, argv),
      license,
      attribution_required: true,
      limitations: [
        'Community-contributed sentences are not professionally fact-checked.',
        'Character conversion does not guarantee modern Mainland Mandarin wording; flagged and unflagged items still require manual usage review.',
        'Every selected sentence requires linguistic, safety, naturalness, and product review.',
      ],
    },
    policy: {
      target_length_han_characters: [4, 16],
      exclude_ascii_digits_and_unapproved_symbols: true,
      exclude_existing_prompt_text: true,
      select_only_current_missing_or_below_minimum_syllable_tone_forms: true,
      maximum_three_candidates_per_target: true,
      contributor_soft_cap: Math.max(10, Math.ceil(limit * 0.08)),
      functional_speech_target_share: 0.6,
      functional_speech_target_count: functionalQuota,
      proposed_task_is_not_final_classification: true,
    },
    stats: {
      eligible_candidates_before_balancing: candidates.length,
      selected_candidates: selected.length,
      selected_gap_targets: targetCounts.size,
      proposed_task_counts: Object.fromEntries(taskCounts),
    },
    items: selected,
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`selected ${selected.length} candidates covering ${targetCounts.size} gap targets`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}

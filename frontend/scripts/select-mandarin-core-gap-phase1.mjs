#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isBlockedGapCandidate } from './mandarin-coverage-core.mjs'
import { containsBlockedDefaultCorpusContent } from './mandarin-corpus-content-policy.mjs'
import { productScoreForSentence, reviewWarningsForSentence } from './mandarin-gap-candidate-core.mjs'

const BLOCKED_PRODUCT_TEXT = /枪|色情|强奸|自杀|杀人|尸体|毒品|赌博|癌|死亡|宗教|蠢人|蠢蛋|蠢货/u
const BLOCKED_WORD_FLAGS = new Set([
  'proper_name',
  'variant',
  'archaic_or_literary',
  'dialect_or_regional',
  'onomatopoeia_or_interjection',
  'single_character',
])

// Frequency is useful evidence, but the most frequent carrier is not always the
// safest default recording prompt. Prefer traceable neutral whole words over
// stigmatizing, adversarial, alcohol-related, or otherwise heavy alternatives.
const PREFERRED_CORE_WORD_ANCHORS = new Map([
  ['can3', '惨淡'],
  ['che3', '牵扯'],
  ['chuo1', '戳破'],
  ['ci1', '瑕疵'],
  ['cuan4', '篡改'],
  ['dai3', '好歹'],
  ['duo4', '掌舵'],
  ['e1', '阿胶'],
  ['fei3', '不菲'],
  ['hong3', '哄劝'],
  ['hong4', '起哄'],
  ['hou3', '吼声'],
  ['lu0', '葫芦'],
  ['luan3', '鹅卵石'],
  ['luo1', '啰唆'],
  ['luo3', '裸眼'],
  ['mang3', '蟒蛇'],
  ['niang4', '酝酿'],
  ['nie1', '捏合'],
  ['nie4', '镊子'],
  ['qiao4', '陡峭'],
  ['qin3', '寝室'],
  ['rao2', '富饶'],
  ['san3', '雨伞'],
  ['shai1', '筛子'],
  ['shuai3', '甩掉'],
  ['song3', '耸肩'],
  ['tang4', '烫发'],
  ['wa4', '袜子'],
  ['xun1', '烟熏'],
  ['yu1', '淤泥'],
  ['yuan1', '渊博'],
  ['zha2', '炸鱼'],
  ['xiu3', '腐朽'],
])

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hanLength(text) {
  return Array.from(text.match(/\p{Script=Han}/gu) ?? []).length
}

export function isPhase1WordCandidate(candidate) {
  const length = hanLength(candidate.simplified)
  return length >= 2
    && length <= 4
    && !candidate.flags.some((flag) => BLOCKED_WORD_FLAGS.has(flag))
    && !containsBlockedDefaultCorpusContent(candidate.simplified)
    && !BLOCKED_PRODUCT_TEXT.test(candidate.simplified)
    && candidate.candidate_score >= 19
}

function isSafePreferredWordCandidate(candidate) {
  const length = hanLength(candidate.simplified)
  return length >= 2
    && length <= 4
    && !candidate.flags.some((flag) => BLOCKED_WORD_FLAGS.has(flag))
    && !containsBlockedDefaultCorpusContent(candidate.simplified)
    && !BLOCKED_PRODUCT_TEXT.test(candidate.simplified)
}

function wordCandidatesForTarget(target) {
  const preferred = PREFERRED_CORE_WORD_ANCHORS.get(target.syllable_tone)
  return target.candidate_words
    .filter((candidate) => (
      isPhase1WordCandidate(candidate)
      || (candidate.simplified === preferred && isSafePreferredWordCandidate(candidate))
    ))
    .sort((left, right) => {
      const leftPreferred = left.simplified === preferred ? 1 : 0
      const rightPreferred = right.simplified === preferred ? 1 : 0
      return rightPreferred - leftPreferred
        || right.candidate_score - left.candidate_score
        || left.simplified.localeCompare(right.simplified)
    })
}

export function isPhase1SentenceCandidate(candidate) {
  const length = hanLength(candidate.text)
  return length >= 4
    && length <= 12
    && !containsBlockedDefaultCorpusContent(candidate.text)
    && !BLOCKED_PRODUCT_TEXT.test(candidate.text)
    && !isBlockedGapCandidate(candidate.text)
    && reviewWarningsForSentence(candidate.text).length === 0
}

function pendingReviews() {
  return {
    linguistic: 'pending',
    naturalness: 'pending',
    user_burden: 'pending',
    safety: 'pending',
    license: 'pending',
    product: 'pending',
  }
}

function externalSentenceTargetCarriers(target, candidate) {
  const matchedWords = new Set(candidate.matched_words ?? [])
  return target.candidate_words
    .filter((word) => (
      isPhase1WordCandidate(word)
      && matchedWords.has(word.simplified)
      && candidate.text.includes(word.simplified)
      && (word.syllable_tones ?? []).includes(target.syllable_tone)
    ))
    .map((word) => ({
      text: word.simplified,
      source_pinyin: word.pinyin,
      source: 'CC-CEDICT whole-word reading',
    }))
}

export function selectPhase1CoreGapPack(ledger, { examplesPerTarget = 3 } = {}) {
  const targets = ledger.targets.filter((target) => target.coverage_status === 'missing' && target.tier === 'core')
  const targetIds = new Set(targets.map((target) => target.syllable_tone))
  const deficits = new Map(targets.map((target) => [target.syllable_tone, examplesPerTarget]))
  const sentenceGoalPerTarget = Math.min(2, Math.max(0, examplesPerTarget - 1))
  const sentenceDeficits = new Map(targets.map((target) => [target.syllable_tone, sentenceGoalPerTarget]))
  const sentencePool = new Map()

  for (const target of targets) {
    for (const candidate of target.candidate_sentences.filter(isPhase1SentenceCandidate)) {
      const targetCarriers = candidate.authored_candidate
        ? (candidate.target_carriers ?? [])
        : externalSentenceTargetCarriers(target, candidate)
      if (!candidate.authored_candidate && targetCarriers.length === 0) continue
      const id = `sentence-${candidate.source_sentence_id}`
      const coverageTargets = candidate.coverage_targets.filter((item) => targetIds.has(item))
      if (coverageTargets.length === 0) continue
      const existing = sentencePool.get(id)
      if (existing) {
        existing.coverage_targets = [...new Set([...existing.coverage_targets, ...coverageTargets])].sort()
        existing.target_carriers = [
          ...existing.target_carriers,
          ...targetCarriers.filter((carrier) => !existing.target_carriers.some((item) => (
            item.text === carrier.text && item.source_pinyin === carrier.source_pinyin
          ))),
        ]
      } else {
        sentencePool.set(id, {
          id,
          type: 'short_sentence',
          text: candidate.text,
          coverage_targets: coverageTargets,
          source: candidate.authored_candidate ? 'VoxFlame authored candidate' : 'Tatoeba',
          source_sentence_id: candidate.source_sentence_id,
          contributor: candidate.contributor,
          source_url: candidate.source_url,
          authoring_rationale: candidate.authoring_rationale,
          target_carriers: targetCarriers,
          reviews: pendingReviews(),
        })
      }
    }
  }

  const selected = []
  const availableSentences = [...sentencePool.values()]

  function selectSentences(candidates) {
    while (true) {
      let best = null
      let bestScore = 0
      for (const candidate of candidates) {
        if (selected.some((item) => item.id === candidate.id)) continue
        const marginal = candidate.coverage_targets.filter((target) => (
          (deficits.get(target) ?? 0) > 0
          && (sentenceDeficits.get(target) ?? 0) > 0
        ))
        if (marginal.length === 0) continue
        const score = marginal.reduce((sum, target) => sum + (deficits.get(target) ?? 0), 0) * 100
          + productScoreForSentence(candidate.text)
          - hanLength(candidate.text)
        if (score > bestScore || (score === bestScore && candidate.id.localeCompare(best?.id ?? '') < 0)) {
          best = { ...candidate, marginal_targets: marginal }
          bestScore = score
        }
      }
      if (!best) break
      selected.push(best)
      for (const target of best.marginal_targets) {
        deficits.set(target, Math.max(0, (deficits.get(target) ?? 0) - 1))
        sentenceDeficits.set(target, Math.max(0, (sentenceDeficits.get(target) ?? 0) - 1))
      }
    }
  }

  // Authored candidates exist specifically to replace awkward or unsafe corpus gaps.
  selectSentences(availableSentences.filter((candidate) => candidate.source === 'VoxFlame authored candidate'))

  const selectedWordTexts = new Set()
  function selectWords(maxPerTarget) {
    for (const target of targets) {
      let selectedForTarget = 0
      const candidates = wordCandidatesForTarget(target)
      for (const candidate of candidates) {
        if ((deficits.get(target.syllable_tone) ?? 0) <= 0 || selectedForTarget >= maxPerTarget) break
        const key = `${target.syllable_tone}:${candidate.simplified}`
        if (selectedWordTexts.has(key)) continue
        selected.push({
          id: `word-${target.syllable_tone}-${candidate.simplified}`,
          type: 'word',
          text: candidate.simplified,
          coverage_targets: [target.syllable_tone],
          source: 'CC-CEDICT',
          source_pinyin: candidate.pinyin,
          source_flags: candidate.flags,
          source_usage_evidence: {
            current_prompt_occurrences: candidate.current_corpus_text_occurrences ?? 0,
            external_sentence_occurrences: candidate.external_sentence_occurrences ?? 0,
          },
          reviews: pendingReviews(),
        })
        selectedWordTexts.add(key)
        selectedForTarget += 1
        deficits.set(target.syllable_tone, Math.max(0, (deficits.get(target.syllable_tone) ?? 0) - 1))
      }
    }
  }

  // Keep one traceable whole-word reading as a compact pronunciation anchor.
  selectWords(1)

  // Then prefer natural licensed sentences so a target is not represented by dictionary entries alone.
  selectSentences(availableSentences.filter((candidate) => candidate.source !== 'VoxFlame authored candidate'))

  // Extra words are a fallback only when the sentence goal cannot be met safely and naturally.
  selectWords(Number.POSITIVE_INFINITY)

  const targetStatus = targets.map((target) => {
    const items = selected.filter((item) => item.coverage_targets.includes(target.syllable_tone))
    return {
      syllable_tone: target.syllable_tone,
      syllable: target.syllable,
      selected_examples: items.length,
      selected_word_examples: items.filter((item) => item.type === 'word').length,
      selected_sentence_examples: items.filter((item) => item.type === 'short_sentence').length,
      remaining_deficit: deficits.get(target.syllable_tone) ?? 0,
      readiness: (deficits.get(target.syllable_tone) ?? 0) === 0 ? 'candidate_sufficient_pending_review' : 'insufficient_natural_candidates',
      composition_readiness: items.filter((item) => item.type === 'short_sentence').length >= sentenceGoalPerTarget
        ? 'sentence_mix_goal_met'
        : 'sentence_mix_gap_requires_review',
      carrier_characters: target.carrier_characters,
    }
  })

  return {
    items: selected.sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id)),
    target_status: targetStatus,
    summary: {
      core_missing_targets: targets.length,
      examples_per_target_goal: examplesPerTarget,
      targets_with_sufficient_candidates: targetStatus.filter((target) => target.readiness === 'candidate_sufficient_pending_review').length,
      targets_with_insufficient_candidates: targetStatus.filter((target) => target.readiness === 'insufficient_natural_candidates').length,
      sentence_examples_per_target_goal: sentenceGoalPerTarget,
      targets_with_sentence_mix_goal: targetStatus.filter((target) => target.composition_readiness === 'sentence_mix_goal_met').length,
      targets_with_sentence_mix_gap: targetStatus.filter((target) => target.composition_readiness === 'sentence_mix_gap_requires_review').length,
      selected_items: selected.length,
      selected_words: selected.filter((item) => item.type === 'word').length,
      selected_short_sentences: selected.filter((item) => item.type === 'short_sentence').length,
    },
  }
}

export function mergeAuthoredCandidates(ledger, authoredPack) {
  if (!authoredPack) return ledger
  const targets = new Map(ledger.targets.map((target) => [target.syllable_tone, target]))
  for (const item of authoredPack.items ?? []) {
    if (!isPhase1SentenceCandidate(item)) continue
    if (!Array.isArray(item.target_carriers) || item.target_carriers.length === 0) continue
    for (const targetId of item.coverage_targets ?? []) {
      const target = targets.get(targetId)
      if (!target || target.coverage_status !== 'missing' || target.tier !== 'core') continue
      if (target.candidate_sentences.some((candidate) => candidate.text === item.text)) continue
      target.candidate_sentences.push({
        text: item.text,
        source_sentence_id: item.id,
        contributor: 'VoxFlame authored candidate',
        source_url: null,
        coverage_targets: item.coverage_targets,
        authored_candidate: true,
        authoring_rationale: item.rationale,
        target_carriers: item.target_carriers,
      })
    }
  }
  return ledger
}

export function main() {
  const inputPath = value('--input')
  const outputPath = value('--output')
  const authoredPath = value('--authored')
  const examplesPerTarget = Number(value('--examples-per-target') ?? 3)
  if (!inputPath || !outputPath || !Number.isInteger(examplesPerTarget) || examplesPerTarget < 1) {
    throw new Error('usage: select-mandarin-core-gap-phase1 --input <ledger.json> --output <review.json> [--examples-per-target 3]')
  }

  const ledger = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const authoredPack = authoredPath ? JSON.parse(fs.readFileSync(authoredPath, 'utf8')) : null
  mergeAuthoredCandidates(ledger, authoredPack)
  const selection = selectPhase1CoreGapPack(ledger, { examplesPerTarget })
  const payload = {
    kind: 'voxflame_mandarin_core_gap_phase1_review_pack',
    generated_at: new Date().toISOString(),
    status: 'human_review_required_not_for_production',
    policy: {
      scope: 'missing core syllable-tone targets only; below-minimum reinforcement follows after hard gaps',
      examples_per_target_goal: examplesPerTarget,
      sentence_length_han_characters: [4, 12],
      word_length_han_characters: [2, 4],
      disputed_targets_excluded: true,
      edge_targets_excluded_from_default_pack: true,
      commercial_learning_packages_excluded: true,
      sensitive_or_high_burden_candidates_excluded_from_automatic_selection: true,
      no_existing_prompt_or_recording_removed: true,
      no_candidate_is_production_eligible_until_all_reviews_are_approved: true,
    },
    sources: ledger.sources,
    summary: selection.summary,
    target_status: selection.target_status,
    items: selection.items,
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`selected ${payload.summary.selected_items} items; ${payload.summary.targets_with_sufficient_candidates}/${payload.summary.core_missing_targets} targets have ${examplesPerTarget} candidates`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

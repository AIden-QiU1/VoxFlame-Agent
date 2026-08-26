import { isBlockedGapCandidate, normalizePinyinSyllable, numberedPinyinFromDiacritics } from './mandarin-coverage-core.mjs'
import { containsBlockedDefaultCorpusContent } from './mandarin-corpus-content-policy.mjs'

const EDGE_DEFINITION_PATTERNS = [
  ['proper_name', /\b(?:surname|given name|name of)\b/iu],
  ['variant', /\b(?:variant of|old variant of|erroneous variant)\b/iu],
  ['archaic_or_literary', /\b(?:archaic|literary|ancient)\b/iu],
  ['dialect_or_regional', /\b(?:dialect|dialectal|regional|Taiwan pr\.)\b/iu],
  ['onomatopoeia_or_interjection', /\b(?:onomatopoeia|interjection)\b/iu],
  ['specialized_or_bound', /\b(?:bound form|classifier|abbr\. for)\b/iu],
]

const COMMERCIAL_PACKAGE_CONTENT = /学习包|课程包|培训包|资料包/u

const MANUAL_BASE_TIERS = new Map([
  ['cen', 'edge'],
  ['chua', 'disputed'],
  ['chuai', 'edge'],
  ['den', 'edge'],
  ['m', 'edge'],
  ['n', 'edge'],
  ['nang', 'edge'],
  ['nou', 'edge'],
  ['seng', 'edge'],
  ['zhuai', 'disputed'],
])

const MANUAL_TARGET_TIERS = new Map([
  ['bu1', 'edge'],
  ['bu2', 'edge'],
  ['chun3', 'edge'],
  ['heng4', 'edge'],
  ['la0', 'edge'],
  ['long4', 'edge'],
  ['ming3', 'edge'],
  ['nüe4', 'edge'],
  ['suo0', 'edge'],
  ['zei2', 'edge'],
])

function hanLength(value) {
  return Array.from(value.match(/\p{Script=Han}/gu) ?? []).length
}

function normalizeCedictPinyin(value) {
  const token = value.trim().replaceAll('u:', 'ü').replaceAll('U:', 'Ü')
  const match = token.match(/^([A-Za-züÜêÊ]+)([1-5])$/u)
  if (!match) return null
  const tone = match[2] === '5' ? '0' : match[2]
  return normalizePinyinSyllable(`${match[1].toLowerCase()}${tone}`).syllableTone
}

export function parseMandarinCharacterRows(source) {
  const byTarget = new Map()
  for (const line of source.split(/\r?\n/u)) {
    if (!line || line.startsWith('#')) continue
    const [body, rawComment = ''] = line.split('#', 2)
    const match = body.match(/^U\+([0-9A-F]+):\s*([^,\s]+)/u)
    if (!match) continue
    const comment = rawComment.trim()
    const character = comment.split(/\s+/u)[0] || String.fromCodePoint(Number.parseInt(match[1], 16))
    const sourceReading = match[2]
    const target = normalizePinyinSyllable(numberedPinyinFromDiacritics(sourceReading)).syllableTone
    const item = {
      character,
      source_reading: sourceReading,
      source_comment: comment,
      review_flag: /[?]|->|<-/u.test(comment),
    }
    const rows = byTarget.get(target) ?? []
    rows.push(item)
    byTarget.set(target, rows)
  }
  return byTarget
}

export function parseCedictEntries(source, expectedTargets) {
  const byTarget = new Map()
  for (const line of source.split(/\r?\n/u)) {
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/u)
    if (!match) continue
    const [, traditional, simplified, rawPinyin, definition] = match
    if (!/^\p{Script=Han}+$/u.test(simplified)) continue
    const length = hanLength(simplified)
    if (length < 1 || length > 6) continue
    const syllableTones = rawPinyin.split(/\s+/u).map(normalizeCedictPinyin).filter(Boolean)
    const matchedTargets = [...new Set(syllableTones.filter((target) => expectedTargets.has(target)))]
    if (matchedTargets.length === 0) continue
    const flags = EDGE_DEFINITION_PATTERNS.flatMap(([flag, pattern]) => pattern.test(definition) ? [flag] : [])
    if (/[A-Z]/u.test(rawPinyin)) flags.push('proper_name')
    if (length === 1) flags.push('single_character')
    const candidate = {
      simplified,
      traditional,
      pinyin: rawPinyin.replaceAll('u:', 'ü'),
      definition,
      syllable_tones: syllableTones,
      flags: [...new Set(flags)].sort(),
    }
    for (const target of matchedTargets) {
      const entries = byTarget.get(target) ?? []
      if (!entries.some((entry) => entry.simplified === simplified && entry.pinyin === candidate.pinyin)) entries.push(candidate)
      byTarget.set(target, entries)
    }
  }
  return byTarget
}

export function scoreCandidateWord(candidate, corpusOccurrences, externalOccurrences) {
  let score = 0
  const length = hanLength(candidate.simplified)
  if (length >= 2 && length <= 4) score += 8
  if (corpusOccurrences > 0) score += 20 + Math.min(10, corpusOccurrences)
  if (externalOccurrences > 0) score += 10 + Math.min(10, externalOccurrences)
  score -= candidate.flags.length * 5
  if (candidate.flags.includes('proper_name')) score -= 10
  if (candidate.flags.includes('variant')) score -= 20
  return score
}

function isModernWordCandidate(candidate) {
  const blockingFlags = new Set([
    'proper_name',
    'variant',
    'archaic_or_literary',
    'dialect_or_regional',
    'onomatopoeia_or_interjection',
  ])
  return hanLength(candidate.simplified) >= 2 && !candidate.flags.some((flag) => blockingFlags.has(flag))
}

function isDefaultCoreWordCandidate(candidate) {
  return isModernWordCandidate(candidate) && !containsBlockedDefaultCorpusContent(candidate.simplified)
}

function hasUsageEvidence(candidate) {
  return (candidate.current_corpus_text_occurrences ?? 0) > 0
    || (candidate.external_sentence_occurrences ?? 0) > 0
}

export function classifyCoverageTier({ syllableTone, syllable, currentHits, carriers, candidateWords, candidateSentences = [] }) {
  const manualTier = MANUAL_TARGET_TIERS.get(syllableTone) ?? MANUAL_BASE_TIERS.get(syllable)
  if (manualTier) {
    return {
      tier: manualTier,
      tier_basis: `manual_missing_syllable_review:${syllableTone ?? syllable}`,
      tier_review_status: 'provisional_product_routing_pending_linguistic_signoff',
    }
  }
  const cleanCarrierExists = carriers.some((carrier) => !carrier.review_flag)
  const modernWords = candidateWords.filter(isModernWordCandidate)
  const defaultCoreWords = candidateWords.filter(isDefaultCoreWordCandidate)
  const modernWordExists = modernWords.length > 0
  const attestedModernWordExists = defaultCoreWords.some(hasUsageEvidence)
  if (!cleanCarrierExists && !modernWordExists) {
    return {
      tier: 'disputed',
      tier_basis: 'all_character_readings_are_source_flagged_and_no_clean_modern_word_carrier',
      tier_review_status: 'pending_linguistic_review',
    }
  }
  if (currentHits > 0 || attestedModernWordExists) {
    return {
      tier: 'core',
      tier_basis: currentHits > 0
        ? 'already_attested_in_current_prompt_corpus'
        : 'modern_lexical_carrier_attested_in_open_sentence_corpus',
      tier_review_status: currentHits > 0 ? 'provisionally_routed' : 'pending_linguistic_review',
    }
  }
  return {
    tier: 'edge',
    tier_basis: modernWordExists
      ? defaultCoreWords.length === 0
        ? 'modern_lexical_carriers_are_high_burden_for_default_recording'
        : candidateSentences.length > 0
          ? 'sentence_found_but_no_attested_clean_modern_lexical_carrier'
          : 'clean_lexical_carrier_found_without_usage_attestation'
      : 'only_single_character_or_edge_marked_lexical_carriers_found',
    tier_review_status: 'pending_linguistic_review',
  }
}

function coverageStatus(hits, minimumHits) {
  if (hits === 0) return 'missing'
  if (hits < minimumHits) return 'below_minimum'
  return 'robust'
}

export function buildCoverageLedger({ reference, currentCounts, characterRows, wordRows, wordOccurrenceCounts, sentenceCandidates, minimumHits }) {
  const targets = reference.syllable_tones.map((syllableTone) => {
    const normalized = normalizePinyinSyllable(syllableTone)
    const currentHits = currentCounts[syllableTone] ?? 0
    const carriers = characterRows.get(syllableTone) ?? []
    const candidateWords = (wordRows.get(syllableTone) ?? []).map((candidate) => {
      const corpusOccurrences = wordOccurrenceCounts.corpus.get(candidate.simplified) ?? 0
      const externalOccurrences = wordOccurrenceCounts.external.get(candidate.simplified) ?? 0
      return {
        ...candidate,
        current_corpus_text_occurrences: corpusOccurrences,
        external_sentence_occurrences: externalOccurrences,
        candidate_score: scoreCandidateWord(candidate, corpusOccurrences, externalOccurrences),
      }
    }).sort((left, right) => right.candidate_score - left.candidate_score || left.simplified.length - right.simplified.length || left.simplified.localeCompare(right.simplified)).slice(0, 8)
    const targetSentences = sentenceCandidates.get(syllableTone) ?? []
    const tier = classifyCoverageTier({ syllableTone, syllable: normalized.orthographic, currentHits, carriers, candidateWords, candidateSentences: targetSentences })
    return {
      syllable_tone: syllableTone,
      syllable: normalized.orthographic,
      tone: normalized.tone,
      current_hits: currentHits,
      coverage_status: coverageStatus(currentHits, minimumHits),
      deficit_to_robust: Math.max(0, minimumHits - currentHits),
      ...tier,
      carrier_characters: carriers,
      candidate_words: candidateWords,
      candidate_sentences: targetSentences,
      prompt_review_status: currentHits >= minimumHits ? 'not_required_for_current_gap' : 'pending',
    }
  })

  const countBy = (key) => Object.fromEntries([...new Set(targets.map((target) => target[key]))].sort().map((value) => [value, targets.filter((target) => target[key] === value).length]))
  return {
    targets,
    summary: {
      total_targets: targets.length,
      coverage_status_counts: countBy('coverage_status'),
      tier_counts: countBy('tier'),
      gap_tier_counts: Object.fromEntries(['core', 'edge', 'disputed'].map((tier) => [tier, targets.filter((target) => target.tier === tier && target.coverage_status !== 'robust').length])),
      targets_with_word_candidates: targets.filter((target) => target.candidate_words.length > 0).length,
      targets_with_sentence_candidates: targets.filter((target) => target.candidate_sentences.length > 0).length,
    },
  }
}

export function candidateSentenceAllowed(text) {
  const length = hanLength(text)
  return length >= 4
    && length <= 16
    && !isBlockedGapCandidate(text)
    && !COMMERCIAL_PACKAGE_CONTENT.test(text)
    && !/[^\p{Script=Han}，。！？；：、…—“”‘’（）《》\s]/u.test(text)
}

export function promptCandidatesFromLedger(ledger) {
  const items = []
  for (const target of ledger.targets) {
    if (target.coverage_status === 'robust' || target.tier === 'disputed') continue
    for (const candidate of target.candidate_words.slice(0, 3)) {
      items.push({
        id: `word-${target.syllable_tone}-${candidate.simplified}`,
        type: 'word',
        text: candidate.simplified,
        coverage_targets: [target.syllable_tone],
        tier: target.tier,
        source: 'CC-CEDICT',
        source_pinyin: candidate.pinyin,
        source_flags: candidate.flags,
        reviews: { linguistic: 'pending', naturalness: 'pending', user_burden: 'pending', license: 'pending', product: 'pending' },
      })
    }
    for (const candidate of target.candidate_sentences) {
      items.push({
        id: `sentence-${candidate.source_sentence_id}`,
        type: 'sentence',
        text: candidate.text,
        coverage_targets: candidate.coverage_targets,
        tier: target.tier,
        source: 'Tatoeba',
        source_sentence_id: candidate.source_sentence_id,
        contributor: candidate.contributor,
        source_url: candidate.source_url,
        reviews: { linguistic: 'pending', naturalness: 'pending', user_burden: 'pending', license: 'pending', product: 'pending' },
      })
    }
  }
  const unique = new Map()
  for (const item of items) {
    const existing = unique.get(item.id)
    if (!existing) unique.set(item.id, item)
    else existing.coverage_targets = [...new Set([...existing.coverage_targets, ...item.coverage_targets])].sort()
  }
  return [...unique.values()]
}

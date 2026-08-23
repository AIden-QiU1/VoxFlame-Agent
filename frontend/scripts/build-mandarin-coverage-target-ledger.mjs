#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import zlib from 'node:zlib'

import { annotateMandarinText } from './mandarin-coverage-core.mjs'
import {
  buildCoverageLedger,
  candidateSentenceAllowed,
  parseCedictEntries,
  parseMandarinCharacterRows,
  promptCandidatesFromLedger,
} from './mandarin-coverage-ledger-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function readTextMaybeGzip(filePath) {
  const payload = fs.readFileSync(filePath)
  return filePath.endsWith('.gz') ? zlib.gunzipSync(payload).toString('utf8') : payload.toString('utf8')
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function normalizePromptText(text) {
  return text.normalize('NFKC').replace(/[^\p{Script=Han}]/gu, '')
}

function hanNgrams(text, maximumLength = 6) {
  const characters = Array.from(normalizePromptText(text))
  const values = new Set()
  for (let start = 0; start < characters.length; start += 1) {
    for (let length = 1; length <= maximumLength && start + length <= characters.length; length += 1) {
      values.add(characters.slice(start, start + length).join(''))
    }
  }
  return values
}

function countCandidateWords(texts, candidateWordSet) {
  const counts = new Map()
  for (const text of texts) {
    for (const ngram of hanNgrams(text)) {
      if (candidateWordSet.has(ngram)) counts.set(ngram, (counts.get(ngram) ?? 0) + 1)
    }
  }
  return counts
}

function targetsByCandidateWord(wordRows) {
  const index = new Map()
  for (const [target, words] of wordRows) {
    for (const candidate of words) {
      const targets = index.get(candidate.simplified) ?? new Set()
      targets.add(target)
      index.set(candidate.simplified, targets)
    }
  }
  return index
}

async function scanTatoeba(filePath, candidateWordSet, wordTargets, gapTargets) {
  const occurrenceCounts = new Map()
  const sentencesByTarget = new Map()
  const input = fs.createReadStream(filePath)
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  for await (const line of lines) {
    const [id, language, rawText, contributor] = line.split('\t')
    if (language !== 'cmn' || !rawText || !contributor || contributor === '\\N') continue
    const matchedWords = new Set([...hanNgrams(rawText)].filter((ngram) => candidateWordSet.has(ngram)))
    if (matchedWords.size === 0) continue
    for (const word of matchedWords) occurrenceCounts.set(word, (occurrenceCounts.get(word) ?? 0) + 1)
    if (!candidateSentenceAllowed(rawText)) continue
    const lexicalTargets = new Set([...matchedWords].flatMap((word) => [...(wordTargets.get(word) ?? [])]))
    const actualCitationTargets = new Set(annotateMandarinText(rawText).syllables.map((syllable) => syllable.syllableTone))
    const coverageTargets = [...lexicalTargets]
      .filter((target) => actualCitationTargets.has(target))
      .filter((target) => gapTargets.has(target))
      .sort()
    if (coverageTargets.length === 0) continue
    const candidate = {
      text: rawText.normalize('NFKC').trim(),
      source_sentence_id: Number(id),
      contributor,
      source_url: `https://tatoeba.org/en/sentences/show/${id}`,
      matched_words: [...matchedWords].sort(),
      coverage_targets: coverageTargets,
    }
    for (const target of coverageTargets) {
      const sentences = sentencesByTarget.get(target) ?? []
      if (sentences.length < 3 && !sentences.some((item) => item.text === candidate.text)) sentences.push(candidate)
      sentencesByTarget.set(target, sentences)
    }
  }
  return { occurrenceCounts, sentencesByTarget }
}

const referencePath = value('--reference')
const auditPath = value('--audit')
const corpusPath = value('--corpus')
const characterPath = value('--characters')
const cedictPath = value('--cedict')
const tatoebaPath = value('--tatoeba')
const outputPath = value('--output')
const candidateOutputPath = value('--candidate-output')
const minimumHits = Number(value('--minimum-hits') ?? 20)

if (!referencePath || !auditPath || !corpusPath || !characterPath || !cedictPath || !tatoebaPath || !outputPath || !candidateOutputPath) {
  throw new Error('usage: build-mandarin-coverage-target-ledger --reference <json> --audit <json> --corpus <json> --characters <kMandarin_8105.txt> --cedict <cedict.txt[.gz]> --tatoeba <cmn detailed.tsv> --output <ledger.json> --candidate-output <candidates.json> [--minimum-hits 20]')
}

const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'))
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'))
const currentReport = audit.prompt_corpus ?? audit.corpus
if (!currentReport?.distributions?.syllable_tones) throw new Error('audit does not contain prompt corpus syllable-tone distributions')

const expectedTargets = new Set(reference.syllable_tones)
const characterRows = parseMandarinCharacterRows(fs.readFileSync(characterPath, 'utf8'))
const wordRows = parseCedictEntries(readTextMaybeGzip(cedictPath), expectedTargets)
const candidateWordSet = new Set([...wordRows.values()].flat().map((candidate) => candidate.simplified))
const wordTargets = targetsByCandidateWord(wordRows)
const corpusTexts = corpus.items.map((item) => item.text).filter(Boolean)
const corpusOccurrences = countCandidateWords(corpusTexts, candidateWordSet)
const gapTargets = new Set(reference.syllable_tones.filter((target) => (currentReport.distributions.syllable_tones[target] ?? 0) < minimumHits))
const tatoeba = await scanTatoeba(tatoebaPath, candidateWordSet, wordTargets, gapTargets)

const ledgerData = buildCoverageLedger({
  reference,
  currentCounts: currentReport.distributions.syllable_tones,
  characterRows,
  wordRows,
  wordOccurrenceCounts: { corpus: corpusOccurrences, external: tatoeba.occurrenceCounts },
  sentenceCandidates: tatoeba.sentencesByTarget,
  minimumHits,
})

const generatedAt = new Date().toISOString()
const ledger = {
  kind: 'voxflame_mandarin_coverage_target_ledger',
  generated_at: generatedAt,
  status: 'coverage_fact_source_with_human_review_required_for_gap_routing',
  policy: {
    linguistic_reference_is_primary: true,
    sop_is_collection_operations_reference_only: true,
    existing_prompts_or_recordings_removed: false,
    robust_minimum_hits: minimumHits,
    tiers: {
      core: 'Modern lexical carrier suitable for default gap-filling after review.',
      edge: 'Legal but rare, regional, specialized, interjectional, or high-burden carrier; optional specialist pack only.',
      disputed: 'Source reading is flagged or lacks a clean lexical carrier; hold until linguistic review.',
    },
    automatic_tier_is_product_routing_evidence_not_a_final_pronunciation_judgment: true,
  },
  sources: {
    reference: reference.source,
    character_readings: { path_hint: 'kMandarin_8105.txt', sha256: sha256(characterPath), license: 'MIT' },
    lexical_carriers: { url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict', sha256: sha256(cedictPath), license: 'CC BY-SA 4.0' },
    external_sentences: { url: 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences_detailed.tsv.bz2', sha256: sha256(tatoebaPath), license: 'CC BY 2.0 FR' },
    current_prompt_corpus: { path_hint: 'frontend/.tmp/mandarin-training-prompts.json', item_count: corpus.items.length },
  },
  summary: ledgerData.summary,
  targets: ledgerData.targets,
}

const candidateItems = promptCandidatesFromLedger(ledger)
const candidates = {
  kind: 'voxflame_mandarin_gap_prompt_candidate_pack',
  generated_at: generatedAt,
  status: 'human_review_required_not_for_production',
  policy: {
    existing_prompt_corpus_is_unchanged: true,
    default_recommendation_requires_core_tier_and_all_reviews_approved: true,
    edge_tier_is_optional_specialist_pack_only: true,
    disputed_tier_is_excluded: true,
    words_are_selected_before_sentences_to_preserve_pronunciation_traceability: true,
  },
  summary: {
    items: candidateItems.length,
    word_items: candidateItems.filter((item) => item.type === 'word').length,
    sentence_items: candidateItems.filter((item) => item.type === 'sentence').length,
    core_items: candidateItems.filter((item) => item.tier === 'core').length,
    edge_items: candidateItems.filter((item) => item.tier === 'edge').length,
    targets: new Set(candidateItems.flatMap((item) => item.coverage_targets)).size,
  },
  sources: ledger.sources,
  items: candidateItems,
}

for (const [filePath, payload] of [[outputPath, ledger], [candidateOutputPath, candidates]]) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
console.log(`built ${ledger.summary.total_targets} targets and ${candidates.summary.items} prompt candidates`)

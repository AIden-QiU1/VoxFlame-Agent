#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { normalizePinyinSyllable } from './mandarin-coverage-core.mjs'

const EDGE_DEFINITION = /(?:surname|given name|name of|variant of|archaic|literary|dialect|regional|Taiwan pr\.|onomatopoeia|interjection)/iu

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function readMaybeGzip(filePath) {
  const payload = fs.readFileSync(filePath)
  return filePath.endsWith('.gz') ? zlib.gunzipSync(payload).toString('utf8') : payload.toString('utf8')
}

function tokenTarget(token) {
  const match = token.replaceAll('u:', 'ü').match(/^([A-Za-züê]+)([1-5])$/iu)
  if (!match) return null
  return normalizePinyinSyllable(`${match[1].toLowerCase()}${match[2] === '5' ? '0' : match[2]}`).syllableTone
}

const referencePath = value('--reference')
const auditPath = value('--audit')
const cedictPath = value('--cedict')
const outputPath = value('--output')
if (!referencePath || !auditPath || !cedictPath || !outputPath) {
  throw new Error('usage: build-mandarin-lexical-extension-review --reference <reference.json> --audit <audit.json> --cedict <cedict.txt[.gz]> --output <review.json>')
}

const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'))
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
const baseTargets = new Set(reference.syllable_tones)
const baseSyllables = new Set(reference.syllables)
const currentCounts = (audit.prompt_corpus ?? audit.corpus).distributions.syllable_tones
const byTarget = new Map()

for (const line of readMaybeGzip(cedictPath).split(/\r?\n/u)) {
  if (!line || line.startsWith('#')) continue
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/u)
  if (!match) continue
  const [, traditional, simplified, rawPinyin, definition] = match
  if (!/^\p{Script=Han}+$/u.test(simplified)) continue
  const tokens = rawPinyin.split(/\s+/u)
  const targets = tokens.map(tokenTarget).filter(Boolean)
  const sourceFlags = []
  if (/[A-Z]/u.test(rawPinyin)) sourceFlags.push('proper_name')
  if (EDGE_DEFINITION.test(definition)) sourceFlags.push('edge_definition')
  for (const target of new Set(targets.filter((item) => !baseTargets.has(item)))) {
    if (!/^[a-züê]+[0-4]$/u.test(target)) continue
    const entries = byTarget.get(target) ?? []
    if (entries.length < 12 && !entries.some((entry) => entry.simplified === simplified && entry.pinyin === rawPinyin)) {
      entries.push({ simplified, traditional, pinyin: rawPinyin.replaceAll('u:', 'ü'), definition, source_flags: sourceFlags })
    }
    byTarget.set(target, entries)
  }
}

const targets = [...byTarget].map(([syllableTone, entries]) => {
  const normalized = normalizePinyinSyllable(syllableTone)
  const cleanEntries = entries.filter((entry) => entry.source_flags.length === 0)
  return {
    syllable_tone: syllableTone,
    syllable: normalized.orthographic,
    tone: normalized.tone,
    discovery_class: normalized.tone === 0
      ? 'lexical_neutral_tone'
      : baseSyllables.has(normalized.orthographic)
        ? 'additional_tone_for_core_syllable'
        : 'additional_lexical_syllable',
    current_prompt_hits: currentCounts[syllableTone] ?? 0,
    candidate_entries: entries,
    clean_candidate_entries: cleanEntries.length,
    review: {
      standard_mandarin_status: 'pending',
      lexical_currency: 'pending',
      neutral_tone_or_sandhi_analysis: 'pending',
      target_population_value: 'pending',
      include_in_reference_decision: 'pending',
    },
  }
}).sort((left, right) => left.syllable_tone.localeCompare(right.syllable_tone))

const payload = {
  kind: 'voxflame_mandarin_lexical_extension_discovery_review',
  generated_at: new Date().toISOString(),
  status: 'discovery_only_not_part_of_coverage_denominator',
  policy: {
    core_reference_targets: reference.syllable_tones.length,
    dictionary_discovery_does_not_define_standard_mandarin_inventory: true,
    proper_names_dialects_archaic_forms_interjections_and_neutral_tones_require_separate_review: true,
    no_discovered_target_is_product_eligible_without_authoritative_and_linguistic_review: true,
  },
  source: {
    url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
    sha256: crypto.createHash('sha256').update(fs.readFileSync(cedictPath)).digest('hex'),
    license: 'CC BY-SA 4.0',
  },
  summary: {
    discovered_targets_outside_core_reference: targets.length,
    additional_tones_for_core_syllables: targets.filter((target) => target.discovery_class === 'additional_tone_for_core_syllable').length,
    additional_lexical_syllables: targets.filter((target) => target.discovery_class === 'additional_lexical_syllable').length,
    lexical_neutral_tones: targets.filter((target) => target.discovery_class === 'lexical_neutral_tone').length,
    targets_with_current_prompt_hits: targets.filter((target) => target.current_prompt_hits > 0).length,
    targets_with_clean_lexical_candidates: targets.filter((target) => target.clean_candidate_entries > 0).length,
  },
  targets,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`discovered ${targets.length} lexical targets outside the ${reference.syllable_tones.length}-target core reference`)


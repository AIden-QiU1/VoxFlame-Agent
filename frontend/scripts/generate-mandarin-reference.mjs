#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import {
  normalizePinyinSyllable,
  numberedPinyinFromDiacritics,
} from './mandarin-coverage-core.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = option('--input')
const outputPath = option('--output')
const sourceUrl = option('--source-url')
const sourceCommit = option('--source-commit')

if (!inputPath || !outputPath || !sourceUrl || !sourceCommit) {
  throw new Error('usage: generate-mandarin-reference --input <kMandarin_8105.txt> --output <json> --source-url <url> --source-commit <sha>')
}

const source = fs.readFileSync(inputPath, 'utf8')
const syllables = new Set()
const syllableTones = new Set()
let parsedCharacters = 0
let reviewMarkedRows = 0

for (const line of source.split(/\r?\n/u)) {
  if (!line || line.startsWith('#')) continue
  const [body, comment = ''] = line.split('#', 2)
  const separator = body.indexOf(':')
  if (separator < 0) continue
  const firstReading = body.slice(separator + 1).trim().split(',', 1)[0]
  if (!firstReading) continue
  const numbered = numberedPinyinFromDiacritics(firstReading)
  const normalized = normalizePinyinSyllable(numbered)
  syllables.add(normalized.orthographic)
  syllableTones.add(normalized.syllableTone)
  parsedCharacters += 1
  if (/[?]|->|<-/u.test(comment)) reviewMarkedRows += 1
}

const payload = {
  kind: 'mandarin_common_syllable_reference',
  scope: 'Most common pronunciation for the 8105 characters in the 2013 Table of General Standard Chinese Characters; this is a common-character baseline, not every lexical reading or dialect form.',
  source: {
    url: sourceUrl,
    commit: sourceCommit,
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    license: 'MIT (mozillazg/pinyin-data)',
    parsed_characters: parsedCharacters,
    rows_marked_for_review_in_source: reviewMarkedRows,
  },
  syllables: [...syllables].sort(),
  syllable_tones: [...syllableTones].sort(),
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`generated ${payload.syllables.length} syllables and ${payload.syllable_tones.length} syllable-tone forms`)

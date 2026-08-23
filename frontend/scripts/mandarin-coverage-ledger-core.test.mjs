import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildCoverageLedger,
  candidateSentenceAllowed,
  classifyCoverageTier,
  parseCedictEntries,
  parseMandarinCharacterRows,
  promptCandidatesFromLedger,
} from './mandarin-coverage-ledger-core.mjs'

test('character rows preserve source review flags and exact syllable-tone carriers', () => {
  const rows = parseMandarinCharacterRows('U+62F4: shuān  # 拴\nU+62FD: zhuāi  # 拽 -> zhuài\n')
  assert.equal(rows.get('shuan1')[0].character, '拴')
  assert.equal(rows.get('shuan1')[0].review_flag, false)
  assert.equal(rows.get('zhuai1')[0].review_flag, true)
})

test('CC-CEDICT entries map lexical carriers to normalized ü targets', () => {
  const rows = parseCedictEntries('虐待 虐待 [nu:e4 dai4] /to mistreat/\n岑 岑 [Cen2] /surname Cen/\n', new Set(['nüe4', 'cen2']))
  assert.equal(rows.get('nüe4')[0].simplified, '虐待')
  assert.equal(rows.get('cen2')[0].flags.includes('proper_name'), true)
})

test('manual product routing keeps common missing carriers separate from disputed forms', () => {
  assert.equal(classifyCoverageTier({
    syllableTone: 'shuan1',
    syllable: 'shuan',
    currentHits: 0,
    carriers: [{ character: '拴', review_flag: false }],
    candidateWords: [{ simplified: '拴住', flags: [], external_sentence_occurrences: 1 }],
  }).tier, 'core')
  assert.equal(classifyCoverageTier({ syllableTone: 'nang1', syllable: 'nang', currentHits: 0, carriers: [], candidateWords: [] }).tier, 'edge')
  assert.equal(classifyCoverageTier({ syllableTone: 'zhuai1', syllable: 'zhuai', currentHits: 0, carriers: [], candidateWords: [] }).tier, 'disputed')
  assert.equal(classifyCoverageTier({ syllableTone: 'bu1', syllable: 'bu', currentHits: 0, carriers: [], candidateWords: [], candidateSentences: [{ text: '钸很难获得' }] }).tier, 'edge')
  assert.equal(classifyCoverageTier({ syllableTone: 'chun3', syllable: 'chun', currentHits: 0, carriers: [{ character: '蠢', review_flag: false }], candidateWords: [{ simplified: '愚蠢', flags: [], external_sentence_occurrences: 20 }] }).tier, 'edge')
  assert.equal(classifyCoverageTier({ syllableTone: 'long4', syllable: 'long', currentHits: 0, carriers: [{ character: '弄', review_flag: false }], candidateWords: [{ simplified: '弄堂', flags: ['dialect_or_regional'], external_sentence_occurrences: 7 }] }).tier, 'edge')
  for (const syllableTone of ['heng4', 'ming3', 'nüe4', 'zei2']) {
    assert.equal(classifyCoverageTier({ syllableTone, syllable: syllableTone.replace(/\d/u, ''), currentHits: 0, carriers: [{ character: '例', review_flag: false }], candidateWords: [{ simplified: '高负担词', flags: [], external_sentence_occurrences: 10 }] }).tier, 'edge')
  }
})

test('clean lexical carriers require usage attestation before default-core routing', () => {
  const carrier = [{ character: '彖', review_flag: false }]
  const word = [{ simplified: '彖辞', flags: [], current_corpus_text_occurrences: 0, external_sentence_occurrences: 0 }]
  assert.equal(classifyCoverageTier({ syllable: 'tuan', currentHits: 0, carriers: carrier, candidateWords: word }).tier, 'edge')
  assert.equal(classifyCoverageTier({ syllable: 'tuan', currentHits: 0, carriers: carrier, candidateWords: word, candidateSentences: [{ text: '含彖字的误匹配例句' }] }).tier, 'edge')
  word[0].external_sentence_occurrences = 1
  assert.equal(classifyCoverageTier({ syllable: 'tuan', currentHits: 0, carriers: carrier, candidateWords: word }).tier, 'core')
})

test('attested but stigmatizing lexical carriers stay in the edge pack', () => {
  const carrier = [{ character: '瘸', review_flag: false }]
  const word = [{ simplified: '瘸腿', flags: [], current_corpus_text_occurrences: 0, external_sentence_occurrences: 2 }]
  const result = classifyCoverageTier({ syllable: 'que', currentHits: 0, carriers: carrier, candidateWords: word })
  assert.equal(result.tier, 'edge')
  assert.equal(result.tier_basis, 'modern_lexical_carriers_are_high_burden_for_default_recording')
})

test('sentence candidates enforce short readable Han prompts', () => {
  assert.equal(candidateSentenceAllowed('请把安全绳拴好。'), true)
  assert.equal(candidateSentenceAllowed('课程学习包'), false)
  assert.equal(candidateSentenceAllowed('x=1'), false)
})

test('ledger reports robust, missing and tiered targets without deleting corpus items', () => {
  const ledger = buildCoverageLedger({
    reference: { syllable_tones: ['shuan1', 'zhuai1'] },
    currentCounts: { shuan1: 0, zhuai1: 20 },
    characterRows: new Map([['shuan1', [{ character: '拴', review_flag: false }]]]),
    wordRows: new Map([['shuan1', [{ simplified: '拴住', traditional: '拴住', pinyin: 'shuan1 zhu4', definition: 'to tie', flags: [] }]]]),
    wordOccurrenceCounts: { corpus: new Map(), external: new Map([['拴住', 1]]) },
    sentenceCandidates: new Map(),
    minimumHits: 20,
  })
  assert.deepEqual(ledger.summary.coverage_status_counts, { missing: 1, robust: 1 })
  assert.equal(ledger.targets[0].tier, 'core')
  assert.equal(ledger.targets[1].tier, 'disputed')
})

test('candidate pack excludes disputed targets and keeps review gates pending', () => {
  const items = promptCandidatesFromLedger({
    targets: [
      { syllable_tone: 'shuan1', coverage_status: 'missing', tier: 'core', candidate_words: [{ simplified: '拴好', pinyin: 'shuan1 hao3', flags: [] }], candidate_sentences: [] },
      { syllable_tone: 'zhuai1', coverage_status: 'missing', tier: 'disputed', candidate_words: [{ simplified: '拽', pinyin: 'zhuai1', flags: [] }], candidate_sentences: [] },
    ],
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].text, '拴好')
  assert.equal(items[0].reviews.linguistic, 'pending')
})

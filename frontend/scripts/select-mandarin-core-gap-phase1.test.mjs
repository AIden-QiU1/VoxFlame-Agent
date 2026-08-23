import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isPhase1SentenceCandidate,
  isPhase1WordCandidate,
  mergeAuthoredCandidates,
  selectPhase1CoreGapPack,
} from './select-mandarin-core-gap-phase1.mjs'

test('phase-one filters reject learning packages and edge lexical carriers', () => {
  assert.equal(isPhase1SentenceCandidate({ text: '主管护师学习包' }), false)
  assert.equal(isPhase1SentenceCandidate({ text: '请把安全绳拴好' }), true)
  assert.equal(isPhase1SentenceCandidate({ text: '他走路一瘸一拐' }), false)
  assert.equal(isPhase1SentenceCandidate({ text: '你缺乏冲劲。' }), false)
  assert.equal(isPhase1SentenceCandidate({ text: '差点就酿成怕的火灾了。' }), false)
  assert.equal(isPhase1SentenceCandidate({ text: '切磋一下,敢吗?' }), false)
  assert.equal(isPhase1SentenceCandidate({ text: '我们决不能把它两个混淆。' }), false)
  assert.equal(isPhase1WordCandidate({ simplified: '岑溪', flags: ['proper_name'], candidate_score: 20 }), false)
  assert.equal(isPhase1WordCandidate({ simplified: '拴住', flags: [], candidate_score: 19 }), true)
  assert.equal(isPhase1WordCandidate({ simplified: '仅有词典记录', flags: [], candidate_score: 8 }), false)
  assert.equal(isPhase1WordCandidate({ simplified: '瘸腿', flags: [], candidate_score: 19 }), false)
})

test('neutral whole-word anchors outrank higher-scored high-burden alternatives', () => {
  const candidate = (simplified, pinyin, candidateScore, external = 1) => ({
    simplified,
    pinyin,
    candidate_score: candidateScore,
    current_corpus_text_occurrences: 0,
    external_sentence_occurrences: external,
    flags: [],
  })
  const ledger = {
    sources: {},
    targets: [{
      syllable_tone: 'dai3',
      syllable: 'dai',
      coverage_status: 'missing',
      tier: 'core',
      carrier_characters: [],
      candidate_words: [
        candidate('歹徒', 'dai3 tu2', 23, 5),
        candidate('好歹', 'hao3 dai3', 19),
      ],
      candidate_sentences: [
        { text: '好歹先吃点东西', source_sentence_id: 'a', coverage_targets: ['dai3'], authored_candidate: true, target_carriers: [{ text: '好歹', source_pinyin: 'hao3 dai3', source: 'CC-CEDICT' }] },
        { text: '我们好歹赶上了车', source_sentence_id: 'b', coverage_targets: ['dai3'], authored_candidate: true, target_carriers: [{ text: '好歹', source_pinyin: 'hao3 dai3', source: 'CC-CEDICT' }] },
      ],
    }],
  }
  const pack = selectPhase1CoreGapPack(ledger)
  assert.equal(pack.items.find((item) => item.type === 'word').text, '好歹')
})

test('authored candidates only augment missing core targets and remain review gated', () => {
  const ledger = { targets: [{ syllable_tone: 'lin1', coverage_status: 'missing', tier: 'core', candidate_sentences: [] }] }
  mergeAuthoredCandidates(ledger, { items: [{ id: 'a', text: '请把袋子拎起来', coverage_targets: ['lin1'], target_carriers: [{ text: '拎起', source_pinyin: 'lin1 qi3', source: 'CC-CEDICT' }], rationale: 'daily phrase' }] })
  assert.equal(ledger.targets[0].candidate_sentences.length, 1)
  assert.equal(ledger.targets[0].candidate_sentences[0].authored_candidate, true)
})

test('authored candidates without explicit whole-word reading evidence stay out', () => {
  const ledger = { targets: [{ syllable_tone: 'lin1', coverage_status: 'missing', tier: 'core', candidate_sentences: [] }] }
  mergeAuthoredCandidates(ledger, { items: [{ id: 'a', text: '请把袋子拎起来', coverage_targets: ['lin1'], rationale: 'missing evidence' }] })
  assert.equal(ledger.targets[0].candidate_sentences.length, 0)
})

test('phase-one selection keeps edge and disputed targets out of the default pack', () => {
  const ledger = {
    sources: {},
    targets: [
      {
        syllable_tone: 'shuan1', syllable: 'shuan', coverage_status: 'missing', tier: 'core', carrier_characters: [],
        candidate_words: [{ simplified: '拴住', pinyin: 'shuan1 zhu4', syllable_tones: ['shuan1', 'zhu4'], flags: [], candidate_score: 19 }],
        candidate_sentences: [{ text: '请把安全绳拴住', source_sentence_id: 1, contributor: 'a', source_url: 'x', coverage_targets: ['shuan1'], matched_words: ['拴住'] }],
      },
      { syllable_tone: 'n2', syllable: 'n', coverage_status: 'missing', tier: 'edge', carrier_characters: [], candidate_words: [], candidate_sentences: [] },
      { syllable_tone: 'zhuai1', syllable: 'zhuai', coverage_status: 'missing', tier: 'disputed', carrier_characters: [], candidate_words: [], candidate_sentences: [] },
    ],
  }
  const result = selectPhase1CoreGapPack(ledger, { examplesPerTarget: 2 })
  assert.equal(result.summary.core_missing_targets, 1)
  assert.equal(result.summary.targets_with_sufficient_candidates, 1)
  assert.deepEqual(result.items.map((item) => item.text).sort(), ['拴住', '请把安全绳拴住'].sort())
  assert.equal(result.items.every((item) => item.reviews.linguistic === 'pending'), true)
})

test('selection keeps one traceable word and prefers two sentence contexts when available', () => {
  const ledger = {
    sources: {},
    targets: [{
      syllable_tone: 'shuan1', syllable: 'shuan', coverage_status: 'missing', tier: 'core', carrier_characters: [],
      candidate_words: [
        { simplified: '拴住', pinyin: 'shuan1 zhu4', syllable_tones: ['shuan1', 'zhu4'], flags: [], candidate_score: 19 },
        { simplified: '门闩', pinyin: 'men2 shuan1', syllable_tones: ['men2', 'shuan1'], flags: [], candidate_score: 19 },
      ],
      candidate_sentences: [
        { text: '外部句子含有门闩', source_sentence_id: 1, contributor: 'a', source_url: 'x', coverage_targets: ['shuan1'], matched_words: ['门闩'] },
        { text: '请把安全绳拴好', source_sentence_id: 'authored', contributor: 'VoxFlame', source_url: null, coverage_targets: ['shuan1'], authored_candidate: true, target_carriers: [{ text: '拴好', source_pinyin: 'shuan1 hao3', source: 'CC-CEDICT' }] },
      ],
    }],
  }
  const result = selectPhase1CoreGapPack(ledger, { examplesPerTarget: 3 })
  assert.deepEqual(result.items.map((item) => item.text).sort(), ['拴住', '外部句子含有门闩', '请把安全绳拴好'].sort())
  assert.equal(result.target_status[0].composition_readiness, 'sentence_mix_goal_met')
  assert.deepEqual(result.items.find((item) => item.text === '外部句子含有门闩').target_carriers, [{
    text: '门闩',
    source_pinyin: 'men2 shuan1',
    source: 'CC-CEDICT whole-word reading',
  }])
})

test('external sentences cannot claim a target through only a single character or proper name', () => {
  const ledger = {
    sources: {},
    targets: [{
      syllable_tone: 'zha2', syllable: 'zha', coverage_status: 'missing', tier: 'core', carrier_characters: [],
      candidate_words: [
        { simplified: '扎', pinyin: 'zha2', flags: ['single_character'], syllable_tones: ['zha2'], candidate_score: 15 },
        { simplified: '札幌', pinyin: 'zha2 huang3', flags: ['proper_name'], syllable_tones: ['zha2', 'huang3'], candidate_score: 20 },
        { simplified: '挣扎', pinyin: 'zheng1 zha2', flags: [], syllable_tones: ['zheng1', 'zha2'], candidate_score: 20 },
      ],
      candidate_sentences: [
        { text: '朋友住在札幌', source_sentence_id: 1, contributor: 'a', source_url: 'x', coverage_targets: ['zha2'], matched_words: ['札幌'] },
        { text: '我在努力挣扎', source_sentence_id: 2, contributor: 'b', source_url: 'y', coverage_targets: ['zha2'], matched_words: ['挣扎'] },
      ],
    }],
  }
  const result = selectPhase1CoreGapPack(ledger, { examplesPerTarget: 2 })
  assert.equal(result.items.some((item) => item.text.includes('札幌')), false)
  assert.equal(result.items.some((item) => item.text.includes('挣扎')), true)
})

test('selection records a sentence mix gap instead of treating three words as equally mature', () => {
  const ledger = {
    sources: {},
    targets: [{
      syllable_tone: 'chai2', syllable: 'chai', coverage_status: 'missing', tier: 'core', carrier_characters: [],
      candidate_words: [
        { simplified: '火柴', pinyin: 'huo3 chai2', flags: [], candidate_score: 28 },
        { simplified: '木柴', pinyin: 'mu4 chai2', flags: [], candidate_score: 21 },
        { simplified: '柴油', pinyin: 'chai2 you2', flags: [], candidate_score: 19 },
      ],
      candidate_sentences: [],
    }],
  }
  const result = selectPhase1CoreGapPack(ledger, { examplesPerTarget: 3 })
  assert.equal(result.items.length, 3)
  assert.equal(result.target_status[0].selected_sentence_examples, 0)
  assert.equal(result.target_status[0].composition_readiness, 'sentence_mix_gap_requires_review')
  assert.equal(result.summary.targets_with_sentence_mix_gap, 1)
})

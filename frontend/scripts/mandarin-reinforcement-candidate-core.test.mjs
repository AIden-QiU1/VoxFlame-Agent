import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildCarrierIndex,
  candidateFromAuthoredEntry,
  candidateFromSentence,
  isSafeReinforcementCarrier,
  isSafeReinforcementSentence,
  selectReinforcementCandidatePack,
} from './mandarin-reinforcement-candidate-core.mjs'

const word = (simplified, pinyin, flags = []) => ({ simplified, pinyin, flags })

test('reinforcement candidates reject learning packages and high-burden default content', () => {
  assert.equal(isSafeReinforcementSentence('请领取课程包继续学习'), false)
  assert.equal(isSafeReinforcementSentence('他的兄弟因癌症去世了'), false)
  assert.equal(isSafeReinforcementSentence('不要成为金钱的奴隶'), false)
  assert.equal(isSafeReinforcementSentence('胎盘早剥很危险'), false)
  assert.equal(isSafeReinforcementSentence('我的尿液是透明的'), false)
  assert.equal(isSafeReinforcementSentence('我差点被卡车碾过'), false)
  assert.equal(isSafeReinforcementSentence('你相当粗鲁'), false)
  assert.equal(isSafeReinforcementSentence('我们一直是很好的炮友'), false)
  assert.equal(isSafeReinforcementSentence('我总是梦想著成为亿万富翁'), false)
  assert.equal(isSafeReinforcementSentence('让你的儿子别来骚扰我的女儿'), false)
  assert.equal(isSafeReinforcementSentence('我的自行车的后轮爆胎了'), false)
  assert.equal(isSafeReinforcementSentence('老牛吃嫩草'), false)
  assert.equal(isSafeReinforcementSentence('我想要两只猫咪'), true)
  assert.equal(isSafeReinforcementSentence('请把水槽擦干净'), true)
  assert.equal(isSafeReinforcementCarrier(word('胆小鬼', 'dan3 xiao3 gui3')), false)
  assert.equal(isSafeReinforcementCarrier(word('挨打', 'ai2 da3')), false)
  assert.equal(isSafeReinforcementCarrier(word('殡仪', 'bin4 yi2')), false)
  assert.equal(isSafeReinforcementCarrier(word('娼妓', 'chang1 ji4')), false)
  assert.equal(isSafeReinforcementCarrier(word('排尿', 'pai2 niao4')), false)
  assert.equal(isSafeReinforcementCarrier(word('水槽', 'shui3 cao2')), true)
})

test('sentence candidates require a whole-word carrier and matching citation reading', () => {
  const { byWord } = buildCarrierIndex(new Map([
    ['cao2', [word('水槽', 'shui3 cao2')]],
  ]), new Set(['cao2']))
  const candidate = candidateFromSentence({
    id: 1,
    text: '请把水槽擦干净。',
    contributor: 'reviewer',
    carrierIndex: byWord,
    currentTextSet: new Set(),
  })
  assert.ok(candidate)
  assert.deepEqual(candidate.coverage_targets, ['cao2'])
  assert.equal(candidate.target_carriers[0].text, '水槽')
  assert.equal(candidate.reviews.linguistic, 'pending')

  assert.equal(candidateFromSentence({
    id: 2,
    text: '请把水槽擦干净。',
    contributor: 'reviewer',
    carrierIndex: byWord,
    currentTextSet: new Set(['请把水槽擦干净。']),
  }), null)
})

test('selection records authoring briefs instead of padding unavailable contexts', () => {
  const candidate = {
    id: 'one', type: 'short_sentence', text: '请把水槽擦干净。', coverage_targets: ['cao2'],
    target_carriers: [{ text: '水槽', source_pinyin: 'shui3 cao2', source: 'CC-CEDICT whole-word reading' }],
    product_score: 20, reviews: { linguistic: 'pending', naturalness: 'pending', user_burden: 'pending', safety: 'pending', license: 'pending', product: 'pending' },
  }
  const safeWordsByTarget = new Map([['cao2', [word('水槽', 'shui3 cao2')]]])
  const pack = selectReinforcementCandidatePack({
    generatedAt: '2026-08-23T00:00:00Z',
    targets: [{ syllable_tone: 'cao2', current_prompt_hits: 1, prompt_deficit_to_minimum: 19 }],
    candidates: [candidate],
    safeWordsByTarget,
    contextsPerTarget: 3,
    sources: {},
  })
  assert.equal(pack.items.length, 1)
  assert.equal(pack.target_status[0].remaining_contexts_to_author, 2)
  assert.equal(pack.target_status[0].readiness, 'guided_authoring')
  assert.equal(pack.authoring_briefs[0].contexts_required, 2)
  assert.equal(pack.authoring_briefs[0].specialist_review_required, false)
  assert.equal(pack.summary.production_items, 0)
})

test('targets without low-burden carriers remain visible for specialist review', () => {
  const pack = selectReinforcementCandidatePack({
    generatedAt: '2026-08-23T00:00:00Z',
    targets: [{ syllable_tone: 'bin4', current_prompt_hits: 0, prompt_deficit_to_minimum: 20 }],
    candidates: [],
    safeWordsByTarget: new Map([['bin4', []]]),
    contextsPerTarget: 3,
    sources: {},
  })
  assert.equal(pack.target_status[0].readiness, 'specialist_review_required')
  assert.equal(pack.authoring_briefs[0].specialist_review_required, true)
  assert.equal(pack.authoring_briefs[0].safe_carrier_options.length, 0)
  assert.match(pack.authoring_briefs[0].specialist_review_reason, /语言学审稿人/u)
})

test('inherently burdensome or only obscure carrier targets skip guided authoring', () => {
  const { safeWordsByTarget } = buildCarrierIndex(new Map([
    ['ai2', [word('挨骂', 'ai2 ma4')]],
    ['ga4', [word('尬聊', 'ga4 liao2')]],
    ['za3', [word('叽咋柳莺', 'ji1 za3 liu3 ying1')]],
  ]), new Set(['ai2', 'ga4', 'za3']))
  assert.deepEqual(safeWordsByTarget.get('ai2'), [])
  assert.deepEqual(safeWordsByTarget.get('ga4'), [])
  assert.deepEqual(safeWordsByTarget.get('za3'), [])
})

test('authored candidates require an attested low-burden whole-word carrier and stay pending', () => {
  const safeWordsByTarget = new Map([['cao2', [word('凹槽', 'ao1 cao2')]]])
  const candidate = candidateFromAuthoredEntry({
    entry: { id: 'auth-cao2-01', target: 'cao2', text: '钥匙放进这个凹槽。', carrier: '凹槽', carrier_pinyin: 'ao1 cao2' },
    safeWordsByTarget,
    currentTextSet: new Set(),
  })
  assert.equal(candidate.source, 'VoxFlame authored candidate')
  assert.deepEqual(candidate.coverage_targets, ['cao2'])
  assert.equal(candidate.proposed_task_id, 'targeted_gap')
  assert.equal(candidate.discourse_style, 'connected_reading')
  assert.equal(candidate.reviews.product, 'pending')
  assert.throws(() => candidateFromAuthoredEntry({
    entry: { id: 'auth-cao2-02', target: 'cao2', text: '钥匙放在桌上。', carrier: '凹槽', carrier_pinyin: 'ao1 cao2' },
    safeWordsByTarget,
    currentTextSet: new Set(),
  }), /carrier must occur continuously/u)
})

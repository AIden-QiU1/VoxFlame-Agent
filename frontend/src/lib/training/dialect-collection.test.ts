import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSpeechVariantMetadata,
  createUtterancePairId,
  shouldOfferDialectPair,
} from './dialect-collection'

test('dialect pairing is offered only to a named dialect profile outside assessment', () => {
  assert.equal(shouldOfferDialectPair({ hasDialect: true, dialectName: '粤语', isAssessment: false }), true)
  assert.equal(shouldOfferDialectPair({ hasDialect: true, dialectName: '', isAssessment: false }), false)
  assert.equal(shouldOfferDialectPair({ hasDialect: true, dialectName: '粤语', isAssessment: true }), false)
})

test('paired variants keep the same lineage while declaring their spoken form', () => {
  const pairId = createUtterancePairId(1_000, 0.5)
  assert.deepEqual(buildSpeechVariantMetadata({
    speechVariant: 'mandarin',
    utterancePairId: pairId,
    dialectName: '粤语',
  }), {
    speech_variant: 'mandarin',
    prompt_language: 'zh-CN',
    spoken_language: 'zh-CN',
    utterance_pair_id: pairId,
  })
  assert.deepEqual(buildSpeechVariantMetadata({
    speechVariant: 'dialect',
    utterancePairId: pairId,
    dialectName: '粤语',
  }), {
    speech_variant: 'dialect',
    prompt_language: 'zh-CN',
    spoken_language: 'zh-dialect',
    utterance_pair_id: pairId,
    dialect_name: '粤语',
  })
})

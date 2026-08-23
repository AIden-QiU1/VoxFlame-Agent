import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  annotateMandarinText,
  auditEntries,
  normalizePinyinSyllable,
  numberedPinyinFromDiacritics,
} from './mandarin-coverage-core.mjs'

test('normalizes zero initials, abbreviated finals, umlaut finals, and apical vowels', () => {
  assert.deepEqual(normalizePinyinSyllable('yuan3'), {
    orthographic: 'yuan', initial: '∅', final: 'üan', tone: 3, syllableTone: 'yuan3',
  })
  assert.equal(normalizePinyinSyllable('shui3').final, 'uei')
  assert.equal(normalizePinyinSyllable('jun1').final, 'ün')
  assert.equal(normalizePinyinSyllable('zi1').final, 'i_apical_alveolar')
  assert.equal(normalizePinyinSyllable('shi1').final, 'i_apical_postalveolar')
})

test('converts tone marks to numbered pinyin', () => {
  assert.equal(numberedPinyinFromDiacritics('zhuāng'), 'zhuang1')
  assert.equal(numberedPinyinFromDiacritics('lǜ'), 'lü4')
})

test('annotates citation tone, neutral tone, and connected-speech events', () => {
  const annotation = annotateMandarinText('爸爸一向不是很好')
  assert.ok(annotation.neutralTones >= 1)
  assert.ok(annotation.yiSandhi >= 1)
  assert.ok(annotation.buSandhi >= 1)
  assert.ok(annotation.thirdToneSequences >= 1)
})

test('reports presence separately from robust repeated coverage', () => {
  const report = auditEntries([
    { text: '爸爸妈妈喝水', category: '测试' },
  ], { syllables: ['ba', 'ma', 'he', 'shui', 'zhuang'], syllable_tones: ['ba4', 'ma1', 'he1', 'shui3'] }, { minimumHits: 2 })

  assert.equal(report.coverage.common_syllables.present, 4)
  assert.equal(report.coverage.common_syllables.robust, 2)
  assert.deepEqual(report.coverage.common_syllables.missing, ['zhuang'])
})

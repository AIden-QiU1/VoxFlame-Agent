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

test('keeps verified recording targets separate from generic polyphonic annotation', () => {
  const report = auditEntries([
    {
      text: '心脏',
      category: '音系强化',
      recording_readiness: 'ready_for_recording',
      coverage_targets: ['zang4'],
    },
  ], { syllables: ['xin', 'zang'], syllable_tones: ['xin1', 'zang1', 'zang4'] }, { minimumHits: 1 })

  assert.equal(report.coverage.common_syllable_tones.missing.includes('zang4'), true)
  assert.equal(report.coverage.explicit_recording_targets.missing.includes('zang4'), false)
})

test('explicit recording target counts preserve one count per item, not generic syllable hits', () => {
  const report = auditEntries([
    { text: '阿胶', recording_readiness: 'ready_for_recording', coverage_targets: ['e1'] },
    { text: '阿胶已经开封', recording_readiness: 'ready_for_recording', coverage_targets: ['e1'] },
  ], { syllables: ['e'], syllable_tones: ['e1'] }, { minimumHits: 2 })

  assert.equal(report.coverage.explicit_recording_targets.present, 1)
  assert.equal(report.coverage.explicit_recording_targets.robust, 1)
})

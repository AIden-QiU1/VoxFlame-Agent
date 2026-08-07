import assert from 'node:assert/strict'
import { test } from 'node:test'

import { annotatePhonology, buildIndex } from './build-phonology-index.mjs'


test('annotatePhonology identifies consonant and final targets from real pinyin', () => {
  const labels = annotatePhonology('妈妈发现方法很多')
  const byId = Object.fromEntries(labels.map((label) => [label.id, label]))

  assert.ok(byId.labial.score >= 2)
  assert.match(byId.labial.focus, /m|f/)
  assert.ok(byId['nasal-finals'].score >= 2)
})

test('annotatePhonology identifies tone contrast and yi/bu sandhi', () => {
  const labels = annotatePhonology('一心一意不是不好')
  const tone = labels.find((label) => label.id === 'tones')

  assert.ok(tone)
  assert.match(tone.focus, /一字变调/)
  assert.match(tone.focus, /不字变调/)
})

test('annotatePhonology does not force a sentence into a sparse target group', () => {
  const labels = annotatePhonology('书香')
  const labial = labels.find((label) => label.id === 'labial')

  assert.equal(labial, undefined)
})

test('buildIndex keeps ungrouped sentences available outside the index', () => {
  const payload = {
    categories: {
      音系强化: {
        items: [
          { id: 'dense', text: '妈妈发现方法很多', category: '音系强化' },
          { id: 'sparse', text: '书香', category: '音系强化' },
        ],
      },
    },
  }

  const index = buildIndex(payload)
  assert.equal(index.source_exercise_count, 2)
  assert.ok(index.items.dense.length > 0)
  assert.equal(index.items.sparse, undefined)
})

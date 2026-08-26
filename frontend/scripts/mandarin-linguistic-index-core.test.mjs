import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLinguisticIndex,
  buildLinguisticTags,
  taskIdForCategory,
} from './mandarin-linguistic-index-core.mjs'

test('task layer is mutually exclusive while linguistic tags overlap', () => {
  assert.equal(taskIdForCategory('日常与出行'), 'functional_speech')
  assert.equal(taskIdForCategory('现代文章朗读'), 'connected_reading')
  assert.equal(taskIdForCategory('音系强化'), 'targeted_gap')

  const tags = buildLinguisticTags('请再说一次')
  assert.deepEqual(tags.positions, ['final', 'initial', 'medial'])
  assert.ok(tags.initials.includes('∅'))
  assert.ok(tags.tone_pairs.length > 0)
})

test('index preserves every source prompt and records connected-speech flags', () => {
  const index = buildLinguisticIndex([
    { id: 'a', text: '请再说一次', category: '日常与出行' },
    { id: 'b', text: '我想买一杯茶', category: '设备与数字' },
    { id: 'c', text: '清晨的空气很新鲜', category: '现代文章朗读' },
  ])
  assert.equal(index.summary.indexed_items, 3)
  assert.deepEqual(Object.keys(index.items), ['a', 'b', 'c'])
  assert.equal(index.items.a.task_id, 'functional_speech')
  assert.equal(index.items.c.task_id, 'connected_reading')
  assert.equal(index.items.b.connected_speech.yi_sandhi, true)
  assert.equal(index.policy.no_prompt_text_removed, true)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getExercisesByCategory } from '@/lib/corpus/mandarin-training'
import {
  PHONOLOGY_GROUPS,
  filterExercisesByPhonologyGroup,
  getPhonologyExerciseTargets,
  getPhonologyFocusForGroup,
} from './phonology-groups'


test('phonology groups expose eight specific subgroups plus the full pool', () => {
  assert.equal(PHONOLOGY_GROUPS.length, 9)
  assert.equal(PHONOLOGY_GROUPS[0].id, 'all')
  assert.deepEqual(
    PHONOLOGY_GROUPS.slice(1).map((group) => group.id),
    [
      'labial',
      'tongue-tip-mid',
      'velar',
      'palatal',
      'sibilants',
      'nasal-finals',
      'compound-finals',
      'tones',
    ],
  )
})

test('each specific phonology group filters exercises by an actual indexed target', () => {
  const exercises = getExercisesByCategory('音系强化')

  for (const group of PHONOLOGY_GROUPS.slice(1)) {
    const filtered = filterExercisesByPhonologyGroup(exercises, group.id)
    assert.ok(filtered.length >= 100, `${group.label} should contain a substantial practice pool`)
    for (const exercise of filtered.slice(0, 100)) {
      assert.equal(
        getPhonologyExerciseTargets(exercise.id).some((target) => target.id === group.id),
        true,
        `${exercise.text} should carry ${group.label}`,
      )
      assert.ok(getPhonologyFocusForGroup(exercise.id, group.id))
    }
  }
})

test('the all group preserves the full phonology exercise pool', () => {
  const exercises = getExercisesByCategory('音系强化')
  assert.equal(filterExercisesByPhonologyGroup(exercises, 'all'), exercises)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildMandarinReinforcementPlan,
  buildMandarinReinforcementProductIndex,
} from './mandarin-reinforcement-plan-core.mjs'

const indexed = (taskId, targets) => ({
  task_id: taskId,
  initials: ['sh'], finals: ['an'], tones: ['1'], syllable_tones: targets,
  tone_pairs: [], positions: ['initial'], connected_speech: {},
})

test('reinforcement plan uses active safe prompts without calling planned slots recordings', () => {
  const plan = buildMandarinReinforcementPlan({
    generatedAt: '2026-08-23T00:00:00Z',
    ledger: {
      generated_at: 'ledger',
      targets: [
        { syllable_tone: 'shan1', syllable: 'shan', tone: 1, tier: 'core', coverage_status: 'below_minimum', current_hits: 18, deficit_to_robust: 2 },
        { syllable_tone: 'zhuai1', syllable: 'zhuai', tone: 1, tier: 'disputed', coverage_status: 'below_minimum', current_hits: 1, deficit_to_robust: 19 },
      ],
    },
    linguisticIndex: {
      generated_at: 'index',
      items: {
        safe: indexed('functional_speech', ['shan1']),
        package: indexed('targeted_gap', ['shan1']),
        disputed: indexed('targeted_gap', ['zhuai1']),
      },
    },
    exercises: [
      { id: 'safe', text: '请把山上的门关好', category: '日常与出行' },
      { id: 'package', text: '请领取课程包完成学习', category: '音系强化' },
      { id: 'disputed', text: '争议读音只做审核', category: '音系强化' },
    ],
  })

  assert.equal(plan.summary.below_minimum_targets, 2)
  assert.equal(plan.summary.default_planned_targets, 1)
  assert.equal(plan.summary.disputed_held_targets, 1)
  assert.deepEqual(plan.selected_prompts.map((prompt) => prompt.exercise_id), ['safe'])
  assert.equal(plan.targets.find((target) => target.syllable_tone === 'shan1').status, 'collection_slots_allocated')
  assert.equal(plan.targets.find((target) => target.syllable_tone === 'zhuai1').status, 'held_disputed')
  assert.equal(plan.policy.planned_slots_are_future_assignments_not_completed_recordings, true)
  assert.equal(plan.targets.every((target) => target.actual_confirmed_recording_hits === null), true)
  const productIndex = buildMandarinReinforcementProductIndex(plan)
  assert.deepEqual(Object.keys(productIndex.items), ['safe'])
  assert.equal(productIndex.items.safe.planned_recording_slots, 2)
  assert.equal(JSON.stringify(productIndex).includes('linguistic_tags'), false)
})

test('sparse targets stop at the per-prompt repetition cap and request more prompt diversity', () => {
  const plan = buildMandarinReinforcementPlan({
    ledger: {
      targets: [
        { syllable_tone: 'ai2', syllable: 'ai', tone: 2, tier: 'core', coverage_status: 'below_minimum', current_hits: 1, deficit_to_robust: 19 },
      ],
    },
    linguisticIndex: { items: { only: indexed('connected_reading', ['ai2']) } },
    exercises: [{ id: 'only', text: '这份材料需要再次核对', category: '现代文章朗读' }],
    maxPlannedRecordingsPerPrompt: 4,
  })

  assert.equal(plan.selected_prompts[0].planned_recording_slots, 4)
  assert.equal(plan.targets[0].planned_recording_slots, 4)
  assert.equal(plan.targets[0].unallocated_collection_slots, 15)
  assert.equal(plan.targets[0].remaining_prompt_diversity_need, 19)
  assert.equal(plan.targets[0].projected_prompt_hits_after_reuse_plan, 1)
  assert.equal(plan.targets[0].status, 'collection_slots_partially_allocated')
})

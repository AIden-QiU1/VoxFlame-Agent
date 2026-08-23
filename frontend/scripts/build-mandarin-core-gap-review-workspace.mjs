#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input')
const outputPath = value('--output')
const batchSize = Number(value('--batch-size') ?? 30)
if (!inputPath || !outputPath || !Number.isInteger(batchSize) || batchSize < 1) {
  throw new Error('usage: build-mandarin-core-gap-review-workspace --input <review.json> --output <workspace.json> [--batch-size 30]')
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const isReinforcement = payload.kind === 'voxflame_mandarin_reinforcement_context_review_pack'
const targetOrder = new Map(payload.target_status.map((target, index) => [target.syllable_tone, index]))
const targetStatusById = new Map(payload.target_status.map((target) => [target.syllable_tone, target]))
const items = [...payload.items].sort((left, right) => {
  const leftTarget = left.coverage_targets[0]
  const rightTarget = right.coverage_targets[0]
  return (targetOrder.get(leftTarget) ?? 0) - (targetOrder.get(rightTarget) ?? 0)
    || left.type.localeCompare(right.type)
    || left.id.localeCompare(right.id)
}).map((item, index) => ({
  id: item.id,
  batch: Math.floor(index / batchSize) + 1,
  type: item.type,
  text: item.text,
  coverage_targets: item.coverage_targets,
  source: item.source,
  proposed_task_id: item.proposed_task_id ?? 'targeted_gap',
  discourse_style: item.discourse_style ?? null,
  source_pinyin: item.source_pinyin ?? null,
  target_carriers: item.target_carriers ?? [],
  target_status: item.coverage_targets.map((target) => targetStatusById.get(target)).filter(Boolean),
  source_url: item.source_url ?? null,
  contributor: item.contributor ?? null,
  reviews: item.reviews,
  review_notes: item.review_notes ?? '',
}))

const workspace = {
  kind: isReinforcement
    ? 'voxflame_mandarin_reinforcement_review_workspace'
    : 'voxflame_mandarin_core_gap_review_workspace',
  workspace_id: isReinforcement ? 'reinforcement' : 'core-gap',
  title: isReinforcement ? '低频语境审稿台' : '核心补音语料审稿台',
  eyebrow: '普通话全音系列 · 内部工具',
  description: isReinforcement
    ? '审核现役题面不足的音节—声调语境；候选全部来自完整开放句料重排，未通过六项审核不会进入录音区。'
    : '审核完全缺失的核心音节—声调候选；未通过六项审核不会进入录音区。',
  decision_kind: payload.decision_kind ?? 'voxflame_mandarin_core_gap_review_decisions',
  target_count: payload.summary.core_missing_targets ?? payload.summary.target_count ?? payload.target_status.length,
  target_label: isReinforcement ? '低频目标' : '核心缺口',
  source_generated_at: payload.generated_at,
  generated_at: new Date().toISOString(),
  batch_size: batchSize,
  batches: Math.ceil(items.length / batchSize),
  summary: payload.summary,
  review_fields: ['linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product'],
  review_statuses: ['pending', 'approved', 'rewrite', 'rejected'],
  authoring_briefs: payload.authoring_briefs ?? [],
  items,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8')
console.log(`wrote ${items.length} workspace items in ${workspace.batches} batches`)

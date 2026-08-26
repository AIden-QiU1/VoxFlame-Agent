import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const repositoryDir = path.resolve(frontendDir, '..')
const generatedDir = path.join(frontendDir, 'src/lib/corpus/generated')
const evidenceDir = path.join(repositoryDir, 'research/speech-health/evidence/mandarin-collection-coverage-2026-08-22')
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
const blockedPackage = /学习包|课程包|培训包|资料包/u

test('current corpus preserves the 9107-item product pool while removing only five package prompts', () => {
  const generated = readJson(path.join(generatedDir, 'mandarin-training-real.json'))
  const cleanup = readJson(path.join(generatedDir, 'mandarin-training-real.cleanup-audit.json'))
  const index = readJson(path.join(generatedDir, 'mandarin-linguistic-index.json'))
  const generatedItems = Object.values(generated.categories).flatMap((category) => category.items)
  const removedPackages = cleanup.removed_items.filter((item) => blockedPackage.test(item.text))

  assert.equal(generatedItems.length, 8771)
  assert.equal(new Set(generatedItems.map((item) => item.text)).size, 8771)
  // The 9,107-item base pool is preserved; recording-ready packs are additive.
  assert.equal(index.summary.indexed_items, 9675)
  assert.equal(index.summary.indexed_items - generatedItems.length, 904)
  assert.equal(removedPackages.length, 5)
  assert.equal(generatedItems.some((item) => blockedPackage.test(item.text)), false)
})

test('full-phonology artifacts keep every target and do not promote pending candidates', () => {
  const index = readJson(path.join(generatedDir, 'mandarin-linguistic-index.json'))
  const ledger = readJson(path.join(generatedDir, 'mandarin-coverage-target-ledger.json'))
  const review = readJson(path.join(evidenceDir, 'mandarin-core-gap-phase1-review.json'))
  const workspace = readJson(path.join(generatedDir, 'mandarin-core-gap-review-workspace.json'))
  const approved = readJson(path.join(generatedDir, 'mandarin-approved-core-gap-corpus.json'))
  const edge = readJson(path.join(evidenceDir, 'mandarin-edge-gap-review.json'))
  const reinforcement = readJson(path.join(generatedDir, 'mandarin-below-minimum-reinforcement-plan.json'))
  const reinforcementProductIndex = readJson(path.join(generatedDir, 'mandarin-reinforcement-product-index.json'))
  const reinforcementReview = readJson(path.join(evidenceDir, 'mandarin-reinforcement-context-review.json'))
  const reinforcementWorkspace = readJson(path.join(generatedDir, 'mandarin-reinforcement-review-workspace.json'))
  const spokenTextWorkspace = readJson(path.join(generatedDir, 'mandarin-spoken-text-review-workspace.json'))
  const reinforcementAuthored = readJson(path.join(frontendDir, 'src/lib/corpus/mandarin-reinforcement-authored-candidates.json'))
  const recordingReinforcement = readJson(path.join(generatedDir, 'mandarin-recording-reinforcement-corpus.json'))
  const recordingCoreGap = readJson(path.join(generatedDir, 'mandarin-recording-core-gap-corpus.json'))
  const recordingOpenResearch = readJson(path.join(generatedDir, 'mandarin-recording-open-research-corpus.json'))
  const collectionEvidence = readJson(path.join(evidenceDir, 'mandarin-collection-evidence.json'))
  const missing = ledger.targets.filter((target) => target.coverage_status === 'missing')
  const missingTiers = Object.fromEntries(
    Object.entries(Object.groupBy(missing, (target) => target.tier)).map(([tier, targets]) => [tier, targets.length]),
  )
  const reviewFields = ['linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product']
  const coverageCounts = new Map()

  for (const item of review.items) {
    for (const target of item.coverage_targets) {
      coverageCounts.set(target, (coverageCounts.get(target) ?? 0) + 1)
    }
  }

  assert.equal(ledger.targets.length, 1242)
  assert.deepEqual(ledger.summary.coverage_status_counts, { below_minimum: 456, missing: 217, robust: 569 })
  assert.deepEqual(missingTiers, { disputed: 8, core: 88, edge: 121 })
  assert.equal(review.items.length, 263)
  assert.equal(new Set(review.items.map((item) => item.id)).size, 263)
  assert.equal(new Set(review.items.map((item) => item.text)).size, 263)
  assert.equal(review.items.filter((item) => item.type === 'word').length, 88)
  assert.equal(review.items.filter((item) => item.type === 'short_sentence').length, 175)
  assert.equal(review.items.filter((item) => item.type === 'short_sentence').every((item) => item.target_carriers?.length > 0), true)
  assert.equal([...coverageCounts.values()].every((count) => count === 3), true)
  assert.equal(review.items.every((item) => reviewFields.every((field) => item.reviews[field] === 'pending')), true)
  assert.equal(review.items.some((item) => blockedPackage.test(item.text)), false)
  assert.equal(workspace.source_generated_at, review.generated_at)
  assert.equal(workspace.batches, 9)
  assert.equal(edge.items.length, 121)
  assert.equal(approved.items.length, 0)
  assert.equal(reinforcement.targets.length, 456)
  assert.equal(recordingReinforcement.summary.recording_ready_items, 291)
  assert.equal(recordingReinforcement.items.every((item) => item.recording_readiness === 'ready_for_recording'), true)
  const coreMissingTargets = new Set(missing.filter((target) => target.tier === 'core').map((target) => target.syllable_tone))
  const recordingCoreTargets = new Set(recordingCoreGap.items.flatMap((item) => item.coverage_targets ?? []))
  assert.equal(recordingCoreGap.summary.recording_ready_items, 263)
  assert.equal(recordingCoreGap.summary.recording_ready_targets, 88)
  assert.deepEqual(recordingCoreTargets, coreMissingTargets)
  assert.equal(recordingCoreGap.items.every((item) => item.recording_readiness === 'ready_for_recording'), true)
  assert.equal(recordingOpenResearch.summary.recording_ready_items, 14)
  assert.equal(recordingOpenResearch.summary.recording_ready_targets, 15)
  assert.equal(recordingOpenResearch.items.every((item) => item.recording_readiness === 'ready_for_recording'), true)
  assert.equal(recordingOpenResearch.items.every((item) => item.source.includes('open research corpus')), true)
  assert.equal(recordingOpenResearch.items.every((item) => item.target && item.coverage_targets?.includes(item.target)), true)
  const belowMinimumTargets = new Set(reinforcement.targets
    .filter((target) => target.status !== 'held_disputed')
    .map((target) => target.syllable_tone))
  const recordingReinforcementTargets = new Set(recordingReinforcement.items.flatMap((item) => item.coverage_targets ?? []))
  assert.equal([...recordingReinforcementTargets].every((target) => belowMinimumTargets.has(target)), true)
  assert.equal(reinforcement.summary.default_planned_targets, 455)
  assert.equal(reinforcement.summary.disputed_held_targets, 1)
  assert.equal(reinforcement.targets.every((target) => target.actual_confirmed_recording_hits === null), true)
  assert.equal(reinforcement.policy.planned_slots_are_future_assignments_not_completed_recordings, true)
  assert.equal(reinforcement.selected_prompts.every((prompt) => index.items[prompt.exercise_id]), true)
  assert.equal(reinforcement.selected_prompts.some((prompt) => blockedPackage.test(prompt.text)), false)
  const heldTargetSet = new Set(reinforcement.targets.filter((target) => target.status === 'held_disputed').map((target) => target.syllable_tone))
  assert.equal(reinforcement.selected_prompts.some((prompt) => prompt.low_frequency_targets.some((target) => heldTargetSet.has(target))), false)
  assert.equal(Object.keys(reinforcementProductIndex.items).length, reinforcement.summary.selected_prompts)
  assert.equal(reinforcementProductIndex.summary.planned_recording_slots, reinforcement.summary.planned_recording_slots)
  assert.deepEqual(new Set(Object.keys(reinforcementProductIndex.items)), new Set(reinforcement.selected_prompts.map((prompt) => prompt.exercise_id)))
  assert.equal(reinforcementReview.summary.target_count, 146)
  assert.equal(reinforcementReview.summary.production_items, 0)
  assert.equal(reinforcementReview.items.every((item) => reviewFields.every((field) => item.reviews[field] === 'pending')), true)
  assert.equal(reinforcementReview.items.some((item) => blockedPackage.test(item.text)), false)
  assert.equal(reinforcementReview.items.every((item) => item.target_carriers.length > 0), true)
  assert.equal(reinforcementReview.items.every((item) => item.proposed_task_id === 'targeted_gap'), true)
  assert.equal(reinforcementReview.items.every((item) => ['functional_speech', 'connected_reading'].includes(item.discourse_style)), true)
  const authoredReviewItems = reinforcementReview.items.filter((item) => item.source === 'VoxFlame authored candidate')
  assert.equal(authoredReviewItems.length, reinforcementAuthored.items.length)
  assert.deepEqual(
    new Set(authoredReviewItems.map((item) => item.id.replace(/^reinforcement-/u, ''))),
    new Set(reinforcementAuthored.items.map((item) => item.id)),
  )
  assert.equal(authoredReviewItems.every((item) => item.source_url === null && item.contributor === null), true)
  assert.equal(authoredReviewItems.every((item) => reviewFields.every((field) => item.reviews[field] === 'pending')), true)
  assert.equal(reinforcementReview.sources.authored_candidates.item_count, reinforcementAuthored.items.length)
  assert.equal(reinforcementReview.summary.guided_authoring_targets, 0)
  assert.equal(reinforcementReview.summary.targets_with_context_goal + reinforcementReview.summary.specialist_review_targets, 146)
  assert.equal(reinforcementReview.target_status.every((target) => target.selected_contexts + target.remaining_contexts_to_author === 3), true)
  const authoringTargetSet = new Set(reinforcementReview.target_status
    .filter((target) => target.remaining_contexts_to_author > 0)
    .map((target) => target.syllable_tone))
  assert.equal(reinforcementReview.authoring_briefs.length, authoringTargetSet.size)
  assert.deepEqual(new Set(reinforcementReview.authoring_briefs.map((brief) => brief.syllable_tone)), authoringTargetSet)
  assert.equal(reinforcementReview.authoring_briefs.every((brief) => (
    brief.contexts_required === reinforcementReview.target_status.find((target) => target.syllable_tone === brief.syllable_tone)?.remaining_contexts_to_author
  )), true)
  assert.equal(reinforcementReview.authoring_briefs.every((brief) => (
    brief.safe_carrier_options.every((carrier) => !/学习包|课程包|培训包|资料包|挨打|挨饿|挨罚|殡|娼|排尿|奴/u.test(carrier.text))
  )), true)
  assert.equal(reinforcementReview.authoring_briefs.every((brief) => (
    brief.safe_carrier_options.length > 0 || brief.specialist_review_required === true
  )), true)
  assert.equal(reinforcementReview.authoring_briefs.every((brief) => brief.specialist_review_required === true), true)
  assert.equal(reinforcementReview.authoring_briefs.every((brief) => (
    brief.specialist_route
      && typeof brief.specialist_route.reason_category === 'string'
      && brief.specialist_route.allowed_evidence.length > 0
      && typeof brief.specialist_route.default_recording_policy === 'string'
      && typeof brief.specialist_route.next_action === 'string'
  )), true)
  assert.equal(new Set(reinforcementReview.authoring_briefs.map((brief) => brief.specialist_route.reason_category)).size >= 8, true)
  assert.equal(reinforcementWorkspace.source_generated_at, reinforcementReview.generated_at)
  assert.equal(reinforcementWorkspace.workspace_id, 'reinforcement')
  assert.equal(reinforcementWorkspace.items.length, reinforcementReview.items.length)
  assert.equal(reinforcementWorkspace.items.every((item) => item.proposed_task_id === 'targeted_gap'), true)
  assert.deepEqual(reinforcementWorkspace.authoring_briefs, reinforcementReview.authoring_briefs)
  assert.equal(reinforcementWorkspace.decision_kind, 'voxflame_mandarin_reinforcement_review_decisions')
  assert.equal(collectionEvidence.kind, 'voxflame_mandarin_collection_evidence')
  assert.equal(collectionEvidence.review.full_queue_items, 1185)
  assert.equal(collectionEvidence.review.full_queue_approved_items, 0)
  assert.equal(collectionEvidence.review.coverage_eligible_recordings, 1180)
  assert.equal(collectionEvidence.review.manifest_collection_eligible_recordings, 1180)
  assert.equal(collectionEvidence.policy.human_spoken_text_is_required_for_coverage, false)
  assert.equal(collectionEvidence.policy.audio_text_alignment_is_required_for_coverage, false)
  assert.equal(reinforcementProductIndex.kind, 'voxflame_mandarin_reinforcement_product_index')
  assert.equal(spokenTextWorkspace.workspace_id, 'spoken-text')
  assert.equal(spokenTextWorkspace.items.length, 1185)
  assert.equal(spokenTextWorkspace.policy.training_import_allowed, false)
  assert.equal(spokenTextWorkspace.items.every((item) => item.asr_hint_role === 'non_authoritative_hint'), true)
  assert.equal(spokenTextWorkspace.items.every((item) => item.spoken_text === null), true)
  assert.equal(spokenTextWorkspace.items.every((item) => item.audio_text_alignment === 'pending'), true)
})

test('recording-ready coverage keeps explicit polyphonic targets separate from generic pinyin', () => {
  const core = readJson(path.join(generatedDir, 'mandarin-recording-core-gap-corpus.json'))
  const explicitTargets = new Set(core.items.flatMap((item) => item.coverage_targets ?? []))
  for (const target of ['e1', 'ga1', 'ga2', 'lei1', 'zang4', 'zha2']) {
    assert.equal(explicitTargets.has(target), true)
  }
  assert.equal(core.items.every((item) => item.recording_readiness === 'ready_for_recording'), true)
  assert.equal(core.items.every((item) => item.target && item.coverage_targets?.includes(item.target)), true)
})

test('removed dual-review branch cannot re-enter the active corpus workflow', () => {
  const forbiddenPaths = [
    path.join(frontendDir, 'src/app/corpus-review/dual-spoken-text'),
    path.join(frontendDir, 'src/components/corpus-review/MandarinDualReviewWorkbench.tsx'),
    path.join(frontendDir, 'scripts/build-mandarin-dual-review-workspace.mjs'),
    path.join(frontendDir, 'scripts/mandarin-dual-review-core.test.mjs'),
    path.join(frontendDir, 'scripts/validate-mandarin-dual-review.mjs'),
    path.join(generatedDir, 'mandarin-dual-spoken-text-review-workspace.json'),
  ]
  assert.equal(forbiddenPaths.every((filePath) => !fs.existsSync(filePath)), true)
})

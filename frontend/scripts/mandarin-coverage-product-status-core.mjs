function sameSet(left, right) {
  return left.size === right.size && [...left].every((item) => right.has(item))
}

function sourceFingerprint(payload) {
  return JSON.stringify({
    reference: payload?.sources?.reference?.sha256,
    character_readings: payload?.sources?.character_readings?.sha256,
    lexical_carriers: payload?.sources?.lexical_carriers?.sha256,
    external_sentences: payload?.sources?.external_sentences?.sha256,
    prompt_items: payload?.sources?.current_prompt_corpus?.item_count,
  })
}

export function buildCoverageProductStatus({ ledger, review, approved, reinforcement, collectionEvidence = null, generatedAt = new Date().toISOString() }) {
  const missing = ledger.targets.filter((target) => target.coverage_status === 'missing')
  const belowMinimum = ledger.targets.filter((target) => target.coverage_status === 'below_minimum')
  const ledgerCoreTargets = new Set(missing.filter((target) => target.tier === 'core').map((target) => target.syllable_tone))
  const reviewTargets = new Set(review.target_status.map((target) => target.syllable_tone))

  if (!sameSet(ledgerCoreTargets, reviewTargets)) {
    throw new Error('core-gap review is stale: target set does not match the current coverage ledger')
  }
  if (sourceFingerprint(ledger) !== sourceFingerprint(review)) {
    throw new Error('core-gap review is stale: source fingerprint does not match the current coverage ledger')
  }
  const approvedTargets = new Set(approved.items.flatMap((item) => item.coverage_targets ?? []))
  for (const target of approvedTargets) {
    if (!ledgerCoreTargets.has(target)) throw new Error(`approved corpus contains non-current core target: ${target}`)
  }
  if (reinforcement.summary.below_minimum_targets !== belowMinimum.length) {
    throw new Error('reinforcement plan is stale: below-minimum target count does not match the current coverage ledger')
  }
  const reinforcementTargets = new Set(reinforcement.targets.map((target) => target.syllable_tone))
  const belowMinimumTargets = new Set(belowMinimum.map((target) => target.syllable_tone))
  if (!sameSet(reinforcementTargets, belowMinimumTargets)) {
    throw new Error('reinforcement plan is stale: target set does not match the current coverage ledger')
  }
  if (reinforcement.source.current_prompt_items !== ledger.sources.current_prompt_corpus.item_count) {
    throw new Error('reinforcement plan is stale: current prompt item count does not match the coverage ledger')
  }

  return {
    kind: 'voxflame_mandarin_coverage_product_status',
    generated_at: generatedAt,
    policy: {
      default_recording_uses_approved_core_only: true,
      edge_targets_are_specialist_optional_only: true,
      disputed_targets_are_never_shown: true,
      existing_training_prompts_and_recordings_are_preserved: true,
      ledger_review_and_approved_export_must_be_synchronized: true,
      planned_reinforcement_slots_are_not_completed_recordings: true,
      human_spoken_text_and_audio_alignment_required_for_actual_recording_coverage: true,
      dual_review_audio_integrity_failure_blocks_consensus_coverage_claims: true,
    },
    current_prompt_corpus: {
      items: ledger.sources.current_prompt_corpus.item_count,
      missing_syllable_tone_targets: missing.length,
      below_minimum_syllable_tone_targets: belowMinimum.length,
      robust_syllable_tone_targets: ledger.summary.coverage_status_counts.robust,
    },
    core_gap_phase1: {
      targets: review.summary.core_missing_targets,
      targets_with_three_candidates: review.summary.targets_with_sufficient_candidates,
      review_candidates: review.summary.selected_items,
      approved_prompts: approved.summary.approved_items,
      approved_targets: approved.summary.approved_targets,
      status: approved.summary.approved_items > 0 ? 'partially_available' : 'awaiting_human_review',
    },
    below_minimum_reinforcement: {
      targets: reinforcement.summary.below_minimum_targets,
      default_planned_targets: reinforcement.summary.default_planned_targets,
      selected_prompts: reinforcement.summary.selected_prompts,
      planned_recording_slots: reinforcement.summary.planned_recording_slots,
      fully_allocated_targets: reinforcement.summary.status_counts.collection_slots_allocated ?? 0,
      partially_allocated_targets: reinforcement.summary.status_counts.collection_slots_partially_allocated ?? 0,
      prompt_diversity_below_minimum_targets: reinforcement.summary.default_planned_targets,
      disputed_held_targets: reinforcement.summary.disputed_held_targets,
      actual_confirmed_recording_hits: null,
      status: 'collection_plan_ready',
    },
    actual_collection_evidence: collectionEvidence ? {
      full_review_queue_items: collectionEvidence.review.full_queue_items,
      full_review_approved_items: collectionEvidence.review.full_queue_approved_items,
      coverage_eligible_recordings: collectionEvidence.review.coverage_eligible_recordings,
      dual_sample_items: collectionEvidence.review.dual_sample_items,
      dual_consensus_items: collectionEvidence.review.dual_consensus_items,
      dual_audio_verified_consensus_items: collectionEvidence.review.dual_audio_verified_consensus_items,
      audio_integrity_gate_passed: collectionEvidence.review.audio_integrity_gate_passed,
      audio_status_counts: collectionEvidence.review.audio_status_counts,
      status: collectionEvidence.review.coverage_eligible_recordings > 0 ? 'human_review_started' : 'awaiting_human_spoken_text_review',
    } : {
      full_review_queue_items: null,
      full_review_approved_items: null,
      coverage_eligible_recordings: null,
      dual_sample_items: null,
      dual_consensus_items: null,
      dual_audio_verified_consensus_items: null,
      audio_integrity_gate_passed: null,
      audio_status_counts: {},
      status: 'evidence_not_loaded',
    },
    held_targets: {
      edge_missing: missing.filter((target) => target.tier === 'edge').length,
      disputed_missing: missing.filter((target) => target.tier === 'disputed').length,
    },
  }
}

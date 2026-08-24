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

function explicitRecordingTargetSummary(corpus) {
  if (!corpus) return null
  const items = Array.isArray(corpus.items) ? corpus.items : []
  const targets = new Set(items.flatMap((item) => Array.isArray(item.coverage_targets) ? item.coverage_targets : []))
  return {
    target_count: targets.size,
    targets: [...targets].sort(),
    items_with_explicit_targets: items.filter((item) => Array.isArray(item.coverage_targets) && item.coverage_targets.length > 0).length,
    all_items_have_non_empty_target: items.every((item) => typeof item.target === 'string' && item.target.trim() !== ''),
    all_items_are_recording_ready: items.every((item) => item.recording_readiness === 'ready_for_recording'),
  }
}

function recordingReadyTotalSummary(corpora) {
  const items = corpora.flatMap((corpus) => Array.isArray(corpus?.items) ? corpus.items : [])
  const texts = new Set(items
    .map((item) => typeof item.text === 'string' ? item.text.trim() : '')
    .filter(Boolean))
  const targets = new Set(items.flatMap((item) => (
    Array.isArray(item.coverage_targets)
      ? item.coverage_targets.filter((target) => typeof target === 'string' && target.trim())
      : []
  )))
  return {
    items: items.length,
    unique_texts: texts.size,
    targets: targets.size,
  }
}

export function buildCoverageProductStatus({ ledger, review, approved, reinforcement, recordingCoreGap = null, recordingReinforcement = null, recordingOpenResearch = null, collectionEvidence = null, generatedAt = new Date().toISOString() }) {
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
      default_recording_uses_machine_checked_core_only: true,
      default_recording_uses_approved_core_only: false,
      edge_targets_are_specialist_optional_only: true,
      disputed_targets_are_never_shown: true,
      existing_training_prompts_and_recordings_are_preserved: true,
      ledger_review_and_approved_export_must_be_synchronized: true,
      planned_reinforcement_slots_are_not_completed_recordings: true,
      human_spoken_text_and_audio_alignment_required_for_actual_recording_coverage: false,
      valid_audio_and_non_empty_target_define_collection_coverage: true,
      asr_and_human_spoken_text_are_quality_diagnostics_not_collection_gates: true,
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
    recording_core_gap: recordingCoreGap ? {
      recording_ready_items: recordingCoreGap.summary.recording_ready_items,
      recording_ready_targets: recordingCoreGap.summary.recording_ready_targets,
      words: recordingCoreGap.summary.words,
      short_sentences: recordingCoreGap.summary.short_sentences,
      explicit_target_coverage: explicitRecordingTargetSummary(recordingCoreGap),
      status: 'recording_available_machine_checked',
    } : {
      recording_ready_items: 0,
      recording_ready_targets: 0,
      words: 0,
      short_sentences: 0,
      explicit_target_coverage: null,
      status: 'not_loaded',
    },
    recording_reinforcement: recordingReinforcement ? {
      recording_ready_items: recordingReinforcement.summary.recording_ready_items,
      recording_ready_targets: recordingReinforcement.summary.recording_ready_targets,
      short_sentences: recordingReinforcement.summary.short_sentences,
      rejected_candidates: recordingReinforcement.summary.rejected_candidates,
      explicit_target_coverage: explicitRecordingTargetSummary(recordingReinforcement),
      status: 'recording_available_machine_checked',
    } : {
      recording_ready_items: 0,
      recording_ready_targets: 0,
      short_sentences: 0,
      rejected_candidates: null,
      explicit_target_coverage: null,
      status: 'not_loaded',
    },
    recording_open_research: recordingOpenResearch ? {
      recording_ready_items: recordingOpenResearch.summary.recording_ready_items,
      recording_ready_targets: recordingOpenResearch.summary.recording_ready_targets,
      short_sentences: recordingOpenResearch.summary.short_sentences,
      explicit_target_coverage: explicitRecordingTargetSummary(recordingOpenResearch),
      source_type: recordingOpenResearch.source?.source_type ?? 'open_research_corpus',
      status: 'recording_available_machine_checked',
    } : {
      recording_ready_items: 0,
      recording_ready_targets: 0,
      short_sentences: 0,
      explicit_target_coverage: null,
      source_type: null,
      status: 'not_loaded',
    },
    recording_ready_total: recordingReadyTotalSummary([
      recordingCoreGap,
      recordingReinforcement,
      recordingOpenResearch,
    ]),
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
      manifest_collection_eligible_recordings: collectionEvidence.review.manifest_collection_eligible_recordings,
      manifest_collection_quality_statuses: collectionEvidence.review.manifest_collection_quality_statuses,
      explicit_recording_targets: collectionEvidence.coverage?.collected_audio_with_target?.coverage?.explicit_recording_targets
        ? {
            present: collectionEvidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.present,
            robust: collectionEvidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.robust,
            expected: collectionEvidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.expected,
          }
        : null,
      status: collectionEvidence.review.coverage_eligible_recordings > 0 ? 'collection_coverage_counted' : 'no_valid_audio_with_target_found',
    } : {
      full_review_queue_items: null,
      full_review_approved_items: null,
      coverage_eligible_recordings: null,
      manifest_collection_eligible_recordings: null,
      manifest_collection_quality_statuses: {},
      explicit_recording_targets: null,
      status: 'evidence_not_loaded',
    },
    held_targets: {
      edge_missing: missing.filter((target) => target.tier === 'edge').length,
      disputed_missing: missing.filter((target) => target.tier === 'disputed').length,
    },
  }
}

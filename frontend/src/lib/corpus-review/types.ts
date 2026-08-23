export const CORE_GAP_REVIEW_FIELDS = [
  'linguistic',
  'naturalness',
  'user_burden',
  'safety',
  'license',
  'product',
] as const

export const CORE_GAP_REVIEW_STATUSES = [
  'pending',
  'approved',
  'rewrite',
  'rejected',
] as const

export type CoreGapReviewField = (typeof CORE_GAP_REVIEW_FIELDS)[number]
export type CoreGapReviewStatus = (typeof CORE_GAP_REVIEW_STATUSES)[number]
export type CoreGapReviews = Record<CoreGapReviewField, CoreGapReviewStatus>

export interface CoreGapTargetCarrier {
  source: string
  source_pinyin: string
  text: string
}

export interface CoreGapWorkspaceItem {
  id: string
  batch: number
  type: 'word' | 'short_sentence'
  text: string
  coverage_targets: string[]
  source: string
  proposed_task_id?: 'targeted_gap'
  discourse_style?: 'functional_speech' | 'connected_reading' | null
  source_pinyin: string | null
  target_carriers: CoreGapTargetCarrier[]
  target_status: Array<{
    syllable_tone: string
    current_prompt_hits?: number
    prompt_deficit_to_minimum?: number
    external_candidates_found?: number
    selected_contexts?: number
    remaining_contexts_to_author?: number
    readiness?: string
  }>
  source_url: string | null
  contributor: string | null
  reviews: CoreGapReviews
  review_notes: string
}

export interface CoreGapAuthoringBrief {
  syllable_tone: string
  contexts_required: number
  authoring_path: 'guided_authoring' | 'specialist_review_required'
  specialist_review_required: boolean
  specialist_review_reason: string | null
  specialist_route: {
    reason_category: string
    allowed_evidence: string[]
    default_recording_policy: string
    next_action: string
  } | null
  safe_carrier_options: CoreGapTargetCarrier[]
  constraints: string[]
}

export interface CoreGapReviewWorkspace {
  kind: 'voxflame_mandarin_core_gap_review_workspace' | 'voxflame_mandarin_reinforcement_review_workspace'
  workspace_id: 'core-gap' | 'reinforcement'
  title: string
  eyebrow: string
  description: string
  decision_kind: 'voxflame_mandarin_core_gap_review_decisions' | 'voxflame_mandarin_reinforcement_review_decisions'
  target_count: number
  target_label: string
  source_generated_at: string
  generated_at: string
  batch_size: number
  batches: number
  summary: Record<string, number>
  review_fields: CoreGapReviewField[]
  review_statuses: CoreGapReviewStatus[]
  authoring_briefs: CoreGapAuthoringBrief[]
  items: CoreGapWorkspaceItem[]
}

export interface CoreGapDraftDecision {
  reviews: CoreGapReviews
  review_notes: string
}

export type CoreGapDraft = Record<string, CoreGapDraftDecision>

export type SpokenTextReviewStatus = 'pending' | 'approved' | 'uncertain' | 'unusable'
export type AudioTextAlignmentStatus = 'pending' | 'confirmed' | 'mismatch' | 'unusable'

export interface SpokenTextReviewItem {
  recording_id: string
  audio_locator: string
  audio_filename: string
  prompt_text: string
  category: string
  asr_hint: string | null
  asr_hint_role: 'non_authoritative_hint'
  duration_ms: number
  quality_disposition: string
  spoken_text: string | null
  spoken_text_status: SpokenTextReviewStatus
  audio_text_alignment: AudioTextAlignmentStatus
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer_note: string | null
}

export interface SpokenTextReviewWorkspace {
  kind: 'voxflame_mandarin_spoken_text_review_queue'
  status: 'human_review_required_not_for_training'
  generated_at: string
  source_manifest_files: string[]
  policy: {
    asr_is_hint_only: true
    human_spoken_text_required_for_coverage: true
    audio_text_alignment_required_for_coverage: true
    original_manifest_and_audio_are_immutable: true
    training_import_allowed: false
  }
  items: SpokenTextReviewItem[]
  title?: string
  description?: string
  workspace_id?: 'spoken-text'
  review_scope?: 'historical_recordings'
}

export type DualAnnotationStatus = 'pending' | 'completed' | 'unavailable'
export type DualAnnotatorRole = 'annotator_a' | 'annotator_b'

export interface MandarinDualReviewItem {
  review_item_id: string
  recording_id: string
  audio_locator: string
  audio_filename: string
  prompt_text: string
  category: string
  quality_disposition: string
  duration_ms: number
  annotator_a: { status: DualAnnotationStatus; spoken_text: string | null; reviewed_by: string | null; reviewed_at: string | null; note: string | null }
  annotator_b: { status: DualAnnotationStatus; spoken_text: string | null; reviewed_by: string | null; reviewed_at: string | null; note: string | null }
  agreement_status: 'pending' | 'agree' | 'disagree' | 'adjudicated'
  consensus: { status: 'pending' | 'approved'; spoken_text: string | null; reviewed_by: string | null; reviewed_at: string | null; note: string | null }
}

export interface MandarinDualReviewWorkspace {
  kind: 'voxflame_mandarin_dual_spoken_text_review_queue'
  status: 'human_review_required_not_for_training'
  generated_at: string
  source_manifest_files: string[]
  sample_seed: string
  policy: { independent_annotators: 2; asr_is_not_shown_in_review_item: true; disagreements_require_adjudication: true; consensus_required_for_coverage: true; original_manifest_and_audio_are_immutable: true; training_import_allowed: false }
  items: MandarinDualReviewItem[]
  title?: string
  description?: string
  workspace_id?: 'dual-spoken-text'
}

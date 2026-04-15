import type { CommunicationPreferences } from '@/lib/communication/communication-preferences'
import type { StarterKitScene } from '@/lib/communication/starter-kit'

export interface ExpressionKitSuggestion {
  id: string
  text: string
  source: 'quick_phrase' | 'hotword_profile' | 'frequent_expression'
  category: string
  note?: string
  priority: number
}

export interface ProfileBundleItem {
  id: string
  title: string
  content: string
  source: 'user_profile' | 'growth_profile' | 'hotword_profile' | 'memory'
  emphasis: 'high' | 'medium' | 'low'
  tags?: string[]
  updated_at: string
}

export type PreparedExpressionFeedbackStatus =
  | 'excellent'
  | 'close'
  | 'retry'
  | 'unclear'

export interface PreparedExpressionSectionSnapshot {
  id: string
  title: string
  summary: string
  anchor_line: string
  practice_lines: string[]
  high_risk_phrases: string[]
  fallback_phrases: string[]
  hotwords: string[]
  rehearsal_count: number
  low_confidence_count: number
  latest_feedback_status: PreparedExpressionFeedbackStatus | null
  last_rehearsed_at: string | null
  is_priority: boolean
}

export interface PreparedExpressionAsrHotwordEntry {
  text: string
  weight: number
  lang: 'zh' | 'en'
}

export interface PreparedExpressionCorrectionPair {
  target: string
  heard: string
  occurrenceCount: number
}

export interface PreparedExpressionRehearsalSummarySnapshot {
  summary: string
  hotwords: string[]
  recurring_errors: string[]
  pronunciation_patterns: string[]
  support_strategies: string[]
  next_focus: string[]
  reference_lines: string[]
  training_pairs: PreparedExpressionCorrectionPair[]
  based_on_training_count: number
  model: string
  updated_at: string
}

export interface PreparedExpressionSnapshot {
  id: string
  title: string
  summary: string
  scene: string | null
  source: string
  document_content: string
  last_rehearsed_at: string | null
  rehearsal_count: number
  low_confidence_sections: number
  hotwords: string[]
  high_risk_phrases: string[]
  fallback_phrases: string[]
  asr_hotword_entries: PreparedExpressionAsrHotwordEntry[]
  reference_lines: string[]
  training_pairs: PreparedExpressionCorrectionPair[]
  next_focus: string[]
  rehearsal_summary: PreparedExpressionRehearsalSummarySnapshot | null
  sections: PreparedExpressionSectionSnapshot[]
  updated_at: string
}

export interface WorkspaceMemorySnapshot {
  object_zones: Array<{
    id: 'custom_materials' | 'scene_and_hotword_templates' | 'user_profile' | 'training_summaries'
    title: string
    description: string
    empty_state: string
    items: Array<{
      id: string
      type: 'custom_material' | 'scene_template' | 'user_profile' | 'training_summary'
      title: string
      summary: string
      tags: string[]
      load_behavior: 'manual' | 'recommended' | 'always_on' | 'derived'
      editable: boolean
      updated_at: string
    }>
  }>
  profile_bundle: {
    static: ProfileBundleItem[]
    dynamic: ProfileBundleItem[]
    relevant: ProfileBundleItem[]
  }
  session_review: {
    session_id: string | null
    headline: string
    summary: string
    focus: string[]
    recent_win: string | null
    next_step: string | null
    updated_at: string
  }
  preparation: {
    active_scene_id: StarterKitScene['id'] | null
    profile_summary: string
    overview: string
    immediate_goal: string | null
    scene_brief: string | null
    common_scenarios: string[]
    strong_phrases: string[]
    risky_terms: string[]
    pronunciation_patterns: string[]
    listener_guidance: string[]
    support_strategies: string[]
    hotwords: string[]
    asr_hotword_entries: PreparedExpressionAsrHotwordEntry[]
    document_context_summary: string | null
    document_content: string | null
    reference_lines: PreparedExpressionSnapshot['reference_lines']
    training_pairs: PreparedExpressionCorrectionPair[]
    next_step: string | null
    updated_at: string
  }
  prepared_expression: PreparedExpressionSnapshot | null
  expression_kit: {
    active_scene_id: StarterKitScene['id'] | null
    personalized_phrases: ExpressionKitSuggestion[]
    hotword_profiles: Array<{
      id: string
      phrase: string
      category: string
      scenario: string
      note?: string
      createdAt: number
      updatedAt: number
    }>
    quick_phrases: Array<{
      id: string
      text: string
      category: string
      usage_count: number
      order_index: number
      updated_at?: string
    }>
    recommended_focus: string[]
    communication_preferences: CommunicationPreferences
  }
  synced_at: string
}

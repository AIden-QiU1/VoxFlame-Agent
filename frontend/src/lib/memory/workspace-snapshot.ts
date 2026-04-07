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

export interface PreparedExpressionSnapshot {
  id: string
  title: string
  summary: string
  scene: string | null
  source: string
  last_rehearsed_at: string | null
  rehearsal_count: number
  low_confidence_sections: number
  hotwords: string[]
  high_risk_phrases: string[]
  fallback_phrases: string[]
  next_focus: string[]
  sections: PreparedExpressionSectionSnapshot[]
  updated_at: string
}

export interface WorkspaceMemorySnapshot {
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
    next_step: string | null
    updated_at: string
  }
  prepared_expression: PreparedExpressionSnapshot | null
  expression_kit: {
    active_scene_id: StarterKitScene['id'] | null
    personalized_phrases: ExpressionKitSuggestion[]
    recommended_focus: string[]
    communication_preferences: CommunicationPreferences
  }
  synced_at: string
}

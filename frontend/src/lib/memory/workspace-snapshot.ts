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
  expression_kit: {
    active_scene_id: StarterKitScene['id'] | null
    personalized_phrases: ExpressionKitSuggestion[]
    recommended_focus: string[]
    communication_preferences: CommunicationPreferences
  }
  synced_at: string
}

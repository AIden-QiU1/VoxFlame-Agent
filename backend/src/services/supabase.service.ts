import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  buildMemoryGrowthProfileSnapshot,
  FeedbackStatus,
  MemoryGrowthProfileSnapshot,
} from './memory-growth.service';
import {
  rankExpressionKitSuggestions,
  type WorkspaceSceneId,
} from './expression-kit.service';
import {
  buildPreparedExpressionCorrectionPairs,
  buildPreparedExpressionReferenceLines,
  createPreparedExpressionAssetFromDraft,
  normalizePreparedExpressionAsset,
  type PreparedExpressionAsset,
  type PreparedExpressionAsrHotwordEntry,
  type PreparedExpressionCorrectionPair,
} from './prepared-expression.service';
import {
  PreparedExpressionSummaryService,
  type PreparedExpressionSummaryTrigger,
  type PreparedExpressionTrainingSample,
} from './prepared-expression-summary.service';

type JsonRecord = Record<string, unknown>;

export interface Memory {
  id?: string;
  user_id: string;
  session_id: string;
  content: string;
  metadata?: JsonRecord;
  embedding?: number[];
  created_at?: string;
  updated_at?: string;
}

export interface Session {
  id?: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  transcript?: string;
  metadata?: JsonRecord;
}

export interface UserProfile {
  id?: string;
  name?: string;
  age?: number;
  condition?: string;
  hotwords?: string[];
  preferences?: JsonRecord;
  created_at?: string;
  updated_at?: string;
}

export interface QuickPhrase {
  id?: string;
  user_id: string;
  text: string;
  category: PhraseCategory;
  tts_url?: string;
  usage_count: number;
  last_used_at?: string;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface MemoryProfileSnapshot {
  memories: Memory[];
  sessions: Session[];
  hotwords: string[];
  hotword_profiles: HotwordProfileRecord[];
  growth_profile: MemoryGrowthProfileSnapshot;
  synced_at: string;
}

export interface ProfileBundleItem {
  id: string;
  title: string;
  content: string;
  source: 'user_profile' | 'hotword_profile' | 'growth_profile' | 'memory' | 'session';
  emphasis: 'high' | 'medium' | 'low';
  tags?: string[];
  updated_at?: string;
}

export interface ProfileBundleSnapshot {
  static: ProfileBundleItem[];
  dynamic: ProfileBundleItem[];
  relevant: ProfileBundleItem[];
}

export interface SessionReviewSnapshot {
  session_id: string | null;
  headline: string;
  summary: string;
  focus: string[];
  recent_win: string | null;
  next_step: string | null;
  updated_at: string;
}

export interface ExpressionKitSuggestion {
  id: string;
  text: string;
  source: 'quick_phrase' | 'hotword_profile' | 'frequent_expression';
  category: string;
  note?: string;
  priority: number;
}

export interface WorkspaceMemorySnapshot {
  profile_bundle: ProfileBundleSnapshot;
  session_review: SessionReviewSnapshot;
  preparation: {
    active_scene_id: WorkspaceSceneId | null;
    profile_summary: string;
    overview: string;
    immediate_goal: string | null;
    scene_brief: string | null;
    common_scenarios: string[];
    strong_phrases: string[];
    risky_terms: string[];
    pronunciation_patterns: string[];
    listener_guidance: string[];
    support_strategies: string[];
    hotwords: string[];
    asr_hotword_entries: PreparedExpressionAsrHotwordEntry[];
    document_context_summary: string | null;
    document_content: string | null;
    reference_lines: string[];
    training_pairs: PreparedExpressionCorrectionPair[];
    next_step: string | null;
    updated_at: string;
  };
  prepared_expression: {
    id: string;
    title: string;
    summary: string;
    scene: string | null;
    source: string;
    document_content: string;
    last_rehearsed_at: string | null;
    rehearsal_count: number;
    low_confidence_sections: number;
    hotwords: string[];
    high_risk_phrases: string[];
    fallback_phrases: string[];
    asr_hotword_entries: PreparedExpressionAsrHotwordEntry[];
    reference_lines: string[];
    training_pairs: PreparedExpressionCorrectionPair[];
    next_focus: string[];
    rehearsal_summary: {
      summary: string;
      hotwords: string[];
      recurring_errors: string[];
      pronunciation_patterns: string[];
      support_strategies: string[];
      next_focus: string[];
      reference_lines: string[];
      training_pairs: PreparedExpressionCorrectionPair[];
      based_on_training_count: number;
      model: string;
      updated_at: string;
    } | null;
    sections: Array<{
      id: string;
      title: string;
      summary: string;
      anchor_line: string;
      practice_lines: string[];
      high_risk_phrases: string[];
      fallback_phrases: string[];
      hotwords: string[];
      rehearsal_count: number;
      low_confidence_count: number;
      latest_feedback_status: FeedbackStatus | null;
      last_rehearsed_at: string | null;
      is_priority: boolean;
    }>;
    updated_at: string;
  } | null;
  expression_kit: {
    active_scene_id: WorkspaceSceneId | null;
    personalized_phrases: ExpressionKitSuggestion[];
    quick_phrases: QuickPhrase[];
    hotword_profiles: HotwordProfileRecord[];
    recommended_focus: string[];
    communication_preferences: CommunicationPreferences;
  };
  synced_at: string;
}

export interface CommunicationPreferences {
  opening_phrase?: string;
  pace_hint?: string;
  repair_phrase?: string;
}

export type HotwordCategory =
  | 'medical'
  | 'profession'
  | 'family'
  | 'daily'
  | 'emergency'
  | 'custom';

export interface HotwordProfileRecord {
  id: string;
  phrase: string;
  category: HotwordCategory;
  scenario: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type PhraseCategory =
  | 'greeting'
  | 'need'
  | 'emotion'
  | 'medical'
  | 'shopping'
  | 'dining'
  | 'transport'
  | 'custom';

export function normalizeCommunicationPreferences(value: unknown): CommunicationPreferences {
  if (!isRecord(value)) {
    return {};
  }

  return {
    opening_phrase: readString(value, 'opening_phrase') ?? undefined,
    pace_hint: readString(value, 'pace_hint') ?? undefined,
    repair_phrase: readString(value, 'repair_phrase') ?? undefined,
  };
}

function dedupeStrings(values: string[], limit?: number): string[] {
  const unique = Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );

  return typeof limit === 'number' ? unique.slice(0, limit) : unique;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function readFirstLabel(values: unknown): string | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const first = values[0];
  if (!isRecord(first)) {
    return null;
  }

  return readString(first, 'label');
}

function sortPhrasesForSuggestions(phrases: QuickPhrase[]): QuickPhrase[] {
  return [...phrases].sort((left, right) => {
    if (right.usage_count !== left.usage_count) {
      return right.usage_count - left.usage_count;
    }

    return left.order_index - right.order_index;
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: JsonRecord | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(record: JsonRecord | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeHotwordCategory(value: unknown): HotwordCategory {
  if (
    value === 'medical' ||
    value === 'profession' ||
    value === 'family' ||
    value === 'daily' ||
    value === 'emergency'
  ) {
    return value;
  }

  return 'custom';
}

function normalizeHotwordProfiles(value: unknown): HotwordProfileRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const profiles: HotwordProfileRecord[] = [];

  value.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const phrase = readString(item, 'phrase');
    if (!phrase) {
      return;
    }

    const createdAt = readNumber(item, 'createdAt') ?? Date.now();
    const updatedAt = readNumber(item, 'updatedAt') ?? createdAt;

    profiles.push({
      id: readString(item, 'id') ?? `${phrase}_${createdAt}`,
      phrase,
      category: normalizeHotwordCategory(readString(item, 'category')),
      scenario: readString(item, 'scenario') ?? '',
      note: readString(item, 'note') ?? undefined,
      createdAt,
      updatedAt,
    });
  });

  return profiles.sort((left, right) => right.updatedAt - left.updatedAt);
}

export class SupabaseService {
  private client: SupabaseClient;
  private adminClient: SupabaseClient; // service_role client for system operations
  private static instance: SupabaseService;
  private readonly preparedExpressionSummaryService = new PreparedExpressionSummaryService();

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
    }

    this.client = createClient(supabaseUrl, supabaseAnonKey);

    // Create admin client with service_role key (bypasses RLS)
    if (supabaseServiceRoleKey) {
      this.adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set, some admin operations may fail');
      this.adminClient = this.client; // Fallback to anon key
    }
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // === User Profiles ===
  async ensureUserProfile(userId: string): Promise<boolean> {
    const { error } = await this.adminClient
      .from('user_profiles')
      .upsert(
        {
          id: userId,
        },
        { onConflict: 'id' },
      );

    if (error) {
      console.error('Error ensuring user profile:', error);
      return false;
    }

    return true;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data;
  }

  async createUserProfile(profile: UserProfile): Promise<UserProfile | null> {
    const { data, error } = await this.adminClient
      .from('user_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
    return data;
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await this.adminClient
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
    return data;
  }

  async getHotwordProfiles(userId: string): Promise<HotwordProfileRecord[]> {
    const userProfile = await this.getUserProfile(userId);
    const preferences = isRecord(userProfile?.preferences) ? userProfile?.preferences : undefined;
    return normalizeHotwordProfiles(preferences?.hotword_profiles);
  }

  async saveHotwordProfiles(
    userId: string,
    profiles: HotwordProfileRecord[],
  ): Promise<HotwordProfileRecord[]> {
    await this.ensureUserProfile(userId);

    const normalizedProfiles = normalizeHotwordProfiles(profiles);
    const userProfile = await this.getUserProfile(userId);
    const existingPreferences = isRecord(userProfile?.preferences)
      ? userProfile?.preferences
      : {};
    const nextPreferences: JsonRecord = {
      ...existingPreferences,
      hotword_profiles: normalizedProfiles,
    };
    const nextHotwords = Array.from(
      new Set(normalizedProfiles.map((profile) => profile.phrase)),
    ).slice(0, 20);

    const updated = await this.updateUserProfile(userId, {
      preferences: nextPreferences,
      hotwords: nextHotwords,
    });

    if (!updated) {
      return [];
    }

    return normalizeHotwordProfiles(
      isRecord(updated.preferences) ? updated.preferences.hotword_profiles : [],
    );
  }

  async saveCommunicationPreferences(
    userId: string,
    preferences: CommunicationPreferences,
  ): Promise<CommunicationPreferences> {
    await this.ensureUserProfile(userId);

    const normalizedPreferences = normalizeCommunicationPreferences(preferences);
    const userProfile = await this.getUserProfile(userId);
    const existingPreferences = isRecord(userProfile?.preferences)
      ? userProfile.preferences
      : {};
    const nextPreferences: JsonRecord = {
      ...existingPreferences,
      communication_preferences: normalizedPreferences,
    };

    const updated = await this.updateUserProfile(userId, {
      preferences: nextPreferences,
    });

    if (!updated) {
      return {};
    }

    return normalizeCommunicationPreferences(
      isRecord(updated.preferences) ? updated.preferences.communication_preferences : undefined,
    );
  }

  async getPreparedExpressionAsset(userId: string): Promise<PreparedExpressionAsset | null> {
    const userProfile = await this.getUserProfile(userId);
    return this.readPreparedExpressionAssetFromProfile(userProfile);
  }

  async savePreparedExpressionAsset(
    userId: string,
    input: {
      title?: string | null;
      scene?: string | null;
      source?: string | null;
      content: string;
    },
  ): Promise<PreparedExpressionAsset | null> {
    await this.ensureUserProfile(userId);

    const userProfile = await this.getUserProfile(userId);
    const existingPreferences = isRecord(userProfile?.preferences)
      ? userProfile.preferences
      : {};
    const existingAsset = this.readPreparedExpressionAssetFromProfile(userProfile);
    const nextAsset = createPreparedExpressionAssetFromDraft({
      id: existingAsset?.draft.id ?? null,
      title: input.title ?? existingAsset?.draft.title ?? null,
      scene: input.scene ?? existingAsset?.draft.scene ?? null,
      source: input.source ?? existingAsset?.draft.source ?? null,
      content: input.content,
      updatedAt: new Date().toISOString(),
    });

    const nextPreferences: JsonRecord = {
      ...existingPreferences,
      prepared_expression_asset: nextAsset,
    };

    const updated = await this.updateUserProfile(userId, {
      preferences: nextPreferences,
      hotwords: dedupeStrings(
        [
          ...(userProfile?.hotwords ?? []),
          ...nextAsset.structured.hotwords,
        ],
        20,
      ),
    });

    if (!updated) {
      return null;
    }

    return this.readPreparedExpressionAssetFromProfile(updated);
  }

  async summarizePreparedExpressionAsset(
    userId: string,
    trigger: PreparedExpressionSummaryTrigger = 'manual',
  ): Promise<PreparedExpressionAsset | null> {
    await this.ensureUserProfile(userId);

    const userProfile = await this.getUserProfile(userId);
    const existingPreferences = isRecord(userProfile?.preferences)
      ? userProfile.preferences
      : {};
    const existingAsset = this.readPreparedExpressionAssetFromProfile(userProfile);
    if (!existingAsset) {
      return null;
    }
    const samples = await this.getPreparedExpressionTrainingSamples(
      userId,
      existingAsset.structured.id,
    );
    const summarized = await this.preparedExpressionSummaryService.summarize(
      existingAsset,
      samples,
      trigger,
    );

    const nextPreferences: JsonRecord = {
      ...existingPreferences,
      prepared_expression_asset: summarized,
    };

    const updated = await this.updateUserProfile(userId, {
      preferences: nextPreferences,
      hotwords: dedupeStrings(
        [
          ...(userProfile?.hotwords ?? []),
          ...summarized.structured.hotwords,
          ...(summarized.rehearsal_summary?.hotwords ?? []),
        ],
        20,
      ),
    });

    if (!updated) {
      return null;
    }

    return this.readPreparedExpressionAssetFromProfile(updated);
  }

  // === Sessions ===
  async ensureSession(session: Session): Promise<Session | null> {
    await this.ensureUserProfile(session.user_id);

    const { data, error } = await this.adminClient
      .from('sessions')
      .upsert(
        {
          ...session,
          metadata: session.metadata || {},
        },
        { onConflict: 'id' },
      )
      .select()
      .single();

    if (error) {
      console.error('Error ensuring session:', error);
      return null;
    }
    return data;
  }

  async createSession(session: Session): Promise<Session | null> {
    const { data, error } = await this.adminClient
      .from('sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return null;
    }
    return data;
  }

  async endSession(sessionId: string, endTime: string, transcript?: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const duration = Math.floor((new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 1000);

    const { data, error } = await this.adminClient
      .from('sessions')
      .update({ end_time: endTime, duration, transcript })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error ending session:', error);
      return null;
    }
    return data;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.adminClient
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }
    return data;
  }

  async getUserSessions(userId: string, limit: number = 10): Promise<Session[]> {
    const { data, error } = await this.adminClient
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user sessions:', error);
      return [];
    }
    return data || [];
  }

  // === Memories ===
  async addMemory(memory: Memory): Promise<Memory | null> {
    await this.ensureUserProfile(memory.user_id);

    const { data, error } = await this.adminClient
      .from('memories')
      .insert(memory)
      .select()
      .single();

    if (error) {
      console.error('Error adding memory:', error);
      return null;
    }
    return data;
  }

  async getMemories(userId: string, limit: number = 50): Promise<Memory[]> {
    const { data, error } = await this.adminClient
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching memories:', error);
      return [];
    }
    return data || [];
  }

  async searchMemories(userId: string, query: string, limit: number = 10): Promise<Memory[]> {
    // TODO: Implement semantic search with pgvector
    // For now, simple text search
    const { data, error } = await this.adminClient
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .textSearch('content', query)
      .limit(limit);

    if (error) {
      console.error('Error searching memories:', error);
      return [];
    }
    return data || [];
  }

  async getMemoryById(memoryId: string): Promise<Memory | null> {
    const { data, error } = await this.adminClient
      .from('memories')
      .select('*')
      .eq('id', memoryId)
      .single();

    if (error) {
      console.error('Error fetching memory by ID:', error);
      return null;
    }
    return data;
  }

  async updateMemory(memoryId: string, updates: Partial<Memory>): Promise<Memory | null> {
    const { data, error } = await this.adminClient
      .from('memories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating memory:', error);
      return null;
    }
    return data;
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    const { error } = await this.adminClient
      .from('memories')
      .delete()
      .eq('id', memoryId);

    if (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
    return true;
  }

  async getUserMemoryProfile(
    userId: string,
    memoryLimit: number = 400,
    sessionLimit: number = 120,
  ): Promise<MemoryProfileSnapshot> {
    const [memories, sessions, userProfile, hotwordProfiles] = await Promise.all([
      this.getMemories(userId, memoryLimit),
      this.getUserSessions(userId, sessionLimit),
      this.getUserProfile(userId),
      this.getHotwordProfiles(userId),
    ]);
    const collectedHotwords = this.collectHotwords(memories, sessions);
    const profileHotwords = Array.isArray(userProfile?.hotwords)
      ? userProfile.hotwords.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const hotwords = Array.from(
      new Set([
        ...hotwordProfiles.map((profile) => profile.phrase),
        ...profileHotwords,
        ...collectedHotwords,
      ]),
    ).slice(0, 20);

    return {
      memories,
      sessions,
      hotwords,
      hotword_profiles: hotwordProfiles,
      growth_profile: buildMemoryGrowthProfileSnapshot({
        memories,
        sessions,
        hotwords,
      }),
      synced_at: new Date().toISOString(),
    };
  }

  private readPreparedExpressionAssetFromProfile(
    userProfile: UserProfile | null,
  ): PreparedExpressionAsset | null {
    const preferences = isRecord(userProfile?.preferences) ? userProfile.preferences : undefined;
    return normalizePreparedExpressionAsset(preferences?.prepared_expression_asset);
  }

  private async getPreparedExpressionTrainingSamples(
    userId: string,
    preparedExpressionId: string,
  ): Promise<PreparedExpressionTrainingSample[]> {
    const memories = await this.getMemories(userId, 240);

    return memories
      .filter((memory) => {
        const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
        return (
          readString(metadata, 'kind') === 'training_result' &&
          readString(metadata, 'prepared_expression_id') === preparedExpressionId
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.created_at ?? 0).getTime();
        const rightTime = new Date(right.created_at ?? 0).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 80)
      .map((memory) => {
        const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;

        return {
          created_at: memory.created_at ?? null,
          target_text: readString(metadata, 'target_text') ?? readString(metadata, 'exercise_text') ?? '',
          recognized_text: readString(metadata, 'recognized_text') ?? readString(metadata, 'raw_transcript') ?? '',
          feedback_status: readString(metadata, 'feedback_status'),
          prepared_expression_section_id: readString(metadata, 'prepared_expression_section_id'),
          prepared_expression_section_title: readString(metadata, 'prepared_expression_section_title'),
          high_risk_phrases: readStringList(metadata?.high_risk_phrases),
          hotwords: dedupeStrings(
            [
              ...readStringList(metadata?.hotwords),
              ...readStringList(metadata?.keywords),
            ],
            8,
          ),
          speech_patterns: readStringList(metadata?.speech_patterns),
          articulation_tips: readStringList(metadata?.articulation_tips),
          pronunciation_summary: readString(metadata, 'pronunciation_summary'),
        };
      });
  }

  async getWorkspaceMemorySnapshot(
    userId: string,
    options: { sceneId?: WorkspaceSceneId } = {},
  ): Promise<WorkspaceMemorySnapshot> {
    const [profileSnapshot, userProfile, quickPhrases] = await Promise.all([
      this.getUserMemoryProfile(userId, 400, 120),
      this.getUserProfile(userId),
      this.getUserPhrases(userId, undefined, 40),
    ]);

    const syncedAt = new Date().toISOString();
    const preparedExpression = this.buildPreparedExpressionSnapshot(profileSnapshot, userProfile, syncedAt);

    return {
      profile_bundle: this.buildProfileBundle(profileSnapshot, userProfile),
      session_review: this.buildSessionReview(profileSnapshot, syncedAt),
      preparation: this.buildPreparationSnapshot(
        profileSnapshot,
        userProfile,
        options.sceneId,
        syncedAt,
        preparedExpression,
      ),
      prepared_expression: preparedExpression,
      expression_kit: this.buildExpressionKit(
        profileSnapshot,
        quickPhrases,
        userProfile,
        options.sceneId,
      ),
      synced_at: syncedAt,
    };
  }

  private collectHotwords(memories: Memory[], sessions: Session[]): string[] {
    const wordFreq: Record<string, number> = {};

    const addWord = (word: string) => {
      if (!word || word.length < 2 || word.length > 8) {
        return;
      }
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    };

    memories.forEach((memory) => {
      const metadata = memory.metadata;
      const keywords = Array.isArray(metadata?.keywords) ? metadata?.keywords : [];
      keywords.forEach((keyword) => {
        if (typeof keyword === 'string') {
          addWord(keyword.trim());
        }
      });

      const tokens = memory.content.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
      tokens.forEach(addWord);
    });

    sessions.forEach((session) => {
      if (!session.transcript) {
        return;
      }

      const tokens = session.transcript.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
      tokens.forEach(addWord);
    });

    return Object.entries(wordFreq)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 20)
      .map(([word]) => word);
  }

  private buildProfileBundle(
    snapshot: MemoryProfileSnapshot,
    userProfile: UserProfile | null,
  ): ProfileBundleSnapshot {
    const staticItems: ProfileBundleItem[] = [];
    const dynamicItems: ProfileBundleItem[] = [];
    const relevantItems: ProfileBundleItem[] = [];
    const growthProfile = snapshot.growth_profile;
    const nowIso = new Date().toISOString();
    const preferences = isRecord(userProfile?.preferences) ? userProfile.preferences : undefined;
    const communicationPreferences = normalizeCommunicationPreferences(
      preferences?.communication_preferences,
    );

    if (userProfile?.condition) {
      staticItems.push({
        id: 'condition',
        title: '沟通背景',
        content: userProfile.condition,
        source: 'user_profile',
        emphasis: 'high',
        updated_at: userProfile.updated_at ?? nowIso,
      });
    }

    if (snapshot.hotwords.length > 0) {
      staticItems.push({
        id: 'hotwords',
        title: '关键热词',
        content: snapshot.hotwords.slice(0, 8).join('、'),
        source: 'user_profile',
        emphasis: 'high',
        tags: snapshot.hotwords.slice(0, 8),
        updated_at: nowIso,
      });
    }

    if (communicationPreferences.opening_phrase) {
      staticItems.push({
        id: 'opening-phrase',
        title: '我的开场白',
        content: communicationPreferences.opening_phrase,
        source: 'user_profile',
        emphasis: 'high',
        updated_at: userProfile?.updated_at ?? nowIso,
      });
    }

    if (communicationPreferences.pace_hint) {
      staticItems.push({
        id: 'pace-hint',
        title: '我希望别人这样配合',
        content: communicationPreferences.pace_hint,
        source: 'user_profile',
        emphasis: 'medium',
        updated_at: userProfile?.updated_at ?? nowIso,
      });
    }

    if (growthProfile.nextStep) {
      dynamicItems.push({
        id: 'next-step',
        title: '当前最值得继续做的事',
        content: growthProfile.nextStep,
        source: 'growth_profile',
        emphasis: 'high',
        updated_at: nowIso,
      });
    }

    if (growthProfile.frequentFocus.length > 0) {
      dynamicItems.push({
        id: 'frequent-focus',
        title: '近期重点',
        content: growthProfile.frequentFocus.slice(0, 4).map((item) => item.label).join('、'),
        source: 'growth_profile',
        emphasis: 'medium',
        tags: growthProfile.frequentFocus.slice(0, 4).map((item) => item.label),
        updated_at: nowIso,
      });
    }

    if (growthProfile.articulationTips.length > 0) {
      dynamicItems.push({
        id: 'articulation-tip',
        title: '当前动作提醒',
        content: growthProfile.articulationTips[0].label,
        source: 'growth_profile',
        emphasis: 'high',
        tags: growthProfile.articulationTips.slice(0, 3).map((item) => item.label),
        updated_at: nowIso,
      });
    }

    if (growthProfile.frequentConfusions.length > 0) {
      dynamicItems.push({
        id: 'confusion-spotlight',
        title: '当前最容易卡住的点',
        content: growthProfile.frequentConfusions[0].label,
        source: 'growth_profile',
        emphasis: 'medium',
        tags: growthProfile.frequentConfusions.slice(0, 4).map((item) => item.label),
        updated_at: nowIso,
      });
    }

    if (growthProfile.frequentExpressions.length > 0) {
      dynamicItems.push({
        id: 'frequent-expressions',
        title: '近期常用表达',
        content: growthProfile.frequentExpressions.slice(0, 4).map((item) => item.label).join('、'),
        source: 'growth_profile',
        emphasis: 'medium',
        tags: growthProfile.frequentExpressions.slice(0, 4).map((item) => item.label),
        updated_at: nowIso,
      });
    }

    snapshot.hotword_profiles.slice(0, 4).forEach((profile) => {
      relevantItems.push({
        id: `hotword-${profile.id}`,
        title: profile.phrase,
        content: profile.note || profile.scenario || '已进入个体表达画像',
        source: 'hotword_profile',
        emphasis: 'medium',
        tags: dedupeStrings([profile.category, profile.scenario], 3),
        updated_at: new Date(profile.updatedAt).toISOString(),
      });
    });

    growthProfile.recentTraining.slice(0, 2).forEach((memory) => {
      const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
      const nextStep = readString(metadata, 'next_step');
      const pronunciationSummary =
        readString(metadata, 'pronunciation_summary') ??
        readString(metadata, 'last_pronunciation_summary');

      relevantItems.push({
        id: `memory-${memory.id}`,
        title: '最近训练复盘',
        content: nextStep || pronunciationSummary || memory.content,
        source: 'memory',
        emphasis: 'low',
        tags: dedupeStrings([
          ...readStringList(metadata?.speech_patterns),
          ...readStringList(metadata?.pronunciation_targets),
          ...readStringList(metadata?.articulation_tips),
        ], 4),
        updated_at: new Date(memory.updatedAt).toISOString(),
      });
    });

    return {
      static: staticItems,
      dynamic: dynamicItems,
      relevant: relevantItems,
    };
  }

  private buildSessionReview(
    snapshot: MemoryProfileSnapshot,
    syncedAt: string,
  ): SessionReviewSnapshot {
    const latestSession = snapshot.growth_profile.recentSessions[0];
    const latestTrainingMemory = snapshot.growth_profile.recentTraining[0];
    const latestTrainingMetadata = isRecord(latestTrainingMemory?.metadata)
      ? latestTrainingMemory.metadata
      : undefined;
    const focusSpotlight =
      readFirstLabel(latestTrainingMetadata?.frequent_focus) ??
      readFirstLabel(latestTrainingMetadata?.speech_patterns) ??
      snapshot.growth_profile.frequentFocus[0]?.label ??
      snapshot.growth_profile.frequentSpeechPatterns[0]?.label ??
      null;
    const articulationSpotlight =
      readFirstLabel(latestTrainingMetadata?.articulation_tips) ??
      snapshot.growth_profile.articulationTips[0]?.label ??
      null;
    const recentWin =
      snapshot.growth_profile.stats.improvementDirection === 'improving'
        ? `最近 7 次训练清晰度已经回升到 ${formatPercent(snapshot.growth_profile.stats.rollingClarityAverage)}`
        : articulationSpotlight ??
          snapshot.growth_profile.frequentExpressions[0]?.label ??
          null;
    const trainingSummary =
      readString(latestTrainingMetadata, 'last_pronunciation_summary') ??
      readString(latestTrainingMetadata, 'pronunciation_summary') ??
      latestTrainingMemory?.content ??
      null;
    const trainingUploads =
      readNumber(latestTrainingMetadata, 'total_training_uploads') ??
      snapshot.growth_profile.stats.totalTrainingAttempts;

    if (!latestSession) {
      return {
        session_id: null,
        headline: trainingSummary ? '最近一次训练复盘' : '还没有稳定的会话复盘',
        summary: trainingSummary
          ? `${trainingSummary} 现在已经累计 ${trainingUploads} 条训练记录，近 7 次平均清晰度 ${formatPercent(snapshot.growth_profile.stats.rollingClarityAverage)}。`
          : '先用 starter kit 和表达工具箱把第一句话说出去，系统会逐步积累你的个体表达画像。',
        focus: dedupeStrings([
          ...(focusSpotlight ? [focusSpotlight] : []),
          ...snapshot.growth_profile.frequentFocus.slice(0, 3).map((item) => item.label),
          ...snapshot.growth_profile.frequentSpeechPatterns.slice(0, 2).map((item) => item.label),
        ], 4),
        recent_win: recentWin,
        next_step: snapshot.growth_profile.nextStep || null,
        updated_at: syncedAt,
      };
    }

    const focus = dedupeStrings(
      [
        ...latestSession.topFocusTags,
        ...latestSession.topSpeechPatterns,
        ...snapshot.growth_profile.frequentFocus.slice(0, 2).map((item) => item.label),
      ],
      4,
    );

    return {
      session_id: latestSession.id,
      headline:
        latestSession.kind === 'training'
          ? '最近一次训练复盘'
          : '最近一次沟通复盘',
      summary:
        latestSession.kind === 'training' && trainingSummary
          ? `${trainingSummary} 这次训练共 ${latestSession.turnCount} 轮，持续 ${latestSession.durationSeconds} 秒，平均清晰度 ${formatPercent(latestSession.avgClarityScore)}。`
          : `最近一次 ${latestSession.kind} 会话共 ${latestSession.turnCount} 轮，持续 ${latestSession.durationSeconds} 秒，平均清晰度 ${formatPercent(latestSession.avgClarityScore)}。`,
      focus,
      recent_win: recentWin,
      next_step: snapshot.growth_profile.nextStep || null,
      updated_at: syncedAt,
    };
  }

  private buildPreparationSnapshot(
    snapshot: MemoryProfileSnapshot,
    userProfile: UserProfile | null,
    sceneId: WorkspaceSceneId | undefined,
    syncedAt: string,
    preparedExpression: WorkspaceMemorySnapshot['prepared_expression'],
  ): WorkspaceMemorySnapshot['preparation'] {
    const growthProfile = snapshot.growth_profile;
    const latestTrainingMemory = growthProfile.recentTraining[0];
    const latestTrainingMetadata = isRecord(latestTrainingMemory?.metadata)
      ? latestTrainingMemory.metadata
      : undefined;
    const preferences = isRecord(userProfile?.preferences) ? userProfile.preferences : undefined;
    const communicationPreferences = normalizeCommunicationPreferences(
      preferences?.communication_preferences,
    );
    const sceneBrief = sceneId
      ? ({
          interview: '这次重点是先稳住开场、节奏和结论，不求华丽，先求完整说完。',
          workplace: '这次重点是先交代关键信息，再进入细节，避免一开始就陷进长解释。',
          stranger: '这次重点是先说明自己的状态，再快速提出需求或问题。',
          medical: '这次重点是先把症状、持续时间和你最需要的帮助讲清楚。',
          caregiver: '这次重点是先说需求和节奏，避免家人或照护者替你抢答。',
          emergency: '这次重点是先把求助、位置和风险说清楚。',
        } satisfies Record<WorkspaceSceneId, string>)[sceneId]
      : null;
    const immediateGoal =
      preparedExpression?.next_focus[0] ||
      growthProfile.nextStep ||
      readString(latestTrainingMetadata, 'next_step') ||
      communicationPreferences.opening_phrase ||
      null;
    const rehearsalSummary = preparedExpression?.rehearsal_summary;
    const supportStrategies = dedupeStrings(
      [
        preparedExpression?.fallback_phrases[0]
          ? `保底句先准备好：${preparedExpression.fallback_phrases[0]}`
          : '',
        ...(rehearsalSummary?.support_strategies ?? []),
        communicationPreferences.opening_phrase
          ? `先用固定开场白把节奏稳住：${communicationPreferences.opening_phrase}`
          : '',
        communicationPreferences.pace_hint
          ? `提前告诉对方如何配合你：${communicationPreferences.pace_hint}`
          : '',
        communicationPreferences.repair_phrase
          ? `没听清时优先用补救句：${communicationPreferences.repair_phrase}`
          : '',
        growthProfile.articulationTips[0]?.label
          ? `动作提醒：${growthProfile.articulationTips[0].label}`
          : '',
      ],
      4,
    );
    const listenerGuidance = dedupeStrings(
      [
        preparedExpression?.summary
          ? `这次重要表达的结构已经压缩好，先按段落和锚点往前走。`
          : '',
        communicationPreferences.pace_hint
          ? `希望对方这样配合：${communicationPreferences.pace_hint}`
          : '',
        communicationPreferences.repair_phrase
          ? `没听清时优先这样补救：${communicationPreferences.repair_phrase}`
          : '',
        growthProfile.articulationTips[0]?.label
          ? `当前最有效的动作提醒：${growthProfile.articulationTips[0].label}`
          : '',
      ],
      3,
    );
    const strongPhrases = dedupeStrings(
      [
        ...(preparedExpression?.fallback_phrases ?? []),
        ...growthProfile.frequentExpressions.slice(0, 4).map((item) => item.label),
        ...snapshot.memories
          .filter((memory) => {
            const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
            return readString(metadata, 'kind') === 'training_result';
          })
          .slice(0, 2)
          .map((memory) => memory.content),
      ],
      6,
    );
    const commonScenarios = dedupeStrings(
      [
        ...snapshot.hotword_profiles
          .map((profile) => profile.scenario)
          .filter((value) => value.trim().length > 0),
        ...(preparedExpression?.scene ? [preparedExpression.scene] : []),
        ...(sceneId ? [sceneId] : []),
      ],
      6,
    );
    const riskyTerms = dedupeStrings(
      [
        ...(preparedExpression?.high_risk_phrases ?? []),
        ...(rehearsalSummary?.recurring_errors ?? []),
        ...growthProfile.frequentConfusions.slice(0, 4).map((item) => item.label),
      ],
      6,
    );
    const pronunciationPatterns = dedupeStrings(
      [
        ...(rehearsalSummary?.pronunciation_patterns ?? []),
        ...growthProfile.frequentFocus.slice(0, 3).map((item) => item.label),
        ...growthProfile.frequentSpeechPatterns.slice(0, 4).map((item) => item.label),
        ...growthProfile.articulationTips.slice(0, 2).map((item) => item.label),
      ],
      6,
    );
    const hotwords = dedupeStrings(
      [
        ...(preparedExpression?.hotwords ?? []),
        ...(rehearsalSummary?.hotwords ?? []),
        ...snapshot.hotword_profiles.slice(0, 6).map((profile) => profile.phrase),
        ...snapshot.hotwords.slice(0, 6),
      ],
      8,
    );
    const profileSummary = (() => {
      const focus = growthProfile.frequentFocus[0]?.label ?? growthProfile.frequentSpeechPatterns[0]?.label;
      const confusion = growthProfile.frequentConfusions[0]?.label;
      const trainingVolume = growthProfile.stats.totalTrainingAttempts;
      const clarity = growthProfile.stats.rollingClarityAverage;

      if (focus && confusion) {
        return `你现在已经有比较稳定的个人表达规律：常见重点会落在“${focus}”，系统最容易听偏的是“${confusion}”。${
          trainingVolume > 0
            ? ` 目前累计 ${trainingVolume} 条训练记录，近 7 次平均清晰度 ${formatPercent(clarity)}。`
            : ''
        }`;
      }

      if (communicationPreferences.opening_phrase || communicationPreferences.pace_hint) {
        return '你已经开始形成自己的沟通方式：先用固定开场白稳住节奏，再告诉对方怎样配合你，这会比临场硬撑更有效。';
      }

      if (preparedExpression) {
        return `你已经为“${preparedExpression.title}”建立了一层结构化准备：重点原句、训练错配对和保底句会继续从 rehearsal 中收紧。`;
      }

      return '这里会逐步压缩出你的个人表达画像：你最常面对什么场景、系统最容易听偏什么、什么表达和补救方式最适合你。';
    })();
    const overview = preparedExpression
      ? `当前已经围绕“${preparedExpression.title}”压出一层重要表达准备。${immediateGoal ? ` 现在最该先准备的是：${immediateGoal}` : ''}`
      : sceneBrief
        ? `${sceneBrief}${immediateGoal ? ` 当前最该先准备的是：${immediateGoal}` : ''}`
        : immediateGoal
          ? `当前最该先准备的是：${immediateGoal}`
          : '先固定一条开场白、一句补救句和 3 句最关键原句，现场会稳很多。';

    return {
      active_scene_id: sceneId ?? null,
      profile_summary: profileSummary,
      overview,
      immediate_goal: immediateGoal,
      scene_brief: sceneBrief,
      common_scenarios: commonScenarios,
      strong_phrases: strongPhrases,
      risky_terms: riskyTerms,
      pronunciation_patterns: pronunciationPatterns,
      listener_guidance: listenerGuidance,
      support_strategies: supportStrategies,
      hotwords,
      asr_hotword_entries: preparedExpression?.asr_hotword_entries ?? [],
      document_context_summary: preparedExpression?.summary ?? null,
      document_content: preparedExpression?.document_content ?? null,
      reference_lines: preparedExpression?.reference_lines ?? [],
      training_pairs: preparedExpression?.training_pairs ?? [],
      next_step: growthProfile.nextStep ?? null,
      updated_at: syncedAt,
    };
  }

  private buildPreparedExpressionSnapshot(
    snapshot: MemoryProfileSnapshot,
    userProfile: UserProfile | null,
    syncedAt: string,
  ): WorkspaceMemorySnapshot['prepared_expression'] {
    const asset = this.readPreparedExpressionAssetFromProfile(userProfile);
    if (!asset) {
      return null;
    }
    const template = asset.structured;
    const preparedTrainingMemories = snapshot.memories
      .filter((memory) => {
        const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
        return (
          readString(metadata, 'kind') === 'training_result' &&
          readString(metadata, 'prepared_expression_id') === template.id
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.created_at ?? 0).getTime();
        const rightTime = new Date(right.created_at ?? 0).getTime();
        return rightTime - leftTime;
      });

    const sectionStats = template.sections.map((section) => {
      const sectionMemories = preparedTrainingMemories.filter((memory) => {
        const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
        return readString(metadata, 'prepared_expression_section_id') === section.id;
      });
      const latestMemory = sectionMemories[0];
      const latestMetadata = isRecord(latestMemory?.metadata) ? latestMemory.metadata : undefined;
      const latestStatus = this.normalizePreparedExpressionStatus(
        readString(latestMetadata, 'feedback_status'),
      );
      const lowConfidenceCount = sectionMemories.filter((memory) => {
        const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
        return this.normalizePreparedExpressionStatus(
          readString(metadata, 'feedback_status'),
        ) !== 'excellent';
      }).length;
      const rehearsalCount = sectionMemories.length;
      const lastRehearsedAt = latestMemory?.created_at ?? null;

      return {
        id: section.id,
        title: section.title,
        summary: section.summary,
        anchor_line: section.anchorLine,
        practice_lines: section.practiceLines,
        high_risk_phrases: section.highRiskPhrases,
        fallback_phrases: section.fallbackPhrases,
        hotwords: section.hotwords,
        rehearsal_count: rehearsalCount,
        low_confidence_count: lowConfidenceCount,
        latest_feedback_status: latestStatus,
        last_rehearsed_at: lastRehearsedAt,
        priority_score:
          (rehearsalCount === 0 ? 80 : 0) +
          lowConfidenceCount * 20 +
          section.basePriority * 5 +
          (latestStatus === 'retry' ? 15 : latestStatus === 'close' ? 8 : 0),
      };
    });

    const prioritySectionIds = new Set(
      [...sectionStats]
        .sort((left, right) => right.priority_score - left.priority_score)
        .slice(0, 3)
        .map((section) => section.id),
    );

    const sections = sectionStats.map(({ priority_score: _priorityScore, ...section }) => ({
      ...section,
      is_priority: prioritySectionIds.has(section.id),
    }));

    const lastRehearsedAt = preparedTrainingMemories[0]?.created_at ?? null;
    const rehearsedSectionCount = sections.filter((section) => section.rehearsal_count > 0).length;
    const nextFocus = dedupeStrings(
      [
        ...(asset.rehearsal_summary?.nextFocus ?? []),
        ...sections
          .filter((section) => section.is_priority)
          .flatMap((section) => [
            section.title,
            section.high_risk_phrases[0] ?? '',
            section.fallback_phrases[0] ?? '',
          ]),
      ],
      5,
    );
    const summary = asset.rehearsal_summary?.summary
      ? asset.rehearsal_summary.summary
      : lastRehearsedAt
        ? `“${template.title}”已经练过 ${preparedTrainingMemories.length} 次，当前覆盖 ${rehearsedSectionCount}/${sections.length} 个结构段落。优先继续收口：${nextFocus[0] ?? sections[0]?.title ?? '开场段落'}。`
        : template.summary;
    const referenceLines = dedupeStrings(
      [
        ...(asset.rehearsal_summary?.referenceLines ?? []),
        ...buildPreparedExpressionReferenceLines(template, {
          maxLines: 80,
          maxChars: 4000,
        }),
      ],
      80,
    );
    const trainingPairs = buildPreparedExpressionCorrectionPairs(
      preparedTrainingMemories.map((memory) => {
        const metadata = isRecord(memory.metadata) ? memory.metadata : undefined;
        return {
          target: readString(metadata, 'target_text'),
          heard: readString(metadata, 'recognized_text'),
        };
      }),
      {
        maxPairs: 80,
        maxChars: 4000,
      },
    );

    return {
      id: template.id,
      title: template.title,
      summary,
      scene: template.scene,
      source: template.source,
      document_content: asset.draft.content,
      last_rehearsed_at: lastRehearsedAt,
      rehearsal_count: preparedTrainingMemories.length,
      low_confidence_sections: sections.filter((section) => section.low_confidence_count > 0).length,
      hotwords: dedupeStrings(
        [
          ...template.hotwords,
          ...(asset.rehearsal_summary?.hotwords ?? []),
          ...sections.flatMap((section) => section.hotwords),
        ],
        10,
      ),
      high_risk_phrases: dedupeStrings(
        [
          ...template.highRiskPhrases,
          ...sections
            .filter((section) => section.is_priority)
            .flatMap((section) => section.high_risk_phrases),
        ],
        8,
      ),
      fallback_phrases: dedupeStrings(
        [
          ...template.fallbackPhrases,
          ...(asset.rehearsal_summary?.fallbackPhrases ?? []),
          ...sections
            .filter((section) => section.is_priority)
            .flatMap((section) => section.fallback_phrases),
        ],
        6,
      ),
      asr_hotword_entries: asset.rehearsal_summary?.asrHotwordEntries ?? [],
      reference_lines: referenceLines,
      training_pairs: trainingPairs,
      next_focus: nextFocus,
      rehearsal_summary: asset.rehearsal_summary
        ? {
            summary: asset.rehearsal_summary.summary,
            hotwords: asset.rehearsal_summary.hotwords,
            recurring_errors: asset.rehearsal_summary.recurringErrors,
            pronunciation_patterns: asset.rehearsal_summary.pronunciationPatterns,
            support_strategies: asset.rehearsal_summary.supportStrategies,
            next_focus: asset.rehearsal_summary.nextFocus,
            reference_lines: asset.rehearsal_summary.referenceLines,
            training_pairs: asset.rehearsal_summary.trainingPairs,
            based_on_training_count: asset.rehearsal_summary.basedOnTrainingCount,
            model: asset.rehearsal_summary.model,
            updated_at: asset.rehearsal_summary.updated_at,
          }
        : null,
      sections,
      updated_at: syncedAt,
    };
  }

  private normalizePreparedExpressionStatus(value: string | null): FeedbackStatus | null {
    if (value === 'excellent' || value === 'close' || value === 'retry' || value === 'unclear') {
      return value;
    }

    return null;
  }

  private buildExpressionKit(
    snapshot: MemoryProfileSnapshot,
    quickPhrases: QuickPhrase[],
    userProfile?: UserProfile | null,
    sceneId?: WorkspaceSceneId,
  ): WorkspaceMemorySnapshot['expression_kit'] {
    const suggestions: ExpressionKitSuggestion[] = [];
    const preferences = isRecord(userProfile?.preferences) ? userProfile.preferences : undefined;
    const communicationPreferences = normalizeCommunicationPreferences(
      preferences?.communication_preferences,
    );

    [
      {
        id: 'pref-opening',
        text: communicationPreferences.opening_phrase,
        category: 'opening',
        note: '你希望陌生人先听到的第一句话',
      },
      {
        id: 'pref-pace',
        text: communicationPreferences.pace_hint,
        category: 'pace',
        note: '你希望对方如何配合你的沟通节奏',
      },
      {
        id: 'pref-repair',
        text: communicationPreferences.repair_phrase,
        category: 'repair',
        note: '当对方没听清时，你希望优先使用的补救表达',
      },
    ].forEach((item, index) => {
      if (!item.text) {
        return;
      }

      suggestions.push({
        id: item.id,
        text: item.text,
        source: 'quick_phrase',
        category: item.category,
        note: item.note,
        priority: 140 - index,
      });
    });

    sortPhrasesForSuggestions(quickPhrases)
      .slice(0, 6)
      .forEach((phrase, index) => {
        suggestions.push({
          id: `quick-${phrase.id ?? index}`,
          text: phrase.text,
          source: 'quick_phrase',
          category: phrase.category,
          priority: 100 - index,
        });
      });

    snapshot.hotword_profiles.slice(0, 4).forEach((profile, index) => {
      suggestions.push({
        id: `hotword-${profile.id}`,
        text: profile.phrase,
        source: 'hotword_profile',
        category: profile.category,
        note: profile.note || profile.scenario || undefined,
        priority: 70 - index,
      });
    });

    snapshot.growth_profile.frequentExpressions.slice(0, 4).forEach((item, index) => {
      suggestions.push({
        id: `expression-${item.label}-${index}`,
        text: item.label,
        source: 'frequent_expression',
        category: 'frequent',
        priority: 40 - index,
      });
    });

    const personalizedPhrases = rankExpressionKitSuggestions(
      suggestions
      .filter((item, index, array) => array.findIndex((candidate) => candidate.text === item.text) === index)
      .slice(0, 12),
      sceneId,
      communicationPreferences,
    ).slice(0, 8);

    const recommendedFocus = dedupeStrings(
      [
        snapshot.growth_profile.nextStep,
        ...snapshot.growth_profile.frequentFocus.slice(0, 3).map((item) => item.label),
        ...snapshot.hotword_profiles.slice(0, 2).map((profile) => profile.phrase),
      ].filter((value): value is string => typeof value === 'string'),
      6,
    );

    return {
      active_scene_id: sceneId ?? null,
      personalized_phrases: personalizedPhrases,
      quick_phrases: sortPhrasesForSuggestions(quickPhrases).slice(0, 12),
      hotword_profiles: snapshot.hotword_profiles.slice(0, 12),
      recommended_focus: recommendedFocus,
      communication_preferences: communicationPreferences,
    };
  }

  // === Quick Phrases ===
  /**
   * 创建新短语
   */
  async createPhrase(phrase: Omit<QuickPhrase, 'id' | 'created_at' | 'updated_at'>): Promise<QuickPhrase | null> {
    const { data, error } = await this.adminClient
      .from('quick_phrases')
      .insert(phrase)
      .select()
      .single();

    if (error) {
      console.error('Error creating phrase:', error);
      return null;
    }
    return data;
  }

  /**
   * 获取用户所有短语，可按分类筛选
   * 注意：此方法使用 adminClient 绕过 RLS，适用于后端 API 调用
   */
  async getUserPhrases(userId: string, category?: string, limit?: number): Promise<QuickPhrase[]> {
    let query = this.adminClient
      .from('quick_phrases')
      .select('*')
      .eq('user_id', userId);

    if (category) {
      query = query.eq('category', category);
    }

    query = query.order('order_index', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user phrases:', error);
      return [];
    }
    return data || [];
  }

  /**
   * 更新短语
   */
  async updatePhrase(phraseId: string, updates: Partial<QuickPhrase>): Promise<QuickPhrase | null> {
    const { data, error } = await this.adminClient
      .from('quick_phrases')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', phraseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating phrase:', error);
      return null;
    }
    return data;
  }

  /**
   * 删除短语
   */
  async deletePhrase(phraseId: string): Promise<boolean> {
    const { error } = await this.adminClient
      .from('quick_phrases')
      .delete()
      .eq('id', phraseId);

    if (error) {
      console.error('Error deleting phrase:', error);
      return false;
    }
    return true;
  }

  /**
   * 增加短语使用次数
   */
  async incrementPhraseUsage(phraseId: string): Promise<QuickPhrase | null> {
    // 首先获取当前短语
    const { data: current } = await this.adminClient
      .from('quick_phrases')
      .select('*')
      .eq('id', phraseId)
      .single();

    if (!current) {
      return null;
    }

    const { data, error } = await this.adminClient
      .from('quick_phrases')
      .update({
        usage_count: (current.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', phraseId)
      .select()
      .single();

    if (error) {
      console.error('Error incrementing phrase usage:', error);
      return null;
    }
    return data;
  }

  /**
   * 批量更新短语顺序
   */
  async reorderPhrases(phraseOrders: Array<{ id: string; order_index: number }>): Promise<boolean> {
    // Supabase 不支持批量更新，需要逐个更新
    // 使用事务保证一致性
    const updates = phraseOrders.map(({ id, order_index }) =>
      this.adminClient
        .from('quick_phrases')
        .update({ order_index, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    // 并发执行所有更新
    const results = await Promise.allSettled(updates);

    // 检查是否所有更新都成功
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('Error reordering phrases:', failures);
      return false;
    }

    return true;
  }

  /**
   * 从系统预设表获取所有预设短语
   */
  async getPresetPhrases(): Promise<Array<{ text: string; category: PhraseCategory }>> {
    const { data, error } = await this.client
      .from('preset_phrases')
      .select('text, category, order_index')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching preset phrases:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 为用户初始化预设短语（从系统预设表复制）
   */
  async initializePresetPhrases(userId: string): Promise<QuickPhrase[]> {
    // 检查用户是否已有短语
    const existing = await this.getUserPhrases(userId);
    if (existing.length > 0) {
      return existing; // 已有短语，不重复初始化
    }

    // 从数据库获取预设短语
    const presets = await this.getPresetPhrases();

    if (presets.length === 0) {
      console.warn('No preset phrases found in database');
      return [];
    }

    // 批量创建预设短语到用户库
    const phrases = presets.map((preset, index: number) => ({
      user_id: userId,
      text: preset.text,
      category: preset.category,
      usage_count: 0,
      order_index: index,
    }));

    // 使用 adminClient (service_role) 绕过 RLS
    const { data, error } = await this.adminClient
      .from('quick_phrases')
      .insert(phrases)
      .select();

    if (error) {
      console.error('Error initializing preset phrases:', error);
      return [];
    }

    return data || [];
  }
}

// Lazy initialization - call getInstance() when needed
// export default SupabaseService.getInstance();

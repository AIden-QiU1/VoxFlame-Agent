import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  buildMemoryGrowthProfileSnapshot,
  MemoryGrowthProfileSnapshot,
} from './memory-growth.service';
import {
  rankExpressionKitSuggestions,
  type WorkspaceSceneId,
} from './expression-kit.service';

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

function normalizeCommunicationPreferences(value: unknown): CommunicationPreferences {
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
  async ensureUserProfile(userId: string): Promise<void> {
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
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

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

  // === Hotwords Extraction ===
  async extractHotwords(userId: string): Promise<string[]> {
    const snapshot = await this.getUserMemoryProfile(userId, 200, 20);
    return snapshot.hotwords;
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

    return {
      profile_bundle: this.buildProfileBundle(profileSnapshot, userProfile),
      session_review: this.buildSessionReview(profileSnapshot, syncedAt),
      expression_kit: this.buildExpressionKit(
        profileSnapshot,
        quickPhrases,
        userProfile,
        options.sceneId,
      ),
      synced_at: syncedAt,
    };
  }

  // === Analytics ===
  async getUserStats(userId: string): Promise<Record<string, number | string | null>> {
    const snapshot = await this.getUserMemoryProfile(userId, 400, 120);
    const stats = snapshot.growth_profile.stats;

    return {
      total_sessions: stats.totalSessions,
      total_duration_seconds: stats.totalDurationSeconds,
      avg_session_duration_seconds: stats.avgSessionDurationSeconds,
      total_memories: stats.totalMemories,
      total_training_attempts: stats.totalTrainingAttempts,
      active_days: stats.activeDays,
      current_training_streak: stats.currentTrainingStreak,
      best_training_streak: stats.bestTrainingStreak,
      rolling_clarity_average: stats.rollingClarityAverage,
      improvement_slope: stats.improvementSlope,
      total_confusion_patterns: stats.totalConfusionPatterns,
      last_session: stats.lastSessionAt ? new Date(stats.lastSessionAt).toISOString() : null,
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
      relevantItems.push({
        id: `memory-${memory.id}`,
        title: '最近训练记录',
        content: memory.content,
        source: 'memory',
        emphasis: 'low',
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
    const recentWin =
      snapshot.growth_profile.stats.improvementDirection === 'improving'
        ? '训练清晰度趋势正在提升'
        : snapshot.growth_profile.frequentExpressions[0]?.label ?? null;

    if (!latestSession) {
      return {
        session_id: null,
        headline: '还没有稳定的会话复盘',
        summary: '先用 starter kit 和表达工具箱把第一句话说出去，系统会逐步积累你的个体表达画像。',
        focus: snapshot.growth_profile.frequentFocus.slice(0, 3).map((item) => item.label),
        recent_win: recentWin,
        next_step: snapshot.growth_profile.nextStep || null,
        updated_at: syncedAt,
      };
    }

    const focus = dedupeStrings(
      [
        ...latestSession.topFocusTags,
        ...latestSession.topFocusSyllables,
        ...snapshot.growth_profile.frequentFocus.slice(0, 2).map((item) => item.label),
      ],
      4,
    );

    return {
      session_id: latestSession.id,
      headline: '最近一次沟通复盘',
      summary: `最近一次 ${latestSession.kind} 会话共 ${latestSession.turnCount} 轮，持续 ${latestSession.durationSeconds} 秒，平均清晰度 ${Math.round(latestSession.avgClarityScore * 100)}%。`,
      focus,
      recent_win: recentWin,
      next_step: snapshot.growth_profile.nextStep || null,
      updated_at: syncedAt,
    };
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

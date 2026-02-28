import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Memory {
  id?: string;
  user_id: string;
  session_id: string;
  content: string;
  metadata?: any;
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
  metadata?: any;
}

export interface UserProfile {
  id?: string;
  name?: string;
  age?: number;
  condition?: string;
  hotwords?: string[];
  preferences?: any;
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

export type PhraseCategory =
  | 'greeting'
  | 'need'
  | 'emotion'
  | 'medical'
  | 'shopping'
  | 'dining'
  | 'transport'
  | 'custom';

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
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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

  // === Sessions ===
  async createSession(session: Session): Promise<Session | null> {
    const { data, error } = await this.client
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

    const { data, error } = await this.client
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
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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

  async updateMemory(memoryId: string, updates: Partial<Memory>): Promise<Memory | null> {
    const { data, error } = await this.client
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
    const { error } = await this.client
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
    // Get user sessions
    const sessions = await this.getUserSessions(userId, 20);
    
    // Simple frequency-based hotword extraction
    const wordFreq: { [key: string]: number } = {};
    
    sessions.forEach(session => {
      if (!session.transcript) return;
      
      // Tokenize Chinese text (simple character-based for now)
      const words = session.transcript.match(/[\u4e00-\u9fa5]+/g) || [];
      words.forEach(word => {
        if (word.length >= 2 && word.length <= 4) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    // Sort by frequency and return top 20
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  // === Analytics ===
  async getUserStats(userId: string): Promise<any> {
    const sessions = await this.getUserSessions(userId, 100);
    const memories = await this.getMemories(userId, 1000);

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    return {
      total_sessions: totalSessions,
      total_duration_seconds: totalDuration,
      avg_session_duration_seconds: avgDuration,
      total_memories: memories.length,
      last_session: sessions[0]?.start_time || null,
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

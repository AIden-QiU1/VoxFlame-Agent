-- =====================================================
-- 燃言项目 Supabase 数据库表结构
-- 
-- 用途：存储语音贡献数据和用户统计
-- 创建日期：2025-01-XX
-- =====================================================

-- 1. 贡献者表（匿名）
CREATE TABLE IF NOT EXISTS contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id TEXT UNIQUE NOT NULL,
  
  -- 可选的用户信息（用户自愿提供）
  age_range TEXT,  -- '50-59', '60-69', '70-79', '80+'
  etiology TEXT,   -- '脑卒中', '帕金森', '脑瘫', 'ALS', '其他', '无'
  severity TEXT,   -- '轻度', '中度', '重度', '无'
  
  -- 统计
  total_recordings INT DEFAULT 0,
  total_duration_seconds FLOAT DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 语音贡献表
CREATE TABLE IF NOT EXISTS voice_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contributor_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
  
  -- 音频信息
  audio_path TEXT NOT NULL,  -- Supabase Storage 路径
  duration_seconds FLOAT NOT NULL,
  
  -- 文本信息
  transcript TEXT,           -- 原文/期望文本
  sentence_id TEXT,          -- 语料库句子ID (如 'daily-01')
  is_free_recording BOOLEAN DEFAULT FALSE,
  
  -- 元数据
  metadata JSONB DEFAULT '{}',  -- 设备信息等
  
  -- 审核状态
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 语料库句子表（可选，也可以前端硬编码）
CREATE TABLE IF NOT EXISTS corpus_sentences (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'daily', 'emotion', 'health', 'social', 'environment', 'story'
  difficulty TEXT NOT NULL,  -- 'easy', 'medium', 'hard'
  phonemes TEXT[],
  order_index INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 索引
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_contributions_contributor 
  ON voice_contributions(contributor_id);

CREATE INDEX IF NOT EXISTS idx_contributions_status 
  ON voice_contributions(status);

CREATE INDEX IF NOT EXISTS idx_contributions_sentence 
  ON voice_contributions(sentence_id);

-- =====================================================
-- 存储过程：更新贡献者统计
-- =====================================================

CREATE OR REPLACE FUNCTION increment_contributor_stats(
  p_contributor_id UUID,
  p_duration FLOAT
) RETURNS VOID AS $$
BEGIN
  UPDATE contributors
  SET 
    total_recordings = total_recordings + 1,
    total_duration_seconds = total_duration_seconds + p_duration,
    updated_at = NOW()
  WHERE id = p_contributor_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 存储过程：获取社区统计
-- =====================================================

CREATE OR REPLACE FUNCTION get_community_stats()
RETURNS TABLE (
  total_contributors BIGINT,
  total_recordings BIGINT,
  total_duration_hours FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT c.id)::BIGINT AS total_contributors,
    COUNT(v.id)::BIGINT AS total_recordings,
    COALESCE(SUM(v.duration_seconds) / 3600, 0)::FLOAT AS total_duration_hours
  FROM contributors c
  LEFT JOIN voice_contributions v ON v.contributor_id = c.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contributors_updated_at
  BEFORE UPDATE ON contributors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS 策略（Row Level Security）
-- =====================================================

-- 启用 RLS
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_contributions ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户插入（通过 anon key）
CREATE POLICY "Allow anonymous insert contributors" ON contributors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous insert contributions" ON voice_contributions
  FOR INSERT WITH CHECK (true);

-- 允许读取（用于统计展示）
CREATE POLICY "Allow public read contributors stats" ON contributors
  FOR SELECT USING (true);

CREATE POLICY "Allow public read contributions" ON voice_contributions
  FOR SELECT USING (true);

-- =====================================================
-- Storage Bucket 设置（需要在 Supabase Dashboard 中创建）
-- =====================================================

-- 创建 bucket: voice-contributions
-- 设置为公开读取，或者设置 RLS 策略

-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('voice-contributions', 'voice-contributions', false);

-- =====================================================
-- 初始数据：语料库句子（可选）
-- =====================================================

-- 如果需要从数据库读取语料，可以运行以下插入语句
-- INSERT INTO corpus_sentences (id, text, category, difficulty, order_index) VALUES
-- ('daily-01', '我想喝水', 'daily', 'easy', 1),
-- ('daily-02', '肚子饿了', 'daily', 'easy', 2),
-- ... 其他句子

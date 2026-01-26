-- 语音贡献数据表
-- 用于存储用户录制的语音样本及其元数据

CREATE TABLE IF NOT EXISTS voice_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contributor_id TEXT NOT NULL,         -- 贡献者ID (可能是匿名ID)
  audio_path TEXT NOT NULL,             -- OSS存储路径
  transcript TEXT NOT NULL,             -- 对应的文本
  sentence_id TEXT,                     -- 句子ID (如果是引导式录音)
  is_free_recording BOOLEAN DEFAULT FALSE, -- 是否自由录音
  duration_seconds FLOAT,               -- 录音时长
  metadata JSONB DEFAULT '{}',          -- 额外元数据 (UA, timestamps等)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_voice_contributions_contributor_id ON voice_contributions(contributor_id);
CREATE INDEX IF NOT EXISTS idx_voice_contributions_sentence_id ON voice_contributions(sentence_id);
CREATE INDEX IF NOT EXISTS idx_voice_contributions_created_at ON voice_contributions(created_at DESC);

-- 注释
COMMENT ON TABLE voice_contributions IS '语音贡献表：存储用户录制的语音样本';

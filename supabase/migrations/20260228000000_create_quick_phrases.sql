-- =============================================
-- 常用短语表 (quick_phrases)
-- =============================================

-- 创建分类枚举类型
CREATE TYPE phrase_category AS ENUM (
  'greeting',    -- 问候
  'need',        -- 需求
  'emotion',     -- 情绪
  'medical',     -- 就医
  'shopping',    -- 购物
  'dining',      -- 点餐
  'transport',   -- 打车/交通
  'custom'       -- 自定义
);

-- =============================================
-- 系统预设短语表 (preset_phrases)
-- 所有用户共享的预设短语，初始化时复制到 quick_phrases
-- =============================================
CREATE TABLE IF NOT EXISTS public.preset_phrases (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  category phrase_category NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入默认预设短语
INSERT INTO public.preset_phrases (text, category, order_index) VALUES
  -- 问候类
  ('你好', 'greeting', 1),
  ('谢谢', 'greeting', 2),
  ('再见', 'greeting', 3),
  ('不好意思', 'greeting', 4),

  -- 需求类
  ('我需要帮助', 'need', 10),
  ('请等一下', 'need', 11),
  ('我不明白', 'need', 12),
  ('可以再说一遍吗', 'need', 13),

  -- 情绪类
  ('我很着急', 'emotion', 20),
  ('我很好', 'emotion', 21),
  ('我很开心', 'emotion', 22),

  -- 就医类
  ('我头疼', 'medical', 30),
  ('我哪里不舒服', 'medical', 31),
  ('我需要看医生', 'medical', 32),

  -- 购物类
  ('这个多少钱', 'shopping', 40),
  ('我要这个', 'shopping', 41),

  -- 点餐类
  ('我要点餐', 'dining', 50),
  ('结账', 'dining', 51),

  -- 交通类
  ('我要去', 'transport', 60),
  ('请停车', 'transport', 61)
ON CONFLICT DO NOTHING;

-- 创建常用短语表 (用户个人短语)
CREATE TABLE IF NOT EXISTS public.quick_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 短语内容
  text TEXT NOT NULL,
  category phrase_category NOT NULL DEFAULT 'custom',

  -- TTS 音频 URL (可选，用于预生成缓存)
  tts_url TEXT,

  -- 使用统计
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- 排序
  order_index INTEGER NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quick_phrases_user_id ON public.quick_phrases(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_phrases_category ON public.quick_phrases(category);
CREATE INDEX IF NOT EXISTS idx_quick_phrases_usage_count ON public.quick_phrases(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_quick_phrases_order ON public.quick_phrases(user_id, order_index);

-- 创建全文搜索索引 (用于搜索短语内容)
CREATE INDEX IF NOT EXISTS idx_quick_phrases_text_search ON public.quick_phrases USING gin(to_tsvector('simple', text));

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quick_phrases_updated_at
  BEFORE UPDATE ON public.quick_phrases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE public.quick_phrases ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的短语
CREATE POLICY "Users can view own phrases"
  ON public.quick_phrases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phrases"
  ON public.quick_phrases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phrases"
  ON public.quick_phrases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own phrases"
  ON public.quick_phrases FOR DELETE
  USING (auth.uid() = user_id);

-- 添加注释
COMMENT ON TABLE public.quick_phrases IS '用户常用短语库';
COMMENT ON COLUMN public.quick_phrases.text IS '短语文本内容';
COMMENT ON COLUMN public.quick_phrases.category IS '短语分类';
COMMENT ON COLUMN public.quick_phrases.tts_url IS '预生成的 TTS 音频 URL';
COMMENT ON COLUMN public.quick_phrases.usage_count IS '使用次数统计';
COMMENT ON COLUMN public.quick_phrases.order_index IS '排序顺序（用于拖拽重排）';

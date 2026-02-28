/**
 * 迁移执行脚本
 * 通过 Supabase REST API 创建表
 */

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const sql = `
-- 创建分类枚举类型
DO $$ BEGIN
    CREATE TYPE phrase_category AS ENUM (
    'greeting', 'need', 'emotion', 'medical', 'shopping', 'dining', 'transport', 'custom'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 创建系统预设短语表
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
  ('你好', 'greeting', 1), ('谢谢', 'greeting', 2), ('再见', 'greeting', 3), ('不好意思', 'greeting', 4),
  ('我需要帮助', 'need', 10), ('请等一下', 'need', 11), ('我不明白', 'need', 12), ('可以再说一遍吗', 'need', 13),
  ('我很着急', 'emotion', 20), ('我很好', 'emotion', 21), ('我很开心', 'emotion', 22),
  ('我头疼', 'medical', 30), ('我哪里不舒服', 'medical', 31), ('我需要看医生', 'medical', 32),
  ('这个多少钱', 'shopping', 40), ('我要这个', 'shopping', 41),
  ('我要点餐', 'dining', 50), ('结账', 'dining', 51),
  ('我要去', 'transport', 60), ('请停车', 'transport', 61)
ON CONFLICT DO NOTHING;

-- 创建用户短语表
CREATE TABLE IF NOT EXISTS public.quick_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category phrase_category NOT NULL DEFAULT 'custom',
  tts_url TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.quick_phrases ENABLE ROW LEVEL SECURITY;

-- RLS 策略
DROP POLICY IF EXISTS "Users can view own phrases" ON public.quick_phrases;
DROP POLICY IF EXISTS "Users can insert own phrases" ON public.quick_phrases;
DROP POLICY IF EXISTS "Users can update own phrases" ON public.quick_phrases;
DROP POLICY IF EXISTS "Users can delete own phrases" ON public.quick_phrases;

CREATE POLICY "Users can view own phrases" ON public.quick_phrases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phrases" ON public.quick_phrases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own phrases" ON public.quick_phrases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own phrases" ON public.quick_phrases FOR DELETE USING (auth.uid() = user_id);
`

// 通过 fetch 执行（需要 Supabase Management API 或 pgsql 函数）
console.log('Migration SQL prepared. Please execute in Supabase SQL Editor:')
console.log(sql)

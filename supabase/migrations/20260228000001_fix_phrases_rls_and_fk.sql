-- 修改 quick_phrases 表的外键约束
-- 原因：预设短语初始化可能在用户注册流程之前调用
-- 解决方案：移除外键约束，改为应用层验证

-- 1. 删除外键约束
ALTER TABLE public.quick_phrases DROP CONSTRAINT IF EXISTS quick_phrases_user_id_fkey;

-- 2. 添加检查约束，确保 user_id 是有效的 UUID
ALTER TABLE public.quick_phrases ADD CONSTRAINT quick_phrases_user_id_valid
  CHECK (user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 3. 更新 RLS 策略，不再依赖 auth.uid() 的外键
DROP POLICY IF EXISTS "Users can insert phrases" ON public.quick_phrases;
DROP POLICY IF EXISTS "Users can view own phrases" ON public.quick_phrases;
DROP POLICY IF EXISTS "Users can update own phrases" ON public.quick_phrases;
DROP POLICY IF EXISTS "Users can delete own phrases" ON public.quick_phrases;

-- 策略：允许任何有效 UUID 插入（由后端 service_role 保证）
CREATE POLICY "Users can insert phrases"
  ON public.quick_phrases FOR INSERT
  TO public
  WITH CHECK (true);

-- 策略：用户只能查看自己的短语
CREATE POLICY "Users can view own phrases"
  ON public.quick_phrases FOR SELECT
  TO public
  USING (auth.uid()::text = user_id::text);

-- 策略：用户只能更新自己的短语
CREATE POLICY "Users can update own phrases"
  ON public.quick_phrases FOR UPDATE
  TO public
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- 策略：用户只能删除自己的短语
CREATE POLICY "Users can delete own phrases"
  ON public.quick_phrases FOR DELETE
  TO public
  USING (auth.uid()::text = user_id::text);

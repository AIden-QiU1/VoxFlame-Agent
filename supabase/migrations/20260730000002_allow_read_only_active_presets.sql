-- Compatibility exception: the deployed backend reads active preset phrases
-- with the anon client. Presets contain system-authored public copy only, so
-- expose active rows as read-only while keeping every mutation backend-only.

CREATE POLICY "Public can read active preset phrases"
  ON public.preset_phrases
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON TABLE public.preset_phrases TO anon, authenticated;

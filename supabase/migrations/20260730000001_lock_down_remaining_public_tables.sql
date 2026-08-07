-- Finish closing the Supabase Data API surface identified while remediating
-- 沪浦网信安通〔2026〕267号.
--
-- Browser and mobile clients use authenticated VoxFlame backend APIs. These
-- tables therefore have no reason to accept anon or authenticated PostgREST
-- traffic directly.

ALTER TABLE public.voice_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_contributions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quick_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_phrases FORCE ROW LEVEL SECURITY;

ALTER TABLE public.preset_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_phrases FORCE ROW LEVEL SECURITY;

-- Remove historical policies, including the quick_phrases INSERT policy whose
-- WITH CHECK (true) allowed arbitrary browser-originated rows.
DO $migration$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('voice_contributions', 'quick_phrases', 'preset_phrases')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END
$migration$;

REVOKE ALL PRIVILEGES ON TABLE public.voice_contributions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.quick_phrases FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.preset_phrases FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.preset_phrases_id_seq FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.voice_contributions FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.quick_phrases FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.preset_phrases FROM service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE public.preset_phrases_id_seq FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_contributions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_phrases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.preset_phrases TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.preset_phrases_id_seq TO service_role;

-- New public-schema tables and sequences should fail closed unless a later,
-- reviewed migration explicitly grants a browser-facing role access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;

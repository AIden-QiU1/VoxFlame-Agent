-- Close the cross-tenant Data API exposure reported in
-- 沪浦网信安通〔2026〕267号.
--
-- These tables are durable backend-owned data. Browser and mobile clients use
-- authenticated VoxFlame backend APIs; they must never query these tables
-- directly with Supabase public roles.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories FORCE ROW LEVEL SECURITY;

-- Fail closed for every browser-facing role. RLS is retained as defense in
-- depth even though these roles no longer have table privileges.
REVOKE ALL PRIVILEGES ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.memories FROM PUBLIC, anon, authenticated;

-- Backend access is deliberately narrower than Supabase's historical default
-- grants: no TRUNCATE, TRIGGER, or REFERENCES privilege is needed at runtime.
REVOKE ALL PRIVILEGES ON TABLE public.user_profiles FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.sessions FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.memories FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.memories TO service_role;

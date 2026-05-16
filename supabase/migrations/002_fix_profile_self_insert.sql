-- =============================================================================
-- 002_fix_profile_self_insert.sql
-- Allow users to create their own profile row (recovery for accounts where the
-- handle_new_user trigger did not fire), and backfill any missing profiles.
-- =============================================================================

-- Allow an authenticated user to insert a profile row only for themselves.
CREATE POLICY "profiles: self insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Backfill: create a minimal profile for any auth.users row that has no matching
-- profiles row (e.g. accounts created via the Supabase dashboard or before the
-- trigger was in place).
INSERT INTO public.profiles (id, email, first_name, last_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  COALESCE(u.raw_user_meta_data->>'role', 'customer')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

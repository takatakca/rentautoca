
-- Allow public to read basic profile info (needed for host cards on public listings)
CREATE POLICY "profiles_public_read"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

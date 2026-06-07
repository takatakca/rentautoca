
-- 1. CARS: restrict public read and revoke sensitive column access
DROP POLICY IF EXISTS cars_public_read ON public.cars;
CREATE POLICY cars_active_or_owner_read ON public.cars
  FOR SELECT
  USING (
    status = 'active'
    OR auth.uid() = host_id
    OR public.has_role(auth.uid(), 'admin')
  );

REVOKE SELECT (vin, plate_number, registration_url, insurance_url) ON public.cars FROM anon;
REVOKE SELECT (vin, plate_number, registration_url, insurance_url) ON public.cars FROM authenticated;

-- 2. PROFILES: lock down direct table SELECT to owner/admin; expose safe columns via view
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  id,
  display_name,
  first_name,
  avatar_url,
  bio,
  is_all_star,
  rating_avg,
  trips_count,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 3. USER_ROLES: remove self-host privilege escalation; only admins assign roles.
-- New users still get 'guest' via handle_new_user trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS roles_insert_self_host_or_admin ON public.user_roles;
CREATE POLICY roles_insert_admin_only ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. STORAGE: tighten vehicle-photos upload to require car ownership
DROP POLICY IF EXISTS vehicle_photos_host_upload ON storage.objects;
CREATE POLICY vehicle_photos_host_upload ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND EXISTS (
      SELECT 1 FROM public.cars c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.host_id = auth.uid()
    )
  );

-- 5. STORAGE: prevent listing of public buckets (files still accessible via public URLs).
DROP POLICY IF EXISTS vehicle_photos_public_read ON storage.objects;
DROP POLICY IF EXISTS profile_photos_public_read ON storage.objects;

-- 6. Lock down trigger-only SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

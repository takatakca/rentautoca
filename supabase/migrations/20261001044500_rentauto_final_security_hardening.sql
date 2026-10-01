-- Final Rentauto storage and SECURITY DEFINER hardening.

UPDATE storage.buckets
SET
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'rentauto-profile-photos';

UPDATE storage.buckets
SET
  file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'rentauto-vehicle-photos';

UPDATE storage.buckets
SET
  file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'rentauto-ids-private';

ALTER FUNCTION rentauto.car_is_public(uuid)
  SET search_path = '';

ALTER FUNCTION rentauto.can_manage_car(uuid)
  SET search_path = '';

ALTER FUNCTION rentauto.has_role(rentauto.app_role, uuid)
  SET search_path = '';

ALTER FUNCTION rentauto.update_profile_compat()
  SET search_path = '';

ALTER FUNCTION public.rentauto_quote_trip(
  uuid,
  timestamptz,
  timestamptz,
  uuid[],
  uuid
) SET search_path = '';

ALTER FUNCTION rentauto.compute_trip_quote(
  uuid,
  timestamptz,
  timestamptz,
  uuid[],
  uuid,
  uuid
) SET search_path = '';

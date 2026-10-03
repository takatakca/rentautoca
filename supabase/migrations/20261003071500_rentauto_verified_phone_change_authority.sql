-- RENTAUTO verified-phone authority
--
-- Profile edits must never be allowed to replace a phone number while retaining
-- the verification state of a different TAKATAK master-identity phone.
-- Phone changes are performed through Supabase Auth updateUser({ phone }) +
-- verifyOtp(type = 'phone_change'), then bootstrap_rentauto_account resynchronizes
-- the newly verified Auth phone into the shared profile/master identity.

CREATE OR REPLACE FUNCTION rentauto.update_profile_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := OLD.id;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF v_user_id <> auth.uid()
     AND NOT rentauto.has_role('admin'::rentauto.app_role) THEN
    RAISE EXCEPTION 'profile_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified
     OR NEW.id_verified IS DISTINCT FROM OLD.id_verified
     OR NEW.is_all_star IS DISTINCT FROM OLD.is_all_star
     OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
     OR NEW.trips_count IS DISTINCT FROM OLD.trips_count
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'protected_profile_field' USING ERRCODE = '42501';
  END IF;

  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'verified_phone_change_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    "firstName" = NEW.first_name,
    "lastName" = NEW.last_name,
    "displayName" = NEW.display_name,
    "updatedAt" = now()
  WHERE "authUserId" = v_user_id;

  UPDATE rentauto.accounts
  SET
    avatar_url = NEW.avatar_url,
    bio = NEW.bio,
    province = NEW.province,
    city = NEW.city,
    postal_code = NEW.postal_code,
    updated_at = now()
  WHERE auth_user_id = v_user_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION rentauto.update_profile_compat()
FROM PUBLIC, anon, authenticated;

-- The view trigger invokes this function under the view owner's authority.
-- Do not grant direct EXECUTE to browser roles.

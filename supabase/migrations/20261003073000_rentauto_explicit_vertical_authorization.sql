-- RENTAUTO explicit vertical authorization gate
--
-- TAKATAK Auth can authenticate a person across multiple GROUPE TAKATAK
-- services. Authentication alone must never silently opt that person into
-- RENTAUTO. New RENTAUTO activation requires a server-recorded consent marker.
--
-- Existing RENTAUTO accounts remain compatible even if they predate this gate.

ALTER FUNCTION public.bootstrap_rentauto_account(uuid)
  RENAME TO bootstrap_rentauto_account_authorized_impl;

REVOKE ALL ON FUNCTION public.bootstrap_rentauto_account_authorized_impl(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_rentauto_account_authorized_impl(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_rentauto_account(
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_app_metadata jsonb := '{}'::jsonb;
  v_has_existing_account boolean := false;
  v_authorized_at text;
  v_terms_accepted_at text;
  v_privacy_accepted_at text;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_required' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM rentauto.accounts a
    WHERE a.auth_user_id = p_auth_user_id
  )
  INTO v_has_existing_account;

  IF NOT v_has_existing_account THEN
    SELECT COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    INTO v_app_metadata
    FROM auth.users u
    WHERE u.id = p_auth_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'auth_user_not_found' USING ERRCODE = 'P0002';
    END IF;

    v_authorized_at := NULLIF(btrim(COALESCE(v_app_metadata->>'rentauto_authorized_at', '')), '');
    v_terms_accepted_at := NULLIF(btrim(COALESCE(v_app_metadata->>'rentauto_terms_accepted_at', '')), '');
    v_privacy_accepted_at := NULLIF(btrim(COALESCE(v_app_metadata->>'rentauto_privacy_accepted_at', '')), '');

    IF v_authorized_at IS NULL
       OR v_terms_accepted_at IS NULL
       OR v_privacy_accepted_at IS NULL THEN
      RAISE EXCEPTION 'rentauto_consent_required' USING ERRCODE = '42501';
    END IF;

    BEGIN
      PERFORM v_authorized_at::timestamptz;
      PERFORM v_terms_accepted_at::timestamptz;
      PERFORM v_privacy_accepted_at::timestamptz;
    EXCEPTION
      WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'rentauto_consent_invalid' USING ERRCODE = '22007';
    END;
  END IF;

  RETURN public.bootstrap_rentauto_account_authorized_impl(p_auth_user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_rentauto_account(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_rentauto_account(uuid)
TO service_role;

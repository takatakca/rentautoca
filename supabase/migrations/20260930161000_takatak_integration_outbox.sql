-- TAKATAK integration outbox for Rentauto.
-- Rentauto remains authoritative for rental operations; TAKATAK receives
-- idempotent, privacy-minimized projections through a retryable outbox.

CREATE TABLE IF NOT EXISTS public.integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  source_system text NOT NULL DEFAULT 'RENTAUTO',
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  external_user_id uuid,
  payload_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','processed','failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_outbox_ready_idx
  ON public.integration_outbox (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS integration_outbox_user_idx
  ON public.integration_outbox (external_user_id, created_at DESC);

ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.integration_outbox FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.integration_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_takatak_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_external_user_id uuid,
  p_payload jsonb,
  p_schema_version integer DEFAULT 1,
  p_event_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_event_id text;
BEGIN
  IF p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_required';
  END IF;
  IF p_aggregate_type IS NULL OR btrim(p_aggregate_type) = '' THEN
    RAISE EXCEPTION 'aggregate_type_required';
  END IF;
  IF p_aggregate_id IS NULL OR btrim(p_aggregate_id) = '' THEN
    RAISE EXCEPTION 'aggregate_id_required';
  END IF;
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'payload_required';
  END IF;

  v_event_id := COALESCE(NULLIF(btrim(p_event_id), ''), gen_random_uuid()::text);

  INSERT INTO public.integration_outbox (
    event_id,
    event_type,
    schema_version,
    aggregate_type,
    aggregate_id,
    external_user_id,
    payload_json
  )
  VALUES (
    v_event_id,
    p_event_type,
    COALESCE(p_schema_version, 1),
    p_aggregate_type,
    p_aggregate_id,
    p_external_user_id,
    p_payload
  )
  ON CONFLICT (event_id) DO UPDATE
    SET event_id = EXCLUDED.event_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_takatak_event(text,text,text,uuid,jsonb,integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_takatak_event(text,text,text,uuid,jsonb,integer,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_takatak_outbox(p_limit integer DEFAULT 20)
RETURNS SETOF public.integration_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.integration_outbox o
    WHERE (
      o.status IN ('pending','failed')
      OR (o.status = 'processing' AND o.locked_at < now() - interval '10 minutes')
    )
      AND o.next_attempt_at <= now()
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  ),
  claimed AS (
    UPDATE public.integration_outbox o
    SET status = 'processing',
        attempt_count = o.attempt_count + 1,
        locked_at = now(),
        updated_at = now(),
        last_error = NULL
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_takatak_outbox(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_takatak_outbox(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mark_takatak_outbox_processed(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.integration_outbox
  SET status = 'processed',
      processed_at = now(),
      locked_at = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.mark_takatak_outbox_processed(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_takatak_outbox_processed(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mark_takatak_outbox_failed(
  p_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  SELECT attempt_count INTO v_attempts
  FROM public.integration_outbox
  WHERE id = p_id;

  UPDATE public.integration_outbox
  SET status = 'failed',
      last_error = left(COALESCE(p_error, 'unknown_error'), 1000),
      next_attempt_at = now() + make_interval(
        secs => LEAST(3600, GREATEST(30, (2 ^ LEAST(COALESCE(v_attempts, 1), 7))::integer * 15))
      ),
      locked_at = NULL,
      updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_takatak_outbox_failed(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_takatak_outbox_failed(uuid,text)
  TO service_role;

-- Replace the existing auth bootstrap so registration and the TAKATAK
-- projection are committed in the same database transaction.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id text := gen_random_uuid()::text;
  v_verified jsonb := '[]'::jsonb;
  v_first_name text;
  v_last_name text;
  v_locale text;
  v_payload jsonb;
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest')
  ON CONFLICT DO NOTHING;

  v_first_name := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_last_name := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  v_locale := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'locale', '')), '');

  IF NEW.email_confirmed_at IS NOT NULL AND NEW.email IS NOT NULL THEN
    v_verified := v_verified || jsonb_build_array('email');
  END IF;
  IF NEW.phone_confirmed_at IS NOT NULL AND NEW.phone IS NOT NULL THEN
    v_verified := v_verified || jsonb_build_array('phone');
  END IF;

  v_payload := jsonb_build_object(
    'eventId', v_event_id,
    'eventType', 'CUSTOMER_REGISTERED',
    'sourceApplication', 'RENTAUTO',
    'externalUserId', NEW.id::text,
    'collectedFields', jsonb_strip_nulls(jsonb_build_object(
      'firstName', v_first_name,
      'lastName', v_last_name,
      'email', NEW.email,
      'phone', NEW.phone,
      'locale', v_locale,
      'registeredAt', COALESCE(NEW.created_at, now()),
      'updatedAt', COALESCE(NEW.updated_at, now())
    )),
    'verifiedFields', v_verified,
    'consentRecords', '[]'::jsonb,
    'occurredAt', now()
  );

  PERFORM public.enqueue_takatak_event(
    'CUSTOMER_REGISTERED',
    'user',
    NEW.id::text,
    NEW.id,
    v_payload,
    1,
    v_event_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_profile_update_for_takatak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth auth.users%ROWTYPE;
  v_event_id text := gen_random_uuid()::text;
  v_verified jsonb := '[]'::jsonb;
  v_payload jsonb;
BEGIN
  IF ROW(
    NEW.first_name,
    NEW.last_name,
    NEW.phone,
    NEW.phone_verified,
    NEW.city,
    NEW.province,
    NEW.postal_code,
    NEW.display_name
  ) IS NOT DISTINCT FROM ROW(
    OLD.first_name,
    OLD.last_name,
    OLD.phone,
    OLD.phone_verified,
    OLD.city,
    OLD.province,
    OLD.postal_code,
    OLD.display_name
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = NEW.id;

  IF v_auth.email_confirmed_at IS NOT NULL AND v_auth.email IS NOT NULL THEN
    v_verified := v_verified || jsonb_build_array('email');
  END IF;
  IF NEW.phone_verified AND NEW.phone IS NOT NULL THEN
    v_verified := v_verified || jsonb_build_array('phone');
  END IF;

  v_payload := jsonb_build_object(
    'eventId', v_event_id,
    'eventType', 'PROFILE_UPDATED',
    'sourceApplication', 'RENTAUTO',
    'externalUserId', NEW.id::text,
    'collectedFields', jsonb_strip_nulls(jsonb_build_object(
      'firstName', NEW.first_name,
      'lastName', NEW.last_name,
      'email', v_auth.email,
      'phone', COALESCE(NEW.phone, v_auth.phone),
      'updatedAt', now()
    )),
    'verifiedFields', v_verified,
    'consentRecords', '[]'::jsonb,
    'occurredAt', now()
  );

  PERFORM public.enqueue_takatak_event(
    'PROFILE_UPDATED',
    'profile',
    NEW.id::text,
    NEW.id,
    v_payload,
    1,
    v_event_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_profile_update_for_takatak()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_takatak_outbox ON public.profiles;
CREATE TRIGGER profiles_takatak_outbox
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_profile_update_for_takatak();

CREATE OR REPLACE FUNCTION public.enqueue_payment_update_for_takatak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id text := gen_random_uuid()::text;
  v_status text;
  v_booking text;
  v_payload jsonb;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;

  v_status := CASE lower(COALESCE(NEW.payment_status, ''))
    WHEN 'paid' THEN 'PAID'
    WHEN 'failed' THEN 'FAILED'
    WHEN 'refunded' THEN 'REFUNDED'
    WHEN 'partially_refunded' THEN 'PARTIALLY_REFUNDED'
    ELSE 'PENDING'
  END;

  v_booking := COALESCE(NULLIF(NEW.booking_reference, ''), 'trip:' || NEW.id::text);

  v_payload := jsonb_build_object(
    'eventId', v_event_id,
    'eventType', 'PAYMENT_SUMMARY_UPDATED',
    'sourceApplication', 'RENTAUTO',
    'externalUserId', NEW.guest_id::text,
    'payment', jsonb_build_object(
      'bookingNumber', v_booking,
      'status', v_status,
      'amount', GREATEST(COALESCE(NEW.total_cents, 0), 0),
      'currency', upper(COALESCE(NULLIF(NEW.currency, ''), 'CAD')),
      'transactionDate', now()
    ),
    'occurredAt', now()
  );

  PERFORM public.enqueue_takatak_event(
    'PAYMENT_SUMMARY_UPDATED',
    'trip',
    NEW.id::text,
    NEW.guest_id,
    v_payload,
    1,
    v_event_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_payment_update_for_takatak()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trips_payment_takatak_outbox ON public.trips;
CREATE TRIGGER trips_payment_takatak_outbox
AFTER UPDATE OF payment_status ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_payment_update_for_takatak();

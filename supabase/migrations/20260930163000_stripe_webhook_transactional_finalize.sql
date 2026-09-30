-- Stripe webhook state machine and transactional paid-booking finalization.

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_webhook_events_status_check'
  ) THEN
    ALTER TABLE public.stripe_webhook_events
      ADD CONSTRAINT stripe_webhook_events_status_check
      CHECK (status IN ('processing','processed','failed'));
  END IF;
END
$$;

UPDATE public.stripe_webhook_events
SET processed_at = COALESCE(processed_at, created_at),
    status = 'processed'
WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
RETURNS TABLE(should_process boolean, current_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.stripe_webhook_events;
BEGIN
  IF p_event_id IS NULL OR btrim(p_event_id) = '' THEN
    RAISE EXCEPTION 'stripe_event_id_required';
  END IF;

  SELECT *
    INTO v_row
  FROM public.stripe_webhook_events
  WHERE stripe_event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.stripe_webhook_events (
      stripe_event_id,
      event_type,
      status,
      attempt_count,
      processing_started_at
    )
    VALUES (
      p_event_id,
      p_event_type,
      'processing',
      1,
      now()
    );

    RETURN QUERY SELECT true, 'processing'::text;
    RETURN;
  END IF;

  IF v_row.status = 'processed' THEN
    RETURN QUERY SELECT false, 'processed'::text;
    RETURN;
  END IF;

  IF
    v_row.status = 'processing'
    AND v_row.processing_started_at IS NOT NULL
    AND v_row.processing_started_at > now() - interval '10 minutes'
  THEN
    RETURN QUERY SELECT false, 'processing'::text;
    RETURN;
  END IF;

  UPDATE public.stripe_webhook_events
  SET status = 'processing',
      event_type = p_event_type,
      attempt_count = attempt_count + 1,
      processing_started_at = now(),
      last_error = NULL
  WHERE stripe_event_id = p_event_id;

  RETURN QUERY SELECT true, 'processing'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mark_stripe_webhook_processed(p_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.stripe_webhook_events
  SET status = 'processed',
      processed_at = now(),
      last_error = NULL
  WHERE stripe_event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_webhook_processed(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_webhook_processed(text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mark_stripe_webhook_failed(
  p_event_id text,
  p_error text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.stripe_webhook_events
  SET status = 'failed',
      last_error = left(COALESCE(p_error, 'unknown_error'), 1000)
  WHERE stripe_event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.mark_stripe_webhook_failed(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_webhook_failed(text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_paid_booking(
  p_trip_id uuid,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_currency text,
  p_event_created_at timestamptz
)
RETURNS TABLE(booking_reference text, trip_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trips;
  v_hold public.booking_holds;
BEGIN
  SELECT *
    INTO v_trip
  FROM public.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.payment_status = 'paid' AND v_trip.status = 'confirmed' THEN
    IF v_trip.stripe_session_id IS DISTINCT FROM p_stripe_session_id THEN
      RAISE EXCEPTION 'stripe_session_mismatch' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY SELECT v_trip.booking_reference, v_trip.status;
    RETURN;
  END IF;

  IF v_trip.status NOT IN ('draft','pending_payment') THEN
    RAISE EXCEPTION 'invalid_trip_status_for_payment' USING ERRCODE = '22023';
  END IF;

  IF v_trip.stripe_session_id IS DISTINCT FROM p_stripe_session_id THEN
    RAISE EXCEPTION 'stripe_session_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_trip.total_cents IS NULL OR v_trip.total_cents <> p_amount_total THEN
    RAISE EXCEPTION 'payment_amount_mismatch' USING ERRCODE = '22023';
  END IF;

  IF upper(COALESCE(v_trip.currency, '')) <> upper(COALESCE(p_currency, '')) THEN
    RAISE EXCEPTION 'payment_currency_mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_hold
  FROM public.booking_holds
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND OR v_hold.status <> 'active' THEN
    RAISE EXCEPTION 'booking_hold_not_active' USING ERRCODE = 'P0002';
  END IF;

  IF p_event_created_at IS NULL OR p_event_created_at > v_hold.expires_at THEN
    RAISE EXCEPTION 'payment_completed_after_hold_expiry' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.availability_blocks (
    car_id,
    start_at,
    end_at,
    type,
    trip_id
  )
  VALUES (
    v_trip.car_id,
    v_trip.start_at,
    v_trip.end_at,
    'booking_self',
    v_trip.id
  )
  ON CONFLICT (trip_id) WHERE type = 'booking_self' AND trip_id IS NOT NULL
  DO NOTHING;

  UPDATE public.booking_holds
  SET status = 'converted',
      updated_at = now()
  WHERE id = v_hold.id;

  UPDATE public.trips
  SET status = 'confirmed',
      payment_status = 'paid',
      stripe_payment_intent_id = p_payment_intent_id,
      updated_at = now()
  WHERE id = p_trip_id
  RETURNING * INTO v_trip;

  INSERT INTO public.trip_events (
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    p_trip_id,
    NULL,
    'payment_confirmed',
    jsonb_build_object(
      'from', 'pending_payment',
      'to', 'confirmed',
      'stripe_session_id', p_stripe_session_id,
      'amount_total', p_amount_total,
      'currency', upper(p_currency)
    )
  );

  RETURN QUERY SELECT v_trip.booking_reference, v_trip.status;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_paid_booking(uuid,text,text,integer,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_booking(uuid,text,text,integer,text,timestamptz)
  TO service_role;

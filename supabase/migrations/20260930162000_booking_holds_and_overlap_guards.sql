-- Booking integrity: atomically create draft trips with short-lived holds and
-- enforce database-level non-overlap for confirmed booking blocks.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.booking_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','converted','released','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS booking_holds_car_window_idx
  ON public.booking_holds (car_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS booking_holds_expiry_idx
  ON public.booking_holds (status, expires_at);

ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_holds FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_holds TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_holds_active_no_overlap'
  ) THEN
    ALTER TABLE public.booking_holds
      ADD CONSTRAINT booking_holds_active_no_overlap
      EXCLUDE USING gist (
        car_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status = 'active');
  END IF;
END
$$;

ALTER TABLE public.availability_blocks
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS availability_blocks_booking_trip_uidx
  ON public.availability_blocks (trip_id)
  WHERE type = 'booking_self' AND trip_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_blocks_booking_no_overlap'
  ) THEN
    ALTER TABLE public.availability_blocks
      ADD CONSTRAINT availability_blocks_booking_no_overlap
      EXCLUDE USING gist (
        car_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (type = 'booking_self');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.create_booking_draft_and_hold(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_pickup_location text DEFAULT NULL,
  p_return_location text DEFAULT NULL
)
RETURNS TABLE(trip_id uuid, hold_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_currency text;
  v_default_location text;
  v_host_id uuid;
  v_trip_id uuid;
  v_expiry timestamptz := now() + interval '10 minutes';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'invalid_trip_dates' USING ERRCODE = '22007';
  END IF;

  IF p_start_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'trip_start_in_past' USING ERRCODE = '22007';
  END IF;

  IF p_end_at > p_start_at + interval '365 days' THEN
    RAISE EXCEPTION 'trip_duration_too_long' USING ERRCODE = '22023';
  END IF;

  -- Serialize contenders for the same vehicle before evaluating inventory.
  SELECT c.currency, c.location_label, c.host_id
    INTO v_currency, v_default_location, v_host_id
  FROM public.cars c
  WHERE c.id = p_car_id
    AND c.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle_not_available' USING ERRCODE = 'P0002';
  END IF;

  IF v_host_id = v_user_id THEN
    RAISE EXCEPTION 'host_cannot_book_own_vehicle' USING ERRCODE = '42501';
  END IF;

  UPDATE public.booking_holds
  SET status = 'expired',
      updated_at = now()
  WHERE car_id = p_car_id
    AND status = 'active'
    AND expires_at <= now();

  IF EXISTS (
    SELECT 1
    FROM public.availability_blocks b
    WHERE b.car_id = p_car_id
      AND b.start_at < p_end_at
      AND b.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'dates_not_available' USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_holds h
    WHERE h.car_id = p_car_id
      AND h.status = 'active'
      AND h.expires_at > now()
      AND h.start_at < p_end_at
      AND h.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'dates_temporarily_held' USING ERRCODE = '23P01';
  END IF;

  INSERT INTO public.trips (
    car_id,
    guest_id,
    start_at,
    end_at,
    status,
    payment_status,
    currency,
    pickup_location,
    return_location,
    total_cents,
    pricing_breakdown
  )
  VALUES (
    p_car_id,
    v_user_id,
    p_start_at,
    p_end_at,
    'draft',
    'unpaid',
    COALESCE(NULLIF(v_currency, ''), 'CAD'),
    COALESCE(NULLIF(p_pickup_location, ''), v_default_location),
    COALESCE(NULLIF(p_return_location, ''), v_default_location),
    NULL,
    NULL
  )
  RETURNING id INTO v_trip_id;

  INSERT INTO public.booking_holds (
    trip_id,
    car_id,
    guest_id,
    start_at,
    end_at,
    expires_at,
    status
  )
  VALUES (
    v_trip_id,
    p_car_id,
    v_user_id,
    p_start_at,
    p_end_at,
    v_expiry,
    'active'
  );

  INSERT INTO public.trip_events (
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    v_trip_id,
    v_user_id,
    'booking_hold_created',
    jsonb_build_object(
      'expires_at', v_expiry,
      'start_at', p_start_at,
      'end_at', p_end_at
    )
  );

  RETURN QUERY SELECT v_trip_id, v_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_draft_and_hold(uuid,timestamptz,timestamptz,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_draft_and_hold(uuid,timestamptz,timestamptz,text,text)
  TO authenticated, service_role;

-- Draft trips must now be created through the atomic hold RPC.
DROP POLICY IF EXISTS "trips_guest_insert" ON public.trips;

CREATE OR REPLACE FUNCTION public.extend_booking_hold_for_checkout(
  p_trip_id uuid,
  p_expires_at timestamptz
)
RETURNS public.booking_holds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.booking_holds;
BEGIN
  IF p_expires_at <= now() OR p_expires_at > now() + interval '40 minutes' THEN
    RAISE EXCEPTION 'invalid_hold_expiry' USING ERRCODE = '22023';
  END IF;

  SELECT h.* INTO v_hold
  FROM public.booking_holds h
  JOIN public.trips t ON t.id = h.trip_id
  WHERE h.trip_id = p_trip_id
    AND h.status = 'active'
    AND h.expires_at > now()
    AND t.status IN ('draft','pending_payment')
  FOR UPDATE OF h;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_hold_not_active' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.booking_holds
  SET expires_at = p_expires_at,
      updated_at = now()
  WHERE id = v_hold.id
  RETURNING * INTO v_hold;

  RETURN v_hold;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_booking_hold_for_checkout(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_booking_hold_for_checkout(uuid,timestamptz)
  TO service_role;

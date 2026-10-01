-- Keep the tracking ingest authority reproducible from source control.
CREATE OR REPLACE FUNCTION public.rentauto_ingest_location(
  p_provider text,
  p_device_identifier text,
  p_lat numeric,
  p_lng numeric,
  p_speed_kmh numeric DEFAULT NULL::numeric,
  p_heading numeric DEFAULT NULL::numeric,
  p_accuracy_meters numeric DEFAULT NULL::numeric,
  p_recorded_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'pg_temp'
AS $$
DECLARE
  v_device rentauto.vehicle_tracking_devices%ROWTYPE;
  v_session rentauto.trip_tracking_sessions%ROWTYPE;
  v_trip rentauto.trips%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_provider IS NULL OR btrim(p_provider) = ''
     OR char_length(p_provider) > 100
     OR p_device_identifier IS NULL
     OR btrim(p_device_identifier) = ''
     OR char_length(p_device_identifier) > 128 THEN
    RAISE EXCEPTION 'invalid_tracking_device' USING ERRCODE = '22023';
  END IF;

  IF p_lat IS NULL OR p_lat < -90 OR p_lat > 90
     OR p_lng IS NULL OR p_lng < -180 OR p_lng > 180
     OR (p_speed_kmh IS NOT NULL AND (p_speed_kmh < 0 OR p_speed_kmh >= 400))
     OR (p_heading IS NOT NULL AND (p_heading < 0 OR p_heading >= 360))
     OR (p_accuracy_meters IS NOT NULL AND (p_accuracy_meters < 0 OR p_accuracy_meters > 100000)) THEN
    RAISE EXCEPTION 'invalid_tracking_payload' USING ERRCODE = '22023';
  END IF;

  IF p_recorded_at IS NULL
     OR p_recorded_at > v_now + interval '5 minutes'
     OR p_recorded_at < v_now - interval '24 hours' THEN
    RAISE EXCEPTION 'invalid_tracking_timestamp' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_device
  FROM rentauto.vehicle_tracking_devices
  WHERE provider = p_provider
    AND device_identifier = p_device_identifier
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tracking_device_not_registered' USING ERRCODE = 'P0002';
  END IF;

  UPDATE rentauto.vehicle_tracking_devices
  SET
    last_seen_at = GREATEST(COALESCE(last_seen_at, p_recorded_at), p_recorded_at),
    updated_at = v_now
  WHERE id = v_device.id;

  SELECT *
  INTO v_session
  FROM rentauto.trip_tracking_sessions
  WHERE car_id = v_device.car_id
    AND status = 'active'
  ORDER BY started_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'recorded', false,
      'reason', 'no_active_session'
    );
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = v_session.trip_id;

  IF NOT FOUND OR v_trip.status <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'recorded', false,
      'reason', 'trip_not_active'
    );
  END IF;

  IF v_session.started_at IS NULL
     OR p_recorded_at < v_session.started_at - interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'recorded', false,
      'reason', 'outside_active_window'
    );
  END IF;

  INSERT INTO rentauto.vehicle_location_events (
    trip_id,
    car_id,
    lat,
    lng,
    speed_kmh,
    heading,
    accuracy_meters,
    source,
    recorded_at
  )
  VALUES (
    v_session.trip_id,
    v_device.car_id,
    p_lat,
    p_lng,
    p_speed_kmh,
    p_heading,
    p_accuracy_meters,
    p_provider,
    p_recorded_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'recorded', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_ingest_location(
  text,text,numeric,numeric,numeric,numeric,numeric,timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rentauto_ingest_location(
  text,text,numeric,numeric,numeric,numeric,numeric,timestamptz
) TO service_role;


-- Phase 3: Business-logic abuse hardening — duplicate prevention & payload validation.

-- 1) One review per (trip, reviewer)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_trip_reviewer
  ON public.reviews (trip_id, reviewer_id)
  WHERE trip_id IS NOT NULL;

-- 2) Only one active tracking session per trip
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tts_one_active_per_trip
  ON public.trip_tracking_sessions (trip_id)
  WHERE status = 'active';

-- 3) GPS payload validation — reject impossible coordinates / negative speeds
ALTER TABLE public.vehicle_location_events
  DROP CONSTRAINT IF EXISTS vle_lat_range,
  DROP CONSTRAINT IF EXISTS vle_lng_range,
  DROP CONSTRAINT IF EXISTS vle_speed_nonneg,
  DROP CONSTRAINT IF EXISTS vle_accuracy_nonneg;

ALTER TABLE public.vehicle_location_events
  ADD CONSTRAINT vle_lat_range CHECK (lat BETWEEN -90 AND 90),
  ADD CONSTRAINT vle_lng_range CHECK (lng BETWEEN -180 AND 180),
  ADD CONSTRAINT vle_speed_nonneg CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
  ADD CONSTRAINT vle_accuracy_nonneg CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0);

-- 4) Throttle support indexes (used by future limiters / dashboards)
CREATE INDEX IF NOT EXISTS idx_trips_guest_created ON public.trips (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_reporter_created ON public.trip_incidents (reporter_user_id, created_at DESC);

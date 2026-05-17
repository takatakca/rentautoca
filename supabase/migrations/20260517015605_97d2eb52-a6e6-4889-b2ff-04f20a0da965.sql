
-- ============ CARS additions ============
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS instant_book boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_consent_required boolean NOT NULL DEFAULT true;

-- ============ vehicle_tracking_devices ============
CREATE TABLE IF NOT EXISTS public.vehicle_tracking_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mock',
  device_identifier text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  installed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, device_identifier)
);
CREATE INDEX IF NOT EXISTS idx_vtd_car ON public.vehicle_tracking_devices(car_id);
ALTER TABLE public.vehicle_tracking_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY vtd_host_read ON public.vehicle_tracking_devices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_id AND c.host_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY vtd_host_insert ON public.vehicle_tracking_devices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_id AND c.host_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY vtd_host_update ON public.vehicle_tracking_devices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_id AND c.host_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY vtd_host_delete ON public.vehicle_tracking_devices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_id AND c.host_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_vtd_updated BEFORE UPDATE ON public.vehicle_tracking_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ trip_tracking_sessions ============
CREATE TABLE IF NOT EXISTS public.trip_tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  car_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  host_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  consent_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tts_trip ON public.trip_tracking_sessions(trip_id);
CREATE INDEX IF NOT EXISTS idx_tts_car_active ON public.trip_tracking_sessions(car_id) WHERE status = 'active';
ALTER TABLE public.trip_tracking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tts_participants_read ON public.trip_tracking_sessions FOR SELECT USING (
  auth.uid() = guest_id OR auth.uid() = host_id OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY tts_guest_insert ON public.trip_tracking_sessions FOR INSERT WITH CHECK (
  auth.uid() = guest_id
);
CREATE POLICY tts_participants_update ON public.trip_tracking_sessions FOR UPDATE USING (
  auth.uid() = guest_id OR auth.uid() = host_id OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_tts_updated BEFORE UPDATE ON public.trip_tracking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ vehicle_location_events ============
CREATE TABLE IF NOT EXISTS public.vehicle_location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  car_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  speed_kmh numeric,
  heading numeric,
  accuracy_meters numeric,
  source text NOT NULL DEFAULT 'mock',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vle_trip_time ON public.vehicle_location_events(trip_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vle_car_time ON public.vehicle_location_events(car_id, recorded_at DESC);
ALTER TABLE public.vehicle_location_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY vle_participants_read ON public.vehicle_location_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    LEFT JOIN public.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
);
-- No INSERT/UPDATE/DELETE policies — only service role (edge function) can write.

-- ============ trip_events ============
CREATE TABLE IF NOT EXISTS public.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  actor_user_id uuid,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_te_trip ON public.trip_events(trip_id, created_at DESC);
ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY te_participants_read ON public.trip_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    LEFT JOIN public.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY te_participants_insert ON public.trip_events FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips t
    LEFT JOIN public.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
);

-- ============ trip_incidents ============
CREATE TABLE IF NOT EXISTS public.trip_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  reporter_user_id uuid NOT NULL,
  type text NOT NULL,
  description text,
  photo_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ti_trip ON public.trip_incidents(trip_id);
ALTER TABLE public.trip_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY ti_participants_read ON public.trip_incidents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    LEFT JOIN public.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY ti_participants_insert ON public.trip_incidents FOR INSERT WITH CHECK (
  auth.uid() = reporter_user_id AND (
    EXISTS (
      SELECT 1 FROM public.trips t
      LEFT JOIN public.cars c ON c.id = t.car_id
      WHERE t.id = trip_id
        AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
    ) OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY ti_participants_update ON public.trip_incidents FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    LEFT JOIN public.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_ti_updated BEFORE UPDATE ON public.trip_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE: trip-photos ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Participants can read trip photos (path prefix = tripId)
CREATE POLICY "trip_photos_participants_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-photos' AND (
      EXISTS (
        SELECT 1 FROM public.trips t
        LEFT JOIN public.cars c ON c.id = t.car_id
        WHERE t.id::text = (storage.foldername(name))[1]
          AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
      ) OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "trip_photos_participants_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-photos' AND (
      EXISTS (
        SELECT 1 FROM public.trips t
        LEFT JOIN public.cars c ON c.id = t.car_id
        WHERE t.id::text = (storage.foldername(name))[1]
          AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
      ) OR public.has_role(auth.uid(), 'admin')
    )
  );

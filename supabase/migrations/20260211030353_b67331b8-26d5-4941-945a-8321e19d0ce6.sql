
-- ============================================
-- VEHICLES (cars) TABLE
-- ============================================
CREATE TABLE public.cars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','disabled','paused','draft')),
  title text NOT NULL DEFAULT '',
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year int NOT NULL DEFAULT 2020,
  trim text,
  description text,
  body_type text,
  seats int NOT NULL DEFAULT 5,
  doors int NOT NULL DEFAULT 4,
  fuel_type text NOT NULL DEFAULT 'regular' CHECK (fuel_type IN ('regular','premium','diesel','electric','hybrid')),
  consumption_l_per_100km numeric(4,1),
  transmission text NOT NULL DEFAULT 'automatic' CHECK (transmission IN ('automatic','manual')),
  features jsonb DEFAULT '{"safety":[],"connectivity":[]}'::jsonb,
  rules jsonb DEFAULT '{"no_smoking":true,"keep_tidy":true,"refuel":true,"no_offroad":true,"smoking_fee_cents":15000,"tidy_fee_cents":15000,"telematics_disclosure":"Vehicle may have a device that collects driving and location data."}'::jsonb,
  base_daily_price_cents int NOT NULL DEFAULT 5000,
  currency text NOT NULL DEFAULT 'CAD',
  included_km_per_day int NOT NULL DEFAULT 300,
  extra_km_price_cents int NOT NULL DEFAULT 29,
  location_label text,
  lat numeric(10,7),
  lng numeric(10,7),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cars_public_read" ON public.cars FOR SELECT USING (true);
CREATE POLICY "cars_host_insert" ON public.cars FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "cars_host_update" ON public.cars FOR UPDATE USING (auth.uid() = host_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "cars_host_delete" ON public.cars FOR DELETE USING (auth.uid() = host_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_cars_updated_at BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- CAR PHOTOS
-- ============================================
CREATE TABLE public.car_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.car_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car_photos_public_read" ON public.car_photos FOR SELECT USING (true);
CREATE POLICY "car_photos_host_insert" ON public.car_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));
CREATE POLICY "car_photos_host_delete" ON public.car_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));

-- ============================================
-- CAR EXTRAS
-- ============================================
CREATE TABLE public.car_extras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents int NOT NULL DEFAULT 0,
  pricing_type text NOT NULL DEFAULT 'per_trip' CHECK (pricing_type IN ('per_trip','per_day')),
  max_qty int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.car_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car_extras_public_read" ON public.car_extras FOR SELECT USING (true);
CREATE POLICY "car_extras_host_manage" ON public.car_extras FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));
CREATE POLICY "car_extras_host_update" ON public.car_extras FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));
CREATE POLICY "car_extras_host_delete" ON public.car_extras FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));

-- ============================================
-- CANCELLATION POLICIES
-- ============================================
CREATE TABLE public.cancellation_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  summary text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cancellation_policies_public_read" ON public.cancellation_policies FOR SELECT USING (true);

-- Seed default policy
INSERT INTO public.cancellation_policies (name, summary, rules) VALUES
  ('Free cancellation', 'Full refund within 24 hours of booking. More flexible options available at checkout.', '{"refund_window_hours":24,"refund_percentage":100}');

-- ============================================
-- CAR ↔ CANCELLATION POLICY LINK
-- ============================================
CREATE TABLE public.car_policies (
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  cancellation_policy_id uuid NOT NULL REFERENCES public.cancellation_policies(id) ON DELETE CASCADE,
  PRIMARY KEY (car_id, cancellation_policy_id)
);

ALTER TABLE public.car_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "car_policies_public_read" ON public.car_policies FOR SELECT USING (true);
CREATE POLICY "car_policies_host_manage" ON public.car_policies FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));
CREATE POLICY "car_policies_host_delete" ON public.car_policies FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  trip_id uuid,
  reviewer_id uuid NOT NULL,
  rating_overall numeric(2,1) NOT NULL CHECK (rating_overall >= 1 AND rating_overall <= 5),
  rating_cleanliness numeric(2,1) CHECK (rating_cleanliness >= 1 AND rating_cleanliness <= 5),
  rating_maintenance numeric(2,1) CHECK (rating_maintenance >= 1 AND rating_maintenance <= 5),
  rating_communication numeric(2,1) CHECK (rating_communication >= 1 AND rating_communication <= 5),
  rating_convenience numeric(2,1) CHECK (rating_convenience >= 1 AND rating_convenience <= 5),
  rating_accuracy numeric(2,1) CHECK (rating_accuracy >= 1 AND rating_accuracy <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_author_insert" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- ============================================
-- TRIPS (booking requests + bookings unified)
-- ============================================
CREATE TABLE public.trips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  pickup_location text,
  return_location text,
  status text NOT NULL DEFAULT 'quote' CHECK (status IN ('quote','requested','approved','declined','cancelled','booked','completed')),
  pricing_breakdown jsonb,
  total_cents int,
  currency text NOT NULL DEFAULT 'CAD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_own_read" ON public.trips FOR SELECT
  USING (auth.uid() = guest_id OR EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "trips_guest_insert" ON public.trips FOR INSERT WITH CHECK (auth.uid() = guest_id);
CREATE POLICY "trips_update" ON public.trips FOR UPDATE
  USING (auth.uid() = guest_id OR EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- AVAILABILITY BLOCKS
-- ============================================
CREATE TABLE public.availability_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  type text NOT NULL DEFAULT 'blocked' CHECK (type IN ('booking','maintenance','blocked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_blocks_public_read" ON public.availability_blocks FOR SELECT USING (true);
CREATE POLICY "availability_blocks_host_insert" ON public.availability_blocks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));
CREATE POLICY "availability_blocks_host_update" ON public.availability_blocks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));
CREATE POLICY "availability_blocks_host_delete" ON public.availability_blocks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cars WHERE cars.id = car_id AND cars.host_id = auth.uid()));

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_cars_host_id ON public.cars(host_id);
CREATE INDEX idx_cars_status ON public.cars(status);
CREATE INDEX idx_car_photos_car_id ON public.car_photos(car_id);
CREATE INDEX idx_car_extras_car_id ON public.car_extras(car_id);
CREATE INDEX idx_reviews_car_id ON public.reviews(car_id);
CREATE INDEX idx_trips_car_id ON public.trips(car_id);
CREATE INDEX idx_trips_guest_id ON public.trips(guest_id);
CREATE INDEX idx_availability_blocks_car_id ON public.availability_blocks(car_id);

-- ============================================
-- Add host profile fields to profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_all_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trips_count int NOT NULL DEFAULT 0;

-- ============================================
-- VEHICLE PHOTOS STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vehicle_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-photos');
CREATE POLICY "vehicle_photos_host_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.role() = 'authenticated');
CREATE POLICY "vehicle_photos_host_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

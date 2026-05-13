-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, car_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own"
ON public.favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own"
ON public.favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own"
ON public.favorites FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_car ON public.favorites(car_id);

-- Cars metadata for Explore filters
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS airport_pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_enabled boolean NOT NULL DEFAULT false;

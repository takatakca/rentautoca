ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS trips_stripe_session_id_idx ON public.trips (stripe_session_id);
CREATE INDEX IF NOT EXISTS trips_stripe_payment_intent_id_idx ON public.trips (stripe_payment_intent_id);
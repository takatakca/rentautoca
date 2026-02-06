
-- Fix set_updated_at to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create stripe_webhook_events table for idempotent webhook processing
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read (for debugging); no public insert/update/delete
CREATE POLICY "stripe_webhook_events_admin_read"
ON public.stripe_webhook_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

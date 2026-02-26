
-- Add vehicle verification fields to cars
ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS plate_number text,
ADD COLUMN IF NOT EXISTS vin text,
ADD COLUMN IF NOT EXISTS insurance_status text NOT NULL DEFAULT 'not_provided',
ADD COLUMN IF NOT EXISTS registration_url text,
ADD COLUMN IF NOT EXISTS insurance_url text;

-- Create protection plans table
CREATE TABLE public.protection_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL, -- basic, standard, premium
  description text,
  coverage_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_per_day_cents integer NOT NULL DEFAULT 0,
  deductible_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protection_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protection_plans_public_read"
ON public.protection_plans FOR SELECT
USING (true);

-- Seed the 3 tiers
INSERT INTO public.protection_plans (name, tier, description, coverage_details, price_per_day_cents, deductible_cents, sort_order) VALUES
(
  'Basic',
  'basic',
  'Liability coverage only. You are responsible for damage to the host''s vehicle.',
  '[{"label": "Third-party liability", "included": true}, {"label": "Collision/comprehensive", "included": false}, {"label": "Roadside assistance", "included": false}, {"label": "Personal effects", "included": false}]'::jsonb,
  0,
  500000,
  1
),
(
  'Standard',
  'standard',
  'Collision and comprehensive coverage with a reduced deductible. Includes roadside assistance.',
  '[{"label": "Third-party liability", "included": true}, {"label": "Collision/comprehensive", "included": true}, {"label": "Roadside assistance", "included": true}, {"label": "Personal effects", "included": false}]'::jsonb,
  2500,
  100000,
  2
),
(
  'Premium',
  'premium',
  'Full coverage with the lowest deductible. Includes roadside assistance and personal effects protection.',
  '[{"label": "Third-party liability", "included": true}, {"label": "Collision/comprehensive", "included": true}, {"label": "Roadside assistance", "included": true}, {"label": "Personal effects", "included": true}]'::jsonb,
  4500,
  25000,
  3
);

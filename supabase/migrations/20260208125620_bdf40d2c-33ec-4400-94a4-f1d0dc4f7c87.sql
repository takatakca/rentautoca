
-- =============================================================
-- Phase A: Host Profile System
-- Extend profiles + verifications + preferences + storage
-- =============================================================

-- 1) Extend profiles with display_name and bio
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text;

-- 2) Host Verifications table
CREATE TABLE public.host_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  verification_status text NOT NULL DEFAULT 'not_started'
    CHECK (verification_status IN ('not_started', 'pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_verifications_select_own_or_admin"
  ON public.host_verifications FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "host_verifications_insert_own"
  ON public.host_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "host_verifications_update_own_or_admin"
  ON public.host_verifications FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_host_verifications_updated_at
  BEFORE UPDATE ON public.host_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Host Preferences table
CREATE TABLE public.host_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  min_trip_days integer DEFAULT 1,
  max_trip_days integer DEFAULT 30,
  advance_notice_hours integer DEFAULT 24,
  buffer_hours integer DEFAULT 4,
  delivery_available boolean DEFAULT false,
  delivery_radius_km integer,
  delivery_fee_cents integer,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_preferences_select_own_or_admin"
  ON public.host_preferences FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "host_preferences_insert_own"
  ON public.host_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "host_preferences_update_own_or_admin"
  ON public.host_preferences FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_host_preferences_updated_at
  BEFORE UPDATE ON public.host_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Storage buckets
INSERT INTO storage.buckets (id, name, public)
  VALUES ('profile-photos', 'profile-photos', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('ids-private', 'ids-private', false)
  ON CONFLICT (id) DO NOTHING;

-- 5) Storage policies: profile-photos (public read, user CRUD own folder)
CREATE POLICY "profile_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "profile_photos_user_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "profile_photos_user_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "profile_photos_user_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies: ids-private (user + admin read, user CRUD own folder)
CREATE POLICY "ids_private_user_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ids-private' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "ids_private_user_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ids-private' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ids_private_user_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ids-private' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ids_private_user_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ids-private' AND auth.uid()::text = (storage.foldername(name))[1]);

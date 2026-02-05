-- 1) ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('guest','host','admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) PROVINCES (Canada only)
CREATE TABLE IF NOT EXISTS public.provinces (
  code text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_supported boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_provinces_supported_sort
  ON public.provinces (is_supported, sort_order);

-- 3) PROFILES (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  phone_verified boolean NOT NULL DEFAULT false,
  id_verified boolean NOT NULL DEFAULT false,
  province text REFERENCES public.provinces(code),
  city text,
  postal_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_province ON public.profiles(province);

-- 4) USER ROLES (many roles per user allowed)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 5) STRIPE ACCOUNTS (stub for Phase 2)
CREATE TABLE IF NOT EXISTS public.stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- 6) updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_stripe_accounts_updated_at ON public.stripe_accounts;
CREATE TRIGGER trg_stripe_accounts_updated_at
BEFORE UPDATE ON public.stripe_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Helper: does user have role? (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  )
$$;

-- 8) Auto-create guest role + profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- RLS
-- =========================
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Provinces: readable by anyone
DROP POLICY IF EXISTS "provinces_read_all" ON public.provinces;
CREATE POLICY "provinces_read_all"
ON public.provinces FOR SELECT
USING (true);

-- Profiles: user can read/update their own; admins can read all
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Roles: user can read their own; admins can read all
DROP POLICY IF EXISTS "roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "roles_select_own_or_admin"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Roles insert: user can add their own host role; admin can insert any
DROP POLICY IF EXISTS "roles_insert_self_host_or_admin" ON public.user_roles;
CREATE POLICY "roles_insert_self_host_or_admin"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (auth.uid() = user_id AND role = 'host')
);

-- Roles update/delete: admin only
DROP POLICY IF EXISTS "roles_admin_update" ON public.user_roles;
CREATE POLICY "roles_admin_update"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "roles_admin_delete" ON public.user_roles;
CREATE POLICY "roles_admin_delete"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Stripe accounts: user can read/write their own; admin can read all
DROP POLICY IF EXISTS "stripe_accounts_select_own_or_admin" ON public.stripe_accounts;
CREATE POLICY "stripe_accounts_select_own_or_admin"
ON public.stripe_accounts FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "stripe_accounts_insert_own_or_admin" ON public.stripe_accounts;
CREATE POLICY "stripe_accounts_insert_own_or_admin"
ON public.stripe_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "stripe_accounts_update_own_or_admin" ON public.stripe_accounts;
CREATE POLICY "stripe_accounts_update_own_or_admin"
ON public.stripe_accounts FOR UPDATE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
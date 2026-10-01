-- Safe Rentauto vehicle read surfaces.
-- Public discovery must never expose VIN, plate or document paths.

CREATE OR REPLACE FUNCTION rentauto.car_is_public(p_car_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id = p_car_id
      AND c.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION rentauto.can_manage_car(p_car_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id = p_car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  );
$$;

REVOKE ALL ON FUNCTION rentauto.car_is_public(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rentauto.can_manage_car(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.car_is_public(uuid)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.can_manage_car(uuid)
TO authenticated;

DROP POLICY IF EXISTS rentauto_cars_read ON rentauto.cars;
DROP POLICY IF EXISTS rentauto_cars_owner_read ON rentauto.cars;
CREATE POLICY rentauto_cars_owner_read
ON rentauto.cars
FOR SELECT
TO authenticated
USING (rentauto.can_manage_car(id));

REVOKE SELECT ON TABLE rentauto.cars FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rentauto.cars TO authenticated;

CREATE OR REPLACE VIEW rentauto.cars_public
WITH (security_barrier = true)
AS
SELECT
  c.id, c.host_id, c.status, c.title, c.make, c.model, c.year, c.trim,
  c.description, c.body_type, c.seats, c.doors, c.fuel_type,
  c.consumption_l_per_100km, c.transmission, c.features, c.rules,
  c.base_daily_price_cents, c.currency, c.included_km_per_day,
  c.extra_km_price_cents, c.location_label,
  round(c.lat::numeric, 2)::double precision AS lat,
  round(c.lng::numeric, 2)::double precision AS lng,
  c.airport_pickup_enabled, c.monthly_enabled, c.category, c.instant_book,
  c.tracking_consent_required, c.created_at
FROM rentauto.cars c
WHERE c.status = 'active';

REVOKE ALL ON TABLE rentauto.cars_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE rentauto.cars_public TO anon, authenticated;

CREATE OR REPLACE VIEW rentauto.cars_accessible
WITH (security_barrier = true)
AS
SELECT
  c.id, c.host_id, c.status, c.title, c.make, c.model, c.year, c.trim,
  c.description, c.body_type, c.seats, c.doors, c.fuel_type,
  c.consumption_l_per_100km, c.transmission, c.features, c.rules,
  c.base_daily_price_cents, c.currency, c.included_km_per_day,
  c.extra_km_price_cents, c.location_label,
  round(c.lat::numeric, 2)::double precision AS lat,
  round(c.lng::numeric, 2)::double precision AS lng,
  c.airport_pickup_enabled, c.monthly_enabled, c.category, c.instant_book,
  c.tracking_consent_required, c.created_at
FROM rentauto.cars c
WHERE
  c.status = 'active'
  OR c.host_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
  OR EXISTS (
    SELECT 1 FROM rentauto.trips t
    WHERE t.car_id = c.id
      AND t.guest_id = auth.uid()
  );

REVOKE ALL ON TABLE rentauto.cars_accessible FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE rentauto.cars_accessible TO authenticated;

DROP POLICY IF EXISTS rentauto_car_photos_read ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_read
ON rentauto.car_photos FOR SELECT TO anon, authenticated
USING (
  rentauto.car_is_public(car_id)
  OR (auth.uid() IS NOT NULL AND rentauto.can_manage_car(car_id))
);

DROP POLICY IF EXISTS rentauto_car_photos_host_insert ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_host_insert
ON rentauto.car_photos FOR INSERT TO authenticated
WITH CHECK (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_photos_host_delete ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_host_delete
ON rentauto.car_photos FOR DELETE TO authenticated
USING (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_extras_read ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_read
ON rentauto.car_extras FOR SELECT TO anon, authenticated
USING (
  (is_active AND rentauto.car_is_public(car_id))
  OR (auth.uid() IS NOT NULL AND rentauto.can_manage_car(car_id))
);

DROP POLICY IF EXISTS rentauto_car_extras_host_insert ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_host_insert
ON rentauto.car_extras FOR INSERT TO authenticated
WITH CHECK (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_extras_host_update ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_host_update
ON rentauto.car_extras FOR UPDATE TO authenticated
USING (rentauto.can_manage_car(car_id))
WITH CHECK (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_extras_host_delete ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_host_delete
ON rentauto.car_extras FOR DELETE TO authenticated
USING (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_policies_read ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_read
ON rentauto.car_policies FOR SELECT TO anon, authenticated
USING (
  rentauto.car_is_public(car_id)
  OR (auth.uid() IS NOT NULL AND rentauto.can_manage_car(car_id))
);

DROP POLICY IF EXISTS rentauto_car_policies_host_insert ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_host_insert
ON rentauto.car_policies FOR INSERT TO authenticated
WITH CHECK (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_policies_host_update ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_host_update
ON rentauto.car_policies FOR UPDATE TO authenticated
USING (rentauto.can_manage_car(car_id))
WITH CHECK (rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_policies_host_delete ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_host_delete
ON rentauto.car_policies FOR DELETE TO authenticated
USING (rentauto.can_manage_car(car_id));

CREATE OR REPLACE VIEW rentauto.availability_public
WITH (security_barrier = true)
AS
SELECT a.car_id, a.start_at, a.end_at
FROM rentauto.availability_blocks a
WHERE a.end_at > now()
  AND rentauto.car_is_public(a.car_id);

REVOKE ALL ON TABLE rentauto.availability_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE rentauto.availability_public TO anon, authenticated;

DROP POLICY IF EXISTS rentauto_availability_read ON rentauto.availability_blocks;
DROP POLICY IF EXISTS rentauto_availability_host_read ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_host_read
ON rentauto.availability_blocks FOR SELECT TO authenticated
USING (rentauto.can_manage_car(car_id));

REVOKE SELECT ON TABLE rentauto.availability_blocks FROM anon;
GRANT SELECT ON TABLE rentauto.availability_blocks TO authenticated;

DROP POLICY IF EXISTS rentauto_availability_host_insert ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_host_insert
ON rentauto.availability_blocks FOR INSERT TO authenticated
WITH CHECK (type <> 'booking_self' AND rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_availability_host_update ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_host_update
ON rentauto.availability_blocks FOR UPDATE TO authenticated
USING (type <> 'booking_self' AND rentauto.can_manage_car(car_id))
WITH CHECK (type <> 'booking_self' AND rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_availability_host_delete ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_host_delete
ON rentauto.availability_blocks FOR DELETE TO authenticated
USING (type <> 'booking_self' AND rentauto.can_manage_car(car_id));

DROP POLICY IF EXISTS rentauto_car_photos_read ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_read
ON rentauto.car_photos
FOR SELECT
TO anon, authenticated
USING (
  rentauto.car_is_public(car_id)
  OR (
    (SELECT auth.uid()) IS NOT NULL
    AND rentauto.can_manage_car(car_id)
  )
);

DROP POLICY IF EXISTS rentauto_car_extras_read ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_read
ON rentauto.car_extras
FOR SELECT
TO anon, authenticated
USING (
  (is_active AND rentauto.car_is_public(car_id))
  OR (
    (SELECT auth.uid()) IS NOT NULL
    AND rentauto.can_manage_car(car_id)
  )
);

DROP POLICY IF EXISTS rentauto_car_policies_read ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_read
ON rentauto.car_policies
FOR SELECT
TO anon, authenticated
USING (
  rentauto.car_is_public(car_id)
  OR (
    (SELECT auth.uid()) IS NOT NULL
    AND rentauto.can_manage_car(car_id)
  )
);

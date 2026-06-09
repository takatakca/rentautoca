
-- 1. trips: drop broad client UPDATE; all state changes go through edge functions (service role)
DROP POLICY IF EXISTS trips_update ON public.trips;

-- 2. storage: fix vehicle-photos delete to verify car ownership
DROP POLICY IF EXISTS vehicle_photos_host_delete ON storage.objects;
CREATE POLICY vehicle_photos_host_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'vehicle-photos'
    AND (
      EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.host_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Also harden update policy on the same bucket the same way
DROP POLICY IF EXISTS vehicle_photos_host_update ON storage.objects;
CREATE POLICY vehicle_photos_host_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'vehicle-photos'
    AND (
      EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.host_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 3. trip_tracking_sessions: add WITH CHECK so update can't reassign guest_id/host_id/trip_id
DROP POLICY IF EXISTS tts_participants_update ON public.trip_tracking_sessions;
CREATE POLICY tts_participants_update ON public.trip_tracking_sessions
  FOR UPDATE
  USING (auth.uid() = guest_id OR auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = guest_id OR auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'));

-- 4. host_verifications: prevent self-promotion to verified by restricting status writes to admins.
--    Users can still INSERT and refresh document URLs; admins control verification status.
DROP POLICY IF EXISTS host_verifications_update_own_or_admin ON public.host_verifications;
CREATE POLICY host_verifications_update_admin_only ON public.host_verifications
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. trip_incidents: lock UPDATE WITH CHECK to original participants (prevent moving incident to a different trip)
DROP POLICY IF EXISTS ti_participants_update ON public.trip_incidents;
CREATE POLICY ti_participants_update ON public.trip_incidents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      LEFT JOIN public.cars c ON c.id = t.car_id
      WHERE t.id = trip_incidents.trip_id
        AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      LEFT JOIN public.cars c ON c.id = t.car_id
      WHERE t.id = trip_incidents.trip_id
        AND (t.guest_id = auth.uid() OR c.host_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

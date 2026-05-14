
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_policies' AND policyname='car_policies_host_update') THEN
    CREATE POLICY "car_policies_host_update"
    ON public.car_policies FOR UPDATE
    USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = car_policies.car_id AND cars.host_id = auth.uid()));
  END IF;
END $$;

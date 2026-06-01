ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_location_events;
ALTER TABLE public.vehicle_location_events REPLICA IDENTITY FULL;
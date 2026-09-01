CREATE SEQUENCE IF NOT EXISTS public.booking_reference_seq START WITH 100 INCREMENT BY 1;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS booking_reference text;

CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'RA-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
         lpad(nextval('public.booking_reference_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_booking_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_reference IS NULL THEN
    NEW.booking_reference := public.generate_booking_reference();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_booking_reference ON public.trips;
CREATE TRIGGER trg_trips_booking_reference
BEFORE INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.set_booking_reference();

UPDATE public.trips
SET booking_reference = public.generate_booking_reference()
WHERE booking_reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trips_booking_reference_key
  ON public.trips (booking_reference);
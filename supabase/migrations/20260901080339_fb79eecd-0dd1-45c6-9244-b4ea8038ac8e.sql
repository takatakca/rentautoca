REVOKE ALL ON FUNCTION public.generate_booking_reference() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_booking_reference() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.booking_reference_seq FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_booking_reference() TO service_role;
GRANT USAGE ON SEQUENCE public.booking_reference_seq TO service_role;
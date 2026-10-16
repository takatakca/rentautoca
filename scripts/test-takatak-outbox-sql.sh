#!/usr/bin/env bash
set -euo pipefail
# Explicitly refuse a real customer database.
if [[ "$PGDATABASE" != "rentauto_outbox_ci" ]]; then
  echo "Refusing to run outside disposable rentauto_outbox_ci database" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA rentauto;
CREATE TABLE rentauto.accounts (
  auth_user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rentauto.trips (
  id uuid PRIMARY KEY,guest_id uuid NOT NULL,status text NOT NULL,
  booking_reference text,payment_status text,total_cents integer,currency text
);
CREATE TABLE public.source_profiles (
  "externalUserId" text,"sourceApplication" text,"collectedFields" jsonb,
  "verifiedFields" text[],"consentRecords" jsonb,"lastSynchronizedAt" timestamptz
);
SQL
psql -X -v ON_ERROR_STOP=1 -f supabase/staged/rentauto-takatak-outbox-v1.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
BEGIN
  IF (SELECT enabled FROM rentauto.takatak_sync_settings WHERE singleton)
    OR has_table_privilege('anon','rentauto.takatak_event_outbox','SELECT')
    OR has_table_privilege('authenticated','rentauto.takatak_event_outbox','INSERT')
    OR has_function_privilege('anon','public.rentauto_claim_takatak_outbox(integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.rentauto_mark_takatak_outbox_processed(uuid,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.rentauto_claim_takatak_outbox(integer)','EXECUTE')
  THEN RAISE EXCEPTION 'Fail-closed outbox privileges or gate violated'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid='rentauto.takatak_event_outbox'::regclass)
  THEN RAISE EXCEPTION 'Missing RLS'; END IF;
END $verify$;
INSERT INTO public.source_profiles VALUES (
  '22222222-2222-4222-8222-222222222222','RENTAUTO',
  '{"firstName":"CI","email":"ci@example.test"}'::jsonb,ARRAY['email'],
  '[]'::jsonb,now()
);
INSERT INTO rentauto.accounts(auth_user_id) VALUES
  ('22222222-2222-4222-8222-222222222222');
DO $verify$
BEGIN
  IF (SELECT count(*) FROM rentauto.takatak_event_outbox) <> 0
  THEN RAISE EXCEPTION 'Outbox unexpectedly enabled'; END IF;
END $verify$;
UPDATE rentauto.takatak_sync_settings SET enabled=true WHERE singleton;
INSERT INTO public.source_profiles VALUES (
  '33333333-3333-4333-8333-333333333333','RENTAUTO',
  '{"firstName":"CI","email":"ci2@example.test"}'::jsonb,ARRAY['email'],
  '[]'::jsonb,now()
);
INSERT INTO rentauto.accounts(auth_user_id) VALUES
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO rentauto.trips VALUES (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'confirmed','CI-RENTAL','pending',12000,'CAD'
);
UPDATE rentauto.trips SET payment_status='paid';
UPDATE rentauto.trips SET payment_status='paid';
DO $verify$
DECLARE row_claim record; count_claims integer:=0;
BEGIN
  IF (SELECT count(*) FROM rentauto.takatak_event_outbox)<>2
  THEN RAISE EXCEPTION 'Expected only registration and one payment event'; END IF;
  FOR row_claim IN SELECT * FROM public.rentauto_claim_takatak_outbox(10) LOOP
    count_claims:=count_claims+1;
    IF row_claim.lock_token IS NULL OR row_claim.attempt_count<>1
    THEN RAISE EXCEPTION 'Lease acquisition failed'; END IF;
    IF public.rentauto_mark_takatak_outbox_processed(row_claim.id,gen_random_uuid())
    THEN RAISE EXCEPTION 'Stale token incorrectly accepted'; END IF;
    IF row_claim.event_type='CUSTOMER_REGISTERED' THEN
      IF NOT public.rentauto_mark_takatak_outbox_processed(row_claim.id,row_claim.lock_token)
      THEN RAISE EXCEPTION 'Valid ack rejected'; END IF;
    ELSE
      IF NOT public.rentauto_mark_takatak_outbox_failed(row_claim.id,row_claim.lock_token,'ci_retry')
      THEN RAISE EXCEPTION 'Retry failed'; END IF;
    END IF;
  END LOOP;
  IF count_claims<>2 THEN RAISE EXCEPTION 'Wrong claim count'; END IF;
END $verify$;
UPDATE rentauto.takatak_event_outbox SET next_attempt_at=now()-interval '1 second'
WHERE status='failed';
DO $verify$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.rentauto_claim_takatak_outbox(1);
  IF r.id IS NULL OR r.attempt_count<>2 THEN
    RAISE EXCEPTION 'Retry was not claimed'; END IF;
  IF NOT public.rentauto_mark_takatak_outbox_processed(r.id,r.lock_token)
  THEN RAISE EXCEPTION 'Retry acknowledgement failed'; END IF;
END $verify$;
SQL
echo "Rentauto disposable PostgreSQL staging smoke passed."

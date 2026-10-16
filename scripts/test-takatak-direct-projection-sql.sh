#!/usr/bin/env bash
set -euo pipefail
# Execute only on disposable PostgreSQL; no shared production connection.
if [[ "$PGDATABASE" != "rentauto_projection_ci" ]]; then
  echo "Refusing non-disposable database" >&2
  exit 1
fi
source_sql=supabase/migrations/20261001041000_rentauto_takatak_order_projection.sql
grep -q '^create or replace function public.rentauto_record_payment_refund(' "$source_sql"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA rentauto;
CREATE SCHEMA auth;
CREATE TABLE rentauto.accounts(
  auth_user_id uuid PRIMARY KEY,master_identity_id uuid NOT NULL
);
CREATE TABLE rentauto.trips(
  id uuid PRIMARY KEY,guest_id uuid NOT NULL,car_id uuid,
  status text NOT NULL,payment_status text,total_cents integer,
  currency text,booking_reference text,
  start_at timestamptz,end_at timestamptz,pickup_location text,
  return_location text,pricing_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.source_marketplace_orders(
  id uuid PRIMARY KEY,"sourceApplication" text NOT NULL,
  "externalOrderId" text NOT NULL,"externalOrderNumber" text,
  "identityId" uuid,"sourceMerchantId" uuid,"companyId" uuid,
  "customerReference" text,total numeric,currency text,
  "paymentStatus" text,"fulfillmentStatus" text,
  "occurredAt" timestamp without time zone,"collectedFields" jsonb,
  "createdAt" timestamp without time zone,"updatedAt" timestamp without time zone,
  UNIQUE("sourceApplication","externalOrderId")
);
SQL
# Actual deployed migration source: extract only the direct-trip contract.
awk '/^create or replace function public.rentauto_record_payment_refund\(/ {exit} {print}' "$source_sql" |
  psql -X -v ON_ERROR_STOP=1
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $assert$
BEGIN
  IF has_function_privilege('authenticated',
    'rentauto.project_trip_to_takatak_marketplace_order(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role',
    'rentauto.project_trip_to_takatak_marketplace_order(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Rentauto direct projection RPC roles compromised'; END IF;
END $assert$;

INSERT INTO rentauto.accounts VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO rentauto.trips(
 id,guest_id,status,payment_status,total_cents,currency,booking_reference
) VALUES(
 '33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 'draft','pending',12345,'CAD','RA-CI-001'
);
DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM public.source_marketplace_orders)
 THEN RAISE EXCEPTION 'Draft trip leaked into TAKATAK'; END IF;
END $assert$;
UPDATE rentauto.trips SET status='confirmed' WHERE booking_reference='RA-CI-001';
DO $assert$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.source_marketplace_orders
  WHERE "externalOrderId"='33333333-3333-4333-8333-333333333333'
    AND "sourceApplication"='RENTAUTO'
    AND "identityId"='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND total=123.45 AND "paymentStatus"='PENDING'
    AND "fulfillmentStatus"='CONFIRMED')
 THEN RAISE EXCEPTION 'Initial order projection invalid'; END IF;
END $assert$;
UPDATE rentauto.trips SET payment_status='paid' WHERE booking_reference='RA-CI-001';
UPDATE rentauto.trips SET payment_status='paid' WHERE booking_reference='RA-CI-001';
UPDATE rentauto.trips SET payment_status='partially_refunded' WHERE booking_reference='RA-CI-001';
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.source_marketplace_orders)<>1
 THEN RAISE EXCEPTION 'Duplicate master order detected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.source_marketplace_orders
  WHERE "externalOrderId"='33333333-3333-4333-8333-333333333333'
  AND "paymentStatus"='PARTIALLY_REFUNDED')
 THEN RAISE EXCEPTION 'Refund state not projected'; END IF;
END $assert$;
INSERT INTO rentauto.trips(id,guest_id,status,payment_status,total_cents,currency,booking_reference)
VALUES('44444444-4444-4444-8444-444444444444',
'22222222-2222-4222-8222-222222222222','confirmed','paid',5088,'CAD','RA-CI-002');
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.source_marketplace_orders)<>2
 THEN RAISE EXCEPTION 'Cross-tenant upsert corrupted orders'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.source_marketplace_orders
  WHERE "externalOrderId"='44444444-4444-4444-8444-444444444444'
  AND "identityId"='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND total=50.88 AND "paymentStatus"='PAID')
 THEN RAISE EXCEPTION 'Second identity projection invalid'; END IF;
END $assert$;
SQL
echo "Direct TAKATAK projection SQL smoke passed on disposable PostgreSQL."

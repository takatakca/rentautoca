-- STAGING ONLY: DO NOT APPLY DIRECTLY TO THE SHARED TAKATAK PRODUCTION DB.
-- Old 20260930161000 outbox migration touches shared public.handle_new_user.
-- This isolated Rentauto schema migration is safe only after staging review.
-- No network events are emitted until settings.enabled is explicitly approved.

CREATE TABLE IF NOT EXISTS rentauto.takatak_sync_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rentauto.takatak_sync_settings(singleton,enabled)
VALUES (true,false) ON CONFLICT(singleton) DO NOTHING;
ALTER TABLE rentauto.takatak_sync_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rentauto.takatak_sync_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON rentauto.takatak_sync_settings TO service_role;

CREATE TABLE IF NOT EXISTS rentauto.takatak_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE CHECK (length(event_id) BETWEEN 1 AND 200),
  event_type text NOT NULL CHECK (event_type IN ('CUSTOMER_REGISTERED','PAYMENT_SUMMARY_UPDATED')),
  auth_user_id uuid NOT NULL,
  payload_json jsonb NOT NULL CHECK(jsonb_typeof(payload_json)='object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','failed','processed','dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rentauto_takatak_retry
  ON rentauto.takatak_event_outbox(next_attempt_at,created_at)
  WHERE status IN ('pending','failed','processing');
ALTER TABLE rentauto.takatak_event_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rentauto.takatak_event_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON rentauto.takatak_event_outbox TO service_role;

-- Lease tokens prevent stale workers from acknowledging another worker's claim.
CREATE OR REPLACE FUNCTION public.rentauto_claim_takatak_outbox(p_limit integer DEFAULT 20)
RETURNS SETOF rentauto.takatak_event_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  -- A disabled sync must stop claiming pending or retryable work too.
  IF NOT EXISTS (
    SELECT 1 FROM rentauto.takatak_sync_settings
    WHERE singleton=true AND enabled=true
  ) THEN RETURN; END IF;

  RETURN QUERY WITH candidates AS (
    SELECT o.id FROM rentauto.takatak_event_outbox o
    WHERE o.attempt_count<12 AND o.next_attempt_at<=now()
      AND (o.status IN ('pending','failed') OR
        (o.status='processing' AND o.locked_at<now()-interval '10 minutes'))
    ORDER BY o.created_at,o.id
    FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),50)
  )
  UPDATE rentauto.takatak_event_outbox o
  SET status='processing',attempt_count=o.attempt_count+1,
      lock_token=gen_random_uuid(),locked_at=now(),
      last_error=null,updated_at=now()
  FROM candidates c WHERE o.id=c.id RETURNING o.*;
END;
$$;
REVOKE ALL ON FUNCTION public.rentauto_claim_takatak_outbox(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_claim_takatak_outbox(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_mark_takatak_outbox_processed(
  p_id uuid,p_lock_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE rentauto.takatak_event_outbox
  SET status='processed',processed_at=now(),locked_at=null,
      lock_token=null,last_error=null,updated_at=now()
  WHERE id=p_id AND status='processing' AND lock_token=p_lock_token
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.rentauto_mark_takatak_outbox_processed(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_mark_takatak_outbox_processed(uuid,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_mark_takatak_outbox_failed(
  p_id uuid,p_lock_token uuid,p_error text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE rentauto.takatak_event_outbox
  SET status=CASE WHEN attempt_count>=12 THEN 'dead' ELSE 'failed' END,
      next_attempt_at=now()+make_interval(
        secs=>LEAST(3600,GREATEST(30,(2 ^ LEAST(attempt_count,8))::integer*15))
      ),
      locked_at=null,lock_token=null,
      last_error=left(COALESCE(p_error,'unknown_error'),200),updated_at=now()
  WHERE id=p_id AND status='processing' AND lock_token=p_lock_token
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.rentauto_mark_takatak_outbox_failed(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_mark_takatak_outbox_failed(uuid,uuid,text)
  TO service_role;

-- Only an explicitly authorized Rentauto account; no global auth/profile trigger.
CREATE OR REPLACE FUNCTION rentauto.takatak_queue_account_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_source record; v_id text; v_fields jsonb; v_verified jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM rentauto.takatak_sync_settings
                WHERE singleton=true AND enabled=true) THEN RETURN NEW; END IF;

  SELECT sp."collectedFields" AS fields,sp."verifiedFields" AS verified,
         sp."consentRecords" AS consent INTO v_source
  FROM public.source_profiles sp
  WHERE sp."sourceApplication"='RENTAUTO'
    AND (
      sp."externalUserId"=NEW.auth_user_id::text
      OR sp."identityId"=NEW.master_identity_id
    )
  ORDER BY sp."lastSynchronizedAt" DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_id:='rentauto-account-'||NEW.auth_user_id::text;
  v_fields:=jsonb_strip_nulls(jsonb_build_object(
    'firstName',v_source.fields->>'firstName',
    'lastName',v_source.fields->>'lastName',
    'email',v_source.fields->>'email',
    'phone',v_source.fields->>'phone',
    'locale',v_source.fields->>'locale',
    'registeredAt',NEW.created_at,
    'updatedAt',NEW.updated_at
  ));
  SELECT COALESCE(jsonb_agg(f.field),'[]'::jsonb) INTO v_verified
  FROM unnest(COALESCE(v_source.verified,ARRAY[]::text[])) AS f(field)
  WHERE f.field IN ('firstName','lastName','email','phone');

  INSERT INTO rentauto.takatak_event_outbox
    (event_id,event_type,auth_user_id,payload_json)
  VALUES (v_id,'CUSTOMER_REGISTERED',NEW.auth_user_id,
    jsonb_build_object(
      'eventId',v_id,'eventType','CUSTOMER_REGISTERED',
      'sourceApplication','RENTAUTO',
      'externalUserId',NEW.auth_user_id::text,
      'collectedFields',v_fields,'verifiedFields',v_verified,
      'consentRecords',CASE WHEN jsonb_typeof(v_source.consent)='array'
        THEN v_source.consent ELSE '[]'::jsonb END,
      'occurredAt',now()
    ))
  ON CONFLICT(event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rentauto.takatak_queue_account_created()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_rentauto_takatak_account_outbox ON rentauto.accounts;
CREATE TRIGGER trg_rentauto_takatak_account_outbox
AFTER INSERT ON rentauto.accounts FOR EACH ROW
EXECUTE FUNCTION rentauto.takatak_queue_account_created();

-- Trigger does not call or alter the existing direct TAKATAK order projection.
CREATE OR REPLACE FUNCTION rentauto.takatak_queue_payment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id text;v_status text;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
    OR NEW.status='draft' OR NEW.booking_reference IS NULL
    OR NOT EXISTS(SELECT 1 FROM rentauto.takatak_sync_settings
                  WHERE singleton=true AND enabled=true)
    OR NOT EXISTS(SELECT 1 FROM rentauto.accounts
                  WHERE auth_user_id=NEW.guest_id)
  THEN RETURN NEW; END IF;

  v_status:=CASE lower(COALESCE(NEW.payment_status,''))
    WHEN 'paid' THEN 'PAID'
    WHEN 'failed' THEN 'FAILED'
    WHEN 'refunded' THEN 'REFUNDED'
    WHEN 'partially_refunded' THEN 'PARTIALLY_REFUNDED'
    ELSE 'PENDING' END;
  v_id:=gen_random_uuid()::text;
  INSERT INTO rentauto.takatak_event_outbox
    (event_id,event_type,auth_user_id,payload_json)
  VALUES(v_id,'PAYMENT_SUMMARY_UPDATED',NEW.guest_id,
    jsonb_build_object(
      'eventId',v_id,'eventType','PAYMENT_SUMMARY_UPDATED',
      'sourceApplication','RENTAUTO',
      'externalUserId',NEW.guest_id::text,
      'payment',jsonb_build_object(
        'bookingNumber',NEW.booking_reference,
        'status',v_status,
        'amount',GREATEST(COALESCE(NEW.total_cents,0),0),
        'currency',upper(COALESCE(NULLIF(NEW.currency,''),'CAD')),
        'transactionDate',now()
      ),
      'occurredAt',now()
    ));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rentauto.takatak_queue_payment_change()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_rentauto_takatak_payment_outbox ON rentauto.trips;
CREATE TRIGGER trg_rentauto_takatak_payment_outbox
AFTER UPDATE OF payment_status ON rentauto.trips FOR EACH ROW
EXECUTE FUNCTION rentauto.takatak_queue_payment_change();

-- Staging checks before enabling (expect false, false, false and 0):
-- SELECT enabled FROM rentauto.takatak_sync_settings WHERE singleton;
-- SELECT has_table_privilege('authenticated','rentauto.takatak_event_outbox','SELECT');
-- SELECT has_function_privilege('authenticated','public.rentauto_claim_takatak_outbox(integer)','EXECUTE');
-- SELECT count(*) FROM rentauto.takatak_event_outbox;

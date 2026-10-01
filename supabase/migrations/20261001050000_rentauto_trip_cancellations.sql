-- Rentauto cancellation/refund authority.
-- Auto-refunds only when the booking's immutable cancellation-policy snapshot
-- explicitly covers the case. Undefined cases fail closed to manual review.

UPDATE rentauto.cancellation_policies
SET summary = 'Full refund within 24 hours of booking. Other timings require manual review.'
WHERE name = 'Free cancellation'
  AND rules->>'refund_percentage' = '100'
  AND rules->>'refund_window_hours' = '24';

CREATE TABLE IF NOT EXISTS rentauto.trip_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES rentauto.trips(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_role text NOT NULL CHECK (actor_role IN ('guest','host','admin')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_source text NOT NULL,
  refund_percentage numeric(5,2),
  refund_amount_cents integer,
  original_total_cents integer NOT NULL CHECK (original_total_cents >= 0),
  currency text NOT NULL CHECK (char_length(currency) = 3),
  status text NOT NULL CHECK (
    status IN (
      'manual_review',
      'processing',
      'refund_pending',
      'refunded',
      'cancelled_unpaid',
      'cancelled_no_refund',
      'failed',
      'denied'
    )
  ),
  stripe_refund_id text UNIQUE,
  idempotency_key text UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  resolution_notes text,
  resolved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT trip_cancellations_refund_amount_check
    CHECK (
      refund_amount_cents IS NULL
      OR (
        refund_amount_cents >= 0
        AND refund_amount_cents <= original_total_cents
      )
    ),
  CONSTRAINT trip_cancellations_refund_percentage_check
    CHECK (
      refund_percentage IS NULL
      OR (refund_percentage >= 0 AND refund_percentage <= 100)
    ),
  CONSTRAINT trip_cancellations_resolution_notes_check
    CHECK (resolution_notes IS NULL OR char_length(resolution_notes) <= 4000)
);

CREATE INDEX IF NOT EXISTS trip_cancellations_status_requested_idx
  ON rentauto.trip_cancellations(status, requested_at DESC);

CREATE INDEX IF NOT EXISTS trip_cancellations_actor_idx
  ON rentauto.trip_cancellations(actor_user_id);

CREATE INDEX IF NOT EXISTS trip_cancellations_resolver_idx
  ON rentauto.trip_cancellations(resolved_by_user_id)
  WHERE resolved_by_user_id IS NOT NULL;

ALTER TABLE rentauto.trip_cancellations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE rentauto.trip_cancellations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE rentauto.trip_cancellations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rentauto.trip_cancellations TO service_role;

DROP POLICY IF EXISTS rentauto_trip_cancellations_read
  ON rentauto.trip_cancellations;
CREATE POLICY rentauto_trip_cancellations_read
ON rentauto.trip_cancellations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_cancellations.trip_id
      AND (
        t.guest_id = (SELECT auth.uid())
        OR c.host_id = (SELECT auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

CREATE OR REPLACE FUNCTION rentauto.preview_trip_cancellation(
  p_user_id uuid,
  p_trip_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
  v_host_id uuid;
  v_existing rentauto.trip_cancellations%ROWTYPE;
  v_actor_role text;
  v_policy jsonb;
  v_rules jsonb;
  v_refund_percentage numeric;
  v_window_hours integer;
  v_refund_amount integer;
  v_auto boolean := false;
  v_manual_reason text := null;
BEGIN
  IF p_user_id IS NULL OR p_trip_id IS NULL THEN
    RAISE EXCEPTION 'invalid_cancellation_request' USING ERRCODE = '22023';
  END IF;

  SELECT t.*
  INTO v_trip
  FROM rentauto.trips t
  WHERE t.id = p_trip_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.host_id
  INTO v_host_id
  FROM rentauto.cars c
  WHERE c.id = v_trip.car_id;

  IF rentauto.has_role('admin'::rentauto.app_role, p_user_id) THEN
    v_actor_role := 'admin';
  ELSIF v_trip.guest_id = p_user_id THEN
    v_actor_role := 'guest';
  ELSIF v_host_id = p_user_id THEN
    v_actor_role := 'host';
  ELSE
    RAISE EXCEPTION 'trip_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_existing
  FROM rentauto.trip_cancellations
  WHERE trip_id = p_trip_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'actorRole', v_actor_role,
      'existing', true,
      'cancellationId', v_existing.id,
      'status', v_existing.status,
      'refundAmountCents', v_existing.refund_amount_cents,
      'refundPercentage', v_existing.refund_percentage,
      'currency', v_existing.currency,
      'ruleSource', v_existing.rule_source,
      'policySnapshot', v_existing.policy_snapshot,
      'stripeRefundId', v_existing.stripe_refund_id
    );
  END IF;

  IF v_trip.status NOT IN (
    'requested','approved','draft','confirmed','check_in_pending'
  ) THEN
    RAISE EXCEPTION 'trip_not_cancellable' USING ERRCODE = '22023';
  END IF;

  v_policy := COALESCE(
    v_trip.pricing_breakdown->'cancellation_policy_snapshot',
    '{}'::jsonb
  );
  v_rules := COALESCE(v_policy->'rules', '{}'::jsonb);

  IF v_trip.payment_status IN ('unpaid','failed') THEN
    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'actorRole', v_actor_role,
      'existing', false,
      'automatic', true,
      'manualReview', false,
      'requiresRefund', false,
      'refundAmountCents', 0,
      'refundPercentage', null,
      'currency', upper(v_trip.currency),
      'ruleSource', 'unpaid_booking',
      'policySnapshot', v_policy
    );
  END IF;

  IF v_trip.payment_status <> 'paid'
     OR v_trip.stripe_payment_intent_id IS NULL THEN
    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'actorRole', v_actor_role,
      'existing', false,
      'automatic', false,
      'manualReview', true,
      'requiresRefund', false,
      'refundAmountCents', null,
      'refundPercentage', null,
      'currency', upper(v_trip.currency),
      'ruleSource', 'payment_state_requires_review',
      'manualReason', 'payment_state_requires_review',
      'policySnapshot', v_policy
    );
  END IF;

  IF v_actor_role IN ('host','admin') THEN
    v_refund_percentage := 100;
    v_refund_amount := COALESCE(v_trip.total_cents, 0);
    v_auto := true;
  ELSIF v_trip.start_at <= now() THEN
    v_manual_reason := 'trip_start_reached';
  ELSIF jsonb_typeof(v_rules->'refund_percentage') = 'number'
     AND jsonb_typeof(v_rules->'refund_window_hours') = 'number' THEN
    v_refund_percentage := (v_rules->>'refund_percentage')::numeric;
    v_window_hours := (v_rules->>'refund_window_hours')::integer;

    IF v_refund_percentage < 0
       OR v_refund_percentage > 100
       OR v_window_hours < 0
       OR v_window_hours > 8760 THEN
      v_manual_reason := 'policy_rule_invalid';
    ELSIF now() <= v_trip.created_at + make_interval(hours => v_window_hours) THEN
      v_refund_amount := round(
        COALESCE(v_trip.total_cents, 0) * v_refund_percentage / 100.0
      )::integer;
      v_auto := true;
    ELSE
      v_manual_reason := 'outside_automatic_refund_window';
    END IF;
  ELSE
    v_manual_reason := 'policy_rule_not_automatic';
  END IF;

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'actorRole', v_actor_role,
    'existing', false,
    'automatic', v_auto,
    'manualReview', NOT v_auto,
    'requiresRefund', v_auto AND COALESCE(v_refund_amount, 0) > 0,
    'refundAmountCents', v_refund_amount,
    'refundPercentage', v_refund_percentage,
    'currency', upper(v_trip.currency),
    'ruleSource',
      CASE
        WHEN v_actor_role IN ('host','admin') THEN 'host_or_admin_full_refund'
        WHEN v_auto THEN 'booking_policy_snapshot'
        ELSE 'manual_review'
      END,
    'manualReason', v_manual_reason,
    'policySnapshot', v_policy
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.preview_trip_cancellation(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.preview_trip_cancellation(uuid, uuid)
TO service_role;

CREATE OR REPLACE FUNCTION rentauto.finalize_trip_cancellation(
  p_cancellation_id uuid,
  p_refund_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancel rentauto.trip_cancellations%ROWTYPE;
  v_trip rentauto.trips%ROWTYPE;
  v_host_id uuid;
  v_final_status text;
  v_payment_status text;
BEGIN
  SELECT *
  INTO v_cancel
  FROM rentauto.trip_cancellations
  WHERE id = p_cancellation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancellation_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = v_cancel.trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.status IN ('active','check_out_pending','completed','disputed') THEN
    RAISE EXCEPTION 'trip_not_cancellable' USING ERRCODE = '22023';
  END IF;

  SELECT c.host_id
  INTO v_host_id
  FROM rentauto.cars c
  WHERE c.id = v_trip.car_id;

  IF COALESCE(v_cancel.refund_amount_cents, 0) > 0 THEN
    IF p_refund_status <> 'succeeded' THEN
      RAISE EXCEPTION 'refund_not_succeeded' USING ERRCODE = '22023';
    END IF;
    v_final_status := 'refunded';
    v_payment_status := CASE
      WHEN v_cancel.refund_amount_cents >= COALESCE(v_trip.total_cents, 0)
        THEN 'refunded'
      ELSE 'partially_refunded'
    END;
  ELSIF v_trip.payment_status IN ('unpaid','failed') THEN
    v_final_status := 'cancelled_unpaid';
    v_payment_status := v_trip.payment_status;
  ELSE
    v_final_status := 'cancelled_no_refund';
    v_payment_status := v_trip.payment_status;
  END IF;

  UPDATE rentauto.trip_cancellations
  SET
    status = v_final_status,
    resolved_at = COALESCE(resolved_at, now()),
    updated_at = now()
  WHERE id = v_cancel.id
  RETURNING * INTO v_cancel;

  UPDATE rentauto.trips
  SET
    status = 'cancelled',
    payment_status = v_payment_status,
    updated_at = now()
  WHERE id = v_trip.id;

  UPDATE rentauto.booking_holds
  SET status = 'released', updated_at = now()
  WHERE trip_id = v_trip.id
    AND status IN ('active','converted');

  DELETE FROM rentauto.availability_blocks
  WHERE trip_id = v_trip.id
    AND type IN ('booking','booking_self');

  UPDATE rentauto.trip_settlements
  SET
    refunded_cents = GREATEST(
      refunded_cents,
      COALESCE(v_cancel.refund_amount_cents, 0)
    ),
    status = CASE
      WHEN stripe_transfer_id IS NOT NULL
           AND status NOT IN ('reversed','reversing')
        THEN 'reversal_required'
      ELSE 'blocked'
    END,
    hold_reason = CASE
      WHEN COALESCE(v_cancel.refund_amount_cents, 0) > 0
        THEN 'trip_cancelled_refund'
      ELSE 'trip_cancelled_manual_no_refund'
    END,
    updated_at = now()
  WHERE trip_id = v_trip.id
    AND status NOT IN ('reversed');

  INSERT INTO rentauto.trip_events(
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    v_trip.id,
    v_cancel.actor_user_id,
    'trip_cancelled',
    jsonb_build_object(
      'cancellationId', v_cancel.id,
      'actorRole', v_cancel.actor_role,
      'ruleSource', v_cancel.rule_source,
      'refundAmountCents', v_cancel.refund_amount_cents,
      'currency', v_cancel.currency,
      'refundStatus', p_refund_status
    )
  );

  IF v_trip.guest_id <> v_cancel.actor_user_id
     OR v_cancel.actor_role = 'admin' THEN
    INSERT INTO rentauto.notifications(
      user_id, type, title, body, link, payload
    )
    VALUES (
      v_trip.guest_id,
      'trip_cancelled',
      'Booking cancelled',
      CASE
        WHEN COALESCE(v_cancel.refund_amount_cents, 0) > 0
          THEN 'Your booking was cancelled and a refund was initiated.'
        ELSE 'Your booking was cancelled.'
      END,
      '/trips/' || v_trip.id::text,
      jsonb_build_object(
        'tripId', v_trip.id,
        'cancellationId', v_cancel.id,
        'refundAmountCents', v_cancel.refund_amount_cents,
        'currency', v_cancel.currency
      )
    );
  END IF;

  IF v_host_id IS NOT NULL
     AND (
       v_host_id <> v_cancel.actor_user_id
       OR v_cancel.actor_role = 'admin'
     ) THEN
    INSERT INTO rentauto.notifications(
      user_id, type, title, body, link, payload
    )
    VALUES (
      v_host_id,
      'trip_cancelled',
      'Booking cancelled',
      'A booking for your vehicle was cancelled.',
      '/trips/' || v_trip.id::text,
      jsonb_build_object(
        'tripId', v_trip.id,
        'cancellationId', v_cancel.id,
        'actorRole', v_cancel.actor_role,
        'refundAmountCents', v_cancel.refund_amount_cents,
        'currency', v_cancel.currency
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'cancellationId', v_cancel.id,
    'tripId', v_trip.id,
    'status', v_cancel.status,
    'tripStatus', 'cancelled',
    'paymentStatus', v_payment_status,
    'refundAmountCents', v_cancel.refund_amount_cents,
    'currency', v_cancel.currency
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.finalize_trip_cancellation(uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.finalize_trip_cancellation(uuid, text)
TO service_role;

CREATE OR REPLACE FUNCTION rentauto.prepare_trip_cancellation(
  p_user_id uuid,
  p_trip_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
  v_existing rentauto.trip_cancellations%ROWTYPE;
  v_host_id uuid;
  v_is_admin boolean := false;
  v_preview jsonb;
  v_cancel rentauto.trip_cancellations%ROWTYPE;
  v_status text;
  v_rule_source text;
  v_refund_amount integer;
  v_refund_percentage numeric;
  v_attempt integer;
  v_key text;
BEGIN
  IF p_reason IS NULL
     OR char_length(btrim(p_reason)) < 5
     OR char_length(btrim(p_reason)) > 1000 THEN
    RAISE EXCEPTION 'cancellation_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT car.host_id
  INTO v_host_id
  FROM rentauto.cars car
  WHERE car.id = v_trip.car_id;

  v_is_admin := rentauto.has_role(
    'admin'::rentauto.app_role,
    p_user_id
  );

  IF NOT v_is_admin
     AND v_trip.guest_id <> p_user_id
     AND v_host_id <> p_user_id THEN
    RAISE EXCEPTION 'trip_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_existing
  FROM rentauto.trip_cancellations
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.actor_user_id <> p_user_id
       AND NOT v_is_admin THEN
      RAISE EXCEPTION 'cancellation_already_requested' USING ERRCODE = '42501';
    END IF;

    IF v_existing.status = 'refund_pending' THEN
      RETURN jsonb_build_object(
        'cancellationId', v_existing.id,
        'tripId', v_existing.trip_id,
        'status', v_existing.status,
        'manualReview', false,
        'requiresRefund', true,
        'refundAmountCents', v_existing.refund_amount_cents,
        'currency', v_existing.currency,
        'paymentIntentId', v_trip.stripe_payment_intent_id,
        'stripeRefundId', v_existing.stripe_refund_id,
        'idempotencyKey', v_existing.idempotency_key,
        'resumeMode', 'retrieve'
      );
    ELSIF v_existing.status = 'processing' THEN
      RETURN jsonb_build_object(
        'cancellationId', v_existing.id,
        'tripId', v_existing.trip_id,
        'status', v_existing.status,
        'manualReview', false,
        'requiresRefund', true,
        'refundAmountCents', v_existing.refund_amount_cents,
        'currency', v_existing.currency,
        'paymentIntentId', v_trip.stripe_payment_intent_id,
        'stripeRefundId', v_existing.stripe_refund_id,
        'idempotencyKey', v_existing.idempotency_key,
        'resumeMode', CASE
          WHEN v_existing.stripe_refund_id IS NULL THEN 'create'
          ELSE 'retrieve'
        END
      );
    ELSIF v_existing.status = 'failed' THEN
      v_attempt := v_existing.attempt_count + 1;
      v_key := 'rentauto-cancel-' || v_existing.id::text || '-' || v_attempt::text;

      UPDATE rentauto.trip_cancellations
      SET
        status = 'processing',
        attempt_count = v_attempt,
        idempotency_key = v_key,
        stripe_refund_id = NULL,
        updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_existing;

      RETURN jsonb_build_object(
        'cancellationId', v_existing.id,
        'tripId', v_existing.trip_id,
        'status', v_existing.status,
        'manualReview', false,
        'requiresRefund', true,
        'refundAmountCents', v_existing.refund_amount_cents,
        'currency', v_existing.currency,
        'paymentIntentId', v_trip.stripe_payment_intent_id,
        'stripeRefundId', null,
        'idempotencyKey', v_key,
        'resumeMode', 'create'
      );
    ELSE
      RETURN jsonb_build_object(
        'cancellationId', v_existing.id,
        'tripId', v_existing.trip_id,
        'status', v_existing.status,
        'manualReview', v_existing.status = 'manual_review',
        'requiresRefund', false,
        'refundAmountCents', v_existing.refund_amount_cents,
        'currency', v_existing.currency,
        'stripeRefundId', v_existing.stripe_refund_id
      );
    END IF;
  END IF;

  v_preview := rentauto.preview_trip_cancellation(p_user_id, p_trip_id);
  v_refund_amount := NULLIF(v_preview->>'refundAmountCents', '')::integer;
  v_refund_percentage := NULLIF(v_preview->>'refundPercentage', '')::numeric;
  v_rule_source := COALESCE(v_preview->>'ruleSource', 'manual_review');

  IF COALESCE((v_preview->>'manualReview')::boolean, false) THEN
    v_status := 'manual_review';
  ELSIF NOT COALESCE((v_preview->>'requiresRefund')::boolean, false) THEN
    v_status := 'cancelled_unpaid';
  ELSE
    v_status := 'processing';
  END IF;

  INSERT INTO rentauto.trip_cancellations(
    trip_id,
    actor_user_id,
    actor_role,
    reason,
    policy_snapshot,
    rule_source,
    refund_percentage,
    refund_amount_cents,
    original_total_cents,
    currency,
    status,
    attempt_count,
    idempotency_key
  )
  VALUES (
    p_trip_id,
    p_user_id,
    v_preview->>'actorRole',
    btrim(p_reason),
    COALESCE(v_preview->'policySnapshot', '{}'::jsonb),
    v_rule_source,
    v_refund_percentage,
    v_refund_amount,
    COALESCE(v_trip.total_cents, 0),
    upper(v_trip.currency),
    v_status,
    CASE WHEN v_status = 'processing' THEN 1 ELSE 0 END,
    NULL
  )
  RETURNING * INTO v_cancel;

  IF v_status = 'processing' THEN
    v_key := 'rentauto-cancel-' || v_cancel.id::text || '-1';

    UPDATE rentauto.trip_cancellations
    SET idempotency_key = v_key, updated_at = now()
    WHERE id = v_cancel.id
    RETURNING * INTO v_cancel;

    INSERT INTO rentauto.trip_events(
      trip_id, actor_user_id, event_type, payload_json
    )
    VALUES (
      v_trip.id,
      p_user_id,
      'cancellation_refund_processing',
      jsonb_build_object(
        'cancellationId', v_cancel.id,
        'actorRole', v_cancel.actor_role,
        'refundAmountCents', v_cancel.refund_amount_cents,
        'currency', v_cancel.currency,
        'ruleSource', v_cancel.rule_source
      )
    );

    RETURN jsonb_build_object(
      'cancellationId', v_cancel.id,
      'tripId', v_trip.id,
      'status', v_cancel.status,
      'manualReview', false,
      'requiresRefund', true,
      'refundAmountCents', v_cancel.refund_amount_cents,
      'refundPercentage', v_cancel.refund_percentage,
      'currency', v_cancel.currency,
      'paymentIntentId', v_trip.stripe_payment_intent_id,
      'stripeRefundId', null,
      'idempotencyKey', v_key,
      'resumeMode', 'create',
      'actorRole', v_cancel.actor_role
    );
  END IF;

  IF v_status = 'manual_review' THEN
    INSERT INTO rentauto.trip_events(
      trip_id, actor_user_id, event_type, payload_json
    )
    VALUES (
      v_trip.id,
      p_user_id,
      'cancellation_manual_review_requested',
      jsonb_build_object(
        'cancellationId', v_cancel.id,
        'actorRole', v_cancel.actor_role,
        'ruleSource', v_cancel.rule_source
      )
    );

    INSERT INTO rentauto.notifications(
      user_id, type, title, body, link, payload
    )
    SELECT
      ar.auth_user_id,
      'cancellation_review',
      'Cancellation review required',
      'A paid booking needs a manual cancellation/refund decision.',
      '/admin/cancellations?cancellation=' || v_cancel.id::text,
      jsonb_build_object(
        'tripId', v_trip.id,
        'cancellationId', v_cancel.id,
        'bookingReference', v_trip.booking_reference
      )
    FROM rentauto.account_roles ar
    WHERE ar.role = 'admin'::rentauto.app_role;

    RETURN jsonb_build_object(
      'cancellationId', v_cancel.id,
      'tripId', v_trip.id,
      'status', v_cancel.status,
      'manualReview', true,
      'requiresRefund', false,
      'refundAmountCents', null,
      'currency', v_cancel.currency,
      'actorRole', v_cancel.actor_role
    );
  END IF;

  RETURN rentauto.finalize_trip_cancellation(v_cancel.id, 'not_required');
END;
$$;

REVOKE ALL ON FUNCTION rentauto.prepare_trip_cancellation(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.prepare_trip_cancellation(uuid, uuid, text)
TO service_role;

CREATE OR REPLACE FUNCTION rentauto.sync_trip_cancellation_refund(
  p_stripe_refund_id text,
  p_refund_status text,
  p_failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancel rentauto.trip_cancellations%ROWTYPE;
BEGIN
  IF p_stripe_refund_id IS NULL OR btrim(p_stripe_refund_id) = '' THEN
    RAISE EXCEPTION 'invalid_refund_id' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_cancel
  FROM rentauto.trip_cancellations
  WHERE stripe_refund_id = p_stripe_refund_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'found', false);
  END IF;

  IF p_refund_status = 'succeeded' THEN
    RETURN rentauto.finalize_trip_cancellation(v_cancel.id, 'succeeded');
  ELSIF p_refund_status IN ('pending','requires_action') THEN
    UPDATE rentauto.trip_cancellations
    SET
      status = 'refund_pending',
      updated_at = now()
    WHERE id = v_cancel.id;

    RETURN jsonb_build_object(
      'ok', true,
      'found', true,
      'cancellationId', v_cancel.id,
      'status', 'refund_pending'
    );
  ELSIF p_refund_status IN ('failed','canceled') THEN
    UPDATE rentauto.trip_cancellations
    SET
      status = 'failed',
      resolution_notes = CASE
        WHEN p_failure_reason IS NULL OR btrim(p_failure_reason) = ''
          THEN resolution_notes
        ELSE left(p_failure_reason, 4000)
      END,
      updated_at = now()
    WHERE id = v_cancel.id;

    INSERT INTO rentauto.trip_events(
      trip_id, actor_user_id, event_type, payload_json
    )
    VALUES (
      v_cancel.trip_id,
      v_cancel.actor_user_id,
      'cancellation_refund_failed',
      jsonb_build_object(
        'cancellationId', v_cancel.id,
        'stripeRefundId', p_stripe_refund_id,
        'refundStatus', p_refund_status,
        'failureReason', p_failure_reason
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'found', true,
      'cancellationId', v_cancel.id,
      'status', 'failed'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'found', true,
    'cancellationId', v_cancel.id,
    'status', v_cancel.status
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.sync_trip_cancellation_refund(text, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.sync_trip_cancellation_refund(text, text, text)
TO service_role;

CREATE OR REPLACE FUNCTION rentauto.record_trip_cancellation_refund(
  p_cancellation_id uuid,
  p_stripe_refund_id text,
  p_refund_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancel rentauto.trip_cancellations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_cancel
  FROM rentauto.trip_cancellations
  WHERE id = p_cancellation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancellation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_stripe_refund_id IS NULL OR btrim(p_stripe_refund_id) = '' THEN
    RAISE EXCEPTION 'invalid_refund_id' USING ERRCODE = '22023';
  END IF;

  IF v_cancel.stripe_refund_id IS NOT NULL
     AND v_cancel.stripe_refund_id <> p_stripe_refund_id THEN
    RAISE EXCEPTION 'refund_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  UPDATE rentauto.trip_cancellations
  SET
    stripe_refund_id = p_stripe_refund_id,
    updated_at = now()
  WHERE id = v_cancel.id;

  RETURN rentauto.sync_trip_cancellation_refund(
    p_stripe_refund_id,
    p_refund_status,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.record_trip_cancellation_refund(uuid, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.record_trip_cancellation_refund(uuid, text, text)
TO service_role;

CREATE OR REPLACE FUNCTION rentauto.prepare_manual_cancellation_resolution(
  p_admin_user_id uuid,
  p_cancellation_id uuid,
  p_decision text,
  p_refund_amount_cents integer,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancel rentauto.trip_cancellations%ROWTYPE;
  v_trip rentauto.trips%ROWTYPE;
  v_attempt integer;
  v_key text;
BEGIN
  IF NOT rentauto.has_role('admin'::rentauto.app_role, p_admin_user_id) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_notes IS NULL
     OR char_length(btrim(p_notes)) < 10
     OR char_length(btrim(p_notes)) > 4000 THEN
    RAISE EXCEPTION 'resolution_notes_required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_cancel
  FROM rentauto.trip_cancellations
  WHERE id = p_cancellation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancellation_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = v_cancel.trip_id
  FOR UPDATE;

  IF v_cancel.status <> 'manual_review' THEN
    RAISE EXCEPTION 'cancellation_not_in_manual_review' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'deny' THEN
    UPDATE rentauto.trip_cancellations
    SET
      status = 'denied',
      resolution_notes = btrim(p_notes),
      resolved_by_user_id = p_admin_user_id,
      resolved_at = now(),
      updated_at = now()
    WHERE id = v_cancel.id;

    INSERT INTO rentauto.notifications(
      user_id, type, title, body, link, payload
    )
    VALUES (
      v_cancel.actor_user_id,
      'cancellation_review',
      'Cancellation review completed',
      'Rentauto reviewed your cancellation request. The booking remains active.',
      '/trips/' || v_trip.id::text,
      jsonb_build_object(
        'tripId', v_trip.id,
        'cancellationId', v_cancel.id,
        'decision', 'denied'
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'cancellationId', v_cancel.id,
      'status', 'denied',
      'requiresRefund', false
    );
  END IF;

  IF p_decision <> 'approve'
     OR p_refund_amount_cents IS NULL
     OR p_refund_amount_cents <> v_cancel.original_total_cents THEN
    RAISE EXCEPTION 'manual_resolution_requires_full_refund'
      USING ERRCODE = '22023';
  END IF;

  UPDATE rentauto.trip_cancellations
  SET
    refund_amount_cents = v_cancel.original_total_cents,
    refund_percentage = CASE
      WHEN original_total_cents > 0 THEN 100
      ELSE 0
    END,
    rule_source = 'admin_manual',
    resolution_notes = btrim(p_notes),
    resolved_by_user_id = p_admin_user_id,
    updated_at = now()
  WHERE id = v_cancel.id
  RETURNING * INTO v_cancel;

  IF v_trip.stripe_payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'payment_intent_missing' USING ERRCODE = '22023';
  END IF;

  v_attempt := v_cancel.attempt_count + 1;
  v_key := 'rentauto-cancel-' || v_cancel.id::text || '-' || v_attempt::text;

  UPDATE rentauto.trip_cancellations
  SET
    status = 'processing',
    attempt_count = v_attempt,
    idempotency_key = v_key,
    stripe_refund_id = NULL,
    updated_at = now()
  WHERE id = v_cancel.id
  RETURNING * INTO v_cancel;

  RETURN jsonb_build_object(
    'ok', true,
    'cancellationId', v_cancel.id,
    'tripId', v_trip.id,
    'status', v_cancel.status,
    'requiresRefund', true,
    'refundAmountCents', v_cancel.refund_amount_cents,
    'currency', v_cancel.currency,
    'paymentIntentId', v_trip.stripe_payment_intent_id,
    'stripeRefundId', null,
    'idempotencyKey', v_key,
    'resumeMode', 'create',
    'actorRole', v_cancel.actor_role
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.prepare_manual_cancellation_resolution(
  uuid, uuid, text, integer, text
)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.prepare_manual_cancellation_resolution(
  uuid, uuid, text, integer, text
)
TO service_role;

CREATE OR REPLACE FUNCTION rentauto.prepare_cancellation_retry(
  p_admin_user_id uuid,
  p_cancellation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancel rentauto.trip_cancellations%ROWTYPE;
  v_trip rentauto.trips%ROWTYPE;
  v_attempt integer;
  v_key text;
BEGIN
  IF NOT rentauto.has_role('admin'::rentauto.app_role, p_admin_user_id) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_cancel
  FROM rentauto.trip_cancellations
  WHERE id = p_cancellation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancellation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_cancel.status <> 'failed'
     OR COALESCE(v_cancel.refund_amount_cents, 0) <= 0 THEN
    RAISE EXCEPTION 'cancellation_not_retryable' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = v_cancel.trip_id;

  IF v_trip.stripe_payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'payment_intent_missing' USING ERRCODE = '22023';
  END IF;

  v_attempt := v_cancel.attempt_count + 1;
  v_key := 'rentauto-cancel-' || v_cancel.id::text || '-' || v_attempt::text;

  UPDATE rentauto.trip_cancellations
  SET
    status = 'processing',
    attempt_count = v_attempt,
    idempotency_key = v_key,
    stripe_refund_id = NULL,
    updated_at = now()
  WHERE id = v_cancel.id
  RETURNING * INTO v_cancel;

  RETURN jsonb_build_object(
    'ok', true,
    'cancellationId', v_cancel.id,
    'tripId', v_trip.id,
    'status', v_cancel.status,
    'requiresRefund', true,
    'refundAmountCents', v_cancel.refund_amount_cents,
    'currency', v_cancel.currency,
    'paymentIntentId', v_trip.stripe_payment_intent_id,
    'stripeRefundId', null,
    'idempotencyKey', v_key,
    'resumeMode', 'create',
    'actorRole', v_cancel.actor_role
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.prepare_cancellation_retry(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rentauto.prepare_cancellation_retry(uuid, uuid)
TO service_role;

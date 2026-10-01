-- Rentauto trip messaging: participant-only, immutable, realtime.
CREATE TABLE rentauto.trip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_message_id text,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_messages_participants_distinct CHECK (sender_user_id <> recipient_user_id),
  CONSTRAINT trip_messages_body_length CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 4000
  )
);

CREATE INDEX trip_messages_trip_created_idx
  ON rentauto.trip_messages (trip_id, created_at DESC);

CREATE INDEX trip_messages_recipient_unread_idx
  ON rentauto.trip_messages (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX trip_messages_sender_client_id_uidx
  ON rentauto.trip_messages (sender_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

ALTER TABLE rentauto.trip_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE rentauto.trip_messages FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE rentauto.trip_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rentauto.trip_messages TO service_role;

CREATE POLICY rentauto_trip_messages_read
ON rentauto.trip_messages
FOR SELECT
TO authenticated
USING (
  sender_user_id = (SELECT auth.uid())
  OR recipient_user_id = (SELECT auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

CREATE POLICY rentauto_trip_messages_insert
ON rentauto.trip_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = (SELECT auth.uid())
  AND recipient_user_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_messages.trip_id
      AND t.status NOT IN ('draft', 'pending_payment')
      AND (
        (
          t.guest_id = (SELECT auth.uid())
          AND c.host_id = trip_messages.recipient_user_id
        )
        OR (
          c.host_id = (SELECT auth.uid())
          AND t.guest_id = trip_messages.recipient_user_id
        )
      )
  )
);

CREATE POLICY rentauto_trip_messages_mark_read
ON rentauto.trip_messages
FOR UPDATE
TO authenticated
USING (recipient_user_id = (SELECT auth.uid()))
WITH CHECK (recipient_user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION rentauto.enforce_trip_message_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
     OR NEW.client_message_id IS DISTINCT FROM OLD.client_message_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'trip_message_immutable' USING ERRCODE = '42501';
  END IF;

  IF OLD.read_at IS NOT NULL THEN
    NEW.read_at := OLD.read_at;
  ELSIF NEW.read_at IS NOT NULL THEN
    NEW.read_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.enforce_trip_message_update()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_rentauto_trip_message_update
BEFORE UPDATE ON rentauto.trip_messages
FOR EACH ROW
EXECUTE FUNCTION rentauto.enforce_trip_message_update();

CREATE OR REPLACE FUNCTION rentauto.notify_trip_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
DECLARE
  v_booking_reference text;
BEGIN
  SELECT booking_reference
    INTO v_booking_reference
  FROM rentauto.trips
  WHERE id = NEW.trip_id;

  INSERT INTO rentauto.notifications (
    user_id,
    type,
    title,
    body,
    link,
    payload
  )
  VALUES (
    NEW.recipient_user_id,
    'trip_message',
    'New Rentauto message',
    'You have a new message about booking ' ||
      COALESCE(NULLIF(v_booking_reference, ''), left(NEW.trip_id::text, 8)) || '.',
    '/messages?trip=' || NEW.trip_id::text,
    jsonb_build_object(
      'tripId', NEW.trip_id,
      'messageId', NEW.id,
      'senderUserId', NEW.sender_user_id
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.notify_trip_message_recipient()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_rentauto_trip_message_notification
AFTER INSERT ON rentauto.trip_messages
FOR EACH ROW
EXECUTE FUNCTION rentauto.notify_trip_message_recipient();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'rentauto'
      AND tablename = 'trip_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rentauto.trip_messages;
  END IF;
END
$$;
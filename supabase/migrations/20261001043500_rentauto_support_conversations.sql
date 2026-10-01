-- Rentauto support operations center: secure threaded conversations + working grants.

ALTER TABLE rentauto.support_tickets
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

UPDATE rentauto.support_tickets
SET last_message_at = COALESCE(last_response_at, created_at)
WHERE last_message_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON TABLE rentauto.support_tickets TO authenticated;

CREATE TABLE IF NOT EXISTS rentauto.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES rentauto.support_tickets(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sender_is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_messages_body_check
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx
  ON rentauto.support_ticket_messages(ticket_id, created_at);

CREATE INDEX IF NOT EXISTS support_ticket_messages_unread_idx
  ON rentauto.support_ticket_messages(ticket_id, sender_is_admin, created_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS support_ticket_messages_sender_idx
  ON rentauto.support_ticket_messages(sender_user_id);

ALTER TABLE rentauto.support_ticket_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE rentauto.support_ticket_messages FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE rentauto.support_ticket_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rentauto.support_ticket_messages TO service_role;

DROP POLICY IF EXISTS rentauto_support_messages_read ON rentauto.support_ticket_messages;
CREATE POLICY rentauto_support_messages_read
ON rentauto.support_ticket_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_support_messages_insert ON rentauto.support_ticket_messages;
CREATE POLICY rentauto_support_messages_insert
ON rentauto.support_ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = (SELECT auth.uid())
  AND (
    (
      sender_is_admin = false
      AND EXISTS (
        SELECT 1
        FROM rentauto.support_tickets t
        WHERE t.id = support_ticket_messages.ticket_id
          AND t.user_id = (SELECT auth.uid())
          AND t.status <> 'closed'
      )
    )
    OR
    (
      sender_is_admin = true
      AND rentauto.has_role('admin'::rentauto.app_role)
      AND EXISTS (
        SELECT 1
        FROM rentauto.support_tickets t
        WHERE t.id = support_ticket_messages.ticket_id
          AND t.status <> 'closed'
      )
    )
  )
);

DROP POLICY IF EXISTS rentauto_support_messages_mark_read ON rentauto.support_ticket_messages;
CREATE POLICY rentauto_support_messages_mark_read
ON rentauto.support_ticket_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id
      AND (
        (
          t.user_id = (SELECT auth.uid())
          AND support_ticket_messages.sender_is_admin = true
        )
        OR
        (
          rentauto.has_role('admin'::rentauto.app_role)
          AND support_ticket_messages.sender_is_admin = false
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM rentauto.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id
      AND (
        (
          t.user_id = (SELECT auth.uid())
          AND support_ticket_messages.sender_is_admin = true
        )
        OR
        (
          rentauto.has_role('admin'::rentauto.app_role)
          AND support_ticket_messages.sender_is_admin = false
        )
      )
  )
);

CREATE OR REPLACE FUNCTION rentauto.enforce_support_message_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.sender_is_admin IS DISTINCT FROM OLD.sender_is_admin
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'support_message_immutable' USING ERRCODE = '42501';
  END IF;

  IF OLD.read_at IS NOT NULL THEN
    NEW.read_at := OLD.read_at;
  ELSIF NEW.read_at IS NOT NULL THEN
    NEW.read_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.enforce_support_message_update()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rentauto_support_message_update
  ON rentauto.support_ticket_messages;
CREATE TRIGGER trg_rentauto_support_message_update
BEFORE UPDATE ON rentauto.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION rentauto.enforce_support_message_update();

CREATE OR REPLACE FUNCTION rentauto.after_support_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
DECLARE
  v_ticket rentauto.support_tickets%ROWTYPE;
BEGIN
  SELECT *
  INTO v_ticket
  FROM rentauto.support_tickets
  WHERE id = NEW.ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_is_admin THEN
    UPDATE rentauto.support_tickets
    SET
      status = CASE
        WHEN status = 'closed' THEN status
        ELSE 'waiting_customer'
      END,
      last_response_at = NEW.created_at,
      last_message_at = NEW.created_at,
      updated_at = now()
    WHERE id = NEW.ticket_id;

    INSERT INTO rentauto.notifications(
      user_id, type, title, body, link, payload
    )
    VALUES (
      v_ticket.user_id,
      'support_reply',
      'Support replied',
      'Rentauto support replied to "' || left(v_ticket.subject, 100) || '".',
      '/dashboard/support?ticket=' || NEW.ticket_id::text,
      jsonb_build_object(
        'ticketId', NEW.ticket_id,
        'messageId', NEW.id
      )
    );
  ELSE
    UPDATE rentauto.support_tickets
    SET
      status = CASE
        WHEN status IN ('waiting_customer','resolved') THEN 'open'
        ELSE status
      END,
      last_message_at = NEW.created_at,
      updated_at = now()
    WHERE id = NEW.ticket_id;

    INSERT INTO rentauto.notifications(
      user_id, type, title, body, link, payload
    )
    SELECT
      ar.auth_user_id,
      'support_customer_message',
      CASE
        WHEN v_ticket.priority = 'urgent' THEN 'Urgent support request'
        ELSE 'Support request updated'
      END,
      'Customer replied to "' || left(v_ticket.subject, 100) || '".',
      '/admin/support?ticket=' || NEW.ticket_id::text,
      jsonb_build_object(
        'ticketId', NEW.ticket_id,
        'messageId', NEW.id,
        'priority', v_ticket.priority
      )
    FROM rentauto.account_roles ar
    WHERE ar.role = 'admin'::rentauto.app_role
      AND ar.auth_user_id <> NEW.sender_user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.after_support_message_insert()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rentauto_support_message_insert
  ON rentauto.support_ticket_messages;
CREATE TRIGGER trg_rentauto_support_message_insert
AFTER INSERT ON rentauto.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION rentauto.after_support_message_insert();

CREATE OR REPLACE FUNCTION rentauto.after_support_ticket_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO rentauto.support_ticket_messages(
    ticket_id,
    sender_user_id,
    sender_is_admin,
    body,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    false,
    NEW.body,
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.after_support_ticket_insert()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rentauto_support_ticket_insert
  ON rentauto.support_tickets;
CREATE TRIGGER trg_rentauto_support_ticket_insert
AFTER INSERT ON rentauto.support_tickets
FOR EACH ROW
EXECUTE FUNCTION rentauto.after_support_ticket_insert();

INSERT INTO rentauto.support_ticket_messages(
  ticket_id,
  sender_user_id,
  sender_is_admin,
  body,
  created_at
)
SELECT
  t.id,
  t.user_id,
  false,
  t.body,
  t.created_at
FROM rentauto.support_tickets t
WHERE NOT EXISTS (
  SELECT 1
  FROM rentauto.support_ticket_messages m
  WHERE m.ticket_id = t.id
);

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
      AND tablename = 'support_ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE rentauto.support_ticket_messages;
  END IF;
END
$$;

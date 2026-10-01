-- Prevent authenticated callers from probing another user's Rentauto roles.
CREATE OR REPLACE FUNCTION rentauto.has_role(
  p_role rentauto.app_role,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (
      auth.uid() IS NULL
      OR p_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM rentauto.account_roles r
      WHERE r.auth_user_id = p_user_id
        AND r.role = p_role
    );
$$;

REVOKE ALL ON FUNCTION rentauto.has_role(rentauto.app_role, uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rentauto.has_role(rentauto.app_role, uuid)
TO authenticated, service_role;

-- Migration: add_get_user_emails_by_ids_rpc
-- Purpose: Replace auth.admin.listUsers(perPage:1000) with a targeted RPC
--          that returns only emails for the given user IDs.
--          Used by listUsersByRole() and listDeletedUsers() in user-actions.ts.

CREATE OR REPLACE FUNCTION get_user_emails_by_ids(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(user_ids);
$$;

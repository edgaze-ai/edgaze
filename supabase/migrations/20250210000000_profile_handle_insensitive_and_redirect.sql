-- Case-insensitive profile lookup by handle (for profile page and redirects).
-- Returns single row so profile page can find profile regardless of URL casing.
CREATE OR REPLACE FUNCTION public.get_profile_by_handle_insensitive(handle_input text)
RETURNS TABLE (id uuid, handle text, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.handle, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.handle IS NOT NULL AND trim(lower(p.handle)) = trim(lower(handle_input))
  LIMIT 1;
$$;

-- Resolve current handle for a user when given an old owner_handle (from workflows/prompts).
-- Used as redirect fallback when handle_history is empty (e.g. manual DB updates).
CREATE OR REPLACE FUNCTION public.get_current_handle_by_owner_handle(owner_handle_input text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  cur_handle text;
BEGIN
  IF trim(owner_handle_input) = '' THEN
    RETURN NULL;
  END IF;

  -- Try workflows first (owner_id is uuid)
  SELECT w.owner_id INTO uid
  FROM workflows w
  WHERE w.owner_handle IS NOT NULL AND lower(trim(w.owner_handle)) = lower(trim(owner_handle_input))
  LIMIT 1;

  IF uid IS NULL THEN
    -- Try prompts (owner_id is text; only cast valid uuid)
    SELECT (p.owner_id::uuid) INTO uid
    FROM prompts p
    WHERE p.owner_handle IS NOT NULL AND lower(trim(p.owner_handle)) = lower(trim(owner_handle_input))
      AND p.owner_id IS NOT NULL AND p.owner_id::text ~ '^[0-9a-fA-F-]{36}$'
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pr.handle INTO cur_handle FROM profiles pr WHERE pr.id = uid LIMIT 1;
  RETURN cur_handle;
END;
$$;

COMMENT ON FUNCTION public.get_profile_by_handle_insensitive(text) IS 'Find profile by handle (case-insensitive). Used by profile page and redirect logic.';
COMMENT ON FUNCTION public.get_current_handle_by_owner_handle(text) IS 'Resolve current profile handle from workflows/prompts owner_handle. Fallback for profile redirect when handle_history is empty.';

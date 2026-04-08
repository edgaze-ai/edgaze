-- Single source of truth for "can this handle be used on public.profiles?"
-- Matches trim(lower(...)) semantics (legacy mixed-case rows, no ILIKE wildcards).

CREATE OR REPLACE FUNCTION public.is_profile_handle_available(
  handle_input text,
  exclude_profile_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT trim(coalesce(handle_input, '')) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.handle IS NOT NULL
        AND trim(lower(p.handle)) = trim(lower(trim(handle_input)))
        AND (exclude_profile_id IS NULL OR p.id <> exclude_profile_id)
    );
$$;

COMMENT ON FUNCTION public.is_profile_handle_available(text, uuid) IS
  'True if no profile row owns this handle (case-insensitive trim match). Optional profile id excludes current user (handle change).';

GRANT EXECUTE ON FUNCTION public.is_profile_handle_available(text, uuid) TO service_role;

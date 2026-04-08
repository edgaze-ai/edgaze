-- Handle RPCs are SECURITY DEFINER; if public.profiles RLS blocks the function owner but not
-- the service_role PostgREST role, "availability" checks can return empty while inserts still
-- hit unique(profile handle). Align visibility with admin routes by disabling row security inside
-- these helpers (function owner runs as a privileged DB role).

CREATE OR REPLACE FUNCTION public.profile_handle_exists_ci(handle_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.handle IS NOT NULL
      AND trim(lower(p.handle)) = trim(lower(coalesce(handle_input, '')))
      AND trim(coalesce(handle_input, '')) <> ''
  );
$$;

COMMENT ON FUNCTION public.profile_handle_exists_ci(text) IS
  'True if public.profiles already has this handle (trim + lower match). Admin provisioning; service_role.';

GRANT EXECUTE ON FUNCTION public.profile_handle_exists_ci(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_profile_by_handle_insensitive(handle_input text)
RETURNS TABLE (id uuid, handle text, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p.id, p.handle, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.handle IS NOT NULL AND trim(lower(p.handle)) = trim(lower(handle_input))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.profiles_min_by_handles(handles text[])
RETURNS TABLE (
  handle text,
  full_name text,
  avatar_url text,
  is_verified_creator boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    p.handle,
    p.full_name,
    p.avatar_url,
    p.is_verified_creator
  FROM public.profiles p
  WHERE p.handle IS NOT NULL
    AND lower(trim(p.handle)) IN (
      SELECT lower(trim(u.h))
      FROM unnest(coalesce(handles, array[]::text[])) AS u(h)
      WHERE u.h IS NOT NULL AND trim(u.h) <> ''
    );
$$;

-- Batch-resolve profile rows for marketplace cards using normalized handles.
-- The JS client lowercases listing owner_handle before calling; this matches
-- profiles.handle case-insensitively so avatars/badges still load when casing differs.
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

COMMENT ON FUNCTION public.profiles_min_by_handles(text[]) IS
  'Return display fields for profiles whose handle matches any input (case-insensitive). Used by marketplace batch avatar fetch.';

GRANT EXECUTE ON FUNCTION public.profiles_min_by_handles(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.profiles_min_by_handles(text[]) TO authenticated;

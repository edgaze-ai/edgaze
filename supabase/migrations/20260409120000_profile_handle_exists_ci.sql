-- Single RPC for admin provisioning: same case/trim semantics as get_profile_by_handle_insensitive,
-- but returns a boolean so PostgREST + service_role cannot misinterpret an empty rowset.

CREATE OR REPLACE FUNCTION public.profile_handle_exists_ci(handle_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

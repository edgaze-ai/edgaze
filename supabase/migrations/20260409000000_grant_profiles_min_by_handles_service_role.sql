-- Admin provisioning uses service_role; profiles_min_by_handles matches handles the same way as
-- marketplace (lower(trim)) but was only granted to anon/authenticated.

GRANT EXECUTE ON FUNCTION public.profiles_min_by_handles(text[]) TO service_role;

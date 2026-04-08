-- Admin routes use the Supabase service_role JWT. PostgREST only runs RPCs that role may EXECUTE.
-- get_profile_by_handle_insensitive had no service_role grant, so the provisioning clash check
-- could not see existing profiles (same handle, different casing) and auth insert hit profiles_username_key.

GRANT EXECUTE ON FUNCTION public.get_profile_by_handle_insensitive(text) TO service_role;

-- Allow admins with an active impersonation session to INSERT/UPDATE marketplace rows
-- owned by the impersonated profile. JWT auth.uid() stays the admin, so owner-only
-- policies would otherwise block library edits while impersonating.

CREATE OR REPLACE FUNCTION public.active_impersonation_target_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.target_profile_id
  FROM public.admin_impersonation_sessions s
  WHERE s.admin_user_id = auth.uid()
    AND s.status = 'active'
    AND s.expires_at > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.active_impersonation_target_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_impersonation_target_profile_id() TO authenticated;

COMMENT ON FUNCTION public.active_impersonation_target_profile_id() IS
  'Profile id of the active admin impersonation target for auth.uid(), or NULL.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workflows'
  ) THEN
    DROP POLICY IF EXISTS "Admins impersonating can insert workflows" ON public.workflows;
    CREATE POLICY "Admins impersonating can insert workflows"
      ON public.workflows FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
        AND owner_id::text = public.active_impersonation_target_profile_id()::text
        AND public.active_impersonation_target_profile_id() IS NOT NULL
      );

    DROP POLICY IF EXISTS "Admins impersonating can update workflows" ON public.workflows;
    CREATE POLICY "Admins impersonating can update workflows"
      ON public.workflows FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
        AND owner_id::text = public.active_impersonation_target_profile_id()::text
        AND public.active_impersonation_target_profile_id() IS NOT NULL
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
        AND owner_id::text = public.active_impersonation_target_profile_id()::text
        AND public.active_impersonation_target_profile_id() IS NOT NULL
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prompts'
  ) THEN
    DROP POLICY IF EXISTS "Admins impersonating can insert prompts" ON public.prompts;
    CREATE POLICY "Admins impersonating can insert prompts"
      ON public.prompts FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
        AND owner_id::text = public.active_impersonation_target_profile_id()::text
        AND public.active_impersonation_target_profile_id() IS NOT NULL
      );

    DROP POLICY IF EXISTS "Admins impersonating can update prompts" ON public.prompts;
    CREATE POLICY "Admins impersonating can update prompts"
      ON public.prompts FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
        AND owner_id::text = public.active_impersonation_target_profile_id()::text
        AND public.active_impersonation_target_profile_id() IS NOT NULL
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
        AND owner_id::text = public.active_impersonation_target_profile_id()::text
        AND public.active_impersonation_target_profile_id() IS NOT NULL
      );
  END IF;
END $$;

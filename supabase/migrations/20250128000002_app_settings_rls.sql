-- app_settings: RLS + RPC-based writes.
-- Table: key (text), value (boolean). Used for applications_paused, maintenance_mode, etc.
--
-- Reads: SELECT allowed for all (anon + authenticated).
-- Writes: no direct INSERT/UPDATE/DELETE; use upsert_app_setting RPC (admins only).
-- RPC runs as SECURITY DEFINER and bypasses RLS, avoiding "new row violates RLS" on upsert.

-- Ensure updated_at exists (triggers / replication may expect it)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Helper: true if current user is in admin_roles (SECURITY DEFINER bypasses admin_roles RLS).
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO service_role;

-- RPC: upsert a single app_setting. Admins only. Bypasses RLS.
CREATE OR REPLACE FUNCTION public.upsert_app_setting(p_key text, p_value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT public.is_app_admin()) THEN
    RAISE EXCEPTION 'Only admins can update app_settings';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_app_setting(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_app_setting(text, boolean) TO service_role;

-- RLS: enable and allow SELECT only
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_insert" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_update" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_delete" ON public.app_settings;

CREATE POLICY "app_settings_select_all"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies. Writes go through upsert_app_setting RPC.

-- Realtime (for apply page, admin, maintenance gate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

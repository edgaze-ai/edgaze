CREATE TABLE IF NOT EXISTS public.creator_platform_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform_fee_percentage integer NOT NULL CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100),
  starts_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  ends_at timestamptz NOT NULL,
  reason text,
  created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT creator_platform_fee_overrides_window_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_creator_platform_fee_overrides_creator_window
  ON public.creator_platform_fee_overrides(creator_id, starts_at DESC, ends_at DESC)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS update_creator_platform_fee_overrides_updated_at
  ON public.creator_platform_fee_overrides;
CREATE TRIGGER update_creator_platform_fee_overrides_updated_at
  BEFORE UPDATE ON public.creator_platform_fee_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.creator_platform_fee_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view creator fee overrides" ON public.creator_platform_fee_overrides;
CREATE POLICY "Admins can view creator fee overrides"
  ON public.creator_platform_fee_overrides
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert creator fee overrides" ON public.creator_platform_fee_overrides;
CREATE POLICY "Admins can insert creator fee overrides"
  ON public.creator_platform_fee_overrides
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update creator fee overrides" ON public.creator_platform_fee_overrides;
CREATE POLICY "Admins can update creator fee overrides"
  ON public.creator_platform_fee_overrides
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.creator_platform_fee_overrides IS 'Temporary creator-specific marketplace fee overrides, such as 0% fee launch windows.';

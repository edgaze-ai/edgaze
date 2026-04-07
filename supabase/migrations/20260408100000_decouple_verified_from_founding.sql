-- Founding (OG) and platform verified are independent.
-- If a prior deploy ran a backfill from is_founding_creator → is_verified_creator, ops may reset
-- verification in the admin panel; new grants use is_verified_creator only.
COMMENT ON COLUMN public.profiles.is_founding_creator IS 'OG / founding creator — badge on public profile only; does not imply is_verified_creator.';

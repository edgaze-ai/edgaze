-- Verified creator: identity confirmed and work quality reviewed (Edgaze).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_creator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_verified_creator IS 'When true, show Verified Creator badge across Edgaze. Independent from is_founding_creator (OG is profile-only).';

-- Add country column to profiles for payout onboarding
-- ISO 3166-1 alpha-2 (e.g. US, GB) - required before Stripe Connect setup

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;

COMMENT ON COLUMN public.profiles.country IS 'ISO 3166-1 alpha-2 country code; required before Stripe Connect setup.';

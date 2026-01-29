-- Founding Creator badge: everyone currently on Edgaze and every new user gets the badge.
-- Run this in the Supabase SQL editor.

-- Add column (default true for all new users)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_founding_creator boolean NOT NULL DEFAULT true;

-- Ensure all existing users have the badge
UPDATE public.profiles
SET is_founding_creator = true;

COMMENT ON COLUMN public.profiles.is_founding_creator IS 'When true, show "Founding Creator" badge next to the user''s name in the UI.';

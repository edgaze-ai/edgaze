-- Run this in Supabase SQL Editor.
-- Founding Creator badge: all current + new users get the badge.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_founding_creator boolean NOT NULL DEFAULT true;

UPDATE public.profiles
SET is_founding_creator = true;

COMMENT ON COLUMN public.profiles.is_founding_creator IS 'When true, show "Founding Creator" badge (beta.svg) next to the user''s name in the UI.';

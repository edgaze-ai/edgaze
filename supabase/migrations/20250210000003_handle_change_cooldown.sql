-- Add handle_last_changed_at column to profiles table
-- This tracks when the user last changed their handle for 2-month cooldown enforcement
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS handle_last_changed_at timestamp with time zone;

-- Backfill existing users with their profile creation date (or null for flexibility)
-- This ensures existing users can change their handle once without penalty
UPDATE public.profiles
SET handle_last_changed_at = NULL
WHERE handle_last_changed_at IS NULL;

-- Create function to check if handle change is allowed (2 months = 60 days)
CREATE OR REPLACE FUNCTION public.can_change_handle(user_id_input uuid)
RETURNS TABLE (
  can_change boolean,
  last_changed_at timestamp with time zone,
  next_allowed_at timestamp with time zone,
  days_remaining integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_change timestamp with time zone;
  next_allowed timestamp with time zone;
  days_left integer;
BEGIN
  -- Get the last time this user changed their handle
  SELECT p.handle_last_changed_at INTO last_change
  FROM profiles p
  WHERE p.id = user_id_input;

  -- If never changed (NULL), they can change it
  IF last_change IS NULL THEN
    RETURN QUERY SELECT true, NULL::timestamp with time zone, NULL::timestamp with time zone, 0;
    RETURN;
  END IF;

  -- Calculate next allowed change date (60 days after last change)
  next_allowed := last_change + INTERVAL '60 days';
  
  -- Calculate days remaining
  days_left := GREATEST(0, EXTRACT(day FROM (next_allowed - now()))::integer);

  -- Check if 60 days have passed
  IF now() >= next_allowed THEN
    RETURN QUERY SELECT true, last_change, next_allowed, 0;
  ELSE
    RETURN QUERY SELECT false, last_change, next_allowed, days_left;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.can_change_handle(uuid) IS 'Check if user can change their handle (60-day cooldown). Returns can_change flag, last change date, next allowed date, and days remaining.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_handle_last_changed 
ON public.profiles(handle_last_changed_at) 
WHERE handle_last_changed_at IS NOT NULL;

-- Add comment to the new column
COMMENT ON COLUMN public.profiles.handle_last_changed_at IS 'Timestamp of when the user last changed their handle. Used to enforce 60-day cooldown between handle changes.';

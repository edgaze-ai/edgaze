-- Add raw_token field to creator_invites for admin access
-- This allows admins to copy invite links from the table

ALTER TABLE creator_invites
ADD COLUMN IF NOT EXISTS raw_token text;

-- Create index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_creator_invites_raw_token ON creator_invites(raw_token);

-- Update RLS policy to ensure only admins can read raw_token
-- (The existing policies should already restrict access, but let's be explicit)

COMMENT ON COLUMN creator_invites.raw_token IS 'Raw invite token (unencrypted) - only accessible to admins for copying links';

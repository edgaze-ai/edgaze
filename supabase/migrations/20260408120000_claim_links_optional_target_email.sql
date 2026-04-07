-- Open claim links: no pre-bound email; first authenticated claimant wins after valid token.

ALTER TABLE public.creator_claim_links
  ALTER COLUMN target_email DROP NOT NULL;

COMMENT ON COLUMN public.creator_claim_links.target_email IS
  'Optional invite email. NULL = open link; any verified claimant may complete once.';

-- Drop q5 length check so optional/short one-liner is allowed.
ALTER TABLE public.closed_beta_applications
  DROP CONSTRAINT IF EXISTS cba_q5_len;

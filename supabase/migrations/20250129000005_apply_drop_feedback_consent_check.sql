-- Drop checks that forced required values; apply form now allows optional answers.
ALTER TABLE public.closed_beta_applications
  DROP CONSTRAINT IF EXISTS cba_feedback_consent_true,
  DROP CONSTRAINT IF EXISTS cba_q5_len;

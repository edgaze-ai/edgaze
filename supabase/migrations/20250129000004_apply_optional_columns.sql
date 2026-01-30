-- Allow NULL for optional apply form fields (feedback, one-liner, sharing, consent).
-- Application API no longer requires these; columns stay for backward compatibility.

ALTER TABLE public.closed_beta_applications
  ALTER COLUMN q4_feedback_commitment DROP NOT NULL,
  ALTER COLUMN q5_one_liner DROP NOT NULL,
  ALTER COLUMN q6_prior_sharing DROP NOT NULL,
  ALTER COLUMN feedback_consent DROP NOT NULL;

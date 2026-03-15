-- Ensure one reminder email per creator per type (day_30, day_60, day_80)

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_claim_email_log_creator_type
  ON public.creator_pending_claim_email_log(creator_id, email_type);

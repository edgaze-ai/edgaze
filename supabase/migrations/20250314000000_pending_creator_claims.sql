-- Pending creator claims: sell without joining Creator Program, 90-day claim window
-- Payments go to platform; creators can claim by completing payout onboarding within 90 days

-- ============================================
-- 1. Extend creator_earnings for pending claims
-- ============================================

-- Add claim_deadline_at for platform-held payments
ALTER TABLE public.creator_earnings
  ADD COLUMN IF NOT EXISTS claim_deadline_at timestamptz;

COMMENT ON COLUMN public.creator_earnings.claim_deadline_at IS 'For pending_claim: deadline to complete payout onboarding; after this, eligibility_expired';

-- Extend status: add pending_claim, cancelled, eligibility_expired
ALTER TABLE public.creator_earnings DROP CONSTRAINT IF EXISTS creator_earnings_status_check;

ALTER TABLE public.creator_earnings
  ADD CONSTRAINT creator_earnings_status_check CHECK (
    status IN (
      'pending',
      'available',
      'paid',
      'failed',
      'refunded',
      'pending_claim',
      'cancelled',
      'eligibility_expired'
    )
  );

-- Index for cron and transfers
CREATE INDEX IF NOT EXISTS idx_creator_earnings_pending_claim
  ON public.creator_earnings(creator_id, claim_deadline_at)
  WHERE status = 'pending_claim';

CREATE INDEX IF NOT EXISTS idx_creator_earnings_claim_deadline
  ON public.creator_earnings(claim_deadline_at)
  WHERE status = 'pending_claim';

-- ============================================
-- 2. creator_pending_claim_email_log
-- ============================================
-- Idempotent tracking for reminder emails (day 30, 60, 80)

CREATE TABLE IF NOT EXISTS public.creator_pending_claim_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_earning_id uuid REFERENCES public.creator_earnings(id) ON DELETE CASCADE NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('first_sale', 'day_30', 'day_60', 'day_80')),
  sent_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_claim_email_log_unique
  ON public.creator_pending_claim_email_log(creator_earning_id, email_type);

CREATE INDEX IF NOT EXISTS idx_pending_claim_email_log_creator
  ON public.creator_pending_claim_email_log(creator_id);

COMMENT ON TABLE public.creator_pending_claim_email_log IS 'Tracks reminder emails for pending payout claims; prevents duplicates';

-- RLS: block all direct user access; backend uses service role (bypasses RLS)
ALTER TABLE public.creator_pending_claim_email_log ENABLE ROW LEVEL SECURITY;

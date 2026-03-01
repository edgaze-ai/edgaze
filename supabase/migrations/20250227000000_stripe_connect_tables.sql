-- Stripe Connect & Payments Infrastructure
-- This migration creates all tables and functions needed for Stripe Connect integration
-- SAFE: All changes are additive (new tables, new columns with defaults)

-- ============================================
-- 1. stripe_connect_accounts
-- ============================================
-- Track creator Stripe Connect Express accounts

CREATE TABLE IF NOT EXISTS public.stripe_connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_account_id text UNIQUE NOT NULL,
  account_status text NOT NULL DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'restricted', 'disabled')),
  charges_enabled boolean DEFAULT false NOT NULL,
  payouts_enabled boolean DEFAULT false NOT NULL,
  details_submitted boolean DEFAULT false NOT NULL,
  country text,
  currency text DEFAULT 'usd',
  onboarding_completed_at timestamptz,
  last_verified_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_user_id ON public.stripe_connect_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_stripe_id ON public.stripe_connect_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_status ON public.stripe_connect_accounts(account_status);

COMMENT ON TABLE public.stripe_connect_accounts IS 'Tracks creator Stripe Connect Express accounts for monetization';
COMMENT ON COLUMN public.stripe_connect_accounts.account_status IS 'Status from Stripe: pending (onboarding), active (can receive payments), restricted (issues), disabled (suspended)';

-- ============================================
-- 2. creator_payouts
-- ============================================
-- Track payout batches (Stripe handles actual payouts automatically)

CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_account_id text REFERENCES public.stripe_connect_accounts(stripe_account_id) ON DELETE SET NULL,
  stripe_payout_id text UNIQUE NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  failure_code text,
  failure_message text,
  arrival_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_creator_payouts_creator_id ON public.creator_payouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_stripe_id ON public.creator_payouts(stripe_payout_id);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_status ON public.creator_payouts(status);

COMMENT ON TABLE public.creator_payouts IS 'Tracks Stripe automatic payouts to creators (for display only, Stripe handles actual transfers)';

-- ============================================
-- 3. creator_earnings
-- ============================================
-- Track individual earnings from purchases

CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_account_id text REFERENCES public.stripe_connect_accounts(stripe_account_id) ON DELETE SET NULL,
  purchase_id uuid NOT NULL,
  purchase_type text NOT NULL CHECK (purchase_type IN ('workflow', 'prompt')),
  gross_amount_cents integer NOT NULL CHECK (gross_amount_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  net_amount_cents integer NOT NULL CHECK (net_amount_cents >= 0),
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'available', 'paid', 'failed', 'refunded')),
  payout_id uuid REFERENCES public.creator_payouts(id) ON DELETE SET NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_transfer_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz,
  refunded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON public.creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_purchase ON public.creator_earnings(purchase_id, purchase_type);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON public.creator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_payment_intent ON public.creator_earnings(stripe_payment_intent_id);

COMMENT ON TABLE public.creator_earnings IS 'Individual earnings records from workflow/prompt purchases';
COMMENT ON COLUMN public.creator_earnings.status IS 'pending (processing), available (ready for payout), paid (paid out), failed (payout failed), refunded (purchase refunded)';

-- ============================================
-- 4. stripe_webhook_events
-- ============================================
-- Idempotent webhook processing

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed boolean DEFAULT false NOT NULL,
  processing_attempts integer DEFAULT 0 NOT NULL,
  payload jsonb NOT NULL,
  error_message text,
  last_error_at timestamptz,
  processing_duration_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.stripe_webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON public.stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON public.stripe_webhook_events(created_at) WHERE processed = false;

COMMENT ON TABLE public.stripe_webhook_events IS 'Stores all Stripe webhook events for idempotent processing';

-- ============================================
-- 5. webhook_dead_letter_queue
-- ============================================
-- Store permanently failed webhooks for manual review

CREATE TABLE IF NOT EXISTS public.webhook_dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  processing_attempts integer NOT NULL,
  payload jsonb NOT NULL,
  error_message text,
  last_error_at timestamptz,
  moved_at timestamptz DEFAULT now() NOT NULL,
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_resolved ON public.webhook_dead_letter_queue(resolved);

COMMENT ON TABLE public.webhook_dead_letter_queue IS 'Failed webhooks after 5+ retry attempts, requires manual intervention';

-- ============================================
-- 6. payment_failures
-- ============================================
-- Track failed payment attempts for fraud detection

CREATE TABLE IF NOT EXISTS public.payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text NOT NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id uuid,
  prompt_id uuid,
  failure_code text,
  failure_message text,
  amount_cents integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_failures_buyer ON public.payment_failures(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_failures_intent ON public.payment_failures(stripe_payment_intent_id);

COMMENT ON TABLE public.payment_failures IS 'Tracks failed payment attempts for fraud detection and analytics';

-- ============================================
-- 7. chargebacks
-- ============================================
-- Track chargebacks and disputes

CREATE TABLE IF NOT EXISTS public.chargebacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  purchase_type text NOT NULL CHECK (purchase_type IN ('workflow', 'prompt')),
  stripe_charge_id text NOT NULL,
  stripe_dispute_id text,
  dispute_reason text,
  dispute_status text CHECK (dispute_status IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost')),
  amount_cents integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_chargebacks_purchase ON public.chargebacks(purchase_id, purchase_type);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON public.chargebacks(dispute_status);

COMMENT ON TABLE public.chargebacks IS 'Tracks chargebacks and dispute lifecycle';

-- ============================================
-- 8. creator_debts
-- ============================================
-- Track negative balances from post-payout refunds

CREATE TABLE IF NOT EXISTS public.creator_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL CHECK (reason IN ('refund_after_payout', 'chargeback_after_payout', 'manual_adjustment')),
  purchase_id uuid,
  notes text,
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_debts_creator ON public.creator_debts(creator_id, resolved);

COMMENT ON TABLE public.creator_debts IS 'Tracks creator debts from refunds/chargebacks after payout';

-- ============================================
-- 9. earnings_mismatches
-- ============================================
-- Track discrepancies between our records and Stripe

CREATE TABLE IF NOT EXISTS public.earnings_mismatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  expected_status text NOT NULL,
  actual_stripe_status text NOT NULL,
  amount_cents integer NOT NULL,
  detected_at timestamptz DEFAULT now() NOT NULL,
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamptz,
  resolution_notes text
);

CREATE INDEX IF NOT EXISTS idx_earnings_mismatches_resolved ON public.earnings_mismatches(resolved);

COMMENT ON TABLE public.earnings_mismatches IS 'Tracks discrepancies found during daily reconciliation';

-- ============================================
-- 10. fraud_alerts
-- ============================================
-- Track suspicious activity patterns

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metadata jsonb DEFAULT '{}'::jsonb,
  reviewed boolean DEFAULT false NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON public.fraud_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_reviewed ON public.fraud_alerts(reviewed, severity);

COMMENT ON TABLE public.fraud_alerts IS 'Suspicious activity patterns flagged for review';

-- ============================================
-- 11. audit_logs
-- ============================================
-- Comprehensive audit trail for all payment operations

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at);

COMMENT ON TABLE public.audit_logs IS 'Complete audit trail of all payment and monetization actions';

-- ============================================
-- 12. Update existing tables
-- ============================================

-- Add Stripe columns to workflow_purchases
ALTER TABLE public.workflow_purchases
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS amount_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer,
  ADD COLUMN IF NOT EXISTS creator_net_cents integer,
  ADD COLUMN IF NOT EXISTS payment_method_type text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz;

-- Add unique constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_purchases_stripe_payment_intent_id_key'
  ) THEN
    ALTER TABLE public.workflow_purchases
      ADD CONSTRAINT workflow_purchases_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_purchases_stripe_checkout_session_id_key'
  ) THEN
    ALTER TABLE public.workflow_purchases
      ADD CONSTRAINT workflow_purchases_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);
  END IF;
END $$;

-- Add Stripe columns to prompt_purchases
ALTER TABLE public.prompt_purchases
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS amount_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer,
  ADD COLUMN IF NOT EXISTS creator_net_cents integer,
  ADD COLUMN IF NOT EXISTS payment_method_type text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz;

-- Add unique constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prompt_purchases_stripe_payment_intent_id_key'
  ) THEN
    ALTER TABLE public.prompt_purchases
      ADD CONSTRAINT prompt_purchases_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prompt_purchases_stripe_checkout_session_id_key'
  ) THEN
    ALTER TABLE public.prompt_purchases
      ADD CONSTRAINT prompt_purchases_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);
  END IF;
END $$;

-- Add monetization columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_onboarding_status text DEFAULT 'not_started' CHECK (stripe_onboarding_status IN ('not_started', 'pending', 'completed')),
  ADD COLUMN IF NOT EXISTS can_receive_payments boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS total_earnings_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS available_balance_cents integer DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_status ON public.profiles(stripe_onboarding_status);

COMMENT ON COLUMN public.profiles.stripe_onboarding_status IS 'Stripe Connect onboarding status';
COMMENT ON COLUMN public.profiles.can_receive_payments IS 'True when Stripe account is active and can receive payments';
COMMENT ON COLUMN public.profiles.total_earnings_cents IS 'Lifetime earnings in cents';
COMMENT ON COLUMN public.profiles.available_balance_cents IS 'Current available balance in cents (not yet paid out)';

-- ============================================
-- 13. Database RPC Functions
-- ============================================

-- Increment webhook processing attempts (atomic)
CREATE OR REPLACE FUNCTION public.increment_webhook_attempts(
  event_id text,
  error_msg text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.stripe_webhook_events
  SET 
    processing_attempts = processing_attempts + 1,
    error_message = error_msg,
    last_error_at = now()
  WHERE stripe_event_id = event_id;
END;
$$;

COMMENT ON FUNCTION public.increment_webhook_attempts IS 'Atomically increment webhook processing attempts';

-- Increment creator balance (atomic)
CREATE OR REPLACE FUNCTION public.increment_creator_balance(
  creator_id uuid,
  amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    available_balance_cents = COALESCE(available_balance_cents, 0) + amount_cents,
    total_earnings_cents = COALESCE(total_earnings_cents, 0) + amount_cents
  WHERE id = creator_id;
END;
$$;

COMMENT ON FUNCTION public.increment_creator_balance IS 'Atomically increment creator earnings and balance';

-- Adjust creator balance (for refunds - can be negative)
CREATE OR REPLACE FUNCTION public.adjust_creator_balance(
  creator_id uuid,
  amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET available_balance_cents = COALESCE(available_balance_cents, 0) + amount_cents
  WHERE id = creator_id;
END;
$$;

COMMENT ON FUNCTION public.adjust_creator_balance IS 'Adjust creator balance (can go negative for refunds after payout)';

-- Apply partial refund (atomic operation)
CREATE OR REPLACE FUNCTION public.apply_partial_refund(
  payment_intent_id text,
  refund_amount integer,
  platform_fee_refund integer,
  creator_refund integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update workflow_purchases
  UPDATE public.workflow_purchases
  SET 
    amount_cents = amount_cents - refund_amount,
    platform_fee_cents = platform_fee_cents - platform_fee_refund,
    creator_net_cents = creator_net_cents - creator_refund
  WHERE stripe_payment_intent_id = payment_intent_id;
  
  -- Update prompt_purchases
  UPDATE public.prompt_purchases
  SET 
    amount_cents = amount_cents - refund_amount,
    platform_fee_cents = platform_fee_cents - platform_fee_refund,
    creator_net_cents = creator_net_cents - creator_refund
  WHERE stripe_payment_intent_id = payment_intent_id;
END;
$$;

COMMENT ON FUNCTION public.apply_partial_refund IS 'Atomically apply partial refund to purchase records';

-- Check workflow access (for RLS policies)
CREATE OR REPLACE FUNCTION public.has_workflow_access(
  user_id uuid,
  workflow_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workflow_purchases
    WHERE buyer_id = user_id
    AND workflow_id = workflow_id
    AND status = 'paid'
    AND refunded_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.has_workflow_access IS 'Check if user has paid access to workflow (used by RLS)';

-- Check prompt access (for RLS policies)
CREATE OR REPLACE FUNCTION public.has_prompt_access(
  user_id uuid,
  prompt_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.prompt_purchases
    WHERE buyer_id = user_id
    AND prompt_id = prompt_id
    AND status = 'paid'
    AND refunded_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.has_prompt_access IS 'Check if user has paid access to prompt (used by RLS)';

-- ============================================
-- 14. Row Level Security (RLS) Policies
-- ============================================

-- stripe_connect_accounts: Users can only see their own account
ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Stripe Connect account"
  ON public.stripe_connect_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own Stripe Connect account"
  ON public.stripe_connect_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- creator_earnings: Creators can only see their own earnings
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own earnings"
  ON public.creator_earnings
  FOR SELECT
  USING (auth.uid() = creator_id);

-- creator_payouts: Creators can only see their own payouts
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own payouts"
  ON public.creator_payouts
  FOR SELECT
  USING (auth.uid() = creator_id);

-- payment_failures: Users can only see their own failures
ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment failures"
  ON public.payment_failures
  FOR SELECT
  USING (auth.uid() = buyer_id);

-- chargebacks: Only admins can view
ALTER TABLE public.chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all chargebacks"
  ON public.chargebacks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- creator_debts: Creators can view their own debts
ALTER TABLE public.creator_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own debts"
  ON public.creator_debts
  FOR SELECT
  USING (auth.uid() = creator_id);

-- audit_logs: Only admins can view
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- earnings_mismatches: Only admins can view
ALTER TABLE public.earnings_mismatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view earnings mismatches"
  ON public.earnings_mismatches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- fraud_alerts: Only admins can view
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fraud alerts"
  ON public.fraud_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- webhook_dead_letter_queue: Only admins can view
ALTER TABLE public.webhook_dead_letter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook DLQ"
  ON public.webhook_dead_letter_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- stripe_webhook_events: Only admins can view
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

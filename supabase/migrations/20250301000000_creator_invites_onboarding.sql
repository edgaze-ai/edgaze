-- Creator Invites & Onboarding System
-- Premium white-glove onboarding for invited creators
-- SAFE: All changes are additive (new tables only)

-- ============================================
-- 1. creator_invites
-- ============================================
-- Personalized invite tokens for white-glove creator onboarding

CREATE TABLE IF NOT EXISTS public.creator_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  creator_name text NOT NULL,
  creator_photo_url text NOT NULL,
  custom_message text NOT NULL,
  created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'claimed', 'completed', 'revoked', 'expired')),
  expires_at timestamptz DEFAULT (now() + interval '14 days') NOT NULL,
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_invites_token_hash ON public.creator_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_creator_invites_status ON public.creator_invites(status);
CREATE INDEX IF NOT EXISTS idx_creator_invites_claimed_by ON public.creator_invites(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_invites_expires_at ON public.creator_invites(expires_at) WHERE status = 'active';

COMMENT ON TABLE public.creator_invites IS 'Personalized invite tokens for premium creator onboarding';
COMMENT ON COLUMN public.creator_invites.token_hash IS 'SHA-256 hash of the raw token (never store raw tokens)';
COMMENT ON COLUMN public.creator_invites.status IS 'active (unused), claimed (user signed up), completed (onboarding done), revoked (admin cancelled), expired (past expires_at)';

-- ============================================
-- 2. creator_onboarding
-- ============================================
-- Track onboarding progress for invited creators

CREATE TABLE IF NOT EXISTS public.creator_onboarding (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.creator_invites(id) ON DELETE SET NULL,
  step text DEFAULT 'welcome' NOT NULL CHECK (step IN ('welcome', 'message', 'auth', 'profile', 'stripe', 'done')),
  stripe_choice text DEFAULT 'unset' NOT NULL CHECK (stripe_choice IN ('now', 'later', 'unset')),
  stripe_account_id text,
  stripe_status text DEFAULT 'not_started' NOT NULL CHECK (stripe_status IN ('not_started', 'in_progress', 'complete', 'restricted')),
  profile_completed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_onboarding_invite_id ON public.creator_onboarding(invite_id);
CREATE INDEX IF NOT EXISTS idx_creator_onboarding_step ON public.creator_onboarding(step);
CREATE INDEX IF NOT EXISTS idx_creator_onboarding_stripe_status ON public.creator_onboarding(stripe_status);

COMMENT ON TABLE public.creator_onboarding IS 'Tracks onboarding progress for invited creators';
COMMENT ON COLUMN public.creator_onboarding.step IS 'Current step in onboarding flow: welcome → message → auth → profile → stripe → done';
COMMENT ON COLUMN public.creator_onboarding.stripe_choice IS 'Whether creator chose to set up Stripe now or later';

-- ============================================
-- 3. Database Functions
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_creator_invites_updated_at ON public.creator_invites;
CREATE TRIGGER update_creator_invites_updated_at
  BEFORE UPDATE ON public.creator_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_creator_onboarding_updated_at ON public.creator_onboarding;
CREATE TRIGGER update_creator_onboarding_updated_at
  BEFORE UPDATE ON public.creator_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-expire invites function (call this from a cron job)
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.creator_invites
  SET status = 'expired'
  WHERE status = 'active'
  AND expires_at < now();
END;
$$;

COMMENT ON FUNCTION public.expire_old_invites IS 'Mark active invites past their expiry date as expired (run via cron)';

-- ============================================
-- 4. Row Level Security (RLS) Policies
-- ============================================

-- creator_invites: Only admins can manage, users can view their own claimed invite
ALTER TABLE public.creator_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all invites"
  ON public.creator_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert invites"
  ON public.creator_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update invites"
  ON public.creator_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own claimed invite"
  ON public.creator_invites
  FOR SELECT
  USING (auth.uid() = claimed_by_user_id);

-- creator_onboarding: Users can only see and update their own onboarding
ALTER TABLE public.creator_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding"
  ON public.creator_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
  ON public.creator_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON public.creator_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding"
  ON public.creator_onboarding
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

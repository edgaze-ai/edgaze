-- Safe migration: Drop and recreate everything for creator_invites
-- This handles the case where policies exist but tables don't

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all invites" ON public.creator_invites;
DROP POLICY IF EXISTS "Admins can insert invites" ON public.creator_invites;
DROP POLICY IF EXISTS "Admins can update invites" ON public.creator_invites;
DROP POLICY IF EXISTS "Users can view their own claimed invite" ON public.creator_invites;
DROP POLICY IF EXISTS "Users can view own onboarding" ON public.creator_onboarding;
DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.creator_onboarding;
DROP POLICY IF EXISTS "Users can update own onboarding" ON public.creator_onboarding;
DROP POLICY IF EXISTS "Admins can view all onboarding" ON public.creator_onboarding;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_creator_invites_updated_at ON public.creator_invites;
DROP TRIGGER IF EXISTS update_creator_onboarding_updated_at ON public.creator_onboarding;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.expire_old_invites();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop existing tables (CASCADE to handle dependencies)
DROP TABLE IF EXISTS public.creator_onboarding CASCADE;
DROP TABLE IF EXISTS public.creator_invites CASCADE;

-- Now create everything fresh
-- ============================================
-- 1. creator_invites
-- ============================================
CREATE TABLE public.creator_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  raw_token text,
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

CREATE INDEX idx_creator_invites_token_hash ON public.creator_invites(token_hash);
CREATE INDEX idx_creator_invites_status ON public.creator_invites(status);
CREATE INDEX idx_creator_invites_claimed_by ON public.creator_invites(claimed_by_user_id);
CREATE INDEX idx_creator_invites_expires_at ON public.creator_invites(expires_at) WHERE status = 'active';
CREATE INDEX idx_creator_invites_raw_token ON public.creator_invites(raw_token);

COMMENT ON TABLE public.creator_invites IS 'Personalized invite tokens for premium creator onboarding';
COMMENT ON COLUMN public.creator_invites.token_hash IS 'SHA-256 hash of the raw token';
COMMENT ON COLUMN public.creator_invites.raw_token IS 'Raw invite token (unencrypted) - only accessible to admins for copying links';

-- ============================================
-- 2. creator_onboarding
-- ============================================
CREATE TABLE public.creator_onboarding (
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

CREATE INDEX idx_creator_onboarding_invite_id ON public.creator_onboarding(invite_id);
CREATE INDEX idx_creator_onboarding_step ON public.creator_onboarding(step);
CREATE INDEX idx_creator_onboarding_stripe_status ON public.creator_onboarding(stripe_status);

-- ============================================
-- 3. Functions
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creator_invites_updated_at
  BEFORE UPDATE ON public.creator_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_onboarding_updated_at
  BEFORE UPDATE ON public.creator_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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

-- ============================================
-- 4. RLS Policies
-- ============================================
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

-- Creator admin provisioning, claim links, impersonation sessions, audit events

-- ============ PROFILES lifecycle (canonical provenance: source) ============
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self_signup'
        CHECK (source IN ('self_signup', 'admin_provisioned'));
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'claimed'
        CHECK (claim_status IN ('unclaimed', 'claimed'));
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS provisioned_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_profiles_claim_status ON public.profiles(claim_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_profiles_source ON public.profiles(source, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_profiles_provisioned_by_admin
      ON public.profiles(provisioned_by_admin_id, created_at DESC);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.source IS 'self_signup | admin_provisioned';
COMMENT ON COLUMN public.profiles.claim_status IS 'unclaimed until creator completes claim flow';

-- Backfill existing rows
UPDATE public.profiles
SET
  source = COALESCE(source, 'self_signup'),
  claim_status = COALESCE(claim_status, 'claimed'),
  claimed_at = COALESCE(claimed_at, created_at)
WHERE claim_status IS NOT DISTINCT FROM 'claimed' AND claimed_at IS NULL;

-- ============ creator_claim_links ============
CREATE TABLE IF NOT EXISTS public.creator_claim_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'consumed', 'revoked', 'expired')),
  sent_by_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_by_link_id uuid REFERENCES public.creator_claim_links(id) ON DELETE SET NULL,
  email_delivery_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_claim_links_one_active
  ON public.creator_claim_links(profile_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_creator_claim_links_target_email ON public.creator_claim_links(target_email);
CREATE INDEX IF NOT EXISTS idx_creator_claim_links_expires_at
  ON public.creator_claim_links(expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_creator_claim_links_sent_by_admin
  ON public.creator_claim_links(sent_by_admin_id, created_at DESC);

ALTER TABLE public.creator_claim_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select creator_claim_links" ON public.creator_claim_links;
CREATE POLICY "Admins can select creator_claim_links"
  ON public.creator_claim_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert creator_claim_links" ON public.creator_claim_links;
CREATE POLICY "Admins can insert creator_claim_links"
  ON public.creator_claim_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update creator_claim_links" ON public.creator_claim_links;
CREATE POLICY "Admins can update creator_claim_links"
  ON public.creator_claim_links FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));

-- ============ admin_impersonation_sessions ============
CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash text NOT NULL UNIQUE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'expired', 'revoked')),
  reason text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  ended_reason text,
  return_to_admin_path text,
  started_ip text,
  started_user_agent text,
  ended_ip text,
  ended_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_active_by_admin
  ON public.admin_impersonation_sessions(admin_user_id, started_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_impersonation_target_profile
  ON public.admin_impersonation_sessions(target_profile_id, started_at DESC);

ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read own impersonation sessions" ON public.admin_impersonation_sessions;
CREATE POLICY "Admins can read own impersonation sessions"
  ON public.admin_impersonation_sessions FOR SELECT
  USING (admin_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can insert impersonation sessions" ON public.admin_impersonation_sessions;
CREATE POLICY "Admins can insert impersonation sessions"
  ON public.admin_impersonation_sessions FOR INSERT
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update own impersonation sessions" ON public.admin_impersonation_sessions;
CREATE POLICY "Admins can update own impersonation sessions"
  ON public.admin_impersonation_sessions FOR UPDATE
  USING (admin_user_id = auth.uid());

-- ============ creator_audit_events ============
CREATE TABLE IF NOT EXISTS public.creator_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT 'unknown',
  actor_mode text NOT NULL
    CHECK (actor_mode IN ('creator_self', 'admin_impersonation', 'admin_direct', 'system')),
  effective_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  impersonation_session_id uuid REFERENCES public.admin_impersonation_sessions(id) ON DELETE SET NULL,
  resource_type text NOT NULL DEFAULT '',
  resource_id text NOT NULL DEFAULT '',
  request_id uuid,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_audit_effective_profile
  ON public.creator_audit_events(effective_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_audit_actor
  ON public.creator_audit_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_audit_action
  ON public.creator_audit_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_audit_impersonation
  ON public.creator_audit_events(impersonation_session_id, created_at DESC);

ALTER TABLE public.creator_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read creator_audit_events" ON public.creator_audit_events;
CREATE POLICY "Admins can read creator_audit_events"
  ON public.creator_audit_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));

-- ============ admin_roles.role (optional tier) ============
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_roles'
  ) THEN
    ALTER TABLE public.admin_roles
      ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'super_admin'
        CHECK (role IN ('super_admin', 'creator_ops_admin', 'support_admin', 'read_only_admin'));
  END IF;
END $$;

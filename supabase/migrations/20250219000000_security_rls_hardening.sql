-- Security: RLS hardening for user data protection
-- Ensures critical tables have RLS enabled with least-privilege policies

-- ============ PROFILES ============
-- Profiles: public read, authenticated users can update only their own row
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "Profiles are viewable by everyone"
      ON public.profiles FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);

    -- No INSERT/DELETE for anon/authenticated (profiles created via triggers or admin)
  END IF;
END $$;

-- ============ ASSETS ============
-- Assets: users can only access their own assets
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assets') THEN
    ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can read own assets" ON public.assets;
    CREATE POLICY "Users can read own assets"
      ON public.assets FOR SELECT
      TO authenticated
      USING (auth.uid()::text = user_id);

    DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
    CREATE POLICY "Users can insert own assets"
      ON public.assets FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);

    DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;
    CREATE POLICY "Users can delete own assets"
      ON public.assets FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);

    -- Service role bypasses RLS for API routes
  END IF;
END $$;

-- ============ WORKFLOW_DRAFTS ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_drafts') THEN
    ALTER TABLE public.workflow_drafts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can read own workflow drafts" ON public.workflow_drafts;
    CREATE POLICY "Users can read own workflow drafts"
      ON public.workflow_drafts FOR SELECT
      TO authenticated
      USING (auth.uid()::text = owner_id);

    DROP POLICY IF EXISTS "Users can insert own workflow drafts" ON public.workflow_drafts;
    CREATE POLICY "Users can insert own workflow drafts"
      ON public.workflow_drafts FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = owner_id);

    DROP POLICY IF EXISTS "Users can update own workflow drafts" ON public.workflow_drafts;
    CREATE POLICY "Users can update own workflow drafts"
      ON public.workflow_drafts FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = owner_id)
      WITH CHECK (auth.uid()::text = owner_id);

    DROP POLICY IF EXISTS "Users can delete own workflow drafts" ON public.workflow_drafts;
    CREATE POLICY "Users can delete own workflow drafts"
      ON public.workflow_drafts FOR DELETE
      TO authenticated
      USING (auth.uid()::text = owner_id);
  END IF;
END $$;

-- ============ REPORTS ============
-- Reports: authenticated can insert, only service_role/admin for read/update
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
    ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.reports;
    CREATE POLICY "Authenticated users can submit reports"
      ON public.reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = reporter_id);

    DROP POLICY IF EXISTS "Admins can read reports" ON public.reports;
    CREATE POLICY "Admins can read reports"
      ON public.reports FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.admin_roles WHERE admin_roles.user_id = auth.uid())
      );

    DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
    CREATE POLICY "Admins can update reports"
      ON public.reports FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.admin_roles WHERE admin_roles.user_id = auth.uid())
      );
  END IF;
END $$;

-- ============ ADMIN_ROLES ============
-- Admin roles: only admins can read (used by isAdmin check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_roles') THEN
    ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_roles;
    CREATE POLICY "Users can check own admin status"
      ON public.admin_roles FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

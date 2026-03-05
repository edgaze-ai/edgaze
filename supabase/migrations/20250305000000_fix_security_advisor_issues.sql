-- Fix Supabase Advisor security issues:
-- 1. workflow_run_counts: Ensure security_invoker = true (no SECURITY DEFINER)
-- 2. handle_history: Enable RLS
-- 3. connect_account_subscriptions: Enable RLS
-- No data loss - only adds security controls.

-- ============ 1. WORKFLOW_RUN_COUNTS VIEW (Security Definer) ============
-- Recreate view with security_invoker = true so it runs with invoker's privileges.
DROP VIEW IF EXISTS public.workflow_run_counts;

CREATE VIEW public.workflow_run_counts
WITH (security_invoker = true)
AS
SELECT
  user_id,
  workflow_id,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE status = 'failed')   AS failed_count,
  COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) AS total_count,
  MAX(completed_at) AS last_run_at
FROM public.workflow_runs
WHERE status IN ('completed', 'failed')
  AND (auth.uid() IS NOT NULL AND user_id = auth.uid())
GROUP BY user_id, workflow_id;

COMMENT ON VIEW public.workflow_run_counts IS 'Per-user, per-workflow run counts. Only returns rows for the current user (auth.uid()).';

GRANT SELECT ON public.workflow_run_counts TO authenticated;

-- ============ 2. HANDLE_HISTORY (RLS Disabled) ============
-- handle_history is only accessed via service_role (handle-redirect, cascade-handle API).
-- Enabling RLS blocks direct anon/authenticated access; service_role bypasses RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'handle_history') THEN
    ALTER TABLE public.handle_history ENABLE ROW LEVEL SECURITY;

    -- No policies for authenticated/anon - all access is via service_role.
    -- This blocks direct table access from anon and authenticated clients.
  END IF;
END $$;

-- ============ 3. CONNECT_ACCOUNT_SUBSCRIPTIONS (RLS Disabled) ============
-- Webhooks use service_role (bypasses RLS). Subscription status API uses user client.
ALTER TABLE public.connect_account_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT only their own subscription rows
DROP POLICY IF EXISTS "Users can read own connect account subscription" ON public.connect_account_subscriptions;
CREATE POLICY "Users can read own connect account subscription"
  ON public.connect_account_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for authenticated - only service_role (webhooks) can modify

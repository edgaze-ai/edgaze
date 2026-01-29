-- Restrict workflow_run_counts (view) so users see only their own rows.
-- View columns: user_id, workflow_id, completed_count, failed_count, total_count, last_run_at.
-- Postgres does not support RLS on views, so we recreate the view with a filter:
-- only rows where user_id = auth.uid(). App uses get_user_workflow_run_count() RPC.

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

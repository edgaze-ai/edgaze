-- Ultra-reliable run counting: atomic completion, count all terminal states, trigger safety net
-- Counts completed, failed, timeout, cancelled (every run that consumed a slot)
-- Atomic complete + get_count RPC eliminates race conditions and eliminates need for delayed reads

-- 0. Drop any overloaded versions to avoid "function name is not unique" on COMMENT
DROP FUNCTION IF EXISTS public.get_user_workflow_run_count(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_user_workflow_run_count(UUID, UUID, UUID);

-- 1. Create get_user_workflow_run_count to count ALL terminal states
CREATE OR REPLACE FUNCTION public.get_user_workflow_run_count(
  p_user_id UUID,
  p_workflow_id UUID DEFAULT NULL,
  p_draft_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_count INTEGER;
  v_terminal_statuses TEXT[] := ARRAY['completed', 'failed', 'timeout', 'cancelled'];
BEGIN
  -- Count runs that ended (any terminal status with completed_at set)
  IF p_draft_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE 
      user_id = p_user_id
      AND draft_id = p_draft_id
      AND status = ANY(v_terminal_statuses)
      AND completed_at IS NOT NULL;
  ELSIF p_workflow_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE 
      user_id = p_user_id
      AND workflow_id = p_workflow_id
      AND status = ANY(v_terminal_statuses)
      AND completed_at IS NOT NULL;
  ELSE
    RETURN 0;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.get_user_workflow_run_count(UUID, UUID, UUID) IS 'Count of runs in terminal state (completed/failed/timeout/cancelled) with completed_at set. Draft-first.';

GRANT EXECUTE ON FUNCTION public.get_user_workflow_run_count(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_workflow_run_count(UUID, UUID, UUID) TO authenticated;

-- 2. Trigger to auto-set completed_at when status becomes terminal (safety net)
CREATE OR REPLACE FUNCTION public.workflow_runs_set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed', 'timeout', 'cancelled') AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflow_runs_set_completed_at_trigger ON public.workflow_runs;
CREATE TRIGGER workflow_runs_set_completed_at_trigger
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('completed', 'failed', 'timeout', 'cancelled')
  )
  EXECUTE FUNCTION public.workflow_runs_set_completed_at();

-- 3. Atomic complete workflow run AND return new count (single transaction, no race)
CREATE OR REPLACE FUNCTION public.complete_workflow_run_and_get_count(
  p_run_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL,
  p_state_snapshot JSONB DEFAULT NULL
)
RETURNS TABLE(new_count INTEGER, user_id_out UUID, workflow_id_out UUID, draft_id_out UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER;
  v_terminal_statuses TEXT[] := ARRAY['completed', 'failed', 'timeout', 'cancelled'];
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'timeout', 'cancelled') THEN
    RAISE EXCEPTION 'complete_workflow_run_and_get_count: status must be terminal (completed/failed/timeout/cancelled), got %', p_status;
  END IF;

  -- Update the run atomically (trigger will set completed_at if not provided)
  UPDATE public.workflow_runs
  SET
    status = p_status,
    completed_at = COALESCE(completed_at, now()),
    duration_ms = COALESCE(p_duration_ms, duration_ms),
    error_details = COALESCE(p_error_details, error_details),
    state_snapshot = COALESCE(p_state_snapshot, state_snapshot),
    updated_at = now()
  WHERE id = p_run_id
  RETURNING workflow_runs.* INTO v_row;

  IF v_row IS NULL THEN
    RETURN; -- Run not found
  END IF;

  user_id_out := v_row.user_id;
  workflow_id_out := v_row.workflow_id;
  draft_id_out := v_row.draft_id;

  -- Compute new count in same transaction (guaranteed consistency)
  IF v_row.draft_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE user_id = v_row.user_id
      AND draft_id = v_row.draft_id
      AND status = ANY(v_terminal_statuses)
      AND completed_at IS NOT NULL;
  ELSIF v_row.workflow_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE user_id = v_row.user_id
      AND workflow_id = v_row.workflow_id
      AND status = ANY(v_terminal_statuses)
      AND completed_at IS NOT NULL;
  ELSE
    v_count := 0;
  END IF;

  new_count := COALESCE(v_count, 0);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.complete_workflow_run_and_get_count(UUID, TEXT, INTEGER, JSONB, JSONB) IS 'Atomically complete a workflow run and return the new run count. Eliminates race conditions.';

GRANT EXECUTE ON FUNCTION public.complete_workflow_run_and_get_count(UUID, TEXT, INTEGER, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_workflow_run_and_get_count(UUID, TEXT, INTEGER, JSONB, JSONB) TO authenticated;

-- 4. Update workflow_run_counts view to include all terminal states (dashboards)
DROP VIEW IF EXISTS public.workflow_run_counts;
CREATE VIEW public.workflow_run_counts
WITH (security_invoker = true)
AS
SELECT
  user_id,
  workflow_id,
  draft_id,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE status IN ('timeout', 'cancelled')) AS other_terminal_count,
  COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'timeout', 'cancelled')) AS total_count,
  MAX(completed_at) AS last_run_at
FROM public.workflow_runs
WHERE status IN ('completed', 'failed', 'timeout', 'cancelled')
  AND completed_at IS NOT NULL
  AND (auth.uid() IS NOT NULL AND user_id = auth.uid())
GROUP BY user_id, workflow_id, draft_id;

COMMENT ON VIEW public.workflow_run_counts IS 'Per-user run counts by workflow or draft. All terminal states. Only returns rows for current user.';
GRANT SELECT ON public.workflow_run_counts TO authenticated;

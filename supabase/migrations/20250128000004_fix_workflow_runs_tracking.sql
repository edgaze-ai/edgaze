-- Fix workflow_runs tracking - ensure runs are always counted correctly
-- This migration fixes stuck runs and ensures accurate counting

-- Step 1: Fix any stuck runs (runs that are still "running" or "pending" but are old)
-- Mark runs older than 5 minutes as "failed" if they're still running/pending
UPDATE public.workflow_runs
SET 
  status = 'failed',
  completed_at = COALESCE(completed_at, NOW()),
  error_details = COALESCE(error_details, '{"message": "Run timed out or was stuck"}')::jsonb,
  updated_at = NOW()
WHERE 
  status IN ('running', 'pending')
  AND started_at < NOW() - INTERVAL '5 minutes'
  AND completed_at IS NULL;

-- Step 2: Create a robust function to get run count
-- This function ensures accurate counting and handles edge cases
CREATE OR REPLACE FUNCTION public.get_user_workflow_run_count(
  p_user_id UUID,
  p_workflow_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count completed and failed runs
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.workflow_runs
  WHERE 
    user_id = p_user_id
    AND workflow_id = p_workflow_id
    AND status IN ('completed', 'failed')
    AND completed_at IS NOT NULL;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Step 3: Create a function to ensure run is completed
-- This function updates a run to completed/failed status atomically
CREATE OR REPLACE FUNCTION public.complete_workflow_run(
  p_run_id UUID,
  p_status TEXT, -- 'completed' or 'failed'
  p_duration_ms INTEGER DEFAULT NULL,
  p_state_snapshot JSONB DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  -- Validate status
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  
  -- Update the run atomically
  UPDATE public.workflow_runs
  SET 
    status = p_status,
    completed_at = COALESCE(completed_at, NOW()),
    duration_ms = COALESCE(p_duration_ms, duration_ms),
    state_snapshot = COALESCE(p_state_snapshot, state_snapshot),
    error_details = COALESCE(p_error_details, error_details),
    updated_at = NOW()
  WHERE 
    id = p_run_id
    AND status IN ('pending', 'running'); -- Only update if not already completed/failed
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$;

-- Step 4: Add index for faster counting queries
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_workflow_status 
  ON public.workflow_runs(user_id, workflow_id, status) 
  WHERE status IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_workflow_runs_completed_at 
  ON public.workflow_runs(completed_at) 
  WHERE completed_at IS NOT NULL;

-- Step 5: Create a view for easy run counting (optional but helpful)
CREATE OR REPLACE VIEW public.workflow_run_counts AS
SELECT 
  user_id,
  workflow_id,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) AS total_count,
  MAX(completed_at) AS last_run_at
FROM public.workflow_runs
WHERE status IN ('completed', 'failed')
GROUP BY user_id, workflow_id;

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_workflow_run_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_workflow_run(UUID, TEXT, INTEGER, JSONB, JSONB) TO authenticated;
GRANT SELECT ON public.workflow_run_counts TO authenticated;

-- Step 7: Add comment for documentation (full signatures required when overloads exist)
COMMENT ON FUNCTION public.get_user_workflow_run_count(UUID, UUID) IS 'Returns the count of completed/failed runs for a user and workflow';
COMMENT ON FUNCTION public.complete_workflow_run(UUID, TEXT, INTEGER, JSONB, JSONB) IS 'Atomically updates a workflow run to completed or failed status';

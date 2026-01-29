-- Fix get_user_workflow_run_count: check draft_id FIRST so draft runs (workflow_id NULL) are counted correctly.
-- When client passes workflowId=draftId and draftId=draftId, we must count by draft_id, not workflow_id.

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
BEGIN
  -- Check draft_id FIRST (draft runs have workflow_id = NULL)
  IF p_draft_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE 
      user_id = p_user_id
      AND draft_id = p_draft_id
      AND status IN ('completed', 'failed')
      AND completed_at IS NOT NULL;
  ELSIF p_workflow_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE 
      user_id = p_user_id
      AND workflow_id = p_workflow_id
      AND status IN ('completed', 'failed')
      AND completed_at IS NOT NULL;
  ELSE
    RETURN 0;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.get_user_workflow_run_count IS 'Returns the count of completed/failed runs for a user and workflow (or draft). Checks draft_id first.';

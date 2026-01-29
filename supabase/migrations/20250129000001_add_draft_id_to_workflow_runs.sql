-- Add draft_id column to workflow_runs to track runs for workflow_drafts (builder test runs)
-- This allows tracking usage even when workflows haven't been published yet

-- Make workflow_id nullable (drafts won't have a workflow_id until published)
ALTER TABLE public.workflow_runs
  ALTER COLUMN workflow_id DROP NOT NULL;

-- Add draft_id column (nullable, FK to workflow_drafts)
ALTER TABLE public.workflow_runs
  ADD COLUMN draft_id uuid REFERENCES public.workflow_drafts(id) ON DELETE CASCADE;

-- Add constraint: either workflow_id or draft_id must be set (not both null)
ALTER TABLE public.workflow_runs
  ADD CONSTRAINT workflow_runs_workflow_or_draft_check
  CHECK (
    (workflow_id IS NOT NULL AND draft_id IS NULL) OR
    (workflow_id IS NULL AND draft_id IS NOT NULL)
  );

-- Add index for draft lookups
CREATE INDEX IF NOT EXISTS idx_workflow_runs_draft_id 
  ON public.workflow_runs(draft_id) 
  WHERE draft_id IS NOT NULL;

-- Drop the old 2-parameter version first (to avoid function overloading ambiguity)
DROP FUNCTION IF EXISTS public.get_user_workflow_run_count(UUID, UUID);

-- Update the count function to handle both workflows and drafts
-- This version accepts 3 parameters with defaults, so existing 2-param calls still work
-- (calling with 2 params will set p_draft_id to NULL automatically)
CREATE FUNCTION public.get_user_workflow_run_count(
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
  -- Count completed and failed runs for either workflow_id or draft_id
  IF p_workflow_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE 
      user_id = p_user_id
      AND workflow_id = p_workflow_id
      AND status IN ('completed', 'failed')
      AND completed_at IS NOT NULL;
  ELSIF p_draft_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.workflow_runs
    WHERE 
      user_id = p_user_id
      AND draft_id = p_draft_id
      AND status IN ('completed', 'failed')
      AND completed_at IS NOT NULL;
  ELSE
    RETURN 0;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grant execute to service_role and authenticated
-- Note: With default parameters, there's only one function signature (UUID, UUID, UUID)
-- but it can be called with 2 params (p_draft_id defaults to NULL)
GRANT EXECUTE ON FUNCTION public.get_user_workflow_run_count(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_workflow_run_count(UUID, UUID, UUID) TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_user_workflow_run_count IS 'Returns the count of completed/failed runs for a user and workflow (or draft)';

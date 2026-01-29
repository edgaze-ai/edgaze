-- Fix stuck runs and verify run tracking is working
-- Run this script to clean up any stuck runs and verify counts

-- Step 1: Fix stuck runs (runs older than 5 minutes still in running/pending)
UPDATE public.workflow_runs
SET 
  status = 'failed',
  completed_at = COALESCE(completed_at, NOW()),
  error_details = COALESCE(error_details, '{"message": "Run was stuck and auto-marked as failed"}'::jsonb),
  updated_at = NOW()
WHERE 
  status IN ('running', 'pending')
  AND started_at < NOW() - INTERVAL '5 minutes'
  AND completed_at IS NULL;

-- Step 2: Verify counts are working
-- This query shows run counts per user/workflow
SELECT 
  user_id,
  workflow_id,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) AS total_counted,
  COUNT(*) FILTER (WHERE status IN ('running', 'pending')) AS stuck,
  MAX(completed_at) AS last_completed
FROM public.workflow_runs
GROUP BY user_id, workflow_id
ORDER BY COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) DESC
LIMIT 20;

-- Step 3: Test the counting function
-- Replace with actual user_id and workflow_id to test
-- SELECT public.get_user_workflow_run_count('USER_ID_HERE', 'WORKFLOW_ID_HERE');

-- Step 4: Show recent runs that should be counted
SELECT 
  id,
  user_id,
  workflow_id,
  status,
  started_at,
  completed_at,
  CASE 
    WHEN status IN ('completed', 'failed') AND completed_at IS NOT NULL THEN 'COUNTED'
    WHEN status IN ('running', 'pending') AND started_at < NOW() - INTERVAL '5 minutes' THEN 'STUCK'
    ELSE 'NOT_COUNTED'
  END AS count_status
FROM public.workflow_runs
ORDER BY started_at DESC
LIMIT 50;

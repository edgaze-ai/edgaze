-- Test queries to verify run counter is working
-- Run these after executing the migration

-- 1. Verify functions exist and are callable
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_user_workflow_run_count', 'complete_workflow_run')
ORDER BY routine_name;

-- 2. Check recent workflow runs and their status
SELECT 
  id,
  user_id,
  workflow_id,
  status,
  started_at,
  completed_at,
  CASE 
    WHEN status IN ('completed', 'failed') AND completed_at IS NOT NULL THEN '✅ COUNTED'
    WHEN status IN ('running', 'pending') AND started_at < NOW() - INTERVAL '5 minutes' THEN '⚠️ STUCK'
    WHEN status IN ('running', 'pending') THEN '🔄 IN PROGRESS'
    ELSE '❌ NOT COUNTED'
  END AS count_status,
  duration_ms
FROM public.workflow_runs
ORDER BY started_at DESC NULLS LAST
LIMIT 20;

-- 3. Test the count function (replace with your actual user_id and workflow_id)
-- First, get a user_id and workflow_id from recent runs:
SELECT DISTINCT ON (user_id, workflow_id) 
  user_id, 
  workflow_id,
  started_at
FROM public.workflow_runs 
ORDER BY user_id, workflow_id, started_at DESC 
LIMIT 5;

-- Then test the function (replace USER_ID and WORKFLOW_ID):
-- SELECT public.get_user_workflow_run_count('USER_ID_HERE', 'WORKFLOW_ID_HERE');

-- 4. View run counts summary
SELECT 
  user_id,
  workflow_id,
  completed_count,
  failed_count,
  total_count,
  last_run_at
FROM public.workflow_run_counts
ORDER BY total_count DESC NULLS LAST, last_run_at DESC NULLS LAST
LIMIT 20;

-- 5. Check for any stuck runs that need fixing
SELECT 
  COUNT(*) as stuck_runs_count,
  MIN(started_at) as oldest_stuck_run
FROM public.workflow_runs
WHERE 
  status IN ('running', 'pending')
  AND started_at < NOW() - INTERVAL '5 minutes'
  AND completed_at IS NULL;

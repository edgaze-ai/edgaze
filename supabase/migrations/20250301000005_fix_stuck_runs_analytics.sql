-- Fix runs in unified analytics table: sync status from workflow_runs and fix stuck runs

-- 1. Sync successful runs: workflow_runs.completed -> runs.success
UPDATE public.runs r
SET
  status = 'success',
  ended_at = COALESCE(r.ended_at, wr.completed_at, wr.updated_at),
  error_message = NULL,
  duration_ms = COALESCE(r.duration_ms, wr.duration_ms),
  updated_at = now()
FROM public.workflow_runs wr
WHERE r.workflow_run_id = wr.id
  AND wr.status = 'completed'
  AND (r.status != 'success' OR r.ended_at IS NULL);

-- 2. Sync errored runs: workflow_runs.failed/cancelled/timeout -> runs.error
UPDATE public.runs r
SET
  status = 'error',
  ended_at = COALESCE(r.ended_at, wr.completed_at, wr.updated_at),
  error_message = COALESCE(r.error_message, wr.error_details->>'message', 'Run failed'),
  duration_ms = COALESCE(r.duration_ms, wr.duration_ms),
  updated_at = now()
FROM public.workflow_runs wr
WHERE r.workflow_run_id = wr.id
  AND wr.status IN ('failed', 'cancelled', 'timeout')
  AND (r.status != 'error' OR r.ended_at IS NULL);

-- 3. Stuck runs: still "running" after 5+ minutes (no workflow_runs link or wr still pending/running)
UPDATE public.runs r
SET
  status = 'error',
  ended_at = COALESCE(r.ended_at, r.updated_at, r.started_at),
  error_message = COALESCE(r.error_message, 'Run timed out - status update may have failed (serverless)'),
  updated_at = now()
WHERE r.status = 'running'
  AND r.started_at < NOW() - INTERVAL '5 minutes'
  AND (
    r.workflow_run_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.workflow_runs wr
      WHERE wr.id = r.workflow_run_id
        AND wr.status IN ('completed', 'failed', 'cancelled', 'timeout')
    )
  );

# Run Counter - Ultra-Reliable Solution

## Problem

Workflow runs were succeeding but the counter wasn't incrementing reliably due to:

1. Race conditions between update and count queries
2. Delayed reads (300ms hack) for replication consistency
3. Only counting completed/failed (timeout and cancelled consumed slots but weren't counted)
4. No atomic completion + count in one transaction

## Solution (2025-03-06)

### Migration: `20250306000000_ultra_reliable_run_counting.sql`

- **Atomic completion**: `complete_workflow_run_and_get_count()` RPC — update + return new count in one transaction
- **All terminal states counted**: completed, failed, timeout, cancelled (every run that consumed a slot)
- **Trigger safety net**: Auto-sets `completed_at` when status becomes terminal
- **Updated `workflow_run_counts` view**: Includes all terminal states for dashboards

### How It Works Now

1. **Run Creation**: Every workflow run creates a record with status "pending" → "running"
2. **Completion**: Uses `complete_workflow_run_and_get_count()` — single DB round-trip
   - Updates status, completed_at, duration, error_details, state_snapshot
   - Returns the new count in the same transaction (no race, no delay)
3. **Counting**: `get_user_workflow_run_count()` counts runs with status IN (completed, failed, timeout, cancelled) AND completed_at IS NOT NULL
4. **Fallback**: If RPC not available, falls back to `updateWorkflowRun` + `getUserWorkflowRunCount`

### Code Updates

- `src/lib/supabase/executions.ts`: `completeWorkflowRunAndGetCount()`, terminal statuses in fallback
- `src/app/api/flow/run/route.ts`: Uses atomic RPC for completion (streaming + non-streaming, success + error paths)
- `src/app/api/flow/run/tracking-diagnostic/route.ts`: Includes timeout/cancelled in diagnostic counts

## Verification

```sql
-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_user_workflow_run_count', 'complete_workflow_run_and_get_count');

-- Test count (replace with your ids)
SELECT public.get_user_workflow_run_count('USER_ID', 'WORKFLOW_ID', NULL);

-- Recent runs
SELECT id, user_id, workflow_id, draft_id, status, started_at, completed_at
FROM public.workflow_runs ORDER BY started_at DESC LIMIT 10;
```

### Migration

- Fixes stuck runs automatically
- Creates indexes for performance
- Creates view for easy querying

## Testing

1. Run a workflow
2. Check the run counter increases
3. Check database: `SELECT * FROM workflow_runs WHERE workflow_id = 'YOUR_ID' ORDER BY started_at DESC;`
4. Verify count: `SELECT public.get_user_workflow_run_count('USER_ID', 'WORKFLOW_ID');`

The counter should now work reliably! 🎉

# Run Counter Fix - Complete Solution

## Problem

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

Workflow runs were succeeding but the counter wasn't incrementing. This was due to:
1. Runs not being updated to "completed" status properly
2. Race conditions in database updates
3. Stuck runs in "running" or "pending" status
4. No retry logic for failed updates

## Solution

### Step 1: Run SQL Migration
Execute this SQL file in your Supabase SQL Editor:
```
supabase/migrations/20250128000002_fix_workflow_runs_tracking.sql
```

This migration:
- ✅ Fixes any stuck runs (marks old "running"/"pending" as "failed")
- ✅ Creates `get_user_workflow_run_count()` function for reliable counting
- ✅ Creates `complete_workflow_run()` function for atomic updates
- ✅ Adds indexes for faster queries
- ✅ Creates a view for easy run count queries

### Step 2: Fix Existing Stuck Runs (Optional but Recommended)
Run this script to clean up any existing stuck runs:
```
supabase/migrations/20250211000002_fix_stuck_runs.sql
```

### Step 3: Code Changes (Already Done)
The code has been updated to:
- ✅ Use database functions for atomic updates
- ✅ Retry up to 3 times if updates fail
- ✅ Always recalculate count after completion
- ✅ Better error handling and logging
- ✅ Fallback to direct queries if functions don't exist

## How It Works Now

1. **Run Creation**: Every workflow run creates a record with status "pending"
2. **Status Update**: Immediately updated to "running"
3. **Completion**: When workflow finishes, uses `complete_workflow_run()` function for atomic update
4. **Counting**: Uses `get_user_workflow_run_count()` function which:
   - Only counts runs with status "completed" or "failed"
   - Ensures `completed_at` is set
   - Handles edge cases properly

## Verification

After running the migration, verify it works:

```sql
-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_user_workflow_run_count', 'complete_workflow_run');

-- Test count function (replace with your user_id and workflow_id)
SELECT public.get_user_workflow_run_count('YOUR_USER_ID', 'YOUR_WORKFLOW_ID');

-- Check recent runs
SELECT id, user_id, workflow_id, status, started_at, completed_at
FROM public.workflow_runs
ORDER BY started_at DESC
LIMIT 10;
```

## What Changed

### Database Functions
- `get_user_workflow_run_count()`: Reliable counting function
- `complete_workflow_run()`: Atomic status update function

### Code Updates
- `src/lib/supabase/executions.ts`: Uses database functions with fallback
- `src/app/api/flow/run/route.ts`: Retry logic (3 attempts) for updates and counts

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

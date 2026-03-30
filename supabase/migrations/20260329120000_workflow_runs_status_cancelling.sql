-- Allow workflow_runs.status = 'cancelling' (used by v2 cancellation path).
-- The original CHECK only listed pending, running, completed, failed, cancelled, timeout.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'workflow_runs'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workflow_runs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.workflow_runs
  ADD CONSTRAINT workflow_runs_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'running'::text,
        'cancelling'::text,
        'completed'::text,
        'failed'::text,
        'cancelled'::text,
        'timeout'::text
      ]
    )
  );

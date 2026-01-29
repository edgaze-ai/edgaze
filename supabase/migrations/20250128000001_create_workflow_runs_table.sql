-- Create workflow_runs table for tracking builder test runs and workflow executions
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'timeout'::text])),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  duration_ms integer,
  error_details jsonb,
  state_snapshot jsonb,
  checkpoint jsonb,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_runs_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for fast lookups by user and workflow
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_workflow ON public.workflow_runs(user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON public.workflow_runs(started_at DESC);

-- Enable RLS
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own runs
CREATE POLICY "Users can read their own workflow runs"
  ON public.workflow_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own runs
CREATE POLICY "Users can insert their own workflow runs"
  ON public.workflow_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own runs
CREATE POLICY "Users can update their own workflow runs"
  ON public.workflow_runs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Admins can read all runs
CREATE POLICY "Admins can read all workflow runs"
  ON public.workflow_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- Policy: Admins can update all runs
CREATE POLICY "Admins can update all workflow runs"
  ON public.workflow_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

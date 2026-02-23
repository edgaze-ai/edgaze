-- Unified runs table for workflow and prompt execution analytics
-- Single table with kind and optional FKs. Simpler analytics.

CREATE TABLE IF NOT EXISTS public.runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('workflow', 'prompt')),

  -- Optional foreign keys (one set per kind)
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  version_id uuid REFERENCES public.workflow_versions(id) ON DELETE SET NULL,

  -- Who ran it (nullable for anonymous)
  runner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Who owns the workflow/prompt (creator)
  creator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,

  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'canceled')),

  error_code text,
  error_message text,

  duration_ms integer,
  input_bytes integer,
  output_bytes integer,
  tokens_in integer,
  tokens_out integer,
  model text,

  -- Link to legacy workflow_runs for backward compat (workflow runs)
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,

  metadata jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT runs_pkey PRIMARY KEY (id),
  CONSTRAINT runs_kind_workflow_or_prompt CHECK (
    (kind = 'workflow' AND prompt_id IS NULL) OR
    (kind = 'prompt' AND prompt_id IS NOT NULL AND workflow_id IS NULL)
  )
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_runs_kind ON public.runs(kind);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON public.runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_ended_at ON public.runs(ended_at DESC) WHERE ended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_status ON public.runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_creator_user_id ON public.runs(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_runs_runner_user_id ON public.runs(runner_user_id);
CREATE INDEX IF NOT EXISTS idx_runs_workflow_id ON public.runs(workflow_id) WHERE workflow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_prompt_id ON public.runs(prompt_id) WHERE prompt_id IS NOT NULL;

-- RLS
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Admins can read all runs
CREATE POLICY "Admins can read all runs"
  ON public.runs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admin_roles WHERE admin_roles.user_id = auth.uid())
  );

-- Service role (API) can insert/update
-- No user insert policy - only server writes

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER runs_updated_at
  BEFORE UPDATE ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.runs_updated_at();

COMMENT ON TABLE public.runs IS 'Unified run analytics: workflow and prompt executions. Count runs only when status in (success, error, canceled) and ended_at IS NOT NULL.';

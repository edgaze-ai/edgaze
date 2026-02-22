-- Immutable workflow versions: buyers always run the exact version they purchased.
-- workflows = editable draft; workflow_versions = immutable published snapshots.
-- Listings and runs reference workflow_version_id.

-- workflow_versions: immutable snapshot of a workflow graph
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  graph_json jsonb NOT NULL,
  version_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_versions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON public.workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_hash ON public.workflow_versions(version_hash);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

-- Workflows: add active_version_id (points to latest published version)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'active_version_id'
  ) THEN
    ALTER TABLE public.workflows ADD COLUMN active_version_id uuid REFERENCES public.workflow_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- workflow_runs: add workflow_version_id (which exact version was run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_runs' AND column_name = 'workflow_version_id'
  ) THEN
    ALTER TABLE public.workflow_runs ADD COLUMN workflow_version_id uuid REFERENCES public.workflow_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_version ON public.workflow_runs(workflow_version_id) WHERE workflow_version_id IS NOT NULL;

-- workflow_run_nodes: queryable per-node execution records (observability)
CREATE TABLE IF NOT EXISTS public.workflow_run_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  spec_id text NOT NULL,
  status text NOT NULL,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  duration_ms integer,
  error_message text,
  tokens_used integer,
  model text,
  retries integer NOT NULL DEFAULT 0,
  CONSTRAINT workflow_run_nodes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_run ON public.workflow_run_nodes(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_spec ON public.workflow_run_nodes(spec_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_status ON public.workflow_run_nodes(status);

ALTER TABLE public.workflow_run_nodes ENABLE ROW LEVEL SECURITY;

-- RLS: workflow_versions readable by anyone (public listings)
CREATE POLICY "Anyone can read workflow versions"
  ON public.workflow_versions FOR SELECT USING (true);

-- workflow_run_nodes: users read via run
CREATE POLICY "Users can read own run nodes"
  ON public.workflow_run_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_runs r
      WHERE r.id = workflow_run_id AND r.user_id = auth.uid()
    )
  );

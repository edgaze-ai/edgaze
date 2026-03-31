-- Workflow execution v2 foundation.
-- Purpose:
-- 1. Freeze compiled workflow snapshots per run.
-- 2. Track one durable row per compiled node.
-- 3. Track one durable row per node attempt.
-- 4. Append authoritative run events for streaming and projections.
-- 5. Support payload indirection for large materialized inputs/outputs/errors.

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS compiled_workflow_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS compiled_workflow_hash text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS terminal_reason text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS finalized_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_event_sequence bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS run_input jsonb,
  ADD COLUMN IF NOT EXISTS final_output jsonb;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_compiled_hash
  ON public.workflow_runs(compiled_workflow_hash)
  WHERE compiled_workflow_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_user_idempotency
  ON public.workflow_runs(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_outcome
  ON public.workflow_runs(outcome)
  WHERE outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status_sequence
  ON public.workflow_runs(status, last_event_sequence DESC);

ALTER TABLE public.workflow_run_nodes
  ADD COLUMN IF NOT EXISTS topo_index integer,
  ADD COLUMN IF NOT EXISTS failure_policy text,
  ADD COLUMN IF NOT EXISTS compiled_input_bindings jsonb,
  ADD COLUMN IF NOT EXISTS latest_attempt_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_payload_ref jsonb,
  ADD COLUMN IF NOT EXISTS output_payload_ref jsonb,
  ADD COLUMN IF NOT EXISTS error_payload_ref jsonb,
  ADD COLUMN IF NOT EXISTS queued_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS terminal_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS is_terminal_node boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_run_topo
  ON public.workflow_run_nodes(workflow_run_id, topo_index);

CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_run_status
  ON public.workflow_run_nodes(workflow_run_id, status);

CREATE TABLE IF NOT EXISTS public.workflow_run_node_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  workflow_run_node_id uuid NOT NULL REFERENCES public.workflow_run_nodes(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  attempt_number integer NOT NULL,
  status text NOT NULL,
  worker_id text,
  lease_owner text,
  lease_expires_at timestamp with time zone,
  last_heartbeat_at timestamp with time zone,
  materialized_input_ref jsonb,
  output_payload_ref jsonb,
  error_payload_ref jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_run_node_attempts_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_run_node_attempts_unique_attempt
  ON public.workflow_run_node_attempts(workflow_run_id, node_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_workflow_run_node_attempts_run
  ON public.workflow_run_node_attempts(workflow_run_id, workflow_run_node_id);

CREATE INDEX IF NOT EXISTS idx_workflow_run_node_attempts_status
  ON public.workflow_run_node_attempts(status);

ALTER TABLE public.workflow_run_node_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workflow_run_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  event_type text NOT NULL,
  node_id text,
  attempt_number integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_run_events_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_run_events_run_sequence
  ON public.workflow_run_events(workflow_run_id, sequence);

CREATE INDEX IF NOT EXISTS idx_workflow_run_events_run_created
  ON public.workflow_run_events(workflow_run_id, created_at, sequence);

ALTER TABLE public.workflow_run_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workflow_run_payload_blobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  workflow_run_node_id uuid REFERENCES public.workflow_run_nodes(id) ON DELETE CASCADE,
  workflow_run_node_attempt_id uuid REFERENCES public.workflow_run_node_attempts(id) ON DELETE CASCADE,
  payload_kind text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/json',
  payload_json jsonb,
  storage_bucket text,
  storage_object_path text,
  byte_size bigint,
  sha256 text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_run_payload_blobs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_payload_blobs_run
  ON public.workflow_run_payload_blobs(workflow_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_run_payload_blobs_attempt
  ON public.workflow_run_payload_blobs(workflow_run_node_attempt_id);

ALTER TABLE public.workflow_run_payload_blobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_run_node_attempts'
      AND policyname = 'Users can read own node attempts'
  ) THEN
    CREATE POLICY "Users can read own node attempts"
      ON public.workflow_run_node_attempts FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workflow_runs r
          WHERE r.id = workflow_run_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_run_events'
      AND policyname = 'Users can read own run events'
  ) THEN
    CREATE POLICY "Users can read own run events"
      ON public.workflow_run_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workflow_runs r
          WHERE r.id = workflow_run_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_run_payload_blobs'
      AND policyname = 'Users can read own payload blobs'
  ) THEN
    CREATE POLICY "Users can read own payload blobs"
      ON public.workflow_run_payload_blobs FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workflow_runs r
          WHERE r.id = workflow_run_id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

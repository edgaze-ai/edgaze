-- Product-wide structured tracing for requests, workflow execution, streams, clients, and jobs.

CREATE TABLE IF NOT EXISTS public.trace_sessions (
  id text NOT NULL,
  kind text NOT NULL,
  source text NOT NULL,
  phase text NOT NULL,
  route_id text,
  method text,
  request_path text,
  request_query text,
  correlation_id text,
  root_correlation_id text,
  client_session_id text,
  actor_id text,
  workflow_id text,
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  analytics_run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  status text,
  response_status integer,
  error_message text,
  started_at_epoch_ms bigint NOT NULL,
  last_event_at_epoch_ms bigint NOT NULL,
  ended_at_epoch_ms bigint,
  duration_ms integer,
  event_count integer NOT NULL DEFAULT 0,
  client_clock_offset_ms integer,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trace_sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_trace_sessions_started
  ON public.trace_sessions(started_at_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_trace_sessions_retention
  ON public.trace_sessions(retention_expires_at);

CREATE INDEX IF NOT EXISTS idx_trace_sessions_route
  ON public.trace_sessions(route_id, started_at_epoch_ms DESC)
  WHERE route_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_sessions_workflow_run
  ON public.trace_sessions(workflow_run_id, started_at_epoch_ms DESC)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_sessions_analytics_run
  ON public.trace_sessions(analytics_run_id, started_at_epoch_ms DESC)
  WHERE analytics_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_sessions_correlation
  ON public.trace_sessions(correlation_id, started_at_epoch_ms DESC)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE public.trace_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.trace_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trace_session_id text NOT NULL REFERENCES public.trace_sessions(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  phase text NOT NULL,
  source text NOT NULL,
  event_name text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  timestamp_epoch_ms bigint NOT NULL,
  since_session_start_ms integer,
  duration_ms integer,
  route_id text,
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  analytics_run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  node_id text,
  attempt_number integer,
  stream_id text,
  chunk_sequence bigint,
  http_status integer,
  payload_size_bytes integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trace_entries_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trace_entries_session_sequence
  ON public.trace_entries(trace_session_id, sequence);

CREATE INDEX IF NOT EXISTS idx_trace_entries_session_time
  ON public.trace_entries(trace_session_id, timestamp_epoch_ms, sequence);

CREATE INDEX IF NOT EXISTS idx_trace_entries_workflow_run
  ON public.trace_entries(workflow_run_id, timestamp_epoch_ms)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_entries_analytics_run
  ON public.trace_entries(analytics_run_id, timestamp_epoch_ms)
  WHERE analytics_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_entries_phase
  ON public.trace_entries(phase, source, timestamp_epoch_ms DESC);

ALTER TABLE public.trace_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.trace_artifacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trace_session_id text NOT NULL REFERENCES public.trace_sessions(id) ON DELETE CASCADE,
  artifact_kind text NOT NULL,
  label text,
  content_type text NOT NULL DEFAULT 'application/json',
  payload jsonb,
  byte_size bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  retention_expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  CONSTRAINT trace_artifacts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_trace_artifacts_session
  ON public.trace_artifacts(trace_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trace_artifacts_retention
  ON public.trace_artifacts(retention_expires_at);

ALTER TABLE public.trace_artifacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_trace_session_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trace_sessions_touch_updated_at ON public.trace_sessions;
CREATE TRIGGER trace_sessions_touch_updated_at
BEFORE UPDATE ON public.trace_sessions
FOR EACH ROW
EXECUTE FUNCTION public.touch_trace_session_updated_at();

CREATE OR REPLACE FUNCTION public.prune_expired_trace_data()
RETURNS TABLE (
  deleted_entries bigint,
  deleted_artifacts bigint,
  deleted_sessions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_entries bigint := 0;
  v_deleted_artifacts bigint := 0;
  v_deleted_sessions bigint := 0;
BEGIN
  DELETE FROM public.trace_entries
  WHERE trace_session_id IN (
    SELECT id
    FROM public.trace_sessions
    WHERE retention_expires_at < now()
  );
  GET DIAGNOSTICS v_deleted_entries = ROW_COUNT;

  DELETE FROM public.trace_artifacts
  WHERE retention_expires_at < now()
     OR trace_session_id IN (
       SELECT id
       FROM public.trace_sessions
       WHERE retention_expires_at < now()
     );
  GET DIAGNOSTICS v_deleted_artifacts = ROW_COUNT;

  DELETE FROM public.trace_sessions
  WHERE retention_expires_at < now();
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  RETURN QUERY
  SELECT v_deleted_entries, v_deleted_artifacts, v_deleted_sessions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_expired_trace_data() TO service_role;

-- Private Storage for workflow trace parts + optional cached bundle; lightweight refs in DB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workflow_traces',
  'workflow_traces',
  false,
  104857600, -- 100 MiB ceiling; app caps per-part smaller
  ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['application/json']::text[];

-- Stable Storage prefix per trace session (no object moves when workflow_run_id arrives).
CREATE TABLE IF NOT EXISTS public.trace_session_storage_root (
  trace_session_id text NOT NULL REFERENCES public.trace_sessions (id) ON DELETE CASCADE,
  storage_root_id uuid NOT NULL DEFAULT gen_random_uuid (),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trace_session_storage_root_pkey PRIMARY KEY (trace_session_id),
  CONSTRAINT trace_session_storage_root_root_unique UNIQUE (storage_root_id)
);

CREATE INDEX IF NOT EXISTS idx_trace_session_storage_root_root
  ON public.trace_session_storage_root (storage_root_id);

ALTER TABLE public.trace_session_storage_root ENABLE ROW LEVEL SECURITY;

-- Optional lazy cache: one row per workflow run (full export JSON in Storage).
CREATE TABLE IF NOT EXISTS public.workflow_run_trace_bundle_refs (
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs (id) ON DELETE CASCADE,
  bundle_storage_path text,
  bundle_bytes bigint,
  bundle_updated_at timestamp with time zone,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_run_trace_bundle_refs_pkey PRIMARY KEY (workflow_run_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_trace_bundle_refs_updated
  ON public.workflow_run_trace_bundle_refs (bundle_updated_at DESC NULLS LAST);

ALTER TABLE public.workflow_run_trace_bundle_refs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_workflow_run_trace_bundle_refs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_run_trace_bundle_refs_touch_updated_at
  ON public.workflow_run_trace_bundle_refs;

CREATE TRIGGER workflow_run_trace_bundle_refs_touch_updated_at
BEFORE UPDATE ON public.workflow_run_trace_bundle_refs
FOR EACH ROW
EXECUTE FUNCTION public.touch_workflow_run_trace_bundle_refs_updated_at();

COMMENT ON TABLE public.trace_session_storage_root IS
  'Maps trace_sessions.id to a stable UUID prefix under the workflow_traces Storage bucket.';
COMMENT ON TABLE public.workflow_run_trace_bundle_refs IS
  'Optional cached full bundle JSON path in Storage (lazy); trace parts remain canonical.';

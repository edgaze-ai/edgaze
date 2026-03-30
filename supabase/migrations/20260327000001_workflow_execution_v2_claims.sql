-- Workflow execution v2 atomic claim helpers.

ALTER TABLE public.workflow_run_nodes
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.workflow_run_node_attempts
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.workflow_run_nodes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_run_nodes_set_updated_at_trigger ON public.workflow_run_nodes;
CREATE TRIGGER workflow_run_nodes_set_updated_at_trigger
  BEFORE UPDATE ON public.workflow_run_nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_run_nodes_set_updated_at();

CREATE OR REPLACE FUNCTION public.workflow_run_node_attempts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_run_node_attempts_set_updated_at_trigger ON public.workflow_run_node_attempts;
CREATE TRIGGER workflow_run_node_attempts_set_updated_at_trigger
  BEFORE UPDATE ON public.workflow_run_node_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_run_node_attempts_set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_workflow_run_node_attempt(
  p_run_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30
)
RETURNS TABLE (
  workflow_run_id uuid,
  workflow_run_node_id uuid,
  node_id text,
  attempt_id uuid,
  attempt_number integer,
  lease_owner text,
  lease_expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_node public.workflow_run_nodes%ROWTYPE;
  v_previous_attempt public.workflow_run_node_attempts%ROWTYPE;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_lease_expires_at timestamp with time zone;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  SELECT wrn.*
  INTO v_node
  FROM public.workflow_run_nodes wrn
  JOIN public.workflow_runs wr
    ON wr.id = wrn.workflow_run_id
  LEFT JOIN public.workflow_run_node_attempts wrna
    ON wrna.workflow_run_node_id = wrn.id
   AND wrna.attempt_number = wrn.latest_attempt_number
  WHERE wrn.workflow_run_id = p_run_id
    AND wr.status IN ('pending', 'running', 'cancelling')
    AND wr.cancel_requested_at IS NULL
    AND (
      wrn.status IN ('ready', 'queued', 'retry_scheduled')
      OR (
        wrn.status = 'running'
        AND wrna.status = 'running'
        AND wrna.lease_expires_at IS NOT NULL
        AND wrna.lease_expires_at <= now()
      )
    )
  ORDER BY wrn.topo_index ASC, wrn.node_id ASC
  LIMIT 1
  FOR UPDATE OF wrn SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_previous_attempt
  FROM public.workflow_run_node_attempts
  WHERE workflow_run_node_id = v_node.id
    AND attempt_number = v_node.latest_attempt_number;

  IF v_node.status = 'running' AND v_previous_attempt.id IS NOT NULL THEN
    UPDATE public.workflow_run_node_attempts
    SET
      status = 'failed',
      ended_at = now(),
      duration_ms = GREATEST(FLOOR(EXTRACT(epoch FROM (now() - started_at)) * 1000)::integer, 0)
    WHERE id = v_previous_attempt.id
      AND status = 'running';
  END IF;

  v_attempt_number := COALESCE(v_node.latest_attempt_number, 0) + 1;
  v_lease_expires_at := now() + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 30), 5));

  INSERT INTO public.workflow_run_node_attempts (
    workflow_run_id,
    workflow_run_node_id,
    node_id,
    attempt_number,
    status,
    worker_id,
    lease_owner,
    lease_expires_at,
    last_heartbeat_at
  ) VALUES (
    v_node.workflow_run_id,
    v_node.id,
    v_node.node_id,
    v_attempt_number,
    'running',
    p_worker_id,
    p_worker_id,
    v_lease_expires_at,
    now()
  )
  RETURNING id INTO v_attempt_id;

  UPDATE public.workflow_run_nodes
  SET
    status = 'running',
    latest_attempt_number = v_attempt_number,
    queued_at = COALESCE(queued_at, now()),
    started_at = now(),
    ended_at = NULL,
    terminal_attempt_id = NULL
  WHERE id = v_node.id;

  RETURN QUERY
  SELECT
    v_node.workflow_run_id,
    v_node.id,
    v_node.node_id,
    v_attempt_id,
    v_attempt_number,
    p_worker_id,
    v_lease_expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_workflow_run_node_attempt(uuid, text, integer) TO service_role;

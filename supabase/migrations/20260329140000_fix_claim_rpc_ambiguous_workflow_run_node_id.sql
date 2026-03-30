-- Fix 42702: "workflow_run_node_id" is ambiguous — RETURNS TABLE() creates PL/pgSQL
-- variables with the same names as columns, so bare identifiers in SQL must prefer columns.

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
SET search_path = public
AS $$
#variable_conflict use_column
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
  FROM public.workflow_run_node_attempts AS prev
  WHERE prev.workflow_run_node_id = v_node.id
    AND prev.attempt_number = v_node.latest_attempt_number;

  IF v_node.status = 'running' AND v_previous_attempt.id IS NOT NULL THEN
    UPDATE public.workflow_run_node_attempts AS u
    SET
      status = 'failed',
      ended_at = now(),
      duration_ms = GREATEST(FLOOR(EXTRACT(epoch FROM (now() - u.started_at)) * 1000)::integer, 0)
    WHERE u.id = v_previous_attempt.id
      AND u.status = 'running';
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

  UPDATE public.workflow_run_nodes AS w
  SET
    status = 'running',
    latest_attempt_number = v_attempt_number,
    queued_at = COALESCE(w.queued_at, now()),
    started_at = now(),
    ended_at = NULL,
    terminal_attempt_id = NULL
  WHERE w.id = v_node.id;

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

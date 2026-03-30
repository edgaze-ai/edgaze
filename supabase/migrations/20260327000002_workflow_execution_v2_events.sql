-- Workflow execution v2 authoritative event append helper.

CREATE OR REPLACE FUNCTION public.append_workflow_run_event(
  p_run_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_node_id text DEFAULT NULL,
  p_attempt_number integer DEFAULT NULL,
  p_created_at timestamp with time zone DEFAULT now()
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sequence bigint;
BEGIN
  UPDATE public.workflow_runs
  SET
    last_event_sequence = last_event_sequence + 1,
    updated_at = now()
  WHERE id = p_run_id
  RETURNING last_event_sequence INTO v_sequence;

  IF v_sequence IS NULL THEN
    RAISE EXCEPTION 'workflow_run % not found', p_run_id;
  END IF;

  INSERT INTO public.workflow_run_events (
    workflow_run_id,
    sequence,
    event_type,
    node_id,
    attempt_number,
    payload,
    created_at
  ) VALUES (
    p_run_id,
    v_sequence,
    p_event_type,
    p_node_id,
    p_attempt_number,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_created_at, now())
  );

  RETURN v_sequence;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_workflow_run_event(
  uuid,
  text,
  jsonb,
  text,
  integer,
  timestamp with time zone
) TO service_role;

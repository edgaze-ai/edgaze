-- Workflow execution v2 batched event append helper.

CREATE OR REPLACE FUNCTION public.append_workflow_run_events(
  p_run_id uuid,
  p_events jsonb
)
RETURNS TABLE (sequence bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_count integer := COALESCE(jsonb_array_length(COALESCE(p_events, '[]'::jsonb)), 0);
  v_last_sequence bigint;
BEGIN
  IF v_event_count = 0 THEN
    RETURN;
  END IF;

  UPDATE public.workflow_runs
  SET
    last_event_sequence = last_event_sequence + v_event_count,
    updated_at = now()
  WHERE id = p_run_id
  RETURNING last_event_sequence INTO v_last_sequence;

  IF v_last_sequence IS NULL THEN
    RAISE EXCEPTION 'workflow_run % not found', p_run_id;
  END IF;

  RETURN QUERY
  WITH input_events AS (
    SELECT
      event_rows.ordinality,
      event_rows.value ->> 'event_type' AS event_type,
      COALESCE(event_rows.value -> 'payload', '{}'::jsonb) AS payload,
      NULLIF(event_rows.value ->> 'node_id', '') AS node_id,
      NULLIF(event_rows.value ->> 'attempt_number', '')::integer AS attempt_number,
      COALESCE((event_rows.value ->> 'created_at')::timestamp with time zone, now()) AS created_at
    FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb))
      WITH ORDINALITY AS event_rows(value, ordinality)
  ),
  inserted AS (
    INSERT INTO public.workflow_run_events (
      workflow_run_id,
      sequence,
      event_type,
      node_id,
      attempt_number,
      payload,
      created_at
    )
    SELECT
      p_run_id,
      (v_last_sequence - v_event_count) + input_events.ordinality,
      input_events.event_type,
      input_events.node_id,
      input_events.attempt_number,
      input_events.payload,
      input_events.created_at
    FROM input_events
    ORDER BY input_events.ordinality
    RETURNING workflow_run_events.sequence
  )
  SELECT inserted.sequence
  FROM inserted
  ORDER BY inserted.sequence;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_workflow_run_events(uuid, jsonb) TO service_role;

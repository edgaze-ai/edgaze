-- Harden anonymous workflow demo consumption against concurrent requests.
-- Keep the same product behavior, but serialize consume attempts for the
-- same workflow/device and workflow/IP so bursts cannot race around the cap.

CREATE OR REPLACE FUNCTION public.consume_anonymous_workflow_demo(
  p_workflow_id UUID,
  p_device_fingerprint TEXT,
  p_ip_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_id UUID;
  v_ip_lock_key TEXT;
BEGIN
  v_ip_lock_key := COALESCE(NULLIF(TRIM(p_ip_address), ''), 'unknown');

  PERFORM pg_advisory_xact_lock(
    hashtext('anonymous_demo_workflow:' || p_workflow_id::text),
    hashtext('anonymous_demo_device:' || p_device_fingerprint)
  );

  PERFORM pg_advisory_xact_lock(
    hashtext('anonymous_demo_workflow_ip:' || p_workflow_id::text),
    hashtext('anonymous_demo_ip:' || v_ip_lock_key)
  );

  IF NOT public.can_run_anonymous_demo(p_workflow_id, p_device_fingerprint, p_ip_address) THEN
    RETURN jsonb_build_object(
      'success', false,
      'allowed', false,
      'error', 'Demo run unavailable'
    );
  END IF;

  INSERT INTO public.anonymous_demo_runs (workflow_id, device_fingerprint, ip_address)
  VALUES (p_workflow_id, p_device_fingerprint, p_ip_address)
  ON CONFLICT (workflow_id, device_fingerprint) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'allowed', false,
      'error', 'Demo run unavailable'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'allowed', true,
    'message', 'Demo run recorded successfully'
  );
END;
$$;

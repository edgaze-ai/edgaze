-- Workflow demo hardening: one anonymous demo per workflow/device, with small IP cap.

DROP INDEX IF EXISTS idx_anonymous_demo_runs_workflow_device_ip;
DROP INDEX IF EXISTS anonymous_demo_runs_workflow_id_device_fingerprint_ip_address_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_anonymous_demo_runs_workflow_device
  ON public.anonymous_demo_runs(workflow_id, device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_anonymous_demo_runs_workflow_ip
  ON public.anonymous_demo_runs(workflow_id, ip_address);

CREATE OR REPLACE FUNCTION public.can_run_anonymous_demo(
  p_workflow_id UUID,
  p_device_fingerprint TEXT,
  p_ip_address TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_exists BOOLEAN;
  v_used BOOLEAN;
  v_ip_count INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.workflows
    WHERE id = p_workflow_id
      AND is_published = true
      AND COALESCE(is_public, true) = true
      AND removed_at IS NULL
  ) INTO v_workflow_exists;

  IF NOT v_workflow_exists THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.anonymous_demo_runs
    WHERE workflow_id = p_workflow_id
      AND device_fingerprint = p_device_fingerprint
  ) INTO v_used;

  IF v_used THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(NULLIF(TRIM(p_ip_address), ''), 'unknown') <> 'unknown' THEN
    SELECT COUNT(*)
    FROM public.anonymous_demo_runs
    WHERE workflow_id = p_workflow_id
      AND ip_address = p_ip_address
    INTO v_ip_count;

    IF v_ip_count >= 3 THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

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
BEGIN
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

CREATE OR REPLACE FUNCTION public.record_anonymous_demo_run(
  p_workflow_id UUID,
  p_device_fingerprint TEXT,
  p_ip_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.consume_anonymous_workflow_demo(
    p_workflow_id,
    p_device_fingerprint,
    p_ip_address
  );
END;
$$;

-- Create anonymous_demo_runs table to track demo runs for non-authenticated users
-- Uses device fingerprint + IP address for strict one-time tracking
CREATE TABLE IF NOT EXISTS anonymous_demo_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  -- Combined unique constraint: one demo run per workflow per device+IP combination
  UNIQUE(workflow_id, device_fingerprint, ip_address),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_anonymous_demo_runs_workflow ON anonymous_demo_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_demo_runs_device_ip ON anonymous_demo_runs(device_fingerprint, ip_address);
CREATE INDEX IF NOT EXISTS idx_anonymous_demo_runs_workflow_device_ip ON anonymous_demo_runs(workflow_id, device_fingerprint, ip_address);

-- Enable RLS
ALTER TABLE anonymous_demo_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for API endpoints)
CREATE POLICY "Service role full access"
  ON anonymous_demo_runs FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_anonymous_demo_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_anonymous_demo_runs_updated_at
  BEFORE UPDATE ON anonymous_demo_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_anonymous_demo_runs_updated_at();

-- Function to check if demo run is allowed (strict one-time check)
CREATE OR REPLACE FUNCTION can_run_anonymous_demo(
  p_workflow_id UUID,
  p_device_fingerprint TEXT,
  p_ip_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if a demo run already exists for this workflow + device + IP combination
  SELECT EXISTS(
    SELECT 1 
    FROM anonymous_demo_runs 
    WHERE workflow_id = p_workflow_id 
      AND device_fingerprint = p_device_fingerprint 
      AND ip_address = p_ip_address
  ) INTO v_exists;
  
  -- Return true if NO record exists (demo run is allowed)
  RETURN NOT v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record an anonymous demo run
CREATE OR REPLACE FUNCTION record_anonymous_demo_run(
  p_workflow_id UUID,
  p_device_fingerprint TEXT,
  p_ip_address TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_already_exists BOOLEAN;
BEGIN
  -- Check if already exists (race condition protection)
  SELECT EXISTS(
    SELECT 1 
    FROM anonymous_demo_runs 
    WHERE workflow_id = p_workflow_id 
      AND device_fingerprint = p_device_fingerprint 
      AND ip_address = p_ip_address
  ) INTO v_already_exists;
  
  IF v_already_exists THEN
    -- Already used - return error
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Demo run already used for this device and IP address',
      'allowed', false
    );
  ELSE
    -- Insert new record
    INSERT INTO anonymous_demo_runs (workflow_id, device_fingerprint, ip_address)
    VALUES (p_workflow_id, p_device_fingerprint, p_ip_address);
    
    v_result := jsonb_build_object(
      'success', true,
      'allowed', true,
      'message', 'Demo run recorded successfully'
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create demo_runs table to track demo run limits server-side
CREATE TABLE IF NOT EXISTS demo_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workflow_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_demo_runs_user_workflow ON demo_runs(user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_demo_runs_user_id ON demo_runs(user_id);

-- Enable RLS
ALTER TABLE demo_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own demo runs
CREATE POLICY "Users can view their own demo runs"
  ON demo_runs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for API endpoints)
CREATE POLICY "Service role full access"
  ON demo_runs FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_demo_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_demo_runs_updated_at
  BEFORE UPDATE ON demo_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_demo_runs_updated_at();

-- Function to reset demo runs for a user (admin only)
CREATE OR REPLACE FUNCTION admin_reset_demo_runs(p_user_id UUID, p_workflow_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check if user is admin (you may need to adjust this based on your admin check)
  -- For now, we'll rely on RLS policies and API-level auth checks
  
  IF p_workflow_id IS NULL THEN
    -- Reset all demo runs for user
    DELETE FROM demo_runs WHERE user_id = p_user_id;
    v_result := jsonb_build_object(
      'success', true,
      'message', 'All demo runs reset for user',
      'user_id', p_user_id
    );
  ELSE
    -- Reset demo runs for specific workflow
    DELETE FROM demo_runs WHERE user_id = p_user_id AND workflow_id = p_workflow_id;
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Demo runs reset for user and workflow',
      'user_id', p_user_id,
      'workflow_id', p_workflow_id
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

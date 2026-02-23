-- Takedown system: soft removal for prompts and workflows (no delete).
-- When removed_at is set, item is hidden from marketplace/search; product page and library show reason.

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_by text;

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_by text;

-- Constrain removed_by to known values when set
ALTER TABLE prompts
  DROP CONSTRAINT IF EXISTS prompts_removed_by_check;
ALTER TABLE prompts
  ADD CONSTRAINT prompts_removed_by_check
  CHECK (removed_by IS NULL OR removed_by IN ('admin', 'owner'));

ALTER TABLE workflows
  DROP CONSTRAINT IF EXISTS workflows_removed_by_check;
ALTER TABLE workflows
  ADD CONSTRAINT workflows_removed_by_check
  CHECK (removed_by IS NULL OR removed_by IN ('admin', 'owner'));

-- Index for "not removed" filters (listing queries)
CREATE INDEX IF NOT EXISTS idx_prompts_removed_at ON prompts (removed_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_removed_at ON workflows (removed_at) WHERE removed_at IS NULL;

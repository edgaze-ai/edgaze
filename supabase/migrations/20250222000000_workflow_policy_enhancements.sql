-- Workflow policy enhancements: version hash, node traces, network access
-- Add workflow_version_hash to workflow_runs metadata (stored in metadata jsonb)
-- Add network_allowed_domains to workflows for marketplace listing display
-- Node traces stored in state_snapshot.nodeTraces (jsonb)

-- Add network_allowed_domains to workflows if not exists (optional - some schemas may differ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'network_allowed_domains'
  ) THEN
    ALTER TABLE public.workflows ADD COLUMN network_allowed_domains text[] DEFAULT '{}';
  END IF;
END $$;

-- Add workflow_version_hash to workflow_runs metadata (we use metadata jsonb, no column needed)
-- Runs will store: metadata->>'workflow_version_hash'

COMMENT ON COLUMN public.workflows.network_allowed_domains IS 'Allowed domains for HTTP nodes in this workflow. Displayed on marketplace listing.';

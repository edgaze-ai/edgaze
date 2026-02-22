-- Purchase version pinning: buyers get the exact workflow version they purchased.
-- workflow_purchases.workflow_version_id = version at purchase time.
-- "Update available" UX when active_version_id !== purchase.workflow_version_id.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_purchases') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workflow_purchases' AND column_name = 'workflow_version_id'
    ) THEN
      ALTER TABLE public.workflow_purchases
        ADD COLUMN workflow_version_id uuid REFERENCES public.workflow_versions(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_workflow_purchases_version
        ON public.workflow_purchases(workflow_version_id)
        WHERE workflow_version_id IS NOT NULL;
      COMMENT ON COLUMN public.workflow_purchases.workflow_version_id IS 'Workflow version at purchase time. Buyers run this version; "update available" when active differs.';
    END IF;
  END IF;
END $$;

-- Allow admins to delete workflow runs (e.g. for "refill" / reset run count in admin panel).
-- Service role already bypasses RLS; this allows admin JWT to delete when using client or RPC.
CREATE POLICY "Admins can delete all workflow runs"
  ON public.workflow_runs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

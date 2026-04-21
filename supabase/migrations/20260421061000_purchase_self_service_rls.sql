-- Allow authenticated users to read their own purchase rows and self-claim
-- beta access for publicly visible free listings. This supports the storefront
-- "get access" flows and the Library page without exposing other users' purchases
-- or allowing self-granted paid access.

ALTER TABLE public.workflow_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own workflow purchases" ON public.workflow_purchases;
CREATE POLICY "Users can read own workflow purchases"
  ON public.workflow_purchases
  FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can self-claim free workflow access" ON public.workflow_purchases;
CREATE POLICY "Users can self-claim free workflow access"
  ON public.workflow_purchases
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND status = 'beta'
    AND EXISTS (
      SELECT 1
      FROM public.workflows w
      WHERE w.id = workflow_id
        AND w.is_published = true
        AND w.is_public = true
        AND w.removed_at IS NULL
        AND (w.monetisation_mode = 'free' OR w.is_paid = false)
    )
  );

DROP POLICY IF EXISTS "Users can read own prompt purchases" ON public.prompt_purchases;
CREATE POLICY "Users can read own prompt purchases"
  ON public.prompt_purchases
  FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can self-claim free prompt access" ON public.prompt_purchases;
CREATE POLICY "Users can self-claim free prompt access"
  ON public.prompt_purchases
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND status = 'beta'
    AND EXISTS (
      SELECT 1
      FROM public.prompts p
      WHERE p.id = prompt_id
        AND p.removed_at IS NULL
        AND p.visibility IN ('public', 'unlisted')
        AND (p.monetisation_mode = 'free' OR p.is_paid = false)
    )
  );

-- Fix access helper shadowing: "workflow_id = workflow_id" always compared the column to itself.
-- Keep original parameter names (user_id, workflow_id / prompt_id) so CREATE OR REPLACE is allowed;
-- use $1/$2 in the body to reference parameters unambiguously.
CREATE OR REPLACE FUNCTION public.has_workflow_access(
  user_id uuid,
  workflow_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workflow_purchases wp
    WHERE wp.buyer_id = $1
      AND wp.workflow_id = $2
      AND wp.status = 'paid'
      AND wp.refunded_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_prompt_access(
  user_id uuid,
  prompt_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.prompt_purchases pp
    WHERE pp.buyer_id = $1
      AND pp.prompt_id = $2
      AND pp.status = 'paid'
      AND pp.refunded_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.has_workflow_access(uuid, uuid) IS 'True if user has an active paid purchase for the workflow (shadowing fix via $1/$2).';
COMMENT ON FUNCTION public.has_prompt_access(uuid, uuid) IS 'True if user has an active paid purchase for the prompt (shadowing fix via $1/$2).';

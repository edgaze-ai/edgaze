-- Reconcile prompts.runs_count and workflows.runs_count with public.runs (analytics).
-- Rules match app listing-metrics + isMarketplaceUnifiedRunMetadata:
--   terminal status, ended_at set, exclude builder tests and hosted demo runs.

DROP FUNCTION IF EXISTS public._edgaze_marketplace_runs_filter(public.runs);

CREATE OR REPLACE FUNCTION public._edgaze_marketplace_runs_filter(r public.runs)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    r.ended_at IS NOT NULL
    AND r.status IN ('success', 'error', 'canceled')
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isBuilderTest": true}'::jsonb)
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isDemo": true}'::jsonb);
$$;

COMMENT ON FUNCTION public._edgaze_marketplace_runs_filter(public.runs) IS
  'Internal helper for backfill; drop after migration if unused.';

-- Workflows: set counts from aggregated marketplace runs
UPDATE public.workflows w
SET runs_count = COALESCE(agg.c, 0)
FROM (
  SELECT workflow_id AS id, COUNT(*)::integer AS c
  FROM public.runs r
  WHERE r.kind = 'workflow'
    AND r.workflow_id IS NOT NULL
    AND public._edgaze_marketplace_runs_filter(r)
  GROUP BY r.workflow_id
) agg
WHERE w.id = agg.id;

UPDATE public.workflows w
SET runs_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.runs r
  WHERE r.kind = 'workflow'
    AND r.workflow_id = w.id
    AND public._edgaze_marketplace_runs_filter(r)
);

-- Prompts
UPDATE public.prompts p
SET runs_count = COALESCE(agg.c, 0)
FROM (
  SELECT prompt_id AS id, COUNT(*)::integer AS c
  FROM public.runs r
  WHERE r.kind = 'prompt'
    AND r.prompt_id IS NOT NULL
    AND public._edgaze_marketplace_runs_filter(r)
  GROUP BY r.prompt_id
) agg
WHERE p.id = agg.id;

UPDATE public.prompts p
SET runs_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.runs r
  WHERE r.kind = 'prompt'
    AND r.prompt_id = p.id
    AND public._edgaze_marketplace_runs_filter(r)
);

DROP FUNCTION public._edgaze_marketplace_runs_filter(public.runs);

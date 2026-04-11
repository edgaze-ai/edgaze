-- Admin-controlled: when true, listing never appears in landing "Trending on Edgaze".

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS exclude_from_trending boolean NOT NULL DEFAULT false;

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS exclude_from_trending boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workflows.exclude_from_trending IS
  'If true, hidden from automated trending carousel (admin can set).';
COMMENT ON COLUMN public.prompts.exclude_from_trending IS
  'If true, hidden from automated trending carousel (admin can set).';

CREATE INDEX IF NOT EXISTS idx_workflows_exclude_from_trending
  ON public.workflows (exclude_from_trending)
  WHERE exclude_from_trending = true;

CREATE INDEX IF NOT EXISTS idx_prompts_exclude_from_trending
  ON public.prompts (exclude_from_trending)
  WHERE exclude_from_trending = true;

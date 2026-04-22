ALTER TABLE public.prompts
ADD COLUMN IF NOT EXISTS featured_on_profile boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_on_profile_rank smallint;

ALTER TABLE public.workflows
ADD COLUMN IF NOT EXISTS featured_on_profile boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_on_profile_rank smallint;

ALTER TABLE public.prompts
DROP CONSTRAINT IF EXISTS prompts_featured_on_profile_rank_check;

ALTER TABLE public.prompts
ADD CONSTRAINT prompts_featured_on_profile_rank_check
CHECK (featured_on_profile_rank IS NULL OR featured_on_profile_rank BETWEEN 1 AND 3);

ALTER TABLE public.workflows
DROP CONSTRAINT IF EXISTS workflows_featured_on_profile_rank_check;

ALTER TABLE public.workflows
ADD CONSTRAINT workflows_featured_on_profile_rank_check
CHECK (featured_on_profile_rank IS NULL OR featured_on_profile_rank BETWEEN 1 AND 3);

CREATE INDEX IF NOT EXISTS prompts_owner_featured_on_profile_idx
ON public.prompts (owner_id, featured_on_profile, featured_on_profile_rank)
WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS workflows_owner_featured_on_profile_idx
ON public.workflows (owner_id, featured_on_profile, featured_on_profile_rank)
WHERE removed_at IS NULL;

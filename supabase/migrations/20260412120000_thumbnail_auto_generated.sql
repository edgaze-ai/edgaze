-- Track listing thumbnails produced by in-app canvas generators vs custom uploads/URLs.
-- Used for marketplace trending eligibility (auto thumbs need higher run count).

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS thumbnail_auto_generated boolean;

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS thumbnail_auto_generated boolean;

COMMENT ON COLUMN public.workflows.thumbnail_auto_generated IS
  'True when thumbnail came from the builder auto generator (not a user upload).';
COMMENT ON COLUMN public.prompts.thumbnail_auto_generated IS
  'True when thumbnail came from the prompt studio auto generator (not asset picker / upload).';

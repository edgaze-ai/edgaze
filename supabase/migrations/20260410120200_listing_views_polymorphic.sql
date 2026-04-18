-- Polymorphic listing views (prompt + workflow), view events for analytics, public run dedupe.

-- Ensure public run counter column exists on workflows (prompts often already have it from publish flow).
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS runs_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS runs_count integer NOT NULL DEFAULT 0;

-- 1) listing_views: drop prompt-only FK, add listing_type
DROP INDEX IF EXISTS public.idx_listing_views_user;
DROP INDEX IF EXISTS public.idx_listing_views_client;
DROP INDEX IF EXISTS public.idx_listing_views_listing;

ALTER TABLE public.listing_views DROP CONSTRAINT IF EXISTS listing_views_listing_id_fkey;

ALTER TABLE public.listing_views
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'prompt';

UPDATE public.listing_views SET listing_type = 'prompt' WHERE listing_type IS NULL OR listing_type = '';

ALTER TABLE public.listing_views
  DROP CONSTRAINT IF EXISTS listing_views_listing_type_check;
ALTER TABLE public.listing_views
  ADD CONSTRAINT listing_views_listing_type_check CHECK (listing_type IN ('prompt', 'workflow'));

COMMENT ON COLUMN public.listing_views.listing_type IS 'prompt = prompts.id, workflow = workflows.id';

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_user_v2
  ON public.listing_views(listing_type, listing_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_client_v2
  ON public.listing_views(listing_type, listing_id, client_identifier)
  WHERE client_identifier IS NOT NULL AND client_identifier <> '';

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_v2
  ON public.listing_views(listing_type, listing_id);

-- 2) Append-only view events (creator analytics / conversion)
CREATE TABLE IF NOT EXISTS public.listing_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type text NOT NULL CHECK (listing_type IN ('prompt', 'workflow')),
  listing_id uuid NOT NULL,
  viewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_identifier text,
  counted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_view_events_listing_time
  ON public.listing_view_events(listing_type, listing_id, counted_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_view_events_client_hour
  ON public.listing_view_events(client_identifier, counted_at DESC)
  WHERE client_identifier IS NOT NULL AND client_identifier <> '';

ALTER TABLE public.listing_view_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.listing_view_events IS 'One row per counted listing view (after cooldown); used for analytics time series.';

-- 3) Dedupe table for public runs_count bumps (short cooldown per viewer)
CREATE TABLE IF NOT EXISTS public.listing_public_run_dedupe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type text NOT NULL CHECK (listing_type IN ('prompt', 'workflow')),
  listing_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_identifier text,
  last_counted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_public_run_dedupe_user_or_client CHECK (
    (user_id IS NOT NULL AND client_identifier IS NULL) OR
    (user_id IS NULL AND client_identifier IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_public_run_dedupe_user
  ON public.listing_public_run_dedupe(listing_type, listing_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_public_run_dedupe_client
  ON public.listing_public_run_dedupe(listing_type, listing_id, client_identifier)
  WHERE client_identifier IS NOT NULL AND client_identifier <> '';

ALTER TABLE public.listing_public_run_dedupe ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.listing_public_run_dedupe IS 'Rate-limit public runs_count increments per listing per viewer.';

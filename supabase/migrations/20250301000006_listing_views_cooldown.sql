-- Track listing views for 6hr cooldown (count once per user per 6h)
CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_identifier text,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_views_pkey PRIMARY KEY (id),
  CONSTRAINT listing_views_user_or_client CHECK (
    (user_id IS NOT NULL AND client_identifier IS NULL) OR
    (user_id IS NULL AND client_identifier IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_user
  ON public.listing_views(listing_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_client
  ON public.listing_views(listing_id, client_identifier)
  WHERE client_identifier IS NOT NULL AND client_identifier != '';

CREATE INDEX IF NOT EXISTS idx_listing_views_listing
  ON public.listing_views(listing_id);

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (API) can access. Service role bypasses RLS.

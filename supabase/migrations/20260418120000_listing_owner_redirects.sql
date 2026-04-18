-- Remember old storefront path segments when a listing moves to another account (admin transfer).
-- Resolves /{oldHandle}/{code} and /p/{oldHandle}/{code} when edgaze_code is not globally unique.

CREATE TABLE IF NOT EXISTS public.listing_owner_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('workflow', 'prompt')),
  from_owner_handle_norm text NOT NULL,
  edgaze_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_owner_redirects_from_code_unique UNIQUE (from_owner_handle_norm, edgaze_code)
);

CREATE INDEX IF NOT EXISTS idx_listing_owner_redirects_listing
  ON public.listing_owner_redirects (listing_id, listing_type);

COMMENT ON TABLE public.listing_owner_redirects IS
  'Maps previous owner_handle + edgaze_code to a listing after ownership transfer so old links redirect.';

ALTER TABLE public.listing_owner_redirects ENABLE ROW LEVEL SECURITY;

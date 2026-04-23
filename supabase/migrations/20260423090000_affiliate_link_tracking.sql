-- Affiliate link tracking for curated storefront pages such as /diplomeme.

CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  owner_profile_handle text,
  storefront_path text NOT NULL,
  cta_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_links_slug_not_empty CHECK (btrim(slug) <> ''),
  CONSTRAINT affiliate_links_slug_lower CHECK (slug = lower(slug)),
  CONSTRAINT affiliate_links_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE public.affiliate_links IS
  'Configured affiliate storefront links and destinations.';
COMMENT ON COLUMN public.affiliate_links.cta_url IS
  'Destination for the storefront conversion CTA.';

CREATE TABLE IF NOT EXISTS public.affiliate_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id uuid NOT NULL REFERENCES public.affiliate_links(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'cta_click')),
  viewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_identifier text,
  page_url text,
  referrer text,
  target_url text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.affiliate_link_events IS
  'Append-only event stream for affiliate storefront views and conversion clicks.';

CREATE INDEX IF NOT EXISTS idx_affiliate_link_events_link_time
  ON public.affiliate_link_events(affiliate_link_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_link_events_type_time
  ON public.affiliate_link_events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_link_events_client_time
  ON public.affiliate_link_events(client_identifier, occurred_at DESC)
  WHERE client_identifier IS NOT NULL AND client_identifier <> '';

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_link_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.affiliate_links (slug, label, owner_profile_handle, storefront_path, cta_url)
VALUES (
  'diplomeme',
  'Diplomeme',
  'diplomeme',
  '/diplomeme',
  '/templates?affiliate=diplomeme&utm_source=affiliate&utm_medium=storefront&utm_campaign=diplomeme'
)
ON CONFLICT (slug) DO UPDATE
SET
  label = EXCLUDED.label,
  owner_profile_handle = EXCLUDED.owner_profile_handle,
  storefront_path = EXCLUDED.storefront_path,
  cta_url = EXCLUDED.cta_url,
  is_active = true,
  updated_at = now();

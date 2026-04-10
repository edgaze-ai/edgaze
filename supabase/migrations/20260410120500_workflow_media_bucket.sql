-- Public bucket for workflow/prompt listing images (thumbnails, demos, QR assets).
-- Uploaded via /api/creator/listing-media/upload using the service role.
-- NOTE: Version must differ from 20260410120000_listing_views_polymorphic.sql (Supabase uses the numeric prefix as schema_migrations PK).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workflow-media',
  'workflow-media',
  true,
  10485760, -- 10 MB (aligned with MAX_ASSET_FILE_BYTES in app)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Public read workflow listing media" ON storage.objects;

CREATE POLICY "Public read workflow listing media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workflow-media');

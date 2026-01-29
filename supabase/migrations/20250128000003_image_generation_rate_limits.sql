-- Image Generation Rate Limiting
-- Tracks per-user image generation to enforce 5 free images per user, then BYOK

-- Drop old functions if they exist (with different signatures)
-- This ensures we don't have function name conflicts
DROP FUNCTION IF EXISTS public.can_generate_image(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.time_until_next_image_allowed(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.record_image_generation(TEXT, TEXT, UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.record_image_generation(TEXT, TEXT, UUID, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_user_free_image_count(UUID);
DROP FUNCTION IF EXISTS public.can_generate_image_free(UUID, BOOLEAN);

-- Drop existing table if it exists (to recreate with new schema)
DROP TABLE IF EXISTS public.image_generation_tracking CASCADE;

CREATE TABLE public.image_generation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or device fingerprint (for anonymous users)
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'device', 'user')), -- Type of identifier
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Primary: link to user if authenticated
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL, -- Optional: which workflow
  node_id TEXT, -- Which image node was used
  used_free_tier BOOLEAN NOT NULL DEFAULT true, -- Whether this was a free tier generation
  api_key_provided BOOLEAN NOT NULL DEFAULT false, -- Whether user provided their own API key
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  image_url TEXT, -- The generated image URL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by user (primary)
CREATE INDEX idx_image_gen_tracking_user_id 
  ON public.image_generation_tracking(user_id) 
  WHERE user_id IS NOT NULL;

-- Index for identifier lookups (for anonymous users)
CREATE INDEX idx_image_gen_tracking_identifier 
  ON public.image_generation_tracking(identifier, identifier_type);

-- Index for free tier tracking
CREATE INDEX idx_image_gen_tracking_free_tier 
  ON public.image_generation_tracking(user_id, used_free_tier) 
  WHERE user_id IS NOT NULL AND used_free_tier = true;

-- Function to get free image count for a user
CREATE FUNCTION public.get_user_free_image_count(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count free tier images for this user
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.image_generation_tracking
  WHERE user_id = p_user_id
    AND used_free_tier = true;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function to check if image generation is allowed (5 free per user, then BYOK)
CREATE FUNCTION public.can_generate_image_free(
  p_user_id UUID,
  p_has_api_key BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_free_count INTEGER;
  v_allowed BOOLEAN;
  v_requires_api_key BOOLEAN;
  v_free_remaining INTEGER;
BEGIN
  -- If user provided API key, always allow (BYOK)
  IF p_has_api_key THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_api_key', false,
      'free_remaining', 0,
      'reason', 'user_provided_api_key'
    );
  END IF;
  
  -- Get user's free image count
  SELECT get_user_free_image_count(p_user_id) INTO v_free_count;
  
  -- Check if under limit (5 free images)
  IF v_free_count < 5 THEN
    v_free_remaining := 5 - v_free_count;
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_api_key', false,
      'free_remaining', v_free_remaining,
      'free_used', v_free_count,
      'reason', 'under_free_limit'
    );
  END IF;
  
  -- Over limit: require API key
  RETURN jsonb_build_object(
    'allowed', false,
    'requires_api_key', true,
    'free_remaining', 0,
    'free_used', v_free_count,
    'reason', 'free_limit_exceeded',
    'error', 'You have used all 5 free images. Please provide your OpenAI API key to continue generating images.'
  );
END;
$$;

-- Function to record an image generation
CREATE FUNCTION public.record_image_generation(
  p_identifier TEXT,
  p_identifier_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_workflow_id UUID DEFAULT NULL,
  p_node_id TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_used_free_tier BOOLEAN DEFAULT true,
  p_api_key_provided BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.image_generation_tracking (
    identifier,
    identifier_type,
    user_id,
    workflow_id,
    node_id,
    image_url,
    used_free_tier,
    api_key_provided
  ) VALUES (
    p_identifier,
    p_identifier_type,
    p_user_id,
    p_workflow_id,
    p_node_id,
    p_image_url,
    p_used_free_tier,
    p_api_key_provided
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- RLS Policies
ALTER TABLE public.image_generation_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own image generation records" ON public.image_generation_tracking;
DROP POLICY IF EXISTS "Service role can insert image generation records" ON public.image_generation_tracking;

-- Allow authenticated users to read their own records
CREATE POLICY "Users can read their own image generation records"
  ON public.image_generation_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow service role to insert (for API calls)
CREATE POLICY "Service role can insert image generation records"
  ON public.image_generation_tracking
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_free_image_count(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_generate_image_free(UUID, BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_image_generation(TEXT, TEXT, UUID, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated, anon;

-- Comments
COMMENT ON TABLE public.image_generation_tracking IS 'Tracks image generation requests for rate limiting (5 free per user, then BYOK)';
COMMENT ON FUNCTION public.get_user_free_image_count IS 'Returns the count of free images used by a user';
COMMENT ON FUNCTION public.can_generate_image_free IS 'Checks if free image generation is allowed (5 free per user, then requires API key)';
COMMENT ON FUNCTION public.record_image_generation IS 'Records an image generation event for rate limiting';

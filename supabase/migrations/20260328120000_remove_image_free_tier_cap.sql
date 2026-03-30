-- Align can_generate_image_free with app: no per-user count cap for platform OpenAI image gen.

CREATE OR REPLACE FUNCTION public.can_generate_image_free(
  p_user_id UUID,
  p_has_api_key BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_free_count INTEGER;
BEGIN
  IF p_has_api_key THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_api_key', false,
      'free_remaining', 0,
      'reason', 'user_provided_api_key'
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT public.get_user_free_image_count(p_user_id) INTO v_free_count;
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_api_key', false,
      'free_used', v_free_count,
      'reason', 'signed_in_platform_key'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', false,
    'requires_api_key', true,
    'free_remaining', 0,
    'free_used', 0,
    'reason', 'anonymous_requires_key',
    'error', 'Please sign in or provide your OpenAI API key.'
  );
END;
$$;

COMMENT ON FUNCTION public.can_generate_image_free(UUID, BOOLEAN) IS
  'Platform image gen: signed-in or BYOK; no per-user free image count cap.';

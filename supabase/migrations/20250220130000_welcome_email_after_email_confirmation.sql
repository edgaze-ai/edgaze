-- Move welcome email from profile insert to auth.users email confirmation
-- Sends only after: OAuth first sign-in, or email user confirms their email

-- 1. Drop the profile-based trigger
DROP TRIGGER IF EXISTS on_profile_created_send_welcome_email ON public.profiles;

-- 2. Create function to send welcome email when email is confirmed
CREATE OR REPLACE FUNCTION public.trigger_send_welcome_email_on_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_handle text;
  v_should_send boolean := false;
BEGIN
  v_email := COALESCE(TRIM(NEW.email), '');
  IF v_email = '' OR position('@' IN v_email) < 2 THEN
    RETURN NEW;
  END IF;

  -- Fire on INSERT when email is already confirmed (OAuth)
  IF TG_OP = 'INSERT' AND NEW.email_confirmed_at IS NOT NULL THEN
    v_should_send := true;
  END IF;

  -- Fire on UPDATE when email_confirmed_at just became non-null (email signup confirmation)
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    v_should_send := true;
  END IF;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Get profile data (profile exists: created by handle_new_user on auth insert)
  SELECT full_name, handle INTO v_full_name, v_handle
  FROM public.profiles
  WHERE id = NEW.id
  LIMIT 1;

  PERFORM net.http_post(
    url := 'https://vbiobyjxhwiyvjqkwosx.supabase.co/functions/v1/send-welcome-email',
    body := jsonb_build_object(
      'email', v_email,
      'full_name', COALESCE(v_full_name, ''),
      'handle', COALESCE(v_handle, '')
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

-- 3. Trigger on auth.users for both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_send_welcome ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_send_welcome
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_welcome_email_on_confirmation();

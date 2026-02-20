-- Enable pg_net for async HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function: invoke welcome email Edge Function when a new profile is created
CREATE OR REPLACE FUNCTION public.trigger_send_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only send if we have a valid email (covers both email signup and OAuth)
  IF NEW.email IS NOT NULL AND NEW.email <> '' AND position('@' in NEW.email) > 1 THEN
    PERFORM net.http_post(
      url := 'https://vbiobyjxhwiyvjqkwosx.supabase.co/functions/v1/send-welcome-email',
      body := jsonb_build_object(
        'email', NEW.email,
        'full_name', NEW.full_name,
        'handle', NEW.handle
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: fire on every new profile insert (email signup + OAuth)
DROP TRIGGER IF EXISTS on_profile_created_send_welcome_email ON public.profiles;
CREATE TRIGGER on_profile_created_send_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_welcome_email();

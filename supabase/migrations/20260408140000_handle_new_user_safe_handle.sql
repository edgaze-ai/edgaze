-- Ensure new auth users always get a profiles.handle that fits 3–24 chars [a-z0-9_].
-- Synthetic provisioned emails previously used 34-char local parts; triggers that derive
-- handle from the email local part then violated CHECK / app constraints and aborted signup
-- (Supabase Auth often surfaces this as unexpected_failure).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle text;
  v_from_email text;
BEGIN
  v_handle := NULLIF(trim(NEW.raw_user_meta_data->>'handle'), '');
  IF v_handle IS NOT NULL THEN
    v_handle := lower(regexp_replace(v_handle, '[^a-z0-9_]', '_', 'g'));
    v_handle := regexp_replace(v_handle, '_+', '_', 'g');
    v_handle := trim(both '_' from v_handle);
    IF length(v_handle) < 3 OR length(v_handle) > 24 OR v_handle !~ '^[a-z0-9_]+$' THEN
      v_handle := NULL;
    END IF;
  END IF;

  IF v_handle IS NULL THEN
    v_from_email := split_part(NEW.email, '@', 1);
    v_from_email := lower(regexp_replace(v_from_email, '[^a-z0-9_]', '_', 'g'));
    v_from_email := regexp_replace(v_from_email, '_+', '_', 'g');
    v_from_email := trim(both '_' from v_from_email);
    IF length(v_from_email) BETWEEN 3 AND 24 AND v_from_email ~ '^[a-z0-9_]+$' THEN
      v_handle := v_from_email;
    ELSE
      v_handle := 'u' || substring(replace(NEW.id::text, '-', '') from 1 for 23);
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, handle, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    v_handle,
    NEW.email
  );

  RETURN NEW;
END;
$$;

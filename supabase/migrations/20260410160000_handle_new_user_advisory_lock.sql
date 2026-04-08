-- Auth insert -> handle_new_user could still hit profiles_username_key when two signups raced for the
-- same handle, or when RLS hid rows from EXISTS checks. Serialize per normalized handle and bump to a
-- fresh slug if the desired handle is already taken.

CREATE OR REPLACE FUNCTION public.is_profile_handle_available(
  handle_input text,
  exclude_profile_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT btrim(coalesce(handle_input, '')) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.handle IS NOT NULL
        AND lower(btrim(p.handle)) = lower(btrim(handle_input))
        AND (exclude_profile_id IS NULL OR p.id <> exclude_profile_id)
    );
$$;

COMMENT ON FUNCTION public.is_profile_handle_available(text, uuid) IS
  'True if no profile owns this handle (case-insensitive btrim match). Optional row excluded for handle changes.';

GRANT EXECUTE ON FUNCTION public.is_profile_handle_available(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_handle text;
  v_from_email text;
  attempt int := 0;
BEGIN
  v_handle := NULLIF(btrim(NEW.raw_user_meta_data->>'handle'), '');
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

  IF v_handle IS NULL
    OR btrim(v_handle) = ''
    OR length(btrim(v_handle)) < 3
    OR length(btrim(v_handle)) > 24
    OR btrim(v_handle) !~ '^[a-z0-9_]+$' THEN
    v_handle := 'u' || substring(replace(NEW.id::text, '-', '') from 1 for 23);
  END IF;

  -- Serialize check+insert per candidate handle; re-lock when we pick a fallback slug.
  LOOP
    PERFORM pg_advisory_xact_lock(7584103, hashtext(lower(btrim(v_handle))));
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE lower(btrim(p.handle)) = lower(btrim(v_handle))
    ) THEN
      EXIT;
    END IF;
    attempt := attempt + 1;
    v_handle := 'u' || substring(md5(NEW.id::text || ':' || attempt::text) from 1 for 23);
    IF attempt > 72 THEN
      RAISE EXCEPTION 'Could not allocate unique profile handle';
    END IF;
  END LOOP;

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

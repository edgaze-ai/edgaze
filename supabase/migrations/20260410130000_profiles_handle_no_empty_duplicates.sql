-- Empty / whitespace-only / too-short handles caused multiple rows to fight for the same value
-- (e.g. handle = '') and hit profiles_username_key. Normalize bad rows and forbid them going forward.

-- Backfill: deterministic slug per profile id; fall back if u+uuid-prefix collides with an existing handle.
DO $$
DECLARE
  r RECORD;
  candidate text;
BEGIN
  FOR r IN
    SELECT id
    FROM public.profiles
    WHERE handle IS NULL
      OR btrim(handle) = ''
      OR length(btrim(handle)) < 3
      OR length(btrim(handle)) > 24
  LOOP
    candidate := 'u' || substring(replace(r.id::text, '-', '') from 1 for 23);
    IF EXISTS (SELECT 1 FROM public.profiles o WHERE o.handle = candidate AND o.id <> r.id) THEN
      candidate := 'u' || substring(md5(r.id::text) from 1 for 23);
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles o WHERE o.handle = candidate AND o.id <> r.id) THEN
      candidate := 'u' || substring(md5(r.id::text || '2') from 1 for 23);
    END IF;
    UPDATE public.profiles SET handle = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_handle_nonempty_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_nonempty_check
  CHECK (
    handle IS NOT NULL
    AND btrim(handle) <> ''
    AND length(btrim(handle)) BETWEEN 3 AND 24
  );

COMMENT ON CONSTRAINT profiles_handle_nonempty_check ON public.profiles IS
  'Prevents blank/whitespace/too-short handles that collide on unique(handle).';

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

  -- Never write empty/invalid handle (duplicate-key on '' / whitespace-only).
  IF v_handle IS NULL
    OR btrim(v_handle) = ''
    OR length(btrim(v_handle)) < 3
    OR length(btrim(v_handle)) > 24
    OR btrim(v_handle) !~ '^[a-z0-9_]+$' THEN
    v_handle := 'u' || substring(replace(NEW.id::text, '-', '') from 1 for 23);
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

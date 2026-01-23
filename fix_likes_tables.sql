-- Fix likes tables to prevent unlimited likes
-- Run this SQL in your Supabase SQL editor

-- Step 1: Add unique constraint to prompt_likes to prevent duplicates
-- First, remove any duplicate likes (keep the oldest one)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_likes') THEN
    DELETE FROM prompt_likes
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id, prompt_id ORDER BY created_at ASC) as rn
        FROM prompt_likes
      ) t
      WHERE t.rn > 1
    );

    -- Add unique constraint on (user_id, prompt_id) if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'prompt_likes_user_prompt_unique'
    ) THEN
      ALTER TABLE prompt_likes
      ADD CONSTRAINT prompt_likes_user_prompt_unique UNIQUE (user_id, prompt_id);
    END IF;
  END IF;
END $$;

-- Step 2: Create workflow_likes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workflow_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_likes_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_likes_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_likes_user_workflow_unique UNIQUE (user_id, workflow_id)
);

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prompt_likes_user_id ON prompt_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_likes_prompt_id ON prompt_likes(prompt_id);
CREATE INDEX IF NOT EXISTS idx_workflow_likes_user_id ON workflow_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_likes_workflow_id ON workflow_likes(workflow_id);

-- Step 4: Create RLS policies (fixed to work with authenticated users)
-- Enable RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_likes') THEN
    ALTER TABLE prompt_likes ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can insert their own prompt likes" ON prompt_likes;
    DROP POLICY IF EXISTS "Users can delete their own prompt likes" ON prompt_likes;
    DROP POLICY IF EXISTS "Anyone can read prompt likes" ON prompt_likes;
    DROP POLICY IF EXISTS "Authenticated users can insert prompt likes" ON prompt_likes;
    DROP POLICY IF EXISTS "Authenticated users can delete prompt likes" ON prompt_likes;
    DROP POLICY IF EXISTS "Users can insert own prompt likes" ON prompt_likes;
    DROP POLICY IF EXISTS "Users can delete own prompt likes" ON prompt_likes;
    
    -- Policy: Users can only insert likes with their own user_id
    -- This ensures users can't like on behalf of others
    CREATE POLICY "Users can insert own prompt likes"
      ON prompt_likes FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL AND 
        auth.uid()::text = user_id
      );

    -- Policy: Users can delete their own likes only
    CREATE POLICY "Users can delete own prompt likes"
      ON prompt_likes FOR DELETE
      TO authenticated
      USING (
        auth.uid() IS NOT NULL AND 
        auth.uid()::text = user_id
      );

    -- Policy: Anyone can read likes (for counting)
    CREATE POLICY "Anyone can read prompt likes"
      ON prompt_likes FOR SELECT
      USING (true);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_likes') THEN
    ALTER TABLE workflow_likes ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can insert their own workflow likes" ON workflow_likes;
    DROP POLICY IF EXISTS "Users can delete their own workflow likes" ON workflow_likes;
    DROP POLICY IF EXISTS "Anyone can read workflow likes" ON workflow_likes;
    DROP POLICY IF EXISTS "Authenticated users can insert workflow likes" ON workflow_likes;
    DROP POLICY IF EXISTS "Authenticated users can delete workflow likes" ON workflow_likes;
    DROP POLICY IF EXISTS "Users can insert own workflow likes" ON workflow_likes;
    DROP POLICY IF EXISTS "Users can delete own workflow likes" ON workflow_likes;
    
    -- Policy: Users can only insert likes with their own user_id
    -- This ensures users can't like on behalf of others
    CREATE POLICY "Users can insert own workflow likes"
      ON workflow_likes FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL AND 
        auth.uid()::text = user_id
      );

    -- Policy: Users can delete their own likes only
    CREATE POLICY "Users can delete own workflow likes"
      ON workflow_likes FOR DELETE
      TO authenticated
      USING (
        auth.uid() IS NOT NULL AND 
        auth.uid()::text = user_id
      );

    -- Policy: Anyone can read likes (for counting)
    CREATE POLICY "Anyone can read workflow likes"
      ON workflow_likes FOR SELECT
      USING (true);
  END IF;
END $$;

-- Step 4.5: Create function to safely insert likes
-- SECURITY DEFINER allows it to bypass RLS, but we still validate user_id matches auth.uid()
-- This provides defense in depth: RLS + function validation
CREATE OR REPLACE FUNCTION insert_prompt_like(p_prompt_id uuid, p_user_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_id uuid;
  v_auth_user_id text;
BEGIN
  -- Validate that the authenticated user matches the provided user_id
  -- This prevents users from liking on behalf of others even with SECURITY DEFINER
  v_auth_user_id := auth.uid()::text;
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF v_auth_user_id != p_user_id THEN
    RAISE EXCEPTION 'User ID mismatch: cannot like on behalf of another user';
  END IF;
  
  -- Insert the like (bypasses RLS due to SECURITY DEFINER, but user_id is validated above)
  INSERT INTO prompt_likes (prompt_id, user_id)
  VALUES (p_prompt_id, p_user_id)
  ON CONFLICT (user_id, prompt_id) DO NOTHING
  RETURNING id INTO v_like_id;
  
  RETURN v_like_id;
END;
$$;

CREATE OR REPLACE FUNCTION insert_workflow_like(p_workflow_id uuid, p_user_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_id uuid;
  v_auth_user_id text;
BEGIN
  -- Validate that the authenticated user matches the provided user_id
  -- This prevents users from liking on behalf of others even with SECURITY DEFINER
  v_auth_user_id := auth.uid()::text;
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF v_auth_user_id != p_user_id THEN
    RAISE EXCEPTION 'User ID mismatch: cannot like on behalf of another user';
  END IF;
  
  -- Insert the like (bypasses RLS due to SECURITY DEFINER, but user_id is validated above)
  INSERT INTO workflow_likes (workflow_id, user_id)
  VALUES (p_workflow_id, p_user_id)
  ON CONFLICT (user_id, workflow_id) DO NOTHING
  RETURNING id INTO v_like_id;
  
  RETURN v_like_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION insert_prompt_like(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_workflow_like(uuid, text) TO authenticated;

-- Step 5: Create function to sync likes_count (optional but recommended)
-- This function updates the likes_count when likes are added/removed
CREATE OR REPLACE FUNCTION sync_prompt_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE prompts
    SET likes_count = (
      SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = NEW.prompt_id
    )
    WHERE id = NEW.prompt_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE prompts
    SET likes_count = (
      SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = OLD.prompt_id
    )
    WHERE id = OLD.prompt_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_workflow_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workflows
    SET likes_count = (
      SELECT COUNT(*) FROM workflow_likes WHERE workflow_id = NEW.workflow_id
    )
    WHERE id = NEW.workflow_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workflows
    SET likes_count = (
      SELECT COUNT(*) FROM workflow_likes WHERE workflow_id = OLD.workflow_id
    )
    WHERE id = OLD.workflow_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically sync counts
DROP TRIGGER IF EXISTS trigger_sync_prompt_likes_count ON prompt_likes;
CREATE TRIGGER trigger_sync_prompt_likes_count
  AFTER INSERT OR DELETE ON prompt_likes
  FOR EACH ROW EXECUTE FUNCTION sync_prompt_likes_count();

DROP TRIGGER IF EXISTS trigger_sync_workflow_likes_count ON workflow_likes;
CREATE TRIGGER trigger_sync_workflow_likes_count
  AFTER INSERT OR DELETE ON workflow_likes
  FOR EACH ROW EXECUTE FUNCTION sync_workflow_likes_count();

-- Step 6: Sync existing counts (fix any discrepancies)
UPDATE prompts
SET likes_count = (
  SELECT COUNT(*) FROM prompt_likes WHERE prompt_likes.prompt_id = prompts.id
);

UPDATE workflows
SET likes_count = (
  SELECT COUNT(*) FROM workflow_likes WHERE workflow_likes.workflow_id = workflows.id
);

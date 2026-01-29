# Supabase Setup for Builder Test Run Tracking

## Run this SQL in Supabase SQL Editor

```sql
-- Create workflow_runs table for tracking builder test runs and workflow executions
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'timeout'::text])),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  duration_ms integer,
  error_details jsonb,
  state_snapshot jsonb,
  checkpoint jsonb,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflow_runs_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for fast lookups by user and workflow
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_workflow ON public.workflow_runs(user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON public.workflow_runs(started_at DESC);

-- Enable RLS
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own runs
CREATE POLICY "Users can read their own workflow runs"
  ON public.workflow_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own runs
CREATE POLICY "Users can insert their own workflow runs"
  ON public.workflow_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own runs
CREATE POLICY "Users can update their own workflow runs"
  ON public.workflow_runs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Admins can read all runs
CREATE POLICY "Admins can read all workflow runs"
  ON public.workflow_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- Policy: Admins can update all runs
CREATE POLICY "Admins can update all workflow runs"
  ON public.workflow_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );
```

## What Changed

1. **Admin Exemption**: Admins (users in `admin_roles` table) now bypass all run limits and get unlimited runs
2. **Run Tracking**: All builder test runs are now tracked in `workflow_runs` table (not just authenticated users)
3. **Usage Updates**: Run counts update immediately after each run completes/fails
4. **Remaining Endpoint**: `/api/flow/run/remaining` now checks admin status and returns unlimited for admins

## How to Add an Admin

Run this SQL to add a user as admin:

```sql
INSERT INTO public.admin_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'admin')
ON CONFLICT (user_id) DO NOTHING;
```

Replace `USER_UUID_HERE` with the actual user's UUID from `auth.users` table.

## Verify It's Working

1. Check run tracking:
```sql
SELECT user_id, workflow_id, status, COUNT(*) 
FROM workflow_runs 
GROUP BY user_id, workflow_id, status;
```

2. Check admin status:
```sql
SELECT ar.user_id, p.email, p.handle 
FROM admin_roles ar
JOIN profiles p ON p.id = ar.user_id;
```

3. Check run counts:
```sql
SELECT 
  user_id, 
  workflow_id, 
  COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) as run_count
FROM workflow_runs
GROUP BY user_id, workflow_id;
```

## app_settings RLS & maintenance mode

Run the migration `supabase/migrations/20250128000002_app_settings_rls.sql` (via `supabase db push` or Supabase SQL Editor). It:

- Enables RLS on `app_settings`. **SELECT** is allowed for everyone (anon + authenticated). There are no INSERT/UPDATE/DELETE policies; writes go through the `upsert_app_setting(p_key, p_value)` RPC.
- Defines `is_app_admin()` (SECURITY DEFINER) and `upsert_app_setting(text, boolean)` (SECURITY DEFINER). The RPC checks admin and performs upsert, bypassing RLS and avoiding “new row violates row-level security” on upsert.

`app_settings` stores flags such as `applications_paused` (closed beta) and `maintenance_mode`. Maintenance mode is toggled in **Admin → Moderation**; when enabled, all app routes except the landing page (`/`) and admin (`/admin/*`) show an Edgaze-style “Platform under maintenance” screen.

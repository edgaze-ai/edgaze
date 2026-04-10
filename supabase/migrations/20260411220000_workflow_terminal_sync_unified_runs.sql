-- When workflow_runs reaches a terminal status, close the linked public.runs row and bump
-- workflows.runs_count for marketplace executions. Covers SSE disconnect, missed app sync,
-- and event-sequence edge cases.

CREATE OR REPLACE FUNCTION public.trg_sync_unified_run_on_workflow_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
  wid uuid;
  k text;
  meta jsonb;
  should_count boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text, 'timeout'::text])) THEN
    RETURN NEW;
  END IF;

  UPDATE public.runs r
  SET
    status = CASE WHEN NEW.status = 'completed' THEN 'success' ELSE 'error' END,
    ended_at = COALESCE(
      r.ended_at,
      NEW.completed_at,
      NEW.finalized_at,
      NEW.updated_at,
      now()
    ),
    duration_ms = COALESCE(
      r.duration_ms,
      NEW.duration_ms,
      CASE
        WHEN NEW.started_at IS NOT NULL THEN
          ROUND(
            EXTRACT(
              EPOCH FROM (
                COALESCE(NEW.completed_at, NEW.finalized_at, NEW.updated_at, now()) - NEW.started_at
              )
            ) * 1000
          )::integer
        ELSE NULL
      END
    ),
    error_message = CASE
      WHEN NEW.status = 'completed' THEN NULL
      ELSE COALESCE(r.error_message, NEW.error_details->>'message', 'Run failed')
    END,
    updated_at = now()
  WHERE r.workflow_run_id = NEW.id
    AND r.ended_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT r.workflow_id, r.kind, r.metadata
  INTO wid, k, meta
  FROM public.runs r
  WHERE r.workflow_run_id = NEW.id
  LIMIT 1;

  should_count := (
    meta IS NULL
    OR (
      NOT (COALESCE(meta, '{}'::jsonb) @> '{"isBuilderTest": true}'::jsonb)
      AND NOT (COALESCE(meta, '{}'::jsonb) @> '{"isDemo": true}'::jsonb)
    )
  );

  IF should_count AND k = 'workflow' AND wid IS NOT NULL THEN
    UPDATE public.workflows
    SET runs_count = COALESCE(runs_count, 0) + 1
    WHERE id = wid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_unified_run_on_workflow_terminal ON public.workflow_runs;

CREATE TRIGGER trg_sync_unified_run_on_workflow_terminal
  AFTER INSERT OR UPDATE OF status ON public.workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_unified_run_on_workflow_terminal();

COMMENT ON FUNCTION public.trg_sync_unified_run_on_workflow_terminal() IS
  'Closes public.runs and bumps workflows.runs_count when a workflow_run finishes.';

-- Backfill: unified rows still open while workflow_run is already terminal
UPDATE public.runs r
SET
  status = CASE WHEN wr.status = 'completed' THEN 'success' ELSE 'error' END,
  ended_at = COALESCE(r.ended_at, wr.completed_at, wr.finalized_at, wr.updated_at, now()),
  duration_ms = COALESCE(
    r.duration_ms,
    wr.duration_ms,
    CASE
      WHEN wr.started_at IS NOT NULL THEN
        ROUND(
          EXTRACT(
            EPOCH FROM (
              COALESCE(wr.completed_at, wr.finalized_at, wr.updated_at, now()) - wr.started_at
            )
          ) * 1000
        )::integer
      ELSE NULL
    END
  ),
  error_message = CASE
    WHEN wr.status = 'completed' THEN NULL
    ELSE COALESCE(r.error_message, wr.error_details->>'message', 'Run failed')
  END,
  updated_at = now()
FROM public.workflow_runs wr
WHERE r.workflow_run_id = wr.id
  AND r.ended_at IS NULL
  AND wr.status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text, 'timeout'::text]);

-- Reconcile listing counters from analytics (same rules as 20260411180000)
UPDATE public.workflows w
SET runs_count = COALESCE(agg.c, 0)
FROM (
  SELECT r.workflow_id AS id, COUNT(*)::integer AS c
  FROM public.runs r
  WHERE r.kind = 'workflow'
    AND r.workflow_id IS NOT NULL
    AND r.ended_at IS NOT NULL
    AND r.status = ANY (ARRAY['success'::text, 'error'::text, 'canceled'::text])
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isBuilderTest": true}'::jsonb)
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isDemo": true}'::jsonb)
  GROUP BY r.workflow_id
) agg
WHERE w.id = agg.id;

UPDATE public.workflows w
SET runs_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.runs r
  WHERE r.kind = 'workflow'
    AND r.workflow_id = w.id
    AND r.ended_at IS NOT NULL
    AND r.status = ANY (ARRAY['success'::text, 'error'::text, 'canceled'::text])
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isBuilderTest": true}'::jsonb)
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isDemo": true}'::jsonb)
);

UPDATE public.prompts p
SET runs_count = COALESCE(agg.c, 0)
FROM (
  SELECT r.prompt_id AS id, COUNT(*)::integer AS c
  FROM public.runs r
  WHERE r.kind = 'prompt'
    AND r.prompt_id IS NOT NULL
    AND r.ended_at IS NOT NULL
    AND r.status = ANY (ARRAY['success'::text, 'error'::text, 'canceled'::text])
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isBuilderTest": true}'::jsonb)
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isDemo": true}'::jsonb)
  GROUP BY r.prompt_id
) agg
WHERE p.id = agg.id;

UPDATE public.prompts p
SET runs_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.runs r
  WHERE r.kind = 'prompt'
    AND r.prompt_id = p.id
    AND r.ended_at IS NOT NULL
    AND r.status = ANY (ARRAY['success'::text, 'error'::text, 'canceled'::text])
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isBuilderTest": true}'::jsonb)
    AND NOT (COALESCE(r.metadata, '{}'::jsonb) @> '{"isDemo": true}'::jsonb)
);

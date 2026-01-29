-- Allow service_role (API server using admin client) to call run-tracking functions
-- so create/update/count work when session is not in cookies

GRANT EXECUTE ON FUNCTION public.get_user_workflow_run_count(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_workflow_run(UUID, TEXT, INTEGER, JSONB, JSONB) TO service_role;

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** When unset or empty, returns undefined so callers can inherit another flag. */
function parseOptionalBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return parseBooleanFlag(trimmed);
}

export function isWorkflowExecutionV2CompileEnabled(): boolean {
  return parseBooleanFlag(process.env.WORKFLOW_EXECUTION_V2_COMPILE);
}

export function isWorkflowExecutionV2RunnerEnabled(): boolean {
  return parseBooleanFlag(process.env.WORKFLOW_EXECUTION_V2_RUNNER);
}

export function isWorkflowExecutionV2StreamingEnabled(): boolean {
  const explicit = parseOptionalBooleanFlag(process.env.WORKFLOW_EXECUTION_V2_STREAMING);
  if (explicit !== undefined) return explicit;
  // Avoid production foot-gun: v2 runner + modal uses GET /api/runs/:id/stream for live updates.
  return isWorkflowExecutionV2RunnerEnabled();
}

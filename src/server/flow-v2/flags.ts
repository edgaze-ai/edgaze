function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isWorkflowExecutionV2CompileEnabled(): boolean {
  return parseBooleanFlag(process.env.WORKFLOW_EXECUTION_V2_COMPILE);
}

export function isWorkflowExecutionV2RunnerEnabled(): boolean {
  return parseBooleanFlag(process.env.WORKFLOW_EXECUTION_V2_RUNNER);
}

export function isWorkflowExecutionV2StreamingEnabled(): boolean {
  return parseBooleanFlag(process.env.WORKFLOW_EXECUTION_V2_STREAMING);
}

// src/lib/workflows/runTypes.ts

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type RunStepState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type WorkflowRunStepView = {
  stepKey: string;
  title: string;   // human-readable name, not code
  message: string; // human-readable description of what this step is doing
  state: RunStepState;
  durationMs?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type WorkflowRunView = {
  id: string;
  name?: string | null; // e.g. "Notion research pipeline"
  status: RunStatus;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  steps: WorkflowRunStepView[];
  activeStepKey?: string | null; // optional override for which step is "current"
};

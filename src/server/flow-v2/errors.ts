export class WorkflowCompileError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "WorkflowCompileError";
    this.details = details;
  }
}

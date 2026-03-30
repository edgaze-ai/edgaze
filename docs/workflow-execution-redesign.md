# Workflow Execution Redesign

This is the replacement architecture for the current request-bound workflow runner.

Blunt assessment of the current system:

- The current runner is not durable enough to be a production execution engine.
- It executes inside a request and therefore inherits request lifetime, memory lifetime, and connection lifetime.
- It does not freeze a compiled executable snapshot before execution.
- It lets runtime behavior depend on loose builder graph conventions, handle naming, and client-side reconstruction.
- It persists mostly at the end, which means mid-run crash recovery is weak.
- It makes the UI guess step order and future activity, which is why the viewer feels glitchy.

This redesign intentionally does **not** preserve those assumptions.

## A. Target Architecture

The new system is a four-layer architecture:

### 1. Graph compiler

Responsibilities:

- Accept raw builder graph JSON only as compiler input, never as runtime input.
- Normalize nodes, edges, port bindings, and config.
- Validate graph structure, required inputs, port compatibility, cycles, and unsupported specs.
- Produce a deterministic immutable `CompiledWorkflowDefinition`.
- Freeze a snapshot hash used by every run.

Output:

- One immutable compiled snapshot per run.
- Deterministic topo order.
- Explicit `sourcePort -> targetPort` bindings.
- Dependency and downstream maps.

### 2. Run orchestrator

Responsibilities:

- Create the run row and persist the compiled snapshot.
- Create one durable run-node row per compiled node.
- Mark entry nodes ready.
- Enqueue runnable nodes in deterministic topo order.
- Re-evaluate downstream readiness after every terminal attempt.
- Own workflow-level cancellation, timeout, and final outcome calculation.

Non-goals:

- No node execution inside the orchestrator process.
- No client-coupled streaming logic.

### 3. Node executor workers

Responsibilities:

- Atomically claim one queued node.
- Build the exact materialized input object for the node attempt.
- Persist the materialized input before execution.
- Execute the node with a single `AbortSignal` propagated end-to-end.
- Persist output or error before marking the attempt terminal.
- Emit authoritative run events from durable writes.
- Refuse late writes after cancellation, timeout, or superseding attempt state.

### 4. Event/state projection layer

Responsibilities:

- Stream persisted events via SSE.
- Rebuild authoritative run views from `compiled snapshot + run rows + event log`.
- Support reconnect by sequence number.
- Power the execution viewer without client-side step inference.

## B. New Domain Model and TypeScript Types

The new foundational types are implemented in:

- `src/server/flow-v2/types.ts`
- `src/server/flow-v2/specs.ts`
- `src/server/flow-v2/compiler.ts`
- `src/server/flow-v2/outcome.ts`

Key design choices:

- `WorkflowDefinition` is authoring input.
- `CompiledWorkflowDefinition` is execution input.
- Every compiled node has resolved input and output ports.
- Every run freezes a full compiled snapshot.
- Every node attempt is a first-class record.
- Workflow outcome is separate from node-level failure.

Example interfaces:

```ts
export interface WorkflowDefinition {
  workflowId?: string;
  versionId?: string | null;
  builderVersion?: string | null;
  nodes: WorkflowDefinitionNode[];
  edges: WorkflowDefinitionEdge[];
}

export interface CompiledWorkflowDefinition {
  workflowId?: string;
  versionId?: string | null;
  snapshotHash: string;
  compiledAt: string;
  nodes: CompiledNode[];
  edges: CompiledEdge[];
  topoOrder: string[];
  entryNodeIds: string[];
  terminalNodeIds: string[];
  dependencyMap: Record<string, string[]>;
  downstreamMap: Record<string, string[]>;
}
```

```ts
export interface MaterializedNodeInput {
  runId: string;
  nodeId: string;
  specId: string;
  attemptNumber: number;
  config: Record<string, SerializableValue>;
  portValues: Record<string, SerializableValue>;
  sourceValues: MaterializedNodeInputPortValue[];
}
```

```ts
export interface WorkflowRunNodeAttempt {
  id: string;
  runId: string;
  runNodeId: string;
  nodeId: string;
  attemptNumber: number;
  status: "running" | "completed" | "failed" | "timed_out" | "cancelled";
  materializedInput: PayloadReference | null;
  outputPayload: PayloadReference | null;
  errorPayload: PayloadReference | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  workerId: string | null;
}
```

Outcome semantics:

- `completed`: workflow reached its terminal outputs without execution failures that matter to outcome.
- `completed_with_errors`: workflow produced a usable terminal output, but at least one other node failed or timed out.
- `failed`: workflow did not produce a valid successful terminal result.
- `cancelled`: workflow termination was initiated by user or system cancellation.

## C. Database Schema Changes

Additive migration is implemented in:

- `supabase/migrations/20260327000000_workflow_execution_v2.sql`

Principles:

- Reuse `workflow_runs` and `workflow_run_nodes` with additive columns so rollout can happen without breaking existing reads immediately.
- Add new tables for attempts, events, and large payload references.
- Keep small, query-critical state in-row.
- Move large payloads behind references.

### `workflow_runs`

Keep in-row:

- `status`
- `outcome`
- `workflow_id`
- `workflow_version_id`
- `compiled_workflow_hash`
- `last_event_sequence`
- `cancel_requested_at`
- `cancelled_at`
- `finalized_at`
- `started_at`
- `completed_at`
- `duration_ms`

Store in JSONB in-row:

- `compiled_workflow_snapshot`
- `run_input`
- `final_output`
- `metadata`

Why in-row:

- The compiled snapshot must be immutable and quickly available to the viewer.
- Run header and viewer bootstrap should not require joining payload tables for basic rendering.

### `workflow_run_nodes`

Keep one durable row per compiled node per run.

Keep in-row:

- `workflow_run_id`
- `node_id`
- `spec_id`
- `topo_index`
- `status`
- `failure_policy`
- `latest_attempt_number`
- `queued_at`
- `started_at`
- `ended_at`
- `terminal_attempt_id`
- `is_terminal_node`

Keep payload refs in-row:

- `input_payload_ref`
- `output_payload_ref`
- `error_payload_ref`

### `workflow_run_node_attempts`

New table:

- One row per attempt.
- Durable materialized input reference.
- Durable output/error reference.
- Worker ownership and timings.

### `workflow_run_events`

New append-only event log:

- `workflow_run_id`
- `sequence`
- `event_type`
- `node_id`
- `attempt_number`
- `payload`
- `created_at`

Constraints:

- Unique `(workflow_run_id, sequence)`
- Index on `(workflow_run_id, sequence)`

### `workflow_payload_blobs`

Optional payload indirection table for large objects:

- `payload_json`
- `storage_bucket`
- `storage_object_path`
- `payload_kind`
- `content_type`
- `byte_size`
- `sha256`

Recommended storage policy:

- In-row JSON for small run header state and compiled snapshots.
- Payload reference for materialized inputs, large outputs, detailed errors, and verbose logs.
- Object storage only when payload size becomes too large for comfortable JSONB usage.

## D. Graph Compiler Design

The new compiler is implemented in:

- `src/server/flow-v2/compiler.ts`
- `src/server/flow-v2/specs.ts`

Tests:

- `src/server/flow-v2/compiler.test.ts`

Compiler pipeline:

1. Normalize builder graph.
2. Canonicalize spec ids.
3. Validate unique node ids and edge ids.
4. Resolve explicit source and target ports.
5. Validate source and target node existence.
6. Validate port compatibility.
7. Reject implicit fan-in on a single port.
8. Validate required inputs with explicit per-spec rules.
9. Compute deterministic topo order using lexicographically stable ready queues.
10. Compute dependency and downstream maps.
11. Mark entry and terminal nodes.
12. Produce immutable compiled snapshot and snapshot hash.

Important properties:

- No runtime dependence on raw edge insertion order.
- No implicit merge behavior.
- No default port guessing when a node exposes multiple ports.
- Alias specs such as `openai-chat` compile into canonical executable specs.

Primary compiler API:

```ts
export function compileWorkflowDefinition(
  definition: WorkflowDefinition,
): CompiledWorkflowDefinition

export function compileBuilderGraph(params: {
  workflowId?: string;
  versionId?: string | null;
  builderVersion?: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}): CompiledWorkflowDefinition
```

## E. Run Orchestrator Design

This layer should be implemented next. It should not run in the API request.

Recommended server modules:

- `src/server/flow-v2/orchestrator.ts`
- `src/server/flow-v2/repository.ts`
- `src/server/flow-v2/queue.ts`

Primary responsibilities:

- `createRun(compiledSnapshot, runInput, metadata)`
- `initializeRunNodes(runId, compiledSnapshot.nodes)`
- `markEntryNodesReady(runId)`
- `enqueueReadyNodes(runId)`
- `onNodeAttemptTerminal(runId, nodeId, attemptId)`
- `requestCancellation(runId)`
- `finalizeRun(runId, outcome)`

Recommended signatures:

```ts
export interface RunOrchestrator {
  createRun(params: {
    workflowId?: string;
    workflowVersionId?: string | null;
    compiled: CompiledWorkflowDefinition;
    runInput: Record<string, SerializableValue>;
    metadata: Record<string, SerializableValue>;
  }): Promise<WorkflowRun>;

  requestCancellation(runId: string, reason?: string): Promise<void>;
}
```

Outcome rule:

- If run is cancelled -> `cancelled`
- Else if no successful terminal node exists and a terminal path failed -> `failed`
- Else if at least one successful terminal node exists and any node failed/timed out -> `completed_with_errors`
- Else -> `completed`

The initial outcome helper exists in `src/server/flow-v2/outcome.ts`.

## F. Node Executor Worker Design

This is the worker contract the new runtime should satisfy.

Recommended server modules:

- `src/server/flow-v2/node-worker.ts`
- `src/server/flow-v2/node-executor.ts`
- `src/server/flow-v2/payload-store.ts`
- `src/server/flow-v2/attempt-guard.ts`

Worker flow:

1. Claim one queued node row atomically.
2. Create attempt row with `status = running`.
3. Load compiled node definition from the frozen run snapshot.
4. Materialize node input from:
   - workflow run inputs
   - upstream node outputs
   - node config
5. Persist materialized input.
6. Execute node with a single `AbortSignal`.
7. Persist output or error payload.
8. Mark attempt terminal.
9. Mark run-node terminal or retry-scheduled.
10. Emit persisted event rows.

Critical worker rules:

- Do not read transient in-memory upstream state.
- Do not let handlers mutate shared run state directly.
- Do not let a timed-out attempt write after the orchestrator already moved on.
- Use compare-and-set style state guards on attempt and run-node updates.

Recommended node executor signature:

```ts
export interface NodeExecutor {
  execute(params: {
    compiledNode: CompiledNode;
    input: MaterializedNodeInput;
    signal: AbortSignal;
  }): Promise<NodeExecutionResult>;
}
```

### Legacy node handler adaptation

The existing handlers in `src/server/nodes/handlers.ts` are still useful logic, but they are not yet suitable as-is because:

- they pull inbound data implicitly through `getInboundValues`
- they own their own timeout logic
- they do not consume a caller-owned `AbortSignal`
- they write state through mutable callbacks

Those handlers should be wrapped or rewritten behind the new `NodeExecutor` contract. Reuse the business logic, not the execution model.

## G. Event Streaming Design

New endpoint:

- `GET /api/runs/:runId/stream`

Streaming contract:

- SSE sourced from persisted `workflow_run_events`
- sequence number is authoritative
- resume supported through `Last-Event-ID` or `?since=`
- polling fallback from the same event store

Recommended event payload:

```ts
type StreamEvent = {
  id: string; // same as sequence
  event: string;
  data: RunEvent;
}
```

Server behavior:

- On connect, send a bootstrap snapshot:
  - compiled snapshot
  - current run row
  - current run-node rows
  - events after requested sequence
- Then stream newly persisted events in order.
- Never derive fake future steps.

Fallback endpoint:

- `GET /api/runs/:runId/events?afterSequence=123`

## H. Execution Viewer UI Redesign

Current viewer problems that should be removed:

- DFS-derived ordering from client graph edges
- next-step guessing
- missing-node behavior when the client reconstructs state imperfectly
- `Object.entries` ordering dependence

New viewer data model:

- compiled snapshot provides deterministic node list and topo order
- run row provides status header and workflow outcome
- run-node rows provide per-node truth
- run events provide live activity timeline

Recommended client modules:

- `src/components/builder/ExecutionViewerV2.tsx`
- `src/components/builder/ExecutionNodeList.tsx`
- `src/components/builder/ExecutionTimeline.tsx`
- `src/components/builder/ExecutionNodeDrawer.tsx`
- `src/lib/workflow/run-stream-client.ts`

Viewer sections:

- Run status header
- Deterministic node list in compiled topo order
- Live activity timeline
- Node detail drawer
- Final outputs section

Node detail drawer should show:

- materialized input
- config
- output
- logs
- timings
- retries
- errors

## I. Migration Plan From Old Runner To New Runner

Safe migration path:

### Reuse

- Existing node business logic from `src/server/nodes/handlers.ts`
- Existing workflow version pinning in `workflow_versions`
- Existing auth, entitlement, and marketplace graph loading logic
- Existing run analytics table `runs`

### Deprecate

- `src/server/flow/engine.ts`
- request-bound NDJSON streaming from `POST /api/flow/run`
- viewer-side execution order reconstruction in `PremiumWorkflowRunModal`
- end-of-run-only persistence as the source of truth

### Rollout plan

1. Add compiler and new schema first.
2. Start compiling published workflows at run creation time.
3. Write new `workflow_runs` columns and attempts/events in shadow mode.
4. Build new SSE stream endpoint and viewer against persisted data.
5. Move execution to worker-owned orchestrator behind a feature flag.
6. Keep legacy runner available only for pre-existing in-flight or explicitly flagged runs.
7. Cut traffic by cohort:
   - builder internal runs
   - admin/demo runs
   - marketplace runs
8. Remove legacy request execution after confidence is high.

### Feature flag

Recommended flags:

- `workflow_execution_v2_compile`
- `workflow_execution_v2_orchestrator`
- `workflow_execution_v2_streaming`
- `workflow_execution_v2_viewer`

## J. Concrete Implementation Steps In Repo Order

### Files created in this phase

- `src/server/flow-v2/types.ts`
- `src/server/flow-v2/specs.ts`
- `src/server/flow-v2/compiler.ts`
- `src/server/flow-v2/outcome.ts`
- `src/server/flow-v2/compiler.test.ts`
- `supabase/migrations/20260327000000_workflow_execution_v2.sql`
- `docs/workflow-execution-redesign.md`

### Files to modify next

1. `src/app/api/flow/run/route.ts`
   - stop executing inline
   - compile and persist snapshot
   - create run
   - enqueue orchestrator job
2. `src/lib/supabase/executions.ts`
   - support new run fields
3. `src/lib/supabase/workflow-run-nodes.ts`
   - replace insert-only summary writes with durable upserts
4. `src/server/nodes/handlers.ts`
   - adapt handlers to caller-owned cancellation and materialized inputs
5. `src/components/builder/PremiumWorkflowRunModal.tsx`
   - stop inferring execution order
   - render from compiled snapshot + run node state + events

### What to move out of the old engine

- topo sorting
- readiness gating
- retry accounting
- node trace bookkeeping
- progress event emission
- workflow outcome resolution

These belong in the compiler, orchestrator, worker, and event log respectively.

### What to delete later

- `src/server/flow/engine.ts`
- request NDJSON execution streaming in `src/app/api/flow/run/route.ts`
- unused `src/lib/workflow/execution-manager.ts`
- client-side guessed step ordering in `PremiumWorkflowRunModal`

### Tests to write

Compiler:

- deterministic topo order
- missing port ids on multi-port nodes
- cycle detection
- incompatible port bindings
- missing required inputs
- canonical alias compilation

Orchestrator:

- entry node initialization
- deterministic enqueue order
- downstream readiness after success
- downstream blocking after failure policy
- late write protection after cancellation
- workflow outcome correctness

Worker:

- attempt claim atomicity
- persisted materialized input
- retry scheduling
- timeout to cancelled/timed_out transition
- abort propagation
- no late output after terminal guard

Streaming:

- SSE bootstrap
- reconnect after sequence
- ordered delivery
- polling parity with stream

Viewer:

- renders all compiled nodes in topo order
- no missing nodes during reconnect
- node drawer shows authoritative materialized input and retries

## Recommended Implementation Order

1. Compiler and immutable compiled snapshot contract.
2. Schema migration for attempts, events, and payload refs.
3. Run repository and orchestrator state transitions.
4. Worker claim/execute/finalize loop.
5. SSE event stream backed by persisted events.
6. New execution viewer.
7. Legacy route cutover behind flags.

## Highest-Risk Migration Areas

- Adapting current node handlers to caller-owned `AbortSignal`
- Preserving marketplace entitlement and free-run logic while moving execution off-request
- Converting `workflow_run_nodes` from post-hoc traces into live durable node state
- Replacing the viewer without breaking builder and marketplace surfaces simultaneously
- Preventing double execution during mixed legacy/v2 rollout

## The First File To Build Right Now

`src/server/flow-v2/compiler.ts`

Reason:

- It is the hard boundary between unsafe builder JSON and executable server truth.
- Every other layer depends on the compiled snapshot contract.
- It forces port mapping, deterministic order, and validation decisions up front instead of leaking them into runtime.

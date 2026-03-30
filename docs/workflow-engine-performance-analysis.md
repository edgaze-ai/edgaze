# Workflow execution engine — performance analysis

This document maps the **actual** server-side execution paths in this repo, lists **proven** hot-path costs (from reading the code), and describes **instrumentation** added to measure wall time in production-like runs.

**Scope:** When `WORKFLOW_EXECUTION_V2_RUNNER=true`, runs go through `src/server/flow-v2/*` (orchestrator → Supabase rows → worker loop → node worker → legacy handlers). When it is **false**, runs use `runFlow` in `src/server/flow/engine.ts` (in-memory state, no per-node Supabase event stream in that path).

**What is not proven here:** Exact percentages of total non-model latency, or average/worst-case milliseconds in your deployment. Those require traces with `WORKFLOW_ENGINE_PERF_LOG=1` (or APM) against your Supabase region and graph sizes. This document proves **where** time can go and **which patterns are serial or repeat per round-trip**.

---

## A. Execution path map (V2 runner — primary suspect for “engine latency”)

### 1. Request entry

- **`POST /api/flow/run`** (`src/app/api/flow/run/route.ts`)
  - Auth, rate limits, graph compile when `WORKFLOW_EXECUTION_V2_COMPILE` is on (`compileBuilderGraph`).
  - **`WorkflowRunOrchestrator.initializeRun`**: `freezeCompiledSnapshot` + `initializeRunNodes` + `appendRunEvents` (multiple Supabase writes).
  - If V2 runner enabled: **`ensureWorkflowRunWorker`** starts **`runWorkflowToTerminal`** in-process (same Node instance only; see comment in `worker-service.ts` about serverless multi-instance).

### 2. Runner loop (per “iteration” until terminal)

- **`runWorkflowToTerminal`** (`src/server/flow-v2/worker-runner.ts`)
  - Calls **`processNextRunnableBatch`** repeatedly.
  - On **idle** (no claimable work): **`waitWithAbort(idleBackoffMs)`** — default **50 ms** sleep, up to **`maxConsecutiveIdleCycles` (default 3)** before **`WorkflowRunnerStalledError`**.
  - Non-model latency from idle backoff alone can be **~150 ms+** if the worker hits repeated idle cycles (contention, cross-instance split, or scheduling gaps).

### 3. One batch (`processNextRunnableBatch`)

Order in `src/server/flow-v2/worker-loop.ts`:

1. **`getRunState`** — Supabase `select` of **`compiled_workflow_snapshot`** (full JSON graph) + status fields.
2. **Claim loop** — up to `maxConcurrent` times:
   - **`claimNextRunnableNode`** — RPC `claim_workflow_run_node_attempt` **plus** a **second query** that loads **`compiled_workflow_snapshot` again** from `workflow_runs` to resolve `compiledNode` for the claimed row.
3. If no work: **`listRunNodes`** + **`finalizeRunIfTerminal`** (may return idle/finalized).
4. For each claimed node (sequential): **`appendNodeStartedEvents`** → **two** **`appendRunEvent`** RPCs each (`node.started`, `node_attempt_started`).
5. **`Promise.all`** over **`executeClaimedNodeWithLeaseHeartbeat`** (parallel across claimed nodes).
6. Sort completed work by topo index (in-memory).
7. **Sequential** **`applyTerminalNodeEffects`** per completed node (many **`appendRunEvent`** calls and conditional bulk status updates).
8. **`listRunNodes`** again.
9. **`reevaluateNodeTransitions`** (see below).
10. **`finalizeRunIfTerminal`**.

### 4. Per node (`executeClaimedNode` — `src/server/flow-v2/node-worker.ts`)

1. **`loadRunInput`** — `select run_input` from `workflow_runs`.
2. **`loadUpstreamOutputs`** — `select` outputs for dependency node ids.
3. **`materializeNodeInput`** — **pure synchronous** merge/bind (`src/server/flow-v2/materializer.ts`): sorts sources, walks bindings, **`readPayloadReferenceValue`** (no I/O).
4. **`createInlinePayloadReference`** on the full materialized input — **`JSON.stringify` + SHA-256** of the payload (`src/server/flow-v2/payload-store.ts`). This is **CPU + allocation** proportional to input size.
5. **`persistAttemptMaterializedInput`** — **two** `update` queries (attempt + node).
6. Optional **`appendRunEvent`** (`node_materialized_input`).
7. **`executor.execute`** → **`LegacyNodeExecutorAdapter`** (`src/server/flow-v2/node-executor.ts`) → **`runtimeRegistry` handler** — **this await is where model / external API time lives** (instrumented as `node.handler.external`).
8. Streaming callbacks may call **`appendRunEvent`** on a **~80 ms** cadence for deltas (`flushStreamDelta`).
9. **`createInlinePayloadReference`** again for outputs/errors (again **stringify + hash**).
10. **`persistAttemptResult`** — **two** `update` queries.

### 5. Downstream readiness (`reevaluateNodeTransitions`)

- **Synchronous** full scan of **`compiled.nodes`** to classify transitions (`reevaluate.planTransitions_sync`).
- Then **up to four** `updateNodeStatuses` batches.
- For **each** node that changed status, **one** **`appendRunEvent`** **awaited sequentially** in a `for` loop (ready, blocked, skipped, cancelled). **K status changes ⇒ K sequential RPCs** in the worst case.

### 6. Client streaming (does not block the worker)

- NDJSON stream path **`pollNdjsonLoop`** uses **`setTimeout(250)`** between polls (`src/app/api/flow/run/route.ts`). That affects **client-visible update granularity**, not the worker loop (worker runs in parallel via **`Promise.all([pollNdjsonLoop(), runnerPromise])`**).

---

## B. Hot path function list (V2)

| Function / phase | Sync / async | Repeated | Blocking I/O | Notes |
|------------------|--------------|----------|--------------|--------|
| `compileBuilderGraph` | sync (+ DB before/after in route) | Once per request | Compile only sync | Writes snapshot when orchestrator runs |
| `WorkflowRunOrchestrator.initializeRun` | async | Once | **Yes** — multiple writes | `freezeCompiledSnapshot`, `initializeRunNodes`, `appendRunEvents` |
| `SupabaseWorkflowExecutionRepository.initializeRunNodes` | async | Once | **Yes** | **Per existing node**, **sequential** `update` in a `for` loop |
| `runWorkflowToTerminal` | async | — | Sleep on idle | `waitWithAbort(50ms)` default |
| `processNextRunnableBatch` | async | Per iteration | **Yes** | `getRunState`, claims, lists, events |
| `getRunState` | async | **Every batch** | **Yes** | Fetches **full** `compiled_workflow_snapshot` |
| `claimNextRunnableNode` | async | Up to `maxConcurrent` × iterations | **Yes** | RPC + **second** fetch of **full** snapshot |
| `appendNodeStartedEvents` | async | Per claimed node | **Yes** | **2×** `appendRun_event` per node **sequential** across nodes |
| `executeClaimedNode` | async | Per node execution | **Yes** | Multiple selects/updates + handler |
| `materializeNodeInput` | **sync** | Per node | No | Cheap unless upstream values are huge in memory |
| `createInlinePayloadReference` | **sync** | **≥2× per node** | No | **JSON.stringify + sha256** — can dominate CPU for large objects |
| `LegacyNodeExecutorAdapter.execute` | async | Per node | **Yes** (handler) | `node.handler.external` span |
| `applyTerminalNodeEffects` | async | Per completed node | **Yes** | **Many** sequential `appendRunEvent` |
| `reevaluateNodeTransitions` | async | **Every batch** | **Yes** | Full graph scan + **serial** event inserts per changed node |
| `listRunNodes` | async | Idle + after each batch | **Yes** | Full row set for run |
| `finalizeRunIfTerminal` | async | When graph may be done | **Yes** | `finalizeRun` + `run.completed` event |
| `renewAttemptLease` | async | **Heartbeat** | **Yes** | `setInterval` default **10 s** (min 1 s) |

---

## C. Timing breakdown (instrumentation)

### How to enable

Set **`WORKFLOW_ENGINE_PERF_LOG=1`** (or `true` / `yes` / `on`) in the **server** environment.

### Implementation

- **`src/server/flow-v2/engine-perf.ts`** — `perfAsync` / `perfSync` using **`performance.now()`**, per-run aggregation, JSON lines to stdout.
- **`src/server/flow-v2/worker-runner.ts`** — resets totals at run start; logs **`workflow_engine_perf_totals`** on terminal success, stall, or iteration limit; wraps **`runner.idleBackoff_wait`**.
- **`src/server/flow-v2/worker-loop.ts`** — batch phases (`batch.*`), reevaluate sub-phases (`reevaluate.*`).
- **`src/server/flow-v2/node-worker.ts`** — `node.loadRunInput`, `node.materializeNodeInput`, `serialization.inlinePayload.*`, `node.persist*`, stream emit phases.
- **`src/server/flow-v2/node-executor.ts`** — **`node.handler.external`** (tagged as including model/API), plus micro-phases for inbound mapping / runInput spread / output mapping.

### Log shape

- Each span: `{"tag":"workflow_engine_perf","runId","phase","ms",...}`
- End of run rollup: `{"tag":"workflow_engine_perf_totals","runId","label","grandMs","phases":{...}}`

### Current analysis workflow

1. Enable `WORKFLOW_ENGINE_PERF_LOG=1`.
2. Run one or more workflows in the target environment.
3. Capture server stdout/stderr to a file.
4. Generate a ranked markdown report:

```bash
node scripts/analyze-workflow-engine-perf.mjs /path/to/workflow-engine.log
```

This parser groups:

- per-run engine vs external/model wall time
- top engine phases by cumulative non-model cost
- top node overheads from span metadata
- raw totals rows for direct inspection

### Separating model vs engine (per node)

From logs:

- **External / model wall:** sum of **`node.handler.external`** for that node (still includes any sync work inside the handler before the first await to OpenAI, etc. — **true provider RTT is only knowable inside the HTTP client**).
- **Engine around handler:**  
  **`node.loadRunInput` + `node.loadUpstreamOutputs` + `node.materializeNodeInput` + `serialization.inlinePayload.input` + `node.persistAttemptMaterializedInput` + stream DB emits + `serialization.inlinePayload.output|error` + `node.persistAttemptResult` + batch-level `appendNodeStartedEvents` / `applyTerminalNodeEffects` / `reevaluate.*` amortized per node.**

---

## D. Proven bottlenecks (code-backed)

These are **not** guesses; they follow directly from control flow and I/O patterns.

1. **Repeated fetch of the full compiled workflow JSON**  
   - `getRunState` loads `compiled_workflow_snapshot` **every batch iteration**.  
   - **`claimNextRunnableNode` loads it again after every successful claim.**  
   - **Impact:** Large graphs + high-latency DB ⇒ **tens to hundreds of ms per iteration** before any node work, scaling with payload size and round-trips.

2. **Event journal: many sequential `append_workflow_run_event` RPCs**  
   - Started events: **2 per node**, **sequential** over the batch.  
   - Terminal effects: **multiple events per node**, sequential.  
   - Reevaluate: **one RPC per transitioned node**, sequential `for` loops.  
   - **Impact:** If each RPC is **5–30 ms**, **10+ events per node** can **alone** explain **seconds** of non-model time on a small workflow.

3. **`createInlinePayloadReference` on large structures**  
   - Full **`JSON.stringify` + SHA-256** for materialized input and outputs.  
   - **Impact:** CPU and GC; for multi‑MB JSON this can be **very large** — users may perceive this as “merge/input resolution” taking forever if payloads are big (even though `materializeNodeInput` itself is cheap).

4. **Idle backoff + stall semantics**  
   - Default **50 ms** sleep when no node is claimable; **4 consecutive idles** ⇒ stall error.  
   - **Impact:** Adds latency under contention or when **no worker** is running on the instance that holds the in-memory runner (serverless caveat documented in `worker-service.ts`).

5. **Streaming delta flush policy**  
   - **`await` on DB append** inside streaming path, throttled to **≥80 ms** between flushes when deltas arrive.  
   - **Impact:** Does not usually add **40 s** by itself, but **couples stream persistence latency to the execution task** for streaming nodes.

6. **Orchestrator `initializeRunNodes` updates existing rows one-by-one**  
   - Sequential `update` per node when rows already exist.  
   - **Impact:** **N round-trips** at run start for **N** nodes.

### What we cannot prove without your traces

- Exact **average / worst-case** ms per phase in production.
- The **% contribution** of each phase to total non-model time.
- Whether a reported **“40 s input resolution”** was **V2** (`materializeNodeInput` + DB + serialization) or **legacy** `runFlow`, or **client-side** wait (polling / network), or **model** time mis-attributed.

---

## E. Suspected architectural flaws (structural)

1. **Using the database event log as the synchronous critical path for scheduling**  
   Readiness could be updated in fewer round-trips (batched event insert, or append-only log written **asynchronously** while state tables are updated in one transaction).

2. **Re-loading the entire compiled snapshot on every claim**  
   The claim RPC could return enough compiled node metadata (or a hash + server-side cache) to avoid **`select compiled_workflow_snapshot`** per claim.

3. **Full inline JSON + cryptographic hash for every payload**  
   For large outputs, **inline + sha256** on the hot path is expensive; storage-outside-row or lazy hashing would reduce engine time.

4. **Serial `appendRunEvent` loops**  
   Replacing **per-node sequential** appends with **batched inserts** (single RPC or multi-row insert) would cut round-trips dramatically.

5. **In-memory worker registry on serverless**  
   Documented risk: **POST** and **stream** may land on different instances → idle loops / stalled runs unless an external worker or `waitUntil`-style pinning is used.

---

## F. Fixes ranked by impact (post-diagnosis)

| Rank | Change | Why it matters | Est. non-model reduction | Reliability risk | Effort |
|------|--------|----------------|---------------------------|------------------|--------|
| 1 | Batch or defer run event writes; minimum: **multi-event insert** in one DB call after each phase | Cuts **sequential RPC** count (largest proven lever) | **High** (often **multi-second** on chatty graphs if RPC RTT is high) | Medium — consumers must tolerate batching / ordering guarantees | Medium |
| 2 | **Stop re-selecting `compiled_workflow_snapshot`** on every claim; cache per `runId` in process or return spec from RPC | Removes **1 large read per claimed node** | **High** on large snapshots | Low if cache invalidated on run completion | Small–medium |
| 3 | **Don’t call `getRunState` every iteration** if status can be inferred from cheaper queries | Removes **1 large read per batch** | Medium | Medium — need correct cancellation / status semantics | Medium |
| 4 | Replace **per-node sequential updates** in `initializeRunNodes` with **bulk upsert** | Faster cold start | Medium for wide graphs | Low | Small |
| 5 | **Offload or shrink `createInlinePayloadReference`** for large payloads (store blob, hash async) | Cuts CPU on big JSON | High **only** when payloads are large | Medium | Medium–large |
| 6 | Tune **`idleBackoffMs`** / idle stall policy for multi-instance (queue-based worker) | Avoid **artificial stalls** | Low–medium | High if mis-tuned | Architectural |

---

## G. Next instrumentation or refactor steps

1. Run a **small** (3-node) and **large** (20+ node) workflow with **`WORKFLOW_ENGINE_PERF_LOG=1`**; compare `workflow_engine_perf_totals` between them.
2. Add **Supabase statement timing** (logs or APM) for **`append_workflow_run_event`** and **`claim_workflow_run_node_attempt`**.
3. Log **`byteLength`** (already on inline payload refs) or payload size buckets to correlate **`serialization.inlinePayload.*`** with slow runs.
4. Confirm **`WORKFLOW_EXECUTION_V2_RUNNER`** value in the environment where “40s merge” was seen; if legacy, profile **`runFlow`** + **`ExecutionStateManager.setNodeOutput`** (full `outputsByNode` spread each update).

### Implemented low-risk reductions

- `src/lib/supabase/admin.ts`
  - Reuses a shared Supabase admin client instead of constructing a new client object on every repository call.
- `src/server/flow-v2/repository.ts`
  - Caches `compiled_workflow_snapshot` and `run_input` per `runId` inside the repository instance.
  - Uses cached compiled-node lookup to avoid repeated linear `nodes.find(...)` scans after claims.
  - Supports batched event appends via `appendRunEventsBatch` with fallback to the current single-event RPC if the new database helper is not available yet.
- `src/server/flow-v2/worker-loop.ts`
  - Coalesces start events and transition events into ordered batch appends rather than writing each one individually from application code.
- `src/server/flow-v2/node-worker.ts`
  - Enriches perf spans with `nodeId`, `attemptNumber`, `specId`, dependency counts, and payload size buckets so slow runs can be tied to actual payload size and node type.
- `src/server/flow-v2/node-executor.ts`
  - Adds a deterministic fast-local execution path for Edgaze-owned `input`, `merge`, and `output` nodes so they no longer pay the generic runtime-context setup path used by model-backed nodes.
- `src/server/flow-v2/node-worker.ts`
  - Persists compact materialized-input snapshots for `input`, `merge`, and `output` nodes, avoiding large duplicate value serialization inside `sources[].value`.
- `src/server/flow-v2/materializer.ts`
  - Groups source bindings by target port in one pass instead of re-filtering the full binding list for every input port.
- `supabase/migrations/20260330120000_workflow_execution_v2_append_batch_events.sql`
  - Adds `append_workflow_run_events(...)` for atomic multi-event insertion with deterministic sequence allocation.

---

## Legacy path note (`runFlow`)

When V2 runner is **off**, `src/server/flow/engine.ts` drives execution in memory:

- **`getInboundValues`** reads **`state.getSnapshot()`** and maps upstream outputs; **`coerceInbound`** may run per edge.
- **`setNodeOutput`** uses **`withUpdatedSnapshot`**, which **spreads the entire `outputsByNode` object** on every update (`src/server/flow/state-machine.ts`, `src/server/flow/execution-state.ts`). For large graphs / large outputs, that is **O(n)** copying per node completion **in process** — not DB, but still “engine merge” cost.

If your symptom is on this path, profile **`withUpdatedSnapshot` / `setNodeOutput`** frequency and payload sizes.

---

## Plain English verdict

**Why does the engine add latency without the model?**  
On the **V2** path, the implementation **does a large amount of synchronous work between nodes in the form of database round-trips** (loading the full compiled graph repeatedly, claiming work, persisting inputs/outputs, and **especially** writing **many** run events **one after another**). On top of that, **every** inline payload is **fully JSON-serialized and SHA-256 hashed**, which can dominate CPU when outputs or materialized inputs are large. None of that is “model time,” but it **is** billed to the same wall-clock as the run.

**Single highest-leverage fix first:**  
**Reduce sequential `appendRunEvent` / event-RPC chatter** (batch inserts or a single transactional write per phase, plus **eliminate the extra `compiled_workflow_snapshot` read on every claim**). Those two are structurally guaranteed to scale poorly with node count and network RTT, and they are visible directly in `repository.ts` and `worker-loop.ts`.

---

## Files touched for instrumentation

- `src/server/flow-v2/engine-perf.ts` (new)
- `src/server/flow-v2/worker-runner.ts`
- `src/server/flow-v2/worker-loop.ts`
- `src/server/flow-v2/node-worker.ts`
- `src/server/flow-v2/node-executor.ts`
- `.env.local.example` (document `WORKFLOW_ENGINE_PERF_LOG`)

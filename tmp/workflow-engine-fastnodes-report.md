# Workflow Engine Perf Report

Source: `tmp/workflow-engine-fastnodes.log`

## Run Summary

| Run | Engine (non-model) | External/model | Instrumented total |
|-----|--------------------:|---------------:|-------------------:|
| `run_test` | 70.31 ms | 20.37 ms | 90.92 ms |

## Top 10 Engine Phases

| Phase | Calls | Avg | Worst | Total | % non-model | Class |
|-------|------:|----:|------:|------:|------------:|-------|
| `batch.executeNodesParallel_withLease` | 5 | 10.51 ms | 47.05 ms | 52.55 ms | 74.7% | implementation |
| `node.materializeNodeInput` | 9 | 0.81 ms | 5.76 ms | 7.26 ms | 10.3% | implementation |
| `batch.sortCompletedWorkTopo` | 5 | 1.09 ms | 5.39 ms | 5.43 ms | 7.7% | implementation |
| `serialization.inlinePayload.input` | 9 | 0.14 ms | 0.44 ms | 1.22 ms | 1.7% | implementation |
| `node.persistAttemptMaterializedInput` | 9 | 0.06 ms | 0.18 ms | 0.50 ms | 0.7% | implementation |
| `node.persistAttemptResult` | 9 | 0.05 ms | 0.13 ms | 0.44 ms | 0.6% | implementation |
| `batch.claimNextRunnableNode` | 10 | 0.04 ms | 0.36 ms | 0.44 ms | 0.6% | architecture |
| `batch.applyTerminalNodeEffects_all` | 5 | 0.09 ms | 0.11 ms | 0.43 ms | 0.6% | implementation |
| `serialization.inlinePayload.output` | 9 | 0.03 ms | 0.17 ms | 0.28 ms | 0.4% | implementation |
| `batch.finalizeRunIfTerminal` | 5 | 0.05 ms | 0.12 ms | 0.26 ms | 0.4% | implementation |

## Top 10 Node Overheads

| Run | Node | Engine (non-model) | External/model | Instrumented total |
|-----|------|--------------------:|---------------:|-------------------:|
| `run_test` | `merge_a` | 5.88 ms | 0.00 ms | 5.98 ms |
| `run_test` | `input_a` | 3.28 ms | 0.00 ms | 3.42 ms |
| `run_test` | `in1` | 0.53 ms | 0.00 ms | 0.53 ms |
| `run_test` | `delay_a` | 0.34 ms | 20.37 ms | 20.70 ms |
| `run_test` | `in2` | 0.13 ms | 0.00 ms | 0.13 ms |
| `run_test` | `condition_a` | 0.06 ms | 0.00 ms | 0.06 ms |

## Raw Totals Rows

```json
[
  {
    "tag": "workflow_engine_perf_totals",
    "runId": "run_test",
    "label": "run_finalized",
    "grandMs": 5.38,
    "phases": {
      "batch.getRunState": {
        "sumMs": 0.03,
        "count": 1,
        "maxMs": 0.03,
        "avgMs": 0.03
      },
      "batch.claimNextRunnableNode": {
        "sumMs": 0.04,
        "count": 2,
        "maxMs": 0.03,
        "avgMs": 0.02
      },
      "batch.appendNodeStartedEvents_all": {
        "sumMs": 0.05,
        "count": 1,
        "maxMs": 0.05,
        "avgMs": 0.05
      },
      "node.loadRunInput": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "node.loadUpstreamOutputs": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "node.materializeNodeInput": {
        "sumMs": 1.3,
        "count": 1,
        "maxMs": 1.3,
        "avgMs": 1.3
      },
      "serialization.inlinePayload.input": {
        "sumMs": 0.44,
        "count": 1,
        "maxMs": 0.44,
        "avgMs": 0.44
      },
      "node.persistAttemptMaterializedInput": {
        "sumMs": 0.09,
        "count": 1,
        "maxMs": 0.09,
        "avgMs": 0.09
      },
      "node.streamEmit.node_materialized_input": {
        "sumMs": 0.03,
        "count": 1,
        "maxMs": 0.03,
        "avgMs": 0.03
      },
      "serialization.inlinePayload.output": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "serialization.inlinePayload.error": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "node.persistAttemptResult": {
        "sumMs": 0.05,
        "count": 1,
        "maxMs": 0.05,
        "avgMs": 0.05
      },
      "batch.executeNodesParallel_withLease": {
        "sumMs": 2.92,
        "count": 1,
        "maxMs": 2.92,
        "avgMs": 2.92
      },
      "batch.sortCompletedWorkTopo": {
        "sumMs": 0.02,
        "count": 1,
        "maxMs": 0.02,
        "avgMs": 0.02
      },
      "batch.applyTerminalNodeEffects_all": {
        "sumMs": 0.11,
        "count": 1,
        "maxMs": 0.11,
        "avgMs": 0.11
      },
      "batch.listRunNodes_beforeReevaluate": {
        "sumMs": 0.03,
        "count": 1,
        "maxMs": 0.03,
        "avgMs": 0.03
      },
      "reevaluate.planTransitions_sync": {
        "sumMs": 0.04,
        "count": 1,
        "maxMs": 0.04,
        "avgMs": 0.04
      },
      "reevaluate.db.updateNodeStatuses.ready": {
        "sumMs": 0.03,
        "count": 1,
        "maxMs": 0.03,
        "avgMs": 0.03
      },
      "reevaluate.db.appendRunEvents.ready": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "reevaluate.db.updateNodeStatuses.blocked": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "reevaluate.db.appendRunEvents.blocked": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "reevaluate.db.updateNodeStatuses.skipped": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "reevaluate.db.appendRunEvents.skipped": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "reevaluate.db.updateNodeStatuses.cancelled": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "reevaluate.db.appendRunEvents.cancelled": {
        "sumMs": 0.01,
        "count": 1,
        "maxMs": 0.01,
        "avgMs": 0.01
      },
      "batch.finalizeRunIfTerminal": {
        "sumMs": 0.12,
        "count": 1,
        "maxMs": 0.12,
        "avgMs": 0.12
      }
    }
  },
  {
    "tag": "workflow_engine_perf_totals",
    "runId": "run_test",
    "label": "runner_stalled_idle",
    "grandMs": 0.21,
    "phases": {
      "batch.getRunState": {
        "sumMs": 0.15,
        "count": 2,
        "maxMs": 0.15,
        "avgMs": 0.08
      },
      "batch.claimNextRunnableNode": {
        "sumMs": 0.01,
        "count": 2,
        "maxMs": 0.01,
        "avgMs": 0
      },
      "batch.idle.listRunNodes": {
        "sumMs": 0.01,
        "count": 2,
        "maxMs": 0.01,
        "avgMs": 0
      },
      "batch.idle.finalizeRunIfTerminal": {
        "sumMs": 0.02,
        "count": 2,
        "maxMs": 0.02,
        "avgMs": 0.01
      },
      "runner.idleBackoff_wait": {
        "sumMs": 0.02,
        "count": 1,
        "maxMs": 0.02,
        "avgMs": 0.02
      }
    }
  }
]
```

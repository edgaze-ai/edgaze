# Workflow Engine Perf Report

Source: `tmp/workflow-engine-perf.log`

## Run Summary

| Run        | Engine (non-model) | External/model | Instrumented total |
| ---------- | -----------------: | -------------: | -----------------: |
| `run_test` |           60.29 ms |       20.12 ms |           80.40 ms |

## Top 10 Engine Phases

| Phase                                  | Calls |      Avg |    Worst |    Total | % non-model | Class          |
| -------------------------------------- | ----: | -------: | -------: | -------: | ----------: | -------------- |
| `batch.executeNodesParallel_withLease` |     5 | 10.14 ms | 47.42 ms | 50.72 ms |       84.1% | implementation |
| `batch.sortCompletedWorkTopo`          |     5 |  1.05 ms |  5.20 ms |  5.24 ms |        8.7% | implementation |
| `serialization.inlinePayload.input`    |     8 |  0.09 ms |  0.20 ms |  0.75 ms |        1.2% | implementation |
| `batch.claimNextRunnableNode`          |    10 |  0.04 ms |  0.33 ms |  0.40 ms |        0.7% | architecture   |
| `batch.applyTerminalNodeEffects_all`   |     5 |  0.08 ms |  0.10 ms |  0.40 ms |        0.7% | implementation |
| `node.persistAttemptMaterializedInput` |     8 |  0.05 ms |  0.12 ms |  0.37 ms |        0.6% | implementation |
| `node.persistAttemptResult`            |     8 |  0.04 ms |  0.06 ms |  0.30 ms |        0.5% | implementation |
| `node.materializeNodeInput`            |     8 |  0.04 ms |  0.10 ms |  0.29 ms |        0.5% | implementation |
| `batch.finalizeRunIfTerminal`          |     5 |  0.05 ms |  0.11 ms |  0.25 ms |        0.4% | implementation |
| `reevaluate.planTransitions_sync`      |     5 |  0.05 ms |  0.11 ms |  0.23 ms |        0.4% | architecture   |

## Top 10 Node Overheads

| Run        | Node          | Engine (non-model) | External/model | Instrumented total |
| ---------- | ------------- | -----------------: | -------------: | -----------------: |
| `run_test` | `input_a`     |            1.38 ms |        0.16 ms |            1.54 ms |
| `run_test` | `delay_a`     |            0.46 ms |       19.96 ms |           20.42 ms |
| `run_test` | `in1`         |            0.35 ms |        0.00 ms |            0.35 ms |
| `run_test` | `in2`         |            0.11 ms |        0.00 ms |            0.11 ms |
| `run_test` | `condition_a` |            0.06 ms |        0.00 ms |            0.06 ms |

## Raw Totals Rows

```json
[
  {
    "tag": "workflow_engine_perf_totals",
    "runId": "run_test",
    "label": "run_finalized",
    "grandMs": 2.11,
    "phases": {
      "batch.getRunState": {
        "sumMs": 0.02,
        "count": 1,
        "maxMs": 0.02,
        "avgMs": 0.02
      },
      "batch.claimNextRunnableNode": {
        "sumMs": 0.03,
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
        "sumMs": 0.1,
        "count": 1,
        "maxMs": 0.1,
        "avgMs": 0.1
      },
      "serialization.inlinePayload.input": {
        "sumMs": 0.19,
        "count": 1,
        "maxMs": 0.19,
        "avgMs": 0.19
      },
      "node.persistAttemptMaterializedInput": {
        "sumMs": 0.04,
        "count": 1,
        "maxMs": 0.04,
        "avgMs": 0.04
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
        "sumMs": 0.04,
        "count": 1,
        "maxMs": 0.04,
        "avgMs": 0.04
      },
      "batch.executeNodesParallel_withLease": {
        "sumMs": 1.2,
        "count": 1,
        "maxMs": 1.2,
        "avgMs": 1.2
      },
      "batch.sortCompletedWorkTopo": {
        "sumMs": 0.02,
        "count": 1,
        "maxMs": 0.02,
        "avgMs": 0.02
      },
      "batch.applyTerminalNodeEffects_all": {
        "sumMs": 0.1,
        "count": 1,
        "maxMs": 0.1,
        "avgMs": 0.1
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
        "sumMs": 0.11,
        "count": 1,
        "maxMs": 0.11,
        "avgMs": 0.11
      }
    }
  },
  {
    "tag": "workflow_engine_perf_totals",
    "runId": "run_test",
    "label": "runner_stalled_idle",
    "grandMs": 0.22,
    "phases": {
      "batch.getRunState": {
        "sumMs": 0.17,
        "count": 2,
        "maxMs": 0.17,
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

title = "Workflow Run Policy"
description = "Hosted runs, consumption rules, and options after runs are used"

---

## 1. Included Hosted Runs

*Last Updated: March 13, 2026*

Each workflow purchase includes a limited number of **hosted executions** provided by Edgaze infrastructure. These runs use Edgaze compute and orchestration services.

| Creator Type | Included Runs per Purchase |
|--------------|----------------------------|
| Free creators | 10 hosted runs |
| Plus creators | 15 hosted runs |

---

## 2. What Counts as One Run

A **workflow run** is counted when execution **begins**. One run may include:

- Prompt execution
- Multiple model calls
- Tool usage
- External API calls

Regardless of complexity, each execution counts as **one run**.

Runs are **not** counted if execution fails before starting (e.g., validation errors, connection failures before the workflow runs).

---

## 3. Hosted vs. Self-Served

**Hosted runs** — Executed on Edgaze infrastructure. API and model costs are covered by Edgaze. The customer uses their included runs.

**BYOK (Bring Your Own Key)** — The customer connects their own API keys. API costs are billed directly by the provider. Edgaze handles orchestration only. Runs in BYOK mode may be subject to different limits.

---

## 4. After Runs Are Used

When included hosted runs are exhausted, customers have options:

### 4.1 Option 1 — Buy Additional Hosted Runs

Customers can purchase additional runs directly through Edgaze. These runs execute on Edgaze infrastructure and are billed at Edgaze's additional run pricing.

### 4.2 Option 2 — BYOK (Bring Your Own Key)

Customers connect their own API keys for supported providers (OpenAI, Anthropic, Replicate, Stability, and others). In this mode:

- API costs are billed directly by the provider
- Edgaze only handles orchestration
- Customers may continue running workflows without additional run purchases

### 4.3 Option 3 — Usage-Based Billing (Future)

Edgaze may introduce usage-based billing where customers pay based on compute usage, API calls, and runtime resources. This option is planned for future releases.

---

## 5. Creator Pricing Considerations

Creators should price workflows considering:

- Included runs and infrastructure cost
- The [Infrastructure Cost Estimation](/docs/infrastructure-cost-estimation) shown at publish time
- The Edgaze marketplace fee (20%)
- Their desired profit margin

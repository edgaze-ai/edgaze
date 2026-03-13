title = "Infrastructure Cost Estimation"
description = "How Edgaze estimates workflow execution costs during publishing"

---

## 1. Overview

*Last Updated: March 13, 2026*

During workflow publishing, Edgaze estimates the cost of executing the workflow. This estimate is shown to creators **before** they publish, so they can price products appropriately.

---

## 2. What the Estimate Includes

The estimate accounts for:

- **API calls** — Model API usage (OpenAI, Anthropic, etc.)
- **Model usage** — Token consumption and model pricing
- **Orchestration cost** — Edgaze infrastructure for running the workflow
- **Infrastructure cost** — Compute, memory, and execution overhead

---

## 3. What Creators See

Creators can see an estimate such as:

**Estimated cost for 10 hosted runs:** $2.40

This reflects the expected cost to Edgaze for providing 10 runs to a customer. Creators can adjust their pricing based on this information.

---

## 4. Separate from Marketplace Fee

The infrastructure cost estimate is **separate** from the Edgaze marketplace fee. The estimate helps creators understand:

- What it costs Edgaze to deliver hosted runs
- Whether their chosen price covers costs and leaves room for profit
- How to set sustainable pricing

Creators must ensure their pricing covers:

1. Infrastructure cost (estimated at publish)
2. Edgaze marketplace fee (20%)
3. Desired profit margin

---

## 5. Estimates Are Approximate

Cost estimates are based on typical usage patterns and current API pricing. Actual costs may vary due to:

- Variable token usage per run
- API pricing changes
- Different execution paths in the workflow

The estimate is a helpful guide, not a guarantee of exact cost.

---

## 6. Plus Creators

For Edgaze Plus creators, the estimate may be shown for 15 runs (the Plus inclusion) in addition to or instead of 10 runs, depending on the creator's subscription tier.

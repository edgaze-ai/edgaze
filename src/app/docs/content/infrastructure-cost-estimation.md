title = "Infrastructure Cost Estimation"
description = "How Edgaze estimates workflow execution costs during publishing"

# Infrastructure Cost Estimation

_Last Updated: March 15, 2026_

During workflow publishing, Edgaze estimates the cost of executing the workflow. This estimate is shown to creators **before** they publish, so they can price products appropriately.

## Separate from Marketplace Fee

**Important:** The infrastructure cost estimate is **separate from** and **not the same as** the Edgaze marketplace fee (20%). They are distinct:

| Cost Type               | What it is                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Infrastructure cost** | What it costs to run the workflow (API calls, model tokens, compute). Estimated at publish for 10 runs. |
| **Marketplace fee**     | 20% of the sale price paid to Edgaze. Deducted from creator revenue on every sale.                      |

Creators must cover **both** to earn profit. The infrastructure cost is our estimate of what it costs us to deliver your workflow; the marketplace fee is our platform fee. See [Marketplace Fees](/docs/marketplace-fees) for details on the 20% fee.

## What Creators See at Publish

When you set a paid price for a workflow, the publish modal shows:

- **Estimated cost for 10 runs** — The expected infrastructure cost to deliver 10 workflow runs
- **Minimum price** — $5.00 + infrastructure cost for 10 runs. You cannot price below this.
- **Recommended price** — 2–3× the minimum. Covers infrastructure cost, marketplace fee, and a healthy profit margin.

### Example

| Item                     | Amount                    |
| ------------------------ | ------------------------- |
| Estimated cost (10 runs) | $2.40                     |
| Minimum price            | $5.00 + $2.40 = **$7.40** |
| Recommended price        | **$18.99** (2.5× minimum) |

## Pricing Breakdown

To earn profit, your price must cover:

1. **Infrastructure cost** — Estimated at publish (for 10 runs)
2. **Marketplace fee** — 20% of your price goes to Edgaze
3. **Desired margin** — Your profit

The recommended price (2–3× minimum) accounts for all three. Set your price below the minimum and you will lose money. Set it at or above the recommended price for sustainable profit.

## What the Estimate Includes

The estimate accounts for:

- **API calls** — Model API usage (OpenAI, etc.)
- **Model usage** — Token consumption and model pricing
- **Orchestration cost** — Edgaze infrastructure for running the workflow
- **Compute** — Execution overhead

## Estimates Are Approximate

Cost estimates are based on typical usage patterns and current API pricing. Actual costs may vary due to:

- Variable token usage per run
- API pricing changes
- Different execution paths in the workflow

The estimate is a helpful guide, not a guarantee of exact cost.

## Plus Creators

For Edgaze Plus creators, the estimate may be shown for 15 runs (the Plus inclusion) in addition to or instead of 10 runs, depending on the creator's subscription tier.

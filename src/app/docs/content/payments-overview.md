title = "Payments Overview"
description = "How payments and monetization work on Edgaze"

---

## 1. Overview

_Last Updated: March 13, 2026_

Edgaze is a two-sided marketplace for AI workflows and prompts. Payments are processed securely through Stripe, with creators receiving revenue through Stripe Connect Express accounts. Edgaze does not store sensitive financial information.

---

## 2. Participants

**Customers** — Users who purchase workflows or prompts on the marketplace.

**Creators** — Users who publish AI workflows and prompts and receive revenue from purchases.

**Edgaze** — The platform that hosts workflows, facilitates payments, and provides execution infrastructure.

---

## 3. Payment Processing

All payments are processed using **Stripe Payments** and **Stripe Connect**. Stripe handles:

- Payment processing
- Creator onboarding
- Identity verification
- Tax reporting
- Payouts

Edgaze does not store credit card numbers, bank details, or other sensitive financial data.

---

## 4. Stripe Connect Model

Creators are onboarded through **Stripe Connect Express** accounts. The flow:

1. **Customer purchase** — Customer pays for a workflow or prompt
2. **Stripe processes payment** — Payment is captured by Stripe
3. **Marketplace fee deducted** — Edgaze takes its 20% fee
4. **Creator revenue credited** — 80% is credited to the creator's Stripe balance
5. **Payout scheduled** — Stripe schedules payout to the creator's bank account

Creators must complete Stripe onboarding to receive payouts. Sales may occur before onboarding is complete, but payouts remain pending until identity verification is finished.

---

## 5. What Customers Purchase

### 5.1 Workflows

When a customer buys a workflow, they receive:

- Access to the workflow product
- Ability to execute the workflow
- Included hosted executions (10 runs for free creators, 15 for Plus)
- Updates published by the creator

Workflows function as hosted AI products—not downloadable software.

### 5.2 Prompts

Prompt purchases provide access to the prompt template and execution capability within the Edgaze platform.

---

## 6. Related Policies

For detailed information, see:

- [Marketplace Fees](/docs/marketplace-fees) — How the 20% fee is applied
- [Creator Earnings](/docs/creator-earnings) — Revenue, payouts, and dashboard
- [Pricing Limits](/docs/pricing-limits) — Allowed price ranges for products
- [Workflow Run Policy](/docs/workflow-run-policy) — Hosted runs and consumption rules
- [Refund Policy](/docs/refund-policy) — Refund eligibility and process

title = "Marketplace Fees"
description = "How Edgaze marketplace fees are calculated and applied"

---

## 1. Edgaze Marketplace Fee

_Last Updated: March 15, 2026_

Edgaze takes a **20% marketplace fee** on every sale. This fee covers platform hosting, orchestration infrastructure, payment facilitation, and marketplace operations.

---

## 2. Infrastructure Cost vs Marketplace Fee

The marketplace fee (20%) is **separate from** workflow infrastructure cost:

- **Marketplace fee** — 20% of the sale price. Deducted from every sale. This is the fee described in this document.
- **Infrastructure cost** — The cost to run paid workflows (API usage, compute). Estimated at publish time for 10 runs. Creators must set their price to cover this cost **in addition to** the marketplace fee.

For workflows, the minimum price is $5 plus the estimated infrastructure cost. See [Infrastructure Cost Estimation](/docs/infrastructure-cost-estimation) for details on how we estimate costs and how to price for profit.

---

## 3. Fee Application

The marketplace fee is deducted **before** the creator receives their share. Creators always receive **80% of the listed product price**, regardless of payment processing costs.

### 3.1 Example

| Item                         | Amount |
| ---------------------------- | ------ |
| Workflow price               | $20.00 |
| Customer pays                | $20.00 |
| Creator revenue (80%)        | $16.00 |
| Edgaze marketplace fee (20%) | $4.00  |

---

## 4. Stripe Processing Fees

Stripe charges standard payment processing fees (typically ~2.9% + $0.30 per card transaction). **These fees are deducted from Edgaze's share, not the creator share.**

### 4.1 Example with Stripe Fees

| Item                       | Amount                     |
| -------------------------- | -------------------------- |
| Workflow price             | $20.00                     |
| Customer payment           | $20.00                     |
| Creator share (80%)        | $16.00                     |
| Edgaze gross fee (20%)     | $4.00                      |
| Stripe processing (~$0.88) | Deducted from Edgaze share |
| Edgaze net revenue         | ~$3.12                     |

**Creator payout remains $16.00.** Stripe fees do not reduce creator earnings.

---

## 5. Why This Model

This structure ensures:

- **Transparency** — Creators know exactly what they earn: 80% of every sale
- **Simplicity** — No surprise deductions from creator revenue
- **Predictability** — Creators can price products with full visibility into their take-home amount

---

## 6. Fee Updates

Edgaze may update the marketplace fee in the future. Material changes will be communicated with at least 30 days' notice. Continued selling after changes constitutes acceptance of the updated terms.

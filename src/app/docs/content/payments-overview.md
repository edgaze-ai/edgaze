title = "Payments Overview"
description = "A beginner-friendly guide to how customers pay, how creators earn, and how money moves through Edgaze."

# Payments Overview

This page explains how money moves through Edgaze from the moment a customer buys a product to the moment a creator becomes eligible for payout.

If you are new to the platform, start here before reading the more detailed payout, fee, and earnings pages.

## On This Page

- Who is involved in a payment
- What a customer is buying
- How money flows through Edgaze
- What Stripe does
- Which pages to read next

## The Three Parties In A Transaction

Every marketplace payment on Edgaze involves three parties:

- the customer
- the creator
- Edgaze

### The Customer

The customer is paying for access to a workflow or prompt product inside the Edgaze platform.

### The Creator

The creator is the person who built and published that product.

### Edgaze

Edgaze provides the product surface, publishing system, runtime infrastructure, and payout coordination.

## What A Customer Is Buying

In Edgaze, customers are usually buying access to a hosted AI product experience, not a downloadable application.

### Workflow Products

For workflow products, the customer is typically buying access to a hosted workflow experience and the execution path attached to that product.

### Prompt Products

For prompt products, the customer is typically buying access to a reusable prompt experience packaged inside Edgaze.

## How Money Flows Through Edgaze

At a high level, the flow is:

```text
Customer pays -> Stripe processes payment -> Edgaze records the sale -> Creator share is attributed -> Stripe payout eligibility applies
```

That is the full mental model to keep in mind.

### Sales Attribution

Edgaze records the transaction and attributes the relevant creator share inside the platform model.

## What Stripe Does

Stripe handles the financial rails behind Edgaze.

### Payment Processing

Stripe processes the customer payment.

### Creator Onboarding

Stripe Connect is used for creator onboarding, verification, and payout setup.

### Payouts

Once a creator is onboarded and eligible, Stripe handles the payout process.

### Verification

Stripe also supports the onboarding and verification path attached to payout readiness.

## The Edgaze Payout System

Edgaze supports a creator-friendly model that lets someone publish before completing onboarding.

The right way to think about it is:

- creators can start selling
- onboarding can happen later
- payout release still depends on eligibility and verification

For the dedicated explanation, read [Payout System](/docs/payout-system).

### Why It Matters

This model lowers launch friction for creators while keeping payout release structured.

## Fees And Infrastructure Are Different Things

Two ideas that creators often confuse are:

- marketplace fees
- infrastructure cost guidance

They are not the same thing.

### Marketplace Fee

The marketplace fee is the platform fee charged by Edgaze.

### Infrastructure Cost Guidance

Infrastructure cost guidance is there to help creators price products intelligently. It is not a separate deduction from creator balance.

Read [Infrastructure Cost Estimation](/docs/infrastructure-cost-estimation) for the full explanation.

### Common Mistake

Creators should not confuse pricing guidance with actual payout deductions.

## If You Are A Creator, Read These Next

### Core Monetization Set

These pages together explain the full commercial and payout picture.

- [Payout System](/docs/payout-system)
- [Creator Earnings](/docs/creator-earnings)
- [Marketplace Fees](/docs/marketplace-fees)
- [Infrastructure Cost Estimation](/docs/infrastructure-cost-estimation)
- [Creator Terms](/docs/creator-terms)

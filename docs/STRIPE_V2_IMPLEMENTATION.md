# Stripe Connect V2 Implementation

Production-ready Stripe Connect integration using the V2 Accounts API.

## Overview

- **V2 Accounts API**: No top-level `type`. Uses `display_name`, `contact_email`, `identity.country`, `configuration`, `defaults.responsibilities`.
- **Stripe Client**: All requests use `stripe` (from `@/lib/stripe/client`).
- **Onboarding**: Account Links V2 API with `account_onboarding` use case.
- **Status**: Fetched from Stripe API directly (never trust DB for status).
- **Thin Events**: Separate webhook for V2 account requirement changes.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Platform secret key (sk_...) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Publishable key (pk_...) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Main webhook signing secret |
| `STRIPE_THIN_WEBHOOK_SECRET` | For thin events | Secret for V2 account thin events (or use main secret) |
| `STRIPE_PLATFORM_PRICE_ID` | For subscriptions | Create in Stripe Dashboard for platform plan (price_...) |
| `STRIPE_PLATFORM_FEE_PERCENTAGE` | No | Default 20 |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/stripe/v2/connect/onboard` | POST | Create V2 account + onboarding link |
| `/api/stripe/v2/connect/status` | GET | Account status from Stripe API |
| `/api/stripe/v2/connect/refresh` | POST | New account link for existing account |
| `/api/stripe/v2/products/create` | POST | Create product on connected account |
| `/api/stripe/v2/products/list` | GET | List products (?accountId= or auth) |
| `/api/stripe/v2/checkout/create` | POST | Direct charge checkout with app fee |
| `/api/stripe/v2/subscription/checkout` | POST | Subscription checkout (customer_account) |
| `/api/stripe/v2/subscription/portal` | POST | Billing portal session |
| `/api/stripe/v2/subscription/status` | GET | Subscription status from DB |
| `/api/stripe/webhooks` | POST | Main webhooks (snapshot events) |
| `/api/stripe/webhooks/thin` | POST | Thin events for V2 account updates |

## UI Pages

- `/onboarding` – Connect onboarding (V2)
- `/onboarding/success` – Post-onboarding
- `/dashboard/products` – Create products, subscription CTA, storefront link
- `/dashboard/earnings` – Creator earnings
- `/store/[accountId]` – Public storefront (use slug/handle in production)

## Webhooks

### Main (`/api/stripe/webhooks`)

- `checkout.session.completed` – One-time purchases
- `customer.subscription.created` / `updated` – Subscription status
- `customer.subscription.deleted` – Subscription canceled
- `account.updated` – V1 account updates
- `payout.paid`, `payout.failed`, `charge.refunded`, disputes, etc.

### Thin (`/api/stripe/webhooks/thin`)

Configure in Stripe: Developers → Webhooks → Add destination → Connected accounts, Payload: Thin

- `v2.core.account[requirements].updated`
- `v2.core.account[configuration.merchant].capability_status_updated`
- `v2.core.account[configuration.customer].capability_status_updated`

Local test:
```bash
stripe listen --thin-events 'v2.core.account[requirements].updated,...' --forward-thin-to http://localhost:3000/api/stripe/webhooks/thin
```

## Storefront

- URL uses `accountId` for demo. In production, use `/store/@handle` and resolve handle → stripe_account_id via DB.
- Products are listed with Stripe-Account header. Checkout uses Direct Charge + application fee.

## Subscriptions

- `customer_account` (connected account ID) used instead of `customer` for V2.
- Create a price in Stripe Dashboard for your platform plan. Set `STRIPE_PLATFORM_PRICE_ID`.
- Billing portal lets connected accounts manage subscriptions.

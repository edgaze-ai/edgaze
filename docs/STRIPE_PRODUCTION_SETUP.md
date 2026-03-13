# Stripe Connect V2 – Production Setup

Complete instructions to configure Stripe for Edgaze in production.

---

## 1. Environment Variables Overview

| Variable                             | Required              | Where to Get         | Notes                                        |
| ------------------------------------ | --------------------- | -------------------- | -------------------------------------------- |
| `STRIPE_SECRET_KEY`                  | Yes                   | Dashboard → API Keys | Use **live** key (`sk_live_`) for production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes                   | Dashboard → API Keys | Use **live** key (`pk_live_`) for production |
| `STRIPE_WEBHOOK_SECRET`              | Yes                   | Webhooks → Endpoint  | Main webhook signing secret                  |
| `STRIPE_CONNECT_CLIENT_ID`           | For Connect           | Connect settings     | OAuth client ID (optional if using V2 only)  |
| `STRIPE_THIN_WEBHOOK_SECRET`         | For V2 account events | Event destination    | Thin events secret (can reuse main)          |
| `STRIPE_PLATFORM_PRICE_ID`           | For subscriptions     | Products → Price     | Platform plan price ID                       |
| `STRIPE_PLATFORM_FEE_PERCENTAGE`     | No                    | —                    | Default: 20                                  |
| `STRIPE_MINIMUM_PAYOUT_CENTS`        | No                    | —                    | Default: 1000                                |
| `NEXT_PUBLIC_APP_URL`                | Yes                   | —                    | Production URL, e.g. `https://edgaze.ai`     |
| `ENABLE_PAYMENTS`                    | Yes                   | —                    | Set to `true` to enable payments             |
| `ENABLE_STRIPE_CONNECT`              | Yes                   | —                    | Set to `true` to enable Connect              |

---

## 2. API Keys

**URL:** https://dashboard.stripe.com/apikeys

1. Toggle **Test mode** off (top right) for production keys.
2. Under **Standard keys**, copy:
   - **Secret key** (`sk_live_...`) → `STRIPE_SECRET_KEY`
   - **Publishable key** (`pk_live_...`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Never expose the secret key in client code or Git.

> For local development, use **Test mode** keys (`sk_test_`, `pk_test_`).

---

## 3. Main Webhook Endpoint

**URL:** https://dashboard.stripe.com/webhooks

1. Click **Add endpoint**.
2. **Endpoint URL:**
   ```
   https://your-domain.com/api/stripe/webhooks
   ```
3. **Events to send:** Choose **Select events**, then add:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `account.updated`
   - `payout.paid`
   - `payout.failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**.
5. Open the new endpoint and under **Signing secret**, click **Reveal**.
6. Copy the value (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

---

## 4. Thin Events (V2 Account Requirements)

**URL:** https://dashboard.stripe.com/webhooks

1. Click **Add destination** (or use the **Event destinations** tab).
2. **Destination type:** Webhook endpoint.
3. **Endpoint URL:**
   ```
   https://your-domain.com/api/stripe/webhooks/thin
   ```
4. **Events from:** **Connected accounts**.
5. **Advanced options:**
   - **Payload style:** Thin
6. **Events to send:**
   - `v2.core.account[requirements].updated`
   - `v2.core.account[configuration.merchant].capability_status_updated`
   - `v2.core.account[configuration.customer].capability_status_updated`
7. Save and copy the **Signing secret** → `STRIPE_THIN_WEBHOOK_SECRET`.

> If you prefer, you can use the same secret as `STRIPE_WEBHOOK_SECRET` for both main and thin webhooks; the app accepts either.

---

## 5. Platform Price (for Subscriptions)

**URL:** https://dashboard.stripe.com/products

1. Click **Add product**.
2. **Name:** e.g. `Edgaze Creator Plan`.
3. **Pricing:**
   - **Price:** e.g. `$29/month` or `$199/year`
   - **Billing period:** Monthly or Yearly
   - **Currency:** e.g. USD
4. Click **Save product**.
5. Open the product → **Pricing** → select the price.
6. Copy the **Price ID** (e.g. `price_1ABC123...`) → `STRIPE_PLATFORM_PRICE_ID`.

---

## 6. Connect Client ID (optional)

**URL:** https://dashboard.stripe.com/settings/applications

1. Under **Connect settings**, find **Client ID**.
2. Copy the value (`ca_...`) → `STRIPE_CONNECT_CLIENT_ID`.

> Needed only for legacy Connect flows. V2 Connect uses the platform secret key, but it’s useful to have for Dashboard links and OAuth if you add that later.

---

## 7. App URL and Feature Flags

- **NEXT_PUBLIC_APP_URL:** Production base URL, e.g. `https://edgaze.ai`.
- **ENABLE_PAYMENTS:** Set to `true` to enable payment flows.
- **ENABLE_STRIPE_CONNECT:** Set to `true` to enable Connect onboarding.

---

## 8. Example `.env.local` (production)

Set these in your deployment environment (e.g. Vercel/Railway env vars). **Never commit real keys.**

```bash
# Stripe – set from Stripe Dashboard; use LIVE keys in production
STRIPE_SECRET_KEY=<from Dashboard → API Keys, secret key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from Dashboard → API Keys, publishable key>
STRIPE_WEBHOOK_SECRET=<from Webhooks → endpoint signing secret>
STRIPE_THIN_WEBHOOK_SECRET=<from Event destination signing secret>
STRIPE_CONNECT_CLIENT_ID=<from Connect settings, OAuth client ID>

# Platform price (create in Products)
STRIPE_PLATFORM_PRICE_ID=<from Products → Price ID>

# Optional
STRIPE_PLATFORM_FEE_PERCENTAGE=20
STRIPE_MINIMUM_PAYOUT_CENTS=1000

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
ENABLE_PAYMENTS=true
ENABLE_STRIPE_CONNECT=true
```

---

## 9. Deployment Checklist

- [ ] Use **live** API keys in production.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the production domain.
- [ ] Create webhook endpoint pointing to production URL.
- [ ] Create thin events destination for V2 account events.
- [ ] Create platform product/price and set `STRIPE_PLATFORM_PRICE_ID`.
- [ ] Set `ENABLE_PAYMENTS=true` and `ENABLE_STRIPE_CONNECT=true`.
- [ ] Ensure webhook URL is reachable (no firewall blocking Stripe).
- [ ] Verify SSL for the webhook endpoint.

---

## 10. Local Testing

1. Install Stripe CLI: https://docs.stripe.com/stripe-cli
2. Run:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhooks
   ```
3. Copy the webhook signing secret from the CLI output into `STRIPE_WEBHOOK_SECRET`.
4. For thin events:
   ```bash
   stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' --forward-thin-to http://localhost:3000/api/stripe/webhooks/thin
   ```
5. Use Stripe test cards: https://docs.stripe.com/testing#cards

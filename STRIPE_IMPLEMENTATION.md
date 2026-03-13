# Stripe Connect Implementation Guide

## Overview

This document describes the complete Stripe Connect payment system implementation for Edgaze. The system enables creators to monetize their workflows and prompts with an 80/20 revenue split and automatic weekly payouts.

## Architecture

### Revenue Flow
```
Buyer Purchase ($100)
  ↓
Stripe Processing Fee (-$3.20)
  ↓
Net Amount ($96.80)
  ↓
Platform Fee (20%): $19.36
Creator Net (80%): $77.44
  ↓
Automatic Weekly Payout to Creator
```

### Key Components

1. **Stripe Connect Express** - Simplified onboarding for creators
2. **Embedded Checkout** - Branded payment experience
3. **Webhook Handler** - Secure payment confirmation
4. **Earnings Dashboard** - Real-time creator analytics
5. **Automatic Payouts** - Weekly transfers via Stripe

## Database Schema

### New Tables

- `stripe_connect_accounts` - Creator Stripe accounts
- `creator_earnings` - Individual purchase earnings
- `creator_payouts` - Payout batch records
- `stripe_webhook_events` - Idempotent event processing
- `payment_failures` - Failed payment tracking
- `chargebacks` - Dispute management
- `fraud_alerts` - Suspicious activity detection
- `audit_logs` - Complete audit trail

### Updated Tables

- `workflow_purchases` - Added Stripe payment fields
- `prompt_purchases` - Added Stripe payment fields
- `profiles` - Added earnings and onboarding status

## Environment Variables

Required variables (add to `.env`):

```bash
# Stripe API Keys – set from https://dashboard.stripe.com/apikeys (use test keys for dev)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Stripe Connect
STRIPE_CONNECT_CLIENT_ID=
STRIPE_PLATFORM_FEE_PERCENTAGE=20
STRIPE_MINIMUM_PAYOUT_CENTS=1000

# Feature Flags
ENABLE_PAYMENTS=true
ENABLE_STRIPE_CONNECT=true

# Cron Security
CRON_SECRET=<generate with: openssl rand -base64 32>
```

## Setup Instructions

### 1. Stripe Dashboard Configuration

1. **Create Stripe Account**
   - Go to https://dashboard.stripe.com
   - Complete business verification

2. **Enable Connect**
   - Navigate to Connect → Settings
   - Enable Express accounts
   - Set brand colors: Primary #22d3ee, Secondary #e879f9
   - Upload Edgaze logo

3. **Configure Webhooks**
   - Go to Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhooks`
   - Select events:
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
   - Copy webhook signing secret

4. **Get API Keys**
   - Go to Developers → API keys
   - Copy publishable and secret keys
   - Use test keys for development

### 2. Database Migration

```bash
# Run the migration
npx supabase db push

# Or manually apply
psql $DATABASE_URL < supabase/migrations/20250227000000_stripe_connect_tables.sql
```

### 3. Vercel Configuration

Add environment variables in Vercel dashboard:
- Settings → Environment Variables
- Add all variables from `.env`
- Redeploy after adding variables

Configure cron job:
- The `vercel.json` file is already configured
- Cron runs every 5 minutes to retry failed webhooks

### 4. Testing

#### Test Mode Setup

1. Use Stripe test keys (start with `sk_test_` and `pk_test_`)
2. Use test webhook endpoint for local development:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhooks
   ```

#### Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`
- **Dispute**: `4000 0000 0000 0259`

#### Test Scenarios

1. **Creator Onboarding**
   - Visit `/onboarding`
   - Complete Stripe Express onboarding
   - Verify account status updates

2. **Purchase Flow**
   - Create a paid workflow
   - Purchase as different user
   - Verify webhook processes payment
   - Check earnings appear in dashboard

3. **Refund**
   - Issue refund in Stripe Dashboard
   - Verify access revoked
   - Check earnings adjusted

4. **Payout**
   - Trigger test payout in Stripe
   - Verify webhook updates records
   - Check dashboard displays payout

## API Routes

### Creator Onboarding
- `POST /api/stripe/connect/onboard` - Start onboarding
- `GET /api/stripe/connect/callback` - Handle completion
- `POST /api/stripe/connect/refresh` - Refresh onboarding link
- `POST /api/stripe/connect/dashboard` - Get Express Dashboard link
- `GET /api/stripe/connect/status` - Check account status

### Checkout
- `POST /api/stripe/checkout/create` - Create checkout session
- `GET /api/stripe/checkout/confirm` - Poll for confirmation

### Webhooks
- `POST /api/stripe/webhooks` - Handle all Stripe events

### Creator Earnings
- `GET /api/creator/earnings` - Get earnings summary
- `GET /api/creator/transactions` - Get transaction history
- `GET /api/creator/analytics` - Get revenue analytics

### Cron Jobs
- `GET /api/cron/retry-failed-webhooks` - Retry failed webhooks (every 5 min)

## Security Features

### Webhook Security

1. **Signature Verification** - Every webhook is verified using Stripe's signature
2. **Idempotency** - Duplicate events are automatically detected and skipped
3. **Unique Constraints** - Database prevents duplicate processing
4. **Retry Logic** - Failed webhooks are automatically retried up to 5 times
5. **Dead Letter Queue** - Permanently failed events are moved for manual review

### Access Control

1. **Webhook-Only Access** - Content access is ONLY granted via webhook, never client-side
2. **RLS Policies** - Database-level security on all sensitive tables
3. **Atomic Operations** - All balance updates use PostgreSQL RPC functions
4. **Audit Logging** - Every payment action is logged

### Fraud Prevention

1. **Stripe Radar** - Automatic fraud detection
2. **Rate Limiting** - Max 10 purchases per hour per user
3. **Pattern Detection** - Suspicious activity flagged for review
4. **Chargeback Tracking** - Automatic access revocation on disputes

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Payment Success Rate** - Should be >90%
2. **Webhook Processing Time** - Should be <1000ms
3. **Failed Webhook Count** - Should be near 0
4. **Chargeback Rate** - Should be <1%
5. **Payout Failure Rate** - Should be near 0

### Recommended Alerts

Set up alerts for:
- Payment failure rate >10%
- Unprocessed webhooks >5 minutes old
- Earnings mismatches detected
- Chargeback rate spike
- Payout failures

### Logging

All critical events are logged:
- `[STRIPE CONNECT]` - Onboarding events
- `[STRIPE CHECKOUT]` - Payment events
- `[WEBHOOK]` - Webhook processing
- `[CRON]` - Retry job execution

## Troubleshooting

### Webhook Not Processing

1. Check webhook signature secret is correct
2. Verify webhook endpoint is publicly accessible
3. Check Stripe Dashboard → Webhooks for failed attempts
4. Review logs in `/api/stripe/webhooks`
5. Check `stripe_webhook_events` table for errors

### Payment Not Confirming

1. Check webhook was received (Stripe Dashboard)
2. Verify `stripe_webhook_events` table shows event
3. Check if event is marked as processed
4. Review error message if processing failed
5. Manually retry from `webhook_dead_letter_queue` if needed

### Payout Not Arriving

1. Check Stripe Express Dashboard for payout status
2. Verify bank account details are correct
3. Check for payout failures in `creator_payouts` table
4. Review Stripe Dashboard for payout details
5. Contact Stripe support if issue persists

### Earnings Mismatch

1. Run reconciliation query:
   ```sql
   SELECT 
     ce.creator_id,
     SUM(ce.net_amount_cents) as calculated_earnings,
     p.total_earnings_cents as profile_earnings
   FROM creator_earnings ce
   JOIN profiles p ON p.id = ce.creator_id
   WHERE ce.status = 'paid'
   GROUP BY ce.creator_id, p.total_earnings_cents
   HAVING SUM(ce.net_amount_cents) != p.total_earnings_cents;
   ```
2. Check for refunds or chargebacks
3. Review audit logs for the creator
4. Manually adjust if discrepancy confirmed

## Production Deployment Checklist

### Pre-Launch

- [ ] Switch to live Stripe keys
- [ ] Update webhook endpoint to production URL
- [ ] Configure production webhook secret
- [ ] Set `ENABLE_PAYMENTS=true`
- [ ] Test complete flow in production
- [ ] Verify cron job is running
- [ ] Set up monitoring and alerts
- [ ] Review all legal pages
- [ ] Train support team on refund process

### Launch Day

- [ ] Monitor webhook processing closely
- [ ] Watch for payment failures
- [ ] Check earnings calculations
- [ ] Verify payouts are scheduled
- [ ] Be ready to disable feature flag if issues arise

### Post-Launch

- [ ] Daily reconciliation for first week
- [ ] Review fraud alerts
- [ ] Monitor chargeback rate
- [ ] Collect creator feedback
- [ ] Optimize based on metrics

## Rollback Plan

If critical issues arise:

1. **Immediate**: Set `ENABLE_PAYMENTS=false`
2. **Database**: Run down migration if needed
3. **Stripe**: Disable webhook endpoint
4. **Communication**: Notify affected creators
5. **Investigation**: Review logs and fix issues
6. **Re-enable**: After thorough testing

## Support

### For Creators

- Email: sellers@edgaze.ai
- Stripe Express Dashboard: Access via earnings dashboard
- Documentation: /docs/monetization

### For Buyers

- Email: support@edgaze.ai
- Refund Policy: /legal/refund-policy
- FAQ: /help

### Internal

- Webhook Dead Letter Queue: Check `webhook_dead_letter_queue` table
- Fraud Alerts: Check `fraud_alerts` table
- Audit Logs: Check `audit_logs` table
- Stripe Dashboard: https://dashboard.stripe.com

## Future Enhancements

Potential improvements:

1. **Subscriptions** - Recurring revenue for creators
2. **Bundles** - Package multiple products
3. **Coupons** - Promotional discounts
4. **Instant Payouts** - 1% fee for immediate transfers
5. **Multi-Currency** - Support for EUR, GBP, etc.
6. **Analytics** - Advanced revenue insights
7. **Tax Automation** - Automatic tax calculation
8. **Affiliate System** - Revenue sharing for referrals

## Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

## License

This implementation is proprietary to Edgaze. All rights reserved.

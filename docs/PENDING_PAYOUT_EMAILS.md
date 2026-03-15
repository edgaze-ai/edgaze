# Pending Payout Emails Setup

Edgaze sends premium emails to creators who have unclaimed earnings (sell without joining Creator Program). Emails use the same design as the welcome email—Edgaze cyan/pink gradient branding—and are sent from `payments@edgaze.ai`.

## How it works

1. **First sale**: When a creator earns from a sale before completing payout onboarding, a `creator_earnings` row is created with `status = 'pending_claim'`. A database trigger fires and invokes the `send-pending-payout-email` Edge Function via `pg_net` with `emailType: 'first_sale'`.
2. **Day 30 reminder**: Cron job runs daily, finds creators with ~30-day-old pending claims (~60 days left), sends reminder if not already sent.
3. **Day 60 reminder**: Same cron finds ~60-day-old pending claims (~30 days left).
4. **Day 80 reminder**: Same cron finds ~80-day-old pending claims (~10 days left).
5. **If Resend fails**: The Edge Function returns 200; no error is exposed to users.

## Email types

| Type       | When        | Subject example                           |
| ---------- | ----------- | ----------------------------------------- |
| first_sale | Immediately | You made your first sale on Edgaze        |
| day_30     | ~30 days in | Reminder: $42.00 pending — 60 days left   |
| day_60     | ~60 days in | Reminder: $42.00 pending — 30 days left   |
| day_80     | ~80 days in | Urgent: $42.00 — 10 days left to withdraw |

## Required setup

### 1. Resend API key

The same `RESEND_API_KEY` used for welcome emails is used. Ensure it is set in Supabase Edge Function secrets.

### 2. Verify `payments@edgaze.ai`

Resend requires the sending address to use a verified domain. If `edgaze.ai` is already verified (e.g. for `onboarding@edgaze.ai`), add `payments@edgaze.ai` as an allowed sender in [resend.com/domains](https://resend.com/domains). The Edge Function sends from `Edgaze <payments@edgaze.ai>`.

### 3. Deploy Edge Function

```bash
supabase functions deploy send-pending-payout-email
```

### 4. Run migrations

Apply the migrations that add the trigger and `creator_pending_claim_email_log` table:

```bash
npx supabase db push
```

### 5. Cron

The `/api/cron/pending-payout-reminders` route runs daily (e.g. 10:00 UTC via Vercel cron). Ensure `CRON_SECRET` is set in Vercel environment variables.

## Architecture

- **Edge Function**: `send-pending-payout-email` (deployed to Supabase)
- **From**: `Edgaze <payments@edgaze.ai>` (hardcoded)
- **Trigger**: `on_creator_earnings_pending_claim_send_first_sale_email` on `creator_earnings` (AFTER INSERT when `status = 'pending_claim'`)
- **Cron**: `pending-payout-reminders` (day 30, 60, 80 reminders)
- **Log table**: `creator_pending_claim_email_log` (idempotent; prevents duplicate reminders)
- **Extension**: `pg_net` for async HTTP from the database (first_sale)

## Design

Emails mirror the welcome email:

- Gradient header: `linear-gradient(90deg, #06b6d4 0%, #ec4899 50%, #06b6d4 100%)`
- Card: 24px radius, cyan/pink shadow
- CTA: "Complete payout setup" → `/creators/onboarding`
- Light/dark mode support via `prefers-color-scheme`

## Troubleshooting

- **No first_sale email**
  - Confirm the `creator_earnings` trigger exists and `pg_net` is enabled
  - Check Edge Function logs: Supabase Dashboard → Edge Functions → `send-pending-payout-email`

- **No reminder emails**
  - Ensure the `pending-payout-reminders` cron runs (Vercel → Cron Jobs)
  - Check `creator_pending_claim_email_log` for sent entries
  - Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the cron route

- **Resend errors**
  - Check [resend.com/emails](https://resend.com/emails)
  - Ensure `payments@edgaze.ai` is allowed for the verified domain

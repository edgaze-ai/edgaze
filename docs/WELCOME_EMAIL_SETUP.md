# Welcome Email Setup

EdGaze automatically sends a premium welcome email to every new user who signs up—whether via **email/password** or **Google OAuth**. The email is sent via Resend from a Supabase Edge Function, triggered by a database hook when a new profile is created.

## How it works

1. User signs up (email or OAuth) → Supabase Auth creates a user → profile is created
2. Database trigger on `profiles` INSERT fires
3. Trigger calls the `send-welcome-email` Edge Function via `pg_net`
4. Edge Function sends a branded HTML welcome email via Resend
5. **If Resend is out of credits or fails**: no error is shown to the user; the function returns 200 and the signup still succeeds

## Required setup

### 1. Add Resend API key to Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com) → your project → **Project Settings** → **Edge Functions**
2. Under **Secrets**, add:
   - `RESEND_API_KEY` = your Resend API key from [resend.com/api-keys](https://resend.com/api-keys)

### 2. Verify your sending domain (if not already)

Resend requires a verified domain. If you use Resend for Supabase SMTP, you likely already have this. Otherwise: [resend.com/domains](https://resend.com/domains)

### 3. Optional: customize sender and app URL

In Supabase Edge Function secrets, you can optionally set:

- `RESEND_FROM_EMAIL` — default: `EdGaze <onboarding@edgaze.ai>`  
  Use a verified domain, e.g. `EdGaze <hello@yourdomain.com>`
- `EDGAZE_APP_URL` — default: `https://edgaze.ai`  
  Used in the CTA button link in the email

## Architecture

- **Edge Function**: `send-welcome-email` (deployed to Supabase)
- **Trigger**: `on_profile_created_send_welcome_email` on `public.profiles` INSERT
- **Extension**: `pg_net` for async HTTP from the database

## Testing

1. Sign up a new user (email or Google)
2. Check that the welcome email arrives
3. If you run out of Resend credits, signup still works—the email is simply not sent, and no error is shown to the user

## Troubleshooting

- **No email received**  
  - Check Resend logs at [resend.com/emails](https://resend.com/emails)  
  - Ensure `RESEND_API_KEY` is set in Supabase Edge Function secrets  
  - Ensure your domain is verified in Resend  

- **Check Edge Function logs**  
  Supabase Dashboard → Edge Functions → `send-welcome-email` → Logs

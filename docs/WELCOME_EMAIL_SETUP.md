# Welcome Email Setup


Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

Edgaze automatically sends a premium welcome email to new users—**only after they’ve completed sign-up**. For **email/password** users, the email is sent after they confirm their email (click the confirm link). For **Google OAuth** users, it’s sent on first sign-in when the account is created. The email is sent via Resend from a Supabase Edge Function.

## How it works

1. **Email signup**: User signs up → receives confirmation email → clicks confirm → welcome email is sent
2. **OAuth signup**: User signs in with Google → account is created (email pre-confirmed) → welcome email is sent
3. A trigger on `auth.users` fires when `email_confirmed_at` becomes non-null (INSERT for OAuth, UPDATE for email confirmation)
4. Trigger calls the `send-welcome-email` Edge Function via `pg_net`
5. Edge Function sends a branded light-theme HTML welcome email with Edgaze cyan/pink gradient vibes
6. **If Resend is out of credits or fails**: no error is shown; the function returns 200 and signup still succeeds

## Required setup

### 1. Add Resend API key to Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com) → your project → **Project Settings** → **Edge Functions**
2. Under **Secrets**, add:
   - `RESEND_API_KEY` = your Resend API key from [resend.com/api-keys](https://resend.com/api-keys)

### 2. Verify your sending domain (if not already)

Resend requires a verified domain. If you use Resend for Supabase SMTP, you likely already have this. Otherwise: [resend.com/domains](https://resend.com/domains)

### 3. Optional: customize sender and app URL

In Supabase Edge Function secrets, you can optionally set:

- `RESEND_FROM_EMAIL` — default: `Edgaze <onboarding@edgaze.ai>`  
  Use a verified domain, e.g. `Edgaze <hello@yourdomain.com>`
- `EDGAZE_APP_URL` — default: `https://edgaze.ai`  
  Used in the CTA button link in the email

## Architecture

- **Edge Function**: `send-welcome-email` (deployed to Supabase)
- **Trigger**: `on_auth_user_email_confirmed_send_welcome` on `auth.users` (INSERT/UPDATE when `email_confirmed_at` is set)
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

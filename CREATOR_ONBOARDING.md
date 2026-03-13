# Creator Onboarding System

A premium, white-glove onboarding experience for invited creators on Edgaze.

## Overview

The Creator Onboarding System provides a personalized, mobile-first onboarding flow at `/c/[token]` with an admin panel at `/admin/invites` for creating and managing invites.

## Features

### 🎨 Premium Design
- **Dark luxury editorial aesthetic** with near-black background (#0A0A0B) and subtle noise texture
- **Electric teal accent** (#00E5CC) used sparingly for CTAs and active states
- **Custom typography**: Instrument Serif (headlines), DM Sans (body), JetBrains Mono (code)
- **Smooth animations** using Framer Motion with custom easing curves
- **Mobile-first** with 100dvh sections and touch-optimized controls

### 🔐 Secure Token System
- Tokens generated with `crypto.randomUUID()` + timestamp, base64url encoded
- **Only SHA-256 hashes stored in database** (never raw tokens)
- Token validation with expiry, revocation, and claim status checks
- 14-day default expiry (configurable)

### 📝 Onboarding Flow

#### Step 1: Welcome
- Full-screen centered greeting with creator photo
- Glowing orb background with breathing animation
- Name displayed in italic Instrument Serif with shimmer effect

#### Step 2: Personal Message
- Custom message with word-by-word reveal animation
- Centered editorial layout

#### Step 3: Account Creation
- Split layout: invite card preview (left) + auth form (right)
- Sign up or sign in with email/password
- Automatic invite claiming on successful signup
- Success animation with checkmark

#### Step 4: Profile Setup
- Two-column layout with live preview
- Required: Display name, handle (with real-time availability check), profile photo
- Optional: Banner image
- Drag-and-drop image uploads
- Live marketplace card preview updates as user types

#### Step 5: Stripe Connect
- Optional Stripe Connect onboarding
- "Set up now" redirects to Stripe Express onboarding
- "I'll do this later" skips to completion
- Return URL handling for Stripe callback

#### Step 6: All Set
- Confetti celebration (canvas-confetti)
- Animated SVG checkmark drawing itself
- Reminder to connect payouts if skipped
- CTA to marketplace

### 🛡️ Invalid Token Screens
Premium error screens for:
- Invalid/malformed tokens
- Expired invites (past 14 days)
- Revoked invites (admin cancelled)
- Already claimed by different user
- Already completed onboarding

### 👨‍💼 Admin Panel (`/admin/invites`)

#### Create Invite Form
- Creator name input
- Profile photo upload (drag-and-drop)
- Custom message textarea (auto-grows)
- Expiry date picker (default 14 days)
- Generate link button

#### Success Card
After creation:
- Full invite URL in monospace code block with teal border
- Copy link button (shows "Copied ✓" feedback)
- Preview invite button (opens read-only preview)
- Send another link to reset form

#### Invite List Table
Columns:
- **Creator**: Avatar + name
- **Status**: Pill badge (active/claimed/completed/expired/revoked)
- **Created**: Date
- **Expires**: Date
- **Actions**: Copy link, Preview, Revoke (on hover)

Status pills:
- **Active**: Teal with pulsing dot
- **Claimed**: Amber
- **Completed**: Green
- **Expired**: Muted gray
- **Revoked**: Red

#### Revoke Confirmation Modal
- Backdrop blur overlay
- Warning icon and message
- Cancel / Revoke buttons
- Permanent action (cannot be undone)

### 🔍 Preview Mode (`/admin/invites/[id]/preview`)
- Read-only view of invite as the creator would see it
- Toggle between Welcome and Message steps
- Back to admin button
- Preview mode badge

## Database Schema

### `creator_invites`
```sql
id uuid PRIMARY KEY
token_hash text UNIQUE NOT NULL  -- SHA-256 hash of raw token
creator_name text NOT NULL
creator_photo_url text NOT NULL
custom_message text NOT NULL
created_by_admin_id uuid REFERENCES auth.users(id)
status text DEFAULT 'active'  -- active | claimed | completed | revoked | expired
expires_at timestamptz DEFAULT (now() + interval '14 days')
claimed_by_user_id uuid REFERENCES auth.users(id)
claimed_at timestamptz
completed_at timestamptz
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### `creator_onboarding`
```sql
user_id uuid PRIMARY KEY REFERENCES auth.users(id)
invite_id uuid REFERENCES creator_invites(id)
step text DEFAULT 'welcome'  -- welcome | message | auth | profile | stripe | done
stripe_choice text DEFAULT 'unset'  -- now | later | unset
stripe_account_id text
stripe_status text DEFAULT 'not_started'  -- not_started | in_progress | complete | restricted
profile_completed boolean DEFAULT false
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

## API Routes

### `POST /api/invites`
Create a new invite (admin only)
```json
{
  "creator_name": "Jane Doe",
  "creator_photo_url": "https://...",
  "custom_message": "We're excited to have you...",
  "expires_in_days": 14
}
```

### `GET /api/invites`
Get all invites (admin only)

### `GET /api/invites/[token]/validate`
Validate an invite token (public)

### `POST /api/invites/[token]/claim`
Claim an invite after signup (authenticated)

### `POST /api/invites/[id]/revoke`
Revoke an invite (admin only)

### `GET /api/onboarding`
Get current user's onboarding state

### `PUT /api/onboarding`
Update onboarding step/state

## File Structure

```
src/
├── app/
│   ├── c/
│   │   └── [token]/
│   │       ├── page.tsx                    # Main onboarding shell
│   │       └── components/
│   │           ├── ProgressBar.tsx
│   │           ├── WelcomeStep.tsx
│   │           ├── MessageStep.tsx
│   │           ├── AuthStep.tsx
│   │           ├── ProfileStep.tsx
│   │           ├── StripeStep.tsx
│   │           ├── AllSetStep.tsx
│   │           └── InvalidTokenScreen.tsx
│   ├── admin/
│   │   └── invites/
│   │       ├── page.tsx                    # Admin invite management
│   │       └── [id]/
│   │           └── preview/
│   │               └── page.tsx            # Read-only preview
│   └── api/
│       ├── invites/
│       │   ├── route.ts                    # POST create, GET list
│       │   ├── [token]/
│       │   │   ├── validate/
│       │   │   │   └── route.ts            # GET validate token
│       │   │   └── claim/
│       │   │       └── route.ts            # POST claim token
│       │   └── [id]/
│       │       └── revoke/
│       │           └── route.ts            # POST revoke invite
│       └── onboarding/
│           └── route.ts                    # GET state, PUT update
├── lib/
│   ├── invites.ts                          # Token hashing, DB helpers
│   └── onboarding.ts                       # State machine logic
└── supabase/
    └── migrations/
        └── 20250301000000_creator_invites_onboarding.sql
```

## Design Tokens

### Colors
```css
--onboarding-bg: #0A0A0B
--onboarding-surface: #111113
--onboarding-border: rgba(255,255,255,0.06)
--onboarding-teal: #00E5CC
--onboarding-teal-glow: rgba(0,229,204,0.3)
```

### Fonts
```css
--font-instrument-serif: "Instrument Serif", serif
--font-dm-sans: "DM Sans", sans-serif
--font-jetbrains-mono: "JetBrains Mono", monospace
```

### Animations
- **Breathing**: 4s ease-in-out infinite (scale 1 → 1.15 → 1)
- **Shimmer**: 3s ease-in-out infinite (background position)
- **Entrance**: y: 20, opacity: 0 → y: 0, opacity: 1 (0.5s, custom easing)
- **Stagger**: 0.06s delay between children

## Testing Checklist

- [ ] Create invite as admin
- [ ] Copy invite link
- [ ] Open invite in incognito window
- [ ] Complete full onboarding flow
- [ ] Test "Set up Stripe later" path
- [ ] Test "Set up Stripe now" path (requires Stripe test mode)
- [ ] Test expired invite (manually set expires_at in DB)
- [ ] Test revoked invite
- [ ] Test already claimed invite (different user)
- [ ] Test mobile layout (375px width minimum)
- [ ] Test handle availability check
- [ ] Test profile photo upload
- [ ] Test banner upload
- [ ] Test admin preview mode
- [ ] Test confetti animation on completion
- [ ] Test all invalid token screens

## Mobile Optimization

- All sections use `100dvh` (not `vh`) to handle mobile browser chrome
- Touch targets minimum 52px height
- Input font-size minimum 16px (prevents iOS zoom)
- Profile preview collapses to bottom sheet on mobile
- Progress bar 3px thick on mobile
- All buttons full-width on mobile where appropriate

## Performance Notes

- Images lazy-loaded where possible
- Framer Motion animations use GPU-accelerated transforms
- Debounced handle availability check (400ms)
- Optimistic UI updates for better perceived performance
- Canvas confetti only loads on final step

## Security Notes

- **Never store raw tokens** - only SHA-256 hashes
- Token validation happens server-side
- RLS policies enforce admin-only access to invite management
- Users can only view/update their own onboarding state
- File uploads go through Supabase Storage with auth checks
- All API routes validate authentication and authorization

## Future Enhancements

- [ ] Email notifications when invite is created
- [ ] Invite analytics (views, completion rate)
- [ ] Bulk invite creation
- [ ] Custom expiry dates per invite
- [ ] Invite templates
- [ ] Webhook notifications on completion
- [ ] A/B testing different messages
- [ ] Multi-step custom messages
- [ ] Video message support
- [ ] Social proof (show other creators who joined)

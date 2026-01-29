# Authentication (Auth) Guide

This document explains how authentication works in this project, the fixes applied so API routes work reliably, and how to implement auth correctly in new code.

---

## Overview

- **Provider:** [Supabase Auth](https://supabase.com/docs/guides/auth) (email/password and Google OAuth).
- **Session storage:** The session lives in the **browser** (localStorage) via the Supabase browser client. It is **not** automatically available in Next.js API routes or server components.
- **Flow:** PKCE is used (`flowType: "pkce"`). After sign-in, the client gets an access token; the client must send this token to API routes that need to know who the user is.

---

## The Problem (and Why We Fixed It)

- **Cookie-based auth in API routes was unreliable.** We do not use Supabase’s SSR cookie syncing (middleware + cookie getters/setters) everywhere. In API Route Handlers, `supabase.auth.getUser()` or `getSession()` using a **server/cookie-based** client often returned `null` because the session was only in the browser’s localStorage.
- **Result:** Run tracking, remaining-count, reports, and other authenticated APIs could not get a valid `userId`, leading to 401s or wrong behavior even when the user was logged in.

---

## The Fix: Bearer Token Auth in API Routes

We do **not** rely on cookies for authenticating API routes. Instead:

1. **Client:** Sends the Supabase access token in the `Authorization` header:  
   `Authorization: Bearer <accessToken>`
2. **Server:** A shared helper reads that header, creates a one-off Supabase client with that token, and calls `getUser(token)` to verify the user. The route then uses that `user.id` (and never trusts cookies for identity in these routes).

This gives a single, reliable way to get the current user in API routes.

---

## Central Helper: `getUserFromRequest`

- **Location:** `src/app/api/flow/_auth.ts`
- **Usage:** Use this in any API route that needs to know the authenticated user.

```ts
import { getUserFromRequest } from "../_auth";   // adjust path to _auth.ts

export async function GET(req: NextRequest) {
  const { user, error } = await getUserFromRequest(req);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;
  // ... use userId
}
```

- **Returns:**  
  - Success: `{ user: User, error: null }`  
  - Failure: `{ user: null, error: string }`
- **Requires:** Client sends `Authorization: Bearer <accessToken>`.
- **Environment:** Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only (no service role). The token is validated by Supabase Auth.

---

## Client: How to Send the Token

The session (and thus the access token) is only available on the client, from the same Supabase browser client that holds the session.

### 1. Get the token: `useAuth().getAccessToken()`

- **Context:** `AuthContext` exposes `getAccessToken: () => Promise<string | null>`.
- **Behavior:** Reads the current session from the browser client, refreshes if the token is close to expiry (within 60 seconds), and returns the access token or `null` if not signed in.

```ts
const { getAccessToken } = useAuth();

const token = await getAccessToken();
if (!token) {
  // User not signed in; show sign-in or disable action
  return;
}
```

### 2. Send it on every authenticated request

Always send the token in the `Authorization` header for APIs that use `getUserFromRequest`:

```ts
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
const accessToken = await getAccessToken();
if (accessToken) {
  headers["Authorization"] = `Bearer ${accessToken}`;
}

const res = await fetch("/api/your/route", {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});
```

- **Do not** rely on cookies for these API routes.
- **Do** call `getAccessToken()` at request time (or just before) so you send a fresh (and possibly refreshed) token.

---

## Implementing Auth in a New API Route

1. **Import the helper**
   - From `src/app/api/flow/_auth.ts`. Adjust the relative path from your route file (e.g. `../_auth`, `../../flow/_auth`).

2. **Call `getUserFromRequest(req)`**
   - Use the incoming `NextRequest` or `Request` (e.g. in GET/POST handler).

3. **Handle failure**
   - If `user` is null, return 401 and optionally use `error` in the body.

4. **Use `user.id`**
   - Use `user.id` as the authenticated `userId` for DB writes, RLS, or checks. Do not use any cookie or server-side session for identity in that route.

5. **Optional: allow anonymous for specific actions**
   - Example: `/api/flow/run` allows unauthenticated “demo” runs by checking a body flag (e.g. `isDemo`) and then using a placeholder id like `"anonymous_demo_user"` instead of requiring a token. Only do this where you explicitly want unauthenticated access.

Example skeleton:

```ts
// src/app/api/your-route/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserFromRequest } from "../../flow/_auth";  // fix path

export async function POST(req: NextRequest) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: error ?? "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = user.id;
  // ... rest of handler
}
```

---

## Supabase Clients: When to Use Which

| Client | File | Use case |
|--------|------|----------|
| **Browser** | `src/lib/supabase/browser.ts` | Client-side only. Has the session (localStorage), used for sign-in, profile, and getting the access token. |
| **Server (cookie-based)** | `src/lib/supabase/server.ts` | Server Components / SSR where cookies are available and you want to read the session from cookies. **Not** used for API Route Handlers that need reliable auth (use Bearer + `getUserFromRequest` instead). |
| **Admin (service role)** | `src/lib/supabase/admin.ts` | Server-only. Bypasses RLS. Use when the API route has already verified the user (e.g. via `getUserFromRequest`) and needs to perform privileged or RLS-exempt operations (e.g. run tracking, admin checks). |
| **One-off with token** | Inside `getUserFromRequest` | Created in `_auth.ts` with the Bearer token and `persistSession: false`. Used only to validate the token and return the user. |

- **Rule of thumb:** In API routes, **identify the user** with `getUserFromRequest(req)`. Then, if you need to hit tables protected by RLS or that require the service role (e.g. `workflow_runs`, `admin_roles`), use **admin client** from `src/lib/supabase/admin.ts` and pass the already-resolved `userId`. Do not rely on the server/cookie client for identity in API routes.

---

## Run Tracking and Admin Client

- **Run tracking** (e.g. `workflow_runs` inserts/updates, `get_user_workflow_run_count`) is implemented in `src/lib/supabase/executions.ts`.
- These functions use the **admin (service role) client** so they work in API routes regardless of RLS. The **caller** is responsible for passing a verified `userId` (from `getUserFromRequest` or a documented placeholder like `"anonymous_demo_user"` for demo runs).
- **Admin checks** (e.g. `isAdmin(userId)`) also use the admin client and expect a validated `userId` from the route.

---

## Auth Callback and Sign-In Flow

- **OAuth / magic link return:** Handled by `src/app/auth/callback/` (e.g. `CallbackClient.tsx`). It exchanges the code for a session and stores it in the browser client, then redirects (e.g. using a stored `edgaze:returnTo` path).
- **Sign-in methods:** Exposed via `AuthContext`: e.g. `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`. These use the browser Supabase client; after success, the session is in the browser and `getAccessToken()` will return a token for API calls.

---

## Demo / Anonymous Flows

- **Demo runs:** `/api/flow/run` accepts an `isDemo` flag in the body. If `isDemo` is true and no Bearer token is present, the route uses `userId = "anonymous_demo_user"` and does not return 401. Run tracking and limits can treat this id separately.
- **Other routes:** Unless documented (like the run route), API routes that call `getUserFromRequest` should require a valid token and return 401 when `user` is null.

---

## Checklist for New Authenticated API Routes

1. Import `getUserFromRequest` from `src/app/api/flow/_auth.ts` (fix path for your route).
2. Call `getUserFromRequest(req)` at the start of the handler.
3. If `user` is null, return 401 and do not proceed.
4. Use `user.id` as the only source of identity for that request.
5. When calling run tracking or admin-only logic, use the admin client and pass `user.id` (or the allowed placeholder); do not rely on cookie/session in that route.
6. On the client, use `useAuth().getAccessToken()` and send `Authorization: Bearer <token>` for every request to that route.

---

## Routes Using Bearer Auth (Reference)

These routes use `getUserFromRequest` and expect the client to send the Bearer token:

- `POST /api/flow/run` (optional for demo: no token when `isDemo` is true)
- `GET /api/flow/run/remaining`
- `GET /api/flow/run/diagnostic`
- `GET /api/flow/run/tracking-diagnostic`
- `POST /api/reports/submit`
- `POST /api/bugs` (if/when auth is required)
- `GET/POST /api/admin/token-limits`
- `POST /api/admin/replenish-demo`

Client components that call these (e.g. builder run modal, report modal, diagnostic modal) pass the token via `getAccessToken()` and the `Authorization` header.

---

## Summary

- **Session** lives in the **browser** (Supabase browser client, localStorage). Do not rely on cookies for identity in API routes.
- **API routes** that need the current user must use **Bearer token auth**: client sends `Authorization: Bearer <accessToken>`, server uses **`getUserFromRequest(req)`** from `src/app/api/flow/_auth.ts`.
- **Client** gets the token with **`useAuth().getAccessToken()`** and sends it on every request to those routes.
- **Run tracking and admin checks** use the **admin client** with the already-verified `userId` from the route.

Following this keeps auth consistent and avoids the previous issues with cookie-based auth in API routes.

# API reference

This document provides a comprehensive reference for Edgaze's internal API routes.

---

## Table of contents

- [Authentication](#authentication)
- [Workflows](#workflows)
- [Prompts](#prompts)
- [Profile](#profile)
- [Reports](#reports)
- [Admin](#admin)

---

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header.

### Getting an access token

```typescript
// Client-side (using AuthContext)
import { useAuth } from '@/components/auth/AuthContext';

const { getAccessToken } = useAuth();
const token = await getAccessToken();

// Include in requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

See [AUTH.md](../AUTH.md) for detailed authentication documentation.

---

## Workflows

### Run a workflow

Execute a workflow with provided inputs.

**Endpoint:** `POST /api/flow/run`

**Request:**

```typescript
interface RunWorkflowRequest {
  workflowId: string;
  inputs: Record<string, any>;
  isDemo?: boolean;  // Optional: run without auth
}
```

**Example:**

```bash
curl -X POST https://edgaze.com/api/flow/run \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "uuid",
    "inputs": {
      "topic": "AI ethics",
      "length": "500 words"
    }
  }'
```

**Response:**

```typescript
interface RunWorkflowResponse {
  success: boolean;
  outputs: Record<string, any>;
  runId: string;
  duration: number;
}
```

**Status codes:**
- `200` — Success
- `400` — Invalid input
- `401` — Unauthorized (missing or invalid token)
- `403` — Rate limit exceeded
- `500` — Server error

---

### Get remaining runs

Check how many runs a user has remaining for a workflow.

**Endpoint:** `GET /api/flow/run/remaining?workflowId={id}`

**Request:**

```bash
curl https://edgaze.com/api/flow/run/remaining?workflowId=uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```typescript
interface RemainingRunsResponse {
  remaining: number;
  limit: number;
  used: number;
}
```

---

### Run diagnostics

Get diagnostic information about workflow runs.

**Endpoint:** `GET /api/flow/run/diagnostic?workflowId={id}`

**Authentication:** Required

**Response:**

```typescript
interface DiagnosticResponse {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastRun: string | null;
}
```

---

## Prompts

### Create prompt

Create a new prompt in the studio.

**Endpoint:** `POST /api/prompts`

**Request:**

```typescript
interface CreatePromptRequest {
  title: string;
  content: string;
  placeholders?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select';
    required: boolean;
  }>;
  isPublic?: boolean;
}
```

**Response:**

```typescript
interface CreatePromptResponse {
  id: string;
  code: string;  // e.g., "@handle/prompt-name"
  url: string;
}
```

---

### Update prompt

Update an existing prompt.

**Endpoint:** `PATCH /api/prompts/{id}`

**Request:**

```typescript
interface UpdatePromptRequest {
  title?: string;
  content?: string;
  placeholders?: Array<Placeholder>;
  isPublic?: boolean;
}
```

---

### Publish prompt

Publish a prompt to the marketplace.

**Endpoint:** `POST /api/prompts/{id}/publish`

**Response:**

```typescript
interface PublishResponse {
  success: boolean;
  productUrl: string;
}
```

---

## Profile

### Get profile

Get current user's profile.

**Endpoint:** `GET /api/profile`

**Response:**

```typescript
interface ProfileResponse {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isFoundingCreator: boolean;
  createdAt: string;
}
```

---

### Update profile

Update user profile information.

**Endpoint:** `PATCH /api/profile`

**Request:**

```typescript
interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}
```

---

### Check handle availability

Check if a profile handle is available.

**Endpoint:** `GET /api/profile/check-handle?handle={handle}`

**Response:**

```typescript
interface HandleCheckResponse {
  available: boolean;
  reason?: string;  // If unavailable
}
```

---

### Change handle

Change user's profile handle (subject to cooldown).

**Endpoint:** `POST /api/profile/change-handle`

**Request:**

```typescript
interface ChangeHandleRequest {
  newHandle: string;
}
```

**Response:**

```typescript
interface ChangeHandleResponse {
  success: boolean;
  newHandle: string;
  nextChangeAllowed: string;  // ISO date
}
```

**Status codes:**
- `200` — Success
- `400` — Invalid handle or cooldown active
- `409` — Handle already taken

See [HANDLE_CHANGE_COOLDOWN.md](HANDLE_CHANGE_COOLDOWN.md) for details.

---

### Cascade handle change

Internal endpoint to update all references when handle changes.

**Endpoint:** `POST /api/profile/cascade-handle`

**Request:**

```typescript
interface CascadeHandleRequest {
  userId: string;
  oldHandle: string;
  newHandle: string;
}
```

---

## Reports

### Submit report

Report a workflow or prompt for review.

**Endpoint:** `POST /api/reports/submit`

**Request:**

```typescript
interface SubmitReportRequest {
  itemType: 'workflow' | 'prompt';
  itemId: string;
  reason: 'spam' | 'inappropriate' | 'copyright' | 'other';
  details?: string;
}
```

**Response:**

```typescript
interface SubmitReportResponse {
  success: boolean;
  reportId: string;
}
```

---

## Admin

Admin endpoints require authenticated users with admin privileges.

### Get token limits

Get rate limiting configuration.

**Endpoint:** `GET /api/admin/token-limits`

**Response:**

```typescript
interface TokenLimitsResponse {
  limits: Record<string, number>;
  currentUsage: Record<string, number>;
}
```

---

### Update token limits

Update rate limiting configuration.

**Endpoint:** `POST /api/admin/token-limits`

**Request:**

```typescript
interface UpdateLimitsRequest {
  userId: string;
  limits: Record<string, number>;
}
```

---

### Replenish demo runs

Reset demo run counters for testing.

**Endpoint:** `POST /api/admin/replenish-demo`

**Response:**

```typescript
interface ReplenishResponse {
  success: boolean;
  affected: number;
}
```

---

## Error responses

All endpoints follow a consistent error format:

```typescript
interface ErrorResponse {
  error: string;           // Human-readable message
  code?: string;          // Machine-readable error code
  details?: any;          // Additional error context
}
```

### Common error codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication token |
| `FORBIDDEN` | User lacks permission for this operation |
| `NOT_FOUND` | Requested resource does not exist |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `VALIDATION_ERROR` | Invalid input data |
| `INTERNAL_ERROR` | Server error |

---

## Rate limiting

Most endpoints are rate-limited to prevent abuse:

- **Anonymous requests:** 10 requests per minute
- **Authenticated requests:** 100 requests per minute
- **Workflow runs:** Varies by user tier and workflow

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1612345678
```

---

## Webhooks (Coming soon)

Webhook support is planned for version 2.0. This will allow external systems to:

- Trigger workflows on events
- Receive notifications on workflow completion
- Integrate with third-party services

---

## SDKs and libraries

### TypeScript/JavaScript

The Supabase JavaScript client is used for database operations:

```typescript
import { createBrowserClient } from '@/lib/supabase/browser';

const supabase = createBrowserClient();
```

See [Supabase documentation](https://supabase.com/docs) for client usage.

---

## Testing the API

### Using cURL

```bash
# Set your token
TOKEN="your-access-token"

# Test authenticated endpoint
curl -X GET https://edgaze.com/api/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman

1. Import API endpoints into Postman
2. Set `Authorization` header to `Bearer {{token}}`
3. Use environment variables for base URL and token

---

## Need help?

- **Authentication issues:** [AUTH.md](../AUTH.md)
- **Development setup:** [DEVELOPMENT.md](DEVELOPMENT.md)
- **Support:** [SUPPORT.md](../SUPPORT.md)

---

**Last updated:** February 11, 2026

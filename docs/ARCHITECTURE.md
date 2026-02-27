# Architecture

This document provides a comprehensive overview of Edge Platforms, Inc.'s technical architecture, design patterns, and system components.

---

## Table of contents

- [System overview](#system-overview)
- [Technology stack](#technology-stack)
- [Application architecture](#application-architecture)
- [Data architecture](#data-architecture)
- [Authentication & authorization](#authentication--authorization)
- [API design](#api-design)
- [State management](#state-management)
- [File structure](#file-structure)
- [Design patterns](#design-patterns)
- [Security architecture](#security-architecture)
- [Performance considerations](#performance-considerations)

---

## System overview

Edgaze is a **server-side rendered (SSR) web application** built on Next.js 16 with the App Router. The platform consists of three main products:

1. **Prompt Studio** — Create and manage structured AI prompts with placeholders
2. **Workflow Builder** — Design visual AI workflows with nodes and connections
3. **Marketplace** — Discover, browse, and run AI products

### High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                        │
│  (React 19, Next.js App Router, Tailwind CSS)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS / API Calls
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Application Layer                        │
│  (Next.js API Routes, Server Components, Middleware)       │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴────────────┐
           │                        │
┌──────────▼─────────┐   ┌─────────▼──────────┐
│  Supabase Auth     │   │  Supabase Database │
│  (User sessions)   │   │  (PostgreSQL + RLS)│
└────────────────────┘   └────────────────────┘
```

---

## Technology stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2 | UI framework |
| **Next.js** | 16.0 | React meta-framework with SSR |
| **TypeScript** | 5.6 | Type-safe JavaScript |
| **Tailwind CSS** | 3.4 | Utility-first CSS framework |
| **Framer Motion** | 12.23 | Animation library |
| **React Flow** | 11.11 | Workflow canvas visualization |
| **Lucide React** | 0.452 | Icon library |

### Backend

| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | RESTful API endpoints |
| **Supabase** | Auth + PostgreSQL database |
| **NextAuth** | Authentication middleware |
| **Row Level Security (RLS)** | Database-level authorization |

### Infrastructure

| Service | Purpose |
|---------|---------|
| **Vercel** | Hosting and deployment |
| **Supabase** | Database and auth infrastructure |
| **GitHub Actions** | CI/CD pipeline |
| **Mixpanel** | Analytics (optional) |

---

## Application architecture

### Rendering strategy

Edgaze uses **hybrid rendering** with Next.js:

- **Server Components (default)** — For pages that don't need client-side interactivity
- **Client Components** — For interactive UI elements (marked with `"use client"`)
- **Static Generation** — For marketing pages and documentation
- **Dynamic rendering** — For user-specific pages (profiles, dashboards)

### Component hierarchy

```
App Layout (src/app/layout.tsx)
│
├── Providers (auth, UI settings)
│   │
│   ├── AuthContext Provider
│   └── UISettings Provider
│
├── App Shell (navigation, sidebar)
│   │
│   ├── Sidebar (desktop)
│   ├── Mobile Topbar
│   └── Footer
│
└── Page Content
    │
    ├── Marketplace Page
    │   ├── MarketplaceTopBar
    │   ├── FeaturedBuildCTA
    │   └── Listings Grid
    │
    ├── Builder Page
    │   ├── NodeCanvas
    │   ├── BlockLibrary
    │   └── InspectorPanel
    │
    └── Profile Page
        ├── ProfileImageUploader
        └── PublicProfileView
```

---

## Data architecture

### Database schema

**Core tables:**

```sql
-- Users and profiles
profiles (
  id UUID PRIMARY KEY,
  handle TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_founding_creator BOOLEAN,
  created_at TIMESTAMP
)

-- Workflows
workflows (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT,
  description TEXT,
  graph JSONB,
  is_published BOOLEAN,
  likes_count INTEGER,
  created_at TIMESTAMP
)

-- Prompts
prompts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT,
  content TEXT,
  placeholders JSONB,
  is_published BOOLEAN,
  likes_count INTEGER,
  created_at TIMESTAMP
)

-- Workflow runs (tracking)
workflow_runs (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  user_id TEXT,
  status TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER
)

-- Likes (for prompts and workflows)
prompt_likes (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  user_id TEXT,
  created_at TIMESTAMP,
  UNIQUE(user_id, prompt_id)
)

workflow_likes (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  user_id TEXT,
  created_at TIMESTAMP,
  UNIQUE(user_id, workflow_id)
)
```

### Data flow

**Creating a workflow:**

```
User (Client)
  │
  ├─→ Save Draft
  │     │
  │     └─→ POST /api/workflows
  │           │
  │           └─→ Supabase: Insert into workflows table
  │
  └─→ Publish
        │
        └─→ POST /api/workflows/{id}/publish
              │
              ├─→ Update workflow.is_published = true
              └─→ Create marketplace listing
```

**Running a workflow:**

```
User (Client)
  │
  └─→ POST /api/flow/run
        │
        ├─→ Authenticate user (Bearer token)
        ├─→ Check run limits
        ├─→ Create workflow_runs record (status: pending)
        ├─→ Execute workflow graph
        │     │
        │     ├─→ Process input nodes
        │     ├─→ Execute prompt nodes (call AI APIs)
        │     └─→ Generate outputs
        │
        └─→ Update workflow_runs (status: completed)
```

---

## Authentication & authorization

### Authentication flow

Edgaze uses **Supabase Auth** with **Bearer token authentication** for API routes.

**Sign-in flow:**

```
1. User clicks "Sign in with Google"
   │
   └─→ Redirect to Supabase OAuth URL
       │
2.     User authorizes on Google
   │
   └─→ Callback to /auth/callback
       │
3.     Exchange code for session
   │
   └─→ Store session in browser (localStorage)
       │
4.     Redirect to app
   │
   └─→ Access token available via getAccessToken()
```

**API authentication:**

```typescript
// Client sends token
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};

// Server validates token
const { user, error } = await getUserFromRequest(req);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

See [AUTH.md](../AUTH.md) for complete authentication documentation.

### Authorization

**Row Level Security (RLS)** policies control data access:

```sql
-- Users can only update their own profiles
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id);

-- Anyone can read published workflows
CREATE POLICY "Anyone can read published workflows"
  ON workflows FOR SELECT
  USING (is_published = true);

-- Users can only edit their own workflows
CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id);
```

---

## API design

### RESTful conventions

All API routes follow REST principles:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/workflows` | List workflows |
| `GET` | `/api/workflows/{id}` | Get specific workflow |
| `POST` | `/api/workflows` | Create workflow |
| `PATCH` | `/api/workflows/{id}` | Update workflow |
| `DELETE` | `/api/workflows/{id}` | Delete workflow |
| `POST` | `/api/workflows/{id}/publish` | Publish workflow |

### Response format

**Success response:**

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-11T10:00:00Z"
  }
}
```

**Error response:**

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Status codes

- `200` — Success
- `201` — Created
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing/invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not Found
- `429` — Too Many Requests (rate limited)
- `500` — Internal Server Error

---

## State management

### Client-side state

Edgaze uses **React Context** for global state:

```typescript
// AuthContext — User authentication state
const { user, signIn, signOut, getAccessToken } = useAuth();

// UISettingsProvider — UI preferences
const { theme, sidebarCollapsed } = useUISettings();
```

### Server state

**Server Components** fetch data directly:

```typescript
// app/marketplace/page.tsx
export default async function MarketplacePage() {
  const supabase = createServerClient();
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .eq('is_published', true);

  return <MarketplaceGrid workflows={workflows} />;
}
```

### Form state

Forms use **controlled components** with React state:

```typescript
const [formData, setFormData] = useState({
  title: '',
  description: ''
});

const handleChange = (e) => {
  setFormData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }));
};
```

---

## File structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── flow/           # Workflow execution
│   │   ├── profile/        # Profile management
│   │   └── reports/        # Content reports
│   ├── marketplace/        # Marketplace page
│   ├── builder/            # Workflow builder
│   ├── prompt-studio/      # Prompt editor
│   └── [ownerHandle]/      # Dynamic profile pages
│
├── components/              # React components
│   ├── auth/               # Authentication UI
│   ├── builder/            # Workflow builder components
│   ├── marketplace/        # Marketplace components
│   ├── profile/            # Profile components
│   └── ui/                 # Reusable UI components
│
├── lib/                     # Utilities and configs
│   ├── supabase/           # Supabase clients
│   │   ├── browser.ts      # Client-side client
│   │   ├── server.ts       # Server-side client
│   │   └── admin.ts        # Admin (service role)
│   ├── auth/               # Auth helpers
│   └── utils.ts            # Utility functions
│
├── nodes/                   # Workflow node definitions
│   ├── input.ts
│   ├── output.ts
│   ├── premium.ts
│   └── registry.ts
│
└── styles/                  # Global styles
    ├── globals.css
    └── theme.css
```

---

## Design patterns

### Component patterns

**Compound components** (builder UI):

```typescript
<WorkflowBuilder>
  <WorkflowBuilder.Canvas />
  <WorkflowBuilder.Library />
  <WorkflowBuilder.Inspector />
</WorkflowBuilder>
```

**Higher-order components** (auth gates):

```typescript
export function AdminGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);

  if (!isAdmin) return <ForbiddenScreen />;
  return <>{children}</>;
}
```

### API patterns

**Consistent error handling:**

```typescript
try {
  const result = await performOperation();
  return NextResponse.json(result);
} catch (error) {
  console.error('Operation failed:', error);
  return NextResponse.json(
    { error: 'Operation failed' },
    { status: 500 }
  );
}
```

---

## Security architecture

### Defense in depth

1. **Client-side validation** — Immediate feedback
2. **API validation** — TypeScript + runtime checks
3. **Database RLS** — Row-level security policies
4. **Service role operations** — Only for privileged actions

### Secret management

- Environment variables in `.env.local` (never committed)
- Secrets stored in Vercel/deployment platform
- Service role key used only server-side
- Client-side code never accesses secrets

### Rate limiting

- IP-based rate limiting for anonymous requests
- User-based rate limiting for authenticated requests
- Workflow-specific run limits
- Database connection pooling

---

## Performance considerations

### Optimization strategies

1. **Server Components** — Reduce client bundle size
2. **Image optimization** — Next.js `<Image>` component
3. **Code splitting** — Dynamic imports for large components
4. **Caching** — Aggressive caching for static assets
5. **Database indexes** — Optimized queries with proper indexes
6. **Connection pooling** — Supabase connection limits

### Monitoring

- **Vercel Analytics** — Page load performance
- **Mixpanel** — User behavior tracking
- **Console logging** — Error tracking (production)
- **Database slow query log** — Query optimization

---

## Future architecture

### Planned improvements

- **Edge functions** — Deploy API routes to edge locations
- **Real-time collaboration** — WebSocket support for multiplayer editing
- **Caching layer** — Redis for session and run caching
- **Background jobs** — Queue system for long-running workflows
- **Microservices** — Extract AI execution into dedicated service

---

## Related documentation

- [OVERVIEW.md](OVERVIEW.md) — Technical standards
- [DEVELOPMENT.md](DEVELOPMENT.md) — Local development setup
- [AUTH.md](../AUTH.md) — Authentication patterns
- [API.md](API.md) — API reference

---

**Last updated:** February 11, 2026

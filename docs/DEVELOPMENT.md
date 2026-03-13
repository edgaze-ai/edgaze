# Development guide

This guide walks you through setting up a local development environment for Edgaze and explains the development workflow.

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Initial setup](#initial-setup)
- [Database setup](#database-setup)
- [Running the application](#running-the-application)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure you have the following installed:

| Tool             | Version | Purpose                                        |
| ---------------- | ------- | ---------------------------------------------- |
| **Node.js**      | 20+     | JavaScript runtime                             |
| **npm**          | 9+      | Package manager (bundled with Node.js)         |
| **Git**          | Latest  | Version control                                |
| **Supabase CLI** | Latest  | Database management (optional but recommended) |

### Optional tools

- **pnpm** or **yarn** — Alternative package managers
- **VS Code** — Recommended editor with TypeScript support
- **Cursor** — AI-powered IDE with Supabase MCP integration

---

## Initial setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd edgaze-prod
```

### 2. Install dependencies

```bash
npm install
```

This installs all production and development dependencies defined in `package.json`.

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and configure the following:

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication (NextAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# OAuth providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Analytics (optional)
NEXT_PUBLIC_MIXPANEL_TOKEN=your-mixpanel-token
```

**Where to find these values:**

- **Supabase keys:** Project Settings → API in your Supabase dashboard
- **NextAuth secret:** Generate with `openssl rand -base64 32`
- **Google OAuth:** [Google Cloud Console](https://console.cloud.google.com/)

---

## Database setup

### Option A: Using Supabase CLI (recommended)

1. **Install Supabase CLI**

   ```bash
   npm install -g supabase
   ```

2. **Link to your project**

   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Push migrations**

   ```bash
   supabase db push
   ```

### Option B: Manual setup

1. Open your Supabase dashboard → SQL Editor
2. Run each migration file from `supabase/migrations/` in chronological order
3. Verify tables are created correctly

### Verify setup

Run this query in the SQL Editor to check that tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see tables like `profiles`, `workflows`, `prompts`, `workflow_runs`, etc.

---

## Running the application

### Development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

**Features:**

- ✅ Hot reload on file changes
- ✅ Fast refresh for React components
- ✅ TypeScript type checking in real-time
- ✅ ESLint warnings in terminal

### Production build

To test the production build locally:

```bash
npm run build
npm run start
```

This creates an optimized build in `.next/` and starts a production server.

---

## Project structure

```
edgaze-prod/
├── public/              # Static assets (images, fonts, etc.)
├── src/
│   ├── app/            # Next.js App Router pages and API routes
│   │   ├── api/        # API endpoints
│   │   ├── [ownerHandle]/  # Dynamic profile routes
│   │   └── ...         # Other pages
│   ├── components/     # React components
│   │   ├── auth/       # Authentication components
│   │   ├── builder/    # Workflow builder UI
│   │   ├── marketplace/# Marketplace components
│   │   └── ...
│   ├── lib/            # Shared utilities and configs
│   │   ├── supabase/   # Supabase client configurations
│   │   ├── auth/       # Auth helpers
│   │   └── ...
│   ├── nodes/          # Workflow node definitions
│   └── styles/         # Global styles
├── supabase/
│   └── migrations/     # Database migrations (chronological)
├── docs/               # Documentation
└── [config files]      # Various configuration files
```

### Key directories

- **`src/app/api/`** — API routes following Next.js convention
- **`src/components/`** — Reusable React components (organized by feature)
- **`src/lib/supabase/`** — Supabase client setup (browser, server, admin)
- **`supabase/migrations/`** — SQL migrations (apply in order)

---

## Development workflow

### 1. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make changes

- Write code following existing patterns
- Run `npm run lint` frequently to catch issues early
- Use TypeScript strictly — avoid `any` types

### 3. Test locally

```bash
npm run dev
```

- Test in browser at `localhost:3000`
- Check browser console for errors
- Test authentication flows

### 4. Type check and lint

```bash
npm run typecheck  # Check TypeScript types
npm run lint       # Check code style
```

Fix any errors before committing.

### 5. Commit changes

```bash
git add .
git commit -m "feat: add feature description"
```

Use [conventional commit](https://www.conventionalcommits.org/) format:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `refactor:` — Code refactoring
- `test:` — Test additions
- `chore:` — Maintenance tasks

### 6. Push and create pull request

```bash
git push origin feature/your-feature-name
```

Open a PR in the internal repository with a clear description of changes.

---

## Testing

### Manual testing

Currently, testing is done manually:

1. **Authentication flows**
   - Sign up with email
   - Sign in with Google
   - Password reset
   - Email verification

2. **Workflow builder**
   - Create new workflow
   - Add nodes and connections
   - Test run execution
   - Publish workflow

3. **Marketplace**
   - Browse listings
   - Search functionality
   - View product pages
   - Run workflows from marketplace

### Database testing

Test migrations locally before pushing:

```bash
# Reset database (WARNING: destroys data)
supabase db reset

# Apply migrations
supabase db push
```

---

## Troubleshooting

### Common issues

#### Port 3000 already in use

```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

#### Module not found errors

```bash
# Clear Next.js cache and reinstall
rm -rf .next node_modules
npm install
```

#### Supabase connection errors

- Verify environment variables in `.env.local`
- Check that your Supabase project is not paused
- Ensure your IP is not blocked by Supabase

#### Type errors after updating dependencies

```bash
# Regenerate TypeScript types from Supabase
npx supabase gen types typescript --project-id your-project-ref > src/types/supabase.ts
```

### Getting help

- Check [AUTH.md](../AUTH.md) for authentication issues
- Review [OVERVIEW.md](OVERVIEW.md) for architecture questions
- See [SUPPORT.md](../SUPPORT.md) for contact information

---

## Code style and conventions

### TypeScript

- Always define types explicitly for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` — use `unknown` if type is truly unknown
- Use discriminated unions for variants

### React components

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components small and focused (< 200 lines)
- Use TypeScript interfaces for props

### File organization

- One component per file
- Co-locate related files (components, styles, tests)
- Use index files for public exports
- Name files consistently (PascalCase for components, kebab-case for utilities)

### API routes

- Follow RESTful conventions
- Use proper HTTP status codes
- Validate input with TypeScript
- Handle errors gracefully with try/catch
- Use `getUserFromRequest` for authenticated routes (see [AUTH.md](../AUTH.md))

---

## Performance tips

### Development

- Use React DevTools to profile components
- Monitor bundle size with `npm run build`
- Check Lighthouse scores regularly

### Production considerations

- Images should be optimized (WebP format preferred)
- Use Next.js `<Image>` component for automatic optimization
- Implement proper caching headers for static assets
- Use dynamic imports for large components

---

## Next steps

- Read [OVERVIEW.md](OVERVIEW.md) for architecture details
- Review [AUTH.md](../AUTH.md) for authentication patterns
- Check the PR template in `.github/PULL_REQUEST_TEMPLATE.md` for submission guidelines
- See [ROADMAP.md](ROADMAP.md) for upcoming features

Happy coding! 🚀

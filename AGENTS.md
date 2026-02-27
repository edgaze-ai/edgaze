# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Edgaze is a single Next.js 16 (App Router) application — an AI marketplace for prompts and workflows. Backend is Supabase (cloud-hosted, not local). No Docker, no monorepo, no test framework.

### Running the app

- `npm run dev` starts the dev server on port 3000.
- All required environment variables are injected as secrets. The `.env.local` file must be generated at setup time from those environment variables (it is gitignored).
- The app depends on a remote Supabase project for auth, database, and storage. Without valid Supabase credentials, API routes will fail but the landing page and static pages still render.

### Key commands

See `package.json` scripts. Summary:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run lint` | ESLint (uses `\|\| true`, always exits 0) |
| `npm run typecheck` | TypeScript type checking |
| `npm run format` | Prettier formatting |

### Non-obvious caveats

- **Lint script always exits 0**: The `lint` script in `package.json` appends `|| true`, so it never fails CI. Check the actual output for errors/warnings.
- **No automated test framework**: There are no Jest, Vitest, Cypress, or Playwright tests. Testing is manual per `docs/DEVELOPMENT.md`.
- **Node.js version**: `.nvmrc` specifies Node 20, but `engines` field says `>=20`. Node 22 works.
- **Auth-gated features**: Builder (`/builder`) and Prompt Studio publishing require authentication. The marketplace (`/marketplace`) and prompt-studio editor (`/prompt-studio`) work without auth.
- **`.env.local` must be created from environment secrets**: This file is gitignored. Future agents must regenerate it from injected secrets if it doesn't exist. Use the pattern in the update script.
- **Next.js 16 with Turbopack**: The build uses Turbopack. If you see stale cache issues, run `rm -rf .next` before rebuilding.

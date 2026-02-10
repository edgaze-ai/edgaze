# Contributing to Edgaze

Thank you for contributing. Edgaze is a private codebase; contributions are limited to authorized team members and collaborators.

---

## Before you start

1. **Access** — Confirm you have repository access and required secrets (Supabase, auth, etc.).
2. **Branch** — Create a branch from `main` or `develop`:  
   `feature/short-name` or `fix/issue-description`.
3. **Setup** — Follow [Getting started](README.md#getting-started) in the README (Node 20+, env from `.env.example`).
4. **Standards** — Run `npm run lint` and `npm run typecheck` before pushing. CI runs these on every push and PR.

---

## Pull request process

1. Open a pull request against `main` or `develop` as appropriate.
2. Complete the PR template (description, testing, related issues).
3. Ensure CI passes (lint, typecheck, build).
4. Request review from a maintainer. Merges are done after approval.

---

## Code and documentation

- **Auth** — Use [AUTH.md](AUTH.md) for authentication in API routes. Use the shared helper and Bearer tokens; do not rely on cookies for identity in API handlers.
- **Conventions** — Follow existing patterns (Supabase clients, error handling, naming). See [docs/OVERVIEW.md](docs/OVERVIEW.md) for principles and standards.
- **Commits** — Use clear, descriptive commit messages.

---

## Questions

For internal questions, use your team’s usual channels. For security issues, see [SECURITY.md](SECURITY.md).

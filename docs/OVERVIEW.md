# Edgaze — Architecture & standards

This document outlines the technical posture and standards behind Edgaze. It is intended for engineers and maintainers.

---

## Principles

- **Clarity over cleverness.** Code and APIs are written to be read. Naming and structure are consistent.
- **Explicit auth.** API routes that need identity use Bearer tokens and a single helper; we do not rely on implicit cookie state for critical paths. See [AUTH.md](../AUTH.md).
- **Type safety.** TypeScript is used throughout. Public surfaces and internal modules are typed; `any` is avoided.
- **Single source of truth.** Config, feature flags, and env are centralized where possible. Duplication is minimized.
- **Controlled dependencies.** Dependencies are kept current via Dependabot; upgrades are reviewed and tested before merge.

---

## Stack at a glance

| Area | Choice | Rationale |
|------|--------|-----------|
| Framework | Next.js 16 (App Router) | SSR, API routes, and a single codebase for web. |
| Language | TypeScript 5.6 | Type safety and maintainability. |
| UI | React 18, Tailwind, Framer Motion | Component-driven UI with consistent styling and motion. |
| Backend / data | Supabase | Auth, Postgres, and realtime where needed. |
| Runtime | Node.js 20+ | LTS alignment and modern JS features. |

---

## Quality gates

- **Lint** — ESLint runs on push and in CI. Warnings are addressed or explicitly suppressed with justification.
- **Typecheck** — `tsc --noEmit` runs in CI. The codebase is kept in a zero-error state.
- **Build** — `next build` must succeed in CI. No build-time warnings that indicate real issues.
- **Releases** — Version tags (`v*.*.*`) trigger a GitHub Release. Changelog entries are updated for each release.

---

## Security posture

- **Auth** — Supabase Auth (email/password, Google). API routes that need the current user use Bearer tokens and `getUserFromRequest`; see [AUTH.md](../AUTH.md).
- **Secrets** — No secrets in repo or client bundle. Env and keys are provided via environment or secret store.
- **Disclosure** — Security issues are reported privately. See [SECURITY.md](../SECURITY.md).

---

## Document map

| Document | Purpose |
|----------|---------|
| [README](../README.md) | Product overview, getting started, docs index. |
| [AUTH](../AUTH.md) | Authentication flow and how to use it in API routes. |
| [CHANGELOG](../CHANGELOG.md) | Version history and release notes. |
| [SECURITY](../SECURITY.md) | Supported versions and vulnerability reporting. |
| [CONTRIBUTING](../CONTRIBUTING.md) | Branching, PR process, and conventions. |

This overview is maintained as the project evolves. For implementation details, see the codebase and the docs above.

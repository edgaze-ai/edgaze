# Changelog

All notable changes to Edgaze are documented in this file.

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware Corporation.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

Nothing yet on `main` after **1.2.3**; future work will be listed here.

---

## [1.2.3] — 2026-04-07

### Security

- Addressed multiple dependency advisories reported via automated security scanning.

### Added

- Creator provisioning flow, **verified creators**, and related admin tooling (including account ownership transfer where appropriate).
- **Anthropic** and **Gemini** nodes and expanded LLM options in Workflow Builder; Invest (marketing) page updates alongside builder work.

### Changed

- **Runtime / execution engine**: streaming, latency, trace handling and load-oriented behavior, execution logging, session bundles, and sharper Builder vs consumer run experience; hosting and routing hardening; **Gemini** integration fixes.
- **Branding & discovery**: raster favicon set; Open Graph / social icon pipeline; site metadata uses a consistent origin for URLs; README expanded for product and architecture overview.
- **Legal**: revised **EDGAZE proprietary software license** agreement shipped in-repo (see `LICENSE` / legal docs).

### Fixed

- PDF viewer, mobile runtime modal, link previews / SEO surfaces, demo mode edge cases, and assorted runtime–builder bugs from production feedback.

---

## [1.2.2] — 2026-03-26

### Security

- Security-related fixes across the web app and API surfaces.

### Changed

- About page copy and layout; Mixpanel instrumentation updates.

### Fixed

- Link previews, product preview images, price display on product UI, builder/runtime issues, and general UI regressions.

---

## [1.2.1] — 2026-03-16

### Changed

- SEO refinements and an updated **sitemap** for crawlers.

### Fixed

- Style and layout consistency fixes (including press layout).

---

## [1.2.0] — 2026-03-15

### Added

- **Stripe Connect**: seller onboarding, creator payouts, marketplace fees alignment, and supporting policy/docs pages.
- **Edgaze Blog** surface, **creator program** flows, **creator invites**, and **“trending this week”** style discovery on the storefront.
- Expanded **legal** pages, cron configuration for operational jobs, and a larger **docs portal** refresh.

### Changed

- Landing and product pages; workflow **backwards compatibility** for published graphs; error-detection component behavior; product page structure in places.

### Security

- Broader security hardening alongside payments work.

### Fixed

- CI/build stability, Stripe edge cases, and assorted marketplace/builder bugs.

---

## [1.1.0] — 2026-02-23

### Added

- **Welcome email** on signup; **demo mode** for trying flows without a full account (where enabled).
- Builder **inspector** and node library updates, **error detector**, improved input pipeline, **admin run tracking**, and builder-side security improvements.
- **SEO**: sitelinks-oriented structured data and clearer navigation semantics.

### Changed

- Profile area and **password reset** flow; top bar profile affordances.

### Fixed

- Email delivery and profile-update bugs; general builder UX issues.

---

## [1.0.0] — 2026-02-15

### Initial release

The first semver-tagged production baseline of Edgaze, featuring a complete marketplace platform for AI products.

### Added

#### Core features

- **Prompt Studio** — Create structured prompts with dynamic placeholders
  - Visual placeholder editor
  - Version control and history
  - One-click publish to marketplace
  - Dedicated product pages with Edgaze codes (e.g., `@handle/prompt-name`)
- **Workflow Builder** — Visual AI workflow designer
  - Drag-and-drop node-based interface
  - Input, output, and prompt nodes
  - Conditional logic and branching
  - Real-time workflow execution
  - Run tracking and analytics
  - One-click publish with shareable links
- **Marketplace** — Curated discovery platform
  - Browse and search AI products
  - Featured builds and recommendations
  - Creator storefronts (profile pages)
  - Product pages with descriptions and previews
  - Like and favorite functionality
  - Comments and community feedback

#### Authentication & user management

- Email/password authentication via Supabase Auth
- Google OAuth integration
- Profile management with custom handles
- Handle change cooldown system (30-day limit)
- Email verification flow
- Founding Creator badge system

#### Infrastructure

- Next.js 16 App Router architecture
- TypeScript 5.6 throughout
- Supabase PostgreSQL with Row Level Security
- Vercel deployment with GitHub Actions CI/CD
- Mixpanel analytics integration
- Responsive design with Tailwind CSS

#### Developer experience

- Comprehensive authentication documentation (AUTH.md)
- Architecture and standards guide (OVERVIEW.md)
- Database migration system
- Environment configuration templates
- ESLint and TypeScript strict mode
- GitHub issue and PR templates

### Technical details

#### Database

- 22 database migrations
- Row Level Security policies for all tables
- Handle redirect system for SEO
- Workflow run tracking and counting
- Anonymous demo run support
- Marketplace owner handle synchronization

#### Security

- Bearer token authentication for API routes
- Input validation and sanitization
- Rate limiting (IP and user-based)
- Secure environment variable handling
- Content reporting and moderation tools
- Vulnerability disclosure policy (SECURITY.md)

#### Performance

- Server-side rendering with Next.js
- Optimized image loading
- Code splitting and lazy loading
- Database query optimization with indexes
- Client-side caching strategies

---

## Version history

| Version | Date       | Summary                              |
| ------- | ---------- | ------------------------------------ |
| 1.2.3   | 2026-04-07 | Runtime, builder, security, branding |
| 1.2.2   | 2026-03-26 | Security, About, previews, UI        |
| 1.2.1   | 2026-03-16 | SEO / sitemap                        |
| 1.2.0   | 2026-03-15 | Stripe Connect, blog, docs           |
| 1.1.0   | 2026-02-23 | Builder 2.0 wave, welcome email      |
| 1.0.0   | 2026-02-15 | Initial semver release               |

---

## Upgrade notes

### Upgrading to 1.2.x from 1.1.x

- If you operate creator payouts, configure **Stripe Connect** and environment variables per `docs/` payment setup guides.
- Review license and terms changes from **1.2.3** if you redistribute or embed Edgaze-branded assets.

### Upgrading to 1.1.x from 1.0.0

- No special database migration notes here; follow deployment runbooks for your environment.

---

## Links

- [Documentation](docs/)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)
- [GitHub releases & tags](https://github.com/edgaze-ai/edgaze/releases) (use tags to compare revisions)

---

**Note:** Edgaze is a closed-source, proprietary platform. Version history is maintained internally.

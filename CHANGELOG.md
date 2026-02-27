# Changelog

All notable changes to Edgaze are documented in this file.

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive documentation suite (DEVELOPMENT.md, API.md, ARCHITECTURE.md, ROADMAP.md)
- Enhanced README with improved structure and visuals
- Premium repository configuration (.editorconfig, .gitattributes, VS Code settings)
- Improved GitHub templates (issue templates, PR template, CI workflow)
- Code of Conduct for team members
- CODEOWNERS file for review assignment

### Changed
- Reorganized documentation into `docs/` folder
- Enhanced environment variable configuration (.env.example)
- Improved package.json with additional metadata and scripts
- Updated CI workflow with better job organization and formatting checks

### Fixed
- (Bug fixes will be documented here)

---

## [1.0.0] — 2025-02-10

### Initial release

The first production-ready version of Edgaze, featuring a complete marketplace platform for AI products.

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

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2025-02-10 | Initial release |

---

## Upgrade notes

### Upgrading to 1.x

This is the initial release. No upgrade path necessary.

---

## Links

- [Documentation](docs/)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)

---

**Note:** Edgaze is a closed-source, proprietary platform. Version history is maintained internally.

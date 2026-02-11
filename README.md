<div align="center">

<img src="public/brand/edgaze-mark.png" alt="Edgaze" width="120" height="120" />

# Edgaze

### *Create, sell, and distribute AI products.*

A curated marketplace for prompts and workflows. One link. One experience. Built for creators who ship.

<br />

[![Release](https://img.shields.io/badge/Release-1.0.0-111827?style=for-the-badge&labelColor=18181b)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white&labelColor=000000)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=2d3748)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white&labelColor=1e293b)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-7f1d1d?style=for-the-badge&labelColor=18181b)](LICENSE)

<br />

**[Overview](#overview)** · **[Product](#product)** · **[Screenshots](#screenshots)** · **[Tech Stack](#tech-stack)** · **[Quick Start](#quick-start)** · **[Documentation](#documentation)**

</div>

---

## Overview

Edgaze is a **first-party platform** for building, publishing, and distributing AI products at scale. Prompts and workflows get a permanent home: a clean product page, a short **Edgaze code** (e.g. `@handle/essay`), and a single shareable link. No fragmentation—just one place to create, one place to discover, one place to run.

*Built for reliability, designed for clarity.*

---

## Product

| Pillar | Description |
|--------|-------------|
| **Prompt Studio** | Structured prompts with placeholders. Version control, one-click publish, and a polished product page for every prompt. |
| **Workflow Builder** | Visual flows: inputs, prompts, tools, outputs. One canvas. One link. Repeatable, shareable runs. |
| **Marketplace** | Curated discovery and search. Creators get a storefront; users open and run in one tap. |

Every asset gets a **canonical URL** and an **Edgaze code**. The platform is in **beta**; creators can set prices—payments will follow in a future release.

---

## Screenshots

<div align="center">

**Landing** — Enter a code, open a prompt or workflow.

<img src="public/landing.png" alt="Edgaze landing" width="800" />

<br /><br />

**Workflow Builder** — Visual canvas. Publish and share.

<img src="public/builder.png" alt="Edgaze workflow builder" width="800" />

</div>

---

## Tech stack

<table>
<tr>
<td>

**Frontend**
- Next.js 16 (App Router)
- React 19
- TypeScript 5.6
- Tailwind CSS
- Framer Motion

</td>
<td>

**Backend**
- Supabase (Auth + PostgreSQL)
- Next.js API Routes
- Row Level Security (RLS)
- Edge Functions

</td>
<td>

**Infrastructure**
- Node.js 20+
- Vercel (deployment)
- GitHub Actions (CI/CD)

</td>
</tr>
</table>

---

## Quick start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** 9+ (bundled with Node.js) or **pnpm**
- **Supabase account** ([Sign up](https://supabase.com/))

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd edgaze-prod
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment**

   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following required variables in `.env.local`:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

4. **Run database migrations**

   ```bash
   # Using Supabase CLI
   npx supabase db push
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) 🚀

### Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm run start` | Start production server (requires build) |
| `npm run lint` | Run ESLint to check code quality |
| `npm run typecheck` | Run TypeScript compiler checks |

### Development workflow

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions, architecture overview, and contribution guidelines.

---

## Documentation

### Core documentation

| Document | Description |
|----------|-------------|
| [**Quick Start**](#quick-start) | Get up and running in minutes |
| [**Development Guide**](docs/DEVELOPMENT.md) | Local setup and development workflow |
| [**Architecture**](docs/OVERVIEW.md) | Technical architecture and standards |
| [**Authentication**](AUTH.md) | Auth implementation and API patterns |
| [**API Reference**](docs/API.md) | API routes and endpoints |

### Additional resources

| Document | Description |
|----------|-------------|
| [**Changelog**](CHANGELOG.md) | Release history and notable changes |
| [**Security Policy**](SECURITY.md) | Vulnerability disclosure and supported versions |
| [**Support**](SUPPORT.md) | How to get help |
| [**Roadmap**](docs/ROADMAP.md) | Planned features and future direction |

### Feature-specific guides

- [**Handle Change Cooldown**](docs/HANDLE_CHANGE_COOLDOWN.md) — Profile handle management
- [**Run Counter Fix**](docs/RUN_COUNTER_FIX.md) — Workflow run tracking
- [**Cursor + Supabase MCP**](docs/CURSOR_SUPABASE_MCP.md) — Development tooling

### Releases

Version tags (e.g., `v1.0.0`) automatically trigger GitHub Releases. See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).

---

## Project status

- ✅ **Production ready** — Stable and actively maintained
- 🎯 **Version 1.0** — Production release
- 🔒 **Closed source** — Proprietary platform for authorized use only

---

## License

**Proprietary software.** All rights reserved.

This is a closed-source, commercial platform. See [LICENSE](LICENSE) for full terms.

Unauthorized copying, modification, distribution, or use is strictly prohibited.

---

<div align="center">

**Edgaze** — *Create → Sell → Distribute*

Built with Next.js, TypeScript, and Supabase

</div>

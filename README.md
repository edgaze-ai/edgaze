<div align="center">

<img src="public/brand/edgaze-mark.png" alt="Edgaze" width="96" height="96" />

# **Edgaze**

### *Create, sell, and distribute AI products.*

A curated marketplace for prompts and workflows. One link. One experience. Built for creators who ship.

<br />

[![Release](https://img.shields.io/badge/Release-1.0.0-111827?style=for-the-badge)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-7f1d1d?style=for-the-badge)](LICENSE)

<br />

[**Overview**](#overview) · [**Product**](#product) · [**Screenshots**](#screenshots) · [**Tech**](#tech-stack) · [**Getting started**](#getting-started) · [**Docs**](#documentation)

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

| Layer | Choice |
|-------|--------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5.6 |
| **UI** | React 18, Tailwind CSS, Framer Motion |
| **Runtime** | Node.js 20+ |

---

## Getting started

**Prerequisites:** Node.js 20+, npm (or pnpm/yarn).

1. **Clone** and install dependencies:

   ```bash
   npm install
   ```

2. **Environment:** Copy `.env.example` to `.env.local` and configure variables for your environment.

3. **Run** the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | Lint |
| `npm run typecheck` | Type check |

---

## Documentation

| Document | Description |
|----------|-------------|
| [**CHANGELOG**](CHANGELOG.md) | Release history and notable changes |
| [**SECURITY**](SECURITY.md) | Vulnerability disclosure and supported versions |
| [**CONTRIBUTING**](CONTRIBUTING.md) | Contribution guidelines (internal) |
| [**SUPPORT**](SUPPORT.md) | How to get help |
| [**AUTH**](AUTH.md) | Authentication implementation |
| [**OVERVIEW**](docs/OVERVIEW.md) | Architecture and standards |

### Releases

Releases are published when version tags are pushed (e.g. `v1.0.0`). See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).

---

<div align="center">

**Edgaze** — *Create → Sell → Distribute*

</div>

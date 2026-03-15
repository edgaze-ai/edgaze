# Documentation

Welcome to the Edgaze documentation. This directory contains comprehensive guides, references, and resources for **authorized developers** working on the platform.

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware Corporation.

⚠️ **Note:** Edgaze is a **closed-source, proprietary platform**. This documentation is confidential and for internal use only.

---

## 📚 Documentation index

### Getting started

| Document                                | Description                       | Audience       |
| --------------------------------------- | --------------------------------- | -------------- |
| [**Quick Start**](QUICK_START.md)       | Get up and running in 10 minutes  | New developers |
| [**Development Guide**](DEVELOPMENT.md) | Complete local setup and workflow | All developers |

### Architecture & design

| Document                            | Description                          | Audience                    |
| ----------------------------------- | ------------------------------------ | --------------------------- |
| [**Architecture**](ARCHITECTURE.md) | System design and technical overview | Technical leads, architects |
| [**Overview**](OVERVIEW.md)         | Principles, stack, and standards     | All developers              |
| [**API Reference**](API.md)         | Complete API endpoint documentation  | Backend developers          |

### Feature-specific guides

| Document                                                | Description                      | Audience           |
| ------------------------------------------------------- | -------------------------------- | ------------------ |
| [**Handle Change Cooldown**](HANDLE_CHANGE_COOLDOWN.md) | Profile handle management system | Backend developers |
| [**Run Counter Fix**](RUN_COUNTER_FIX.md)               | Workflow run tracking solution   | Backend developers |
| [**Cursor + Supabase MCP**](CURSOR_SUPABASE_MCP.md)     | Development tooling integration  | All developers     |

### Project management

| Document                         | Description                           | Audience             |
| -------------------------------- | ------------------------------------- | -------------------- |
| [**Roadmap**](ROADMAP.md)        | Planned features and future direction | Product, engineering |
| [**Changelog**](../CHANGELOG.md) | Version history and release notes     | All stakeholders     |

---

## 📖 Core documentation (root level)

These documents are in the repository root:

| Document                                     | Description                      |
| -------------------------------------------- | -------------------------------- |
| [**README**](../README.md)                   | Project overview and quick links |
| [**Authentication**](../AUTH.md)             | Auth implementation patterns     |
| [**Security Policy**](../SECURITY.md)        | Vulnerability reporting          |
| [**Code of Conduct**](../CODE_OF_CONDUCT.md) | Professional standards           |
| [**Support**](../SUPPORT.md)                 | How to get help                  |
| [**Supabase Setup**](../SUPABASE_SETUP.md)   | Database setup guide             |

---

## 🚀 Quick links by role

### New developer

Start here:

1. [Quick Start](QUICK_START.md) — Get running in 10 minutes
2. [Development Guide](DEVELOPMENT.md) — Understand the workflow
3. [Architecture](ARCHITECTURE.md) — Learn the system design

### Frontend developer

Useful docs:

- [Development Guide](DEVELOPMENT.md) — Component patterns
- [Architecture](ARCHITECTURE.md) — Frontend architecture
- [API Reference](API.md) — Backend integration

### Backend developer

Useful docs:

- [Authentication](../AUTH.md) — Auth patterns
- [API Reference](API.md) — Endpoint specifications
- [Architecture](ARCHITECTURE.md) — Data architecture
- Feature guides (Handle Change, Run Counter)

### DevOps / Infrastructure

Useful docs:

- [Architecture](ARCHITECTURE.md) — System overview
- [Development Guide](DEVELOPMENT.md) — Build and deploy
- [Security Policy](../SECURITY.md) — Security practices

### Product / Management

Useful docs:

- [README](../README.md) — Product overview
- [Roadmap](ROADMAP.md) — Future plans
- [Changelog](../CHANGELOG.md) — Release history

---

## 📝 Documentation standards

When writing documentation:

### Format

- Use Markdown for all docs
- Include table of contents for long docs
- Use proper heading hierarchy (h1 → h2 → h3)
- Keep line length reasonable (~100 characters)

### Structure

- Start with a clear summary
- Include practical examples
- Use tables for comparisons
- Add code snippets with syntax highlighting
- Link to related documentation

### Tone

- Be clear and concise
- Use active voice
- Write for your audience
- Avoid jargon when possible
- Define technical terms

### Maintenance

- Update docs when code changes
- Keep examples working and tested
- Review docs during code review
- Archive outdated information
- Update "Last updated" dates

---

## 🔍 Finding what you need

### Search strategy

1. **Start with README** — High-level overview
2. **Check Quick Start** — For setup issues
3. **Browse this index** — Find specific topics
4. **Use search** — GitHub's search or `grep`

### By topic

| Topic              | Document                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| **Setup**          | [Quick Start](QUICK_START.md), [Development](DEVELOPMENT.md)            |
| **Authentication** | [AUTH.md](../AUTH.md)                                                   |
| **API**            | [API Reference](API.md)                                                 |
| **Database**       | [Architecture](ARCHITECTURE.md), [Supabase Setup](../SUPABASE_SETUP.md) |
| **Architecture**   | [Architecture](ARCHITECTURE.md), [Overview](OVERVIEW.md)                |
| **Security**       | [Security Policy](../SECURITY.md)                                       |
| **Features**       | Feature-specific guides                                                 |

---

## 🤝 Contributing to docs

Found an issue or want to improve the docs?

1. **Small fixes** — Submit a PR to the internal repository
2. **Large changes** — Discuss with team lead first
3. **New docs** — Follow existing structure and style

---

## 📧 Need help?

- **Can't find what you need?** Contact your team lead
- **Found an error?** Submit a PR to fix it
- **Have a question?** See [Support](../SUPPORT.md)

---

## 📊 Documentation coverage

Current status:

✅ **Getting started** — Complete  
✅ **Architecture** — Complete  
✅ **API reference** — Complete  
✅ **Contributing** — Complete  
✅ **Security** — Complete  
🚧 **Testing guide** — Planned  
🚧 **Deployment guide** — Planned

---

**Last updated:** February 11, 2026

_Documentation is continuously improved. Contributions welcome!_

# VIBETech Core

VIBETech Core is the reusable production platform that powers **AI Employees** for multiple industries, starting with:

- Law Firms
- Financial Advisors
- Manufacturing
- Construction
- Real Estate
- Auto Dealerships

This repository is designed as the **core SaaS foundation**: shared infrastructure, conventions, and service boundaries that can be extended per industry without rewriting the entire platform.

## Project Goals

1. Provide a production-ready backend foundation (Node.js + Express) with a scalable folder architecture.
2. Standardize configuration, middleware boundaries, data access patterns, and integration points for multiple industries.
3. Keep Phase 1 intentionally minimal: no business logic, no routes, and no AI—just project initialization and structure.

## Folder Overview

### Backend

`backend/` contains the Express server entrypoint plus platform boundaries:
- `backend/core/` defines core runtime conventions (no industry-specific code)
- `backend/providers/` hosts integration/provider adapters (e.g., database, LLM, external systems)
- `backend/knowledge/` contains curated knowledge assets used by employees at runtime

### Frontend

`frontend/` is present as a dedicated app workspace (to be implemented in later phases).

### Platform-level directories

- `docs/` - product and engineering documentation
- `employees/` - industry-specific AI Employee definitions (manifests + prompt/rules + tests/examples)
- `integrations/` - connectors to third-party services (industry and platform integrations)
- `shared/` - cross-cutting shared utilities and primitives
- `prompts/` - prompt assets for AI Employee capabilities
- `scripts/` - automation scripts (devops, migrations, tooling)
- `examples/` - reference projects and runnable examples for developers
- `tests/` - platform tests (unit/integration/e2e as the platform grows)

## Technology Stack

- Backend: Node.js + Express (ES Modules)
- Database (development): SQLite (future PostgreSQL)
- Language: JavaScript (ES Modules)
- Package manager: npm
- Version control: Git

## Development Philosophy

- Build **real foundations** early: predictable structure, environment-driven configuration, and boundaries that support growth.
- Avoid premature business logic: wire conventions now, implement industry-specific behavior later under `employees/`.
- Keep components small and composable: controllers, services, models, and tools have clear responsibilities.
- Prefer production-grade defaults: consistent error handling patterns, security-aware middleware, and deployment-friendly scripts.

## Getting Started (Backend Only)

From `backend/`:

```bash
npm install
npm run dev
```



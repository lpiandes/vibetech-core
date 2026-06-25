# VIBETech Core Backend

This folder contains the backend foundation for **VIBETech Core**, the reusable production platform that powers AI Employees across industries.

## Purpose

Phase 1 Step 1.1 is intentionally minimal: it sets up a production-grade Express server entrypoint and the project conventions (ES Modules, configuration via environment variables, and a folder structure ready for controllers/models/services/routes).

At this stage, there are **no business rules, APIs, or route handlers** implemented.

## Core vs Employees (No Industry in Core)

This repo is structured so that core backend code stays industry-agnostic. Industry-specific behavior is defined only under top-level `employees/` directories (via `employee.json`, `prompt.md`, `rules.json`, and related artifacts). Core runtime modules should never embed `legal`, `finance`, `construction`, etc. naming or implementation details.

## Local development

1. Copy `backend/.env.example` to `backend/.env`
2. Install dependencies from `backend/`
3. Run:
   - `npm run dev`

## Technologies

- Node.js + Express
- ES Modules (`"type": "module"`)
- `dotenv` for environment configuration
- `cors` for cross-origin access (frontend/integrations)
- `nodemon` for development

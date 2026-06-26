# VIBETech Product Roadmap (Living)

## Purpose of this document

This document is a living product roadmap (not an architecture document).
It tracks progress and the next concrete execution-focused steps that engineers should implement.

---

## Completed Foundation Work

- Production repository foundation + Phase 1 backend/structure setup (`backend/`, `employees/`, shared conventions)
- Root documentation + production `.gitignore` files

## Completed Foundry Work

- Employee Blueprint Generator framework (Phase 2 Step 2.1.1)
- Employee Definition (business contract) + Definition Engine (Step 2.1.2)
- Employee Validation Engine (business-quality checks) (Step 2.1.3)
- FoundryService orchestration (Definition -> Validation -> Blueprint Generation) (Step 2.1.4)
- Scenario Framework: `SCENARIOS.md` as a standard employee artifact (Step 2)
- First interface to Foundry: Foundry CLI (Step 2.1.5)

## Completed Legal OS — Client Update Employee Design

- `employees/legal/Client Update Employee` business identity artifacts:
  - `employee.json`
  - `rules.json`
  - `EMPLOYEE.md`
  - `SOP.md`
  - `TRAINING.md`
  - `README.md`
  - `SCENARIOS.md`

## Completed Runtime MVP Pieces

- Runtime Decision Pipeline (SituationEvaluator -> DecisionResolver -> ActionPlanner -> RuntimePipeline) through:
  - SituationEvaluator (Sprint 1)
  - DecisionResolver (Sprint 2)
  - ActionPlanner (Sprint 3)
  - RuntimePipeline (Sprint 4)
- Runtime infrastructure loaders/builders:
  - PromptLoader (Sprint 6)
  - PromptBuilder (Sprint 7A)

---

## Current Focus: Draft Generator / LLM Provider

- Build the first LLM provider abstraction (demo-first, no vendor lock-in)
- Prepare for the DraftGenerator by standardizing the interface that will consume PromptBuilder output

## Next Focus (follow-on execution)

- Demo CLI improvements (replay scenarios, show draft outputs in demo mode)
- Attorney Approval placeholder (governance gate contract; no implementation of approvals yet)
- GHL integration (event/feed and case timeline ingestion later via providers)

---

## Backlog (not scheduled yet)

- DraftGenerator implementation (turn PromptBuilder output into usable business drafts)
- Attorney review workflow execution (future)
- Enterprise permissions + roles enforcement (multi-tenant governance)
- Event bus + event-driven employee chaining
- Additional providers (email delivery, database adapters, CRM adapters)
- Dashboard UI (business definition + validation + draft review)


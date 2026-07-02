# Capability Intelligence Engine (Epic 12 Sprint 4)

## Purpose
Deterministically answer:
**“What capabilities does this business have, and what capabilities does it need?”**

## Responsibilities
- Read-only analysis across:
  - `CapabilityRuntime` (what capabilities exist)
  - `WorkRuntime` (what capabilities are required by work)
  - `TeamRuntime` (provider availability/workload signals)
  - optional `CompanyWorkspaceRuntime` (connected systems + knowledge availability)
- Compute an immutable `CapabilityIntelligenceReport` containing:
  - coverage, gaps, strengths
  - provider risks (inactive/overloaded/single-provider dependency)
  - deterministic recommendations (no AI)

## Relationship to other modules
- `CapabilityRuntime`: canonical ownership of capability definitions.
- `TeamRuntime`: canonical ownership of available workers/providers (human/digital/automation/external).
- `WorkRuntime`: canonical ownership of work requirements signals (`metadata.requiredCapabilities`).
- future `Mission Control`: may incorporate this report into higher-order planning.

## Future capability UI
This sprint does not build UI. The report is a canonical immutable fact model intended for later view adapters and rendering.


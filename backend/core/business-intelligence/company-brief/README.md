# Company Brief Engine (Epic 4 Sprint 1)

## Purpose
Generate a deterministic **executive company brief** from `CompanyWorkspaceRuntime`.

It answers exactly one business question:
> "What does the business owner need to know, decide, and do right now?"

This is **NOT** a dashboard, **NOT** a chatbot, and **NOT** AI summarization.

## Responsibilities
- `CompanyBriefEngine`
  - orchestrates generation of the canonical brief
- `CompanyBriefBuilder`
  - deterministically composes the canonical `CompanyBrief` object
- `CompanyBriefValidator`
  - validates view integrity for determinism + schema correctness

## Data Sources (allowed)
The engine only reads existing state from:
- `CompanyWorkspaceRuntime`
- `CompanyProfile` / `BusinessProfile` (via runtime)
- `CommunicationSetup` (via runtime)
- `ConnectedSystems` (via runtime)
- `Knowledge Repository` (via runtime)
- `Activities` (via runtime)
- `Work Queue` (via runtime)
- `Communications` (via runtime)
- `Employees` (via runtime)
- `Business Capability Engine` (for capability readiness gaps only)

It does not duplicate runtime state; it only composes it into intelligence objects.

## Relationship to Mission Control
Mission Control will consume `CompanyBrief` later to drive higher-order operational workflows.
This sprint implements only the engine; no UI or routing is included.

## Relationship to Company Runtime
`CompanyBriefEngine` reads deterministic SSOT data from `CompanyWorkspaceRuntime`.
It does not mutate runtime state.

## Relationship to Capability Engine
Capability readiness gaps are derived from `BusinessCapabilityEngine` evaluation results.
The brief does not duplicate capability evaluation logic.

## Future View Adapter / React Renderer
View adapters and React renderers will be introduced in later epics.
This sprint only creates the canonical business object.


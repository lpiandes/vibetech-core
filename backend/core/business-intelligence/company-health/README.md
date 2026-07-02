# Company Health Engine (Epic 4 Sprint 2)

## Purpose
Generate the canonical `CompanyHealth` business object to answer:
> "How healthy is this business, and why?"

This engine is **not analytics**, **not a dashboard**, and **not AI**.

## Responsibilities
- `CompanyHealthEngine`
  - orchestrates deterministic health generation
- `CompanyHealthBuilder`
  - computes dimension scores and derives strengths, risks, recommendations, and summary
- `CompanyHealthValidator`
  - validates schema integrity (duplicates, score/status/trend validity, deterministic assumptions)

## Data Sources
The engine composes only from existing deterministic state:
- Company Runtime (`CompanyWorkspaceRuntime`)
- Company Brief (optional; used only as a compatible input)
- Capability Engine output (`BusinessCapabilityEngine`)
- Knowledge repository
- Communications
- Connected systems
- Employees + work queue signals
- Activities
- Workspace configuration (optional input)
- Business profile + company profile (via runtime)

## Relationship to Company Runtime
Company Runtime owns SSOT and deterministic state.
Company Health reads runtime state and does not mutate it.

## Relationship to Company Brief
Company Brief is an executive “what to do right now” object.
Company Health is an organizational “why it is healthy/why it is not” object.
Both are deterministic compositions from runtime state.

## Relationship to Capability Engine
`BusinessCapabilityEngine` evaluates capability readiness gaps.
This engine uses that evaluation strictly to score the `Operational Readiness` dimension.

## Future Mission Control integration
Mission Control will consume `CompanyHealth` later to drive higher-order workflows.
This sprint implements only the engine; no UI, routing, or action execution is added.


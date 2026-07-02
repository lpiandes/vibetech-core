# Capability View Layer (Epic 12 Sprint 5)

## Purpose
Transform canonical capability ownership state and immutable intelligence facts into a single immutable **CapabilityViewModel** suitable for executive rendering.

This sprint answers the question:
**"What can my business do today, what is missing, and where should I invest?"**
by mapping:
- `CapabilityRuntime` (what capabilities exist)
- `CapabilityIntelligenceReport` (what is covered, missing, and risky)

## Responsibilities
- Provide a deterministic, deeply immutable view model via `CapabilityViewAdapter`.
- Validate the view model shape and immutability via `CapabilityViewValidator`.
- Do **not** recompute or mutate intelligence; only map existing canonical objects into rendering-friendly structures.

## Module Relationships
- `CapabilityRuntime`: source of capability definitions (categories, providedBy, names).
- `CapabilityIntelligenceReport`: source of executive facts (coverage, gaps, risks, strengths, recommendations).
- `CapabilityViewAdapter`: the only bridge from canonical facts to view model.
- Future `Mission Control`: may compose the view model for higher-level planning.


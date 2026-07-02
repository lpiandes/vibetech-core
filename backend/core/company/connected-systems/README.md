# Connected Systems (Sprint 7)

## Purpose
Represent external systems in a generic, industry-agnostic way as **Connections**.

This module builds a deterministic snapshot of external system connectivity and feature availability.

## Ownership
`CompanyWorkspaceRuntime` owns the snapshot and exposes it via:
- `runtime.getConnectedSystems()`

No providers, OAuth, or sending are implemented in this sprint.

## Relationship to Capability Engine
The Business Capability Engine (Sprint 2) evaluates readiness from runtime state using Connected Systems:
- it never mutates state
- it never hardcodes Gmail/CRM vendors

Connected Systems derive a generic feature list (e.g., `Send Email`, `Intake`) which the evaluator checks.


# Workspace Generation OS (Sprint 1)

## Purpose
The **Workspace Generator** transforms company runtime state into a complete **Workspace Configuration**.

This is **backend-only** composition:
- no React / no UI
- no vendors / no sending / no providers

React renders the configuration later; the generator only decides the shape.

## Business question answered
**"How should the business experience the platform?"**

## Inputs
- Company Runtime (SSOT)
- Company Profile (branding)
- Business Profile (operating context)
- Knowledge state (visibility)
- Connected Systems (availability)
- Business Capabilities (readiness)
- Industry Template (module recommendations contract)

## Output
- Immutable `WorkspaceConfiguration` object containing:
  - Navigation
  - Modules
  - Dashboard widgets + layout
  - Queues + views
  - Digital workforce layout + knowledge layout
  - Analytics layout
  - Morning brief configuration
  - Notifications
  - Recommendations
  - Permissions + metadata

## Determinism
The generator is deterministic from inputs; it performs no mutation and no side effects.


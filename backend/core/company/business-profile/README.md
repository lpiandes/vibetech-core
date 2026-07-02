# Business Profile (Sprint 4)

## Purpose
`BusinessProfile` represents how a company operates.

It is owned by `CompanyWorkspaceRuntime` and is the canonical operational configuration for future subsystems.

## Responsibilities
- Immutable business profile model (SSOT owned by `CompanyWorkspaceRuntime`)
- Deterministic builder: derives values and recommendations from `industry + template`
- Deterministic validator: validates formats/shape and computes completion % (no mutation)
- Industry templates: contract-only declarations of recommended capabilities/employees/KPIs/integrations

## Capability Engine relationship
The Business Capability Engine evaluates the **Business Profile** capability by consuming:
- `runtime.getBusinessProfile().metadata.validation.ok`
- `runtime.getBusinessProfile().metadata.completionPercent`

The Capability Engine remains read-only (no storage).


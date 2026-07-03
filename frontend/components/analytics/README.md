# Analytics Rendering Framework (Epic 14 Sprint 5)

This folder contains the **first frontend experience** for executive analytics.

## Responsibilities
- Presentation-only React components.
- Consume only `AnalyticsViewModel` via `AnalyticsContext`.
- Never access or depend on:
  - `AnalyticsRuntime`
  - `AnalyticsIntelligenceReport`
  - `CompanyRuntime`
  - `MissionControl`
  - or any OS runtime directly.

## Future
- Future charts/dashboards renderers.
- Future KPI engine enhancements (beyond this deterministic adapter).
- Future Mission Control integration.


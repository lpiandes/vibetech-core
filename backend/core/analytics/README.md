# Analytics Runtime (Epic 14 Sprint 1)

## Purpose
Deterministically record and aggregate measurable business facts.

This runtime answers:
**“What measurable business facts have been recorded?”**

It does **not** provide charts, dashboards, AI analysis, or forecasting.

## Responsibilities
- Own analytics metrics and data points in-memory (canonical SSOT).
- Mutate state only through `AnalyticsEventEngine`.
- Compute deterministic runtime metrics and derived aggregation metrics.

## Relationships
- Event Platform: future ingestion/publishing pipeline (out of scope for this sprint).
- Mission Control: future composition of analytics facts into executive decision layers.

## Out of scope (explicit for this sprint)
- No event ingestion pipeline (no cross-OS subscribers yet).
- No AI / ML.
- No dashboards/charts/UI.
- No forecasting.


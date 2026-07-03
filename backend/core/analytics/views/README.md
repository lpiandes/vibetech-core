# Analytics View Adapter (Epic 14 Sprint 4)

## Purpose
Map `AnalyticsRuntime` + `AnalyticsIntelligenceReport` into an immutable `AnalyticsViewModel` suitable for executive presentation.

This adapter is strictly **presentation mapping**:
- It does not recompute KPIs, trends, insights, recommendations, or overallPerformance.
- It only transforms already-computed fields from `AnalyticsIntelligenceReport` into presentation-oriented view objects.

## Relationship to Analytics Runtime
`AnalyticsViewAdapter` treats `AnalyticsRuntime` as read-only.
It must never call `AnalyticsRuntime.applyEvent()` or mutate analytics state.

## Relationship to Analytics Intelligence
`AnalyticsIntelligenceReport` is the single source for:
- `kpis`
- `trends`
- `insights`
- `recommendations`
- `summary`
- `overallPerformance`
- `metrics`

The adapter maps these fields deterministically into view objects:
- `AnalyticsSummaryView`
- `AnalyticsKPIView`
- `AnalyticsTrendView`
- `AnalyticsInsightView`
- `AnalyticsRecommendationView`

## Future integration (explicitly out of scope for this sprint)
- Analytics renderer/view layer
- charts/dashboards
- Mission Control composition
- forecasting/KPIs beyond deterministic meanings


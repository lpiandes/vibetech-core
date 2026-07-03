# Analytics Intelligence Engine (Epic 14 Sprint 3)

## Purpose
Answer the single executive question:
**"What do the business metrics actually mean?"**

This module is deterministic executive analysis built only from recorded `AnalyticsRuntime` datapoints.

## Relationship to Analytics Runtime
`AnalyticsIntelligenceEngine` is read-only:
- consumes `analyticsRuntime.getDerivedMetrics()`
- consumes `analyticsRuntime.getDataPoints()`
- never calls `analyticsRuntime.applyEvent()`

## Relationship to future Analytics View
This engine produces an immutable `AnalyticsIntelligenceReport` that a future Analytics view adapter can translate into dashboards/cards.

## Relationship to Mission Control
Mission Control can later compose the report into broader executive “mission” context. This sprint intentionally does not integrate.

## Future dashboards & forecasting (explicitly out of scope)
- no charts
- no dashboards
- no forecasting
- no AI/ML


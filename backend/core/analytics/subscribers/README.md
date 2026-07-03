# Analytics Event Subscriber Framework (Epic 14 Sprint 2)

## Purpose
Connect the Platform Event system to the Analytics OS.

Platform Events are treated as immutable facts and are deterministically converted into:
**`ANALYTICS_DATA_POINT_RECORDED`**

AnalyticsRuntime then computes aggregations internally.

## Responsibilities
- Listen for specific PlatformEvent `eventType`s.
- Deterministically map supported PlatformEvents into canonical `AnalyticsDataPoint`s.
- Apply those datapoints to `AnalyticsRuntime` using `AnalyticsRuntime.applyEvent(...)`.
- Never mutate any OS runtimes directly (Request/Work/Team/Communication/Capability/Company).

## Module Relationships
- `AnalyticsEventSubscriber`: creates bus-compatible subscribers (PlatformEventBus.subscribe compatible).
- `AnalyticsEventMapper`: converts PlatformEvent -> AnalyticsDataPoint (no aggregation).
- `AnalyticsEventValidator`: validates mapping outputs before applying to runtime.
- `AnalyticsSubscriberRegistry`: manages subscriber objects.

## Out of scope (this sprint)
- No KPI engines, dashboards, charts, or forecasting.
- No event ingestion pipeline (other than this subscriber mapping layer).
- No Mission Control integration.


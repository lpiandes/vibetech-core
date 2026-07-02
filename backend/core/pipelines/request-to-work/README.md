# Request → Work Pipeline (RequestToWorkSubscriber) (Epic 11 Sprint 1)

## Purpose
When a canonical `REQUEST_CONVERTED` Platform Event occurs, deterministically prepare the **work item creation action** required to reflect the conversion in Work.

This sprint does **not** implement qualification, conversion workflow orchestration, UI, automation, persistence, or Request/Work OS integration.

## Responsibilities
- `RequestToWorkSubscriber`
  - handles `REQUEST_CONVERTED` Platform Events
  - validates event payload
  - deterministically maps request payload → canonical `workItemInput`
  - returns a deterministic action: `create_work_item`
  - optionally applies `WORK_ITEM_CREATED` **only** if `context.workRuntime` is explicitly provided
- `RequestToWorkMapper`
  - converts the `REQUEST_CONVERTED` payload fields into the canonical `WorkItemInput` shape
- `RequestToWorkValidator`
  - validates compatibility for `REQUEST_CONVERTED` events and the payload contract
- `RequestToWorkDefaults`
  - provides deterministic defaults (stageId/queueId/status) for newly created work

## Relationship to `PlatformEventBus`
`RequestToWorkSubscriber` is designed to be registered as a bus-compatible subscriber via the Platform Event Subscriber Framework.

## Relationship to future Request→Work pipeline
Future pipelines can reuse this deterministic mapping/action generation. If/when Work integration is standardized, this handler can be kept as the action preparation core.


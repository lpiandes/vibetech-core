# Request Rendering Framework

## Responsibilities
- `RequestRenderer`
  - top-level wrapper that receives a canonical `RequestViewModel`
  - provides `RequestViewModel` via context
- `RequestLayout`
  - layout-only decisions (single vs two column)
- `RequestSummary`
  - renders summary + key metrics + executive attention/recommendation summaries
- `RequestQueueRenderer`
  - renders queues dynamically from `viewModel.queues`
  - renders every request item dynamically from `viewModel.items` via queue membership
- `RequestItemRenderer`
  - renders each canonical `RequestItemView` (no data fetching, no business logic)
- `RequestAttentionRenderer`
  - renders attention items dynamically from `viewModel.attention.items`
- `RequestRecommendationRenderer`
  - renders recommended actions dynamically from `viewModel.recommendedActions`
- `RequestLoading`
  - deterministic loading placeholders
- `RequestErrorBoundary`
  - graceful rendering fallback

## Relationship to `RequestViewModel`
This framework consumes exactly one input: the canonical immutable `RequestViewModel`.
React owns presentation only; it never mutates runtimes and never recomputes intelligence.

## Future Qualification Engine
- Qualification will occur in a backend engine and only reflected as `RequestViewModel.status/qualificationStatus`.

## Future Request → Work Pipeline
- Conversion will occur in a backend pipeline and only reflected via `assignedWorkId` enrichment in item views.

## Future CRM integrations
- Out of scope for this sprint; React will only render view model fields.


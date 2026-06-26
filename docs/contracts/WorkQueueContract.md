# WorkQueueContract.md

## Purpose
Provide the Work Queue page with a “governance handoff” list so the user can answer:
**“Why is this waiting for me?”**

## Consumer
Frontend Workspace page: `frontend/components/queue/` and its App Route.

## Producer
Backend Runtime “Work Queue view” adapter.

## Input model
`WorkQueueRequest`
- `workspaceId` (string)
- `viewerId` (string)
- `nowISO` (string; ISO-8601 timestamp)
- `reviewerRole` (string; e.g., “Attorney”, “Client Success”)

## Output model
`WorkQueueResponse`
- `reviewQueueState` (`Needs Review` | `No Work` | `Offline`)
  - used for reassurance copy and empty state messaging
- `items` (`WorkItem[]`; see `RuntimeModels.md`)
- `summary`
  - `itemsNeedingReview` (number)
- `metadata`
  - `lastUpdatedISO` (string; ISO-8601 timestamp)

### Work item card fields (derived from `WorkItem`)
Each `WorkItem` must be mappable into:
- `id` (string)
- `title` (string)  // what the item is
- `clientName` (string)
- `matterType` (string)
- `priority` (`High` | `Medium` | `Low`)
- `status` (`Needs Review` | `Approved` | `Completed`)
- `assignedEmployeeName` (string)
- `createdTimeISO` (string; ISO-8601 timestamp)

## Loading states
1. Render header and “queue list” area.
2. Show a list of skeleton cards matching queue item height (no badges).
3. Replace skeletons when `items` is available.

## Empty states
- `items` is empty:
  - show a reassuring empty state rather than a failure message
  - update copy based on `reviewQueueState`

Suggested mapping:
- `No Work`: “Nothing is waiting for your review right now.”
- `Offline`: “Your Digital Employees are currently offline.”

## Error states
- If the queue load fails:
  - show an error in the queue list area:
    “We couldn’t load your work queue. Try again.”
  - do not show misleading items.

## Mock-to-runtime migration strategy
1. Define `WorkItem` output mocks that match the derived card fields.
2. Implement a runtime mapping layer:
   - filters runtime work tasks by governance ownership (mapped to `reviewerId` + `reviewerRole`)
   - sorts by `createdTimeISO` or business priority
   - computes `reviewQueueState` and summary counts
3. Replace mock `items` with runtime-derived `items` while keeping the card mapping stable.


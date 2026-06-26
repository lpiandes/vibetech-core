# DashboardContract.md

## Purpose
Provide the Dashboard page with a calm, governance-oriented “workforce health” snapshot so the user can quickly answer:
**“What does my Digital Workforce need from me?”**

## Consumer
Frontend Workspace page: `frontend/app/dashboard/page.tsx` (and its Dashboard components).

## Producer
Backend Runtime “Dashboard view” adapter that composes data from runtime business models.

## Input model
`DashboardRequest`
- `workspaceId` (string)
- `viewerId` (string)
- `nowISO` (string; ISO-8601 timestamp)

## Output model
`DashboardResponse` (page-ready data)
- `greeting` (string)
- `completedTasksWhileAway` (number)
- `itemsRequiringReview` (number)
- `estimatedReviewTimeMinutes` (number)
- `impactMetrics` (object)
  - `hoursSaved` (number)
  - `draftsCreatedToday` (number)
  - `pendingReviews` (number)
  - `estimatedValueCreatedK` (number; represents “thousands”)
- `digitalWorkforceCard` (object)
  - `employeeName` (string)
  - `status` (`Working` | `Offline` | `Needs Review` | `Approved` | `Completed`)
  - `todayActivitySummary` (string)
- `recentActivity` (Activity[]; see `RuntimeModels.md`)

## Loading states
The page should provide a calm skeleton state that preserves reading order:
1. Page header + workforce summary placeholder
2. Metrics placeholder blocks
3. Workforce card placeholder + recent activity placeholder

## Empty states
Only empty states that remain reassuring:
- If there is no recent activity yet:
  - show the recent activity section in an “empty” style with a short explanation (“No activity captured today”).
- If review demand is currently zero:
  - set `itemsRequiringReview` to `0` and adjust the hero copy to “nothing needs governance today.”

## Error states
If the runtime cannot provide a response:
- show a non-blocking error message inside each section that failed (recommended),
  otherwise show a single page-level message:
  “We couldn’t load your workforce snapshot. Try again.”
- keep the primary decision area empty/disabled to avoid misleading governance cues.

## Mock-to-runtime migration strategy
1. Keep the Dashboard UI driven by `DashboardResponse` shape.
2. Start by populating `DashboardResponse` with mocks.
3. Introduce a runtime mapping layer that:
   - computes `itemsRequiringReview`, `estimatedReviewTimeMinutes`, and `impactMetrics` from runtime business models,
   - converts runtime `Activity` into `recentActivity`.
4. Gradually replace each mock sub-object (hero, metrics, activity, workforce card) as runtime outputs become available.


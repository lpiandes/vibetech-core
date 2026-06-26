# DigitalWorkforceContract.md

## Purpose
Provide the flagship Digital Workforce page with the workforce health snapshot and the list of Digital Employees in a “manager handoff” format so the user can answer:
**“How is my Digital Workforce doing?”**

## Consumer
Frontend Workspace page: `frontend/app/digital-workforce/page.tsx` and its Workforce components.

## Producer
Backend Runtime “Digital Workforce view” adapter that composes workforce and employee status models.

## Input model
`DigitalWorkforceRequest`
- `workspaceId` (string)
- `viewerId` (string)
- `nowISO` (string; ISO-8601 timestamp)

## Output model
`DigitalWorkforceResponse`
- `workforceSummary` (WorkforceSummary; see `RuntimeModels.md`)
  - used for the summary strip
- `employees` (DigitalEmployee[]; see `RuntimeModels.md`)
  - used to render the employee grid/cards

### DigitalEmployee card mapping requirements
Each `DigitalEmployee` must support mapping to an employee card:
- `name`
- `role`
- `status` (+ optional `statusQualifier`)
- `todayCompletedCount` and a single-sentence accomplishment line
- `approvalRatePercent`
- `currentWorkload` fields (in progress + waiting on you)
- `capabilities` (3–5 chips)
- `primaryActionLabel` (e.g., “Open Employee”)

## Loading states
1. Page header placeholder
2. Summary strip placeholder
3. Employee cards skeleton list

## Empty states
Represent empty states clearly and reassuringly:
- No employees:
  - show the “No Digital Employees are currently assigned” message
- Offline/paused workforce:
  - show the appropriate workforce summary state
- No work today:
  - show “Nothing is waiting for your review right now” style messaging in the summary strip and cards.

## Error states
- If workforce summary fails but employee list succeeds:
  - show an empty/placeholder summary strip and still render the employee list if safe.
- If employee list fails:
  - show the page-level error message and disable primary CTAs to avoid false governance cues.

## Mock-to-runtime migration strategy
1. Start with `DigitalWorkforceResponse` mocks that fully satisfy the card mapping requirements.
2. Introduce runtime business model composition:
   - compute `WorkforceSummary` from runtime work tasks and review ownership
   - compute each `DigitalEmployee` card metrics from runtime activity + review outcomes
3. Gradually swap mock `DigitalEmployee[]` entries:
   - keep card mapping stable even if runtime introduces extra fields later
4. Preserve empty state semantics by mapping runtime “no work” conditions into `workforceSummary` consistently.


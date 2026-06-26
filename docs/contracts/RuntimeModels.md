# RuntimeModels.md

## What this document is

This document defines **shared business objects** that the VIBETech Runtime produces and the Workspace frontend consumes.

These are **not** database schemas.
These are **not** TypeScript or code.

The goal is stable, human-meaningful business models that can be mapped into any UI page without changing the runtime’s meaning.

## Shared vocabulary (business intent)

- **Digital Employee**: a reusable capability unit that produces work under governance.
- **Work**: a unit of employee output that may require review.
- **Task**: an internal execution unit that results in reviewable outputs.
- **Review**: the governance step where humans validate an employee’s output.
- **Recommendation/Thinking**: the employee’s business reasoning that helps reviewers decide.
- **Draft**: the document-like output produced for review.

## DigitalEmployee

Represents a single employee as the user experiences them on the “Digital Workforce” page.

Fields:
- `employeeId` (string)
- `name` (string)
- `role` (string; short)
- `status` (EmployeeStatus; see `EmployeeStatus`)
- `statusQualifier` (string; optional but recommended for clarity)
- `todayCompletedCount` (number)
- `todayAccomplishmentLine` (string; single sentence)
- `approvalRatePercent` (number)
- `approvalRateFootnote` (string)
- `currentWorkload` (Workload)
  - `inProgressCount` (number)
  - `waitingOnYouCount` (number; governance need signal)
- `capabilities` (string[]; 3–5 short chips)
- `primaryActionLabel` (string; e.g., “Open Employee”)

## WorkItem

Represents a governance unit that appears in the Work Queue and is reviewable on the Review Work page.

Fields:
- `workItemId` (string)
- `title` (string)
- `clientName` (string)
- `matterType` (string)
- `priority` (`High` | `Medium` | `Low`)
- `status` (`Needs Review` | `Approved` | `Completed`)
- `assignedEmployeeName` (string)
- `createdTimeISO` (string; ISO-8601 timestamp)

## ReviewTask

Represents the review requirement associated with a Work item.

Fields:
- `reviewTaskId` (string)
- `workItemId` (string)
- `reviewType` (string; e.g., “Attorney Review”)
- `requiresApproval` (boolean)
- `currentReviewStatus` (`Pending Review` | `Approved` | `Rejected` | `Completed`)
- `decisionGuidance` (string; short explanation of what to confirm)

## EmployeeStatus

Employee-level governance/work-state label used in workforce and card surfaces.

Allowed values (examples; runtime may extend with stable new values):
- `Working`
- `Needs Review`
- `Approved`
- `Completed`
- `Offline`
- `Pending`

Fields:
- `label` (one of the allowed values)
- `qualifier` (string; optional short phrase)

## WorkforceSummary

The top-of-page summary strip for the Digital Workforce page and comparable “snapshot” sections elsewhere.

Fields:
- `workforceState` (`Employees Working` | `Needs Review` | `Offline` | `No work today` + future stable values)
- `employeesWorkingCount` (number)
- `employeesNeedingReviewCount` (number)
- `employeesOfflineCount` (number)
- `todayTasksCompletedCount` (number)
- `hoursSavedToday` (number)
- `estimatedReviewTimeMinutes` (number; for governance timing reassurance)

## ApprovalRequest

Represents a governance request shown on Review Work: what approval is needed, and its current state.

Fields:
- `approvalRequestId` (string)
- `workItemId` (string)
- `requiresApproval` (boolean)
- `approvalType` (string; e.g., “Attorney Approval”)
- `statusLabel` (string; e.g., “Pending Review”)
- `primaryAction` (`Approve` | `Reject` | `Request Changes`)
- `secondaryAction` (string; optional guidance)
- `governanceNote` (string; short, professional explanation)

## Activity

Represents a single timeline-like event for “Recent Activity” and future audit-style views.

Fields:
- `timestampISO` (string)
- `text` (string; single sentence that reads like a progress update)
- `category` (string; optional; used to style or group later)

## Draft

Represents the document-like content previewed in Review Work.

Fields:
- `draftId` (string)
- `title` (string; e.g., “Settlement Offer Update”)
- `content` (string; plain text, already formatted for display)
- `generatedTimeISO` (string; optional)

## Workload

Common workload measurement used in employee cards.

Fields:
- `inProgressCount` (number)
- `waitingOnYouCount` (number)

## Guidance for future runtime extension

When adding new runtime capability later:
- prefer adding new fields to existing business objects
- preserve meaning of existing fields
- keep stable allowed value sets for governance labels


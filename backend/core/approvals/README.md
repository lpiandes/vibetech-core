# Approval Runtime

Universal human-in-the-loop authorization facts. Owns approval requests, decisions, and derived metrics.

Does **not** own automation runs, work, communications, or other domain state.

## Lifecycle

All mutation through `ApprovalRuntime.applyEvent(...)`:

- `APPROVAL_REQUESTED`
- `APPROVAL_GRANTED`
- `APPROVAL_REJECTED`
- `APPROVAL_CANCELLED`

Platform events (`APPROVAL_REQUESTED`, `APPROVAL_GRANTED`, `APPROVAL_REJECTED`) are published for analytics and automation resumption subscribers.

## Automation integration

When an automation action has `requiresApproval: true`, orchestration creates an approval request, records `PENDING_APPROVAL`, and pauses the run. Grant/resume is handled by `AutomationOrchestrationService.resumeAfterApproval` via the approval event subscriber — approval runtime never executes actions directly.

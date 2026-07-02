# Team Intelligence Adapter (Epic 6 Sprint 2)

## Purpose
Translate canonical backend runtimes into immutable **Team intelligence/view objects**.

This adapter does NOT build team intelligence engines and does NOT mutate runtime state.
It deterministically translates:
- `TeamRuntime` team state
- `CompanyWorkspaceRuntime` work/communication signals
- Optional canonical intelligence inputs (e.g., `MissionControl`, `CompanyBrief`, `CompanyHealth`)

## Responsibilities
- `TeamViewAdapter`
  - produces canonical `TeamViewModel` for the frontend/consumers
  - creates member/department/workload/attention view objects
  - creates business-action recommendations derived from deterministic attention signals
- View model factories (`TeamViewModel`, `TeamMemberView`, `TeamDepartmentView`, `TeamWorkloadView`, `TeamAttentionView`)
  - enforce schema via deterministic deep-freeze factories
- `TeamViewValidator`
  - validates determinism invariants (uniqueness, required fields, immutability)

## Input Objects
- Required
  - `TeamRuntime`
  - `CompanyWorkspaceRuntime`
- Optional (read-only; not recomputed)
  - `MissionControl`
  - `CompanyBrief`
  - `CompanyHealth`
  - `WorkspaceConfiguration`

## Relationship to `TeamRuntime`
`TeamRuntime` owns immutable state about team members, departments, roles, and workload metrics.
The adapter only reads from `TeamRuntime` and never mutates it.

## Relationship to `CompanyWorkspaceRuntime`
The adapter reads:
- work queue items
- communications / activities where available
- metrics

The adapter does not create new work queue state.

## Future Integration
Future Team UI should:
- render the `TeamViewModel`
- treat the adapter output as the SSOT for “who is working, who is blocked, who needs attention, and what everyone is working on”


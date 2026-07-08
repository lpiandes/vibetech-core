# Workspace Scaling Boundaries

This document describes current workspace identity and registry lifecycle boundaries for EPIC 20. Full multi-tenancy is **not** implemented in this epic.

## Current Components

| Component | Role | Durability |
|-----------|------|------------|
| `WorkspaceActivationRegistry` | In-process map of `workspaceId` → activation config | **Non-durable** — lost on process restart |
| `WorkspaceCompositionRegistry` | Frontend singleton caching `ConnectedBusinessWorkspace` per `workspaceId` | **Non-durable** — per browser/server process |
| `workspaceId` | Canonical identity key for activation and composition | Must become durable tenant key |
| `activateWorkspace()` | Orchestrates runtime stack, package install, integration platform | Re-runs on each cold start |
| `IndustryPackageInstaller` | Installs capabilities, automations, terminology into runtimes | In-memory runtime state only |
| `PlatformEventStore` | Per-workspace event history for timelines and handled activity | **Non-durable** |
| `ConnectionRuntime` | Per-workspace connection state | **Non-durable** |
| Credential references | Mock resolver in dev; no secret storage | Must become secure vault per workspace |

## Isolation Guarantees (Current Process)

- Each `workspaceId` activation creates **distinct runtime instances** (work, team, events, connections).
- `WorkspaceCompositionRegistry.getOrCreate` returns one `ConnectedBusinessWorkspace` per `workspaceId` within a process.
- No global mutable business state is shared between workspace A and B runtimes.
- Different industry packages can activate independently per `workspaceId`.

## What Must Later Become Durable

1. Workspace activation record (package, configuration, demo id)
2. All canonical runtime projections (requests, work, interactions, approvals)
3. Platform event store and analytics data points
4. Connection state and credential reference handles
5. Knowledge repository content
6. Workspace composition cache invalidation on config change

## Hidden Global State Risks

- `WebhookIngressService` uses a **process-global** `PROCESSED_DELIVERIES` set — must become workspace-scoped for production.
- `WorkspaceActivationRegistry` and `WorkspaceCompositionRegistry` are global singletons — acceptable for demo, not for multi-tenant production without backing store.

## Tests

See `backend/core/workspace/activation/WorkspaceIsolation.test.js` for regression coverage.

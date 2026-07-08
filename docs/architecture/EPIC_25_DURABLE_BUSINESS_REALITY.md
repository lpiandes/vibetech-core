# EPIC 25 — Durable Business Reality

**Status:** PLAN (awaiting review — do not implement until approved)

**Goal:** Make VIBETech survive process restart without replacing domain runtimes or creating a second source of truth.

**Architecture rule preserved:**

```
INPUT → DOMAIN BOUNDARY → CANONICAL BUSINESS FACT → DURABLE STORAGE → PROJECTION → UI
```

---

## 1. Executive Summary

EPIC 24 delivered a coherent client-facing operating experience (Mission Control, Work, People & Relationships, Attention, Team, Audiences, Connections, Setup). The Horizon demo enters through real runtime boundaries and derives visible outcomes from canonical facts.

**Production blocker:** all canonical state is process-local. A restart clears parties, subjects, requests, work, interactions, communications, approvals, automation state, audience projections, and workspace composition.

**Recommendation:** Adopt a **hybrid persistence model (Option C)**:

1. **Primary hydration:** workspace-scoped aggregate snapshots of canonical runtime state.
2. **Durable audit trail:** append-only domain event journal at every `applyEvent` / `recordInstallation` boundary.
3. **Durable platform event log** for cross-OS facts in `PlatformEventStore`.
4. **Durable workspace metadata** for activation, installation fingerprints, and demo bootstrap version markers.

**Infrastructure:** PostgreSQL for production; Docker Compose Postgres (or SQLite via `better-sqlite3`) for local development — no paid infrastructure required.

`WorkspaceCompositionRegistry` remains a cache. **Durable storage becomes source of truth.**

---

## 2. Current Statefulness Audit

| Runtime / Component | Path | State Held | Mutation API | Platform Events | Workspace Isolation | Idempotency Keys |
|---|---|---|---|---|---|---|
| BusinessGraphRuntime | `business-graph/BusinessGraphRuntime.js` | parties, relationships | `applyEvent` | None | Per-instance | `event.id`; entity id collision throws |
| BusinessSubjectRuntime | `business-subject/BusinessSubjectRuntime.js` | subjects | `applyEvent` | None | Per-instance | `event.id`; subject id |
| RequestRuntime | `request/RequestRuntime.js` | requests, metrics | `applyEvent` | `REQUEST_CONVERTED` (explicit) | Per-instance | `event.id`; request id |
| WorkRuntime | `work/WorkRuntime.js` | workItems, stages, queues, assignments | `applyEvent` | `WORK_CREATED`, `WORK_ASSIGNED` | Per-instance | `event.id`; `work_{requestId}` |
| InteractionRuntime | `interactions/InteractionRuntime.js` | interactions | `applyEvent` | `INTERACTION_*`, `FOLLOW_UP_SCHEDULED` | Per-instance | `event.id`; interaction id |
| CommunicationRuntime | `communications/CommunicationRuntime.js` | threads, messages | `applyEvent` | Via integration layer | Per-instance | `event.id`; thread/message id |
| CommunicationPreferenceRuntime | `communications/preferences/CommunicationPreferenceRuntime.js` | preferences | `applyEvent` | None | Per-instance | upsert on partyId+channel+scope |
| ApprovalRuntime | `approvals/ApprovalRuntime.js` | approval requests | `applyEvent` | `APPROVAL_*` | Per-instance | `event.id`; approval id |
| AutomationRuntime | `automations/AutomationRuntime.js` | automations, runs | `applyEvent` | `AUTOMATION_RUN_*` | Per-instance | run id; start no-op if exists |
| TeamRuntime | `team/TeamRuntime.js` | members, departments, roles | `applyEvent` | None | Per-instance | `event.id`; member id |
| ConnectionRuntime | `integrations/connections/ConnectionRuntime.js` | connections, action history | `applyEvent` | `CONNECTION_*`, `EXTERNAL_ACTION_*` | Per-instance | `conn_{workspaceId}_{type}` |
| CapabilityRuntime | `capabilities/runtime/CapabilityRuntime.js` | capabilities, categories | `applyEvent` | None | Per-instance | capability id |
| SegmentDefinitionRuntime | `segments/SegmentDefinitionRuntime.js` | segment definitions | inline mutation | None | Per-instance + workspaceId field | segment id upsert |
| IndustryPackageInstallationRuntime | `industries/IndustryPackageInstallationRuntime.js` | installations | `recordInstallation` | None | workspaceId on record | `configurationFingerprint` |
| CompanyWorkspaceRuntime | `company/CompanyWorkspaceRuntime.js` | identity, knowledge, profiles | `applyEvent` | None | Per-instance | entity ids |
| AnalyticsRuntime | `analytics/AnalyticsRuntime.js` | metrics, dataPoints | `applyEvent` + subscriber | None (consumes) | Per-instance | metric/dataPoint id |
| OnboardingRuntime | `onboarding/OnboardingRuntime.js` | session, steps | `applyEvent` | None | companyId/sessionId | step status gates |
| PlatformEventStore | `events/PlatformEventStore.js` | append-only events + indexes | `append` | N/A | Per-instance | eventId (no dedup today) |
| PlatformEventBus | `events/bus/PlatformEventBus.js` | subscriptions | subscribe/dispatch | N/A | Per-instance | subscriber id per eventType |
| WorkspaceActivationRegistry | `workspace/activation/WorkspaceActivationRegistry.js` | Map workspaceId → config | ensure/set | None | Keyed by workspaceId | first-write-wins |
| WorkspaceCompositionRegistry | `frontend/lib/workspace/WorkspaceCompositionRegistry.js` | Map workspaceId → composition | getOrCreate | None | Keyed by workspaceId | first-write-wins |
| HorizonDemoBootstrapRegistry | `integration/HorizonDemoBootstrapRegistry.js` | bootstrap markers + cache | markComplete/reset | None | Keyed by workspaceId | `epic23_v1` version |
| WorkspaceDeliveryDedup | `integrations/inbound/WorkspaceDeliveryDedup.js` | delivery sets | markSeen | None | Per workspace | providerId:externalEventId |
| ExternalActionOrchestrationService | `integrations/actions/ExternalActionOrchestrationService.js` | idempotency map | orchestrates | publishes integration events | Per workspace | idempotencyKey |

**Projections (no owned state):** `SegmentProjectionEngine`, `BusinessEpisodeProjection`, `BusinessCommandCenterComposer`, `EngagementPartyIndexBuilder`, view adapters — all derive from runtime facts.

**Note:** There is no separate `PartyRuntime`; parties live in `BusinessGraphRuntime`.

---

## 3. Canonical vs Derived Classification

| Class | Meaning | Components |
|---|---|---|
| **A — Canonical durable fact** | Must survive restart; source of truth | Parties, subjects, requests, work, interactions, communications, preferences, approvals, automation runs, connections, team members, segment definitions, platform events, knowledge items (if mutated) |
| **B — Durable configuration** | Installed once / changes rarely | Workspace activation, industry package installation, capability registrations, automation definitions, work stage/queue defaults, demo bootstrap version marker, credential references (handles only) |
| **C — Rebuildable projection** | Never persisted as truth | Analytics derived metrics, segment/audience membership, Mission Control, Work, Engagement views, team workload, readiness reports, handled-by-VIBETech feed |
| **D — Ephemeral process state** | Cache OK to lose | Composition registry, bootstrap composition cache, bus subscription tables, in-memory dedup (must become durable for production) |
| **E — Demo-only state** | Must not become fake truth | Bootstrap input replay guards (become **B** when stored as version markers, not outcomes) |

---

## 4. Existing Database Infrastructure Audit

| Item | Status |
|---|---|
| PostgreSQL / SQLite driver | Not present |
| ORM (Prisma, Drizzle, Knex) | Not present |
| Migration tooling | Not present |
| `docker-compose.yml` | Not present |
| `DATABASE_URL` env | Not present |
| `backend/database/` | Documented in ARCHITECTURE.md, not created |
| `PersistenceProvider` | Not implemented (future provider type) |
| Frontend data access | Direct import of backend runtimes via `ConnectedBusinessWorkspace` |
| CI/CD database steps | None |

**Deployment assumption today:** monolithic Next.js process; all state in-memory; demo-only durability.

---

## 5. Persistence Options Considered

### Option A — Snapshot persistence only

Serialize each runtime's `_state` after mutations.

| Pros | Cons |
|---|---|
| Smallest implementation surface | 15+ snapshot schemas to version |
| Fast cold start | No mutation audit trail unless added |
| No subscriber replay hazards | Must define export/import per runtime |
| Matches `deepFreeze(_state)` pattern | Risk of snapshot/UI coupling if careless |

### Option B — Event persistence only (replay reconstruction)

Persist all domain events; rebuild by replaying through `applyEvent` + bus subscribers.

| Pros | Cons |
|---|---|
| Aligns with event-engine architecture | Bus subscribers re-fire on replay |
| Natural audit log | Requires rehydrationMode on all subscribers |
| Schema evolution via event versioning | Slower cold start |
| | Internal events ≠ platform events (two journals) |

### Option C — Hybrid (recommended)

Snapshots for hydration + domain event journal for audit/idempotency + durable platform event log.

| Pros | Cons |
|---|---|
| Fast, safe restore via snapshots | Two write paths to maintain |
| Event journal without replay risk | Snapshot + journal must be transactionally consistent |
| Platform events durable for timeline | Slightly more storage |
| Incremental delivery (snapshots MVP, journal next) | |

**Rejected:** Pure event replay alone — subscriber side effects during replay create unacceptable complexity without rehydration mode across 6+ subscribers.

**Rejected:** Page-specific, Horizon-specific, or vertical-specific tables in Core.

---

## 6. Recommended Persistence Model

**Hybrid C with snapshot-primary hydration:**

```
MUTATION
  → domain boundary (service / applyEvent)
  → runtime state update (in-memory)
  → append domain event (durable journal)
  → append platform event if published (durable log)
  → save runtime snapshot(s) + metadata
  → invalidate composition cache (optional)

ACTIVATION
  → resolve workspaceId
  → load workspace metadata (activation, installation, bootstrap version)
  → load latest snapshots into fresh runtimes via seed factories
  → hydrate PlatformEventStore from durable log
  → wire bus subscribers (stateless)
  → skip demo bootstrap if durable marker present
  → return ConnectedBusinessWorkspace
  → cache in WorkspaceCompositionRegistry (optimization only)
```

### Why this fits this repository

1. Runtimes already own canonical state as `deepFreeze(_state)` — snapshots are the folded event log.
2. `applyEvent` is the universal mutation contract — one interception point for journaling.
3. Bus subscribers (`RequestToWorkSubscriber`, `TeamAssignmentSubscriber`, `AutomationEventSubscriber`, etc.) create side effects that make pure replay unsafe without a full rehydration mode.
4. `PlatformEventStore` is already a separate canonical integration log — persist it independently.
5. Greenfield DB — no legacy ORM constraints; choose minimal SQL.

### Restart reconstruction

1. `activateWorkspace(workspaceId)` checks durable metadata.
2. If snapshots exist: construct runtimes with `seed: () => loadedState` (same pattern as `buildDefaultRequestSeed`).
3. If no snapshots but journal exists (recovery path): replay journal into empty runtimes **without dispatching bus** (rehydration mode).
4. Re-subscribe all platform event subscribers to the hydrated bus.
5. Do not re-run demo bootstrap if `bootstrap_version` marker matches.

### Idempotency

- Domain events: unique `(workspace_id, event_id)` constraint.
- Webhook deliveries: unique `(workspace_id, provider_id, external_event_id)` — replace process-local `WorkspaceDeliveryDedup`.
- External actions: unique `(workspace_id, idempotency_key)`.
- Package install: unique `configuration_fingerprint`.
- Bootstrap: unique `(workspace_id, bootstrap_version)`.

### Schema evolution

- `workspace_snapshots.schema_version` integer per row.
- `workspace_domain_events.event_schema_version` per event type.
- Migration scripts in `backend/database/migrations/` numbered sequentially.
- Hydration reads latest compatible version; migration transforms on load if needed.

### Workspace isolation

- Every table includes `workspace_id` as leading key in indexes.
- No global tables for business facts.
- Connection ids, dedup keys, and external refs scoped by workspace.

### Transactions

- One workspace mutation = one transaction:
  1. append domain event(s)
  2. append platform event(s) if any
  3. upsert runtime snapshot(s)
  4. upsert metadata if changed
- Cross-workspace operations are never in one transaction.

### Partial failure handling

- If mutation succeeds in-memory but persist fails: return error; do not update cache; caller retries with same idempotency key → no duplicate facts.
- If persist succeeds but response fails: retry is safe via idempotency constraints.
- Activation: if snapshot load fails, fall back to journal replay or fail closed (no silent empty workspace).

---

## 7. Storage Contract

**Minimum abstractions** (Core depends on contracts; provider implements SQL):

### `WorkspacePersistencePort`

```javascript
// backend/core/persistence/WorkspacePersistencePort.js
export class WorkspacePersistencePort {
  async loadWorkspaceBundle(workspaceId) { throw new Error("not implemented"); }
  async saveWorkspaceBundle(workspaceId, bundle) { throw new Error("not implemented"); }
  async appendDomainEvent(workspaceId, envelope) { throw new Error("not implemented"); }
  async appendPlatformEvent(workspaceId, event) { throw new Error("not implemented"); }
  async loadWorkspaceMetadata(workspaceId) { throw new Error("not implemented"); }
  async saveWorkspaceMetadata(workspaceId, metadata) { throw new Error("not implemented"); }
  async transaction(workspaceId, fn) { throw new Error("not implemented"); }
  async deleteWorkspace(workspaceId) { throw new Error("not implemented"); } // dev reset only
}
```

### `WorkspaceHydrationBundle`

```javascript
{
  workspaceId,
  schemaVersion,
  metadata: { activation, installation, bootstrapVersion, updatedAt },
  runtimeSnapshots: {
    businessGraph, businessSubject, request, work, interaction,
    communication, communicationPreference, approval, automation,
    team, connection, capability, segmentDefinition, company,
    analytics, onboarding, platformEventStore
  },
  // journal entries loaded separately for replay/recovery
}
```

### `PersistedMutationCoordinator`

Single write boundary called by domain services after successful in-memory mutation:

```javascript
await persistence.transaction(workspaceId, async (tx) => {
  await tx.appendDomainEvent(workspaceId, { runtimeKind, event });
  if (platformEvent) await tx.appendPlatformEvent(workspaceId, platformEvent);
  await tx.saveRuntimeSnapshot(workspaceId, runtimeKind, runtime.exportState());
});
```

### Implementations

| Implementation | Purpose |
|---|---|
| `InMemoryWorkspacePersistence` | Unit/integration tests |
| `SqliteWorkspacePersistence` | Local dev (optional) |
| `PostgresWorkspacePersistence` | Production |

### What we do NOT create

- `DashboardRepository`, `MissionControlRepository`, `HorizonRepository`
- Per-page persistence
- Serialized React view models
- Repository logic inside individual runtimes

### Integration with providers architecture

`PostgresWorkspacePersistence` is a **provider implementation** behind `WorkspacePersistencePort`, consistent with ARCHITECTURE.md's future `SQLite Provider` / database provider pattern. Core runtimes never import `pg` or `better-sqlite3`.

---

## 8. Workspace Reconstruction Lifecycle

```
Request for workspace (UI / API)
  ↓
resolveWorkspaceActivation(workspaceId)
  ↓ load from WorkspaceActivationRegistry OR durable metadata
loadWorkspaceBundle(workspaceId)
  ↓ null → fresh stack (first activation)
  ↓ exists → hydrate
construct runtimes from snapshots (seed factories)
  ↓
hydrate PlatformEventStore from durable platform events
  ↓
createIntegrationPlatform + wire subscribers
  ↓
if industry workspace && !installation snapshot:
    install package (recordInstallation → persist)
if demoConfigurationId && !bootstrap marker:
    run bootstrap inputs through real boundaries → persist → mark complete
else:
    skip bootstrap
  ↓
build ConnectedBusinessWorkspace
  ↓
cache in WorkspaceCompositionRegistry
  ↓
return composition
```

### Proof scenario (required test)

```
activate(ws) → ingest event → mutate → assert state
destroy process-local composition (registry.clear + new process)
activate(ws) → assert identical canonical facts
```

---

## 9. Runtime-by-Runtime Persistence Plan

| Runtime | Class | Persist | Hydration | Notes |
|---|---|---|---|---|
| BusinessGraphRuntime | A | snapshot + journal | seed from snapshot | parties, relationships |
| BusinessSubjectRuntime | A | snapshot + journal | seed from snapshot | |
| RequestRuntime | A | snapshot + journal | seed from snapshot | |
| WorkRuntime | A+B | snapshot + journal | seed from snapshot | stages/queues in snapshot |
| InteractionRuntime | A | snapshot + journal | seed from snapshot | |
| CommunicationRuntime | A | snapshot + journal | seed from snapshot | |
| CommunicationPreferenceRuntime | A | snapshot + journal | seed from snapshot | opt-out must survive |
| ApprovalRuntime | A | snapshot + journal | seed from snapshot | decisions durable |
| AutomationRuntime | A+B | snapshot + journal | seed from snapshot | definitions + runs |
| TeamRuntime | A | snapshot + journal | seed from snapshot | assignments in work runtime |
| ConnectionRuntime | A/B | snapshot + journal | seed from snapshot | connection config + state |
| CapabilityRuntime | B | snapshot | seed from snapshot | from package install |
| SegmentDefinitionRuntime | B | snapshot | seed from snapshot | membership NOT persisted |
| IndustryPackageInstallationRuntime | B | metadata + snapshot | recordInstallation | fingerprint dedup |
| CompanyWorkspaceRuntime | A/B | snapshot + journal | seed from snapshot | knowledge if mutated |
| AnalyticsRuntime | C | optional snapshot | rebuild from platform events | prefer rebuild |
| OnboardingRuntime | D/E | skip or metadata only | fresh | not required for Horizon |
| PlatformEventStore | A | durable log | seed from log | append-only |
| WorkspaceActivationRegistry | B | metadata table | load on activate | |
| HorizonDemoBootstrapRegistry | E→B | metadata table | check before bootstrap | version marker only |
| WorkspaceDeliveryDedup | D→A | dedup table | load per workspace | webhook idempotency |

### `exportState` / seed pattern

Each runtime gains (implementation phase):

```javascript
// RequestRuntime
static fromSnapshot(snapshot, { nowISO }) {
  return new RequestRuntime({ seed: () => snapshot, nowISO });
}
exportState() { return this._state; } // already deep-frozen JSON-safe
```

No second domain model — snapshot IS `_state`.

---

## 10. Idempotency Strategy

| Source | Key | Enforcement |
|---|---|---|
| Internal domain events | `event.id` | UNIQUE(workspace_id, event_id) |
| Webhook ingress | `providerId:externalEventId` | UNIQUE(workspace_id, delivery_key) |
| External provider actions | `idempotencyKey` | UNIQUE(workspace_id, idempotency_key) |
| Package installation | `configurationFingerprint` | UNIQUE(workspace_id, fingerprint) |
| Demo bootstrap | `bootstrap_version` | UNIQUE(workspace_id, version) |
| Work from request | `work_{requestId}` | runtime throws on duplicate create |
| Automation run start | run id | runtime no-op if exists |
| Workspace activation | `workspaceId` | metadata upsert |

**Duplicate webhook flow:**

1. Ingress checks durable dedup table.
2. If seen → return 200, no mutation.
3. If new → mark pending → process → append events → mark complete.
4. Retry with same external id → dedup hit.

---

## 11. Transaction and Failure Strategy

### Transaction boundary

One business mutation = one `persistence.transaction(workspaceId, fn)`:

- Append domain event(s)
- Append platform event(s)
- Upsert affected runtime snapshot(s)
- Update metadata if needed (e.g., `updatedAt`)

### Failure modes

| Failure | Behavior |
|---|---|
| Persist fails after in-memory mutation | Return error; in-memory state discarded on next activation; retry safe via idempotency |
| Partial snapshot write | Transaction rollback; no partial workspace state |
| Activation load corrupt | Fail closed with explicit error; do not serve empty workspace |
| Bootstrap interrupted mid-run | Marker not set; restart re-runs bootstrap (idempotent entity ids prevent duplicates) |
| Two concurrent activations same workspace | Last-write-wins on cache; DB transaction serializes writes per workspace |

### Process restart mid-mutation

If restart occurs after DB commit but before UI refresh: activation loads committed state; UI shows durable reality.

---

## 12. Projection Reconstruction Strategy

| Projection | Strategy | Persist? |
|---|---|---|
| Segment membership | Recompute via `projectSegmentMembership` | No |
| Audience dashboard | Recompute from segment + preferences | No |
| Mission Control / OperatingState | Recompute via `BusinessCommandCenterComposer` | No |
| Business episodes | Recompute via `BusinessEpisodeProjection` | No |
| Work view | Recompute via `WorkViewAdapter` | No |
| Engagement / People index | Recompute via `EngagementPartyIndexBuilder` | No |
| Team workload | Recompute via `TeamWorkloadProjectionSubscriber` on activate OR lazy from work facts | No |
| Analytics metrics | Rebuild from platform event replay into AnalyticsRuntime | Optional cache |
| Handled-by-VIBETech feed | Rebuild from platform events | No |

**Rule:** Never persist presentation strings, counts, or labels. UI derives from hydrated canonical facts.

**On activation:** projections are pure functions of loaded runtimes. Subscribers re-attach to bus for incremental updates going forward.

---

## 13. Durable Demo Bootstrap Plan

### Current behavior (process-local)

`HorizonDemoBootstrapRegistry` marks `epic23_v1` per workspace. Lost on restart → bootstrap reruns → duplicate business facts.

### New behavior

```
Fresh Horizon workspace (ws_horizon_properties):
  1. configure baseline (activation metadata → persist)
  2. install package (recordInstallation → persist)
  3. if bootstrap_version NOT in metadata:
       execute demo INPUT EVENTS through real boundaries
       persist all resulting canonical facts
       set bootstrap_version = epic23_v1
  4. return composition

Restart:
  1. load snapshots + metadata
  2. bootstrap_version present → SKIP inputs
  3. reconstruct same business reality

Intentional reset (dev only):
  1. persistence.deleteWorkspace(workspaceId) OR resetHorizonWorkspace()
  2. workspaceCompositionRegistry.clear(workspaceId)
  3. reload → bootstrap runs once again
```

### Bootstrap guard

- Durable `workspace_metadata.bootstrap_version` — NOT `HorizonDemoBootstrapRegistry` alone.
- Registry cache may mirror marker for performance but is not authoritative.

### Rule preserved

```
CONFIGURATION → INPUT EVENTS → REAL OPERATING LOOP → DERIVED OUTCOMES
```

Bootstrap persists **inputs' effects** (canonical facts), never hardcoded final outcomes.

---

## 14. Multi-Workspace Isolation Plan

### Test workspaces

- `ws_horizon_properties` (Horizon demo)
- `ws_test_isolation_b` (generic empty + manual mutations)

### Isolation proofs

| Scenario | Proof |
|---|---|
| Same person email in two workspaces | Create party in each; both exist independently |
| Same subject external ref | Create in each workspace; no cross-read |
| Requests | Query scoped by workspace runtime instance |
| Work | work ids scoped; no cross-workspace assignment |
| Communication preferences | opt-out in A does not affect B |
| Approvals | approval in A invisible in B |
| Audience membership | segment defs per workspace; membership derived locally |

### Enforcement

- Every SQL query: `WHERE workspace_id = $1`
- Composite unique indexes: `(workspace_id, ...)`
- No shared singleton runtimes across workspaces
- `WebhookIngressService` dedup scoped per workspace (fix global singleton noted in SCALING_BOUNDARIES.md)

---

## 15. Files to Create

```
backend/database/
  migrations/
    001_workspace_metadata.sql
    002_domain_events.sql
    003_platform_events.sql
    004_runtime_snapshots.sql
    005_delivery_dedup.sql
    006_idempotency_keys.sql
  migrate.js

backend/core/persistence/
  WorkspacePersistencePort.js
  WorkspaceHydrationBundle.js
  PersistedMutationCoordinator.js
  RuntimeSnapshotRegistry.js          # maps runtimeKind → export/import
  InMemoryWorkspacePersistence.js
  PostgresWorkspacePersistence.js
  SqliteWorkspacePersistence.js         # optional local dev

backend/core/persistence/providers/
  createPersistenceProvider.js          # env-based factory

backend/core/workspace/activation/
  WorkspaceHydrationService.js          # load + construct stack

backend/core/persistence/
  WorkspacePersistence.test.js
  WorkspaceReconstruction.test.js
  MultiWorkspaceIsolation.test.js
  IdempotencyAndFailure.test.js
  DemoBootstrapDurability.test.js

docker-compose.yml                      # postgres:16-alpine for local dev

scripts/
  db-up.sh                              # one-command local DB
  db-migrate.sh
  reset-horizon-demo.sh                 # dev reset
```

---

## 16. Files to Modify

```
backend/core/workspace/activation/activateWorkspace.js
  → load from persistence before building fresh stack
  → persist after first activation / mutations
  → skip bootstrap when durable marker present

backend/core/workspace/activation/WorkspaceActivationRegistry.js
  → read-through/write-through to durable metadata

backend/core/integration/HorizonDemoBootstrapRegistry.js
  → delegate marker checks to durable metadata

backend/core/integration/HorizonPropertiesDemoBootstrap.js
  → persist facts after bootstrap; set durable marker

backend/core/events/PlatformEventStore.js
  → optional: delegate append to persistence coordinator

backend/core/integrations/inbound/WebhookIngressService.js
  → durable dedup instead of process-local only

backend/core/integrations/inbound/WorkspaceDeliveryDedup.js
  → backed by persistence port

frontend/lib/workspace/WorkspaceCompositionRegistry.js
  → clear() on reset; document as cache-only

frontend/lib/workspace/ConnectedBusinessWorkspace.ts
  → route activation through hydration service

frontend/lib/workspace/WorkspaceService.ts
  → pass workspaceId consistently; support reconstruction

backend/package.json
  → add pg (or better-sqlite3), migration runner dep

.env.example
  → DATABASE_URL, PERSISTENCE_PROVIDER=postgres|sqlite|memory

README.md
  → local DB setup instructions
```

**Per-runtime (implementation):** add `exportState()` and `fromSnapshot()` to each canonical runtime — minimal, no repository inside runtime.

---

## 17. Migration Plan

### Phase 25.1 — Foundation (prove restart)

1. Create `backend/database/` + docker-compose Postgres.
2. Implement `WorkspacePersistencePort` + `InMemoryWorkspacePersistence`.
3. Implement metadata + runtime snapshot tables.
4. Wire `activateWorkspace` to load/save snapshots.
5. Prove: activate → mutate → destroy cache → reactivate → same state.

### Phase 25.2 — Journal + platform events

1. Domain event journal table + append on mutation.
2. Platform event durable log.
3. `PersistedMutationCoordinator` wraps all write paths.

### Phase 25.3 — Idempotency + bootstrap

1. Durable webhook dedup.
2. Durable bootstrap version marker.
3. Dev reset script.

### Phase 25.4 — Projections + multi-workspace

1. Reconstruction tests for all UI projections.
2. Two-workspace isolation suite.

### Phase 25.5 — Browser proof + docs

1. Full app restart browser verification.
2. Finalize this document with as-built notes.

### Production path

- Deploy Postgres (managed or self-hosted).
- Run migrations on deploy.
- Set `PERSISTENCE_PROVIDER=postgres`.
- No schema changes required for SQLite → Postgres if using portable SQL.

---

## 18. Test Matrix

| # | Test | Type | Assert |
|---|---|---|---|
| 1 | Duplicate webhook delivery | integration | single request/work created |
| 2 | Restart after request creation | reconstruction | request exists, no duplicate |
| 3 | Restart after work creation | reconstruction | work exists with correct assignment |
| 4 | Restart after approval before UI refresh | reconstruction | approval decision visible |
| 5 | Repeated workspace activation | integration | same state, no duplicate bootstrap |
| 6 | Repeated demo bootstrap | integration | marker prevents re-run |
| 7 | Failed provider action + retry | idempotency | single external action record |
| 8 | Two workspaces simultaneous | isolation | no cross-contamination |
| A | Form inquiry survives teardown | mutation proof | request + party persist |
| B | Missed call survives | mutation proof | interaction persist |
| C | Comm preference opt-out survives | mutation proof | preference enforced |
| D | Work assignment survives | mutation proof | assignee correct |
| E | Owner approval survives | mutation proof | status approved |
| F | Owner rejection survives | mutation proof | status rejected |
| G | Qualification note survives | mutation proof | interaction note present |
| H | Audience membership reconstructs | projection | correct members after reload |
| I | Connection state survives | mutation proof | connection status correct |

---

## 19. Manual Browser Verification

1. Start DB: `./scripts/db-up.sh && ./scripts/db-migrate.sh`
2. Start app: `npm run dev` (port 3000)
3. Open Horizon Mission Control (`/mission-control` or default route)
4. Record visible state: request count, work items, people names, attention items
5. Perform real mutation (e.g., approve attention item, or submit inquiry)
6. Stop application completely (kill process)
7. Restart application
8. Reopen same workspace (`ws_horizon_properties`)
9. Confirm:
   - Prior business reality unchanged
   - Mutation persisted
   - No duplicate demo requests/work/comms
   - No "Invalid Date", no duplicate Taylor/Maria/Jordan records

---

## 20. Risks and Anti-Patterns

| Risk | Mitigation |
|---|---|
| Snapshot schema drift | `schema_version` + migration transforms |
| Forgetting to persist a mutation path | `PersistedMutationCoordinator` as single write gate |
| Bus replay duplicates | Snapshot hydration, not replay-through-bus |
| Composition cache stale | Invalidate on persist; TTL optional |
| Global webhook dedup | Scope dedup per workspace in DB |
| UI becomes source of truth | Adapters remain read-only projections |
| Vertical tables in Core | One generic snapshot table keyed by runtimeKind |
| Large snapshot payloads | Compress JSON; checkpoint later optimization |
| SQLite/Postgres divergence | Portable SQL; test both in CI |
| Bootstrap creates fake outcomes | Only input events; outcomes from operating loop |

### Anti-patterns (do not do)

- `mission_control_snapshots` table
- Storing React component state
- Direct SQL from Next.js route handlers
- Repository classes inside `RequestRuntime.js`
- Second `Party` / `Work` domain model for DB

---

## 21. Definition of Done Checklist

- [ ] Every stateful runtime audited
- [ ] Canonical vs derived state classified
- [ ] Persistence model justified
- [ ] Universal persistence boundary implemented
- [ ] No vertical-specific persistence in Core
- [ ] Workspace reconstruction works
- [ ] Composition cache is not source of truth
- [ ] Inquiry survives restart
- [ ] Work survives restart
- [ ] Interaction survives restart
- [ ] Communication preference survives restart
- [ ] Approval decision survives restart
- [ ] Team assignment survives restart
- [ ] Audiences reconstruct correctly
- [ ] Demo bootstrap is durably idempotent
- [ ] Duplicate webhooks remain idempotent
- [ ] Multi-workspace isolation proven
- [ ] UI reads reconstructed reality
- [ ] Full application restart browser-tested
- [ ] No duplicate source of truth created
- [ ] No page-specific persistence created
- [ ] No hardcoded final outcomes introduced

---

## STOP

**This is a plan only. Do not implement until reviewed and approved.**

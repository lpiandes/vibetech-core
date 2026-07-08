# EPIC 26 — Invite-Only Multi-Business SaaS Foundation

**Status:** IN PROGRESS — Phase 1 implemented (empty business + explicit demo)

**Phase 1 as-built (2026-07-06):**
- `CompanyWorkspaceRuntime` defaults to `buildEmptyCompanySeed()` — no production fake business facts
- Legacy ABC Property Group seed moved to `backend/core/company/fixtures/ABCPropertyGroupSeed.js` (tests only)
- `activateWorkspace()` no longer auto-resolves Horizon; demo bootstrap runs only when `demoConfigurationId: horizon_properties` is explicit
- `BusinessRegistry` (`data/business-registry.json`) lists businesses for dev entry until Phase 2 auth
- `npm run demo:create-horizon` in `backend/` creates Horizon DEMO explicitly
- Frontend `/` is temporary business entry; product routes require `vibetech_workspace_id` cookie
- `/home` shows intentional empty-business onboarding copy

**Goal:** Transform VIBETech from a hardcoded Horizon Properties demo into a real invite-only, multi-business SaaS product that can safely be given to actual clients.

**Foundational rule:**

```
CODE DEFINES WHAT THE PRODUCT CAN DO.
DATA DEFINES WHAT ACTUALLY EXISTS.
```

**Architecture rule preserved:**

```
INPUT → DOMAIN BOUNDARY → CANONICAL BUSINESS FACT → DURABLE STORAGE → PROJECTION → UI
```

Platform identity (users, memberships, invitations) is a **separate layer** from business operating state (17 runtimes). They connect through `businessId` / `workspaceId` and authorization — not by duplicating business domain models.

---

## 1. Executive Summary

VIBETech has a sophisticated **business operating engine** (17 stateful runtimes, event-driven pipelines, industry packages, Digital Employees) but is **not a real SaaS product today**. The default user journey loads `ws_horizon_properties`, auto-installs Property Management, auto-seeds Horizon parties/subjects/requests/work, and imports backend runtimes directly from Next.js pages with **no authentication or authorization**.

EPIC 25 correctly identified durability requirements. EPIC 26 **extends** that work to serve a real product model:

| Layer | Today | Target |
|---|---|---|
| Identity | None | Users, sessions, platform admin |
| Tenancy | `workspaceId` string in memory | Durable `Business` + membership |
| Access | Anyone with URL | Invite-only, role-scoped |
| Business facts | Horizon demo auto-bootstrap | Real input only (or explicit DEMO workspace) |
| Persistence | All in-memory | EPIC 25 hybrid model on PostgreSQL |
| UI | Technical cockpit for demo | Premium SMB SaaS, 5-second comprehension |

**Recommended approach:** Build a **Platform Layer** (PostgreSQL) for users/businesses/memberships/invitations, gate all workspace operations behind **authenticated API boundaries**, adopt **EPIC 25 hybrid persistence** keyed by `businessId`, and **quarantine Horizon** to an explicit admin/demo seed command.

**Do not** create a second business domain model. **Do not** put platform users inside `TeamRuntime` for auth.

---

## 2. Current Product Reality

### What the product actually is today

1. User opens app → `redirect("/mission-control")` (`frontend/app/page.tsx`)
2. `AppShell` constructs `new WorkspaceService()` with **default** `workspaceId = "ws_horizon_properties"`
3. `WorkspaceCompositionRegistry` caches `ConnectedBusinessWorkspace` for that ID
4. `activateWorkspace()` detects `ws_horizon_properties` → auto-resolves Horizon activation
5. Property Management package installs → human team from demo config → Horizon workspace configured → **demo bootstrap runs** (inquiries, missed call, business day inputs)
6. UI renders Mission Control with Taylor Brooks, Maria Chen, Jordan Kim, Harbor View units, etc.

### What works (architecturally sound)

- 17 runtimes with `applyEvent()` mutation boundaries
- Industry package installation (capabilities, knowledge **categories**, automations, terminology)
- Platform event bus + subscribers (request→work, assignment, analytics, automation)
- View adapters projecting runtime facts to UI view models
- Cross-workspace runtime isolation **within a single process** (distinct runtime instances per `workspaceId`)
- Mutation paths through real services (approvals, communications, interactions)
- EPIC 24.5 cockpit polish on several routes

### What does not work for real clients

| Gap | Evidence |
|---|---|
| No authentication | No middleware, no session, no login routes |
| No authorization | API routes (`/api/approvals/...`) accept any request; `workspaceId` is a constructor default |
| No durable state | All runtimes in-memory; restart loses everything |
| Horizon is the default product | `DEFAULT_PRODUCT_WORKSPACE_ID`, `resolveDefaultActivationForWorkspace` |
| Fake business data in core seed | `CompanyWorkspaceRuntime` constructor seeds properties, buyers, inquiries, employees, knowledge items |
| Demo bootstrap on activation | `bootstrapHorizonPropertiesDemo()` called from `activateWorkspace` when `demoConfigurationId === horizon_properties` |
| Frontend imports backend directly | `WorkspaceService` → `ConnectedBusinessWorkspace` → `activateWorkspace` in server components |
| No business list / switching | Single implicit workspace |
| UI exposes internal concepts | Episodes, operating states, readiness enums, CONFIGURING/DEGRADED in several surfaces |
| Readiness theater on empty businesses | Knowledge shows 0/26 gaps; team shows offline digital employees |

---

## 3. Hardcoded Reality Audit

Classification: **KEEP** (legitimate package/test), **MOVE** (explicit demo only), **REMOVE** (must not appear in normal production path).

### A. Workspace activation & routing

| Location | What | Classification | Action |
|---|---|---|---|
| `frontend/lib/workspace/WorkspaceService.ts` `DEFAULT_PRODUCT_WORKSPACE_ID = "ws_horizon_properties"` | Default tenant | **REMOVE** | Require session-selected business; no default demo ID |
| `activateWorkspace.js` `resolveDefaultActivationForWorkspace` | Auto-Horizon for one ID | **REMOVE** | Activation comes from durable business record only |
| `activateWorkspace.js` `bootstrapHorizonPropertiesDemo()` on activation | Auto demo inputs | **MOVE** | Only via explicit `createDemoWorkspace` admin command |
| `activateWorkspace.js` `configureHorizonPropertiesWorkspace()` on activation | Auto parties/subjects | **MOVE** | Demo seed only |
| `activateWorkspace.js` `installPackageEmployees(humanTeamMembers from demo config)` | Fake humans | **REMOVE** from normal path | Humans come from invitations → TeamRuntime events |
| `ConnectedBusinessWorkspace.ts` | Calls `activateWorkspace` in constructor | **KEEP** pattern | Gate behind auth + hydration service |
| `WorkspaceCompositionRegistry` | Process cache | **KEEP** | Cache only; not source of truth |
| `frontend/app/page.tsx` | Redirect to mission-control | **REMOVE** | Redirect to `/login` or `/platform` based on session |

### B. Horizon demo fixtures

| Location | Classification | Action |
|---|---|---|
| `industries/property-management/demo/HorizonPropertiesDemoConfig.js` | **MOVE** | Demo seed config only |
| `backend/core/integration/HorizonPropertiesDemoBootstrap.js` | **MOVE** | Explicit demo command only |
| `backend/core/integration/HorizonPropertiesWorkspaceConfigurator.js` | **MOVE** | Demo seed only |
| `backend/core/integration/HorizonSecondaryDemoScenarios.js` | **MOVE** | Demo seed only |
| `backend/core/integration/HorizonDemoBusinessDay.js` | **MOVE** | Demo seed only |
| `backend/core/integration/FirstClientOperatingLoopRunner.js` | **MOVE** | Demo input runner |
| `backend/core/integration/HorizonDemoBootstrapRegistry.js` | **MOVE** | Durable demo marker (EPIC 25), not process-local |
| `frontend/.../MissionControlExecutiveLayout.tsx` `ws_horizon_properties` demo story | **MOVE** | Show only when `business.kind === DEMO` |

### C. CompanyWorkspaceRuntime legacy seed (CRITICAL)

| Location | What | Classification | Action |
|---|---|---|---|
| `CompanyWorkspaceRuntime.js` constructor | Properties, buyers, inquiries, employees, knowledge items, work queue | **REMOVE** from default | Replace with `buildEmptyCompanySeed()` |
| `CompanyWorkspaceRuntime.js` | 9+ knowledge items with `createdBy: "seed"` | **REMOVE** | Empty repository; categories from package install only |
| `CompanyWorkspaceRuntime.js` | Fake digital employees (Property Interest Coordinator, etc.) | **REMOVE** | Digital employees from package install + readiness only |
| `CompanyWorkspaceRuntime.js` | Legacy work queue / inquiries | **REMOVE** | Requests/work live in RequestRuntime/WorkRuntime |
| `backend/core/company/demo-company-runtime.js` | Demo entry | **KEEP** | Test/demo script only |

### D. Team seeds

| Location | Classification | Action |
|---|---|---|
| `TeamBuilder.buildDefaultTeamSeed()` | CEO, digital_ops, overloaded members | **KEEP** test fixture | Never used in production activation |
| `TeamBuilder.buildEmptyTeamSeed()` | Empty members, seed departments | **KEEP** | Default for new businesses; consider reducing seed departments to 0 |
| `TeamBuilder.buildSeedDepartments()` 7 departments | **REMOVE** from empty path | New businesses: no phantom departments |

### E. Package definitions (legitimate — KEEP)

| Location | What |
|---|---|
| `PropertyManagementPackage.js` | Automation configs, knowledge **category definitions**, employee templates, terminology |
| `installPackageCapabilities.js` | Capability registrations |
| `installPackageKnowledgeCategories.js` | Category structure (not content items) |
| `installPackageAutomations.js` | Automation definitions |
| `installPackageEmployees.js` | Digital employee **templates** (not humans) |
| `PropertyManagementDashboardPresentation.js` | Label maps, pulse metric config |
| `builtInKnowledgeCategories.js` | Generic category taxonomy |

### F. Request/Work/Graph runtimes (mostly clean)

| Runtime | Default seed | Classification |
|---|---|---|
| `RequestRuntime` | Empty requests | **KEEP** |
| `WorkRuntime` | Empty work items | **KEEP** |
| `BusinessGraphRuntime` | Empty | **KEEP** |
| `BusinessSubjectRuntime` | Empty | **KEEP** |
| `InteractionRuntime` | Empty | **KEEP** |
| `CommunicationRuntime` | Empty | **KEEP** |

### G. Tests using Horizon fixtures

| Location | Classification |
|---|---|
| `CommandCenterMutation.test.js`, `FirstClientOperatingLoop.test.js`, etc. | **KEEP** test fixture |

**Rule:** No demo fixture may enter a normal production workspace path. Tests and explicit `scripts/demo-seed-horizon.js` only.

---

## 4. Authentication Audit

### Current state: **no authentication exists**

| Check | Result |
|---|---|
| `middleware.ts` | Not present |
| Login/signup pages | Not present |
| Session management | Not present |
| `next-auth`, `clerk`, `@supabase/ssr` | Not in dependencies |
| API route auth checks | None — `WorkspaceService` instantiated without user context |
| Password hashing / tokens | None |
| Email delivery for invites | `GmailProvider` exists for business comms demo, not auth |

### OnboardingRuntime

- `OnboardingRuntime` tracks **business setup steps** (company profile, connections), not user authentication.
- Do not conflate with login.

### Recommendation

**PostgreSQL + Auth.js (NextAuth v5)** or **Supabase Auth** for email/password + magic link invitations.

| Criterion | Auth.js + Postgres | Supabase Auth |
|---|---|---|
| Fits existing greenfield DB plan | Excellent | Good (external dependency) |
| Invite email flow | Custom invitation table + Resend/SMTP | Built-in invite |
| Self-hosted | Yes | Optional |
| Session in Next.js App Router | Native support | SSR helpers |

**Recommendation:** **Auth.js v5 + PostgreSQL** for session identity, with a custom `Invitation` table for invite-only onboarding. Keeps all SaaS data in one database. Use Resend (or SMTP) for invitation emails.

Platform admin is a **database flag** (`users.platform_role = PLATFORM_ADMIN`), not an environment variable alone.

---

## 5. Current Multi-Tenancy Audit

| Mechanism | Isolation level | Production safe? |
|---|---|---|
| `workspaceId` on runtime instances | Per-activation instance separation | Partial — no auth gate |
| `WorkspaceCompositionRegistry` | Per-process cache keyed by ID | No — IDOR if URL known |
| `WorkspaceActivationRegistry` | Per-process config map | No — not durable |
| `WebhookIngressService` dedup | **Global** singleton (documented risk) | No |
| Database tenancy | **Does not exist** | No |
| Email/party uniqueness | Per runtime instance | Yes within workspace, not across without persistence |

**Verdict:** Runtime architecture supports multi-workspace **instances** but the **product** is single-tenant demo with no access control.

---

## 6. Canonical SaaS Data Model

Platform entities live in **PostgreSQL**. Business operating state lives in **runtime persistence** (EPIC 25). Link via `businesses.id` = `workspaceId` in runtime layer.

```
┌─────────────────────────────────────────────────────────────┐
│ PLATFORM LAYER (PostgreSQL — SaaS control plane)          │
│                                                             │
│  users ──┬── business_memberships ── businesses           │
│          │                              │                   │
│  platform_roles (on user)               │ industry_package  │
│  invitations ──────────────────────────│ activation_config  │
│  sessions / auth_accounts               │ kind: LIVE|DEMO  │
│  audit_events (platform)                │                   │
└────────────────────────────│────────────────────────────────┘
                             │ business_id
┌────────────────────────────▼────────────────────────────────┐
│ BUSINESS OPERATING LAYER (Runtime persistence — EPIC 25)    │
│                                                             │
│  workspace_snapshots (per runtime kind)                     │
│  workspace_domain_events                                      │
│  workspace_platform_events                                    │
│  workspace_metadata (installation, bootstrap markers)       │
│  webhook_dedup                                                │
│                                                             │
│  Hydrated into: 17 runtimes + PlatformEventStore            │
└─────────────────────────────────────────────────────────────┘
```

### Entity definitions

**User**
- `id` (uuid), `email` (unique), `name`, `password_hash` (nullable if magic-link only), `platform_role` (nullable enum: `PLATFORM_ADMIN`), `created_at`, `updated_at`, `last_login_at`

**Business** (maps to workspace)
- `id` (uuid, used as `workspaceId` in runtimes), `name`, `slug`, `industry_package_id`, `industry_package_version`, `kind` (`LIVE` | `DEMO`), `status` (`ACTIVE` | `SUSPENDED` | `PROVISIONING`), `owner_user_id`, `created_by_user_id`, `created_at`, `updated_at`, `last_activity_at`

**BusinessMembership**
- `id`, `business_id`, `user_id`, `role` (`OWNER` | `ADMIN` | `MANAGER` | `EMPLOYEE` | `VIEWER`), `status` (`ACTIVE` | `SUSPENDED` | `REVOKED`), `invited_by_user_id`, `joined_at`, `created_at`
- Unique: `(business_id, user_id)`

**Invitation**
- `id`, `business_id`, `email`, `role`, `token_hash`, `status` (`PENDING` | `ACCEPTED` | `REVOKED` | `EXPIRED`), `expires_at`, `accepted_at`, `accepted_by_user_id`, `invited_by_user_id`, `created_at`
- Unique: `(business_id, email, status)` where pending — or use partial unique index

**PlatformRole** — stored on `users.platform_role`; no separate table initially.

**BusinessRole** — enum on `business_memberships.role`.

**Session** — managed by Auth.js (`sessions` table) linking to `users.id`.

**AuditActor** — `audit_events` table: `actor_user_id`, `actor_type` (`USER` | `PLATFORM_ADMIN` | `SYSTEM`), `business_id`, `action`, `metadata`, `created_at`.

### Integration with existing architecture

- `workspaceId` in all runtimes = `businesses.id`
- `TeamRuntime` members = **business operators** (humans invited to the business), created via `TEAM_MEMBER_CREATED` when invitation accepted — separate from `BusinessMembership` but linkable via `metadata.userId`
- Digital Employees remain package-installed templates in `TeamRuntime` with `memberType: digital_employee`
- **Do not** store requests/work/parties in platform tables

---

## 7. Platform Admin Model

### Authority

`users.platform_role = PLATFORM_ADMIN` grants:

| Capability | Mechanism |
|---|---|
| List all businesses | Query `businesses` without membership filter |
| Search businesses | Name, slug, owner email |
| Create business | Insert `businesses` + send owner invitation |
| Enter any business | `impersonation_context` or `platform_access` audit log; loads workspace via admin session |
| View platform health | Aggregate: business count, suspended, demo vs live, last activity |
| Create demo workspace | `businesses.kind = DEMO` + explicit seed command |
| Reset demo workspace | Truncate runtime persistence for that `business_id` + re-seed |

### Platform Admin must NOT

- Be inserted as fake `TeamRuntime` member in every client business
- Bypass audit logging
- Mutate business facts without going through domain boundaries (support actions still use services)

### UI entry

- Route: `/platform` (or `/admin`)
- Shown only when `session.user.platformRole === PLATFORM_ADMIN`
- Business users never see this route

---

## 8. Business Membership Model

### Roles (internal enum → UI label)

| Internal | UI label | Capabilities (initial) |
|---|---|---|
| `OWNER` | Owner | Full business access, billing (future), invite admins, connections, settings |
| `ADMIN` | Administrator | Full operations, invite employees, settings (no platform) |
| `MANAGER` | Manager | Work, people, communications, team view; invite employees (optional) |
| `EMPLOYEE` | Team member | Assigned work, relevant people/comms, limited settings |
| `VIEWER` | View only | Read-only surfaces |

### Extension points

- `business_memberships.permissions` JSON column (future) for granular overrides
- `role_capabilities` config table (future) without changing enum names in code

### TeamRuntime vs BusinessMembership

| | BusinessMembership | TeamRuntime member |
|---|---|---|
| Purpose | **Access control** | **Business operations** (assignments, workload) |
| Durable store | PostgreSQL | Runtime persistence |
| Created when | Invitation accepted | Same moment + linked via `userId` |
| Used for | API authorization | Work assignment, team page |

---

## 9. Invitation Lifecycle

```
Platform Admin or Owner creates invitation
  → INSERT invitations (token_hash, expires_at = now + 7 days)
  → SEND email with link: /invite/{token}

Recipient clicks link
  → GET /invite/{token} — validate not expired/revoked/used
  → If no account: registration form (email pre-filled)
  → If account exists: login
  → POST /invite/{token}/accept
      → Create/update user
      → Create business_membership (ACTIVE)
      → Create TeamRuntime member (if OPERATIONAL role)
      → Mark invitation ACCEPTED
      → Redirect to business home

Owner invites employee — same flow, scoped role
```

### Idempotency & safety

| Scenario | Behavior |
|---|---|
| Accept twice with same token | Second accept returns success, no duplicate membership |
| Expired token | Show expired state; offer "request new invite" |
| Revoked invitation | Reject with clear message |
| Reused token after accept | Idempotent redirect to business |
| Wrong email logged in | Reject — email must match invitation |
| Platform admin invite | Creates business + owner invitation in one transaction |

### Durable requirements

- Token stored as **hash** only (SHA-256 of secure random token)
- Single-use enforced by `status` transition `PENDING → ACCEPTED`
- Full audit trail in `audit_events`

---

## 10. Authorization Boundaries

### Rule (every request)

```
authenticated user
+ requested business_id
+ (active membership OR platform_admin)
= access allowed
```

### Enforcement points

| Boundary | Today | Target |
|---|---|---|
| Next.js pages | Open | Server component checks session + membership |
| API routes (`/api/*`) | Open | Middleware + `authorizeBusinessAccess()` |
| `WorkspaceService` | Direct backend import | **Remove from client path**; server-only via `AuthorizedWorkspaceService` |
| `workspaceId` query param | Trusted | **Ignored** — business from session or explicit admin override |
| Platform admin enter business | N/A | `session.platformAdmin` + `?businessId=` with audit |

### Implementation pattern

```typescript
// Pseudocode — plan only
async function resolveAuthorizedWorkspace(session, requestedBusinessId) {
  if (session.platformRole === 'PLATFORM_ADMIN') {
    return loadWorkspace(requestedBusinessId, { audit: 'platform_enter' });
  }
  const membership = await db.membership.find(session.userId, requestedBusinessId);
  if (!membership || membership.status !== 'ACTIVE') throw Forbidden();
  return loadWorkspace(requestedBusinessId, { role: membership.role });
}
```

### Role-based UI

- Navigation built from `membership.role` + installed package modules
- VIEWER: hide mutation actions
- EMPLOYEE: hide Settings, Connections admin

---

## 11. Persistence Integration

**Incorporate EPIC 25 hybrid model without discarding it.** Persistence now serves the SaaS model:

| EPIC 25 artifact | SaaS usage |
|---|---|
| `workspace_snapshots` | Keyed by `business_id`; hydrate runtimes on activation |
| `workspace_domain_events` | Audit + idempotency per business |
| `workspace_platform_events` | Activity feed, analytics source |
| `workspace_metadata` | Activation config, installation fingerprint |
| `bootstrap_version` | Demo-only marker on `kind=DEMO` businesses |
| `webhook_dedup` | Per-business ingress idempotency |
| `WorkspaceCompositionRegistry` | Cache after hydration |
| `PersistedMutationCoordinator` | All domain writes after auth check |

### New platform tables (separate from runtime persistence)

- `users`, `businesses`, `business_memberships`, `invitations`, `sessions`, `accounts` (Auth.js), `audit_events`, `platform_settings`

### Fresh business persistence

- On business create: empty snapshots (or no rows — hydration uses empty seeds)
- Package install: writes installation record + capability/category/automation snapshots
- **No** demo bootstrap marker for `kind=LIVE`

### Transaction boundaries

- Platform: create business + invitation = one transaction
- Business: one domain mutation = one workspace transaction (EPIC 25)
- Never cross-business transactions

---

## 12. Demo Isolation Strategy

Horizon Properties survives **only** as:

```bash
# Development / platform admin only
npm run demo:create-horizon
npm run demo:reset-horizon
```

### Demo business record

```json
{
  "id": "uuid-or-fixed-dev-id",
  "name": "Horizon Properties",
  "kind": "DEMO",
  "industry_package_id": "pkg_property_management",
  "slug": "horizon-properties-demo"
}
```

### Demo creation flow

1. Platform admin runs `demo:create-horizon` (or clicks "Create demo" in admin UI)
2. Insert `businesses` row with `kind=DEMO`
3. `activateWorkspace` with explicit `demoConfigurationId: horizon_properties`
4. Run `configureHorizonPropertiesWorkspace` + `bootstrapHorizonPropertiesDemo`
5. Persist all resulting canonical facts + `bootstrap_version=epic23_v1`
6. Mark business with visible **DEMO** badge everywhere

### Normal business create — never calls demo paths

- `resolveDefaultActivationForWorkspace` **deleted**
- `DEFAULT_PRODUCT_WORKSPACE_ID` **deleted**
- `bootstrapHorizonPropertiesDemo` gated on `business.kind === DEMO`

---

## 13. Workspace Creation Lifecycle

```
Platform Admin: Create Business
  → INSERT businesses (PROVISIONING, kind=LIVE)
  → INSERT invitation for owner (role=OWNER)
  → SEND email
  → (no runtime bootstrap yet)

Owner accepts invitation
  → CREATE membership
  → activateWorkspace(businessId, { industryPackageId, packageConfiguration from setup wizard })
  → installPackage (capabilities, categories, automations, digital employee templates)
  → persist empty canonical state + installation metadata
  → business.status = ACTIVE
  → redirect to onboarding checklist (zero-data dashboard)

Owner completes setup wizard (optional paths)
  → connect email (ConnectionRuntime)
  → add knowledge content (CompanyWorkspaceRuntime events)
  → invite team (invitations → TeamRuntime)
  → configure Digital Employees
```

**No** `humanTeamMembers` from demo config. **No** parties/subjects/requests until real input.

---

## 14. Workspace Access Lifecycle

```
User signs in
  → session created

Platform Admin
  → /platform (business list)
  → select business → /b/{businessId}/home (audit logged)

Business user with 1 membership
  → redirect to /b/{businessId}/home

Business user with N memberships
  → /platform or business switcher

Each page/API request
  → authorize(session, businessId)
  → hydrate workspace from persistence (or cache)
  → render role-appropriate UI
```

---

## 15. UI Information Architecture

### Design direction

Use `product/design/VISUAL_HIERARCHY.md`, `SCREEN_BLUEPRINTS.md`, and the property management reference aesthetic as direction:

- Premium modern SaaS (clean sidebar, generous whitespace, strong typography)
- Business-first language
- Dense but scannable rows (not giant empty KPI cards)
- Clear status colors
- Excellent empty states

**Do not** copy reference literally. **Do not** do another cosmetic pass on current cockpit layouts — replace shell and dashboard.

### Proposed navigation (SMB mental models)

| Current | Proposed | Notes |
|---|---|---|
| Command Center | **Home** | Owner landing; answers "what happened / what needs me" |
| Needs decision | **For you** | Decisions only |
| Work & Coordination | **Work** | Queue + assignments |
| People & Relationships | **People** | Contacts, relationships |
| Communications | **Inbox** | Threads, messages |
| Team & Digital Workforce | **Team** | Humans + Digital Employees |
| Knowledge | **Knowledge** | Keep |
| Business Performance | **Insights** | Hidden until real analytics exist |
| Audiences | **Audiences** | Keep or merge into People later |
| Connections | **Integrations** | Setup connections |
| Workspace Setup | **Settings** | Business config |

Group nav:

- **Operate:** Home, For you, Work, Inbox, People
- **Manage:** Team, Knowledge, Audiences, Integrations
- **Account:** Settings

### Terms never shown to users

canonical, runtime, episode, projection, operating state, activation, configuration fingerprint, PARTIALLY_READY, INDUSTRY_ACTIVATED, CONFIGURING, DEGRADED, waiting_human, entity type enums

---

## 16. Platform Admin UX

### Screen: `/platform`

```
Good afternoon, {firstName}

Your businesses                    [Search...]  [+ Add business]

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Acme Property Mgmt  │  │ Blue Harbor Realty  │  │ Horizon Properties  │
│ 3 need attention    │  │ On track            │  │ DEMO                │
│ Active 2 min ago    │  │ Active yesterday    │  │ 2 need attention    │
│ Owner: invited ✓    │  │ Owner: pending ⏳   │  │ Active 1 hr ago     │
│ [Enter business]    │  │ [Enter business]    │  │ [Enter business]    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### Create business modal

- Business name
- Industry package (Property Management, …)
- Owner email
- Optional: timezone, region
- Submit → creates business + sends invitation

### Demo section (admin only)

- "Create Horizon demo" button
- "Reset demo" with confirmation

---

## 17. Business Owner UX

### Home dashboard (replaces Mission Control for owners)

**Top bar:** Greeting · business name · search · notifications · quick action ("Add person", "Connect email")

**Metrics row (4–6 max):** Package-configured pulse metrics from **real data only**. If no data: hide row entirely (not zeros).

**Main grid:**

| Section | Content |
|---|---|
| **For you** | Approval/decision items (from Attention projection) |
| **Recent activity** | Timeline from platform events (human-readable) |
| **Work** | Open work rows (party, type, assignee, due) |
| **Team** | Digital Employees status + human workload |
| **Inbox** | Recent communications |

**No** episode cards. **No** operating state strip with internal IDs.

### Settings

- Business profile
- Team invitations
- Integrations
- Digital Employee configuration
- Industry package info

---

## 18. Employee UX

- **Home:** My work, my people, recent messages
- **Work:** Assigned items only (filtered by `membership.userId` → TeamRuntime member)
- **People:** Read access to relevant parties
- **No** Settings admin, Integrations, or invite management (unless MANAGER+)
- Sidebar: reduced nav set

---

## 19. Empty-State UX

### Brand-new business (zero facts)

**Home shows:**

> Welcome to {Business Name}
> Let's get your business ready.
>
> ☐ Invite your team
> ☐ Connect email
> ☐ Connect your property system (or CRM)
> ☐ Add operating knowledge
> ☐ Review Digital Employees

**Must NOT show:**

- Fake metrics or 0% health
- "22 gaps" from empty category coverage
- CONFIGURING / DEGRADED badges without context
- Empty giant KPI cards
- Critical readiness scores

### Per-route empty states

| Route | Empty state message |
|---|---|
| Work | "Work will appear when inquiries arrive or tasks are created." |
| People | "People appear when someone contacts your business or you add them." |
| Inbox | "Connect email to start receiving messages." |
| Team | "Invite team members and configure Digital Employees in Settings." |
| Knowledge | "Add policies and procedures your team can reference." |
| Insights | "Insights appear after your business has activity." |
| Audiences | "Audiences populate as people engage with your business." |

### Readiness reports (internal)

- Package readiness: show in **Settings → Setup progress**, not as alarming dashboard health
- Suppress `critical` level when cause is "not configured yet"

---

## 20. Route-by-Route Redesign

| Route | Current problem | Redesign |
|---|---|---|
| `/` | Redirects to demo MC | Login or platform business list |
| `/login`, `/register` | Missing | New auth pages |
| `/invite/[token]` | Missing | Invitation accept flow |
| `/platform` | Missing | Platform admin business grid |
| `/b/[id]/home` | Missing | New owner dashboard |
| `/mission-control` | Technical episodes | Redirect to `/home` or remove |
| `/attention` | OK content, tech nav | Merge into Home "For you" + `/for-you` |
| `/work` | Recently improved | Keep dense rows; remove internal labels |
| `/engagement` | OK | Rename to `/people` |
| `/communications` | OK | Rename to `/inbox` |
| `/team` | Recently improved | Split human/digital clearly; hide offline theater for fresh |
| `/knowledge` | Shows gap theater | Empty = guided setup; populated = area list |
| `/analytics` | Partial data + "recorded" copy | Hide until threshold; or Insights with honest copy |
| `/audiences` | Derived | Keep; empty state |
| `/connections` | OK | Move under Settings/Integrations |
| `/setup` | Exposes readiness enums | Settings → Setup checklist |
| `/design-system` | Dev only | Gate behind dev flag |
| API routes | No auth | All require session + membership |

---

## 21. Files to Create

### Platform layer

```
backend/database/migrations/
  001_platform_users.sql
  002_businesses.sql
  003_business_memberships.sql
  004_invitations.sql
  005_audit_events.sql
  006_auth_sessions.sql          # Auth.js adapter tables
  007_workspace_persistence.sql  # EPIC 25 tables

backend/core/platform/
  PlatformUser.js
  Business.js
  BusinessMembership.js
  Invitation.js
  PlatformAudit.js
  authorizeBusinessAccess.js
  authorizePlatformAdmin.js
  BusinessRepository.js          # Port interface
  PostgresBusinessRepository.js

backend/core/company/
  buildEmptyCompanySeed.js       # Empty runtime seed

backend/core/persistence/        # EPIC 25 (from prior plan)
  WorkspacePersistencePort.js
  PersistedMutationCoordinator.js
  PostgresWorkspacePersistence.js
  InMemoryWorkspacePersistence.js

backend/core/workspace/
  WorkspaceHydrationService.js
  EmptyWorkspaceProvisioner.js

backend/core/demo/
  DemoWorkspaceProvisioner.js    # Explicit Horizon seed only
  DemoWorkspaceProvisioner.test.js

frontend/app/
  login/page.tsx
  register/page.tsx
  invite/[token]/page.tsx
  platform/page.tsx
  b/[businessId]/home/page.tsx
  b/[businessId]/work/page.tsx   # ... other routes under business scope

frontend/lib/auth/
  auth.ts                        # Auth.js config
  session.ts

frontend/lib/platform/
  PlatformService.ts
  AuthorizedWorkspaceService.ts  # Replaces direct WorkspaceService

frontend/components/platform/
  PlatformBusinessGrid.tsx
  CreateBusinessModal.tsx
  BusinessSwitcher.tsx

frontend/components/home/
  OwnerDashboard.tsx
  OnboardingChecklist.tsx
  ActivityFeed.tsx
  ForYouPanel.tsx

middleware.ts                    # Auth + business scope

scripts/
  db-up.sh
  db-migrate.sh
  demo-create-horizon.sh
  demo-reset-horizon.sh
```

---

## 22. Files to Modify

### Remove demo from normal path

```
backend/core/workspace/activation/activateWorkspace.js
  — DELETE resolveDefaultActivationForWorkspace Horizon branch
  — GATE bootstrap/configure on business.kind === DEMO

frontend/lib/workspace/WorkspaceService.ts
  — DELETE DEFAULT_PRODUCT_WORKSPACE_ID
  — Require businessId from authorized context

frontend/components/layout/AppShell.tsx
  — Use AuthorizedWorkspaceService with session

frontend/app/page.tsx
  — Auth-aware redirect

backend/core/company/CompanyWorkspaceRuntime.js
  — Replace default constructor seed with buildEmptyCompanySeed()

backend/core/team/TeamBuilder.js
  — buildEmptyTeamSeed: no phantom departments for production
```

### API hardening

```
frontend/app/api/**/route.ts
  — Add authorizeBusinessAccess to all routes
```

### Readiness / knowledge

```
backend/core/knowledge/readiness/KnowledgeReadinessEngine.js
  — "not configured" vs "critical gap" distinction for empty businesses

backend/core/industries/employees/DigitalEmployeeReadinessEngine.js
  — Softer labels for unconfigured (not CONFIGURING in UI)
```

---

## 23. Migration Strategy

### Phase 0 — Stop the bleeding (1 week)

- `buildEmptyCompanySeed()` — no fake data in default runtime
- Remove `DEFAULT_PRODUCT_WORKSPACE_ID` and `resolveDefaultActivationForWorkspace`
- Gate demo bootstrap on explicit flag
- Document breaking change: dev must run `demo:create-horizon`

### Phase 1 — Platform database + auth (2 weeks)

- PostgreSQL + migrations for users, businesses, memberships, invitations
- Auth.js login/register/session
- `middleware.ts` protecting `/b/*` and `/api/*`

### Phase 2 — Authorization + API boundary (1 week)

- `authorizeBusinessAccess` on all workspace operations
- `AuthorizedWorkspaceService` replaces direct `WorkspaceService` in pages
- IDOR tests

### Phase 3 — Durable persistence (EPIC 25) (2–3 weeks)

- Implement hybrid persistence from EPIC 25 doc
- Hydration service on workspace access
- Webhook dedup per business

### Phase 4 — Business lifecycle (1–2 weeks)

- Platform admin: create business, invite owner
- Owner invitation accept flow
- Employee invitation flow
- Business provisioning without demo data

### Phase 5 — Explicit demo tooling (1 week)

- `DemoWorkspaceProvisioner` + admin UI
- DEMO badge + isolation tests

### Phase 6 — New application shell (2 weeks)

- Platform admin screen
- Business switcher
- New sidebar/nav IA
- Route migration to `/b/[businessId]/...`

### Phase 7 — Owner dashboard + empty states (2 weeks)

- Replace Mission Control with OwnerDashboard
- Onboarding checklist
- Per-route empty states
- Suppress readiness theater

### Phase 8 — Remaining route redesign (2–3 weeks)

- Work, People, Inbox, Team, Knowledge, Insights
- Role-based nav visibility

### Phase 9 — Proof & hardening (1–2 weeks)

- Full test matrix
- Browser verification
- Security review

**Total estimate:** 14–18 weeks sequential; some phases parallelizable.

### Challenged implementation order

Original list is correct. **One adjustment:** Phase 0 (remove hardcoded seeds) should precede everything — otherwise auth work tests against fake data. **Persistence (Phase 3) can start in parallel with Phase 2** after platform schema exists, since `business_id` is the foreign key.

---

## 24. Test Matrix

### Authentication & authorization

| # | Test |
|---|---|
| 1 | Platform Admin can list all businesses |
| 2 | Platform Admin can enter any business (audited) |
| 3 | Owner can access invited business |
| 4 | Employee can access invited business |
| 5 | Unauthorized user cannot access business |
| 6 | Changing `businessId` in URL does not bypass authorization |
| 7 | Revoked member loses access immediately |
| 8 | Suspended business blocks access |

### Invitations

| # | Test |
|---|---|
| 9 | Owner invitation flow end-to-end |
| 10 | Employee invitation flow end-to-end |
| 11 | Expired invite fails gracefully |
| 12 | Reused invite is idempotent |
| 13 | Revoked invite fails |
| 14 | Wrong-email login cannot accept invite |

### Tenancy & data isolation

| # | Test |
|---|---|
| 15 | Two businesses with same person email remain isolated |
| 16 | Fresh LIVE business contains zero demo facts |
| 17 | Explicit DEMO business contains demo facts |
| 18 | Demo bootstrap does not run for LIVE business |
| 19 | Restart preserves users, memberships, invites, work, approvals |

### Persistence (from EPIC 25)

| # | Test |
|---|---|
| 20 | Domain mutation survives restart |
| 21 | Duplicate webhook idempotent per business |
| 22 | Workspace hydration matches pre-restart state |

### UI

| # | Test |
|---|---|
| 23 | Fresh business shows onboarding checklist, not fake metrics |
| 24 | Populated business shows real pulse metrics |
| 25 | No internal enum strings in rendered HTML (snapshot tests) |

---

## 25. Security Threat Model

| Threat | Current exposure | Mitigation |
|---|---|---|
| **IDOR** — guess `workspaceId` | Critical — full access | Auth + membership on every request |
| **Unauthenticated API mutation** | Critical — approvals work | Session required on all `/api/*` |
| **Cross-tenant data leak** | High — shared process, no DB isolation | Per-business persistence queries; cache keyed by authorized ID only |
| **Invitation token brute force** | N/A today | 256-bit token, hashed storage, rate limit |
| **Privilege escalation** | N/A today | Role checks on invite (only OWNER/ADMIN can invite ADMIN) |
| **Platform admin abuse** | N/A today | Audit log all admin business entry |
| **Demo data in production** | High — default path | Phase 0 removal + `kind=DEMO` gate |
| **Session fixation** | N/A today | Auth.js defaults + secure cookies |
| **Webhook replay** | Medium — process-local dedup | Durable per-business dedup (EPIC 25) |
| **CSRF on API** | Medium | SameSite cookies + CSRF tokens for mutations |

---

## 26. Browser Verification Plan

### Platform Admin journey

1. Sign in as platform admin
2. See business grid with search
3. Create new business + owner invite
4. Enter existing business → see owner dashboard
5. Create Horizon demo → see DEMO badge
6. Reset demo → clean re-seed

### Owner journey

1. Receive invitation email (or test token URL)
2. Accept → register/login
3. Land on empty Home with onboarding checklist
4. Connect integration (mock) → state updates
5. Invite employee → employee accepts
6. Submit real inquiry (form) → Work/People populate
7. Restart app → all state persists

### Employee journey

1. Accept employee invitation
2. See reduced nav
3. View assigned work only
4. Cannot access Settings admin

### Security journey

1. Log in as Business A owner
2. Change URL to Business B ID → blocked
3. Log out → API returns 401

### Zero-data journey

1. Create fresh business
2. Verify: no Taylor/Maria/Jordan, no Horizon, no fake metrics, no 0/26 gaps

---

## 27. Risks and Anti-Patterns

| Risk | Mitigation |
|---|---|
| Building auth inside `TeamRuntime` | Keep platform membership separate |
| Second domain model for requests/work | Runtime persistence only |
| Keeping Horizon as default for dev convenience | Explicit demo command |
| Partial migration (auth without empty seed) | Phase 0 first |
| UI redesign before auth boundary | Shell can prototype but don't ship without auth |
| Supabase + Postgres + runtime DB confusion | Single Postgres, clear schema namespaces |
| Over-building RBAC | 5 roles + extension column |
| Persisting UI view models | EPIC 25 rule unchanged |
| Platform admin as team member everywhere | Separate platform role only |

### Anti-patterns (do not do)

- `DEFAULT_WORKSPACE_ID = ws_horizon_properties`
- Auto-run `bootstrapHorizonPropertiesDemo` in `activateWorkspace`
- `CompanyWorkspaceRuntime` with 500 lines of seed data as default
- `new WorkspaceService()` without session in pages
- Storing parties/requests in `businesses` table
- Open registration / business discovery
- Hardcoding Teddy or any founder name in production code

---

## 28. Definition of Done

### Platform foundation

- [ ] Authentication implemented (login, register, session)
- [ ] Platform Admin role works
- [ ] Business / membership / invitation tables durable
- [ ] Invite-only onboarding — no open registration
- [ ] Authorization on every workspace/API request
- [ ] `workspaceId` alone cannot grant access

### Data integrity

- [ ] Fresh LIVE business has zero demo facts
- [ ] `CompanyWorkspaceRuntime` default is empty
- [ ] No automatic Horizon bootstrap on normal activation
- [ ] Demo only via explicit `kind=DEMO` + seed command
- [ ] Package definitions remain reusable (not deleted)

### Persistence (EPIC 25 integrated)

- [ ] Hybrid persistence implemented per EPIC 25 plan
- [ ] Restart preserves users, memberships, business state
- [ ] Multi-business isolation proven with persistence
- [ ] Webhook dedup durable per business

### UX

- [ ] Platform admin business list/switcher
- [ ] New owner dashboard replaces demo Mission Control
- [ ] Zero-data onboarding checklist on fresh business
- [ ] No internal architecture terms in client UI
- [ ] Navigation redesigned for SMB mental models
- [ ] Role-appropriate experiences (owner, employee, viewer, admin)

### Proof

- [ ] Full test matrix passing
- [ ] Browser verification plan executed
- [ ] Security threat model addressed
- [ ] Real client onboarding path demonstrated end-to-end

---

## STOP

**This is a plan only. No code has been implemented.**

EPIC 25 durability work should proceed **as Phase 3** of this plan, not as a standalone Horizon restart fix. The product foundation must change first (Phase 0–2) so persistence serves real businesses, not a harder-to-lose demo.

**Next step:** Review and approve this plan before any implementation begins.

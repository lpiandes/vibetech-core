# Future MSP / Agency Control Plane Contract

This is a **read-only universal contract** for a future agency operator view. It is not implemented as a product surface in EPIC 20.

## Purpose

An MSP or agency operator must eventually monitor many client workspaces without a second ownership model. The control plane references existing `workspaceId` identities from `WorkspaceActivationRegistry` and activation facts.

## `AgencyWorkspaceSummary` (proposed)

```typescript
type AgencyWorkspaceSummary = {
  workspaceId: string;
  businessName: string;
  industryPackageId: string | null;
  industryDisplayName: string;
  activationStatus: "ACTIVE" | "GENERIC" | "NOT_ACTIVATED";
  readinessStatus: string;
  criticalAttentionCount: number;
  connectionHealth: "HEALTHY" | "DEGRADED" | "MISSING_REQUIRED";
  digitalWorkforceHealth: "HEALTHY" | "BLOCKED" | "NEEDS_CONFIGURATION";
  lastActivityAt: string | null;
};
```

## Derivation Sources (existing)

| Field | Source |
|-------|--------|
| `workspaceId` | `WorkspaceIdentityViewModel.workspaceId` |
| `businessName` | `WorkspaceIdentityViewModel.businessName` |
| `industryPackageId` | `activation.industryPackageId` |
| `readinessStatus` | `IndustryPackageReadinessReport.readinessStatus` |
| `criticalAttentionCount` | `projectOwnerAttention()` filtered by `priority === "critical"` |
| `connectionHealth` | `buildConnectedSystemsSnapshot()` required connection statuses |
| `digitalWorkforceHealth` | `buildDigitalEmployeeReadinessReport()` aggregate |
| `lastActivityAt` | Latest `platformEventStore.getEvents()` `occurredAt` |

## Constraints

- No second workspace ownership model.
- No mutation from control plane in V1 contract.
- Package terminology does not affect control plane field names — only display labels in UI.

## Future Implementation Notes

- Index summaries asynchronously from workspace activation events.
- Paginate by `lastActivityAt` for operator dashboards.
- Critical attention count must use the same `OwnerAttentionProjection` as the client Command Center.

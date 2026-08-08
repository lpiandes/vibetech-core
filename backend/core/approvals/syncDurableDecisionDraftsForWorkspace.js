/**
 * Refresh ApprovalRuntime from durable installation.configuration.pendingDecisionDrafts.
 * Prove / content engines write Postgres; warm WorkspaceService composition often still
 * holds a stale installationResult — Decisions would look empty without this.
 *
 * Also collapses stacked prove drafts so owners don't see 9 identical cards.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { syncPendingDecisionDraftsToApprovals } from "./syncPendingDecisionDraftsToApprovals.js";
import { collapsePendingDecisionDrafts } from "./collapsePendingDecisionDrafts.js";

/**
 * @returns {{ ok: boolean, draftCount: number, synced: number, approvalIds: string[], collapsed: boolean }}
 */
export async function syncDurableDecisionDraftsForWorkspace({
  platformStore,
  businessId,
  service = null,
  nowISO = new Date().toISOString(),
  persistCollapse = true,
} = {}) {
  if (!platformStore || !businessId) {
    return deepFreeze({ ok: false, draftCount: 0, synced: 0, approvalIds: [], collapsed: false });
  }

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const rawDrafts = Array.isArray(installation?.configuration?.pendingDecisionDrafts)
    ? installation.configuration.pendingDecisionDrafts
    : [];
  const drafts = collapsePendingDecisionDrafts(rawDrafts);
  const collapsed = drafts.length !== rawDrafts.length;

  if (collapsed && persistCollapse && installation && typeof platformStore.upsertBusinessOSInstallation === "function") {
    try {
      await platformStore.upsertBusinessOSInstallation({
        id: installation.id ?? installation.installationId ?? `install_${businessId}`,
        businessId,
        specificationRowId: installation.specificationRowId ?? null,
        specificationId: installation.specificationId ?? `spec_${businessId}`,
        specificationVersion: installation.specificationVersion ?? 1,
        specificationContentHash: installation.specificationContentHash ?? installation.contentHash ?? "draft_collapse",
        planId: installation.planId ?? `plan_${businessId}`,
        status: installation.status ?? "installed",
        plan: installation.plan ?? {},
        actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
        configuration: {
          ...(installation.configuration ?? {}),
          pendingDecisionDrafts: drafts.slice(-40),
        },
        history: Array.isArray(installation.history) ? installation.history.slice(-50) : [],
        installedAt: installation.installedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: "decision_draft_collapse",
      });
    } catch {
      /* persist collapse best-effort — still sync collapsed list into runtime */
    }
  }

  const connected = service?.connected ?? null;
  const approvalRuntime = connected?.ctx?.approvalRuntime
    ?? service?.approvalRuntime
    ?? null;

  const syncResult = syncPendingDecisionDraftsToApprovals({
    approvalRuntime,
    pendingDecisionDrafts: drafts,
    businessId,
    nowISO,
  });

  if (connected?.installationResult && typeof connected.installationResult === "object") {
    const prev = connected.installationResult;
    const prevCfg = prev.configuration && typeof prev.configuration === "object"
      ? prev.configuration
      : {};
    connected.installationResult = {
      ...prev,
      configuration: {
        ...prevCfg,
        pendingDecisionDrafts: drafts,
      },
    };
  }

  return deepFreeze({
    ok: true,
    draftCount: drafts.length,
    synced: Number(syncResult?.synced ?? 0),
    approvalIds: Array.isArray(syncResult?.approvalIds) ? [...syncResult.approvalIds] : [],
    collapsed,
  });
}

/**
 * Refresh ApprovalRuntime from durable installation.configuration.pendingDecisionDrafts.
 * Prove / content engines write Postgres; warm WorkspaceService composition often still
 * holds a stale installationResult — Decisions would look empty without this.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { syncPendingDecisionDraftsToApprovals } from "../../approvals/syncPendingDecisionDraftsToApprovals.js";

/**
 * @returns {{ ok: boolean, draftCount: number, synced: number, approvalIds: string[] }}
 */
export async function syncDurableDecisionDraftsForWorkspace({
  platformStore,
  businessId,
  service = null,
  nowISO = new Date().toISOString(),
} = {}) {
  if (!platformStore || !businessId) {
    return deepFreeze({ ok: false, draftCount: 0, synced: 0, approvalIds: [] });
  }

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const drafts = Array.isArray(installation?.configuration?.pendingDecisionDrafts)
    ? installation.configuration.pendingDecisionDrafts
    : [];

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

  // Keep warm composition honest for subsequent syncs in this process.
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
  });
}

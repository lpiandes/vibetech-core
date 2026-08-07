import { NextResponse } from "next/server";
import {
  getAuthorizedWorkspace,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { AuthorizationError } from "@/lib/server/compose";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { composeExecutiveDashboard } from "../../../../../../backend/core/platform/analytics/ExecutiveDashboard.js";
import { syncPendingDecisionDraftsToApprovals } from "../../../../../../backend/core/approvals/syncPendingDecisionDraftsToApprovals.js";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const approvalRuntime = (ctx.service as any)?.connected?.ctx?.approvalRuntime
      ?? (ctx.service as any)?.approvalRuntime
      ?? null;
    const drafts = installation?.configuration?.pendingDecisionDrafts;
    syncPendingDecisionDraftsToApprovals({
      approvalRuntime,
      pendingDecisionDrafts: Array.isArray(drafts) ? drafts : [],
      businessId,
    });
    const openDecisionCount = Array.isArray(approvalRuntime?.getRequests?.())
      ? approvalRuntime.getRequests().filter((a: { status?: string }) => a.status === "PENDING").length
      : 0;

    const dashboard = composeExecutiveDashboard({
      installation,
      businessId,
      openDecisionCount,
      nowISO: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { canDecideOutboundApproval } from "../../../../../../backend/core/approvals/OutboundApprovalGate.js";
import { platformStore } from "@/lib/server/compose";
import {
  recordCorrection,
  refreshGovernedLearning,
  persistGovernedLearning,
  readGovernedLearning,
} from "../../../../../../backend/core/company-rules/governedLearning.js";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await context.params;
    const body = await req.json().catch(() => ({}));
    const decision = body?.decision;
    const businessId = String(body?.businessId ?? "");
    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId required" }, { status: 400 });
    }
    if (decision !== "GRANT" && decision !== "REJECT" && decision !== "APPROVE") {
      return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
    }

    const ctx = await getAuthorizedWorkspace(businessId);
    const role = String((ctx as { authz?: { membership?: { role?: string } } }).authz?.membership?.role ?? "");
    const canDecide = ctx.permissions.has(PERMISSIONS.APPROVALS_DECIDE)
      || ctx.permissions.has(PERMISSIONS.WORK_MANAGE)
      || canDecideOutboundApproval(role);
    if (!canDecide) {
      return NextResponse.json({ ok: false, error: "Not allowed to decide approvals" }, { status: 403 });
    }

    const approvalId = resolvedParams.id;
    const priorReq = (ctx.service as any)?.connected?.ctx?.approvalRuntime?.getRequestById?.(approvalId)
      ?? null;

    const result = ctx.service.applyOwnerApprovalDecision(approvalId, decision);

    // Plan 10 — capture original vs decision (reason optional; defaults are honest).
    const granted = decision === "GRANT" || decision === "APPROVE";
    const reasonCode = String(body?.reasonCode ?? body?.rootCause ?? "").trim()
      || (granted ? "approved_as_proposed" : "rejected_outright");
    const actorId = String((ctx as any)?.user?.id ?? (ctx as any)?.authz?.actorUserId ?? "owner");
    try {
      const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
      if (installation) {
        const recorded = recordCorrection(readGovernedLearning(installation), {
          correctionId: `approval_${approvalId}`,
          source: "owner_approval",
          reasonCode,
          original: priorReq
            ? {
              approvalId,
              title: priorReq.title ?? priorReq.summary ?? null,
              status: priorReq.status,
              payload: priorReq.payload ?? null,
            }
            : { approvalId },
          approved: {
            decision: result.status,
            decidedAt: result.decidedAt,
            edit: body?.edit ?? null,
          },
          decision: result.status,
          note: body?.note ?? null,
          actorId,
          evidence: [{ kind: "approval_id", providerId: String(approvalId) }],
        });
        if (recorded.ok) {
          const refreshed = refreshGovernedLearning({
            ...installation,
            configuration: {
              ...(installation.configuration ?? {}),
              governedLearning: recorded.state,
            },
          });
          await persistGovernedLearning({
            platformStore,
            installation,
            state: refreshed.state,
            actorId,
          });
        }
      }
    } catch {
      // Learning capture must not block the approval decision.
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

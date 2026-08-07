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
import { fulfillSpecialtyApprovalGrant } from "../../../../../../backend/core/ai-builder/specialty/fulfillSpecialtyApprovalGrant.js";
import { markPendingDecisionDraftDecided } from "../../../../../../backend/core/approvals/syncPendingDecisionDraftsToApprovals.js";
import { progressRftOpportunity } from "../../../../../../backend/core/ai-builder/operating-contract/rft/rftOpportunityRuntime.js";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";

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
    const approvalRuntime = (ctx.service as any)?.connected?.ctx?.approvalRuntime
      ?? (ctx.service as any)?.approvalRuntime
      ?? null;
    const priorReq = approvalRuntime?.getRequestById?.(approvalId) ?? null;

    const result = ctx.service.applyOwnerApprovalDecision(approvalId, decision);

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

    const workRuntime = (ctx.service as any)?.workRuntime
      ?? (ctx.service as any)?.connected?.ctx?.workRuntime
      ?? null;
    const integrationHub = (ctx.service as any)?.connected?.integrationPlatform?.hub
      ?? (ctx.service as any)?.connected?.integrationHub
      ?? null;

    // Plan 19 — GRANT on specialty approvals must actually send + advance RFT.
    let fulfillment: Record<string, unknown> | null = null;
    if (granted && priorReq) {
      try {
        const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        fulfillment = await fulfillSpecialtyApprovalGrant({
          approvalRequest: priorReq,
          businessId,
          platformStore,
          installation,
          workRuntime,
          integrationHub,
          actorId,
        }) as Record<string, unknown>;
        invalidateCachedBusinessOsInstallation(businessId);

        if (fulfillment && fulfillment.ok === false && fulfillment.skipped !== true) {
          return NextResponse.json({
            ok: false,
            error: String(fulfillment.message ?? fulfillment.reason ?? "Outbound send failed after approval"),
            result,
            fulfillment,
          }, { status: 502 });
        }
      } catch (err) {
        return NextResponse.json({
          ok: false,
          error: err instanceof Error ? err.message : "Outbound fulfillment failed after approval",
          result,
        }, { status: 502 });
      }
    }

    // Decision drafts (forms / Meta / marketing) — mark durable draft decided.
    if (priorReq && String(priorReq.source ?? "") === "pending_decision_draft") {
      try {
        const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        const draftId = String(
          priorReq?.sourceReference?.draftId
          ?? priorReq?.context?.draftId
          ?? priorReq?.metadata?.draftId
          ?? "",
        ).trim();
        if (installation && draftId) {
          await markPendingDecisionDraftDecided({
            platformStore,
            installation,
            draftId,
            decision: granted ? "GRANT" : "REJECT",
            actorId,
          });
          invalidateCachedBusinessOsInstallation(businessId);
        }
      } catch {
        /* draft mark is best-effort after approval already applied */
      }
    }

    // REJECT → RFT Exception when linked specialty work has a card.
    if (!granted && priorReq) {
      try {
        const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        const workItemId = String(
          priorReq?.sourceReference?.workItemId ?? priorReq?.context?.workItemId ?? "",
        );
        const workItem = workItemId ? workRuntime?.getWorkItem?.(workItemId) : null;
        const cardId = String(workItem?.metadata?.rftCardId ?? workItem?.metadata?.cardId ?? "").trim();
        if (cardId && installation) {
          await progressRftOpportunity({
            platformStore,
            installation,
            cardId,
            eventType: "APPROVAL_REJECTED",
            actorId,
            note: "Owner rejected outbound",
            outcomeType: "HumanInterventionRequired",
          }).catch(() => null);
          invalidateCachedBusinessOsInstallation(businessId);
        }
      } catch {
        /* reject RFT progress is best-effort */
      }
    }

    return NextResponse.json({ ok: true, result, fulfillment });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

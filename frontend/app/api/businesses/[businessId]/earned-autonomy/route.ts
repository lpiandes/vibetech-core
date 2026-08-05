import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  RFT_ACTION_CLASSES,
  evaluateAllClasses,
  evaluateClassEligibility,
  delegateClass,
  revokeClass,
  persistEarnedAutonomy,
  readEarnedAutonomy,
} from "../../../../../../../backend/core/company-rules/earnedAutonomy.js";
import { normalizeRftServiceStandard } from "../../../../../../../backend/core/ai-builder/operating-contract/rft/rftContract.js";

function rftEmployee(installation: any) {
  return (installation?.configuration?.employees ?? []).find(
    (e: any) => e?.operatingContract?.rft || e?.roleId === "revenue_follow_through",
  ) ?? null;
}

function contractFrom(installation: any) {
  const emp = rftEmployee(installation);
  return emp?.operatingContract ?? null;
}

/**
 * GET — what can run without the owner (earned autonomy)
 * POST actions: refresh | delegate | revoke
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const contract = contractFrom(installation);
    const evaluated = evaluateAllClasses({ installation, contract });
    return NextResponse.json({
      ok: true,
      catalog: RFT_ACTION_CLASSES,
      autonomy: evaluated.state,
      evaluations: evaluated.evaluations,
      honesty: "Default deny. Auto requires rates + Plan 7 replay/shadow + owner delegation. Version bump clears auto.",
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "refresh").trim();
    const actorId = String((ctx as any)?.user?.id ?? (ctx as any)?.authz?.actorUserId ?? "owner");

    let installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const contract = contractFrom(installation);
    const rft = normalizeRftServiceStandard(contract?.rft ?? null);

    if (action === "refresh") {
      const evaluated = evaluateAllClasses({ installation, contract });
      await persistEarnedAutonomy({
        platformStore,
        installation,
        state: evaluated.state,
        actorId,
      });
      return NextResponse.json({
        ok: true,
        autonomy: evaluated.state,
        evaluations: evaluated.evaluations,
      });
    }

    if (action === "delegate") {
      const classId = String(body.classId ?? "");
      const evaluation = evaluateClassEligibility({
        classId,
        installation,
        contract,
      });
      const delegated = delegateClass(readEarnedAutonomy(installation), {
        classId,
        actorId,
        policyHash: rft.contentHash,
        contractVersion: rft.contractVersion,
        evaluation,
      });
      if (!delegated.ok) {
        return NextResponse.json(delegated, { status: 400 });
      }
      // Re-evaluate so lastStatus reflects auto_eligible
      const withDelegation = {
        ...installation,
        configuration: {
          ...(installation.configuration ?? {}),
          rftAutonomy: delegated.state,
        },
      };
      const evaluated = evaluateAllClasses({ installation: withDelegation, contract });
      await persistEarnedAutonomy({
        platformStore,
        installation,
        state: evaluated.state,
        actorId,
      });
      return NextResponse.json({
        ok: true,
        autonomy: evaluated.state,
        evaluations: evaluated.evaluations,
        evaluation: evaluated.evaluations.find((e: { classId: string }) => e.classId === classId),
      });
    }

    if (action === "revoke") {
      const classId = String(body.classId ?? "");
      const revoked = revokeClass(readEarnedAutonomy(installation), {
        classId,
        actorId,
        note: body.note ?? null,
      });
      if (!revoked.ok) {
        return NextResponse.json(revoked, { status: 400 });
      }
      const withRevoke = {
        ...installation,
        configuration: {
          ...(installation.configuration ?? {}),
          rftAutonomy: revoked.state,
        },
      };
      const evaluated = evaluateAllClasses({ installation: withRevoke, contract });
      await persistEarnedAutonomy({
        platformStore,
        installation,
        state: evaluated.state,
        actorId,
      });
      return NextResponse.json({
        ok: true,
        autonomy: evaluated.state,
        evaluations: evaluated.evaluations,
      });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

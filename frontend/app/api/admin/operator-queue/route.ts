import { NextResponse } from "next/server";

import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";

/**
 * GET — cross-client operator queue (Plan 8)
 * POST — resolve case { caseId, rootCause, note?, retryException? }
 */
export async function GET() {
  try {
    const user = await requirePlatformAdminApi();
    const result = await getAdminPlatformService().getOperatorQueue({
      adminUserId: user.id,
      platformRole: user.platformRole,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePlatformAdminApi();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "resolve").trim();

    if (action === "detail") {
      const detail = await getAdminPlatformService().getOperatorCaseDetail({
        adminUserId: user.id,
        platformRole: user.platformRole,
        caseId: body.caseId,
      });
      return NextResponse.json(detail, { status: detail.ok ? 200 : 400 });
    }

    const result = await getAdminPlatformService().resolveOperatorCase({
      adminUserId: user.id,
      platformRole: user.platformRole,
      caseId: body.caseId,
      rootCause: body.rootCause,
      category: body.category ?? null,
      note: body.note ?? null,
      workflowRunId: body.workflowRunId ?? null,
      operatorId: body.operatorId ?? null,
      startedAt: body.startedAt ?? null,
      endedAt: body.endedAt ?? null,
      minutesSpent: body.minutesSpent ?? null,
      actionPerformed: body.actionPerformed ?? null,
      wasNecessary: body.wasNecessary ?? null,
      canAutomate: body.canAutomate ?? null,
      laborCostClass: body.laborCostClass ?? null,
      resolutionOutcome: body.resolutionOutcome ?? null,
      linkedTraceRef: body.linkedTraceRef ?? null,
      retryException: body.retryException !== false,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}

import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { rejectProspectingCandidates } from "../../../../../../../../../backend/core/prospecting/acceptProspectingCandidates.js";
import { assertAiProspectingPurchased } from "../../../../../../../../../backend/core/prospecting/prospectingGate.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; runId: string }> },
) {
  try {
    const { businessId, runId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    try {
      assertAiProspectingPurchased(installation);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code ?? "PACKAGE_REQUIRED" },
        { status: error.status ?? 403 },
      );
    }

    const candidateIds = body.candidateIds ?? body.ids ?? [];
    if (!Array.isArray(candidateIds) || !candidateIds.length) {
      return NextResponse.json({ ok: false, error: "candidateIds required" }, { status: 400 });
    }

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const result = await rejectProspectingCandidates({
      platformStore,
      installation,
      runId,
      candidateIds,
      actorId,
    });

    return NextResponse.json({ ok: true, run: result.run });
  } catch (error: any) {
    if (String(error?.message ?? "").includes("not found")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    return authorizationErrorResponse(error);
  }
}

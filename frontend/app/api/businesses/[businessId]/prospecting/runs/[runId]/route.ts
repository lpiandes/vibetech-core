import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  getProspectingRun,
  readProspectingState,
} from "../../../../../../../../backend/core/prospecting/ProspectingJobStore.js";
import { assertAiProspectingPurchased } from "../../../../../../../../backend/core/prospecting/prospectingGate.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; runId: string }> },
) {
  try {
    const { businessId, runId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
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

    const state = readProspectingState(installation);
    const run = getProspectingRun(state, runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, run });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

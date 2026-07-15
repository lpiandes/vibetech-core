import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);

    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "complete").toLowerCase();
    if (status !== "complete" && status !== "pending") {
      return NextResponse.json({ error: "status must be complete or pending." }, { status: 400 });
    }

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.markSmsA2pRegistrationComplete(knowledgeCount);

    return NextResponse.json({
      ok: true,
      a2pRegistrationStatus: connection?.metadata?.a2pRegistrationStatus ?? status,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

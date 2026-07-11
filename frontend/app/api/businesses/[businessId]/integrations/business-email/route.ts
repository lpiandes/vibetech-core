import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/platformStore";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);

    if (process.env.NODE_ENV === "production" && process.env.VIBETECH_ALLOW_DEV_EMAIL_CONNECT !== "1") {
      return NextResponse.json(
        { error: "Business email self-connect is not enabled in production yet.", code: "NOT_AVAILABLE" },
        { status: 501 },
      );
    }

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectBusinessEmail(knowledgeCount);

    return NextResponse.json({
      ok: true,
      connection: {
        id: connection?.id,
        connectionType: connection?.connectionType,
        status: connection?.status,
      },
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

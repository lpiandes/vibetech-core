import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { isGoogleOAuthAppConfigured } from "@/lib/server/liveIntegrations";

/**
 * Business email connect.
 * - mode=dev → mock provider (local / explicit allow)
 * - default when Google OAuth configured → returns 400 directing client to OAuth start
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const mode = String(body?.mode ?? "auto");

    const allowDev =
      process.env.NODE_ENV !== "production" || process.env.VIBETECH_ALLOW_DEV_EMAIL_CONNECT === "1";

    if (mode === "dev" || (!isGoogleOAuthAppConfigured() && allowDev)) {
      if (!allowDev) {
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
    }

    if (isGoogleOAuthAppConfigured()) {
      return NextResponse.json(
        {
          error: "Use Connect with Google to authorize Gmail.",
          code: "USE_OAUTH",
          oauthStartPath: `/api/businesses/${businessId}/integrations/gmail/oauth/start`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Gmail OAuth is not configured on this server.", code: "NOT_CONFIGURED" },
      { status: 501 },
    );
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

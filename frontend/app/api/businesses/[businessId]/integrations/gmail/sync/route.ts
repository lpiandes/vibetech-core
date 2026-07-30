import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { GmailInboundSyncService } from "../../../../../../../../backend/core/integrations/gmail/GmailInboundSyncService.js";

/**
 * "Sync now" — pulls recent Gmail inbox messages into the synced store
 * (installation.configuration.gmailInbox) and matches/creates People by sender email.
 *
 * v1: manual trigger only. No recurring platform job yet (see TODO in
 * GmailInboundSyncService.js).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const maxResults = Number(body?.maxResults ?? 25) || 25;

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json(
        { error: "Business OS installation not found.", code: "INSTALLATION_MISSING" },
        { status: 404 },
      );
    }

    const platform = (ctx.service as any)?.connected?.integrationPlatform ?? null;
    const connection = platform?.connectionRuntime?.getConnectionByType?.("business_email") ?? null;
    const credentialResolver = platform?.credentialResolver ?? null;

    if (!connection) {
      return NextResponse.json(
        {
          error: "Connect Gmail (Integrations → Send approved customer email) before syncing the inbox.",
          code: "NOT_CONNECTED",
        },
        { status: 400 },
      );
    }

    const service = new GmailInboundSyncService();
    const result = await service.sync({
      businessId,
      platformStore,
      installation,
      connection,
      credentialResolver,
      maxResults,
      actorId: "owner",
    });

    if (!result.ok) {
      const status = result.reason === "gmail_not_connected" || result.reason === "missing_readonly_scope" ? 400 : 502;
      return NextResponse.json(
        { error: result.message ?? "Gmail inbox sync failed.", code: String(result.reason ?? "SYNC_FAILED").toUpperCase() },
        { status },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

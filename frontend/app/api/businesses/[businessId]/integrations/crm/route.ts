import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  CRM_PROVIDERS,
  verifyCrmPrivateApp,
} from "../../../../../../../backend/core/integrations/crm/CrmPrivateAppConnect.js";

/**
 * Connect HubSpot or HighLevel via private app / API key (Plan 26).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const provider = String(body.provider ?? "").toLowerCase();
    const meta = CRM_PROVIDERS[provider];
    if (!meta) {
      return NextResponse.json(
        { error: "provider must be hubspot or highlevel", code: "INVALID_PROVIDER" },
        { status: 400 },
      );
    }

    const accessToken = String(body.accessToken ?? body.apiKey ?? "").trim();
    const locationId = body.locationId ? String(body.locationId).trim() : null;
    const verified = await verifyCrmPrivateApp({ provider, accessToken, locationId });
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.message, code: verified.reason ?? "VERIFY_FAILED", detail: verified.detail ?? null },
        { status: 400 },
      );
    }

    const credentialId = `cred_${meta.providerType}_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: businessId,
      credentialId,
      providerType: meta.providerType,
      secrets: { accessToken, ...(locationId ? { locationId } : {}) },
      metadata: { locationId: locationId ?? null, provider },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectCrmPrivateApp({
      connectionType: meta.connectionType,
      displayName: meta.label,
      providerType: meta.providerType,
      credentialId,
      locationId,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    const status = String(connection?.status ?? "").toUpperCase();
    if (status !== "CONNECTED") {
      return NextResponse.json(
        {
          error: "Credentials saved but connection did not reach Connected.",
          code: "CONNECT_FAILED",
          connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
        },
        { status: 400 },
      );
    }

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

import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { readSocialScreeningKeys } from "../../../../../../../backend/core/integrations/social-screening/socialScreeningKeys.js";
import { connectProviderConnection } from "../../../../../../../backend/core/integrations/use-cases/connectProviderConnection.js";

/**
 * Connect Social screening (Serper + ScrapingBee) for background reports.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const usePlatformKeys = Boolean(body.usePlatformKeys);
    const fromEnv = readSocialScreeningKeys({ env: process.env });
    const serperApiKey = String(
      body.serperApiKey ?? (usePlatformKeys ? fromEnv.serperApiKey : ""),
    ).trim();
    const scrapingBeeApiKey = String(
      body.scrapingBeeApiKey ?? (usePlatformKeys ? fromEnv.scrapingBeeApiKey : ""),
    ).trim();

    if (!serperApiKey || !scrapingBeeApiKey) {
      return NextResponse.json(
        {
          error: "Serper API key and ScrapingBee API key are required (or enable Use platform keys).",
          code: "MISSING_CREDENTIALS",
          platformKeysAvailable: fromEnv.ready,
        },
        { status: 400 },
      );
    }

    const credentialId = `cred_social_screening_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: businessId,
      credentialId,
      providerType: "social_screening",
      secrets: { serperApiKey, scrapingBeeApiKey },
      metadata: {
        ready: true,
        keysPresent: true,
        usePlatformKeys,
      },
    });

    const connection = await connectProviderConnection({
      integrationPlatform: (ctx.service as any).connected.integrationPlatform,
      workspaceId: businessId,
      connectionType: "social_screening",
      displayName: "Social screening",
      providerType: "social_screening",
      credentialId,
      credentialType: "api_key",
      externalAccountReference: `social_screening:${businessId}`,
      metadata: { ready: true, keysPresent: true },
    });

    return NextResponse.json({
      ok: true,
      connection: {
        id: connection?.id,
        connectionType: connection?.connectionType ?? "social_screening",
        status: connection?.status,
      },
      nextSteps: [
        "Open People → select a contact → Run social background screen.",
        "Reports land in Needs Attention / Work for approve-first review.",
      ],
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

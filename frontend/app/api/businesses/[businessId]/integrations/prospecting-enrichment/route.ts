import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { connectProviderConnection } from "../../../../../../../backend/core/integrations/use-cases/connectProviderConnection.js";
import { readEnrichmentKeys } from "../../../../../../../backend/core/prospecting/EnrichmentAdapter.js";
import { readSocialScreeningKeys } from "../../../../../../../backend/core/integrations/social-screening/socialScreeningKeys.js";
import {
  businessHasAiProspecting,
  readPurchasedPackagesFromConfig,
} from "../../../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

/**
 * Connect optional prospecting enrichment (Apollo and/or Hunter).
 * Serper for company discovery uses platform SERPER_API_KEY (or social screening keys).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const packages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
    if (!businessHasAiProspecting(packages)) {
      return NextResponse.json(
        { ok: false, error: "AI Prospecting package required.", code: "PACKAGE_REQUIRED" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const usePlatformKeys = Boolean(body.usePlatformKeys);
    const fromEnv = readEnrichmentKeys({ env: process.env });
    const serperEnv = readSocialScreeningKeys({ env: process.env });

    const bodyApollo = String(body.apolloApiKey ?? "").trim();
    const bodyHunter = String(body.hunterApiKey ?? "").trim();
    const apolloApiKey = usePlatformKeys
      ? (fromEnv.apolloApiKey || bodyApollo)
      : (bodyApollo || fromEnv.apolloApiKey);
    const hunterApiKey = usePlatformKeys
      ? (fromEnv.hunterApiKey || bodyHunter)
      : (bodyHunter || fromEnv.hunterApiKey);

    if (!apolloApiKey && !hunterApiKey) {
      const error = usePlatformKeys && !fromEnv.ready
        ? "Platform enrichment keys not found. Set APOLLO_API_KEY or HUNTER_API_KEY in Vercel, then redeploy — or paste a key below."
        : "Apollo API key or Hunter API key is required (or enable Use platform keys).";
      return NextResponse.json(
        {
          error,
          code: "MISSING_CREDENTIALS",
          platformKeysAvailable: fromEnv.ready,
          serperPlatformReady: Boolean(serperEnv.serperApiKey),
        },
        { status: 400 },
      );
    }

    const credentialId = `cred_prospecting_enrichment_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: businessId,
      credentialId,
      providerType: "prospecting_enrichment",
      secrets: {
        ...(apolloApiKey ? { apolloApiKey } : {}),
        ...(hunterApiKey ? { hunterApiKey } : {}),
      },
      metadata: {
        ready: true,
        keysPresent: true,
        usePlatformKeys,
        provider: apolloApiKey ? "apollo" : "hunter",
        serperPlatformReady: Boolean(serperEnv.serperApiKey),
      },
    });

    const connection = await connectProviderConnection({
      integrationPlatform: (ctx.service as any).connected.integrationPlatform,
      workspaceId: businessId,
      connectionType: "prospecting_enrichment",
      displayName: "Prospecting enrichment",
      providerType: "prospecting_enrichment",
      credentialId,
      credentialType: "api_key",
      externalAccountReference: `prospecting_enrichment:${businessId}`,
      metadata: {
        ready: true,
        keysPresent: true,
        provider: apolloApiKey ? "apollo" : "hunter",
      },
    });

    return NextResponse.json({
      ok: true,
      connection: {
        id: connection?.id,
        connectionType: connection?.connectionType ?? "prospecting_enrichment",
        status: connection?.status,
      },
      serperPlatformReady: Boolean(serperEnv.serperApiKey),
      nextSteps: [
        serperEnv.serperApiKey
          ? "Serper is ready on the platform for company discovery."
          : "Set SERPER_API_KEY on the server (or connect Social screening) so Find leads can discover companies.",
        "Open People → Find leads → run research → review confidence chips → Accept into a pipeline stage.",
      ],
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

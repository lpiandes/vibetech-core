import { NextResponse } from "next/server";

import {
  getSharedCredentialVault,
  isMetaLeadAdsConfigured,
} from "@/lib/server/liveIntegrations";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";

/**
 * Meta Lead Ads webhook verification (GET) and leadgen ingest (POST).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  void params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.META_LEAD_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    if (!isMetaLeadAdsConfigured()) {
      return NextResponse.json({ error: "Meta not configured." }, { status: 501 });
    }

    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const platform = (ctx.service as any).connected?.integrationPlatform;
    const provider = platform?.providerRegistry?.getProvider?.("meta_lead_ads");
    if (!provider?.executeAction) {
      return NextResponse.json({ error: "Meta provider not wired." }, { status: 501 });
    }

    const connection = platform.connectionRuntime.getConnectionByType?.("meta_lead_ads");
    const result = await provider.executeAction({
      actionRequest: {
        id: `meta_webhook_${Date.now()}`,
        capability: "INGEST_FORM_SUBMISSION",
        parameters: { webhookBody: body },
      },
      connection,
      credentialResolver: platform.credentialResolver,
    });

    void getSharedCredentialVault;
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

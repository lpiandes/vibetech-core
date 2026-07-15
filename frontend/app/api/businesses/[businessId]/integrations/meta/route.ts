import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault, isMetaLeadAdsConfigured } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);

    if (!isMetaLeadAdsConfigured() && process.env.NODE_ENV === "production" && !process.env.META_APP_ID) {
      return NextResponse.json(
        { error: "Meta Lead Ads is not configured on this server.", code: "NOT_CONFIGURED" },
        { status: 501 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const pageId = String(body.pageId ?? "").trim();
    const pageAccessToken = String(body.pageAccessToken ?? "").trim();
    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { error: "Facebook Page ID and Page access token are required.", code: "MISSING_CREDENTIALS" },
        { status: 400 },
      );
    }

    const credentialId = `cred_meta_${businessId}`;
    await putDurableCredential({
      platformStore,
      vault: getSharedCredentialVault(),
      workspaceId: businessId,
      credentialId,
      providerType: "meta_lead_ads",
      secrets: {
        pageId,
        pageAccessToken,
        verifyToken: process.env.META_LEAD_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "",
        appId: process.env.META_APP_ID || "",
        appSecret: process.env.META_APP_SECRET || "",
      },
      metadata: { pageId },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectMetaLeadAds({
      credentialId,
      pageId,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    return NextResponse.json({
      ok: true,
      connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

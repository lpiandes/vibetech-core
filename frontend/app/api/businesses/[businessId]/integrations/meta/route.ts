import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault, isMetaLeadAdsConfigured } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { subscribeMetaPageToLeadgen } from "../../../../../../../backend/core/integrations/meta/ingestMetaLead.js";
import { markWhiteGloveReadyFromCredentials } from "../../../../../../../backend/core/integrations/whiteglove/requestWhiteGloveSetup.js";

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

    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta/webhook`;

    const credentialId = `cred_meta_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();

    await putDurableCredential({
      platformStore,
      vault,
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
      metadata: { pageId, webhookUrl, lastWebhookAt: null },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectMetaLeadAds({
      credentialId,
      pageId,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    const subscribed = await subscribeMetaPageToLeadgen({
      pageId,
      pageAccessToken,
    });

    await putDurableCredential({
      platformStore,
      vault,
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
      metadata: {
        pageId,
        subscribed: subscribed.ok === true,
        subscribedAt: subscribed.ok ? new Date().toISOString() : null,
        subscribeWarning: subscribed.ok ? null : (subscribed.message ?? subscribed.reason),
        webhookUrl,
        lastWebhookAt: null,
        status: "connected",
        setupRequestedAt: null,
      },
    });

    try {
      const status = String(connection?.status ?? "").toUpperCase();
      if (status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN") {
        await markWhiteGloveReadyFromCredentials({
          platformStore,
          businessId,
          connectionId: "meta_lead_ads",
          actorId: "credentials_connected",
        }).catch(() => null);
      }
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({
      ok: true,
      connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
      subscribed: subscribed.ok === true,
      subscribeWarning: subscribed.ok ? null : (subscribed.message ?? subscribed.reason),
      webhookUrl,
      lastWebhookAt: null,
      verifyTokenHint: "Use the same META_LEAD_VERIFY_TOKEN configured on the server when Meta asks for a verify token.",
      nextSteps: [
        "In Meta Developer App → Webhooks, subscribe to Page → leadgen (one-time per app).",
        `Callback URL: ${webhookUrl}`,
        "Verify token must match the server META_LEAD_VERIFY_TOKEN.",
        "Create a Lead Form + run a Lead Ad (or Instant Form) on this Page.",
        "Submit a test lead — it should appear in People and fire intake automations.",
      ],
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

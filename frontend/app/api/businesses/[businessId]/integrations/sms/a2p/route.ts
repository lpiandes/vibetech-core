import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  refreshTwilioA2pStatus,
  submitTwilioA2pRegistration,
} from "../../../../../../../../backend/core/integrations/twilio/TwilioA2pTrustHubService.js";

/**
 * Refresh A2P status from Twilio (default).
 * Operator override: { forceOperatorOverride: true, status: "complete" } — admin edge cases only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);

    if (body?.forceOperatorOverride === true) {
      const status = String(body.status ?? "complete").toLowerCase();
      if (status !== "complete" && status !== "approved" && status !== "pending") {
        return NextResponse.json({ error: "status must be complete, approved, or pending." }, { status: 400 });
      }
      const connection = await ctx.service.markSmsA2pRegistrationComplete(knowledgeCount, {
        status: status === "complete" ? "approved" : status,
        forced: true,
      });
      return NextResponse.json({
        ok: true,
        forced: true,
        a2pRegistrationStatus: connection?.metadata?.a2pRegistrationStatus ?? status,
        message: "Operator override applied. Prefer Twilio status sync when possible.",
      });
    }

    const rows = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
    const row = (Array.isArray(rows) ? rows : []).find((r: any) => {
      const provider = String(r?.providerType ?? "");
      return provider === "twilio_sms" || String(r?.credentialId ?? "").includes("twilio_sms");
    });
    if (!row?.secrets?.accountSid) {
      return NextResponse.json({ error: "SMS credentials not found." }, { status: 404 });
    }

    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    let result = await refreshTwilioA2pStatus({
      accountSid: row.secrets.accountSid,
      authToken: row.secrets.authToken,
      brandRegistrationSid: meta.brandRegistrationSid,
      campaignSid: meta.campaignSid,
      messagingServiceSid: meta.messagingServiceSid,
    });

    if (!meta.brandRegistrationSid || result.reason === "missing_ids") {
      result = await submitTwilioA2pRegistration({
        accountSid: row.secrets.accountSid,
        authToken: row.secrets.authToken,
        brand: meta.brand ?? {},
        messagingServiceSid: meta.messagingServiceSid,
        existing: meta,
      });
    }

    const nextMeta = {
      ...meta,
      a2pRegistrationStatus: result.a2pRegistrationStatus ?? meta.a2pRegistrationStatus ?? "pending",
      brandRegistrationSid: result.brandRegistrationSid ?? meta.brandRegistrationSid ?? null,
      campaignSid: result.campaignSid ?? meta.campaignSid ?? null,
      messagingServiceSid: result.messagingServiceSid ?? meta.messagingServiceSid ?? null,
      a2pLastCheckedAt: result.at,
      a2pMessage: result.message,
      a2pError: result.error ?? null,
    };

    await putDurableCredential({
      platformStore,
      vault:
        (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
        ?? getSharedCredentialVault(),
      workspaceId: businessId,
      credentialId: String(row.credentialId),
      providerType: "twilio_sms",
      secrets: row.secrets,
      metadata: nextMeta,
    });

    const connection = await ctx.service.markSmsA2pRegistrationComplete(knowledgeCount, {
      status: nextMeta.a2pRegistrationStatus,
      forced: false,
    });

    return NextResponse.json({
      ok: true,
      a2pRegistrationStatus: nextMeta.a2pRegistrationStatus,
      message: result.message,
      brandRegistrationSid: nextMeta.brandRegistrationSid,
      connection: { id: connection?.id, status: connection?.status },
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault, isTwilioSmsConfigured } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { markWhiteGloveReadyFromCredentials } from "../../../../../../../backend/core/integrations/whiteglove/requestWhiteGloveSetup.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);

    if (!isTwilioSmsConfigured() && process.env.NODE_ENV === "production") {
      // Still allow owner-supplied credentials even if env defaults are absent.
    }

    const body = await request.json().catch(() => ({}));
    const accountSid = String(body.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? "").trim();
    const authToken = String(body.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? "").trim();
    const fromNumber = String(body.fromNumber ?? process.env.TWILIO_MESSAGING_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? "").trim();

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: "Twilio Account SID, Auth Token, and From number are required.", code: "MISSING_CREDENTIALS" },
        { status: 400 },
      );
    }

    const credentialId = `cred_twilio_sms_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: businessId,
      credentialId,
      providerType: "twilio_sms",
      secrets: { accountSid, authToken, fromNumber },
      metadata: { fromNumber },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectTwilioSms({
      credentialId,
      fromNumber,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    if (body?.a2pComplete === true) {
      await ctx.service.markSmsA2pRegistrationComplete(knowledgeCount);
    }

    const status = String(connection?.status ?? "").toUpperCase();
    if (status !== "CONNECTED") {
      const healthMsg = String(connection?.health?.message ?? "").trim();
      return NextResponse.json(
        {
          error: healthMsg
            || "Twilio credentials were saved but verification failed. Double-check Account SID, Auth Token, and From number.",
          code: "VERIFY_FAILED",
          connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
        },
        { status: 400 },
      );
    }

    await markWhiteGloveReadyFromCredentials({
      platformStore,
      businessId,
      connectionId: "sms_channel",
      actorId: "credentials_connected",
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

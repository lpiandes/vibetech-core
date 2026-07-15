import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const accountSid = String(body.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? "").trim();
    const authToken = String(body.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? "").trim();
    const fromNumber = String(body.fromNumber ?? process.env.TWILIO_VOICE_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? "").trim();
    const twimlUrl = String(body.twimlUrl ?? process.env.TWILIO_VOICE_TWIML_URL ?? "").trim();

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: "Twilio Account SID, Auth Token, and From number are required.", code: "MISSING_CREDENTIALS" },
        { status: 400 },
      );
    }

    const credentialId = `cred_twilio_voice_${businessId}`;
    await putDurableCredential({
      platformStore,
      vault: getSharedCredentialVault(),
      workspaceId: businessId,
      credentialId,
      providerType: "twilio_voice",
      secrets: { accountSid, authToken, fromNumber, twimlUrl },
      metadata: { fromNumber, twimlUrl },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectTwilioVoice({
      credentialId,
      fromNumber,
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

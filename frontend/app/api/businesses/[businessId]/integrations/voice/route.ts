import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  notifyPlatformOperators,
} from "../../../../../../../backend/core/admin/notifyPlatformOperators.js";
import {
  buildOpsPlaybook,
  playbookToOperatorAction,
} from "../../../../../../../backend/core/admin/opsPlaybooks/OpsPlaybookRegistry.js";

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
    const origin = new URL(request.url).origin;
    const defaultTwiml = `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/voice/inbound`;
    const twimlUrl = String(body.twimlUrl ?? process.env.TWILIO_VOICE_TWIML_URL ?? defaultTwiml).trim() || defaultTwiml;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: "Twilio Account SID, Auth Token, and From number are required.", code: "MISSING_CREDENTIALS" },
        { status: 400 },
      );
    }

    const credentialId = `cred_twilio_voice_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: businessId,
      credentialId,
      providerType: "twilio_voice",
      secrets: { accountSid, authToken, fromNumber, twimlUrl },
      metadata: {
        fromNumber,
        twimlUrl,
        receptionist: true,
        inboundUrl: defaultTwiml,
      },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectTwilioVoice({
      credentialId,
      fromNumber,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    try {
      const business = await platformStore.getBusinessById(businessId).catch(() => null);
      const businessName = String(business?.name ?? businessId);
      const adminHref = `/admin/businesses/${encodeURIComponent(businessId)}`;
      const integrationsHref = `${origin}/b/${encodeURIComponent(businessId)}/integrations?focus=voice_channel`;
      const playbook = buildOpsPlaybook("twilio_voice_connect", {
        origin,
        businessId,
        businessName,
        integrationsHref,
        adminHref,
      });
      await notifyPlatformOperators({
        actions: [playbookToOperatorAction(playbook, { businessId, businessName, href: adminHref })],
        force: true,
        fallbackDefaultEmail: true,
      });
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({
      ok: true,
      connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
      twimlUrl,
      inboundUrl: defaultTwiml,
      nextSteps: [
        `Point this Twilio number’s Voice webhook to: ${defaultTwiml}`,
        "Inbound calls use the Knowledge-backed AI receptionist.",
        "Outbound customer calls still require owner GRANT.",
      ],
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

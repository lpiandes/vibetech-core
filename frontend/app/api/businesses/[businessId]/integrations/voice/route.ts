import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { configureInboundVoiceWebhook } from "../../../../../../../backend/core/integrations/twilio/TwilioProvisioningService.js";
import {
  notifyPlatformOperators,
} from "../../../../../../../backend/core/admin/notifyPlatformOperators.js";
import {
  buildOpsPlaybook,
  playbookToOperatorAction,
} from "../../../../../../../backend/core/admin/opsPlaybooks/OpsPlaybookRegistry.js";
import { markWhiteGloveReadyFromCredentials } from "../../../../../../../backend/core/integrations/whiteglove/requestWhiteGloveSetup.js";

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
    const forwardNumber = String(body.forwardNumber ?? "").trim();
    const missedCallFollowUpEnabled = body.missedCallFollowUpEnabled === true
      || body.missedCallFollowUpEnabled === "true"
      || Boolean(forwardNumber);
    const ringTimeoutSeconds = Math.min(
      60,
      Math.max(5, Number(body.ringTimeoutSeconds ?? 20) || 20),
    );
    const smsBodyTemplate = String(body.smsBodyTemplate ?? "").trim();

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
      secrets: {
        accountSid,
        authToken,
        fromNumber,
        twimlUrl,
        forwardNumber,
        missedCallFollowUpEnabled,
        ringTimeoutSeconds,
        smsBodyTemplate,
      },
      metadata: {
        fromNumber,
        twimlUrl,
        receptionist: !missedCallFollowUpEnabled || !forwardNumber,
        inboundUrl: defaultTwiml,
        dialResultUrl: `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/voice/dial-result`,
        missedCallFollowUpEnabled,
        forwardNumber,
        ringTimeoutSeconds,
        smsBodyTemplate: smsBodyTemplate || null,
      },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectTwilioVoice({
      credentialId,
      fromNumber,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    let voiceWebhook = { ok: false as boolean, configured: false as boolean, message: null as string | null };
    try {
      const configured = await configureInboundVoiceWebhook({
        businessId,
        accountSid,
        authToken,
        fromNumber,
      });
      voiceWebhook = {
        ok: Boolean(configured?.ok),
        configured: Boolean(configured?.configured || configured?.ok),
        message: configured?.ok ? null : String(configured?.message ?? configured?.reason ?? "webhook_not_set"),
      };
    } catch (err) {
      voiceWebhook = {
        ok: false,
        configured: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }

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

    const missedOn = Boolean(missedCallFollowUpEnabled && forwardNumber);
    const nextSteps = [
      voiceWebhook.configured
        ? "Voice webhook set on your Twilio number automatically."
        : `In Twilio → Phone Numbers → your number → Voice webhook (POST): ${defaultTwiml}`,
      "Publish this Twilio number as your business line (website/Google), or forward unanswered calls from your existing business number to it.",
      missedOn
        ? `Missed calls ring ${forwardNumber}, then text the caller automatically. Also connect Text messaging if you have not.`
        : "Add your cell as the forward number to turn on missed-call texts (or leave off for AI receptionist only).",
      "Prove with a real call from another phone — do not answer — confirm you get the SMS.",
    ];

    await markWhiteGloveReadyFromCredentials({
      platformStore,
      businessId,
      connectionId: "voice_channel",
      actorId: "credentials_connected",
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
      twimlUrl,
      inboundUrl: defaultTwiml,
      fromNumber,
      voiceWebhookConfigured: voiceWebhook.configured,
      voiceWebhookMessage: voiceWebhook.message,
      missedCallFollowUp: {
        enabled: missedCallFollowUpEnabled,
        forwardNumber: forwardNumber || null,
        ringTimeoutSeconds,
        active: missedOn,
      },
      nextSteps,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

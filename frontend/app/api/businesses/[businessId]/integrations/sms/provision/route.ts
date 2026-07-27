/**
 * Provision SMS for a business: owner enters brand info; VIBETech buys/assigns a Twilio number.
 * If a number is already connected, saves brand/A2P details without buying another number.
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  isTwilioPlatformConfigured,
  normalizeBrandInput,
  provisionTwilioSmsForBusiness,
} from "../../../../../../../../backend/core/integrations/twilio/TwilioProvisioningService.js";
import {
  submitTwilioA2pRegistration,
} from "../../../../../../../../backend/core/integrations/twilio/TwilioA2pTrustHubService.js";
import { buildOperatorActions } from "../../../../../../../../backend/core/admin/buildOperatorActions.js";
import { notifyPlatformOperators } from "../../../../../../../../backend/core/admin/notifyPlatformOperators.js";

async function runA2pSubmit({
  businessId,
  secrets,
  metadata,
  brand,
  vault,
  credentialId,
}: {
  businessId: string;
  secrets: any;
  metadata: any;
  brand: any;
  vault: any;
  credentialId: string;
}) {
  const a2p = await submitTwilioA2pRegistration({
    accountSid: secrets.accountSid,
    authToken: secrets.authToken,
    brand,
    messagingServiceSid: metadata?.messagingServiceSid ?? null,
    existing: {
      brandRegistrationSid: metadata?.brandRegistrationSid,
      campaignSid: metadata?.campaignSid,
      messagingServiceSid: metadata?.messagingServiceSid,
      customerProfileSid: metadata?.customerProfileSid,
      a2pProfileBundleSid: metadata?.a2pProfileBundleSid,
    },
  });
  const nextMeta = {
    ...metadata,
    a2pRegistrationStatus: a2p.a2pRegistrationStatus ?? "pending",
    brandRegistrationSid: a2p.brandRegistrationSid ?? metadata?.brandRegistrationSid ?? null,
    campaignSid: a2p.campaignSid ?? metadata?.campaignSid ?? null,
    messagingServiceSid: a2p.messagingServiceSid ?? metadata?.messagingServiceSid ?? null,
    a2pLastCheckedAt: a2p.at,
    a2pMessage: a2p.message,
    a2pError: a2p.error ?? null,
    brand,
  };
  await putDurableCredential({
    platformStore,
    vault,
    workspaceId: businessId,
    credentialId,
    providerType: "twilio_sms",
    secrets,
    metadata: nextMeta,
  });
  return { a2p, nextMeta };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const brandInput = body?.brand ?? body;

    const existing = await findExistingSmsCredential(businessId);
    if (existing?.fromNumber && existing?.secrets?.accountSid && existing?.secrets?.authToken) {
      const normalized = normalizeBrandInput(brandInput);
      if (!normalized.ok) {
        return NextResponse.json(
          {
            error: `Enter business details first: ${normalized.missing.join(", ")}.`,
            code: "BRAND_INCOMPLETE",
            missing: normalized.missing,
          },
          { status: 400 },
        );
      }

      const metadata = {
        ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        fromNumber: existing.fromNumber,
        provisionedBy: existing.metadata?.provisionedBy ?? "existing",
        a2pRegistrationStatus: "pending",
        brand: normalized,
      };

      const vault =
        (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
        ?? getSharedCredentialVault();

      await putDurableCredential({
        platformStore,
        vault,
        workspaceId: businessId,
        credentialId: existing.credentialId,
        providerType: "twilio_sms",
        secrets: existing.secrets,
        metadata,
      });

      const { a2p, nextMeta } = await runA2pSubmit({
        businessId,
        secrets: existing.secrets,
        metadata,
        brand: normalized,
        vault,
        credentialId: existing.credentialId,
      });

      const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
      const connection = await ctx.service.connectTwilioSms({
        credentialId: existing.credentialId,
        fromNumber: existing.fromNumber,
        platformActiveKnowledgeCount: knowledgeCount,
        provisionMeta: {
          provisionedBy: nextMeta.provisionedBy,
          phoneSid: nextMeta.phoneSid ?? null,
          a2pRegistrationStatus: nextMeta.a2pRegistrationStatus,
          brand: normalized,
          brandUpdatedAt: new Date().toISOString(),
          brandRegistrationSid: nextMeta.brandRegistrationSid,
          campaignSid: nextMeta.campaignSid,
        },
      });

      if (String(nextMeta.a2pRegistrationStatus) !== "approved") {
        void notifyA2pOperatorAction(businessId);
      }

      return NextResponse.json({
        ok: true,
        provisioned: false,
        brandSaved: true,
        fromNumber: existing.fromNumber,
        a2pRegistrationStatus: nextMeta.a2pRegistrationStatus,
        a2p: {
          message: a2p.message,
          brandRegistrationSid: nextMeta.brandRegistrationSid,
          error: a2p.error ?? null,
        },
        message: a2p.message
          || "Business details saved. Carrier brand/campaign registration is pending — you can send a test text next.",
        connection: {
          id: connection?.id,
          connectionType: connection?.connectionType,
          status: connection?.status,
        },
      });
    }

    const provision = await provisionTwilioSmsForBusiness({
      businessId,
      brand: brandInput,
      simulate: body?.simulate === true || process.env.TWILIO_PROVISION_SIMULATE === "1",
    });

    if (!provision.ok) {
      const status = provision.reason === "brand_incomplete" ? 400
        : provision.reason === "platform_twilio_not_configured" ? 503
          : 400;
      return NextResponse.json(
        {
          error: provision.message,
          code: String(provision.reason ?? "PROVISION_FAILED").toUpperCase(),
          missing: provision.missing ?? undefined,
          platformConfigured: isTwilioPlatformConfigured(),
        },
        { status },
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
      secrets: {
        accountSid: provision.accountSid,
        authToken: provision.authToken,
        fromNumber: provision.fromNumber,
      },
      metadata: {
        fromNumber: provision.fromNumber,
        provisionedBy: "platform",
        phoneSid: provision.phoneSid ?? null,
        a2pRegistrationStatus: "pending",
        brand: provision.brand ?? null,
      },
    });

    const secrets = {
      accountSid: provision.accountSid,
      authToken: provision.authToken,
      fromNumber: provision.fromNumber,
    };
    const { a2p, nextMeta } = await runA2pSubmit({
      businessId,
      secrets,
      metadata: {
        fromNumber: provision.fromNumber,
        provisionedBy: "platform",
        phoneSid: provision.phoneSid ?? null,
        a2pRegistrationStatus: "pending",
        brand: provision.brand ?? null,
      },
      brand: provision.brand,
      vault,
      credentialId,
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectTwilioSms({
      credentialId,
      fromNumber: provision.fromNumber,
      platformActiveKnowledgeCount: knowledgeCount,
      provisionMeta: {
        provisionedBy: "platform",
        phoneSid: provision.phoneSid ?? null,
        a2pRegistrationStatus: nextMeta.a2pRegistrationStatus,
        brand: provision.brand ?? null,
        simulated: provision.simulated === true,
        brandRegistrationSid: nextMeta.brandRegistrationSid,
        campaignSid: nextMeta.campaignSid,
      },
    });

    const status = String(connection?.status ?? "").toUpperCase();
    if (status !== "CONNECTED" && provision.simulated !== true) {
      const healthMsg = String(connection?.health?.message ?? "").trim();
      return NextResponse.json(
        {
          error: healthMsg
            || "Number was provisioned but Twilio verification failed. Try again or contact support.",
          code: "VERIFY_FAILED",
          fromNumber: provision.fromNumber,
        },
        { status: 400 },
      );
    }

    if (String(nextMeta.a2pRegistrationStatus) !== "approved") {
      void notifyA2pOperatorAction(businessId);
    }

    return NextResponse.json({
      ok: true,
      provisioned: true,
      fromNumber: provision.fromNumber,
      a2pRegistrationStatus: nextMeta.a2pRegistrationStatus,
      a2p: {
        message: a2p.message,
        brandRegistrationSid: nextMeta.brandRegistrationSid,
        error: a2p.error ?? null,
      },
      simulated: provision.simulated === true,
      message: provision.message,
      connection: {
        id: connection?.id,
        connectionType: connection?.connectionType,
        status: connection?.status ?? (provision.simulated ? "CONNECTED" : connection?.status),
      },
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

async function findExistingSmsCredential(businessId: string) {
  const rows = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
  const row = (Array.isArray(rows) ? rows : []).find((r: any) => {
    const provider = String(r?.providerType ?? "");
    const id = String(r?.credentialId ?? "");
    return provider === "twilio_sms" || id.includes("twilio_sms");
  });
  if (!row) return null;
  const secrets = row.secrets && typeof row.secrets === "object" ? row.secrets : {};
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const fromNumber = String(secrets.fromNumber ?? metadata.fromNumber ?? "").trim();
  if (!fromNumber) return null;
  return {
    credentialId: String(row.credentialId),
    secrets,
    metadata,
    fromNumber,
  };
}

async function notifyA2pOperatorAction(businessId: string) {
  try {
    const business = await platformStore.getBusiness?.(businessId).catch?.(() => null)
      ?? null;
    const actions = await buildOperatorActions({
      businesses: [{ id: businessId, name: business?.name ?? businessId }],
      listCredentials: (id) => platformStore.listIntegrationCredentialsForWorkspace(id),
    });
    await notifyPlatformOperators({ actions, force: true });
  } catch {
    /* never block provision */
  }
}

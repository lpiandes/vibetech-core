import { NextResponse } from "next/server";
import { platformStore, AuthorizationError } from "@/lib/server/compose";
import { getAuthorizedBusinessScope, requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { businessGrantsFeRetentionAccess } from "../../../backend/core/fe-retention/feRetentionEntitlement.js";
import { readFeRetentionBilling } from "../../../backend/core/fe-retention/FeRetentionBilling.js";
import { ensureFeRetentionInstallation } from "../../../backend/core/fe-retention/ensureFeRetentionInstallation.js";
import { readFeRetentionState } from "../../../backend/core/fe-retention/FeRetentionStore.js";
import {
  readPlatformTwilioSmsEnv,
  listMissingPlatformTwilioEnvKeys,
} from "../../../backend/core/fe-retention/FeRetentionSms.js";
import { describeTwilioReadiness } from "../../../backend/core/fe-retention/FeRetentionSettingsCatalog.js";
import { readPurchasedPackagesFromConfig } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { PLATFORM_ROLES } from "../../../backend/core/platform/permissions/rolePermissions.js";
import { createFrontendInvitationDeliveryProvider } from "@/lib/server/invitationDelivery";
import { putDurableCredential } from "../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";

export async function requireFeRetentionContext(businessId: string) {
  const user = await requireSessionUser();
  const isPlatformAdmin = user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
  const business = await platformStore.getBusinessById(businessId);
  if (!business) {
    throw new AuthorizationError("NOT_FOUND", "Business not found.");
  }
  const packages = readPurchasedPackagesFromConfig(business.packageConfiguration ?? {});
  if (!businessGrantsFeRetentionAccess(packages) && !isPlatformAdmin) {
    throw new AuthorizationError("FORBIDDEN", "Final Expense Retention CRM is not enabled for this business.");
  }

  let scope;
  if (isPlatformAdmin) {
    scope = {
      user,
      businessId,
      role: "PLATFORM_ADMIN",
      isPlatformAdmin: true,
    };
  } else {
    scope = await getAuthorizedBusinessScope(businessId);
    const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
    if (!billing.allowsDashboard) {
      throw new AuthorizationError("PAYMENT_REQUIRED", "This book is paused until the $200 monthly subscription is current.");
    }
  }

  const ensured = await ensureFeRetentionInstallation({
    platformStore,
    businessId,
    packageConfiguration: business.packageConfiguration,
    actorId: scope.user.id,
    putDurableCredential,
    vault: getSharedCredentialVault(),
    light: true,
  });
  const installation = ensured.installation
    ?? await platformStore.getBusinessOSInstallation(businessId);
  if (!installation) {
    throw new Error("Could not prepare FE Retention installation.");
  }

  const state = readFeRetentionState(installation);
  return {
    scope,
    business,
    installation,
    state,
    platformStore,
    sms: ensured.sms,
  };
}

export function feJsonError(err: unknown) {
  if (err instanceof AuthorizationError) {
    const status = err.code === "UNAUTHENTICATED"
      ? 401
      : err.code === "NOT_FOUND"
        ? 404
        : err.code === "PAYMENT_REQUIRED"
          ? 402
          : 403;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  console.error("[fe-retention]", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "Request failed." },
    { status: 500 },
  );
}

export async function resolveFeIntegrationPlatform(businessId: string) {
  try {
    const ws = await getSystemWorkspaceForBusiness(businessId);
    return ws?.service?.connected?.integrationPlatform ?? null;
  } catch {
    return null;
  }
}

export function getFeDeliveryProvider() {
  return createFrontendInvitationDeliveryProvider();
}

/** @deprecated prefer getFeDeliveryProvider + deliverFeClientTouchpoint deliveryProvider */
export function createFeAgentEmailSender() {
  const provider = getFeDeliveryProvider();
  return async ({ to, subject, text }: { to: string; subject: string; text: string }) => {
    await provider.send({
      to,
      subject,
      text,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`,
    });
  };
}

export function resolveFeSmsStatus() {
  const env = readPlatformTwilioSmsEnv();
  const missing = listMissingPlatformTwilioEnvKeys();
  const ready = missing.length === 0;
  const described = describeTwilioReadiness({
    ready,
    fromNumber: env.fromNumber || null,
    missing,
  });
  return {
    ready,
    fromNumber: ready ? env.fromNumber : null,
    mode: "platform_shared",
    missing,
    badge: described.badge,
    message: described.message,
  };
}

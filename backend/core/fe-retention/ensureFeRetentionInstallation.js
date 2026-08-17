import { FE_RETENTION_CRM_PACKAGE_ID } from "./feRetentionEntitlement.js";
import { emptyFeRetentionState, readFeRetentionState } from "./FeRetentionStore.js";
import { readPurchasedPackagesFromConfig } from "../platform/packages/SalesPackageCatalog.js";
import { ensureFeRetentionPlatformSms, resolveFeRetentionFromNumber } from "./FeRetentionSms.js";
import { configureFeRetentionInboundSmsWebhook } from "./FeRetentionInbound.js";
import { feRetentionMayProvisionSms } from "./FeRetentionOnboarding.js";

/**
 * Ensure a minimal installed Business OS row exists for FE Retention CRM agents
 * so they never need Architect / package Ask.
 *
 * Also attaches platform Twilio SMS credentials when available (agent does nothing).
 *
 * @param {{ light?: boolean }} [options]
 *   light=true skips Twilio credential attach + webhook configure (fast path for layout/API reads).
 */
export async function ensureFeRetentionInstallation({
  platformStore,
  businessId,
  packageConfiguration = null,
  actorId = "fe_retention_bootstrap",
  putDurableCredential = null,
  vault = null,
  light = false,
  configureInboundWebhook = !light,
  attachSms = !light,
} = {}) {
  if (!platformStore || !businessId) {
    return { ok: false, reason: "missing_args", installation: null, sms: null };
  }

  let installation = null;
  const existing = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);

  if (existing?.status === "installed" || existing?.configuration?.feRetention) {
    if (!existing.configuration?.feRetention) {
      const state = emptyFeRetentionState();
      await platformStore.upsertBusinessOSInstallation({
        id: existing.id ?? `install_${businessId}`,
        businessId,
        specificationRowId: existing.specificationRowId ?? null,
        specificationId: existing.specificationId ?? `fe_retention_${businessId}`,
        specificationVersion: existing.specificationVersion ?? 1,
        specificationContentHash: existing.specificationContentHash ?? "fe_retention",
        planId: existing.planId ?? `plan_fe_${businessId}`,
        status: "installed",
        plan: existing.plan ?? { product: FE_RETENTION_CRM_PACKAGE_ID },
        actionCheckpoints: existing.actionCheckpoints ?? [],
        configuration: {
          ...(existing.configuration ?? {}),
          purchasedPackages: existing.configuration?.purchasedPackages
            ?? [FE_RETENTION_CRM_PACKAGE_ID],
          feRetention: state,
        },
        history: [
          ...(Array.isArray(existing.history) ? existing.history : []),
          { at: new Date().toISOString(), action: "fe_retention_bootstrap", actorId },
        ].slice(-100),
        actorUserId: existing.actorUserId ?? actorId,
        installedAt: existing.installedAt ?? new Date().toISOString(),
      });
      installation = await platformStore.getBusinessOSInstallation(businessId);
    } else {
      installation = existing;
    }
  } else {
    const business = await platformStore.getBusinessById?.(businessId).catch(() => null);
    const pkgConfig = packageConfiguration
      ?? business?.packageConfiguration
      ?? {};
    const purchased = readPurchasedPackagesFromConfig(pkgConfig);
    const packages = purchased.includes(FE_RETENTION_CRM_PACKAGE_ID)
      ? purchased
      : [...purchased, FE_RETENTION_CRM_PACKAGE_ID];

    const at = new Date().toISOString();
    const state = emptyFeRetentionState();
    if (pkgConfig?.agentNotifyEmail) {
      state.settings.agentNotifyEmail = String(pkgConfig.agentNotifyEmail);
    }

    await platformStore.upsertBusinessOSInstallation({
      id: `install_${businessId}`,
      businessId,
      specificationRowId: null,
      specificationId: `fe_retention_${businessId}`,
      specificationVersion: 1,
      specificationContentHash: "fe_retention_v1",
      planId: `plan_fe_${businessId}`,
      status: "installed",
      plan: { product: FE_RETENTION_CRM_PACKAGE_ID },
      actionCheckpoints: [],
      configuration: {
        purchasedPackages: packages,
        feRetention: state,
        feRetentionBilling: pkgConfig.feRetentionBilling,
      },
      history: [{ at, action: "fe_retention_install", actorId }],
      actorUserId: actorId,
      installedAt: at,
    });
    installation = await platformStore.getBusinessOSInstallation(businessId);
  }

  // Fast path: skip Twilio HTTP on unpaid page loads.
  const pkgConfig = packageConfiguration ?? {};
  if (light && installation?.configuration?.feRetention && !attachSms) {
    return {
      ok: true,
      created: !existing,
      patched: Boolean(existing && !existing.configuration?.feRetention),
      installation,
      sms: null,
      light: true,
    };
  }

  let sms = null;
  if (attachSms && feRetentionMayProvisionSms(pkgConfig) && typeof putDurableCredential === "function") {
    try {
      sms = await ensureFeRetentionPlatformSms({
        platformStore,
        businessId,
        vault,
        putDurableCredential,
        actorId,
        packageConfiguration: pkgConfig,
      });
    } catch (err) {
      sms = {
        ok: false,
        reason: "sms_ensure_failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  let inboundWebhook = null;
  const webhookNumber = sms?.fromNumber
    || await resolveFeRetentionFromNumber({
      platformStore,
      businessId,
      packageConfiguration: pkgConfig,
    });
  if (webhookNumber && (configureInboundWebhook || Boolean(sms?.ok && sms.already === false))) {
    try {
      inboundWebhook = await configureFeRetentionInboundSmsWebhook({
        fromNumber: webhookNumber,
        force: Boolean(sms?.ok && sms.already === false),
      });
    } catch (err) {
      inboundWebhook = {
        ok: false,
        reason: "inbound_webhook_failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    ok: true,
    created: !existing,
    patched: Boolean(existing && !existing.configuration?.feRetention),
    installation,
    sms,
    inboundWebhook,
  };
}

export function installationHasFeRetention(installation) {
  return Boolean(readFeRetentionState(installation));
}

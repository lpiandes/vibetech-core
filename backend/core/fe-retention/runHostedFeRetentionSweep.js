import { businessGrantsFeRetentionAccess } from "./feRetentionEntitlement.js";
import { ensureFeRetentionInstallation } from "./ensureFeRetentionInstallation.js";
import { readFeRetentionState, writeFeRetentionState } from "./FeRetentionStore.js";
import { mergeFeRetentionSnapshots } from "./FeRetentionStateMerge.js";
import { runFeRetentionSchedulerForBusiness } from "./FeRetentionNeedsAttention.js";
import { deliverFeClientTouchpoint } from "./FeRetentionOutbound.js";
import { runFeRetentionGmailLapsePass } from "./FeRetentionLapseFromGmail.js";
import { readPurchasedPackagesFromConfig } from "../platform/packages/SalesPackageCatalog.js";

/**
 * Daily FE retention sweep — piggybacks on hosted job tick.
 */
export async function runHostedFeRetentionSweep({
  platformStore,
  getSystemWorkspaceForBusiness,
  emailSender = null,
  deliveryProvider = null,
  putDurableCredential = null,
  vault = null,
  maxBusinesses = 80,
} = {}) {
  const outcome = {
    attempted: 0,
    scheduled: 0,
    gmailPasses: 0,
    errors: [],
  };
  if (!platformStore?.listBusinesses) {
    return outcome;
  }

  let businesses = [];
  try {
    businesses = await platformStore.listBusinesses({ limit: 200 });
  } catch {
    try {
      businesses = await platformStore.listAllBusinesses?.() ?? [];
    } catch {
      return outcome;
    }
  }

  const feBusinesses = (Array.isArray(businesses) ? businesses : [])
    .filter((b) => businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(b?.packageConfiguration ?? {})))
    .slice(0, maxBusinesses);

  for (const business of feBusinesses) {
    const businessId = String(business.id);
    outcome.attempted += 1;
    try {
      const ensured = await ensureFeRetentionInstallation({
        platformStore,
        businessId,
        packageConfiguration: business.packageConfiguration,
        actorId: "fe_retention_tick",
        putDurableCredential,
        vault,
      });
      let installation = ensured.installation
        ?? await platformStore.getBusinessOSInstallation(businessId);
      if (!installation) continue;

      let integrationPlatform = null;
      if (typeof getSystemWorkspaceForBusiness === "function") {
        try {
          const ws = await getSystemWorkspaceForBusiness(businessId);
          integrationPlatform = ws?.service?.connected?.integrationPlatform ?? null;
          installation = ws?.installation ?? installation;
        } catch {
          /* SMS falls back to platform env */
        }
      }

      const deliverTouchpoint = (args) => deliverFeClientTouchpoint({
        ...args,
        deliveryProvider,
        emailSender,
        businessName: business.name,
        agentEmail: args.agentEmail || args.state?.settings?.agentNotifyEmail || null,
        agentPhone: args.agentPhone || args.state?.settings?.agentNotifyPhone || null,
      });

      const sched = await runFeRetentionSchedulerForBusiness({
        platformStore,
        installation,
        integrationPlatform,
        emailSender,
        deliverTouchpoint,
      });
      outcome.scheduled += sched.results.filter((r) => r.ok).length;

      let state = sched.state;
      const freshInstall = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
      const freshState = readFeRetentionState(freshInstall);
      state = mergeFeRetentionSnapshots(freshState, {
        ...state,
        settings: {
          ...state.settings,
          lastSchedulerRunAt: new Date().toISOString(),
        },
      });
      state = await writeFeRetentionState({
        platformStore,
        installation: freshInstall ?? installation,
        state,
        actorId: "fe_retention_tick",
        historyAction: "fe_scheduler_tick",
        settingsMode: "preserve_settings",
      });
      installation = freshInstall ?? installation;
      installation.configuration = {
        ...(installation.configuration ?? {}),
        feRetention: state,
      };

      const gmail = await runFeRetentionGmailLapsePass({
        platformStore,
        installation,
        integrationPlatform,
        emailSender,
        deliverTouchpoint,
      });
      outcome.gmailPasses += gmail.detections.filter((d) => d.matched && !d.already).length;
    } catch (err) {
      outcome.errors.push({
        businessId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcome;
}

/** Lightweight selector when listBusinesses is unavailable — use installation scan helpers if present. */
export async function selectFeRetentionBusinessIds(platformStore, { limit = 25 } = {}) {
  if (typeof platformStore?.listBusinesses === "function") {
    const rows = await platformStore.listBusinesses({ limit: 200 });
    return (rows ?? [])
      .filter((b) => businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(b?.packageConfiguration ?? {})))
      .slice(0, limit)
      .map((b) => String(b.id));
  }
  return [];
}

export { readFeRetentionState };

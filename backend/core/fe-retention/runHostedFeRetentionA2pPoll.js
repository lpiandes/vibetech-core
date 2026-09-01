/**
 * Poll pending VibeKeep A2P registrations on hosted job tick.
 */
import { refreshFeRetentionA2pRegistration, submitFeRetentionA2pRegistration } from "./submitFeRetentionA2pRegistration.js";
import { readFeRetentionOnboarding } from "./FeRetentionOnboarding.js";
import { businessGrantsFeRetentionAccess } from "./feRetentionEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../platform/packages/SalesPackageCatalog.js";
import { normalizeSmsCarrierPhase } from "../integrations/sms/smsCarrierStatus.js";
import { feSmsCredentialId } from "./FeRetentionSms.js";

const A2P_POLL_MAX_PER_TICK = 12;
const A2P_POLL_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function isDueForPoll(meta = {}) {
  const phase = normalizeSmsCarrierPhase(meta.a2pRegistrationStatus);
  if (phase === "approved" || phase === "failed") return false;
  const last = Date.parse(safeString(meta.a2pLastCheckedAt));
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= A2P_POLL_MIN_INTERVAL_MS;
}

export async function runHostedFeRetentionA2pPoll({
  platformStore,
  vault = null,
  maxPerTick = A2P_POLL_MAX_PER_TICK,
  fetchImpl = globalThis.fetch,
} = {}) {
  const outcome = {
    attempted: 0,
    refreshed: 0,
    submitted: 0,
    errors: [],
  };
  const listCandidates = platformStore?.listWorkspaceIdsWithIntegrationCredentialType;
  if (typeof listCandidates !== "function") return outcome;

  let businessIds = [];
  try {
    businessIds = await listCandidates.call(platformStore, "twilio_sms", { limit: 80, offset: 0 });
  } catch {
    return outcome;
  }

  for (const businessId of businessIds.slice(0, maxPerTick * 3)) {
    if (outcome.attempted >= maxPerTick) break;
    let business = null;
    try {
      business = await platformStore.getBusinessById?.(businessId);
    } catch {
      business = null;
    }
    if (!business) continue;
    if (!businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(business.packageConfiguration ?? {}))) {
      continue;
    }

    const cred = await platformStore.getIntegrationCredential?.(feSmsCredentialId(businessId)).catch(() => null);
    const meta = cred?.metadata && typeof cred.metadata === "object" ? cred.metadata : {};
    if (safeString(meta.feA2pProduct) !== "vibekeep" && !meta.customerProfileSid && !meta.brandRegistrationSid) {
      continue;
    }
    if (!isDueForPoll(meta)) continue;

    outcome.attempted += 1;
    try {
      if (meta.brandRegistrationSid) {
        const refreshed = await refreshFeRetentionA2pRegistration({
          platformStore,
          businessId,
          vault,
          fetchImpl,
        });
        if (refreshed.ok) outcome.refreshed += 1;
        else outcome.errors.push({ businessId, reason: refreshed.reason || refreshed.error || "refresh_failed" });
      } else {
        const onboarding = readFeRetentionOnboarding(business.packageConfiguration ?? {});
        const submitted = await submitFeRetentionA2pRegistration({
          platformStore,
          businessId,
          profile: onboarding.profile,
          fromNumber: safeString(cred?.secrets?.fromNumber || meta.fromNumber),
          businessName: String(business.name ?? onboarding.profile?.legalBusinessName ?? ""),
          packageConfiguration: business.packageConfiguration,
          vault,
        });
        if (submitted.ok !== false) outcome.submitted += 1;
        else outcome.errors.push({ businessId, reason: submitted.reason || submitted.error || "submit_failed" });
      }
    } catch (err) {
      outcome.errors.push({
        businessId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcome;
}

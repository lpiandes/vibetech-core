#!/usr/bin/env node
/**
 * Resubmit or refresh VibeKeep A2P registration for a book (no browser/DevTools).
 *
 * Usage:
 *   node scripts/fe-retention-a2p-resubmit.js --businessId <uuid> [--resubmit] [--refresh]
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { getSharedCredentialVault } from "../backend/core/integrations/credentials/CredentialVault.js";
import { putDurableCredential } from "../backend/core/integrations/credentials/durableCredentialVault.js";
import { ensureFeRetentionPlatformSms } from "../backend/core/fe-retention/FeRetentionSms.js";
import {
  loadFeSmsCredential,
  refreshFeRetentionA2pRegistration,
  submitFeRetentionA2pRegistration,
} from "../backend/core/fe-retention/submitFeRetentionA2pRegistration.js";
import { readFeRetentionOnboarding } from "../backend/core/fe-retention/FeRetentionOnboarding.js";

function readArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const businessId = readArg("--businessId");
const refreshOnly = process.argv.includes("--refresh");
const resubmit = process.argv.includes("--resubmit") || !refreshOnly;

if (!businessId) {
  console.error("Usage: node scripts/fe-retention-a2p-resubmit.js --businessId <uuid> [--resubmit] [--refresh]");
  process.exit(1);
}

// Real Twilio — never simulate for ops backfill
delete process.env.TWILIO_A2P_SIMULATE;

const business = await platformStore.getBusinessById(businessId);
if (!business) {
  console.error(`Book not found: ${businessId}`);
  process.exit(1);
}

const vault = getSharedCredentialVault();

let before = await loadFeSmsCredential(platformStore, businessId);
if (!before) {
  const sms = await ensureFeRetentionPlatformSms({
    platformStore,
    businessId,
    vault,
    putDurableCredential,
    packageConfiguration: business.packageConfiguration,
  });
  if (!sms.ok) {
    console.error(`SMS not ready: ${sms.message || sms.reason || "unknown"}`);
    process.exit(1);
  }
  before = await loadFeSmsCredential(platformStore, businessId);
  if (!before) {
    console.error("SMS credential still missing after provision attempt.");
    process.exit(1);
  }
}
let result;

if (refreshOnly) {
  result = await refreshFeRetentionA2pRegistration({
    platformStore,
    businessId,
    vault,
  });
} else {
  const onboarding = readFeRetentionOnboarding(business.packageConfiguration ?? {});
  result = await submitFeRetentionA2pRegistration({
    platformStore,
    businessId,
    profile: onboarding.profile,
    fromNumber: before.fromNumber ?? null,
    businessName: String(business.name ?? onboarding.profile?.legalBusinessName ?? ""),
    packageConfiguration: business.packageConfiguration,
    vault,
    resubmit,
  });
}

const meta = result.metadata ?? before.metadata ?? {};
console.log(JSON.stringify({
  ok: result.ok,
  business: business.name,
  fromNumber: result.fromNumber ?? before.fromNumber,
  a2pRegistrationStatus: result.a2pRegistrationStatus ?? meta.a2pRegistrationStatus,
  brandRegistrationSid: result.brandRegistrationSid ?? meta.brandRegistrationSid ?? null,
  campaignSid: result.campaignSid ?? meta.campaignSid ?? null,
  messagingServiceSid: result.messagingServiceSid ?? meta.messagingServiceSid ?? null,
  customerProfileSid: result.customerProfileSid ?? meta.customerProfileSid ?? null,
  message: result.message ?? meta.a2pMessage ?? null,
  error: result.error ?? meta.a2pError ?? null,
  reason: result.reason ?? null,
}, null, 2));

await closePool();
process.exit(result.ok ? 0 : 1);

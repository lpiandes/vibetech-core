/**
 * VibeKeep A2P orchestrator — Trust Hub profile, brand, campaign, messaging service.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { putDurableCredential } from "../integrations/credentials/durableCredentialVault.js";
import { createAgencyCustomerProfile } from "../integrations/twilio/TwilioTrustHubProfileService.js";
import {
  submitTwilioA2pRegistration,
  refreshTwilioA2pStatus,
} from "../integrations/twilio/TwilioA2pTrustHubService.js";
import {
  addNumberToSenderPool,
  createMessagingService,
  lookupPhoneNumberSid,
} from "../integrations/twilio/TwilioMessagingService.js";
import {
  feSmsCredentialId,
  readPlatformTwilioSmsEnv,
  buildFeRetentionTwilioFriendlyName,
} from "./FeRetentionSms.js";
import { mapFeA2pProfileToTwilioBrand } from "./mapFeA2pProfileToTwilioBrand.js";
import { normalizeFeA2pProfile } from "./FeRetentionOnboardingCatalog.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

async function loadFeSmsCredential(platformStore, businessId) {
  const credentialId = feSmsCredentialId(businessId);
  const row = await platformStore.getIntegrationCredential?.(credentialId).catch(() => null);
  if (!row?.secrets?.accountSid) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    credentialId,
    secrets: row.secrets,
    metadata: meta,
    fromNumber: safeString(row.secrets?.fromNumber || meta.fromNumber),
    phoneSid: safeString(meta.phoneSid),
  };
}

async function persistA2pMetadata({
  platformStore,
  vault,
  businessId,
  credentialId,
  secrets,
  metadata,
  patch,
}) {
  const nextMeta = { ...metadata, ...patch };
  await putDurableCredential({
    platformStore,
    vault,
    workspaceId: businessId,
    credentialId,
    providerType: "twilio_sms",
    secrets,
    metadata: nextMeta,
  });
  return nextMeta;
}

/**
 * Submit or refresh full A2P registration for a VibeKeep book.
 */
export async function submitFeRetentionA2pRegistration({
  platformStore,
  businessId,
  profile = {},
  fromNumber = null,
  businessName = "",
  packageConfiguration = null,
  vault = null,
  fetchImpl = globalThis.fetch,
  resubmit = false,
} = {}) {
  const id = safeString(businessId);
  if (!id || !platformStore) {
    return deepFreeze({ ok: false, reason: "missing_args", message: "businessId and platformStore required." });
  }

  const env = readPlatformTwilioSmsEnv();
  if (!env.accountSid || !env.authToken) {
    return deepFreeze({
      ok: false,
      reason: "platform_twilio_not_configured",
      message: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the server.",
    });
  }

  const cred = await loadFeSmsCredential(platformStore, id);
  if (!cred) {
    return deepFreeze({
      ok: false,
      reason: "sms_credential_missing",
      message: "This book does not have a texting number yet.",
    });
  }

  const bookFrom = safeString(fromNumber) || cred.fromNumber;
  if (!bookFrom) {
    return deepFreeze({
      ok: false,
      reason: "from_number_missing",
      message: "No From number on this book.",
    });
  }

  const normalizedProfile = normalizeFeA2pProfile(profile);
  const brand = mapFeA2pProfileToTwilioBrand(normalizedProfile);
  let meta = { ...cred.metadata, fromNumber: bookFrom, brand, feA2pProduct: "vibekeep" };

  if (resubmit && meta.brandRegistrationSid) {
    const refreshed = await refreshTwilioA2pStatus({
      accountSid: cred.secrets.accountSid,
      authToken: cred.secrets.authToken,
      brandRegistrationSid: meta.brandRegistrationSid,
      campaignSid: meta.campaignSid,
      messagingServiceSid: meta.messagingServiceSid,
      fetchImpl,
    });
    if (refreshed.ok && refreshed.a2pRegistrationStatus === "approved") {
      meta = await persistA2pMetadata({
        platformStore,
        vault,
        businessId: id,
        credentialId: cred.credentialId,
        secrets: cred.secrets,
        metadata: meta,
        patch: {
          a2pRegistrationStatus: refreshed.a2pRegistrationStatus,
          a2pLastCheckedAt: refreshed.at,
          a2pMessage: refreshed.message,
          a2pError: refreshed.error ?? null,
        },
      });
      return deepFreeze({ ok: true, ...refreshed, fromNumber: bookFrom, metadata: meta });
    }
  }

  const trustHub = await createAgencyCustomerProfile({
    accountSid: cred.secrets.accountSid,
    authToken: cred.secrets.authToken,
    profile: normalizedProfile,
    existing: {
      customerProfileSid: meta.customerProfileSid,
      a2pProfileBundleSid: meta.a2pProfileBundleSid,
      trustProductSid: meta.trustProductSid,
    },
    fetchImpl,
  });
  if (!trustHub.ok) {
    meta = await persistA2pMetadata({
      platformStore,
      vault,
      businessId: id,
      credentialId: cred.credentialId,
      secrets: cred.secrets,
      metadata: meta,
      patch: {
        a2pRegistrationStatus: "failed",
        a2pError: trustHub.error || trustHub.message || trustHub.reason,
        a2pLastCheckedAt: new Date().toISOString(),
      },
    });
    return deepFreeze({
      ok: false,
      reason: trustHub.reason || "trust_hub_failed",
      message: trustHub.message || trustHub.error || "Trust Hub profile creation failed.",
      error: trustHub.error || trustHub.message,
      fromNumber: bookFrom,
      metadata: meta,
    });
  }

  meta = await persistA2pMetadata({
    platformStore,
    vault,
    businessId: id,
    credentialId: cred.credentialId,
    secrets: cred.secrets,
    metadata: meta,
    patch: {
      customerProfileSid: trustHub.customerProfileSid,
      a2pProfileBundleSid: trustHub.a2pProfileBundleSid,
      trustProductSid: trustHub.trustProductSid,
      trustHubMessage: trustHub.message,
    },
  });

  let messagingServiceSid = safeString(meta.messagingServiceSid);
  if (!messagingServiceSid) {
    const ms = await createMessagingService({
      accountSid: cred.secrets.accountSid,
      authToken: cred.secrets.authToken,
      friendlyName: buildFeRetentionTwilioFriendlyName({
        businessName,
        packageConfiguration,
        businessId: id,
      }),
      fetchImpl,
    });
    if (!ms.ok) {
      meta = await persistA2pMetadata({
        platformStore,
        vault,
        businessId: id,
        credentialId: cred.credentialId,
        secrets: cred.secrets,
        metadata: meta,
        patch: {
          a2pRegistrationStatus: "failed",
          a2pError: ms.message || ms.reason,
        },
      });
      return deepFreeze({
        ok: false,
        reason: ms.reason || "messaging_service_failed",
        message: ms.message || "Could not create Messaging Service.",
        fromNumber: bookFrom,
        metadata: meta,
      });
    }
    messagingServiceSid = ms.messagingServiceSid;
    meta = await persistA2pMetadata({
      platformStore,
      vault,
      businessId: id,
      credentialId: cred.credentialId,
      secrets: cred.secrets,
      metadata: meta,
      patch: { messagingServiceSid },
    });
  }

  const a2p = await submitTwilioA2pRegistration({
    accountSid: cred.secrets.accountSid,
    authToken: cred.secrets.authToken,
    brand,
    messagingServiceSid,
    existing: {
      customerProfileSid: meta.customerProfileSid,
      a2pProfileBundleSid: meta.a2pProfileBundleSid,
      brandRegistrationSid: resubmit ? null : meta.brandRegistrationSid,
      campaignSid: resubmit ? null : meta.campaignSid,
      messagingServiceSid,
    },
    fetchImpl,
  });

  let phoneNumberSid = safeString(meta.phoneSid) || cred.phoneSid;
  if (!phoneNumberSid) {
    const lookup = await lookupPhoneNumberSid({
      accountSid: cred.secrets.accountSid,
      authToken: cred.secrets.authToken,
      phoneNumber: bookFrom,
      fetchImpl,
    });
    if (lookup.ok) phoneNumberSid = lookup.phoneNumberSid;
  }

  if (messagingServiceSid && phoneNumberSid) {
    const pooled = await addNumberToSenderPool({
      accountSid: cred.secrets.accountSid,
      authToken: cred.secrets.authToken,
      messagingServiceSid,
      phoneNumberSid,
      fetchImpl,
    });
    if (!pooled.ok) {
      meta = await persistA2pMetadata({
        platformStore,
        vault,
        businessId: id,
        credentialId: cred.credentialId,
        secrets: cred.secrets,
        metadata: meta,
        patch: { senderPoolError: pooled.message || pooled.reason },
      });
    }
  }

  meta = await persistA2pMetadata({
    platformStore,
    vault,
    businessId: id,
    credentialId: cred.credentialId,
    secrets: cred.secrets,
    metadata: meta,
    patch: {
      a2pRegistrationStatus: a2p.a2pRegistrationStatus ?? "pending",
      brandRegistrationSid: a2p.brandRegistrationSid ?? meta.brandRegistrationSid ?? null,
      campaignSid: a2p.campaignSid ?? meta.campaignSid ?? null,
      messagingServiceSid: a2p.messagingServiceSid ?? messagingServiceSid,
      a2pLastCheckedAt: a2p.at,
      a2pMessage: a2p.message,
      a2pError: a2p.error ?? null,
      phoneSid: phoneNumberSid || meta.phoneSid || null,
    },
  });

  const ok = Boolean(a2p.brandRegistrationSid) || a2p.a2pRegistrationStatus === "pending";
  return deepFreeze({
    ok,
    a2pRegistrationStatus: meta.a2pRegistrationStatus,
    brandRegistrationSid: meta.brandRegistrationSid,
    campaignSid: meta.campaignSid,
    messagingServiceSid: meta.messagingServiceSid,
    customerProfileSid: meta.customerProfileSid,
    fromNumber: bookFrom,
    message: a2p.message || trustHub.message,
    error: a2p.error ?? trustHub.error ?? null,
    metadata: meta,
  });
}

/**
 * Refresh A2P status for a VibeKeep book from Twilio.
 */
export async function refreshFeRetentionA2pRegistration({
  platformStore,
  businessId,
  vault = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  const id = safeString(businessId);
  const cred = await loadFeSmsCredential(platformStore, id);
  if (!cred?.secrets?.accountSid) {
    return deepFreeze({ ok: false, reason: "sms_credential_missing" });
  }
  const meta = cred.metadata;
  if (!meta.brandRegistrationSid) {
    return deepFreeze({ ok: false, reason: "brand_not_submitted", a2pRegistrationStatus: "pending" });
  }

  const refreshed = await refreshTwilioA2pStatus({
    accountSid: cred.secrets.accountSid,
    authToken: cred.secrets.authToken,
    brandRegistrationSid: meta.brandRegistrationSid,
    campaignSid: meta.campaignSid,
    messagingServiceSid: meta.messagingServiceSid,
    fetchImpl,
  });

  const nextMeta = await persistA2pMetadata({
    platformStore,
    vault,
    businessId: id,
    credentialId: cred.credentialId,
    secrets: cred.secrets,
    metadata: meta,
    patch: {
      a2pRegistrationStatus: refreshed.a2pRegistrationStatus ?? meta.a2pRegistrationStatus ?? "pending",
      a2pLastCheckedAt: refreshed.at,
      a2pMessage: refreshed.message,
      a2pError: refreshed.error ?? null,
      twilioBrandStatus: refreshed.twilioBrandStatus ?? null,
      campaignStatus: refreshed.campaignStatus ?? null,
    },
  });

  return deepFreeze({
    ...refreshed,
    fromNumber: cred.fromNumber,
    metadata: nextMeta,
  });
}

export { loadFeSmsCredential };

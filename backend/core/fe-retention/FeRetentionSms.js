/**
 * Platform-managed Twilio SMS for FE Retention (VibeKeep).
 * Agents never enter Twilio credentials.
 *
 * TWILIO_MESSAGING_FROM texts the operator (A2P setup). Every signed book
 * gets its own purchased US local number — including the first agency.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { INTEGRATION_CAPABILITIES } from "../integrations/capabilities/IntegrationCapability.js";
import { purchaseTwilioLocalSmsNumber } from "../integrations/twilio/TwilioProvisioningService.js";
import { readFeRetentionBilling, writeFeRetentionBilling, syncFeRetentionBillingOntoInstallation } from "./FeRetentionBilling.js";
import { readFeRetentionOnboarding } from "./FeRetentionOnboarding.js";
import { normalizeFePhone } from "./FeRetentionStore.js";
import { resolvePublicAppOrigin } from "../platform/invitations/invitationAppUrl.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function feSmsCredentialId(businessId) {
  return `cred_twilio_sms_${safeString(businessId)}`;
}

export function resolveFeRetentionInboundSmsWebhookUrl() {
  const origin = resolvePublicAppOrigin();
  if (!origin) return null;
  return `${origin}/api/insurance/sms/inbound`;
}

export function feSmsPhoneDigits(phone) {
  return safeString(phone).replace(/\D/g, "");
}

export function feSmsPhonesMatch(a, b) {
  const da = feSmsPhoneDigits(a);
  const db = feSmsPhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const a10 = da.length >= 10 ? da.slice(-10) : da;
  const b10 = db.length >= 10 ? db.slice(-10) : db;
  return a10.length >= 10 && b10.length >= 10 && a10 === b10;
}

export function readPlatformTwilioSmsEnv() {
  return {
    accountSid: safeString(process.env.TWILIO_ACCOUNT_SID),
    authToken: safeString(process.env.TWILIO_AUTH_TOKEN),
    fromNumber: safeString(process.env.TWILIO_MESSAGING_FROM || process.env.TWILIO_PHONE_NUMBER),
  };
}

export function listMissingPlatformTwilioEnvKeys() {
  const env = readPlatformTwilioSmsEnv();
  const missing = [];
  if (!env.accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!env.authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!env.fromNumber) missing.push("TWILIO_MESSAGING_FROM");
  return missing;
}

export function isPlatformTwilioSmsReady() {
  return listMissingPlatformTwilioEnvKeys().length === 0;
}

/** Twilio FriendlyName for a book's purchased number (max 64 chars). */
export function buildFeRetentionTwilioFriendlyName({
  businessName = "",
  packageConfiguration = null,
  businessId = "",
} = {}) {
  const profile = readFeRetentionOnboarding(packageConfiguration ?? {}).profile;
  const agency =
    safeString(profile.legalBusinessName)
    || safeString(businessName)
    || safeString(businessId).slice(0, 8)
    || "Agency";
  return `VibeKeep ${agency}`.slice(0, 64);
}

function resolveSmsConnection(integrationPlatform) {
  const runtime = integrationPlatform?.connectionRuntime;
  if (!runtime) return null;
  return runtime.getConnectionByType?.("sms_channel")
    ?? runtime.getConnectionByType?.("twilio_sms")
    ?? null;
}

export async function resolveFeRetentionFromNumber({
  platformStore = null,
  businessId = "",
  packageConfiguration = null,
} = {}) {
  const billed = readFeRetentionBilling(packageConfiguration ?? {}).twilioFromNumber;
  if (billed) return billed;
  const id = safeString(businessId);
  if (!id || !platformStore?.getIntegrationCredential) return "";
  const cred = await platformStore.getIntegrationCredential(feSmsCredentialId(id)).catch(() => null);
  return safeString(cred?.secrets?.fromNumber || cred?.metadata?.fromNumber);
}

export function isFeRetentionOpsFromNumber(fromNumber) {
  return feSmsPhonesMatch(fromNumber, readPlatformTwilioSmsEnv().fromNumber);
}

async function persistBookFromNumber({ platformStore, businessId, fromNumber }) {
  if (typeof platformStore?.updateBusinessPackageConfiguration !== "function") return;
  let business = null;
  try {
    business = await platformStore.getBusinessById?.(businessId);
  } catch {
    business = null;
  }
  if (!business) {
    const list = await platformStore.listBusinesses?.({ limit: 500 }).catch(() => []) ?? [];
    business = list.find((row) => String(row.id) === String(businessId)) ?? null;
  }
  if (!business) return;
  const next = writeFeRetentionBilling(business.packageConfiguration ?? {}, { twilioFromNumber: fromNumber });
  await platformStore.updateBusinessPackageConfiguration({
    businessId,
    packageConfiguration: next,
  });
  await syncFeRetentionBillingOntoInstallation({
    platformStore,
    businessId,
    packageConfiguration: next,
  });
}

async function writeFeSmsCredential({
  platformStore,
  vault,
  putDurableCredential,
  businessId,
  fromNumber,
  provisionedBy,
  actorId,
  phoneSid = null,
  simulated = false,
}) {
  const env = readPlatformTwilioSmsEnv();
  await putDurableCredential({
    platformStore,
    vault,
    workspaceId: businessId,
    credentialId: feSmsCredentialId(businessId),
    providerType: "twilio_sms",
    secrets: {
      accountSid: env.accountSid,
      authToken: env.authToken,
      fromNumber,
    },
      metadata: {
      fromNumber,
      phoneSid: phoneSid || null,
      provisionedBy,
      simulated,
      a2pRegistrationStatus: "pending",
      feA2pProduct: "vibekeep",
      actorId,
    },
  });
  await persistBookFromNumber({ platformStore, businessId, fromNumber });
}

/**
 * Persist a From-number on this book only. Idempotent when a number already exists.
 * Does not buy until the book is allowed on the dashboard (paid, promo, or legacy).
 */
export async function ensureFeRetentionPlatformSms({
  platformStore,
  businessId,
  vault = null,
  putDurableCredential,
  actorId = "fe_retention_sms",
  packageConfiguration = null,
  fetchImpl = globalThis.fetch,
  simulate = process.env.TWILIO_PROVISION_SIMULATE === "1",
} = {}) {
  const id = safeString(businessId);
  if (!id || typeof putDurableCredential !== "function" || !platformStore) {
    return deepFreeze({ ok: false, reason: "missing_args" });
  }

  let billingConfig = packageConfiguration;
  const business = await platformStore.getBusinessById?.(id).catch(() => null);
  if (!billingConfig) {
    billingConfig = business?.packageConfiguration ?? {};
  }
  const billing = readFeRetentionBilling(billingConfig);
  if (!billing.allowsDashboard) {
    return deepFreeze({
      ok: false,
      reason: "payment_required",
      message: "SMS number is assigned after the book is paid or complimentary.",
    });
  }

  const env = readPlatformTwilioSmsEnv();
  if (!env.accountSid || !env.authToken) {
    return deepFreeze({
      ok: false,
      reason: "platform_twilio_not_configured",
      message: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the server.",
    });
  }

  const credentialId = feSmsCredentialId(id);
  try {
    const existing = await platformStore.getIntegrationCredential?.(credentialId).catch(() => null);
    const existingFrom = safeString(existing?.secrets?.fromNumber || existing?.metadata?.fromNumber);
    if (existing?.secrets?.accountSid && existingFrom && !isFeRetentionOpsFromNumber(existingFrom)) {
      if (!billing.twilioFromNumber || isFeRetentionOpsFromNumber(billing.twilioFromNumber)) {
        await persistBookFromNumber({ platformStore, businessId: id, fromNumber: existingFrom });
      }
      return deepFreeze({
        ok: true,
        already: true,
        credentialId,
        fromNumber: existingFrom,
        provisionedBy: existing?.metadata?.provisionedBy || "fe_retention_purchased",
      });
    }
  } catch {
    /* continue to buy */
  }

  const billedFrom = safeString(billing.twilioFromNumber);
  if (billedFrom && !isFeRetentionOpsFromNumber(billedFrom)) {
    await writeFeSmsCredential({
      platformStore,
      vault,
      putDurableCredential,
      businessId: id,
      fromNumber: billedFrom,
      provisionedBy: "fe_retention_purchased",
      actorId,
    });
    return deepFreeze({
      ok: true,
      already: true,
      credentialId,
      fromNumber: billedFrom,
    });
  }

  const webhookUrl = resolveFeRetentionInboundSmsWebhookUrl();
  const purchased = await purchaseTwilioLocalSmsNumber({
    fetchImpl,
    smsUrl: webhookUrl || "",
    friendlyName: buildFeRetentionTwilioFriendlyName({
      businessName: business?.name,
      packageConfiguration: billingConfig,
      businessId: id,
    }),
    businessId: id,
    simulate,
    skipPool: true,
    areaCode: readFeRetentionOnboarding(billingConfig).profile.preferredAreaCode
      || safeString(process.env.TWILIO_PROVISION_AREA_CODE),
  });
  if (!purchased.ok) {
    return deepFreeze({
      ok: false,
      reason: purchased.reason || "number_purchase_failed",
      message: purchased.message || "Could not buy a dedicated texting number for this book.",
    });
  }

  await writeFeSmsCredential({
    platformStore,
    vault,
    putDurableCredential,
    businessId: id,
    fromNumber: purchased.fromNumber,
    provisionedBy: "fe_retention_purchased",
    actorId,
    phoneSid: purchased.phoneSid || null,
    simulated: purchased.simulated === true,
  });

  return deepFreeze({
    ok: true,
    already: false,
    credentialId,
    fromNumber: purchased.fromNumber,
    phoneSid: purchased.phoneSid || null,
    provisionedBy: "fe_retention_purchased",
    simulated: purchased.simulated === true,
    inboundWebhookConfigured: purchased.smsUrlConfigured === true,
  });
}

/**
 * Send SMS via workspace Twilio connection, else platform Twilio using this book's From-number.
 */
export async function sendFeRetentionSmsMessage({
  integrationPlatform = null,
  to,
  body,
  fromNumber = null,
  platformStore = null,
  businessId = null,
  packageConfiguration = null,
  fetchImpl = globalThis.fetch,
  nowISO = null,
} = {}) {
  const phone = normalizeFePhone(to);
  const text = safeString(body);
  if (!phone || !text) {
    return deepFreeze({ ok: false, reason: "to_and_body_required" });
  }

  const connection = resolveSmsConnection(integrationPlatform);
  const provider = integrationPlatform?.providerRegistry?.getProvider?.("twilio_sms")
    ?? (connection
      ? integrationPlatform?.providerRegistry?.getProvider?.(connection.providerId)
      : null);

  if (connection && provider?.executeAction) {
    if (typeof provider._nowISO !== "undefined" && nowISO) {
      provider._nowISO = String(nowISO);
    }
    const result = await provider.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.SEND_SMS,
        parameters: { to: phone, body: text },
      },
      connection,
      credentialResolver: integrationPlatform.credentialResolver,
    });
    if (result?.status === "completed") {
      return deepFreeze({
        ok: true,
        via: "connection",
        externalReference: result.externalReference ?? null,
        fromNumber: result.metadata?.from ?? null,
      });
    }
    // Fall through to platform env if connection send failed (e.g. missing vault hydrate)
  }

  let from = safeString(fromNumber);
  if (!from && platformStore && businessId) {
    from = await resolveFeRetentionFromNumber({
      platformStore,
      businessId,
      packageConfiguration,
    });
  }

  const env = readPlatformTwilioSmsEnv();
  if (!from) {
    if (businessId) {
      return deepFreeze({
        ok: false,
        reason: "sms_not_ready",
        message: "This book does not have a texting number yet.",
      });
    }
    from = env.fromNumber;
  }
  if (!env.accountSid || !env.authToken || !from) {
    return deepFreeze({
      ok: false,
      reason: "sms_not_ready",
      message: connection
        ? "SMS connection failed and platform Twilio env is not configured."
        : "Texting is not ready. Platform Twilio env is not configured.",
    });
  }

  const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");
  const form = new URLSearchParams({ To: phone, From: from, Body: text });
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return deepFreeze({
        ok: false,
        reason: "twilio_http_error",
        message: safeString(data?.message || `Twilio HTTP ${res.status}`),
        errorCode: data?.code ?? null,
      });
    }
    return deepFreeze({
      ok: true,
      via: "platform_env",
      externalReference: safeString(data.sid) || null,
      fromNumber: from,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "twilio_network_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Operator texts always come from TWILIO_MESSAGING_FROM, never a client book number. */
export async function sendFeRetentionOpsSms(input = {}) {
  const env = readPlatformTwilioSmsEnv();
  return sendFeRetentionSmsMessage({
    ...input,
    businessId: null,
    packageConfiguration: null,
    fromNumber: env.fromNumber,
  });
}
